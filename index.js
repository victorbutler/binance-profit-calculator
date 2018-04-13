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
      // for (let key in data) {
      //   console.log(key, data[key])
      // }
      resolve()
    } else {
      reject(err)
    }
  })
})

/**
 * Binance
 **/
const api = require('binance')
let binanceWebSocket
const turnOnBinanceMonitor = (keys, ioRef) => new Promise((resolve, reject) => {
  const binanceRest = new api.BinanceRest({
      key: keys.public, // Get this from your account on binance.com
      secret: keys.secret, // Same for this
      timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
      recvWindow: 10000 // Optional, defaults to 5000, increase if you're getting timestamp errors
  })
  const binanceWS = new api.BinanceWS(true)
  try {
    binanceWS.onUserData(binanceRest, (data) => {
      console.debug('turnOnBinanceMonitor.onUserData', data)
      ioRef.emit('binanceUserData', socketIoPackageWrapper(data))
    }, 60000) // Optional, how often the keep alive should be sent in milliseconds
    .then((ws) => {
      // websocket instance available here
      console.debug('turnOnBinanceMonitor.onUserData', '...then done')
      resolve(ws)
    })
  } catch (e) {
    reject(e)
  }
})

const turnOffBinanceMonitor = () => {
  console.debug('turnOffBinanceMonitor', (binanceWebSocket ? 'WebSocket is present' : 'WebSocket is not present'))
  if (binanceWebSocket) {
    binanceWebSocket.terminate()
    console.debug('turnOffBinanceMonitor', 'Close WebSocket')
  }
}

const startupSequenceBinanceMonitor = (ioRef) => {
  if (store.botStatus.get('binanceMonitor') === 'On') {
    console.debug('startupSequenceBinanceMonitor', 'Bot was on, so we are starting it on startup')
    try {
      turnOnBinanceMonitor({public: config.api.public, secret: config.api.secret}, ioRef).then((ws) => {
        store.botStatus.set('binanceMonitor', 'On')
        binanceWebSocket = ws
        ws.addEventListener('close', (code, reason) => {
          if (code === 200) {
            // we gracefully shut down via UI
          } else {
            // some kind of error (maybe 24hour disconnection? network issue?)
          }
          store.botStatus.set('binanceMonitor', 'Off')
          binanceWebSocket = null
        })
        resolve(ws)
      }).catch((reason) => {
        reject(reason)
      })
    } catch (e) {
      reject(e)
    }
  } else {
    resolve()
  }
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
          console.debug('Configuration.binanceMonitor', 'Already On')
        }
        if (!store.botStatus.get('binanceMonitor') || store.botStatus.get('binanceMonitor') === 'Off' || !binanceWebSocket) {
          console.debug('Configuration.binanceMonitor', 'Turn On', {public: config.api.public, secret: config.api.secret})
          turnOnBinanceMonitor({public: config.api.public, secret: config.api.secret}, ioRef).then((ws) => {
            store.botStatus.set('binanceMonitor', 'On')
            binanceWebSocket = ws
            ws.addEventListener('close', (code, reason) => {
              if (code === 200) {
                // we gracefully shut down via UI
              } else {
                // some kind of error (maybe 24hour disconnection? network issue?)
              }
              store.botStatus.set('binanceMonitor', 'Off')
              binanceWebSocket = null
            })
            resolve()
          }).catch((reason) => {
            reject(reason)
          })
        } else {
          resolve()
        }
      } else if (value === 'Off') {
        console.debug('processConfigurationChange.binanceMonitor', 'Turn Off')
        // find a way to turn it off!
        turnOffBinanceMonitor()
        store.botStatus.set('binanceMonitor', 'Off')
        resolve()
        //reject()
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
const tradeHistory = require('./server/tradeHistory.js')

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
          const database = tradeHistory(req.file.path)
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
.then(() => webpackConfigPromise)
.then((wpConfig) => setupWebServer(wpConfig))
.then((io) => startupSequenceBinanceMonitor(io))
.then(() => console.log('finished'))
.catch(reason => {
  console.error('App:', reason)
  console.error('App: Setup sequence incomplete. Exiting now.')
  process.exit(1)
})
