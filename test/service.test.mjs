import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createService, DEMO_INPUT } from '../lib/service.js'

test('示例批次：交付本体、记录在 _records、输入不变、裁定沿用', async () => {
  const state = await mkdtemp(join(tmpdir(), 'onto-test-'))
  try {
    const before = (await stat(join(DEMO_INPUT, 'DEMO-0001', 'mentions.jsonl'))).mtimeMs
    const s = createService({ stateDir: state })
    const { runId } = await s.start({ demo: true })
    while (s.isRunning()) await new Promise((r) => setTimeout(r, 20))
    const { run } = await s.status(runId)
    assert.ok(['completed', 'review'].includes(run.status), run.error)
    const dir = join(run.output, 'DEMO-0001')
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
    assert.equal(manifest.format, 'clinical-ontology/0')
    for (const f of ['problems', 'problem_members', 'decisions', 'diagnoses', 'relations', 'attributions', 'concurrents']) await stat(join(dir, `${f}.jsonl`))
    assert.equal(run.sourceCheck.changed, 0)
    assert.equal((await stat(join(DEMO_INPUT, 'DEMO-0001', 'mentions.jsonl'))).mtimeMs, before)
    const onto = await s.ontology(runId, 'DEMO-0001')
    await s.decide(runId, { id: onto.decisions[0].id, status: '已确认' })
    const again = await s.ontology(runId, 'DEMO-0001')
    assert.equal(again.decisions[0].review.status, '已确认')
    const ev = await s.evidence(runId, 'DEMO-0001', onto.decisions[0].basis)
    assert.ok(ev.mentions.length > 0)
    await assert.rejects(() => s.start({ inputDir: DEMO_INPUT, outputRoot: join(DEMO_INPUT, 'x') }), /不能放在输入目录里/)
  } finally {
    await rm(state, { recursive: true, force: true })
  }
})
