<template>

  <!-- #HEADER -->
  <header class="mb-3">
    <b-navbar toggleable="md" variant="primary" type="dark">
      <b-navbar-toggle target="nav_collapse"></b-navbar-toggle>
      <b-link to="/">
        <b-navbar-brand tag="h1" class="mb-0">Binance Profit Calculator</b-navbar-brand>
      </b-link>
      <b-collapse is-nav id="nav_collapse">

          <b-navbar-nav>
            <b-nav-item to="Profits">Profits</b-nav-item>
            <b-nav-item to="Configure">Configure</b-nav-item>
          </b-navbar-nav>

          <!-- Right aligned nav items -->
          <!-- <b-navbar-nav class="ml-auto">

            <b-nav-item-dropdown text="Coins" right>
              <b-dropdown-item href="#">EN</b-dropdown-item>
              <b-dropdown-item href="#">ES</b-dropdown-item>
              <b-dropdown-item href="#">RU</b-dropdown-item>
              <b-dropdown-item href="#">FA</b-dropdown-item>
            </b-nav-item-dropdown>

            <b-nav-item-dropdown right>
              <template slot="button-content">
                <em>User</em>
              </template>
              <b-dropdown-item href="#">Profile</b-dropdown-item>
              <b-dropdown-item href="#">Signout</b-dropdown-item>
            </b-nav-item-dropdown>
          </b-navbar-nav> -->

        </b-collapse>
    </b-navbar>
  </header>
  <!-- END HEADER -->
</template>

<script>
export default {
  name: 'Heading'
}
</script>
