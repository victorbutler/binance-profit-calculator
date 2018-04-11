<template>
  <div class="container">
    <h1>Profits</h1>
    <hr />
    <b-tabs v-if="this.$parent.markets.length">
      <b-tab v-for="(marketObject, index) in this.$parent.markets" v-bind:key="marketObject.id" :title="marketObject.market" :active="index === 0">
        <b-table striped hover :items="getMarketTableData(marketObject.market)"></b-table>
      </b-tab>
    </b-tabs>
    <div v-if="this.$parent.markets.length === 0">
      <h2>There isn't any data yet. Head over to <b-link to="Configure">Configure</b-link> to supply your trade history.</h2>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Profits',
  methods: {
    getMarketTableData (market) {
      if (this.$store.state.history && typeof this.$store.state.history[market] === 'object') {
        let items = []
        for (const pair of this.$store.state.history[market].pairs) {
          let item = {
            Coin: pair.Coin,
            Amount: pair.Amount,
            Bought: pair.Bought,
            Sold: pair.Sold,
            Profit: pair.Difference,
            ProfitMinusBags: pair.DifferenceWithoutBags
          }
          items.push(item)
        }
        items.push({
          Coin: 'Total',
          Amount: null,
          Bought: this.$store.state.history[market].total.bought,
          Sold: this.$store.state.history[market].total.sold,
          Profit: this.$store.state.history[market].profitPlusBags,
          ProfitMinusBags: this.$store.state.history[market].profitMinusBags
        })
        return items
      }
      return false
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit SCSS to this component only -->
<style lang="scss" scoped>
.profit-table {
  display: table;
  width: 100%;
  .profit {
    display: table-row;
    > div {
      display: table-cell;
      width: 25%;
    }
    > div.market {
      text-align: left;
    }
  }
  .table-headers {
    font-weight: bold;
    font-size: 1.25em;
  }
}
</style>
