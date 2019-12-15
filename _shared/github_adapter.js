/**
 * Class which has utility functions for slightly complex github operations
 */

/**
 * Fetches all open pull requsts (with a limit of 30) and updates their merge status using the status API
 * @param context
 * @param args
 */
async function update_status_of_all_pull_requests(context, args) {
  var FETCH_LIMIT = 30

  var state = args.state
  var message = args.message

  const logger = context.log
  const log_prefix = context.log_prefix || ""

  var github_cli = context.github

  //fetch PRs
  var prs = await list_prs(context, {
      base : args.base,
      limit : FETCH_LIMIT
  });


  //Update status for each PR
  prs.forEach( async pr => {

    logger.info(`${log_prefix} Creating status ${state} for pr ${pr.number}:${pr.head.sha}`)
    var resp = await github_cli.repos.createStatus(
      context.repo({
        state: state,
        description: message,
        sha: pr.head.sha,
        context: process.env.DISPLAY_NAME
      })
    );
    console.log(github_cli.repos)
    console.log(JSON.stringify(resp, null, 2))
    logger.info(`${log_prefix} Created status ${state} for pr ${pr.number}:${pr.head.sha}`);
  })
}

/**
 * Fetch all open PRs by base_branch
 * @param context
 * @param args
 */
async function list_prs(context, args) {

  var base = args.base
  var limit = args.limit

  var github_cli = context.github

  var fetch_count = 0;
  var pr_opts =  github_cli.pulls.list.endpoint.merge(context.repo());
  pr_opts.state ="open"
  pr_opts.sort = "updated"
  pr_opts.base = base
  pr_opts.direction ="desc"
  pr_opts.per_page=30

  var all_prs = await github_cli.paginate(pr_opts,  (resp, done) => {
      var pr = resp.data
      var count = pr.length

      fetch_count+= count
      if (fetch_count >= limit) {
          done()
      }

      return resp.data
    })


  return all_prs


}

/**
 * Given a user and a team, checks if user is a member of the team
 * @param context
 * @param args
 */
async function is_user_part_of_team(context, args) {

  var org = args.org
  var user = args.user
  var team = args.team

  var github_cli = context.github
  const logger = context.log
  const log_prefix = context.log_prefix || ""


  try {

    //fetch team by name, since we need team_id
    var team_resp = await github_cli.teams.getByName({
      org: org,
      team_slug: team
    });
    team = team_resp.data
  }
  catch (e) {
    if(e.name == "HttpError" && e.status == 404) {
      logger.info(`${log_prefix} Resource not found for ${e.request.url}`)
      return false
    }
    else {
      logger.error(e)
      throw e
    }
  }


  //fetch team membership for user
  try {
    var team_membership_resp = await github_cli.teams.getMembership({
      team_id: team.id,
      username: user
    });
    var team_membership = team_membership_resp.data

    if (team_membership.state == "active") {
      logger.info(`${log_prefix} User ${user} is part of the team ${team}`)
      return true
    }
    else {
      logger.info(`${log_prefix} User ${user} is not part of the team ${team}`)
      return false
    }
  }
  catch (e) {
    if(e.name == "HttpError" && e.status == 404) {
      logger.info(`${log_prefix} Resource not found for ${e.request.url}`)
      return false
    }
    else {
      logger.error(e)
      throw e
    }
  }
}


module.exports ={
  is_user_part_of_team: is_user_part_of_team,
  update_status_of_all_pull_requests: update_status_of_all_pull_requests
}