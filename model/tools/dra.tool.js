const fs = require('fs')
const got = require('got')
const _ = require('lodash')
const chalk = require('chalk')
const stream = require('stream')
const { promisify } = require('util')
const { prompt } = require('inquirer')
const prettyBytes = require('pretty-bytes')
const Noice = require('./../moduls/noice.modul')

const pipeline = promisify(stream.pipeline)
const downloadDir = `${process.cwd()}/downloads`

class DRATool extends Noice {
  async run() {
    try {
      await this.login()
      const question = [{
        type: 'input',
        name: 'link',
        message: 'Insert Link:',
        validate: function(value) {
          return value ? true : 'Can\'t Empty'
        }
      }]
      const answer = await prompt(question)
      const link = _.last(answer.link.split('/share/'))
      const type = _.first(_.split(link, '/'))
      switch(type) {
        case 'catalog':
        case 'playlist':
          await this.downloadMultiple(type, link)
          break
        case 'artist':
          await this.downloadArtist(link)
          break
        default:
          this.output(chalk`{bold.red Only support catalog, playlist & artist share link!}`)
      }
      return this.run()
    } catch(err) {
      console.trace(err)
    }
  }
  
  async login(sessions) {
    const path = `${process.cwd()}/sessions/config.json`
    if (!fs.existsSync(path)) {
      const question = [{
        type: 'input',
        name: 'country',
        message: 'Insert Country (e.g +62):',
        validate: function(value) {
          return value ? true : 'Can\'t Empty'
        }
      }, {
        type: 'input',
        name: 'mobilenumber',
        message: 'Insert Mobile Number:',
        validate: function(value) {
          return value ? true : 'Can\'t Empty'
        }
      }]
      const answer = await prompt(question)
      sessions = { country: answer.country, mobilenumber: answer.mobilenumber }
      fs.mkdirSync(_.first(_.split(path, 'config.json')), { recursive: true })
      fs.writeFileSync(path, JSON.stringify(sessions, null, 2))
    } else sessions = JSON.parse(fs.readFileSync(path).toString())
    await this.authLogin(sessions.country, sessions.mobilenumber)
  }
  
  async downloadMultiple(type, url) {
    let res = await this.send({ url: url })
    if (type === 'catalog') {
      const albumName = res.detail.title
      this.output(chalk`Catalog: {bold.yellow ${albumName} (${res.detail.audio.length} Track)}`)
      const coverType = _.last(res.detail.image.split('.'))
      for (const audio of res.detail.audio) {
        const artistName = _.join(_.map(audio.artist, 'name'), ', ')
        const audioName = audio.title
        this.output(chalk`Track: {bold.white ${audioName}}`)
        let fileRaw = _.find(audio.file, { type: 'high' } )
        if (!fileRaw) fileRaw = _.find(audio.file, { type: 'medium' } )
        if (!fileRaw) fileRaw = _.find(audio.file, { type: 'low' } )
        if (!fileRaw) {
          this.output(chalk`› {red Raw audio not found}`)
          continue
        }
        const audioType = _.last(fileRaw.raw_key.split('.'))
        const audioLyric = audio.lyric
        const saveFileDir = `${downloadDir}/${artistName}/${albumName}`
        if (!fs.existsSync(saveFileDir)) fs.mkdirSync(saveFileDir, { recursive: true })
        if (!fs.existsSync(`${saveFileDir}/${audioName}.${audioType}`)) {
          if (audioLyric) fs.writeFileSync(`${saveFileDir}/${audioName}.lrc`, audioLyric)
          if (!fs.existsSync(`${saveFileDir}/${albumName}.${coverType}`)) {
            res = await got(res.detail.image)
            fs.writeFileSync(`${saveFileDir}/${albumName}.${coverType}`, res.rawBody)
          }
          await this.letsDownload(fileRaw.raw_key, `${saveFileDir}/${audioName}.${audioType}`)
        } else {
          this.output(chalk`› {yellow Audio already exists}`)
        }
      }
    } else if (type === 'playlist') {
      this.output(chalk`Playlist: {bold.yellow ${res.detail.title} (${res.detail.audio.length} Track)}`)
      for (const audio of res.detail.audio) {
        const artistName = _.join(_.map(audio.artist, 'name'), ', ')
        const audioName = audio.title
        this.output(chalk`Track: {bold.white ${audioName}}`)
        let fileRaw = _.find(audio.file, { type: 'high' } )
        if (!fileRaw) fileRaw = _.find(audio.file, { type: 'medium' } )
        if (!fileRaw) fileRaw = _.find(audio.file, { type: 'low' } )
        if (!fileRaw) {
          this.output(chalk`› {red Raw audio not found}`)
          continue
        }
        const audioType = _.last(fileRaw.raw_key.split('.'))
        const audioLyric = audio.lyric
        const albumName = audio.catalog.title
        const coverType = _.last(audio.catalog.image.split('.'))
        const saveFileDir = `${downloadDir}/${artistName}/${albumName}`
        if (!fs.existsSync(saveFileDir)) fs.mkdirSync(saveFileDir, { recursive: true })
        if (!fs.existsSync(`${saveFileDir}/${audioName}.${audioType}`)) {
          if (audioLyric) fs.writeFileSync(`${saveFileDir}/${audioName}.lrc`, audioLyric)
          if (!fs.existsSync(`${saveFileDir}/${albumName}.${coverType}`)) {
            res = await got(audio.catalog.image)
            fs.writeFileSync(`${saveFileDir}/${albumName}.${coverType}`, res.rawBody)
          }
          await this.letsDownload(fileRaw.raw_key, `${saveFileDir}/${audioName}.${audioType}`)
        } else {
          this.output(chalk`› {yellow Audio already exists}`)
        }
      }
    }
  }
  
  async downloadArtist(url) {
    const res = await this.send({ url: url })
    const res2 = await this.send({
      url: 'search',
      searchParams: {
        q: '', limit: 9999, type: 'catalog',
        artist_id: _.last(_.split(url, '/'))
      }
    })
    this.output(chalk`Artist: {bold.yellow ${res.detail.name} (${res2.list.catalog.length} Catalog)}`)
    for (const catalog of res2.list.catalog) {
      await this.downloadMultiple('catalog', `catalog/${catalog.id}`)
    }
  }
  
  async letsDownload(url, path) {
    return new Promise(resolve => {
      const downloadStream = got.stream(url)
      const writeStream = fs.createWriteStream(path)
      downloadStream.on('downloadProgress', ({ transferred, total, percent }) => {
        let field = ''
        if (transferred) field += ` ${prettyBytes(transferred)}`
        if (total) field += `/${prettyBytes(total)}`
        if (percent) field += ` (${(percent * 100).toFixed(2)}%)`
        this.output(chalk`› {green Downloading}${field}`, true)
      })
      pipeline(downloadStream, writeStream)
      .then(() => { resolve(this.output(chalk`› {green Finished downloading}`)) })
      .catch(err => {
        this.output(chalk`› {red ${err.message}}`, true)
        setTimeout(() => { return this.letsDownload(url, path) }, 2000)
      })
    })
  }
}

module.exports = new DRATool()