
const core = require('@actions/core');
const github = require('@actions/github');
var Commander = require ("../../_shared/commander")


async function run() {

  try {
    const context = github.context

    //shared libraries were implemented for probot, so this is needed for compatibility
    context.log = console
    context.github =  new github.GitHub(process.env.GITHUB_TOKEN)
    context.config = async function () {
      return JSON.parse(process.env.CONFIG)
    }
    var repo = context.repo
    context.repo = function(args) {
      return {
        ...{ owner : repo.owner,repo : repo.repo },
        ...args
      }
    }

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