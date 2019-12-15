
var path = require('path');
var DAO = require ( path.resolve( __dirname, "./dao.js"))

/**
 * Module which has the following functionalities
 *  1. Freeze branch
 *  2. Unfreeze branch
 *  3. If branch frozen
 * The freeze data is stored in the repository as a file using the DAO module
 */
class Freezer {

  constructor(context) {
    this.context = context
  }

  async init() {
    this.dao = new DAO(this.context)
    this.data = await this.dao.read()
    this.inited = true
  }

  /**
   * Freeze branch
   * @param args
   */
   async freeze(args) {

    if (!this.inited) {
      await this.init()
    }

    var context = this.context
    var log_prefix = context.log_prefix || ""
    var logger = context.log

    var branch = args.branch
    var frozen_by = args.frozen_by
    var frozen_at = args.frozen_at

    //ignore if already frozen
    const [frozen] = await this.is_frozen(branch)
    if(frozen) {
      logger.info(`${log_prefix} branch ${branch} is already frozen`)
      return false;
    }

    //Set Freeze data
    var data = this.data
    data[branch] = data[branch] || {}
    data[branch].frozen = true
    data[branch].frozen_at = frozen_at
    data[branch].frozen_by = frozen_by
    data[branch].unfrozen_at = null
    data[branch].unfrozen_by = null

    //Write to persistence
    logger.info(`${log_prefix} freezing branch ${branch} by user ${frozen_by}`)
    await this.dao.write(data,`${log_prefix} freezing branch ${branch}`)
    logger.info(`${log_prefix} branch ${branch} froze`)

    return true

  }

  async unfreeze(args) {

    if (!this.inited) {
      await this.init()
    }

    var context = this.context

    var log_prefix = context.log_prefix || ""
    var logger = context.log

    var branch = args.branch
    var unfrozen_by = args.unfrozen_by
    var unfrozen_at = args.unfrozen_at

    //ignore if branch is not frozen
    const [frozen] = await this.is_frozen(branch)
    if(!frozen) {
      logger.info(`${log_prefix} branch ${branch} is already unfrozen`)
      return false;
    }


    //Set unfreeze data
    var data = this.data
    data[branch] = data[branch] || {}
    data[branch].frozen = false
    data[branch].frozen_at = null
    data[branch].frozen_by = null
    data[branch].unfrozen_at = unfrozen_at
    data[branch].unfrozen_by = unfrozen_by

    //Write to persistence
    logger.info(`${log_prefix} unfreezing branch ${branch} by user ${unfrozen_by}`)
    await this.dao.write(data,`${log_prefix} unfreezing branch ${branch}`)
    logger.info(`${log_prefix} branch ${branch} unfroze`)

    return true
  }

  /**
   * check if branch is frozen
   * @param branch
   */
  async is_frozen(branch) {

    if (!this.inited) {
      await this.init()
    }

    var data = this.data

    if(!data) {
      return [false]
    }
    if (!data[branch]) {
      return [false]
    }

    if (!data[branch].frozen) {
      return [false]
    }

    return [true, data[branch].frozen_by]
  }

}



module.exports = Freezer
