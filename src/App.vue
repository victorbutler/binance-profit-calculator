<template>
  <div id="app">
    <Heading></Heading>
    <div class="container">
      <b-alert variant="warning" :show="$store.state.history === null">
        <span class="h5">Set up history:</span> Looks like your trade history hasn't been imported yet. Head over to the <b-link to="Configure" class="alert-link">Configure BPC page</b-link> to get started.
      </b-alert>
      <div v-for="notification in notifications"
        v-bind:key="notification.id">
        <b-alert
          :show="notification.dismissCountDown"
          :variant="notification.variant"
          :dismissible="notification.dismissible"
          @dismiss-count-down="notification.countDownChanged"
          @dismissed="notification.dismissCountDown=0">
          <h5>{{ notification.title }}</h5>
          <span>{{ notification.message }}</span>
          <b-progress :variant="notification.variant"
            :max="notification.dismissSecs"
            :value="notification.dismissCountDown"
            height="4px">
          </b-progress>
        </b-alert>
      </div>
    </div>
    <div id="main" role="main">
      <!-- #MAIN CONTENT -->
      <div id="content">
        <router-view/>
      </div>

      <!-- END #MAIN CONTENT -->

    </div>
    <!-- END #MAIN PANEL -->
  </div>
</template>

<script>
import Heading from './components/Heading.vue'
import Big from 'big.js'

// const checksum = function (s) {
//   let hash = 0
//   let i
//   let c
//   const strlen = s.length
//   if (strlen === 0) {
//     return hash
//   }
//   for (i = 0; i < strlen; i++) {
//     c = s.charCodeAt(i)
//     hash = ((hash << 5) - hash) + c
//     hash = hash & hash // Convert to 32bit integer
//   }
//   return hash
// }

export default {
  name: 'App',
  components: {
    Heading
  },
  data () {
    return {
      markets: [],
      notifications: [],
      notificationsCounter: 0
    }
  },
  computed: {
    reverseNotifications () {
      return this.notifications.slice().reverse()
    }
  },
  methods: {
    getMarkets () {
      if (this.markets.length === 0) {
        let markets = []
        let indexer = 0
        for (const market in this.$store.state.history) {
          markets.push({
            id: indexer++,
            market: market
          })
        }
        this.markets = markets
      }
      return this.markets
    },
    getCoinMarketCapData (symbol) {
      if (symbol) {
        switch (symbol) {
          case 'BCC':
            symbol = 'BCH'
            break
          default:
        }
        for (let capData of this.$store.state.coinmarketcap) {
          if (capData.symbol === symbol || capData.name === symbol || capData.id === symbol.toLowerCase()) {
            return capData
          }
        }
      }
      return false
    },
    notify (title = '', message = '', variant = 'info', dismissible = true, autoDisappear = false) {
      var data = {
        id: this.notificationsCounter + 1,
        title: title,
        message: message,
        dismissible: dismissible,
        dismissCountDown: autoDisappear,
        dismissSecs: autoDisappear,
        variant: variant,
        countDownChanged: (newCountdown) => {
          data.dismissCountDown = newCountdown
        }
      }
      // Only keep 10 notifications in the holster, save the rest somewhere else
      // This might move to the BOT side
      if (this.notificationsCounter >= 10) {
        this.notifications.push(data)
        this.notifications.shift()
      } else {
        this.notifications.push(data)
      }
      this.notificationsCounter++
      console.log('App: notify', data.id, data.title, data.message)
    }
  },
  socket: {
    events: {
      history (msg) {
        console.log('App: Got some history', msg)
        if (msg.status.code === 200) {
          this.$store.commit('history', msg.payload)
          this.getMarkets()
        }
      },
      orderInfo (msg) {
        console.log('App: Got some orderInfo', msg)
        const data = msg.payload
        // create a Notification
        let title
        let message
        let market
        let symbol = data.symbol
        for (let i = 0; i < this.markets.length; i++) {
          if (data.symbol.endsWith(this.markets[i].market)) {
            market = this.markets[i].market
            symbol = data.symbol.substring(0, data.symbol.indexOf(market))
          }
        }
        let quantity = Big(data.quantity)
        let price = Big(data.price)
        switch (data.executionType) {
          case 'NEW':
            title = 'New ' + data.orderType.toLowerCase() + ' ' + data.side.toLowerCase() + ' order placed for ' + symbol
            message = quantity.toString() + ' ' + symbol + ' @ ' + price.toString() + ' ' + ' = ' + quantity.times(price).toString() + ' ' + market
            break
          case 'CANCELED':
            title = data.side + ' order canceled for ' + data.symbol
            message = quantity.toString() + ' ' + symbol + ' @ ' + price.toString() + ' ' + ' = ' + quantity.times(price).toString() + ' ' + market
            break
          case 'REJECTED':
            title = 'Order rejected for ' + quantity.toString() + ' ' + symbol
            message = 'Reason: ' + data.rejectReason + '<br />' + quantity.toString() + ' ' + symbol + ' @ ' + price.toString() + ' ' + ' = ' + quantity.times(price).toString() + ' ' + market
            break
          case 'TRADE':
            if (data.orderStatus === 'FILLED') {
              title = data.side + ' order executed for ' + data.quantity + ' ' + symbol
              message = quantity.toString() + ' ' + symbol + ' @ ' + price.toString() + ' ' + ' = ' + quantity.times(price).toString() + ' ' + market
            }
            if (data.orderStatus === 'PARTIALLY_FILLED') {
              const totalQuantity = Big(data.quantity)
              const accumulatedQuantity = Big(data.accumulatedQuantity)
              const lastTradeQuantity = Big(data.lastTradeQuantity)
              const lastTradePrice = Big(data.lastTradePrice)
              title = data.side + ' order partially ' + (accumulatedQuantity.div(totalQuantity).times(100).toFixed(2)) + '% filled for ' + data.accumulatedQuantity + ' ' + symbol
              message = lastTradeQuantity.toString() + ' ' + symbol + ' @ ' + price.toString() + ' = ' + lastTradeQuantity.times(lastTradePrice).toString() + ' ' + market + ' (' + (accumulatedQuantity.toString() + '/' + totalQuantity.toString()) + ')'
            }
            break
          case 'EXPIRED':
            title = data.side + ' order expired ' + symbol
            message = quantity.toString() + ' ' + symbol + ' @ ' + price.toString() + ' ' + ' = ' + quantity.times(price).toString() + ' ' + market
            break
          default:
        }
        this.notify(title, message, 'info', true, 10)
      },
      balanceUpdate (msg) {
        console.log('App: Got some balances', msg)
        if (msg.status.code === 200) {
          this.$store.commit('balances', msg.payload.balances)
        }
      },
      coinmarketcap (msg) {
        console.log('App: Got coinmarketcap', msg)
        if (msg.status.code === 200) {
          this.$store.commit('coinmarketcap', msg.payload)
        }
      }
    }
  },
  mounted () {
  }
}
</script>

<style lang="scss">
  @import 'bootstrap/dist/css/bootstrap.css';
  @import 'bootstrap-vue/dist/bootstrap-vue.css';
  @import 'assets/sass/App';
</style>
