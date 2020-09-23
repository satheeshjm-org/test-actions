const core = require('@actions/core');
const github = require('@actions/github');
const minimatch = require("minimatch")
var md_table = require('markdown-table')


async function construct_pr_body(github_cli, repo, staging_branch, production_branch, body_config) {

  var table_fields = body_config.table_fields || [];

  var metrics = body_config.metrics || []

  var table_rows = []

  var title_row = []
  table_rows.push(title_row)
  for (var i=0;i<table_fields.length;i++) {
    title_row.push(table_fields[i].name)
  }

  var metrics_table_rows = []

  var metrics_title_row = []
  for (var i=0;i<metrics.length;i++) {
    metrics_title_row.push(metrics[i].name)
  }

  //find diff commits
  const comparecommits_resp = await github_cli.repos.compareCommits({
    owner: repo.owner,
    repo: repo.repo,
    base: production_branch,
    head: staging_branch
  })

  const commits = comparecommits_resp.data.commits
  console.debug(`diff has ${commits.length}`)

  for (var i=0; i<commits.length; i++) {

    var table_row = []
    table_rows.push(table_row)


    //calculate filenames changed in commit
    const commit = commits[i]
    const author = commit.author.login
    const message = commit.commit.message

    console.debug(`fetching commit ${i} for ${commit.sha}`)

    var commitresp = await github_cli.repos.getCommit({
      owner: repo.owner,
      repo: repo.repo,
      ref: commit.sha
    })

    var files = commitresp.data.files
    var filenames_changed = files.map(f => f.filename)
    var patches = files.map(f => f.patch)

    for (var j=0;j<table_fields.length;j++) {
      var table_field = table_fields[j]


      var value = table_field.value
      var message_title = message.split('\n')[0]
      if (value == "pr") {
        table_row.push(`${message_title}`)
      }
      else if (value == "owner") {
        table_row.push(`@${author}`)
      }
      else if (value == "commit_title_regex") {
        var pattern_to_match = table_field.patterns;
        var regex_patters = Object.keys(pattern_to_match);
        var validRegex = regex_patters.filter((regex) => new RegExp(regex,"gi").exec(message_title));
        if(validRegex.length && pattern_to_match[validRegex[0]]){
          table_row.push(`<b>${pattern_to_match[validRegex[0]]}</b>`);
        }else {
          table_row.push(`-`);
        }
      }
      else if (value == "does_file_contain") {
        var pattern_to_match = table_field.pattern
        console.debug(`Pattern to match : ${pattern_to_match}`)
        const regex_a = new RegExp('\\+.*('+pattern_to_match+')', "g");
        const regex_r = new RegExp('\\-.*('+pattern_to_match+')', "g");

        var pattern_matches = new Set([])

        const added = new Set([])
        const removed = new Set([])

        for(var k=0; k<patches.length; k++) {
          const patch = patches[k]
          if(!patch) {
            continue;
          }

          var match_a = regex_a.exec(patch)
          while(match_a) {
            added.add(match_a[match_a.length-1])
            match_a = regex_a.exec(patch)
          }

          var match_r = regex_r.exec(patch)
          while(match_r) {
            removed.add(match_r[match_r.length-1])
            match_r = regex_r.exec(patch)
         }
        }

        //removing matches in '-'  lines from patch
        //doing this because if a match has been moved to some place , we don't want it to be showing up in our match
        pattern_matches = Array.from(added).filter(a => !removed.has(a))

        if (pattern_matches.length > 0) {
          console.debug(`matching pattern found for pattern ${pattern_to_match} in PR diff`)
          table_row.push(`<ul><li>- [x] </li></ul>${pattern_matches.join('<br>')}`)
        }
        else {
          console.debug(`no matching pattern found in PR diff for pattern ${pattern_to_match}`)
          table_row.push(`<ul><li>- [ ] </li></ul>`)
        }

      }
      else if (value == "does_file_exist") {
        var glob_to_match = table_field.glob
        console.debug(`Glob to match : ${glob_to_match}`)

        console.log(`${filenames_changed.length} Files found in PR : ${filenames_changed}`)

        var glob_matched_files = []
        for(var k=0; k< filenames_changed.length; k++) {
          const f = filenames_changed[k]
          if(minimatch(f, glob_to_match)) {
            glob_matched_files.push(f)
          }
        }

        if (glob_matched_files.length > 0) {
          console.debug(`${glob_matched_files.length} matching files found for glob ${glob_to_match} found in PR diff`)
          var field_val = `<ul><li>- [x] </li></ul>${glob_matched_files.join('<br>')}`
          table_row.push(field_val)
        }
        else {
          console.debug(`no matching file found in PR diff for glob ${glob_to_match}`)
          table_row.push(`<ul><li>- [ ] </li></ul>`)
        }
      }
    }
  }




  var pr_body = md_table(table_rows.concat(metrics_table_rows));

  var metrics_pr_body = md_table(metrics_table_rows);

  console.debug("table-pr_body--------",pr_body)
  console.debug("table-metrics_pr_body---------",metrics_pr_body)
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

    console.log("pr_body------", typeof pr_body)

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
        //remove existing table
        existing_pr_body = existing_pr_body.replace(new RegExp(`\\|.*\\|[\\r\\n]+`,"g"),"")

        pr_body = `${pr_body}\n${existing_pr_body}\n`

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
