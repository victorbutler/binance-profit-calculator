<template>
  <div class="container">
    <h1>Balances</h1>
    <hr />
    <div class="row my-3" v-if="$store.state.balances && $store.state.balances.length">
      <div class="col-sm-4">
        <b-input-group>
          <b-form-input v-model="filter" placeholder="Type to Search" />
          <b-input-group-append>
            <b-btn :disabled="!filter" @click="filter = ''">Clear</b-btn>
          </b-input-group-append>
        </b-input-group>
      </div>
    </div>
    <b-table
      striped
      hover
      :fields="fields"
      :sort-by.sync="sortBy"
      :sort-desc.sync="sortDesc"
      :filter="filter"
      :items="balances()">
      <template slot="emptyfiltered" slot-scope="data">
        <strong>No results</strong>
      </template>
      <template slot="asset" slot-scope="data">
        <strong>{{ data.value }}</strong>
        <small v-if="$parent.getCoinMarketCapData(data.value)"><br />{{ $parent.getCoinMarketCapData(data.value).price_usd | accounting }}</small>
      </template>
      <template slot="availableBalance" slot-scope="data">
        {{ data.value }}
        <small v-if="$parent.getCoinMarketCapData(data.value)"><br />{{ multiply(data.value, $parent.getCoinMarketCapData(data.item.asset).price_usd) | accounting }}</small>
      </template>
      <template slot="onOrderBalance" slot-scope="data">
        {{ data.value }}
        <small v-if="$parent.getCoinMarketCapData(data.value)"><br />{{ multiply(data.value, $parent.getCoinMarketCapData(data.item.asset).price_usd) | accounting }}</small>
      </template>
      <template slot="fiat" slot-scope="data">
        <span v-if="data.value">{{ data.value | accounting }}</span>
      </template>
    </b-table>
  </div>
</template>

<script>
import Big from 'big.js'

export default {
  name: 'Balances',
  data () {
    return {
      filter: null,
      sortBy: 'free',
      sortDesc: true,
      fields: [
        { key: 'asset', label: 'Coin', sortable: true },
        { key: 'availableBalance', label: 'Available', sortable: true },
        { key: 'onOrderBalance', label: 'On order', sortable: true },
        { key: 'fiat', label: 'Value', sortable: true }
      ]
    }
  },
  computed: {
  },
  methods: {
    balances () {
      let balances = []
      if (this.$store.state.balances) {
        for (let coinData of this.$store.state.balances) {
          if (this.$store.state.coinmarketcap) {
            let marketCapData = this.$parent.getCoinMarketCapData(coinData.asset)
            if (marketCapData) {
              coinData.fiat = Big(marketCapData.price_usd).times(Big(coinData.availableBalance).plus(Big(coinData.onOrderBalance))).toFixed(8).toString()
            }
            balances.push(coinData)
          } else {
            balances.push(coinData)
          }
        }
      }
      return balances
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
