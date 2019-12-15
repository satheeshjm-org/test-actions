
var path = require ("path")
var config_helper = require ( path.resolve( __dirname, "./config_helper.js"))

/**
 * A module for doing DAO operations
 * The Persistent layer is a file stored in the repository in any branch (this is NOT the same as the config file)
 * The name of the file, and the name of the branch are given in the config file
 */
class DAO {
  constructor (context, config) {
    this.context = context
    this.config = config
  }

  async init() {
    if (!this.config) {
      this.config = await config_helper.get_config(this.context)
    }

    var persistence = this.config.persistence
    this.data_file = `.github/${process.env.DATA_FILE}`
    this.data_branch = persistence.branch || "master"

    this.inited = true
  }

  /**
   * Get Stored data
   */
  async read() {

    if (!this.inited) {
      await this.init()
    }
    var context = this.context

    var github_cli = context.github
    const logger = context.log
    const log_prefix = context.log_prefix || ""

    try {
      var repo_content_resp = await github_cli.repos.getContents(context.repo({
        path: this.data_file,
        ref: this.data_branch
      }))
      var dataStrEncoded = repo_content_resp.data.content
      var dataStr = Buffer.from(dataStrEncoded, "base64").toString();
      dataStr = dataStr.replace(/(\r\n|\n|\r)/gm, "");

      var data = JSON.parse(dataStr);
      return data
    }
    catch (e) {
      if (e.name == "HttpError" && e.status == 404) {
        logger.info(`${log_prefix} Resource not found for ${e.request.url}`)
      }
      else {
        logger.error(e)
      }
      return {}

    }
  }

  /**
   * Write to stored data
   * @param data
   * @param message
   */
  async write(data, message) {

    if (!this.inited) {
      await this.init()
    }
    var context = this.context

    var github_cli = context.github
    const logger = context.log
    const log_prefix = context.log_prefix || ""

    var file_sha
    try {

      //We need to file sha for updating it. So we get the file first
      var repo_content_read_resp = await github_cli.repos.getContents(context.repo({
        path: this.data_file,
        ref: this.data_branch
      }))
      file_sha = repo_content_read_resp.data.sha
    }
    catch (e) {
      if (e.name == "HttpError" && e.status == 404) {
        logger.info(`${log_prefix} Resource not found for ${e.request.url}`)
      }
      else {
        logger.error(e)
        throw e;
      }
    }

    var repo_content_write_resp = await github_cli.repos.createOrUpdateFile(context.repo({
      path: this.data_file,
      branch: this.data_branch,

      content: new Buffer(JSON.stringify(data, null, 2)).toString("base64"),
      message: message,
      sha: file_sha,
    }))


  }

}




module.exports = DAO
