
const core = require('@actions/core');
const github = require('@actions/github');
var Commander = require ("../../_shared/commander")


async function run() {

  try {

    //shared libraries were implemented for probot, so this is needed for compatibility
    var action_context = {
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
    const context = new Proxy(action_context, {
      get: (obj, prop) => {
        return prop in obj? obj[prop]: github.context[prop]
      }
    })

    console.log(context.repo)

    const FreezeCommand = require("./commands/freeze_branch.js")
    const freezeCommand = new FreezeCommand(context)
    await (new Commander(freezeCommand).execute())

    var UnfreezeCommand = require("./commands/unfreeze_branch.js")
    var unfreezeCommand = new UnfreezeCommand(context)
    await (new Commander(unfreezeCommand).execute())
  }
  catch (e) {
    console.error(e)
    core.setFailed(e.message);
  }
}


run()