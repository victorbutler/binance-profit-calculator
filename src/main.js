// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import Vuex from 'vuex'
import VueWebsocket from 'vue-websocket'
import App from './App'
import router from './router'
import BootstrapVue from 'bootstrap-vue'
import { Alert, FormFile, Navbar } from 'bootstrap-vue/es/components'

// import $ from 'jquery'

Vue.use(Vuex)
Vue.use(VueWebsocket)
Vue.use(BootstrapVue)
Vue.use(Alert)
Vue.use(FormFile)
Vue.use(Navbar)
Vue.config.productionTip = false

const store = new Vuex.Store({
  struct: true,
  state: {
    lastUpdated: null,
    history: null,
    balances: null
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
    }
  }
})

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store: store,
  router,
  components: { App },
  template: '<App/>'
})
