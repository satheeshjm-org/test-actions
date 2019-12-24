const core = require('@actions/core');
const github = require('@actions/github');
const parse_diff = require('parse-diff');
const minimatch = require("minimatch")


async function construct_pr_body(github_cli, repo, staging_branch, production_branch, body_config) {

  var table_fields = body_config.table_fields || []

  //table title
  var titles = []
  //line separating title and contents
  var horizontal_linesegments = []
  //table rows
  var table_rows = []

  for (var j=0;j<table_fields.length;j++) {
    titles.push(table_fields[j].name)
    horizontal_linesegments.push("---")
  }

  //find diff commits
  const comparecommits_resp = await github_cli.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: production_branch,
    head: staging_branch
  })

  const commits = comparecommits_resp.data.commits
  for (var j=0; j<commits.length; j++) {

    var table_row = {}
    table_rows.push(table_row)


    //calculate filenames changed in commit
    const commit = commits[j]
    const author = commit.author.login
    const message = commit.commit.message

    var commitresp = await github_cli.repos.getCommit({
      owner: repo.owner,
      repo: repo.repo,
      ref: commit.sha
    })

    var files = commitresp.data.files
    var filenames_changed = files.map(f => f.filename)


    for (var j=0;j<table_fields.length;j++) {
      var table_field = table_fields[j]


      var value = table_field.value
      if (value == "pr") {
        table_row.push(`${message})`)
      }
      else if (value == "owner") {
        table_row.push(`@${author}`)
      }
      else if (value == "does_file_exist") {
        var glob_to_match = table_field.glob
        console.debug(`Glob to match : ${glob_to_match}`)


        console.log(`${filenames_changed.length} Files found in PR : ${filenames_changed}`)

        var glob_match = null
        for(var k=0; k< filenames_changed.length; k++) {
          const f = filenames_changed[k]
          if(minimatch(f, glob_to_match)) {
            glob_match = f
            break
          }
        }

        if (glob_match) {
          console.debug(`matching file ${glob_match} found for glob ${glob_to_match} found in PR diff`)
          table_row.push(`<ul><li>- [x] </li></ul>`)
        }
        else {
          console.debug(`no matching file found in PR diff for glob ${glob_to_match}`)
          table_row.push(`<ul><li>- [ ] </li></ul>`)
        }
      }
    }
  }




  var pr_body = `| ${titles.join(" | ")} |\n`
  pr_body = `${pr_body}| ${horizontal_linesegments.join(" | ")} |\n`
  table_rows.forEach(tr => {
    pr_body = `${pr_body}| ${tr.join(" | ")} |\n`
  })

  console.debug(pr_body)
  return pr_body
}





async function run() {

  try {


    const context = github.context
    const github_cli = new github.GitHub(process.env.GITHUB_TOKEN)

    const staging_branch = core.getInput('staging_branch')
    const production_branch = core.getInput('production_branch')
    const body_config_str = core.getInput('pr_body_config') || '{}'
    const body_config = JSON.parse(body_config_str)
    console.table(body_config)


    const payload = context.payload
    var repo = context.repo

    var base = production_branch //pull from config
    var head = staging_branch
    var log_prefix = `${head}->${base}`

    var pr_body = await construct_pr_body(github_cli, repo, staging_branch, production_branch, body_config)

    try {

      //check if a pull request already exists
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
        //no PRs are found. so create one
        console.info(`${log_prefix} Pull request not found. So creating one`)

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
        //PR is found. update the body of the PR by appending the current PR entry
        var existing_pr = prs[0]

        console.info(`${log_prefix} ${prs.length} pull requests found. ${existing_pr.number}`)

        var existing_pr_body = existing_pr.body
        existing_pr_body.replace(`|.*|`,"")
        pr_body = `${existing_pr.body}\n${pr_body}\n`

        var prupdate_resp = await github_cli.pulls.update({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: prs[0].number,
          body: pr_body
        })
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
