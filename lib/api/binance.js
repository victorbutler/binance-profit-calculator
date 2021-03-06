const EventEmitter = require('events')
const binanceAPI = require('binance')

class BinanceError extends Error {
  constructor (code = 0, ...params) {
    super(...params)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BinanceError);
    }
    this.code = code
    this.date = new Date()
  }
}
BinanceError.prototype.KeysNotPresent = 100
BinanceError.prototype.AuthKeysIssue  = 101

class BinanceModule extends EventEmitter {
  constructor (config) {
    super()
    if (!config.publicKey || !config.secretKey) {
      this.emit('error', new BinanceError(BinanceError.KeysNotPresent, 'Public or secret key not supplied to the Binance module'))
    }
    this.publicKey = config.publicKey
    this.secretKey = config.secretKey
    this.reconnectOnDisconnected = config.reconnectOnDisconnected || false
    this.retriesMax = config.retriesMax || 5
    this.retryAttempts = 0

    this.udWebSocket = null
    this.retriesInterval = null
    this.setupRest()
    this.binanceWS = new binanceAPI.BinanceWS(true)
  }
  setupRest () {
    let self = this
    self.binanceRest = new binanceAPI.BinanceRest({
        key: self.publicKey, // Get this from your account on binance.com
        secret: self.secretKey, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 5000 // Optional, defaults to 5000, increase if you're getting timestamp errors
    })
  }
  pingUserData () {
    let self = this
    // Check if the existing WebSocket is still connected
    if (self.udWebSocket) {
      self.udWebSocket.isAlive = false
      console.log('BiannceModule.pingUserData')
      self.udWebSocket.ping()
      setTimeout(() => { // Wait 1 second for a pong response
        // If pong received, then do nothing - we're still alive
        if (self.udWebSocket.isAlive === false) {
          console.log('BinanceModule.pingUserData', 'PONG check failed. Disconnect and check for reconnect settings.')
          // If after 1 second and no pong, shut down the socket properly
          self.udWebSocket.terminate()
          if (!self.udWebSocket.manuallyDisconnected) {
            // Retry connection if requested
            self.reconnectUserData()
            //self.emit('error', new BinanceError('Stale socket terminated'))
          }
        }
      }, 1000)
    }
  }
  reconnectUserData () {
    let self = this
    if (self.reconnectOnDisconnected && self.retryAttempts < self.retriesMax) {
      self.retriesInterval = setInterval(() => {
        if (self.retryAttempts < self.retriesMax && (!self.udWebSocket || (self.udWebSocket && self.udWebSocket.isAlive === false))) {
          console.log('BinanceModule.reconnectUserData', 'Reconnecting attempt #', (self.retryAttempts + 1), 'out of', self.retriesMax)
          self.startUserDataMonitor()
          self.retryAttempts++
        } else {
          console.log('BinanceModule.reconnectUserData', 'Maximum reconnection retries reached. Don\'t try again.')
          self.retryAttempts = 0
          clearInterval(self.retriesInterval)
          self.retriesInterval = null
        }
      }, 30000) // 30 seconds
    }
  }
  startUserDataMonitor (cb = null) {
    let self = this
    if (!self.udWebSocket) {
      self.binanceWS.onUserData(this.binanceRest, (data) => {
        console.log('BinanceModule.onUserData', data)
        if (data.eventType === 'outboundAccountInfo') {
          self.emit('balanceUpdate', data)
        } else {
          self.emit('userData', data)
        }
      }, 60000 * 30) // Every 30 minutes
      .then((ws) => {
        // Reset retries on successful connection
        self.retryAttempts = 0
        clearInterval(self.retriesInterval)
        self.retriesInterval = null
        // Connection checker
        ws.manuallyDisconnected = false
        ws.isAlive = true
        ws.on('pong', () => {
          // If pong is received, then connection is alive
          ws.isAlive = true
          console.log('BiannceModule', 'Received PONG')
        })
        ws.on('close', () => {
          if (ws.isAlive && ws.manuallyDisconnected === false) {
            self.emit('userDataDisconnected', 1)
          } else if (ws.manuallyDisconnected === true) {
            self.emit('userDataDisconnected', 0)
          }
          ws.isAlive = false
          self.udWebSocket = null
        })
        self.udWebSocket = ws
        console.log('BinanceModule:', 'startUserDataMonitor connected')
        if (cb && typeof cb === 'function') {
          cb(null, ws)
        }
      }).catch((reason) => {
        console.log('BinanceModule:', 'startUserDataMonitor could not connect')
        if (cb && typeof cb === 'function') {
          cb(new BinanceError(BinanceError.AuthKeysIssue, 'Could not connect to userData stream'))
        }
      })
    } else {
      // Since socket is already defined, test the connection with a ping
      self.pingUserData()
    }
  }
  stopUserDataMonitor () {
    let self = this
    if (self.udWebSocket) {
      self.udWebSocket.manuallyDisconnected = true
      self.udWebSocket.terminate()
    }
  }
  balanceUpdate () {
    let self = this
    if (self.binanceRest) {
      console.log('BinanceModule.balanceUpdate', 'Force update')
      self.binanceRest.account({}, (error, data) => {
        if (!error) {
          const balances = data.balances.map((obj, index) => {
            const result = {
              asset: obj.asset,
              availableBalance: obj.free,
              onOrderBalance: obj.locked
            }
            return result
          })
          data.balances = balances
          self.emit('balanceUpdate', data)
        } else {
          console.log('BinanceModule.balanceUpdate', error)
          if (error.message === 'Response code 400') {
            self.emit('error', new BinanceError(BinanceError.AuthKeysIssue, 'Keys rejected by Binance'))
          } else {
            self.emit('error', new BinanceError(0, error.message))
          }
        }
      })
    }
  }
  tickerPrice (symbol) {
    let self = this
    if (self.binanceRest) {
      return self.binanceRest.tickerPrice(symbol)
    }
    return false
  }
}

module.exports = {
  BinanceModule: BinanceModule,
  BinanceError: BinanceError
}
