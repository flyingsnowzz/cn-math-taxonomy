/**
 * 运行配置：全部来自环境变量。开发/CI 用 mock 适配器，不需要真实密钥。
 */
export interface Config {
  env: 'development' | 'test' | 'production'
  port: number
  databaseUrl: string
  jwtSecret: string
  adminUsername: string
  adminPassword: string
  smsAdapter: 'mock' | 'tencent'
  wechatAdapter: 'mock' | 'tencent'
  tencent: {
    secretId: string
    secretKey: string
    smsSignName: string
    smsTemplateId: string
    smsSdkAppId: string
    smsRegion: string
  }
  wechat: {
    openAppId: string
    openSecret: string
    mpAppId: string
    mpSecret: string
  }
}

function required(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

const env = (required('NODE_ENV', 'development') === 'test' ? 'test'
  : required('NODE_ENV', 'development') === 'production' ? 'production' : 'development') as Config['env']

export const config: Config = {
  env,
  port: Number(required('PORT', '8787')),
  databaseUrl: required('DATABASE_URL', 'postgres://cnm:cnm_dev_pw@localhost:5432/cnm'),
  jwtSecret: required('JWT_SECRET', 'dev-only-change-me'),
  adminUsername: required('ADMIN_USERNAME', 'admin'),
  adminPassword: required('ADMIN_PASSWORD'),
  smsAdapter: required('SMS_ADAPTER', 'mock') === 'tencent' ? 'tencent' : 'mock',
  wechatAdapter: required('WECHAT_ADAPTER', 'mock') === 'tencent' ? 'tencent' : 'mock',
  tencent: {
    secretId: required('TENCENT_SECRET_ID'),
    secretKey: required('TENCENT_SECRET_KEY'),
    smsSignName: required('SMS_SIGN_NAME'),
    smsTemplateId: required('SMS_TEMPLATE_ID'),
    smsSdkAppId: required('TENCENT_SMS_APP_ID'),
    smsRegion: required('TENCENT_SMS_REGION', 'ap-guangzhou'),
  },
  wechat: {
    openAppId: required('WECHAT_OPEN_APPID'),
    openSecret: required('WECHAT_OPEN_SECRET'),
    mpAppId: required('WECHAT_MP_APPID'),
    mpSecret: required('WECHAT_MP_SECRET'),
  },
}

export function isMockMode(): boolean {
  return config.env !== 'production'
}
