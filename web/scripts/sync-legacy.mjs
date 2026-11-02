#!/usr/bin/env node
/**
 * 把根目录 diagnose/ 下的零依赖 UMD 引擎同步成 web 工程的 ESM vendored 副本。
 *
 * 根目录文件是浏览器/Node 通用的 UMD；web 侧用 esbuild/vitest，需要
 * `export default`。这里只替换 UMD 外壳，factory 函数体逐字节保留。
 *
 * 幂等：内容未变不会重写。predev/prebuild 自动运行，防止两份副本漂移。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(webRoot, '..')

const FILES = [
  { source: 'diagnose/engine.js', target: 'src/engine/legacy/diagEngine.js' },
  { source: 'diagnose/remediation.js', target: 'src/engine/legacy/remediation.js' },
]

function toEsm(source, file) {
  const nameMatch = /else root\.(\w+) = factory\(\);/.exec(source)
  if (!nameMatch) throw new Error(`${file}: 找不到 UMD 导出名（else root.XXX = factory()）`)
  const name = nameMatch[1]

  const headerPattern =
    /\(function \(root, factory\) \{\r?\n {2}if \(typeof module !== 'undefined' && module\.exports\) module\.exports = factory\(\);\r?\n {2}else root\.\w+ = factory\(\);\r?\n\}\)\(typeof self !== 'undefined' \? self : this, function \(\) \{/
  const headerMatch = headerPattern.exec(source)
  if (!headerMatch) throw new Error(`${file}: UMD 头部与预期模式不匹配，拒绝做不安全替换`)

  const esmHeader =
    `const ${name} = (function (factory) {\n` +
    '  return factory();\n' +
    '})(function () {'

  let out = source.slice(0, headerMatch.index) + esmHeader + source.slice(headerMatch.index + headerMatch[0].length)

  // 只替换文件末尾的 UMD 收尾 `});`
  if (!/\}\);\s*$/.test(out)) throw new Error(`${file}: 找不到 UMD 收尾 })`)
  out = out.replace(/\}\);\s*$/, `});\n\n\nexport default ${name};\n`)
  return out
}

let changed = 0
for (const { source, target } of FILES) {
  const sourcePath = path.join(repoRoot, source)
  const targetPath = path.join(webRoot, target)
  const umd = readFileSync(sourcePath, 'utf8')
  const expected = toEsm(umd, source)
  let current
  try {
    current = readFileSync(targetPath, 'utf8')
  } catch {
    current = null
  }
  if (current !== expected) {
    writeFileSync(targetPath, expected, 'utf8')
    console.log(`legacy sync: ${source} -> ${target} ${current === null ? '(created)' : '(updated)'}`)
    changed++
  }
}
if (changed === 0) console.log('legacy sync: vendored copies up to date')
