const fs = require('fs')
const got = require('got')
const _ = require('lodash')
const chalk = require('chalk')
const Client = require('./../client')

module.exports = class NoiceModul extends Client {
  constructor() {
    super()
    this.logged = false
  }
  
  async send(userOptions) {
    try {
      const options = _.defaultsDeep(userOptions, {
        prefixUrl: 'https://api.noice.id/',
        method: 'GET',
        headers: this.getDefaultHeaders(),
        responseType: 'json',
        timeout: 60000,
        retry: { limit: 0 }
      })
      const response = await got(options)
      if (response.body.meta.status) return response.body.data
    } catch(err) {
      if (err.response.statusCode === 401) {
        fs.rmdirSync(`${process.cwd()}/sessions`, { recursive: true })
        this.output(chalk`{bold.red Session expired, please login again!}`)
        process.exit()
      } else if (err.response.statusCode === 404) {
        fs.rmdirSync(`${process.cwd()}/sessions`, { recursive: true })
        this.output(chalk`{bold.red Mobile number not registered!}`)
        process.exit()
      }
      console.trace(err.response)
    }
  }
  
  getDefaultHeaders() {
    let headers = {
      'User-Agent': 'okhttp/3.10.0',
      'Content-Type': 'application/json; charset=utf-8',
    }
    if (_.isString(this.logged.access_token)) {
      headers['Authorization'] = `${this.logged.token_type} ${this.logged.access_token}`
    }
    return headers
  }
  
  deserialize(state) {
    const obj = _.isString(state) ? JSON.parse(state) : state
    if (_.isObject(obj)) this.logged = obj
    else throw new Error('State isn\'t an object or serialized JSON')
  }
  
  async oauthToken() {
    const res = await this.send({
      url: 'oauth/token',
      method: 'POST',
      json: {
        grant_type: 'password',
        username: 'noice',
        password: '%%noice%%'
      }
    })
    this.deserialize(res)
  }
  
  async locationCountry(dialCode) {
    const res = await this.send({
      url: 'location/country',
      searchParams: { limit: 9999 }
    })
    return _.find(res.list, { dial_code: dialCode })
  }
  
  async otpRequest(countryId, mobileNumber) {
    const res = await this.send({
      url: 'otp/request',
      method: 'POST',
      json: {
        country_id: countryId,
        mobile_number: mobileNumber
      }
    })
    return res.detail
  }
  
  async authLogin(dialCode, mobileNumber) {
    const path = `${process.cwd()}/sessions/${mobileNumber}.json`
    if (fs.existsSync(path)) return this.deserialize(fs.readFileSync(path).toString())
    await this.oauthToken()
    dialCode = await this.locationCountry(dialCode)
    const otp = await this.otpRequest(dialCode.id, mobileNumber)
    const res = await this.send({
      url: 'auth/login',
      method: 'POST',
      json: {
        country_id: dialCode.id,
        mobile_number: mobileNumber,
        otp: otp,
        registration_id: '',
        device_id: '',
        debug: false
      }
    })
    this.deserialize(res.detail)
    fs.writeFileSync(path, JSON.stringify(this.logged, null, 2))
  }
}