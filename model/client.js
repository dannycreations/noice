const moment = require('moment')

module.exports = class Client {
  output(msg = '', inline = false) {
    const time = `| ${moment().format('HH:mm:ss')} | `
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write('\x1B[?25l')
    if (!inline) console.log(`${time}${msg}`)
    else process.stdout.write(`${time}${msg}`)
  }
}