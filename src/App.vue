<template>
  <div id="app">
    <Heading></Heading>
    <div class="container">
      <b-alert variant="warning" :show="$store.state.history === null">
        <span class="h5">Set up history:</span> Looks like your trade history hasn't been imported yet. Head over to the <b-link to="Configure" class="alert-link">Configure BPC page</b-link> to get started.
      </b-alert>
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
      markets: []
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
