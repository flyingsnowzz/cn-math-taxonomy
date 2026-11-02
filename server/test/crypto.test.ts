import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashPassword, randomToken, sha256, verifyPassword } from '../src/services/crypto.js'

describe('crypto', () => {
  it('scrypt 哈希可校验且不可逆', () => {
    const hash = hashPassword('correct horse')
    assert.notEqual(hash, 'correct horse')
    assert.match(hash, /^scrypt\$16384\$8\$1\$/)
    assert.equal(verifyPassword('correct horse', hash), true)
    assert.equal(verifyPassword('wrong horse', hash), false)
  })

  it('同一密码每次哈希不同（随机盐）', () => {
    assert.notEqual(hashPassword('same password'), hashPassword('same password'))
  })

  it('损坏/旧格式哈希安全返回 false', () => {
    assert.equal(verifyPassword('x', 'not-a-valid-hash'), false)
    assert.equal(verifyPassword('x', 'scrypt$NaN$8$1$a$b'), false)
    assert.equal(verifyPassword('x', 'scrypt$16384$8$1$%$%'), false)
  })

  it('随机令牌唯一，sha256 确定', () => {
    const a = randomToken()
    const b = randomToken()
    assert.notEqual(a, b)
    assert.equal(sha256('abc').length, 43) // base64url sha256
    assert.equal(sha256('abc'), sha256('abc'))
  })
})
