/** 外部服务适配器接口，业务层只依赖这些接口，便于测试和换厂商。 */

export interface SmsAdapter {
  /** 发送验证码；mock 模式不真正发送（固定开发码 123456 由上层生成）。 */
  sendCode(phone: string, code: string): Promise<void>
}

export interface WechatProfile {
  openid: string
  unionid?: string
  nickname?: string
}

export interface WechatAdapter {
  /** 网站应用（PC 扫码）：code 换用户信息。 */
  exchangeOpenCode(code: string): Promise<WechatProfile>
  /** 服务号网页授权（微信内）。 */
  exchangeMpCode(code: string): Promise<WechatProfile>
  /** PC 扫码授权跳转地址。 */
  openAuthorizeUrl(redirectUri: string, state: string): string
  /** 微信内服务号网页授权跳转地址。 */
  mpAuthorizeUrl(redirectUri: string, state: string): string
}
