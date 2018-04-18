<template>
  <div class="container">
    <h1>Notifications</h1>
    <hr />
    <div v-for="notification in $parent.reverseNotifications"
      v-bind:key="notification.id">
      <b-alert
        show
        :variant="notification.variant">
        <h5>{{ notification.title }}</h5>
        <span>{{ notification.message }}</span>
      </b-alert>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Notifications',
  data () {
    return {}
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
