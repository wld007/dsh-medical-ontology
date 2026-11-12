/**
 * Host half of the 临床本体构建 bundle.
 *
 * Registers agent tools, the /ontology command and one authenticated browser
 * RPC channel. Every caller shares the same service. Rules only, no model
 * calls: the event packages never leave this machine.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createService } from './lib/service.js'

export const name = 'medical-ontology'
export const inject = ['tools']

const CHANNEL = '/medical-ontology'
const ENTRY_ID = 'medical-ontology'

export function apply(ctx, config = {}) {
  const workingDirectory = ctx.get('workingDirectory')
  const defaultDirectory = workingDirectory?.defaultDirectory ?? process.cwd()
  const stateDir = process.env.DSH_PROFILE_DIR
    ? join(process.env.DSH_PROFILE_DIR, 'plugin-data', 'medical-ontology')
    : join(homedir(), '.dsh', 'plugin-data', 'medical-ontology')
  const service = createService({ config, defaultDirectory, stateDir })
  if (typeof ctx.effect === 'function') ctx.effect(() => () => service.dispose(), 'medical-ontology: cancel running batch')

  ctx.tools.register(tool({
    name: 'ontology_start',
    description: 'dsh-medical-ontology 插件（临床本体构建）：读入「病历事件还原」(dsh-medical-event) 交付的事件包，构建患者级病程本体——以治疗决策为节点：按临床问题把事件串成问题线（长期问题、子线、发作、存疑区间），在线上找出决策节点（治疗改变、关键流程、有新情况的维持），并组装决策闭环（适应证、方案、执行佐证、0–90／91–180／180+ 天结局、到下一节点的间隔）、诊断清单与疾病关系、归因混杂候选、患者特征。每条结论带出处（原文写明／结构推出）、依据提及编号、可见时间与复核状态。只在本机按规则处理，不调用模型；绝不修改输入。交付数据放在输出根目录下，报告与人工裁定放在 _records。立即返回批次 id。',
    parameters: {
      inputDir: { type: 'string', description: '事件包目录（一位病人，或包含多位病人事件包的上级目录，通常是 dsh-medical-event 的交付目录）的绝对路径或相对工作区的路径。' },
      outputRoot: { type: 'string', description: '输出根目录，不能与输入相同、不能包含输入或放在输入里；省略时用设置里的默认值，再缺省为输入旁的 _medical-ontology。' },
      asOf: { type: 'string', description: '截至时刻 "YYYY-MM-DD" 或 "YYYY-MM-DD HH:mm"：只用此刻以前写成的提及构建（评测截断用）；省略则不截断。' },
      specialty: { type: 'string', description: '病种规则包（问题线词表、主线定义）；省略用设置里的默认值（hemodialysis）。' },
      resumeFrom: { type: 'string', description: '继续一个已取消或失败的批次（填批次 id），沿用原输入和输出根目录。' },
    },
    execute: async (args, exec) => service.start({ inputDir: args.inputDir, outputRoot: args.outputRoot, asOf: args.asOf, specialty: args.specialty, resumeFrom: args.resumeFrom, source: { kind: 'agent', sessionId: sessionIdOf(exec?.agent) } }),
    render: (args, v) => [{ type: 'text', text: `已启动批次 ${v.runId}（病种 ${v.specialty}，仅规则），输出到 ${v.outputRoot}。用 ontology_status 查看进度。` }],
  }))

  ctx.tools.register(tool({
    name: 'ontology_cancel',
    description: '取消正在运行的临床本体构建批次。已完成的病人保留在 _records/runs/<批次>/output，可用 ontology_start 的 resumeFrom 继续。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取消当前批次。' } },
    execute: async (args) => service.cancel(args.runId),
    render: (args, v) => [{ type: 'text', text: v.cancelled ? `已请求取消批次 ${v.runId}。` : `没有取消：${v.reason}` }],
  }))

  ctx.tools.register(tool({
    name: 'ontology_status',
    description: '查看临床本体构建批次的状态、进度、各病人的问题线、决策节点与待复核数。省略 runId 时看最近一批。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.status(args.runId),
    render: (args, value) => {
      const run = value.run
      if (!run) return [{ type: 'text', text: '还没有临床本体构建批次。' }]
      const t = run.totals
      const lines = [
        `批次 ${run.id}: ${run.status}${run.current ? `（${run.current.patient} · ${run.current.step}）` : ''}`,
        `病人 ${t.done}/${t.patients}；问题线 ${t.lines}，决策节点 ${t.decisions}（进正式题 ${t.formal}），诊断 ${t.diagnoses}，关系 ${t.relations}，归因候选 ${t.attributions}，待复核 ${t.review}`,
      ]
      for (const p of run.patients.slice(0, 50)) lines.push(`- ${p.patient}: 问题线 ${p.summary.lines}，决策节点 ${p.summary.decisions}，存疑区间 ${p.summary.doubtful}，待复核 ${p.summary.review}${p.problems.length ? `；⚠ ${p.problems.join('；')}` : ''}`)
      if (run.output) lines.push(`交付：${run.output}`)
      if (run.error) lines.push(`错误：${run.error.split('\n')[0]}`)
      return [{ type: 'text', text: lines.join('\n') }]
    },
  }))

  ctx.tools.register(tool({
    name: 'ontology_report',
    description: '读取临床本体构建批次的 Markdown 报告（汇总、各病人、口径）。报告不含病历原文。',
    parameters: { runId: { type: 'string', description: '批次 id；省略则取最近一批。' } },
    execute: async (args) => service.report(args.runId),
    render: (args, v) => [{ type: 'text', text: v.markdown.length > 6000 ? `${v.markdown.slice(0, 6000)}\n…（完整内容见 ${v.path}）` : v.markdown }],
  }))

  ctx.tools.register(tool({
    name: 'ontology_runs',
    description: '列出最近的临床本体构建批次（时间、状态、病人数、决策节点数、待复核数）。',
    parameters: {},
    execute: async () => service.list(),
    render: (args, v) => [{ type: 'text', text: v.runs.length ? v.runs.slice(0, 20).map((r) => `${r.id}  ${r.status}  病人 ${r.patients}  决策节点 ${r.decisions}  待复核 ${r.review}  ${r.input}`).join('\n') : '还没有批次。' }],
  }))

  ctx.inject(['commands'], (cmdCtx) => {
    const usage = '用法：/ontology <事件包目录> [--out 输出根目录] [--as-of "YYYY-MM-DD"]；/ontology --demo 用内置虚构病人试跑'
    const dispose = cmdCtx.commands.register({
      name: 'ontology',
      description: '临床本体构建：/ontology <事件包目录> [--out 输出根目录] [--as-of "YYYY-MM-DD"]｜--demo',
      input: { hint: '事件包目录 [--out 输出根目录] [--as-of "YYYY-MM-DD"]｜--demo' },
      handler: async (invocation) => {
        const args = String(invocation.rawInput ?? '').match(/"[^"]*"|'[^']*'|\S+/g)?.map((x) => x.replace(/^["']|["']$/g, '')) ?? []
        const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined }
        const demo = args.includes('--demo')
        const outputRoot = flag('--out'); const asOf = flag('--as-of')
        if (!demo && !args[0]) return { kind: 'error', text: usage }
        try {
          const v = await service.start({ inputDir: demo ? undefined : args[0], demo, outputRoot, asOf, source: { kind: 'command', sessionId: sessionIdOf(invocation.agent) } })
          return { kind: 'success', text: `已启动批次 ${v.runId}，输出到 ${v.outputRoot}。用 ontology_status 或左侧栏「临床本体构建」查看。` }
        } catch (error) {
          return { kind: 'error', text: String(error?.message ?? error) }
        }
      },
    })
    cmdCtx.effect(() => dispose, 'medical-ontology: /ontology command')
  })

  ctx.inject(['connection', 'webServer'], (rpcCtx) => {
    const route = {
      kind: 'prefix',
      path: CHANNEL,
      handler: async (req, res) => {
        const admission = rpcCtx.connection.admit(req)
        if ('rejection' in admission) { res.writeHead(admission.rejection); res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden'); return }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        const endpoint = new URL(req.url ?? '/', 'http://x').pathname.slice(CHANNEL.length + 1)
        if (!endpoint) { res.writeHead(404); res.end(); return }
        if (req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { res.writeHead(415); res.end(); return }
        let body
        try {
          const chunks = []; let size = 0
          for await (const chunk of req) { size += chunk.length; if (size > 1_000_000) throw new Error('request body too large'); chunks.push(chunk) }
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch (error) {
          res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(error?.message ?? error) })); return
        }
        const rpcId = typeof body?.rpcId === 'string' ? body.rpcId : 'invalid-request'
        if (body?.type !== 'client-request' || body?.method !== endpoint) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ type: 'server-response', rpcId, result: { ok: false, error: { code: 'bad-request', message: 'invalid client-request envelope', details: {} } } }))
          return
        }
        const result = await dispatch(endpoint, body.payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
      },
    }
    rpcCtx.effect(() => rpcCtx.webServer.register(route), 'medical-ontology: rpc route')
  })

  /** User-only (page): persists settings into the profile's patch layer. */
  async function saveDefaults(patch) {
    if (service.isRunning()) throw new Error('有批次在运行，保存设置会重新加载插件并中断批次；请等它结束')
    const editor = ctx.get('configEditor')
    if (!editor?.edit || !editor?.entries) throw new Error('当前 DSH 不支持从页面保存配置；请在 profile 的 cordis.patch.yml 中修改 medical-ontology 的 config')
    const entries = editor.entries()
    let entry
    try { entry = entries.find((item) => item.fiber === ctx.fiber) } catch { /* fall back */ }
    entry ??= entries.find((item) => item.options?.id === ENTRY_ID)
    if (!entry) throw new Error(`找不到插件配置行 ${ENTRY_ID}`)
    const allowed = ['outputRoot', 'specialty', 'showSidebarEntry']
    const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([k]) => allowed.includes(k)))
    await editor.edit(entry, (current) => ({ ...current, ...clean }))
    return { saved: true }
  }

  async function dispatch(endpoint, payload) {
    try {
      const r = payload && typeof payload === 'object' ? payload : {}
      const value = await (async () => {
        switch (endpoint) {
          case 'config': return service.configInfo()
          case 'list': return service.list()
          case 'status': return service.status(r.runId)
          case 'report': return service.report(r.runId)
          case 'start': return service.start({ inputDir: r.inputDir, outputRoot: r.outputRoot || undefined, asOf: r.asOf || undefined, specialty: r.specialty || undefined, demo: r.demo === true, source: { kind: 'panel' } })
          case 'cancel': return service.cancel(r.runId)
          case 'ontology': return service.ontology(r.runId, r.patient, r.asOf)
          case 'evidence': return service.evidence(r.runId, r.patient, Array.isArray(r.ids) ? r.ids : [])
          case 'decide': return service.decide(r.runId, r)
          case 'rulepack': return service.rulepack(r.specialty)
          case 'pickFolder': {
            const ws = ctx.get('uiWorkspace')
            return { path: ws?.pickDirectory ? await ws.pickDirectory() : null }
          }
          case 'saveDefaults': return saveDefaults(r)
          default: throw Object.assign(new Error(`未知方法: ${endpoint}`), { code: 'unknown-endpoint' })
        }
      })()
      return { ok: true, value }
    } catch (error) {
      return { ok: false, error: { code: error?.code ?? 'medical-ontology', message: String(error?.message ?? error), details: {} } }
    }
  }
}

function sessionIdOf(agent) {
  try { const id = agent?.session?.id; return typeof id === 'string' ? id : undefined } catch { return undefined }
}

function tool(def) {
  const properties = {}; const required = []
  for (const [key, spec] of Object.entries(def.parameters ?? {})) {
    properties[key] = { type: spec.type, ...(spec.description ? { description: spec.description } : {}) }
    if (spec.required) required.push(key)
  }
  return {
    name: def.name,
    description: def.description,
    parameters: { type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: def.render ?? ((args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }]) },
    execute: def.execute,
  }
}
