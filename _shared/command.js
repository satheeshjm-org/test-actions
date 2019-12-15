


class Command {

  constructor (context) {
    this.context = context
  }

  async config() {
    return {
      //empty config
    }
  }

  async handler(args) {
    return
  }
}



module.exports = Command