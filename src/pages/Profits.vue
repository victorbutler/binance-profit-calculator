<template>
  <div class="container">
    <h1>Profits</h1>
    <hr />
    <div class="row my-3" v-if="this.$parent.markets.length">
      <div class="col-sm-4">
        <b-input-group>
          <b-form-input v-model="filter" placeholder="Type to Search" />
          <b-input-group-append>
            <b-btn :disabled="!filter" @click="filter = ''">Clear</b-btn>
          </b-input-group-append>
        </b-input-group>
      </div>
    </div>
    <b-tabs v-if="this.$parent.markets.length">
      <b-tab v-for="(marketObject, index) in this.$parent.markets" v-bind:key="marketObject.id" :title="marketObject.market" :active="index === 0">
        <b-table
          striped
          hover
          foot-clone
          :fields="fields"
          :sort-by.sync="sortBy"
          :sort-desc.sync="sortDesc"
          :filter="filter"
          :items="getMarketTableData(marketObject.market)"
          @filtered="onFiltered">
          <template slot="emptyfiltered" slot-scope="data">
            <strong>No results</strong>
          </template>
          <template slot="Coin" slot-scope="data">
            {{ data.value }}
            <small v-if="$parent.getCoinMarketCapData(data.item.Coin)"><br />{{ $parent.getCoinMarketCapData(data.item.Coin).price_usd | accounting }}</small>
          </template>
          <template slot="Profit" slot-scope="data">
            <strong>{{ data.value }}</strong>
            <small v-if="$parent.getCoinMarketCapData(marketObject.market)"><br />{{ $root.multiply(data.value, $parent.getCoinMarketCapData(marketObject.market).price_usd) | accounting }}</small>
          </template>
          <template slot="ProfitMinusBags" slot-scope="data">
            <strong>{{ data.value }}</strong>
            <small v-if="$parent.getCoinMarketCapData(marketObject.market)"><br />{{ $root.multiply(data.value, $parent.getCoinMarketCapData(marketObject.market).price_usd) | accounting }}</small>
          </template>
          <template slot="FOOT_Coin" slot-scope="data">
            <!-- A custom formatted footer cell  for field 'name' -->
            <strong>Total</strong>
          </template>
          <template slot="FOOT_Amount" slot-scope="data"></template>
          <template slot="FOOT_Bought" slot-scope="data">
            <strong>{{ totals[marketObject.market].bought }}</strong>
          </template>
          <template slot="FOOT_Sold" slot-scope="data">
            <strong>{{ totals[marketObject.market].sold }}</strong>
          </template>
          <template slot="FOOT_Profit" slot-scope="data">
            <strong>{{ totals[marketObject.market].profitPlusBags }}</strong>
          </template>
          <template slot="FOOT_ProfitMinusBags" slot-scope="data">
            <strong>{{ totals[marketObject.market].profitMinusBags }}</strong>
          </template>
        </b-table>
      </b-tab>
    </b-tabs>
    <div v-if="this.$parent.markets.length === 0">
      <h2>There isn't any data yet. Head over to <b-link to="Configure">Configure</b-link> to supply your trade history.</h2>
    </div>
  </div>
</template>

<script>
import Big from 'big.js'
export default {
  name: 'Profits',
  data () {
    return {
      filter: null,
      sortBy: 'coin',
      sortDesc: false,
      fields: [
        { key: 'Coin', sortable: true },
        { key: 'Amount', sortable: true },
        { key: 'Bought', sortable: true },
        { key: 'Sold', sortable: true },
        { key: 'Profit', sortable: true },
        { key: 'ProfitMinusBags', sortable: true }
      ],
      totals: {}
    }
  },
  methods: {
    getMarketTableData (market) {
      if (this.$store.state.history && typeof this.$store.state.history[market] === 'object') {
        this.totals[market] = {
          bought: Number(this.$store.state.history[market].total.bought),
          sold: Number(this.$store.state.history[market].total.sold),
          profitPlusBags: Number(this.$store.state.history[market].profitPlusBags),
          profitMinusBags: Number(this.$store.state.history[market].profitMinusBags)
        }
        let items = []
        for (const pair of this.$store.state.history[market].pairs) {
          let item = {
            Coin: pair.Coin,
            Amount: Number(pair.Amount),
            Bought: Number(pair.Bought),
            Sold: Number(pair.Sold),
            Profit: Number(pair.Difference),
            ProfitMinusBags: Number(pair.DifferenceWithoutBags),
            Market: market
          }
          items.push(item)
        }
        return items
      }
      return false
    },
    onFiltered (filteredItems) {
      if (filteredItems.length) {
        let totals = {
          bought: Big(0),
          sold: Big(0),
          profitPlusBags: Big(0),
          profitMinusBags: Big(0)
        }
        let market = null
        for (let i = 0; i < filteredItems.length; i++) {
          market = filteredItems[i].Market
          totals.bought = totals.bought.plus(Big(filteredItems[i].Bought.toString()))
          totals.sold = totals.sold.plus(Big(filteredItems[i].Sold.toString()))
          totals.profitPlusBags = totals.profitPlusBags.plus(Big(filteredItems[i].Profit.toString()))
          totals.profitMinusBags = totals.profitMinusBags.plus(Big(filteredItems[i].ProfitMinusBags.toString()))
        }
        this.totals[market].bought = Number(totals.bought.toString())
        this.totals[market].sold = Number(totals.sold.toString())
        this.totals[market].profitPlusBags = Number(totals.profitPlusBags.toString())
        this.totals[market].profitMinusBags = Number(totals.profitMinusBags.toString())
      }
      console.log(this.totals)
      // Trigger pagination to update the number of buttons/pages due to filtering
      // this.totalRows = filteredItems.length
      // this.currentPage = 1
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit SCSS to this component only -->
<style>
table.b-table > tfoot > tr > th.sorting::before,
table.b-table > tfoot > tr > th.sorting::after {
  display: none !important;
}
</style>
