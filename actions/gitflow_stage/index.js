const core = require('@actions/core');
const github = require('@actions/github');
const parse_diff = require('parse-diff');

async function run() {

  try {


    const context = github.context
    const github_cli = new github.GitHub(process.env.GITHUB_TOKEN)

    var staging_branch = core.getInput('staging_branch')
    var production_branch = core.getInput('production_branch')
    var body_config = JSON.parse(core.getInput('pr_body_config') || '{}')

    var table_fields = body_config.table_fields || []

    const payload = context.payload
    var repo = context.repo

    var payload_pr = payload.pull_request
    if(!payload_pr) {
      throw new Error(`Payload "pull_request" missing`)
    }
    var is_merged = payload_pr.merged
    if (!is_merged) {
      console.info(`This is not a merge`)
      return ;
    }

    /**
     * allowed PRs : (!master) -> dev
     *  1. if base_branch is not staging, dont run (This won't be needed, if you have proper conditions in the workflow config)
     *  2. if head_branc is master, don't run (this is just a reverse merge)
     */
    if(payload_pr.base.ref != staging_branch) {
      console.info(`Require base:${production_branch} for creating a release`)
    }
    if(payload_pr.head.ref == production_branch) {
      console.info(`Require head:${staging_branch} for creating a release`)
      return
    }


    var base = production_branch //pull from config
    var head = payload_pr.base.ref
    var log_prefix = `${head}->${base}`


    var titles = []
    var horizontal_linesegments = []
    var current_pr_entry = []
    for (var i=0;i<table_fields.length;i++) {
      var table_field = table_fields[i]

      var name = table_field.name
      titles.push(name)
      horizontal_linesegments.push("---")

      var value = table_field.value
      if (value == "pr") {
        current_pr_entry.push(`${payload_pr.title}(#${payload_pr.number})`)
      }
      else if (value == "owner") {
        current_pr_entry.push(payload_pr.user.login)
      }
      else if (value == "file_extension_bool") {
        var extension_to_match = table_field.extension


        //get diff
        var prget_resp = github_cli.pullRequests.get({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: payload_pr.number,
          headers: {accept: "application/vnd.github.v3.diff"}
        });

        console.table(prget_resp)
        console.log(prget_resp.data)
        var diffs = parse_diff(prget_resp.data)
        var diff_files = diffs.map(d => d.to)
        console.log(diff_files)
        var diff_file_extensions = new Set(diff_files.map(f => f.split('.').pop()))
        console.log(diff_file_extensions)

        if (extension_to_match in diff_file_extensions) {
          current_pr_entry.push("yes")
        }
        else {
          current_pr_entry.push("no")
        }
      }
    }


    var pr_body = `| ${current_pr_entry.join(" | ")} |`


    try {
      console.debug(`${log_prefix} Fetching pull request`)
      var prlist_resp = await github_cli.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        base: base,
        head: `${repo.owner}:${head}`,
        state: "open",
      })

      var prs = prlist_resp.data
      if (prs.length == 0) {
        console.info(`${log_prefix} Pull request not found. So creating one`)

        pr_body = `| ${horizontal_linesegments.join(" | ")} |\n${pr_body}`
        pr_body = `| ${titles.join(" | ")} |\n${pr_body}`
        var prcreate_resp = await github_cli.pulls.create({
          owner: repo.owner,
          repo: repo.repo,
          base: base,
          head: head,
          title: "Release:",
          body: pr_body
        })
        console.info(`${log_prefix} Pull request created`)
      }
      else {
        var existing_pr = prs[0]

        console.info(`${log_prefix} ${prs.length} pull requests found. ${existing_pr.number}`)
        pr_body = `${existing_pr.body}\n${pr_body}`

        var prupdate_resp = await github_cli.pulls.update({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: prs[0].number,
          body: pr_body
        })
        //update description
      }
    }
    catch (e) {
      console.error(e)
      throw e;
    }

  }
  catch (error) {
    core.setFailed(error.message);
  }

}


run()
