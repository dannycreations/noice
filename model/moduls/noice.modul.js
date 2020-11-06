const got = require('got')
const _ = require('lodash')

class NoiceModul {
  constructor() {
    this.logged = false
  }
  
  async send(userOptions) {
    const options = _.defaultsDeep(userOptions, {
      prefixUrl: 'https://api.noice.id/',
      method: 'GET',
      headers: this.getDefaultHeaders(),
      responseType: 'json',
      timeout: 60000,
      retry: { limit: 0 }
    })
    const res = await got(options)
    if (res.body.meta.status) return res.body.data
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
    this.deserialize(await this.send({
      url: 'oauth/token',
      method: 'POST',
      json: {
        grant_type: 'password',
        username: 'noice',
        password: '%%noice%%'
      }
    }))
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
  
  async authLogin(dialCode, mobileNumber, otp) {
    const res = await this.send({
      url: 'auth/login',
      method: 'POST',
      json: {
        country_id: dialCode,
        mobile_number: mobileNumber,
        otp: otp,
        registration_id: '',
        device_id: '',
        debug: false
      }
    })
    this.deserialize(res.detail)
  }
}

module.exports = new NoiceModul()