// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import Vuex from 'vuex'
import VueWebsocket from 'vue-websocket'
import App from './App'
import router from './router'
import Accounting from 'accounting'
import Big from 'big.js'

// import $ from 'jquery'

Vue.use(Vuex)
Vue.use(VueWebsocket)

Vue.config.productionTip = false

Vue.filter('accounting', Accounting.formatMoney)

const store = new Vuex.Store({
  struct: true,
  state: {
    lastUpdated: null,
    history: null,
    balances: null,
    coinmarketcap: null
  },
  mutations: {
    update (state, lastUpdate) {
      state.lastUpdated = new Date(lastUpdate)
    },
    history (state, data) {
      state.history = data
    },
    balances (state, data) {
      state.balances = data
    },
    coinmarketcap (state, data) {
      state.coinmarketcap = data
    }
  }
})

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store: store,
  router,
  components: { App },
  template: '<App/>',
  methods: {
    multiply () {
      let result
      for (let num of arguments) {
        if (!result) {
          result = Big(num)
        } else {
          result = result.times(Big(num))
        }
      }
      return result.toString()
    }
  }
})
