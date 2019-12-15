
var path = require('path');
var github_adapter = require ( path.resolve( __dirname, "./github_adapter.js"))

/**
 * Commander reads the repo's config and executes the first matching command from the list of commands in the config
 */
class Commander {

  constructor (command) {
    this.command = command
  }

  async init() {
    this.config = await this.command.config()
    this.inited = true
  }

  async execute(callback) {

    if (!this.inited) {
      await this.init()
    }

    var context = this.command.context
    var config = this.config

    const logger = context.log
    const log_prefix = context.log_prefix || ""

    var payload = context.payload
    var payload_org = payload.organization
    var payload_sender = payload.sender
    var payload_comment = payload.comment
    var payload_issue = payload.issue

    //we only allow pull request comments for triggering commands
    if (!payload_issue.pull_request) {
      logger.debug(`${log_prefix} not handling issue comments`)
      return;
    }

    //don't bother if there is no command in the config
    if(!config) {
      logger.debug(`${log_prefix} config not found`)
      return
    }

    //validate if comment is of the command format
    var comment_body = payload_comment.body
    const matches = comment_body.match(/^\/([\w]+)\b *(.*)?$/m)
    if (!matches) {
      logger.debug(`${log_prefix} comment is not a command`)
      return
    }

    var command_regex = config.command_regex
    var nargs = config.no_of_arguments
    var args_regex = config.args_regex
    var teams_whitelisted = config.teams_whitelisted || []

    var cmd = matches[1]
    var args = matches.slice(2, matches.length)


    //validate command regex
    if (!cmd.match(command_regex)) {
      logger.debug(`${log_prefix} command doesn't match reqex ${command_regex}`)
      return
    }


    //validate no of arguments extracted
    var args_sanitised = args.filter(Boolean)  //we need the filter(Boolean) the regex match gives "undefined" for unmatched groups
    if (nargs != args_sanitised.filter(Boolean).length) {
      logger.info(`${log_prefix} Required args : ${nargs} Actual args : ${args_sanitised.length}`)
      return
    }
    //validate each argument's regex
    for (var j = 0; j < args.length; j++) {
      var arg_regex = args_regex[j]
      if (arg_regex && !args[j].match(arg_regex)) {
        logger.info(`${log_prefix} Invalid argument[${j}]. Required regex : ${arg_regex} Actual value: ${args[j]}`)
        return
      }
    }

    //verify that the command initiator is part of atleast one of the whitelisted teams
    var user = payload_sender.login
    var team_validation_failure = false;
    for (var j=0; j<teams_whitelisted.length; j++) {
      try {
        var t=teams_whitelisted[j]
        if (await github_adapter.is_user_part_of_team(context, {
          log_prefix: log_prefix,
          org: payload_org.login,
          user: user,
          team: t,
        })) {
          team_validation_failure = false
          break
        } else {
          team_validation_failure = true
        }
      } catch (e) {
        //for now we are going to ignore errors when computing team presence
        logger.error(e)
        continue;
      }
    }
    if (team_validation_failure) {
      logger.info(`${log_prefix} User ${user} is not part of any of the whitelisted teams`)
      return
    } else {
      logger.info(`${log_prefix} User ${user} is part of some whitelisted team`)
    }

    logger.info(`${log_prefix} Going to execute command ${cmd} with arguments ${args}`)

    //all validations have passed.  Invoke callback
    await this.command.handler(args)
    return
  }
}

/**
 *
 * @param app
 * @param command -
 */
var on = function(app, Command) {
  app.on(
    ["issue_comment.created"],

    async context => {
      //set log_prefix
      var payload = context.payload
      var payload_issue = payload.issue
      var log_prefix = `#${payload_issue.number}: `
      context.log_prefix = log_prefix

      var command = new Command(context)
      await (new Commander(command).execute())
    }
  )
}

module.exports = {
  on : on
}