import Vue from 'vue'
import Router from 'vue-router'
import Dashboard from '@/pages/Dashboard'
import Profits from '@/pages/Profits'
import Configure from '@/pages/Configure'
import Notifications from '@/pages/Notifications'
import Balances from '@/pages/Balances'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/Profits',
      name: 'Profits',
      component: Profits
    },
    {
      path: '/Configure',
      name: 'Configure',
      component: Configure
    },
    {
      path: '/Notifications',
      name: 'Notifications',
      component: Notifications
    },
    {
      path: '/Balances',
      name: 'Balances',
      component: Balances
    }
  ]
})
