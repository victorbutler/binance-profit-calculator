<template>
  <div class="container">
    <h1>Configure</h1>
    <hr>
    <p>
      <ol>
        <li>Log into Binance</li>
        <li>Go to Orders > Trade History</li>
        <li>Search for the maximum window for trade history</li>
        <li>Click <code>Export Complete Trade History</code></li>
        <li>Save the file</li>
        <li>Select the file using the form below</li>
        <li>Click Process History</li>
      </ol>
    </p>
    <b-form @submit="upload" class="my-3">
      <div class="row mb-3" v-if="processingError">
        <b-alert variant="danger" show center class="col-sm-6 ml-auto mr-auto">
          {{ processingError }}
        </b-alert>
      </div>
      <div class="row">
        <div class="col-sm-6">
          <b-form-file id="tradeHistory" name="tradeHistory" v-model="file" placeholder="Choose a file..."></b-form-file>
        </div>
        <div class="col-sm-6">
          <b-button type="submit" variant="primary">Process History</b-button>
        </div>
      </div>
    </b-form>
    <h2 v-if="$store.state.history !== null">Head on over to <b-link to="Profits">Profits</b-link> to see the results!</h2>
    <b-modal v-model="processingShow" v-on:ok="handleOk" id="modal-processing" :hide-footer="!processingComplete" ok-only centered title="Processing">
      <p class="my-4" v-if="!processingComplete">Processing your history...</p>
      <p class="my-4 text-success text-center h3" v-if="processingComplete">
        Your history has successfully been imported.
        <!-- The trade monitor is now active. -->
      </p>
    </b-modal>
  </div>
</template>

<script>
import Axios from 'axios'

export default {
  name: 'Configure',
  data () {
    return {
      file: null,
      processingShow: false,
      processingComplete: false,
      processingError: null
    }
  },
  methods: {
    handleOk (e) {
      this.processingShow = false
    },
    upload (e) {
      e.preventDefault()
      if (this.file) {
        var form = new FormData()
        form.append('tradeHistory', this.file, this.file.name)
        this.processingShow = true
        Axios({method: 'POST', url: '/tradeHistory', data: form})
          .then(result => {
            console.log('Configure: Upload complete', result.data)
            this.processingComplete = true
            this.processingError = false
            setTimeout(() => {
              this.processingShow = false
            }, 6000)
          }, error => {
            this.processingShow = false
            this.processingError = error.response.data
          })
      } else {
        this.processingError = 'Select a file to process'
      }
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
