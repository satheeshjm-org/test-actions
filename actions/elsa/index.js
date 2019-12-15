
const core = require('@actions/core');
const github = require('@actions/github');
var Commander = require ("../../_shared/commander")


async function run() {

  try {
    const context = github.context
    console.info(process.env.CONFIG)
    console.info(process.env.GITHUB_TOKEN)
    //shared libraries were implemented for probot, so this is needed for compatibility
    const github_cli = new github.GitHub(process.env.GITHUB_TOKEN)
    context.github = github_cli
    context.config = async function () {
      console.info("xx")
      return process.env.CONFIG
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