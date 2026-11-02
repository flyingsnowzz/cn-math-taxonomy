import { config } from '../config.js'
import { mockSms, mockWechat } from './mock.js'
import { createTencentSmsAdapter } from './tencent-sms.js'
import { createTencentWechatAdapter } from './tencent-wechat.js'
import type { SmsAdapter, WechatAdapter } from './types.js'

// 生产用 tencent；开发/CI 用 mock（零密钥可跑）。
export const sms: SmsAdapter = config.smsAdapter === 'tencent' ? createTencentSmsAdapter() : mockSms
export const wechat: WechatAdapter = config.wechatAdapter === 'tencent' ? createTencentWechatAdapter() : mockWechat
