/**
 * 写本体（格式 clinical-ontology/0，见 docs/ontology-schema.md）。
 * 只引用事件包里的稳定编号，不复制病历原文（动作、证据的短摘录除外，便于下游直接出题）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')

export async function writeOntology(dir, onto, meta) {
  await mkdir(join(dir, 'views'), { recursive: true })
  const manifest = {
    format: onto.format,
    producer: meta.producer,
    runId: meta.runId,
    patient: meta.patient,
    rulepacks: meta.rulepacks,
    upstream: meta.upstream,
    asOf: onto.asOf,
    anchor: onto.anchor,
    counts: onto.summary,
    review: { pending: onto.summary.review, reviewed: onto.summary.reviewed },
    notImplemented: ['伴发事件（concurrents）需模型＋医生', '归因份额与可分离性需模型＋医生', '衔接说明与原因类别需模型'],
    createdAt: meta.createdAt,
  }
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await writeFile(join(dir, 'person.json'), JSON.stringify(onto.person, null, 2))
  const files = {
    problems: onto.problems,
    problem_members: onto.members,
    diagnoses: onto.diagnoses,
    relations: onto.relations,
    decisions: onto.decisions,
    concurrents: onto.concurrents,
    attributions: onto.attributions,
  }
  for (const [name, rows] of Object.entries(files)) await writeFile(join(dir, `${name}.jsonl`), jsonl(rows))
  await writeFile(join(dir, 'views', 'timeline.json'), JSON.stringify(onto.timeline))
  await writeFile(join(dir, 'views', 'excluded.jsonl'), jsonl(onto.excluded))
  await writeFile(join(dir, 'views', 'reported-only.jsonl'), jsonl(onto.reportedOnly))
  await writeFile(join(dir, 'views', 'unassigned.json'), JSON.stringify(onto.unassigned, null, 2))
  return manifest
}
