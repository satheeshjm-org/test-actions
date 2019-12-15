
const core = require('@actions/core');
const github = require('@actions/github');
var Commander = require ("../../_shared/commander")


async function run() {

  try {

    const context = github.context
    const repo = context.repo

    //shared libraries were implemented for probot, so this is needed for compatibility
    var context_wrapper = {
      log : console,
      github : new github.GitHub(process.env.GITHUB_TOKEN),
      config : async function () {
        return JSON.parse(process.env.CONFIG)
      },
      repo : function(args) {
        return {
          ...{ owner : repo.owner,repo : repo.repo },
          ...args
        }
      }
    }
    const probot_context = new Proxy(context_wrapper, {
      get: (obj, prop) => {
        return prop in obj? obj[prop]: github.context[prop]
      }
    })

    const FreezeCommand = require("./commands/freeze_branch.js")
    const freezeCommand = new FreezeCommand(probot_context)
    await (new Commander(freezeCommand).execute())

    var UnfreezeCommand = require("./commands/unfreeze_branch.js")
    var unfreezeCommand = new UnfreezeCommand(probot_context)
    await (new Commander(unfreezeCommand).execute())
  }
  catch (e) {
    console.error(e)
    core.setFailed(e.message);
  }
}


run()