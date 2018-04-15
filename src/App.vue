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
      notifications: []
    }
  },
  methods: {
    getMarkets () {
      let markets = []
      let indexer = 0
      for (const market in this.$store.state.history) {
        markets.push({
          id: indexer++,
          market: market
        })
      }
      this.markets = markets
    },
    notify (title = '', message = '', variant = 'info', dismissible = true, autoDisappear = false) {
      var data = {
        id: this.notifications.length + 1,
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
      this.notifications.push(data)
      console.log('App: notify', data.id, data.title, data.message)
    }
  },
  socket: {
    events: {
      history (msg) {
        if (msg.status.code === 200) {
          this.$store.commit('history', msg.payload)
          this.getMarkets()
          console.log('App: Got some history', msg)
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
        switch (data.executionType) {
          case 'NEW':
            title = 'New ' + data.orderType.toLowerCase() + ' ' + data.side.toLowerCase() + ' order placed for ' + symbol
            message = data.quantity + ' ' + symbol + ' @ ' + data.price + ' ' + market
            break
          case 'CANCELED':
            title = data.side + ' order canceled for ' + data.symbol
            message = data.quantity + ' ' + symbol + ' @ ' + data.price + ' ' + market
            break
          case 'REJECTED':
            title = 'Order rejected for ' + symbol
            message = 'Reason: ' + data.rejectReason
            break
          case 'TRADE':
            if (data.orderStatus === 'FILLED') {
              title = 'Order executed for ' + data.quantity + ' ' + symbol
              message = data.quantity + ' ' + symbol + ' @ ' + data.price + ' ' + market
            }
            if (data.orderStatus === 'PARTIALLY_FILLED') {
              const totalQuantity = Big(data.quantity)
              const accumulatedQuantity = Big(data.accumulatedQuantity)
              title = 'Order partially ' + (accumulatedQuantity.div(totalQuantity).times(100).toFixed(2)) + '% filled for ' + data.accumulatedQuantity + ' ' + symbol
              message = data.lastTradeQuantity + ' ' + symbol + ' @ ' + data.price + ' ' + market + ' (' + (accumulatedQuantity.toString() + '/' + totalQuantity.toString()) + ')'
            }
            break
          case 'EXPIRED':
            title = 'Order expired ' + symbol
            message = data.quantity + ' ' + symbol + ' @ ' + data.price + ' ' + market
            break
          default:
        }
        this.notify(title, message, 'info', true, 10)
      }
    }
  }
}
</script>

<style lang="scss">
  @import 'bootstrap/dist/css/bootstrap.css';
  @import 'bootstrap-vue/dist/bootstrap-vue.css';
  @import 'assets/sass/App';
</style>
