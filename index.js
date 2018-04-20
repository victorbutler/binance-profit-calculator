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
    databaseContainer = tradeHistory.LineProcessor(line, databaseContainer)
    databaseContainer = tradeHistory.BagProcessor(databaseContainer)
    databaseContainer = tradeHistory.ProfitProcessor(databaseContainer)
    store.set('history', databaseContainer)
  } else {
    throw new Error('addLineToHistory', 'Undetectable market!', line.Market)
  }
  return databaseContainer
}

/**
 * Binance
 **/
const binanceMLib = require('./lib/api/binance.js').BinanceModule
let binanceModule
const setupBinanceModule = (config, ioRef) => {
  binanceModule = new binanceMLib({
    publicKey: config.api.public,
    secretKey: config.api.secret,
    reconnectOnDisconnected: true,
    retriesMax: 5
  })
  binanceModule.on('error', (error) => {
    console.log('binanceModule.error', error)
  })
  const userDataHandler = (data) => {
    // TODO: Normalize the userData output so in case we add more exchanges,
    // the package delivered to the front end is the same
    if (data.eventType === 'executionReport') {
      const accumulatedQuantity = Big(data.accumulatedQuantity)
      if ((data.executionType === 'TRADE' && data.orderStatus === 'FILLED') ||
          data.executionType === 'EXPIRED' && data.orderStatus === 'EXPIRED' && accumulatedQuantity.gt(0)) {
        // If we get this far, we've finished buying/selling coins
        const tradeTime = new Date(data.tradeTime)
        const line = {
          'Date(UTC)': tradeTime.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
          'Market': data.symbol,
          'Type': data.side,
          'Price': data.lastTradePrice,
          'Amount': accumulatedQuantity.toString(),
          'Total': accumulatedQuantity.times(Big(data.lastTradePrice)).toFixed(8).toString(),
          'Fee': data.commission,
          'Fee Coin': data.commissionAsset
        }
        const database = addLineToHistory(line)
        ioRef.emit('history', socketIoPackageWrapper(database))
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
}
const turnOnBinanceMonitor = () => {
  console.debug('turnOnBinanceMonitor', 'Starting...')
  binanceModule.startUserDataMonitor()
  store.botStatus.set('binanceMonitor', 'On')
  // When first starting the bot, do a balanceUpdate
  binanceModule.balanceUpdate()
}

const turnOffBinanceMonitor = () => {
  console.debug('turnOffBinanceMonitor', 'Stopping...')
  binanceModule.stopUserDataMonitor()
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
          turnOnBinanceMonitor()
        } else {
          // Already on
        }
      } else if (value === 'Off') {
        console.debug('processConfigurationChange.binanceMonitor', 'Turn Off')
        // find a way to turn it off!
        turnOffBinanceMonitor()
      }
      resolve()
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

const socketIoPackageWrapper = (payload, status) => {
  return {
    timestamp: new Date(),
    payload: payload,
    status: (status ? status : {code: 200, msg: 'OK'})
  }
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
      if (store.get('history')) {
        socket.emit('history', socketIoPackageWrapper(store.get('history')))
      }
      if (binanceModule) {
        binanceModule.balanceUpdate()
      }
      // socket.emit('profits', {timestamp: new Date(), data: profitsWithUSD()})
      socket.on('configuration', function(msg){
        if (msg === 'Refresh') {
          socket.emit('configuration', socketIoPackageWrapper(store.get('configuration')))
        } else {
          let key = msg.key || null
          let value = msg.value || null
          console.debug('Configuration:', key, value)
          processConfigurationChange(key, value, io, socket).then(() => {
            console.debug('Configuration', 'Returned successfully, notify everyone of config change')
            store.configuration.set(key, value)
            io.emit('configuration', socketIoPackageWrapper(store.get('configuration')))
          }).catch((reason) => {
            console.debug('Configuration', 'Returned error, notify user of error')
            socket.emit('configuration', socketIoPackageWrapper(null, {code: 500, msg: reason}))
          })
        }
      })
      socket.on('disconnect', function(){
        console.debug('Socket.io: A user disconnected')
      })
      resolve()
    })

    // Listen on the port
    http.listen(config.server.port, function(){
      console.log('Express: listening on *:' + config.server.port)
    })
  } catch (e) {
    reject(e.message)
  }
})

setupConfig()
.then((config) => setupBinanceModule(config, io))
.then(() => webpackConfigPromise)
.then((wpConfig) => setupWebServer(wpConfig))
.then(() => console.log('App: Startup sequence finished'))
.catch(reason => {
  console.error('App:', reason)
  console.error('App: Setup sequence incomplete. Exiting now.')
  process.exit(1)
})
