<template>
  <div class="container">
    <h1>Dashboard</h1>
    <hr />
    <b-card-group deck class="mb-3" v-if="this.$parent.markets.length">
      <b-card v-for="marketObject in this.$parent.markets" v-bind:key="marketObject.id"
              header-bg-variant="primary"
              header-text-variant="white"
              class="text-center">
        <h6 slot="header" class="mb-0">{{ marketObject.market }} Profits</h6>
        <h4 :class="['card-text', ($store.state.history[marketObject.market].profitPlusBags > 0 ? 'text-success' : '')]">+Bags: {{ $store.state.history[marketObject.market].profitPlusBags }} {{ marketObject.market }}<br /><small>{{ $root.multiply($store.state.history[marketObject.market].profitPlusBags, $parent.getCoinMarketCapData(marketObject.market).price_usd) | accounting }}</small></h4>
        <h4 :class="['card-text', ($store.state.history[marketObject.market].profitMinusBags > 0 ? 'text-success' : '')]">-Bags: {{ $store.state.history[marketObject.market].profitMinusBags }} {{ marketObject.market }}<br /><small>{{ $root.multiply($store.state.history[marketObject.market].profitMinusBags, $parent.getCoinMarketCapData(marketObject.market).price_usd) | accounting }}</small></h4>
      </b-card>
    </b-card-group>
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
