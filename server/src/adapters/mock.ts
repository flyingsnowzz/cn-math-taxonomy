import type { SmsAdapter, WechatAdapter, WechatProfile } from './types.js'

/**
 * 开发/CI 适配器：不访问任何外部服务。
 * 短信验证码由上层固定为 123456；微信用 code 直接解析出确定性的假身份。
 */
export const mockSms: SmsAdapter = {
  async sendCode(): Promise<void> {
    // no-op
  },
}

export const mockWechat: WechatAdapter = {
  async exchangeOpenCode(code: string): Promise<WechatProfile> {
    // 测试约定：code 形如 mock-open:<openid> 或 mock-open:<openid>:<unionid>
    const parts = code.split(':')
    return { openid: parts[1] ?? `mock-openid-${code}`, unionid: parts[2], nickname: '测试用户' }
  },
  async exchangeMpCode(code: string): Promise<WechatProfile> {
    const parts = code.split(':')
    return { openid: parts[1] ?? `mock-mp-openid-${code}`, unionid: parts[2], nickname: '测试用户' }
  },
  openAuthorizeUrl(redirectUri: string, state: string): string {
    const url = new URL('https://open.weixin.qq.com/connect/qrconnect')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'snsapi_login')
    return url.toString()
  },
  mpAuthorizeUrl(redirectUri: string, state: string): string {
    // 测试约定：redirect_uri 里带 mock code，回调测试直接用它
    const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize')
    url.searchParams.set('appid', 'mock-mp-appid')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'snsapi_userinfo')
    return url.toString()
  },
}
