const fs = require('fs')
const got = require('got')
const _ = require('lodash')
const chalk = require('chalk')
const stream = require('stream')
const { promisify } = require('util')
const { prompt } = require('inquirer')
const prettyBytes = require('pretty-bytes')

const Client = require('./../client')
const Noice = require('./../moduls/noice.modul')

const pipeline = promisify(stream.pipeline)

class RADTool extends Client {
  async run() {
    try {
      await this.isLogin()
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
      switch (type) {
        case 'catalog':
        case 'playlist':
        case 'mixtape':
          await this.downloadMultiple(type, link)
          break
        case 'artist':
          await this.downloadArtist(link)
          break
        case 'song':
          await this.downloadSingle(_.replace(link, 'song', 'audio'))
          break
        default:
          this.output(chalk`{bold.red Share link currently not supported!}`)
      }
      return this.run()
    } catch (err) {
      this.errorHandle(err)
    }
  }
  
  async downloadArtist(url) {
    const res = await Noice.send({ url: url })
    const res2 = await Noice.send({
      url: 'search',
      searchParams: {
        q: '', limit: 9999, type: 'catalog',
        artist_id: _.last(_.split(url, '/'))
      }
    })
    this.output(chalk`Artist {bold.yellow ${res.detail.name} (${res2.list.catalog.length})}`)
    for (const catalog of res2.list.catalog) {
      await this.downloadMultiple('catalog', `catalog/${catalog.id}`)
    }
  }
  
  async downloadMultiple(type, url) {
    const res = await Noice.send({ url: url })
    this.output(chalk`${_.capitalize(type)} {bold.yellow ${res.detail.title} (${res.detail.audio.length})}`)
    for (const audio of res.detail.audio) {
      await this.downloadSingle(`audio/${audio.id}`)
    }
  }
  
  async downloadSingle(url) {
    let res = await Noice.send({ url: url })
    const artistName = _.trimEnd(_.join(_.map(res.detail.artist, 'name'), ', '))
    const audioName = res.detail.title
    this.output(`Track ${artistName} - ${audioName}`)
    let fileRaw = _.find(res.detail.file, { type: 'high' })
    if (!fileRaw) fileRaw = _.find(res.detail.file, { type: 'medium' })
    if (!fileRaw) fileRaw = _.find(res.detail.file, { type: 'low' })
    if (!fileRaw) return this.output(chalk`› {red Raw audio not found}`)
    const audioType = _.last(fileRaw.raw_key.split('.'))
    const albumName = res.detail.catalog.title
    const saveFileDir = `${this.downloadDir}/${artistName}/${albumName}`
    if (!fs.existsSync(saveFileDir)) fs.mkdirSync(saveFileDir, { recursive: true })
    if (!fs.existsSync(`${saveFileDir}/${audioName}.${audioType}`)) {
      const audioLyric = res.detail.lyric
      if (audioLyric) fs.writeFileSync(`${saveFileDir}/${audioName}.lrc`, audioLyric)
      const coverType = _.last(res.detail.catalog.image.split('.'))
      if (!fs.existsSync(`${saveFileDir}/${albumName}.${coverType}`)) {
        res = await got(res.detail.catalog.image)
        fs.writeFileSync(`${saveFileDir}/${albumName}.${coverType}`, res.rawBody)
      }
      await this.letsDownload(fileRaw.raw_key, `${saveFileDir}/${audioName}.${audioType}`)
    } else {
      this.output(chalk`› {yellow Raw audio already exists}`)
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

module.exports = new RADTool()