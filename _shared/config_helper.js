





var get_config = async function(context) {
  if (!context._user_config) {
    context._user_config = await context.config(process.env.CONFIG_FILE)
  }
  return context._user_config
}








module.exports = {
  get_config : get_config
}