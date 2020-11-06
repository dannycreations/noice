const fs = require('fs')
const _ = require('lodash')
const chalk = require('chalk')
const moment = require('moment')
const { prompt } = require('inquirer')
const Noice = require('./moduls/noice.modul')

module.exports = class Client {
  constructor() {
    this.downloadDir = `${process.cwd()}/downloads`
    this.sessionDir = `${process.cwd()}/sessions`
  }
  
  output(msg = '', inline = false) {
    const time = `| ${moment().format('HH:mm:ss')} | `
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write('\x1B[?25l')
    if (!inline) console.log(`${time}${msg}`)
    else process.stdout.write(`${time}${msg}`)
  }
  
  async errorHandle(err) {
    if (!_.isNil(err.response)) {
      if (err.response.statusCode === 401) {
        fs.rmdirSync(this.sessionDir, { recursive: true })
        this.output(chalk`{bold.red Session expired, please login again}`)
        process.exit()
      } else if (!_.isNil(err.response.body.meta.message)) {
        return this.output(chalk`{bold.red ${err.response.body.meta.message}}`)
      } else return console.trace(err.response)
    }
    console.trace(err)
  }
  
  async isLogin(session) {
    const configName = 'config.json'
    if (!fs.existsSync(this.sessionDir)) {
      const question = [{
        type: 'input',
        name: 'dialcode',
        message: 'Insert Dial Code (e.g +62):',
        validate: function(value) {
          return value ? true : 'Can\'t Empty'
        }
      }, {
        type: 'input',
        name: 'mobilenumber',
        message: 'Insert Mobile Number:',
        validate: function(value) {
          return parseInt(value) ? true : 'Mobile number must be numeric only'
        }
      }]
      const answer = await prompt(question)
      session = { dialcode: answer.dialcode, mobilenumber: answer.mobilenumber }
      fs.mkdirSync(this.sessionDir, { recursive: true })
      fs.writeFileSync(`${this.sessionDir}/${configName}`, JSON.stringify(session, null, 2))
    } else session = JSON.parse(fs.readFileSync(`${this.sessionDir}/${configName}`).toString())
    try {
      const userName = `${session.mobilenumber}.json`
      if (fs.existsSync(`${this.sessionDir}/${userName}`)) {
        return Noice.deserialize(fs.readFileSync(`${this.sessionDir}/${userName}`).toString())
      }
      await Noice.oauthToken()
      const dialCode = await Noice.locationCountry(session.dialcode)
      const otp = await Noice.otpRequest(dialCode.id, session.mobilenumber)
      await Noice.authLogin(dialCode.id, session.mobilenumber, otp)
      fs.writeFileSync(`${this.sessionDir}/${userName}`, JSON.stringify(Noice.logged, null, 2))
    } catch (err) {
      if (!_.isNil(err.response)) {
        if (err.response.statusCode === 404) {
          fs.rmdirSync(this.sessionDir, { recursive: true })
          this.output(chalk`{bold.red Mobile number not registered}`)
          process.exit()
        }
      }
      this.errorHandle(err)
    }
  }
}