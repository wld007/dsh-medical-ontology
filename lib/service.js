/**
 * 批次服务：Agent 工具、/ontology 命令、页面 RPC 共用。
 *
 * 输出布局（与匿名化、事件插件一致）：
 *   <outputRoot>/<输入名>/<病人>/        交付：本体（批次完成后才出现在根目录）
 *   <outputRoot>/_records/
 *     index.json                         最近批次
 *     review.json                        人工裁定表（按稳定编号，重跑沿用）
 *     runs/<runId>/run.json|report.md|report.json|output/
 * 输入（事件包）只读；运行前后核对文件大小与修改时间。
 */
import { mkdir, readFile, writeFile, rename, stat, realpath, readdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { findPackages, patientName, readPackage } from './package/read.js'
import { writeOntology } from './package/write.js'
import { loadRulepack, specialtyIds } from './rulepack.js'
import { buildOntology } from './engine/pipeline.js'
import { renderReport } from './report.js'

const RECORDS = '_records'
const PRODUCER = 'dsh-medical-ontology'
export const DEMO_INPUT = fileURLToPath(new URL('../demo/event-package', import.meta.url))

export const DEFAULTS = { outputRoot: '', specialty: 'hemodialysis', showSidebarEntry: true }

async function exists(p) { try { await stat(p); return true } catch { return false } }
async function realish(p) {
  let cur = resolve(p); const rest = []
  for (;;) {
    try { return join(await realpath(cur), ...rest) } catch { /* climb */ }
    const up = dirname(cur)
    if (up === cur) return resolve(p)
    rest.unshift(basename(cur)); cur = up
  }
}
async function snapshot(dir) {
  const out = {}
  async function walk(d) {
    let es; try { es = await readdir(d, { withFileTypes: true }) } catch { return }
    for (const e of es) { const p = join(d, e.name); if (e.isDirectory()) await walk(p); else if (e.isFile()) { const s = await stat(p); out[relative(dir, p)] = `${s.size}:${s.mtimeMs}` } }
  }
  await walk(dir)
  return out
}
const newRunId = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${randomBytes(3).toString('hex')}`
}
let version = '0.0.0'
try { version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version } catch { /* dev */ }

export function createService({ config = {}, defaultDirectory = process.cwd(), stateDir = null } = {}) {
  const settings = { ...DEFAULTS, ...config }
  let active = null
  const runsCache = new Map()

  const rootsFile = () => (stateDir ? join(stateDir, 'roots.json') : null)
  async function knownRoots() { try { return rootsFile() ? JSON.parse(await readFile(rootsFile(), 'utf8')) : [] } catch { return [] } }
  async function rememberRoot(root) {
    if (!rootsFile()) return
    const roots = [root, ...(await knownRoots()).filter((r) => r !== root)].slice(0, 20)
    await mkdir(dirname(rootsFile()), { recursive: true })
    await writeFile(rootsFile(), JSON.stringify(roots, null, 2))
  }

  async function saveRun(run) {
    runsCache.set(run.id, run)
    await mkdir(run.runDir, { recursive: true })
    await writeFile(join(run.runDir, 'run.json'), JSON.stringify(run, null, 2))
    const idxPath = join(run.outputRoot, RECORDS, 'index.json')
    let idx = []
    try { idx = JSON.parse(await readFile(idxPath, 'utf8')) } catch { /* new */ }
    const brief = { id: run.id, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt ?? null, input: run.inputName, demo: run.demo ?? false, patients: run.totals.patients, decisions: run.totals.decisions, review: run.totals.review }
    idx = [brief, ...idx.filter((r) => r.id !== run.id)].slice(0, 100)
    await writeFile(idxPath, JSON.stringify(idx, null, 2))
  }

  async function resolveOutputRoot(input, requested) {
    const root = resolve(defaultDirectory, requested || settings.outputRoot || join(dirname(input), '_medical-ontology'))
    const inReal = await realpath(input); const rootAbs = await realish(root)
    if (rootAbs === inReal) throw new Error('输出根目录不能与输入相同')
    if ((inReal + sep).startsWith(rootAbs + sep)) throw new Error('输出根目录不能包含输入目录')
    if ((rootAbs + sep).startsWith(inReal + sep)) throw new Error('输出根目录不能放在输入目录里')
    return rootAbs
  }

  /* ------------------------------------------------------------ review table */
  const reviewPath = (root) => join(root, RECORDS, 'review.json')
  async function loadReview(root) { try { return JSON.parse(await readFile(reviewPath(root), 'utf8')) } catch { return {} } }

  /** 启动批次，立即返回。 */
  async function start(request = {}) {
    if (active) throw new Error(`已有批次 ${active.id} 在运行`)
    let prev = null
    if (request.resumeFrom) {
      prev = await loadRun(request.resumeFrom)
      if (!prev) throw new Error(`找不到批次 ${request.resumeFrom}`)
      if (prev.status === 'completed' || prev.status === 'review') throw new Error('该批次已完成，无需继续')
    }
    const demo = request.demo === true
    const input = demo ? DEMO_INPUT : resolve(defaultDirectory, prev?.input ?? request.inputDir ?? '')
    if (!request.inputDir && !prev && !demo) throw new Error('请给出事件包目录（dsh-medical-event 的交付目录）')
    if (!(await exists(input))) throw new Error(`输入不存在：${input}`)
    const specialty = prev?.specialty ?? request.specialty ?? settings.specialty
    if (!specialtyIds().includes(specialty)) throw new Error(`没有病种规则包：${specialty}`)
    const outputRoot = prev?.outputRoot ?? (demo && stateDir && !request.outputRoot ? join(stateDir, 'demo-output') : await resolveOutputRoot(input, request.outputRoot))
    if (demo) await mkdir(outputRoot, { recursive: true })
    const id = prev?.id ?? newRunId()
    const run = prev ?? {
      id, status: 'running', demo, input, inputName: demo ? '示例-虚构病人' : basename(input), outputRoot, runDir: join(outputRoot, RECORDS, 'runs', id),
      startedAt: new Date().toISOString(), source: request.source ?? null, asOf: request.asOf || null, specialty,
      patients: [], totals: { patients: 0, done: 0, lines: 0, decisions: 0, formal: 0, diagnoses: 0, relations: 0, attributions: 0, review: 0 }, warnings: [], current: null,
    }
    run.status = 'running'; run.finishedAt = null; run.error = null
    active = { id, cancel: false, run }
    await saveRun(run)
    await rememberRoot(outputRoot)
    execute(run).catch(async (error) => {
      run.status = 'failed'; run.error = String(error?.stack ?? error); run.finishedAt = new Date().toISOString()
      await saveRun(run).catch(() => {})
    }).finally(() => { if (active?.id === id) active = null })
    return { runId: id, outputRoot, input, specialty, demo }
  }

  async function execute(run) {
    const rules = await loadRulepack(run.specialty)
    const skip = (p) => resolve(p) === resolve(run.outputRoot) || basename(p) === '_medical-ontology'
    const dirs = await findPackages(run.input, skip)
    if (!dirs.length) throw new Error('输入里没有找到事件包（含 manifest.json、format 为 event-package/* 的目录）。请先用「病历事件还原」处理病历。')
    const before = await snapshot(run.input)
    const review = await loadReview(run.outputRoot)
    const staging = join(run.runDir, 'output', run.inputName)
    const done = new Map(run.patients.map((p) => [p.patient, p]))
    run.totals.patients = dirs.length
    for (const dir of dirs) {
      if (active?.cancel) break
      const patient = patientName(dir, run.input)
      if (done.has(patient)) continue
      run.current = { patient, step: '构建本体' }
      await saveRun(run)
      const t0 = Date.now()
      const input = await readPackage(dir)
      const onto = buildOntology(input, rules, { asOf: run.asOf, review })
      const out = dirs.length === 1 && dir === run.input ? staging : join(staging, patient)
      await writeOntology(out, onto, { producer: `${PRODUCER}@${version}`, runId: run.id, patient, rulepacks: rules.layers, upstream: { format: input.manifest.format, producer: input.manifest.producer, runId: input.manifest.runId, rulepacks: input.manifest.rulepacks, dir }, createdAt: new Date().toISOString() })
      done.set(patient, { patient, dir, out, single: dirs.length === 1 && dir === run.input, ms: Date.now() - t0, problems: input.problems, summary: onto.summary, anchor: onto.anchor.day })
      run.patients = [...done.values()]
      run.totals = totalsOf(run)
    }
    run.current = null
    const after = await snapshot(run.input)
    const changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k])
    run.sourceCheck = { files: Object.keys(before).length, changed: changed.length }
    if (changed.length) run.warnings.push(`运行期间有 ${changed.length} 个输入文件被改动（不是本插件改的）`)
    if (run.patients.some((p) => p.problems.length)) run.warnings.push('部分事件包有上游提示（格式版本或验收门），见各病人')
    if (active?.cancel) run.status = 'cancelled'
    else {
      let target = join(run.outputRoot, run.inputName)
      for (let n = 2; await exists(target); n++) target = join(run.outputRoot, `${run.inputName} (${n})`)
      await rename(staging, target)
      run.output = target
      for (const p of run.patients) p.out = p.single ? target : join(target, p.patient)
      run.status = run.totals.review ? 'review' : 'completed'
    }
    run.finishedAt = new Date().toISOString()
    const report = renderReport(run)
    await writeFile(join(run.runDir, 'report.md'), report.markdown)
    await writeFile(join(run.runDir, 'report.json'), JSON.stringify(report.json, null, 2))
    await saveRun(run)
  }

  function totalsOf(run) {
    const t = { patients: run.totals.patients, done: run.patients.length, lines: 0, decisions: 0, formal: 0, diagnoses: 0, relations: 0, attributions: 0, review: 0 }
    for (const p of run.patients) for (const k of ['lines', 'decisions', 'formal', 'diagnoses', 'relations', 'attributions', 'review']) t[k] += p.summary[k] ?? 0
    return t
  }

  /* ------------------------------------------------------------------- reads */
  async function loadRun(id) {
    if (active?.id === id) return active.run
    if (runsCache.has(id)) return runsCache.get(id)
    for (const root of await knownRoots()) {
      try { const run = JSON.parse(await readFile(join(root, RECORDS, 'runs', id, 'run.json'), 'utf8')); runsCache.set(id, run); return run } catch { /* next */ }
    }
    return null
  }
  async function list() {
    const out = []
    for (const root of await knownRoots()) {
      try { for (const r of JSON.parse(await readFile(join(root, RECORDS, 'index.json'), 'utf8'))) out.push({ ...r, outputRoot: root }) } catch { /* gone */ }
    }
    out.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    return { runs: out, active: active?.id ?? null }
  }
  const latestId = async () => (await list()).runs[0]?.id ?? null
  async function status(runId) {
    const id = runId || active?.id || await latestId()
    return { run: id ? await loadRun(id) : null, active: active?.id ?? null }
  }
  async function report(runId) {
    const id = runId || await latestId()
    const run = id ? await loadRun(id) : null
    if (!run) throw new Error('还没有批次')
    const path = join(run.runDir, 'report.md')
    try { return { runId: id, path, markdown: await readFile(path, 'utf8') } } catch { return { runId: id, path, markdown: renderReport(run).markdown } }
  }
  async function cancel(runId) {
    if (!active || (runId && runId !== active.id)) return { cancelled: false, reason: '没有运行中的批次' }
    active.cancel = true
    return { cancelled: true, runId: active.id }
  }

  /* ----------------------------------------------- page: live ontology view */
  const pkgCache = new Map() // dir → { key, input }
  async function inputOf(dir) {
    const m = await stat(join(dir, 'manifest.json'))
    const key = `${m.mtimeMs}`
    const hit = pkgCache.get(dir)
    if (hit?.key === key) return hit.input
    const input = await readPackage(dir)
    pkgCache.set(dir, { key, input })
    return input
  }
  async function entryOf(runId, patient) {
    const run = await loadRun(runId)
    if (!run) throw new Error(`找不到批次 ${runId}`)
    const p = run.patients.find((x) => x.patient === patient) ?? run.patients[0]
    if (!p) throw new Error('该批次还没有病人')
    // 示例批次的输入在插件安装目录里，升版后路径会变：按当前安装目录重新定位
    if (run.demo) return { run, p: { ...p, dir: join(DEMO_INPUT, relative(run.input, p.dir)) } }
    return { run, p }
  }
  /** 按截止时刻重算一位病人的本体（不写盘），供页面“按日期回看”。 */
  async function ontology(runId, patient, asOf) {
    const { run, p } = await entryOf(runId, patient)
    const input = await inputOf(p.dir)
    const onto = buildOntology(input, await loadRulepack(run.specialty), { asOf: asOf || run.asOf, review: await loadReview(run.outputRoot) })
    const { rel, members, ...rest } = onto
    const lineMembers = {}
    for (const m of members) (lineMembers[m.problem] ??= []).push({ event: m.event, role: m.role, primary: m.primary, day: m.day, concept: m.concept, group: m.group })
    const lastWritten = input.mentions.reduce((a, m) => (m.writtenAt > a ? m.writtenAt : a), '')
    return { ...rest, lineMembers, patient: p.patient, person: { ...onto.person, ...input.manifest.person }, upstream: { producer: input.manifest.producer, format: input.manifest.format, problems: input.problems }, dataRange: { first: input.mentions.reduce((a, m) => (!a || m.writtenAt < a ? m.writtenAt : a), ''), last: lastWritten } }
  }
  /** 原文证据：按提及编号取片段内的原文摘录（只读事件包）。 */
  async function evidence(runId, patient, ids = []) {
    const { p } = await entryOf(runId, patient)
    const input = await inputOf(p.dir)
    const want = new Set(ids.slice(0, 200))
    return { mentions: input.mentions.filter((m) => want.has(m.id)).map((m) => ({ id: m.id, text: m.text, writtenAt: m.writtenAt, recordType: m.recordType, section: m.section, type: m.type, subclass: m.subclass, fragmentId: m.fragmentId, s: m.s, e: m.e, temporality: m.temporality, templated: m.templated })) }
  }
  /** 人工裁定：按稳定编号写裁定表，重跑沿用。 */
  async function decide(runId, { id, status: st, note = '', value, clear = false } = {}) {
    const run = await loadRun(runId)
    if (!run) throw new Error(`找不到批次 ${runId}`)
    if (!id) throw new Error('缺少编号')
    if (!clear && !['已确认', '已改判', '驳回'].includes(st)) throw new Error('复核状态只能是 已确认／已改判／驳回')
    const table = await loadReview(run.outputRoot)
    if (clear) delete table[id]
    else table[id] = { status: st, note, by: 'user', at: new Date().toISOString(), ...(value !== undefined ? { value } : {}) }
    await mkdir(join(run.outputRoot, RECORDS), { recursive: true })
    await writeFile(reviewPath(run.outputRoot), JSON.stringify(table, null, 2))
    return { saved: true, id }
  }
  async function rulepack(specialty = settings.specialty) {
    const r = await loadRulepack(specialty)
    return { layers: r.layers, specialty: r.specialty, general: r.general, available: specialtyIds() }
  }

  return {
    settings, start, cancel, status, report, list, ontology, evidence, decide, rulepack,
    isRunning: () => Boolean(active),
    configInfo: () => ({ ...settings, version, specialties: specialtyIds(), demoAvailable: true }),
    dispose: () => { if (active) active.cancel = true },
  }
}
