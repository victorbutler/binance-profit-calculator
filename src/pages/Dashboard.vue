<template>
  <div class="container">
    <h1>Dashboard - {{msg}}</h1>
    <hr />
    <div class="row">
      <div class="col s12 m6 l4 xl4" v-for="marketObject in this.$parent.markets" v-bind:key="marketObject.id">
        <div class="card small">
          <div class="card-content">
            <span class="card-title"><router-link v-bind:to="('/Profits/' + marketObject.market)">{{ marketObject.market }} Profits</router-link></span>
            <p>+Bags: {{ $store.state.history[marketObject.market].profitPlusBags }} {{ marketObject.market }} ({{ $root.multiply($store.state.history[marketObject.market].profitPlusBags, $parent.getCoinMarketCapData(marketObject.market).price_usd) | accounting }})</p>
            <p>-Bags: {{ $store.state.history[marketObject.market].profitMinusBags }} {{ marketObject.market }} ({{ $root.multiply($store.state.history[marketObject.market].profitMinusBags, $parent.getCoinMarketCapData(marketObject.market).price_usd) | accounting }})</p>
          </div>
          <div class="card-action">
            <a href="#">Trade</a>
            <a href="#">Activity</a>
          </div>
        </div>
      </div>
    </div>
    <div v-if="this.$parent.markets.length === 0">
      <h2>There isn't any data yet. Head over to <b-link to="Configure">Configure</b-link> to supply your trade history.</h2>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Dashboard',
  data () {
    return {
      msg: 'Welcome to Your App'
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
