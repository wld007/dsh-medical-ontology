#!/usr/bin/env node
/**
 * 用同级仓库 dsh-medical-event 的引擎，把虚构病人跑成事件包，写到 demo/event-package/。
 * 只在开发时运行（需要 ../dsh-medical-event）；产物是虚构数据，可以进仓库。
 *
 *   node scripts/demo/make-demo-package.mjs [eventRepo]
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeDemoRaw } from './fictional-raw.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const eventRepo = resolve(process.argv[2] ?? join(root, '..', 'dsh-medical-event'))
const mod = (p) => import(pathToFileURL(join(eventRepo, p)).href)
const { runPatient } = await mod('lib/engine/pipeline.js')
const { loadRulepack } = await mod('lib/rulepack/load.js')
const { writePackage } = await mod('lib/package/write.js')
const producer = JSON.parse(await (await import('node:fs/promises')).readFile(join(eventRepo, 'package.json'), 'utf8'))

const tmp = await mkdtemp(join(tmpdir(), 'onto-demo-'))
try {
  const raw = await writeDemoRaw(join(tmp, 'DEMO-0001'))
  const result = await runPatient(raw, await loadRulepack(), {})
  const out = join(root, 'demo', 'event-package', 'DEMO-0001')
  await rm(out, { recursive: true, force: true })
  await writePackage(out, result, { patient: 'DEMO-0001', runId: 'demo', producer: `${producer.name}@${producer.version}`, upstream: { fictional: true }, compress: false, xlsx: false, createdAt: '2026-11-12T00:00:00.000Z' })
  await rm(join(out, 'exports'), { recursive: true, force: true })
  console.log(out, result.summary.mentions, 'mentions', result.summary.events, 'events', result.summary.findings, 'findings')
} finally {
  await rm(tmp, { recursive: true, force: true })
}
