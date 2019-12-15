
const core = require('@actions/core');
const github = require('@actions/github');
var Commander = require ("../../_shared/commander")


async function run() {

  const context = github.context

  //shared libraries were implemented for probot, so this is needed for compatibility
  const github_cli = new github.GitHub(process.env.GITHUB_TOKEN)
  context.github = github_cli


  const FreezeCommand = require ("./commands/freeze_branch.js")
  const freezeCommand = new FreezeCommand(context)
  await new Commander.Commander(freezeCommand).execute()

  var UnfreezeCommand = require ("./commands/unfreeze_branch.js")
  var unfreezeCommand = new UnfreezeCommand(context)
  await new Commander.Commander(unfreezeCommand).execute()
}


run()