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
      resolve()
    } else {
      reject(err)
    }
  })
})

/**
 * File based JSON storage
 **/
const store = require('data-store')('bpc', {
  cwd: 'data'
})
store.create('history')

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
    console.debug('BPC: A user connected')
    if (store.get('history')) {
      socket.emit('history', socketIoPackageWrapper(store.get('history')))
    }
    // socket.emit('profits', {timestamp: new Date(), data: profitsWithUSD()})
    // socket.on('profits', function(msg){
    //   // console.debug('message: ' + msg)
    //   socket.emit('profits', {timestamp: new Date(), data: profitsWithUSD()})
    // })
    socket.on('disconnect', function(){
      console.debug('BPC: A user disconnected')
    })
  })

  // Listen on the port
  http.listen(config.server.port, function(){
    console.log('BPC: listening on *:' + config.server.port)
  })
})

setupConfig()
.then(() => webpackConfigPromise)
.then((wpConfig) => setupWebServer(wpConfig))
.then(() => console.log('finished'))
.catch(reason => {
  console.error('BPC:', reason)
  console.error('BPC: Setup sequence incomplete. Exiting now.')
  process.exit(1)
})
