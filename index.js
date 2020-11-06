const _ = require('lodash')
const chalk = require('chalk')
const { prompt } = require('inquirer')
const Tools = require('./model/tools/index.tool')

class Index {
  async run() {
    this.watermark()
    const question = [{
      type: 'list',
      name: 'tools',
      message: 'Select tools:',
      choices: [
        'Raw Audio Downloader'
      ] 
    }]
    const choise = await prompt(question)
    switch (choise.tools) {
      case 'Raw Audio Downloader':
        return Tools.RADTool.run()
        break
    }
  }
  
  watermark() {
    const data = 'ICAgICAgXyAgICAgICAgICAgICAgICAgIF8KICAgICB8IHwgICAgICAgICAgICAgICAgfCB8CiAgIF9ffCB8XyBfXyAgXyAgIF8gIF9fX3wgfF8gX19fCiAgLyBfJyB8ICdfIFxcfCB8IHwgfC8gX198IF9fLyBfX3wKIHwgfF98IHwgfCB8IHwgfF98IHwgfF9ffCB8X1xcX18gXAogIFxcX18sX3xffCB8X3xcXF9fLCB8XFxfX198XFxfX3xfX18vCiAgICAgICAgICAgICAgIF9fLyB8CiAgICAgICAgICAgICAgfF9fXy8'
    console.log(chalk`{bold.green ${_.join(_.split(Buffer.from(data, 'base64').toString(), '\\\\'), '\\')}\n}`)
  }
}

(async () => {
  const index = new Index()
  index.run()
})()