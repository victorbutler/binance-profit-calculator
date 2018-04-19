<template>
  <div class="container">
    <h1>Balances</h1>
    <hr />
    <div class="row my-3" v-if="$store.state.balances.length">
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
      :items="$store.state.balances">
      <template slot="emptyfiltered" slot-scope="data">
        <strong>No results</strong>
      </template>
    </b-table>
  </div>
</template>

<script>
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
        { key: 'onOrderBalance', label: 'On order', sortable: true }
      ]
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
