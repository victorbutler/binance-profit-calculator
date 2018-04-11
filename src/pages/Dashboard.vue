<template>
  <div class="container">
    <h1>Dashboard</h1>
    <hr />
    <b-card-group deck class="mb-3" v-if="this.$parent.markets.length">
      <b-card v-for="marketObject in this.$parent.markets" v-bind:key="marketObject.id"
              header-bg-variant="primary"
              header-text-variant="white"
              :header="marketObject.market"
              class="text-center">
        <h3 :class="['card-text', ($store.state.history[marketObject.market].profitPlusBags > 0 ? 'text-success' : '')]">Profit + Bags = {{ $store.state.history[marketObject.market].profitPlusBags }} {{ marketObject.market }}</h3>
        <h3 :class="['card-text', ($store.state.history[marketObject.market].profitMinusBags > 0 ? 'text-success' : '')]">Profit - Bags = {{ $store.state.history[marketObject.market].profitMinusBags }} {{ marketObject.market }}</h3>
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
