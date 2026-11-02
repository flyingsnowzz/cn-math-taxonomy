import { createApp } from './app.js'
import { config } from './config.js'

const app = createApp()

app.listen(config.port, () => {
  console.log(`cnm-server listening on :${config.port} (${config.env}, sms=${config.smsAdapter}, wechat=${config.wechatAdapter})`)
})
