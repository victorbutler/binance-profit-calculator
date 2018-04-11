<script>

export default {
  name: 'TagMaker',
  functional: true,
  props: {
    tag: {
      type: String,
      default: 'div'
    }
  },
  render: function (h, context) {
    return h(context.props.tag, context.data, context.children)
  }
}
</script>
