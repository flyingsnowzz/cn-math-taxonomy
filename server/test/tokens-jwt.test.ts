import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { signAccessToken, verifyAccessToken } from '../src/services/tokens.js'

describe('access JWT（不连库）', () => {
  it('签发后可校验出 sub', async () => {
    const token = await signAccessToken(42)
    const claims = await verifyAccessToken(token)
    assert.equal(claims.sub, '42')
  })

  it('伪造/篡改的令牌被拒绝', async () => {
    await assert.rejects(() => verifyAccessToken('not-a-jwt'), /登录状态无效|令牌/)
    const token = await signAccessToken(1)
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'b' : 'a')
    await assert.rejects(() => verifyAccessToken(tampered))
  })
})
