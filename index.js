process.title = 'binance-profit-calculator'
const debug = !(process.env.NODE_ENV === 'production') || false
const testMode = false // don't make any remote requests
console.debug = (...args) => debug && console.log(...args)

/**
 * Misc Libraries
 **/
const Big = require('big.js')
const path = require('path')
const del = require('del')

/**
 * File based JSON storage
 **/
const store = require('data-store')('bpc', {
  cwd: 'data'
})
store.create('configuration')
store.create('botStatus')

/**
 * Config
 **/
const prop = require('properties')
const propOptions = {
  path: true,
  namespaces: true
}
let config
const setupConfig = () => new Promise((resolve, reject) => {
  prop.parse(path.join(__dirname, 'config.properties'), propOptions, (err, data) => {
    if (!err) {
      config = data
      if (data.server.port) {
        process.env.PORT = data.server.port
      }
      // for (let key in data) {
      //   console.log(key, data[key])
      // }
      resolve(data)
    } else {
      reject(err)
    }
  })
})

/**
 * Trade tracking
 * TODO: History can get very large to be sending out the entire thing
 * on every trade activity. Find a way to minimize this bloat.
 * (try to only send differences?)
 **/
const tradeHistory = require('./lib/tradeHistory.js')
const addLineToHistory = (line) => {
  // add to pairs _data (top of the stack, use Array.prototype.unshift() )
  const myMarket = tradeHistory.DetectMarket(line.Market)
  if (myMarket) {
    // recalculate Amount, Fee, Bought, Sold, Difference, DifferenceWithoutBags
    let databaseContainer = store.get('history')
    if (!databaseContainer) {
      databaseContainer = {}
    }
    databaseContainer = tradeHistory.DatabaseContainerNormalizer(databaseContainer)
    databaseContainer = tradeHistory.LineProcessor(line, databaseContainer, true)
    databaseContainer = tradeHistory.BagProcessor(databaseContainer)
    databaseContainer = tradeHistory.ProfitProcessor(databaseContainer)
    store.set('history', databaseContainer)
    return databaseContainer
  } else {
    throw new Error('addLineToHistory', 'Undetectable market!', line.Market)
  }
}

/**
 * Binance
 **/
const binanceLib = require('./lib/api/binance.js')
const binanceMLib = binanceLib.BinanceModule
let binanceModule
const setupBinanceModule = (config, ioRef) => new Promise((resolve, reject) => {
  try {
    binanceModule = new binanceMLib({
      publicKey: config.api.public,
      secretKey: config.api.secret,
      reconnectOnDisconnected: true,
      retriesMax: 5
    })
    binanceModule.on('error', (error) => {
      console.debug('binanceModule.error', error)
      if (error.code === binanceLib.BinanceError.AuthKeysIssue) {
        store.botStatus.set('binanceMonitor', 'Off')
        ioRef.emit('error', error)
        // set global error flag
      }
      if (error.code === binanceLib.BinanceError.KeysNotPresent) {
        store.botStatus.set('binanceMonitor', 'Off')
        ioRef.emit('error', error)
        // set global error flag
      }
    })
    const userDataHandler = (data) => {
      // TODO: Normalize the userData output so in case we add more exchanges,
      // the package delivered to the front end is the same
      if (data.eventType === 'executionReport') {
        const accumulatedQuantity = Big(data.accumulatedQuantity)
        const lastTradeQuantity = Big(data.lastTradeQuantity)
        if ((data.executionType === 'TRADE' && data.orderStatus === 'FILLED') ||
            (data.executionType === 'TRADE' && data.orderStatus === 'PARTIALLY_FILLED') ||
            (data.executionType === 'EXPIRED' && data.orderStatus === 'EXPIRED' && accumulatedQuantity.gt(0))) {
          const partiallyFilled = (data.executionType === 'TRADE' && data.orderStatus === 'PARTIALLY_FILLED') ? true : false
          const lastTradePrice = Big(data.lastTradePrice)
          const lastTradedTotal = lastTradeQuantity.times(lastTradePrice)
          const accumulatedTotal = accumulatedQuantity.times(lastTradePrice)
          const tradeTime = new Date(data.tradeTime)
          const line = {
            'Date(UTC)': tradeTime.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
            'Market': data.symbol,
            'Type': data.side,
            'Price': lastTradePrice.toFixed(8).toString(),
            'Amount': lastTradeQuantity.toFixed(8).toString(),
            'Total': lastTradedTotal.toFixed(8).toString(),
            'Fee': data.commission,
            'Fee Coin': data.commissionAsset
          }
          console.log('userDataHandler', 'line created from trade activity', line)
          const database = addLineToHistory(line)
          if (database) {
            ioRef.emit('history', socketIoPackageWrapper(database))
          }
        }
        ioRef.emit('orderInfo', socketIoPackageWrapper(data))
      }
    }
    binanceModule.on('userData', userDataHandler)
    binanceModule.on('userDataDisconnected', (error) => {
      console.log('binanceModule.userDataDisconnected', (error ? 'Forefully disconnected!' : 'Gracefully disconnected'))
    })
    binanceModule.on('balanceUpdate', (data) => {
      ioRef.emit('balanceUpdate', socketIoPackageWrapper(data))
    })
    if (store.botStatus.get('binanceMonitor') === 'On') {
      binanceModule.startUserDataMonitor()
    }
    resolve(binanceModule)
  } catch (e) {
    console.log(typeof e, e)
    reject(e.message)
  }
})

const turnOnBinanceMonitor = (cb = null) => {
  if (binanceModule) {
    console.debug('turnOnBinanceMonitor', 'Starting...')
    binanceModule.startUserDataMonitor(cb)
    store.botStatus.set('binanceMonitor', 'On')
    // When first starting the bot, do a balanceUpdate
    binanceModule.balanceUpdate()
    // binanceModule.tickerPrice()
    // .then((data) => {
    //   console.debug('turnOnBinanceMonitor', 'binanceMonitor.tickerPrice', 'Received', data.length)
    // })
  } else {
    if (cb && typeof cb === 'function') {
      cb(new binanceLib.BinanceError())
    }
  }
}

const turnOffBinanceMonitor = () => {
  if (binanceModule) {
    console.debug('turnOffBinanceMonitor', 'Stopping...')
    binanceModule.stopUserDataMonitor()
  }
  store.botStatus.set('binanceMonitor', 'Off')
}

/**
 * Process Configuration
 **/
const processConfigurationChange = (key, value, ioRef, socketRef) => new Promise((resolve, reject) => {
  console.debug('processConfigurationChange:', key, value)
  switch (key) {
    case 'binanceMonitor':
      if (value === 'On') {
        if (store.botStatus.get('binanceMonitor') === 'On') {
          // monitor already on, don't do anything
          // (maybe check on the running status)
          console.debug('processConfigurationChange.binanceMonitor', 'Already On')
        }
        if (!store.botStatus.get('binanceMonitor') || store.botStatus.get('binanceMonitor') === 'Off') {
          console.debug('processConfigurationChange.binanceMonitor', 'Turn On')
          turnOnBinanceMonitor((error, ws) => {
            if (error) {
              reject(error)
            } else {
              resolve(ws)
            }
          })
        } else {
          // Already on
          resolve()
        }
      } else if (value === 'Off') {
        console.debug('processConfigurationChange.binanceMonitor', 'Turn Off')
        // find a way to turn it off!
        turnOffBinanceMonitor()
        resolve()
      }
      break
      default:
        reject('Configuration key is invalid')
  }
})

/**
 * Web Server Setup
 **/
const express = require('express')
const app = express()
const multer = require('multer')
const upload = multer({dest: path.join(__dirname, 'uploads')})
const http = require('http').Server(app)
const io = require('socket.io')(http)
const webpack = require('webpack')
const webpackDevMiddleware = require('webpack-dev-middleware')
const webpackHotMiddleware = require('webpack-hot-middleware')
const webpackConfigPromise = require('./build/webpack.dev.conf.js')
let userData = {
  connected: 0,
  handlers: {}
}
let coinMarketCapData = []

const socketIoPackageWrapper = (payload, status) => {
  return {
    timestamp: new Date(),
    payload: payload,
    status: (status ? status : {code: 200, msg: 'OK'})
  }
}

const CoinmarketcapLib = require('node-coinmarketcap')
const coinmarketcap = new CoinmarketcapLib({
    events: true, // Enable event system
    refresh: 30, // Refresh time in seconds (Default: 60)
    convert: "USD" // Convert price to different currencies. (Default USD)
})
const userConnectedHandler = (socket, ioRef) => {
  if (userData.connected === 0) { // previous count, before this connection
    // connect user services
    coinmarketcap.getAll((data) => {
      coinMarketCapData = data
      ioRef.emit('coinmarketcap', socketIoPackageWrapper(coinMarketCapData))
    })
    userData.handlers.coinMarketCap = setInterval(() => {
      coinmarketcap.getAll((data) => {
        coinMarketCapData = data
        ioRef.emit('coinmarketcap', socketIoPackageWrapper(coinMarketCapData))
      })
      // coinmarketcap.multi(coins => {
      //   for (let market in store.get('history')) {
      //     console.log(coins.get(market))
      //   }
      // })
    }, 30000) // every 30 seconds
  }
  userData.connected++
}

const userDisconnectedHandler = () => {
  if (userData.connected === 1) { // previous count, before this connection
    // disconnect all user related services
    console.log('userDisconnectedHandler', 'Stopping user services')
    clearTimeout(userData.handlers.coinMarketCap)
  }
  userData.connected--
}

const setupWebServer = (wpConfig) => new Promise((resolve, reject) => {
  const webpackConfig = wpConfig,
        compiler = webpack(wpConfig)

  try {
    app.post('/tradeHistory', upload.single('tradeHistory'), function (req, res, next) {
      if (req.file.originalname.match(/\.(xls|xlsx|csv)$/i)) {
        try {
          // send this filename to the tradeHistory processor
          const database = tradeHistory.ExcelProcessor(req.file.path)
          store.del('history')
          store.set('history', database)
          console.debug('TradeHistory imported and saved')
          io.emit('history', socketIoPackageWrapper(database))
          res.sendStatus(200)
        } catch (e) {
          res.status(500).send('Error processing your history file: ' + e.message)
        }
        // delete uploaded file
        del.sync([req.file.path])
      } else {
        res.status(500).send('Bad file type. Only XLS, XLSX, and CSV files are supported.')
      }
    })

    app.use(express.static(config.server.docroot))

    if (debug) {
      // Set up Webpack Middleware
      app.use(webpackDevMiddleware(compiler, {
        noinfo: true,
        publicPath: webpackConfig.output.publicPath
      }))

      // Set up Webpack Hot Module Reloading
      app.use(webpackHotMiddleware(compiler, {
        log: console.debug,
        path: '/__webpack_hmr',
        heartbeat: 10 * 1000
      }))
    }

    // Set up socket.io streaming
    io.on('connection', function(socket){
      console.debug('Socket.io: A user connected')
      userConnectedHandler(socket, io)
      if (store.get('history')) {
        socket.emit('history', socketIoPackageWrapper(store.get('history')))
      }
      if (coinMarketCapData) {
        socket.emit('coinmarketcap', socketIoPackageWrapper(coinMarketCapData))
      }
      if (store.configuration) {
        socket.emit('configuration', socketIoPackageWrapper(store.configuration.get()))
      }
      if (binanceModule && store.botStatus.get('binanceMonitor') === 'On') {
        binanceModule.balanceUpdate()
      }
      // socket.emit('profits', {timestamp: new Date(), data: profitsWithUSD()})
      socket.on('configuration', function(msg){
        if (msg === 'Refresh') {
          socket.emit('configuration', socketIoPackageWrapper(store.configuration.get()))
        } else {
          let key = msg.key || null
          let value = msg.value || null
          console.debug('Configuration:', key, value)
          processConfigurationChange(key, value, io, socket).then(() => {
            console.debug('Configuration', 'Returned successfully, notify everyone of config change')
            store.configuration.set(key, value)
            io.emit('configuration', socketIoPackageWrapper(store.configuration.get()))
          }).catch((reason) => {
            console.debug('Configuration', 'Returned error, notify user of error', reason)
            socket.emit('configuration', socketIoPackageWrapper(null, {code: 500, msg: reason}))
          })
        }
      })
      socket.on('disconnect', function(){
        console.debug('Socket.io: A user disconnected')
        userDisconnectedHandler()
      })
      resolve()
    })

    // Listen on the port
    http.listen(config.server.port, function(){
      console.log('Express: listening on *:' + config.server.port)
    })
  } catch (e) {
    reject(e)
  }
})

setupConfig()
.then((config) => setupBinanceModule(config, io))
.then(() => webpackConfigPromise)
.then((wpConfig) => setupWebServer(wpConfig))
.then(() => console.log('App: Startup sequence finished'))
.catch(reason => {
  console.error('App Error:', reason)
  console.error('App: Setup sequence incomplete. Exiting now.')
  process.exit(1)
})
