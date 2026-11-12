/**
 * 读事件包（dsh-medical-event 的交付物，格式 event-package/0）。
 * 只读：不改输入。大表可能是 .jsonl.gz。
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { gunzipSync } from 'node:zlib'

export const SUPPORTED_FORMATS = ['event-package/0']

async function exists(p) { try { await stat(p); return true } catch { return false } }

export async function readJsonl(dir, name) {
  for (const [file, gz] of [[`${name}.jsonl`, false], [`${name}.jsonl.gz`, true]]) {
    const p = join(dir, file)
    if (!(await exists(p))) continue
    const buf = await readFile(p)
    return (gz ? gunzipSync(buf) : buf).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  }
  return null
}

/** 读一位病人的事件包；返回 { manifest, encounters, mentions, events, findings, problems: [] } */
export async function readPackage(dir) {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
  const problems = []
  if (!String(manifest.format ?? '').startsWith('event-package/')) problems.push(`不是事件包：format=${manifest.format}`)
  else if (!SUPPORTED_FORMATS.includes(manifest.format)) problems.push(`事件包格式 ${manifest.format} 未声明支持（支持 ${SUPPORTED_FORMATS.join('、')}），按最接近的版本读取`)
  const [encounters, mentions, events, findings] = await Promise.all(['encounters', 'mentions', 'events', 'findings'].map((n) => readJsonl(dir, n)))
  if (!mentions) problems.push('缺 mentions.jsonl')
  if (!events) problems.push('缺 events.jsonl')
  const failedGates = Object.entries(manifest.gates ?? {}).filter(([, g]) => g && g.pass === false).map(([k]) => k)
  if (failedGates.length) problems.push(`上游验收门未过：${failedGates.join('')}`)
  return { manifest, encounters: encounters ?? [], mentions: mentions ?? [], events: events ?? [], findings: findings ?? [], problems }
}

/** 在目录下找所有事件包（含 manifest.json 且 format 为 event-package/*）。 */
export async function findPackages(root, skip = () => false) {
  const out = []
  async function walk(dir, depth) {
    if (depth > 6 || skip(dir)) return
    const m = join(dir, 'manifest.json')
    if (await exists(m)) {
      try {
        const f = JSON.parse(await readFile(m, 'utf8')).format
        if (String(f ?? '').startsWith('event-package/')) { out.push(dir); return }
      } catch { /* not ours */ }
    }
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && e.name !== '_records' && e.name !== 'exports') await walk(join(dir, e.name), depth + 1)
  }
  await walk(root, 0)
  return out.sort()
}

export const patientName = (dir, root) => (dir === root ? basename(root) : dir.slice(root.length + 1))
