/**
 * 稳定编号：`<前缀>-<sha256 的 12 位 base32>`，由内容派生（与 dsh-medical-event 同一算法）。
 * 规则一改不会让没变的对象换号，人工裁定能一直对上。
 *   L 问题线  D 决策节点  X 诊断  R 关系  A 归因候选
 */
import { createHash } from 'node:crypto'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

export function stableId(prefix, ...parts) {
  const buf = createHash('sha256').update(parts.map(String).join('\u001f')).digest()
  let out = ''; let bits = 0; let value = 0
  for (const byte of buf) {
    value = ((value << 8) | byte) >>> 0
    bits += 8
    while (bits >= 5 && out.length < 12) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
    if (out.length >= 12) break
  }
  return `${prefix}-${out}`
}
