import type { SmsAdapter } from './types.js'
import { config } from '../config.js'
import { HttpError } from '../middleware/errors.js'

// 腾讯云短信 Node SDK（CommonJS 包，ESM 默认导入）
import tencentSms from 'tencentcloud-sdk-nodejs-sms'

const SmsClient = tencentSms.sms.v20210111.Client

/**
 * 腾讯云短信适配器。
 * 模板约定：单参数模板，TemplateParamSet=[code]；签名/模板/AppId 全部来自环境变量。
 */
export function createTencentSmsAdapter(): SmsAdapter {
  const { secretId, secretKey, smsRegion, smsSdkAppId, smsSignName, smsTemplateId } = config.tencent
  if (!secretId || !secretKey || !smsSdkAppId || !smsSignName || !smsTemplateId) {
    throw new Error('腾讯云短信配置不完整：需要 SecretId/SecretKey/SmsSdkAppId/签名/模板')
  }

  const client = new SmsClient({
    credential: { secretId, secretKey },
    region: smsRegion,
    profile: {
      httpProfile: { endpoint: 'sms.tencentcloudapi.com', reqTimeout: 8 },
    },
  })

  return {
    async sendCode(phone: string, code: string): Promise<void> {
      const result = await client.SendSms({
        PhoneNumberSet: [`+86${phone}`],
        SmsSdkAppId: smsSdkAppId,
        SignName: smsSignName,
        TemplateId: smsTemplateId,
        TemplateParamSet: [code],
      })
      const status = result.SendStatusSet?.[0]
      if (!status || status.Code !== 'Ok') {
        // 不把腾讯侧报文透给客户端
        throw new HttpError(502, '短信发送失败，请稍后再试', 'sms_send_failed')
      }
    },
  }
}
