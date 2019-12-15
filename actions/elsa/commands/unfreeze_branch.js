


const Command = require ("../../../_shared/command")
const Freezer = require ("../../../_shared/freezer")
const config_helper = require ("../../../_shared/config_helper")
const github_adapter = require ("../../../_shared/github_adapter")



class FreezeBranch extends Command {

  async config () {
    var context = this.context
    var user_config = await config_helper.get_config(context)
    return {
      command_regex : ["unfreeze"],
      no_of_arguments : 1,
      args_regex : [
        user_config.branches
      ],
      teams_whitelisted : user_config.teams_whitelisted
    }
  }

  async handler (args) {
    var context = this.context
    var payload = context.payload
    var payload_comment = payload.comment

    var freezer = new Freezer(context)
    var branch = args[0]
    var success = await freezer.unfreeze({
      branch: branch,
      unfrozen_by: payload_comment.user.login,
      unfrozen_at: payload_comment.created_at,
    })
    if(!success) return

    await github_adapter.update_status_of_all_pull_requests(context, {
      base : branch,
      state: "success",
      message: `Ready to Merge`
    })
  }
}



module.exports = FreezeBranch


