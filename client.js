window.__ModuleLoader__.load({
  id: 'dsh-medical-ontology',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useCallback } = React
    const CHANNEL = '/medical-ontology'
    const PANEL_ID = 'medical-ontology'
    const services = { ctx: null }

    /* ------------------------------------------------------------------ rpc */
    function call(endpoint, payload, signal) {
      const connection = services.ctx?.get('connection')
      if (!connection?.rpc) return Promise.reject(new Error('connection unavailable'))
      return connection.rpc.call(CHANNEL, endpoint, payload ?? {}, signal).then((r) => {
        if (!r || r.ok !== true) throw new Error(r?.error?.message ?? 'RPC failed')
        return r.value
      })
    }
    const msg = (e) => String(e?.message ?? e)
    function useAsync(fn, deps) {
      const [state, setState] = useState({ loading: true, value: null, error: null })
      const [tick, setTick] = useState(0)
      useEffect(() => {
        let alive = true
        setState((s) => ({ ...s, loading: true }))
        Promise.resolve().then(fn).then((value) => alive && setState({ loading: false, value, error: null }), (error) => alive && setState({ loading: false, value: null, error: msg(error) }))
        return () => { alive = false }
      }, [...deps, tick])
      return { ...state, reload: () => setTick((n) => n + 1) }
    }

    /* ---------------------------------------------------------------- style */
    const CSS = `
.mo{--bg:#081116;--panel:#0d1a20;--panel2:#112128;--panel3:#16282f;--line:#1a2c34;--line2:#26404a;--ink:#e2eef0;--ink2:#8ba5ad;--ink3:#58717a;--teal:#22c7c0;--teal2:#7fe9e2;--tealdim:rgba(34,199,192,.14);--ok:#46d17f;--warn:#f5a524;--bad:#f05252;--vio:#a58bff;--blue:#4fb3ff;--mono:"SF Mono","JetBrains Mono",Menlo,monospace;
  height:100%;box-sizing:border-box;background:var(--bg);color:var(--ink);font:12.5px -apple-system,"PingFang SC","Helvetica Neue",sans-serif;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;color-scheme:dark;overflow:hidden}
.mo *{box-sizing:border-box}
.mo-frame{border:1px solid var(--line);background:var(--panel);border-radius:6px}
.mo-top{display:flex;align-items:center;gap:12px;padding:8px 14px;background:linear-gradient(90deg,#0f2329,var(--panel) 40%);flex-wrap:wrap}
.mo-logo{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#2fd6cd,#138a96);display:grid;place-items:center;flex:none}
.mo-brand b{display:block;font-size:14px;letter-spacing:2px}.mo-brand span{font-family:var(--mono);font-size:9.5px;color:var(--ink2);letter-spacing:1px}
.mo-sp{flex:1}
.mo-btn{border:1px solid var(--line2);border-radius:5px;padding:4px 11px;color:var(--ink);background:var(--panel2);font-size:12px;cursor:pointer;white-space:nowrap}
.mo-btn:hover{border-color:var(--teal)}.mo-btn:disabled{opacity:.45;cursor:default}
.mo-btn.pri{border-color:var(--teal);color:var(--teal2);background:var(--tealdim)}
.mo-btn.sm{padding:1px 7px;font-size:11px}.mo-btn.on{border-color:var(--teal);color:var(--teal2)}
.mo-tabs{display:flex;gap:2px;padding:0 8px;flex:none;overflow-x:auto}
.mo-tab{display:flex;align-items:center;padding:8px 12px;color:var(--ink2);font-size:13px;border:0;border-bottom:2px solid transparent;background:none;cursor:pointer;white-space:nowrap}
.mo-tab.on{color:var(--ink);border-bottom-color:var(--teal);font-weight:600}
.mo-tab i{font-style:normal;font-family:var(--mono);font-size:11px;margin-left:5px;color:var(--warn)}
.mo-body{flex:1;min-height:0;display:flex;gap:8px}
.mo-col{display:flex;flex-direction:column;gap:8px;min-height:0}
.mo-scroll{overflow:auto;min-height:0}
.mo-pad{padding:12px 14px}
.mo-h{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.mo-h b{font-size:13px;letter-spacing:1px}
.mo-cap{font-family:var(--mono);font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink3)}
.mo-num{font-family:var(--mono)}
.mo-muted{color:var(--ink2)}.mo-faint{color:var(--ink3)}.mo-ok{color:var(--ok)}.mo-warn{color:var(--warn)}.mo-bad{color:var(--bad)}.mo-tl{color:var(--teal)}
.mo-chip{display:inline-block;border-radius:3px;padding:0 6px;font-size:10.5px;line-height:17px;border:1px solid var(--line2);color:var(--ink2);white-space:nowrap;margin-right:4px}
.mo-chip.t{color:var(--teal2);border-color:rgba(34,199,192,.45);background:var(--tealdim)}
.mo-chip.w{color:var(--warn);border-color:rgba(245,165,36,.5);background:rgba(245,165,36,.08)}
.mo-chip.b{color:#ff8a8a;border-color:rgba(240,82,82,.5);background:rgba(240,82,82,.08)}
.mo-chip.ok{color:var(--ok);border-color:rgba(70,209,127,.45);background:rgba(70,209,127,.08)}
.mo-chip.v{color:var(--vio);border-color:rgba(165,139,255,.45);background:rgba(165,139,255,.08)}
.mo-chip.bl{color:var(--blue);border-color:rgba(79,179,255,.45);background:rgba(79,179,255,.08)}
.mo-sec{border-left:3px solid var(--teal);background:linear-gradient(90deg,rgba(34,199,192,.16),transparent 70%);padding:4px 10px;margin:12px 0 8px;display:flex;gap:8px;align-items:baseline}
.mo-sec b{font-size:12.5px}
.mo table{border-collapse:collapse;width:100%}
.mo td,.mo th{padding:5px 8px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.mo th{font-weight:500;color:var(--ink3);font-size:11px;position:sticky;top:0;background:var(--panel)}
.mo tr.click{cursor:pointer}.mo tr.click:hover td{background:var(--panel2)}.mo tr.sel td{background:var(--panel3)}
.mo-input{background:var(--panel2);border:1px solid var(--line2);border-radius:5px;color:var(--ink);padding:5px 8px;font-size:12px;min-width:0}
.mo-input:focus{outline:none;border-color:var(--teal)}
.mo-field{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--ink2)}
.mo-err{color:#ff9a9a;border:1px solid rgba(240,82,82,.4);background:rgba(240,82,82,.08);padding:6px 10px;border-radius:5px;cursor:pointer}
.mo-empty{color:var(--ink3);padding:30px;text-align:center}
.mo-st{position:relative;flex:1;min-width:110px;border:1px solid var(--line2);border-radius:8px;background:linear-gradient(180deg,#13262d,#0c191e);padding:10px;min-height:124px}
.mo-st .no{font-family:var(--mono);font-size:9.5px;color:var(--ink3);letter-spacing:1px}.mo-st .nm{font-size:14px;font-weight:700;margin:2px 0}
.mo-st .sub{font-size:10.5px;color:var(--ink3);line-height:14px;min-height:28px}.mo-st .big{font-family:var(--mono);font-size:19px;font-weight:700;margin-top:6px}
.mo-st .big small{font-size:10px;color:var(--ink3);font-weight:400;margin-left:3px}
.mo-st .bar{position:absolute;left:0;right:0;top:-1px;height:3px;border-radius:8px 8px 0 0;background:var(--ok)}
.mo-st.todo{opacity:.5;border-style:dashed}.mo-st.todo .bar{background:var(--line2)}
.mo-st.hold{border-color:rgba(245,165,36,.7)}.mo-st.hold .bar{background:var(--warn)}
.mo-st.run{border-color:var(--teal);box-shadow:0 0 18px rgba(34,199,192,.25)}.mo-st.run .bar{background:var(--teal)}
.mo-arrow{align-self:center;color:#3a5e69}
.mo-pi{padding:7px 9px;border-radius:5px;cursor:pointer;border:1px solid transparent;margin-bottom:3px}
.mo-pi:hover{background:var(--panel2)}.mo-pi.on{background:var(--panel3);border-color:var(--line2);box-shadow:inset 3px 0 0 var(--teal)}
.mo-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px}
.mo-loop{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:8px;align-items:stretch}
.mo-step{border:1px solid var(--line2);border-radius:8px;padding:10px;background:linear-gradient(180deg,#112228,#0c181d);min-width:0;position:relative}
.mo-step .n{position:absolute;top:-9px;left:10px;background:var(--teal);color:#04201f;border-radius:9px;font-weight:700;font-size:10.5px;padding:0 7px;line-height:17px}
.mo-step h4{margin:4px 0 6px;font-size:12.5px;letter-spacing:1px}
.mo-item{font-size:12px;line-height:1.55;padding:4px 0;border-top:1px dashed var(--line)}
.mo-item:first-of-type{border-top:0}
.mo-ev{color:var(--teal2);cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
.mo-quote{border-left:2px solid var(--teal);padding:4px 10px;margin:6px 0;background:rgba(34,199,192,.05);font-size:12.5px;line-height:1.6}
.mo-win{display:grid;grid-template-columns:72px 1fr;gap:4px;padding:5px 0;border-top:1px dashed var(--line)}
.mo-win:first-child{border-top:0}
.mo-onto{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.mo-card{border:1px solid var(--line2);border-radius:8px;padding:10px 12px;background:var(--panel2);cursor:pointer}
.mo-card.on{border-color:var(--teal);background:var(--tealdim)}
.mo-card .z{font-size:26px;font-weight:800;color:var(--teal2);line-height:1}
.mo-bars div{display:grid;grid-template-columns:150px 1fr 30px;gap:8px;align-items:center;margin:3px 0;font-size:11.5px}
.mo-bars i{display:block;height:8px;border-radius:3px;background:var(--teal)}
.mo-md{white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.6}
.mo-asof{display:flex;align-items:center;gap:6px;border:1px solid var(--line2);border-radius:6px;padding:3px 8px}
.mo-asof.on{border-color:var(--warn);background:rgba(245,165,36,.08)}
.mo-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--ink2)}
.mo-legend span{display:inline-flex;align-items:center;gap:4px}
.mo-legend i{display:inline-block;width:9px;height:9px;border-radius:2px}
`

    /* -------------------------------------------------------------- helpers */
    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString())
    const fmtTime = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString() } catch { return String(s) } }
    const DAYMS = 86400000
    const toT = (d) => (d ? Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) : NaN)
    const relDay = (anchor, d) => { if (!anchor || !d) return ''; const n = Math.round((toT(d) - toT(anchor)) / DAYMS); return n < 0 ? `D${n}` : `D+${n}` }
    const statusChip = (s) => h('span', { className: `mo-chip ${s === 'completed' ? 'ok' : s === 'running' ? 't' : s === 'review' ? 'w' : 'b'}` }, { completed: '完成', running: '运行中', review: '待复核', failed: '失败', cancelled: '已取消' }[s] ?? s)
    const PROV = { 原文写明: 'ok', 结构推出: 'bl', 模型判断: 'v' }
    const provChip = (p) => (p ? h('span', { className: `mo-chip ${PROV[p] ?? ''}`, title: '出处' }, p) : null)
    const reviewChip = (r) => { const s = r?.status ?? '未复核'; return h('span', { className: `mo-chip ${s === '已确认' ? 'ok' : s === '驳回' ? 'b' : s === '已改判' ? 'v' : ''}` }, s) }
    const KIND_COLOR = { 治疗改变: '#f5a524', 关键流程: '#22c7c0', 有新情况的维持: '#a58bff' }
    const ROLE_COLOR = { 状态: '#c48bff', 干预: '#2fd6a0', 观测: '#4fb3ff', 判断: '#a58bff', 流程: '#8ba5ad' }
    const LINE_COLOR = { 长期问题: '#22c7c0', 从属子线: '#7fe9e2', 独立发作: '#f5a524', 并发症: '#f05252', 急性加重: '#ff8a5b' }
    const actText = (a) => `${a.action}${a.object ? ` ${a.object}` : ''}`

    function Icon({ size = 16 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
        h('circle', { cx: 5, cy: 6, r: 2 }), h('circle', { cx: 12, cy: 12, r: 2 }), h('circle', { cx: 19, cy: 6, r: 2 }), h('circle', { cx: 12, cy: 20, r: 1.6 }),
        h('path', { d: 'M6.6 7.4l3.8 3.4M17.4 7.4l-3.8 3.4M12 14v4' }))
    }

    /* ================================================================ page */
    function Page() {
      const [tab, setTab] = useState('line')
      const [runs, setRuns] = useState([])
      const [runId, setRunId] = useState(null)
      const [run, setRun] = useState(null)
      const [patient, setPatient] = useState(null)
      const [asOf, setAsOf] = useState('')
      const [error, setError] = useState('')
      const [showNew, setShowNew] = useState(false)
      const [sel, setSel] = useState(null) // decision id
      const [tick, setTick] = useState(0)

      const refreshList = useCallback(async () => {
        try {
          const v = await call('list')
          setRuns(v.runs)
          setRunId((cur) => cur ?? v.active ?? v.runs[0]?.id ?? null)
          if (!v.runs.length) setShowNew(true)
        } catch (e) { setError(msg(e)) }
      }, [])
      useEffect(() => { refreshList() }, [])
      useEffect(() => {
        if (!runId) return undefined
        let alive = true; let timer = null
        const load = async () => {
          try {
            const v = await call('status', { runId })
            if (!alive) return
            setRun(v.run)
            setPatient((p) => p ?? v.run?.patients?.[0]?.patient ?? null)
            if (v.run?.status === 'running') timer = setTimeout(load, 1000)
            else refreshList()
          } catch (e) { if (alive) setError(msg(e)) }
        }
        load()
        return () => { alive = false; clearTimeout(timer) }
      }, [runId])

      const ready = run && run.status !== 'running' && patient
      const onto = useAsync(() => (ready ? call('ontology', { runId: run.id, patient, asOf: asOf || undefined }) : null), [ready ? run.id : null, patient, asOf, tick])
      const O = onto.value
      const review = O ? reviewQueue(O).length : 0
      const tabs = [['line', '◈ 产线'], ['timeline', '问题列表时间轴'], ['loop', '决策闭环', O?.decisions?.length], ['onto', '本体 人·诊·治·伴·归'], ['review', '复核', review], ['rules', '规则包'], ['report', '报告']]
      const openDecision = (id) => { setSel(id); setTab('loop') }

      return h('div', { className: 'mo' },
        h('style', {}, CSS),
        h('div', { className: 'mo-frame mo-top' },
          h('div', { className: 'mo-logo' }, h('svg', { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: '#04201f', strokeWidth: 2.4, strokeLinecap: 'round' }, h('circle', { cx: 5, cy: 6, r: 2 }), h('circle', { cx: 19, cy: 6, r: 2 }), h('circle', { cx: 12, cy: 18, r: 2.2 }), h('path', { d: 'M6.5 7.6l4.4 8.6M17.5 7.6l-4.4 8.6' }))),
          h('div', { className: 'mo-brand' }, h('b', {}, '临床本体构建'), h('span', {}, 'CLINICAL ONTOLOGY · 以治疗决策为节点')),
          run ? h('div', { style: { lineHeight: 1.35 } }, h('div', {}, statusChip(run.status), h('b', {}, run.inputName)), h('div', { className: 'mo-num mo-faint', style: { fontSize: 10.5 } }, run.id)) : null,
          h('span', { className: 'mo-sp' }),
          run?.patients?.length > 1 ? h('select', { className: 'mo-input', value: patient ?? '', onChange: (e) => setPatient(e.target.value) }, run.patients.map((p) => h('option', { key: p.patient, value: p.patient }, p.patient))) : null,
          h('div', { className: `mo-asof${asOf ? ' on' : ''}`, title: '只用这一天以前写成的记录重算本体（as-of），评测截断用同一口径' },
            h('span', { className: asOf ? 'mo-warn' : 'mo-muted' }, '按日期回看'),
            h('input', { className: 'mo-input', type: 'date', value: asOf, onChange: (e) => setAsOf(e.target.value), style: { padding: '1px 4px' } }),
            asOf ? h('button', { className: 'mo-btn sm', onClick: () => setAsOf('') }, '全量') : null),
          run?.status === 'running' ? h('button', { className: 'mo-btn', onClick: () => call('cancel', { runId: run.id }).catch((e) => setError(msg(e))) }, '取消批次') : null,
          h('button', { className: 'mo-btn pri', onClick: () => setShowNew((x) => !x) }, '＋ 新批次'),
          runs.length ? h('select', { className: 'mo-input', style: { maxWidth: 260 }, value: runId ?? '', onChange: (e) => { setRunId(e.target.value); setRun(null); setPatient(null); setSel(null) } },
            runs.map((r) => h('option', { key: r.id, value: r.id }, `${r.id.slice(4, 13)} · ${r.input} · ${r.status}`))) : null),
        h('div', { className: 'mo-frame mo-tabs' }, tabs.map(([k, label, n]) => h('button', { key: k, className: `mo-tab${tab === k ? ' on' : ''}`, onClick: () => setTab(k) }, label, n ? h('i', {}, String(n)) : null))),
        error ? h('div', { className: 'mo-err', onClick: () => setError('') }, error, '（点击关闭）') : null,
        showNew ? h(NewRun, { onStarted: (id) => { setShowNew(false); setRunId(id); setRun(null); setPatient(null); setSel(null); refreshList(); setTab('line') }, onError: setError }) : null,
        h('div', { className: 'mo-body' },
          !run ? h('div', { className: 'mo-frame mo-empty', style: { flex: 1 } }, runs.length ? '加载中…' : '还没有批次。点「＋ 新批次」选择事件包目录，或先用内置的虚构病人试跑。')
            : tab === 'line' ? h(Pipeline, { run, O, setTab })
              : tab === 'rules' ? h(Rules, { run })
                : tab === 'report' ? h(Report, { run })
                  : !O ? h('div', { className: 'mo-frame mo-empty', style: { flex: 1 } }, onto.error ?? (run.status === 'running' ? '批次运行中…' : '加载中…'))
                    : tab === 'timeline' ? h(Timeline, { O, asOf, openDecision, sel })
                      : tab === 'loop' ? h(Loops, { run, O, sel, setSel })
                        : tab === 'onto' ? h(Ontology, { run, O, openDecision })
                          : h(Review, { run, O, reload: () => setTick((n) => n + 1), openDecision })))
    }

    /* --------------------------------------------------------------- new run */
    function NewRun({ onStarted, onError }) {
      const [inputDir, setInput] = useState('')
      const [outputRoot, setOut] = useState('')
      const [asOf, setAsOf] = useState('')
      const [busy, setBusy] = useState(false)
      const pick = async () => { try { const v = await call('pickFolder'); if (v.path) setInput(v.path) } catch (e) { onError(msg(e)) } }
      const start = async (demo) => {
        setBusy(true)
        try { const v = await call('start', demo ? { demo: true } : { inputDir, outputRoot: outputRoot || undefined, asOf: asOf || undefined }); onStarted(v.runId) } catch (e) { onError(msg(e)) } finally { setBusy(false) }
      }
      return h('div', { className: 'mo-frame mo-pad', style: { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' } },
        h('label', { className: 'mo-field', style: { flex: 3, minWidth: 280 } }, '事件包目录（「病历事件还原」的交付目录；一位病人或多位病人的上级目录）',
          h('div', { style: { display: 'flex', gap: 6 } }, h('input', { className: 'mo-input', style: { flex: 1 }, value: inputDir, onChange: (e) => setInput(e.target.value), placeholder: '/path/to/_medical-event/…' }), h('button', { className: 'mo-btn', onClick: pick }, '选择…'))),
        h('label', { className: 'mo-field', style: { flex: 2, minWidth: 200 } }, '输出根目录（可空：输入旁的 _medical-ontology）', h('input', { className: 'mo-input', value: outputRoot, onChange: (e) => setOut(e.target.value) })),
        h('label', { className: 'mo-field', style: { width: 170 } }, '截至时刻（可空）', h('input', { className: 'mo-input', value: asOf, onChange: (e) => setAsOf(e.target.value), placeholder: 'YYYY-MM-DD' })),
        h('button', { className: 'mo-btn pri', disabled: !inputDir || busy, onClick: () => start(false) }, busy ? '启动中…' : '开始'),
        h('button', { className: 'mo-btn', disabled: busy, onClick: () => start(true), title: '内置一位虚构的血透病人（全部编造），不需要任何真实数据' }, '用示例（虚构病人）试跑'))
    }

    /* -------------------------------------------------------------- pipeline */
    function Pipeline({ run, O, setTab }) {
      const t = run.totals
      const S = O?.summary
      const running = run.status === 'running'
      const st = (no, nm, sub, big, unit, state, onClick) => h('div', { className: `mo-st ${state}`, onClick, style: onClick ? { cursor: 'pointer' } : null },
        h('div', { className: 'bar' }), h('div', { className: 'no' }, no), h('div', { className: 'nm' }, nm), h('div', { className: 'sub' }, sub),
        h('div', { className: 'big' }, big, h('small', {}, unit)))
      const done = running ? 'run' : 'done'
      const arrow = h('span', { className: 'mo-arrow' }, '→')
      return h('div', { className: 'mo-col mo-scroll', style: { flex: 1 } },
        h('div', { className: 'mo-frame mo-pad' },
          h('div', { className: 'mo-h' }, h('b', {}, '处理流程'), h('span', { className: 'mo-cap' }, 'PIPELINE'), h('span', { className: 'mo-sp' }), h('span', { className: 'mo-faint' }, run.input)),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            st('O1', '读入事件包', '格式版本、上游验收门、截断', `${t.done}/${t.patients}`, '病人', done),
            arrow, st('O2 · 工序5', '问题线', '词表挂线、子线、发作、存疑区间', fmt(t.lines), '条线', done, () => setTab('timeline')),
            arrow, st('O3 · 工序6', '决策节点', '治疗改变、关键流程、有新情况的维持', fmt(t.decisions), '个点', done, () => setTab('loop')),
            arrow, st('O4', '决策闭环', '适应证→方案→执行→三窗口结局', fmt(t.formal), '进正式题', done, () => setTab('loop')),
            arrow, st('O5', '诊断层', '诊断清单、角色候选、疾病关系', fmt(t.diagnoses), '个诊断', done, () => setTab('onto'))),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 } },
            st('O6', '伴发事件', '需模型＋医生（下一版）', '—', '', 'todo'),
            arrow, st('O7', '结局归因', '本版：结构推出的混杂候选', fmt(t.attributions), '条候选', done, () => setTab('onto')),
            arrow, st('O8', '患者特征', '人口学、意愿、器官功能、末次接触', S ? '✓' : '—', '', done, () => setTab('onto')),
            arrow, st('O9', '医生复核', '诊断角色、关系、归因、对象不明的点', fmt(t.review), '项待办', t.review ? 'hold' : done, () => setTab('review')),
            arrow, st('O10', '交付', '本体文件＋报告', run.output ? '✓' : '—', '', run.output ? 'done' : 'todo'))),
        h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          h('div', { className: 'mo-frame mo-pad', style: { flex: 1.2, minWidth: 360 } },
            h('div', { className: 'mo-h' }, h('b', {}, '本批病人'), h('span', { className: 'mo-cap' }, 'PATIENTS')),
            h('table', {}, h('thead', {}, h('tr', {}, ['病人', '上游', '问题线', '存疑', '决策节点', '主线节点', '待复核', 'D+0'].map((x) => h('th', { key: x }, x)))),
              h('tbody', {}, run.patients.map((p) => h('tr', { key: p.patient },
                h('td', { className: 'mo-num' }, p.patient), h('td', {}, p.problems.length ? h('span', { className: 'mo-chip w', title: p.problems.join('\n') }, '有提示') : h('span', { className: 'mo-chip ok' }, '通过')),
                h('td', { className: 'mo-num' }, p.summary.lines), h('td', { className: 'mo-num' }, p.summary.doubtful), h('td', { className: 'mo-num' }, `${p.summary.decisions}（正式 ${p.summary.formal}）`),
                h('td', { className: 'mo-num' }, p.summary.mainLineDecisions), h('td', { className: 'mo-num mo-warn' }, p.summary.review), h('td', { className: 'mo-num' }, p.anchor)))))),
          h('div', { className: 'mo-frame mo-pad', style: { flex: 1, minWidth: 320 } },
            h('div', { className: 'mo-h' }, h('b', {}, '口径'), h('span', { className: 'mo-cap' }, 'PRINCIPLES')),
            h('div', { className: 'mo-kv' },
              h('span', { className: 'mo-faint' }, '输入'), h('span', {}, '只读事件包（dsh-medical-event），不回读病历；运行前后核对文件'),
              h('span', { className: 'mo-faint' }, '截断'), h('span', {}, '只按写成时间（可见时间）；页面右上「按日期回看」即时重算'),
              h('span', { className: 'mo-faint' }, '出处'), h('span', {}, provChip('原文写明'), provChip('结构推出'), provChip('模型判断'), h('span', { className: 'mo-faint' }, '（本版不调用模型）')),
              h('span', { className: 'mo-faint' }, '不推断'), h('span', {}, '只排已有事件，不补写；子线归属只凭原文命名或结构从属'),
              h('span', { className: 'mo-faint' }, '编号'), h('span', {}, '内容派生的稳定编号；人工裁定存 _records/review.json，重跑沿用'),
              h('span', { className: 'mo-faint' }, '源文件'), h('span', { className: run.sourceCheck ? (run.sourceCheck.changed ? 'mo-warn' : 'mo-ok') : 'mo-faint' }, run.sourceCheck ? (run.sourceCheck.changed ? `${run.sourceCheck.changed} 个变化` : `${run.sourceCheck.files} 个文件，未改动`) : '—'),
              h('span', { className: 'mo-faint' }, '交付'), h('span', { className: 'mo-num', style: { wordBreak: 'break-all' } }, run.output ?? '—')),
            (run.warnings ?? []).map((w, i) => h('div', { key: i, className: 'mo-warn', style: { marginTop: 6 } }, `⚠ ${w}`)),
            run.error ? h('div', { className: 'mo-err', style: { marginTop: 8 } }, run.error.split('\n')[0]) : null)))
    }

    /* -------------------------------------------------------------- timeline */
    function orderLines(lines) {
      const kids = new Map()
      for (const l of lines) if (l.parent) { if (!kids.has(l.parent)) kids.set(l.parent, []); kids.get(l.parent).push(l) }
      const out = []; const seen = new Set()
      const visit = (l, depth) => { if (seen.has(l.id)) return; seen.add(l.id); out.push({ l, depth }); for (const k of (kids.get(l.id) ?? []).sort((a, b) => String(a.start).localeCompare(String(b.start)))) visit(k, depth + 1) }
      for (const l of lines.filter((x) => !x.parent || !lines.some((y) => y.id === x.parent))) visit(l, 0)
      return out
    }

    function Timeline({ O, asOf, openDecision, sel }) {
      const [hover, setHover] = useState(null)
      const rows = orderLines(O.problems)
      const W = 1080; const L = 210; const R = W - 16; const RH = 26
      const from = O.timeline.range.from ?? O.anchor.day; const to = O.timeline.range.to ?? from
      const y0 = new Date(toT(from)).getUTCFullYear(); const y1 = new Date(toT(to)).getUTCFullYear() + 1
      const A = Date.UTC(y0, 0, 1); const B = Date.UTC(y1, 0, 1)
      const X = (d) => L + Math.max(0, Math.min(1, (toT(d) - A) / (B - A))) * (R - L)
      const top = 24
      const series = O.timeline.series.slice(0, 4)
      const H = top + rows.length * RH + 14 + series.length * 34 + 10
      const els = []
      els.push(h('defs', { key: 'defs' }, h('pattern', { id: 'mo-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, h('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#f05252', strokeWidth: 2, opacity: 0.55 }))))
      for (let yr = y0; yr <= y1; yr++) {
        const x = L + (Date.UTC(yr, 0, 1) - A) / (B - A) * (R - L)
        els.push(h('line', { key: `g${yr}`, x1: x, x2: x, y1: top - 6, y2: H, stroke: '#1a2c34' }))
        const wide = (R - L) / (y1 - y0) > 90
        if (yr < y1) els.push(h('text', { key: `t${yr}`, x: x + 4, y: 14, fill: '#58717a', fontSize: 10.5, fontFamily: 'SF Mono,Menlo' }, wide ? `${yr}  ${relDay(O.anchor.day, `${yr}-01-01`)}` : String(yr)))
      }
      for (const s of O.timeline.stays) {
        const x1 = X(s.start); const x2 = X(s.end ?? s.start)
        els.push(h('rect', { key: `st${s.id}`, x: x1, y: top - 6, width: Math.max(3, x2 - x1), height: rows.length * RH + 8, fill: '#8ba5ad', opacity: 0.1 }, h('title', {}, `住院 ${s.start}～${s.end ?? '?'} ${s.dept ?? ''}`)))
      }
      rows.forEach(({ l, depth }, i) => {
        const y = top + i * RH; const cy = y + RH / 2
        const color = LINE_COLOR[l.kind] ?? '#8ba5ad'
        if (i % 2 === 0) els.push(h('rect', { key: `bg${l.id}`, x: 0, y, width: W, height: RH, fill: '#0b171c', opacity: 0.6 }))
        els.push(h('rect', { key: `k${l.id}`, x: 4 + depth * 12, y: y + 6, width: 3, height: RH - 12, rx: 1, fill: color }))
        const label = `${l.code} ${l.kind === '长期问题' || l.kind === '从属子线' ? l.name : `${l.kind} ${l.start?.slice(0, 7) ?? ''}`}`
        els.push(h('text', { key: `l${l.id}`, x: 12 + depth * 12, y: cy + 4, fill: depth ? '#8ba5ad' : '#e2eef0', fontSize: 11.5, fontWeight: depth ? 400 : 600 }, label.length > 15 ? `${label.slice(0, 15)}…` : label, h('title', {}, `${l.label}（${l.kind}）${l.parentBasis ? `\n归属依据：${l.parentBasis.text}` : ''}`)))
        if (l.start) {
          const x1 = X(l.start); const x2 = X(l.end ?? l.start)
          if (toT(l.start) < A) els.push(h('path', { key: `lt${l.id}`, d: `M${L - 2} ${cy} l7 -5 v10z`, fill: color, opacity: 0.8 }, h('title', {}, `${l.label}：${l.start} 起（早于时间轴，来自既往史叙述）`)))
          if (['独立发作', '并发症', '急性加重'].includes(l.kind)) els.push(h('rect', { key: `ep${l.id}`, x: x1 - 2, y: y + 5, width: Math.max(6, x2 - x1 + 4), height: RH - 10, rx: 3, fill: 'none', stroke: color, strokeWidth: 1.5 }))
          else els.push(h('line', { key: `ln${l.id}`, x1, x2: Math.max(x1 + 2, x2), y1: cy, y2: cy, stroke: color, strokeWidth: 2, opacity: 0.35 }))
        }
        for (const iv of l.doubtful ?? []) {
          const x1 = X(iv.from); const x2 = X(iv.to)
          els.push(h('rect', { key: `dq${l.id}${iv.finding}`, x: x1, y: y + 3, width: Math.max(4, x2 - x1), height: RH - 6, fill: 'url(#mo-hatch)' }, h('title', {}, `存疑区间 ${iv.from}～${iv.to}：${iv.verdict}（${iv.concepts.join('、')}）`)))
        }
        for (const m of O.lineMembers[l.id] ?? []) {
          if (!m.day) continue
          const x = X(m.day)
          els.push(h('line', { key: `m${l.id}${m.event}`, x1: x, x2: x, y1: cy - 5, y2: cy + 5, stroke: ROLE_COLOR[m.role] ?? '#8ba5ad', strokeWidth: 1.4, opacity: m.primary ? 0.95 : 0.45 }, h('title', {}, `${m.day} ${m.concept}（${m.role}${m.primary ? '' : '，次线'}）`)))
        }
        for (const d of O.decisions.filter((x) => x.problem === l.id)) {
          const x = X(d.decidedAt); const r = d.isMainLine ? 7 : 5.5
          const on = sel === d.id || hover === d.id
          els.push(h('path', { key: `d${d.id}`, d: `M${x} ${cy - r} L${x + r} ${cy} L${x} ${cy + r} L${x - r} ${cy} Z`, fill: KIND_COLOR[d.pointKind] ?? '#ccc', stroke: on ? '#fff' : d.formal ? '#081116' : '#f05252', strokeWidth: on ? 2 : 1.2, style: { cursor: 'pointer' },
            onClick: () => openDecision(d.id), onMouseEnter: () => setHover(d.id), onMouseLeave: () => setHover(null) },
          h('title', {}, `${d.decidedAt} ${relDay(O.anchor.day, d.decidedAt)} · ${d.pointKind}\n${d.actions.map(actText).join('；')}${d.formal ? '' : `\n不进正式题：${d.notFormalReasons.join('、')}`}\n（点击看决策闭环）`)))
        }
      })
      // 就诊层面（未归线）的决策点
      const loose = O.decisions.filter((d) => !d.problem)
      // 检验
      let sy = top + rows.length * RH + 14
      for (const s of series) {
        const vs = s.points.map((p) => p.v); const lo = Math.min(...vs); const hi = Math.max(...vs); const hh = 24
        const Y = (v) => sy + hh - (hi === lo ? hh / 2 : (v - lo) / (hi - lo) * hh)
        els.push(h('text', { key: `sn${s.name}`, x: 12, y: sy + 12, fill: '#4fb3ff', fontSize: 11 }, s.name))
        els.push(h('text', { key: `sr${s.name}`, x: 12, y: sy + 25, fill: '#58717a', fontSize: 9.5 }, `${lo}–${hi}`))
        els.push(h('path', { key: `sp${s.name}`, d: s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.d)} ${Y(p.v)}`).join(''), stroke: '#4fb3ff', strokeWidth: 1.2, fill: 'none', opacity: 0.8 }))
        s.points.forEach((p, i) => els.push(h('circle', { key: `sc${s.name}${i}`, cx: X(p.d), cy: Y(p.v), r: 2.2, fill: p.flag ? '#f5a524' : '#4fb3ff' }, h('title', {}, `${s.name} ${p.v}${p.flag} · ${p.d}`))))
        sy += 34
      }
      if (asOf) {
        const cx = X(asOf)
        els.push(h('rect', { key: 'cut', x: cx, y: top - 6, width: Math.max(0, R - cx), height: H - top + 6, fill: 'rgba(8,17,22,.55)', pointerEvents: 'none' }))
        els.push(h('line', { key: 'cutl', x1: cx, x2: cx, y1: top - 6, y2: H, stroke: '#f5a524', strokeDasharray: '4 3', strokeWidth: 1.4 }))
        els.push(h('text', { key: 'cutt', x: Math.min(cx + 5, R - 200), y: top + 6, fill: '#f5a524', fontSize: 10.5 }, `截至 ${asOf}：之后写成的记录不可见`))
      }
      return h('div', { className: 'mo-frame mo-col', style: { flex: 1, minWidth: 0 } },
        h('div', { style: { padding: '10px 14px 6px', borderBottom: '1px solid var(--line)' } },
          h('div', { className: 'mo-h', style: { marginBottom: 4 } }, h('b', {}, '问题列表时间轴'), h('span', { className: 'mo-cap' }, 'PROBLEM LIST'),
            h('span', { className: 'mo-faint' }, `D+0 ＝ ${O.anchor.day}（${O.anchor.basis}）`), h('span', { className: 'mo-sp' }),
            h('span', { className: 'mo-muted' }, `${O.summary.lines} 条线 · ${O.summary.decisions} 个决策节点 · 存疑区间 ${O.summary.doubtful}`)),
          h('div', { className: 'mo-legend' },
            Object.entries(LINE_COLOR).map(([k, c]) => h('span', { key: k }, h('i', { style: { background: c } }), k)),
            h('span', {}, '｜'),
            Object.entries(KIND_COLOR).map(([k, c]) => h('span', { key: k }, h('i', { style: { background: c, transform: 'rotate(45deg)' } }), k)),
            h('span', {}, '｜竖线＝挂入的事件（', ...Object.entries(ROLE_COLOR).map(([k, c]) => h('b', { key: k, style: { color: c, fontWeight: 500, margin: '0 2px' } }, k)), '）'),
            h('span', {}, h('i', { style: { background: '#8ba5ad', opacity: 0.35 } }), '住院'),
            h('span', {}, h('i', { style: { background: 'repeating-linear-gradient(45deg,#f05252 0 2px,transparent 2px 4px)' } }), '存疑'),
            h('span', {}, '红边菱形＝不进正式题'))),
        h('div', { className: 'mo-scroll', style: { flex: 1 } }, h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMinYMin meet', style: { display: 'block', width: '100%', maxWidth: 1500, height: 'auto' } }, els),
          loose.length ? h('div', { className: 'mo-pad mo-faint' }, '未归线程（就诊层面）的决策点：', loose.map((d) => h('span', { key: d.id, className: 'mo-ev', style: { marginRight: 10 }, onClick: () => openDecision(d.id) }, `${d.decidedAt} ${d.actions.map(actText).join('、')}`))) : null))
    }

    /* ----------------------------------------------------------------- loops */
    function Evidence({ run, O, ids, label = '原文' }) {
      const [open, setOpen] = useState(false)
      const d = useAsync(() => (open && ids?.length ? call('evidence', { runId: run.id, patient: O.patient, ids }) : null), [open, (ids ?? []).join(',')])
      if (!ids?.length) return null
      return h('span', {},
        h('span', { className: 'mo-ev', onClick: () => setOpen((x) => !x), style: { fontSize: 11, marginLeft: 4 } }, open ? '收起' : `${label}（${ids.length}）`),
        open ? h('div', {}, d.value ? d.value.mentions.map((m) => h('div', { key: m.id, className: 'mo-quote' },
          h('div', { className: 'mo-faint', style: { fontSize: 10.5 } }, `${m.writtenAt?.slice(0, 16)} 写成 · ${m.recordType}／${m.section} · ${m.id}`), `“${m.text}”`)) : h('div', { className: 'mo-faint' }, d.error ?? '加载中…')) : null)
    }

    function Loops({ run, O, sel, setSel }) {
      const [filter, setFilter] = useState('')
      const lines = [...new Set(O.decisions.map((d) => d.problemName))]
      const list = O.decisions.filter((d) => !filter || d.problemName === filter)
      const cur = O.decisions.find((d) => d.id === sel) ?? list[0]
      return h('div', { className: 'mo-body', style: { flex: 1 } },
        h('div', { className: 'mo-frame mo-col', style: { width: 300, flex: 'none', padding: 8 } },
          h('select', { className: 'mo-input', value: filter, onChange: (e) => setFilter(e.target.value) }, h('option', { value: '' }, `全部问题线（${O.decisions.length}）`), lines.map((l) => h('option', { key: l, value: l }, l))),
          h('div', { className: 'mo-scroll', style: { flex: 1 } }, list.map((d) => h('div', { key: d.id, className: `mo-pi${cur?.id === d.id ? ' on' : ''}`, onClick: () => setSel(d.id) },
            h('div', { style: { display: 'flex', gap: 6, alignItems: 'baseline' } }, h('b', { className: 'mo-num' }, d.decidedAt), h('span', { className: 'mo-faint mo-num' }, relDay(O.anchor.day, d.decidedAt)), h('span', { className: 'mo-sp' }),
              h('span', { style: { color: KIND_COLOR[d.pointKind], fontSize: 11 } }, `◆ ${d.pointKind}`)),
            h('div', { style: { margin: '3px 0 1px' } }, d.actions.map(actText).join('；')),
            h('div', { className: 'mo-faint', style: { fontSize: 11 } }, d.problemName, d.isMainLine ? h('span', { className: 'mo-chip t', style: { marginLeft: 6 } }, '主线') : null, d.formal ? null : h('span', { className: 'mo-chip b', style: { marginLeft: 6 } }, '不进正式题')))))),
        cur ? h(LoopCard, { key: cur.id, run, O, d: cur }) : h('div', { className: 'mo-frame mo-empty', style: { flex: 1 } }, '没有决策节点'))
    }

    function LoopCard({ run, O, d }) {
      const W = [['d0_90', '短期 0–90 天'], ['d91_180', '中期 91–180 天'], ['d180_plus', '长期 180 天以上']]
      const win = (o) => {
        if (!o?.observed) return h('span', { className: 'mo-faint' }, o?.note ?? '—')
        const parts = []
        for (const i of o.indicators) parts.push(h('div', { key: i.concept }, h('b', {}, i.concept), ' ', i.baseline ? `${i.baseline.v}` : '?', ' → ', i.after ? `${i.after.v}` : '—', ' ', h('span', { className: i.direction === '升高' ? 'mo-warn' : i.direction === '降低' ? 'mo-tl' : 'mo-faint' }, `${i.direction}${i.change != null ? `（${i.change > 0 ? '+' : ''}${i.change}%）` : ''}`)))
        for (const x of o.newDiagnoses) parts.push(h('div', { key: `n${x.concept}` }, '新诊断 ', h('b', {}, x.concept), h('span', { className: 'mo-faint' }, ` ${x.day}`)))
        for (const x of o.admissions) parts.push(h('div', { key: `a${x.encounter}` }, h('span', { className: 'mo-warn' }, '住院 '), `${x.start}${x.dept ? ` ${x.dept}` : ''}`))
        if (!parts.length) parts.push(h('div', { key: 'none', className: 'mo-faint' }, '本线没有可比的指标、新诊断或住院（未观察到 ≠ 没发生）'))
        if (o.concurrent.length) parts.push(h('div', { key: 'c', className: 'mo-faint', style: { fontSize: 11 } }, `同期其他线的治疗改变（混杂候选）：${o.concurrent.slice(0, 3).map((c) => `${c.day} ${c.actions.join('、')}`).join('；')}${o.concurrent.length > 3 ? ` 等 ${o.concurrent.length} 条` : ''}`))
        return h('div', {}, h('div', { className: 'mo-faint', style: { fontSize: 10.5 } }, `${o.from}～${o.to}${o.truncated ? '（在下一个同线决策处截断）' : ''}`), parts)
      }
      return h('div', { className: 'mo-frame mo-scroll mo-pad', style: { flex: 1, minWidth: 0 } },
        h('div', { className: 'mo-h' }, h('b', {}, '决策闭环'), h('span', { className: 'mo-cap' }, 'DECISION LOOP'), h('span', { className: 'mo-sp' }), h('span', { className: 'mo-faint mo-num' }, d.id)),
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
          h('span', { style: { fontSize: 18, fontWeight: 700 } }, d.actions.map(actText).join('；')),
          h('span', { style: { color: KIND_COLOR[d.pointKind] } }, `◆ ${d.pointKind}`), d.isMainLine ? h('span', { className: 'mo-chip t' }, '主线节点') : null,
          provChip(d.provenance), reviewChip(d.review),
          d.formal ? h('span', { className: 'mo-chip ok' }, '进正式题') : h('span', { className: 'mo-chip b' }, `不进正式题：${d.notFormalReasons.join('、')}`)),
        h('div', { className: 'mo-muted', style: { margin: '4px 0 14px' } },
          `${d.problemName} · 决策时刻 ${d.decidedAt}（${relDay(O.anchor.day, d.decidedAt)}） · 可见时刻 ${d.visibleAt}${d.backfilled ? ' · 补记' : ''}${d.encounterKind ? ` · ${d.encounterKind}` : ''}`),
        h('div', { className: 'mo-loop' },
          h('div', { className: 'mo-step' }, h('span', { className: 'n' }, '1'), h('h4', {}, '适应证'),
            d.indication.newSituations.length ? d.indication.newSituations.map((n, i) => h('div', { key: i, className: 'mo-item' }, h('span', { className: 'mo-chip w' }, n.kind), n.text, h('span', { className: 'mo-faint' }, ` ${n.day}`), h(Evidence, { run, O, ids: [n.mention].filter(Boolean) }))) : h('div', { className: 'mo-item mo-faint' }, '近 30 天本线没有新诊断或新出现的异常检验'),
            d.indication.reasons.map((r) => h('div', { key: r.mention, className: 'mo-item' }, '写明的理由：', r.text, h(Evidence, { run, O, ids: [r.mention] })))),
          h('div', { className: 'mo-step' }, h('span', { className: 'n' }, '2'), h('h4', {}, '治疗方案（动作）'),
            d.actions.map((a) => h('div', { key: a.mention, className: 'mo-item' }, h('b', {}, actText(a)), h('div', { className: 'mo-faint', style: { fontSize: 11 } }, `${a.type} · ${a.recordType}／${a.section}`), h(Evidence, { run, O, ids: [a.mention] }))),
            d.scheduled.length ? h('div', { className: 'mo-item' }, h('span', { className: 'mo-faint' }, '同时安排：'), d.scheduled.map((s) => s.text).join('；')) : null,
            d.patientChoices.length ? h('div', { className: 'mo-item' }, h('span', { className: 'mo-chip b' }, '患者方决定'), d.patientChoices.map((s) => s.text).join('；')) : null),
          h('div', { className: 'mo-step' }, h('span', { className: 'n' }, '3'), h('h4', {}, '实际执行'),
            d.execution.corroborations.length ? d.execution.corroborations.map((c) => h('div', { key: c.mention, className: 'mo-item' }, h('span', { className: 'mo-chip ok' }, '佐证'), c.text, h('div', { className: 'mo-faint', style: { fontSize: 11 } }, `${c.recordType} ${c.writtenAt?.slice(0, 10)}`))) : h('div', { className: 'mo-item mo-faint' }, '30 天内没有对得上的执行记录或转述（本数据没有医嘱）'),
            d.doubtful ? h('div', { className: 'mo-item mo-bad' }, `存疑：${d.doubtful.verdict}`) : null),
          h('div', { className: 'mo-step' }, h('span', { className: 'n' }, '4'), h('h4', {}, '结局（观察到的）'),
            W.map(([k, label]) => h('div', { key: k, className: 'mo-win' }, h('span', { className: 'mo-faint' }, label), win(d.outcomes[k]))),
            h('div', { style: { marginTop: 4 } }, provChip('结构推出'), h('span', { className: 'mo-faint', style: { fontSize: 10.5 } }, '“动作后观察到的”，不等于“动作造成的”'))),
          h('div', { className: 'mo-step' }, h('span', { className: 'n' }, '5'), h('h4', {}, '后续'),
            d.next ? h('div', { className: 'mo-item' }, '同线下一个决策：', h('b', {}, `${d.next.days} 天后`), h('div', {}, d.next.actions.join('；'))) : h('div', { className: 'mo-item mo-faint' }, '同线之后没有决策节点'),
            d.nextMain ? h('div', { className: 'mo-item' }, '下一个主线节点：', h('b', {}, `${d.nextMain.days} 天后`), h('div', { className: 'mo-faint', style: { fontSize: 11 } }, d.nextMain.reasonNote)) : null,
            h('div', { className: 'mo-item mo-faint' }, '衔接说明（为什么进入下一步）需模型从原文摘出，出题时隐去；本版未生成'))),
        h('div', { className: 'mo-sec' }, h('b', {}, '依据'), h('span', { className: 'mo-cap' }, 'BASIS')),
        h('div', { className: 'mo-muted' }, `规则 ${d.rule} · 依据 ${d.basis.length} 条提及`, h(Evidence, { run, O, ids: d.basis, label: '全部原文' })))
    }

    /* -------------------------------------------------------------- ontology */
    function Ontology({ run, O, openDecision }) {
      const [part, setPart] = useState('人')
      const P = O.person
      const cards = [['人', '患者特征', `${P.preferences.length} 条意愿`], ['诊', '诊断与疾病关系', `${O.diagnoses.length} 个诊断 · ${O.relations.length} 条关系`], ['治', '治疗与诊疗决策', `${O.decisions.length} 次决策`], ['伴', '伴发事件', '需模型＋医生'], ['归', '结局归因', `${O.attributions.length} 条候选`]]
      const byLine = {}
      for (const d of O.decisions) byLine[d.problemName] = (byLine[d.problemName] ?? 0) + 1
      const maxN = Math.max(1, ...Object.values(byLine))
      const age = P.birth && O.anchor.day ? Math.floor((toT(O.anchor.day) - toT(P.birth)) / DAYMS / 365.25) : null
      return h('div', { className: 'mo-frame mo-scroll mo-pad', style: { flex: 1 } },
        h('div', { className: 'mo-onto' }, cards.map(([z, name, sub]) => h('div', { key: z, className: `mo-card${part === z ? ' on' : ''}`, onClick: () => setPart(z) },
          h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } }, h('span', { className: 'z' }, z), h('div', {}, h('b', {}, name), h('div', { className: 'mo-faint', style: { fontSize: 11 } }, sub)))))),
        part === '人' ? h('div', {},
          h('div', { className: 'mo-sec' }, h('b', {}, '患者特征'), provChip('结构推出')),
          h('div', { className: 'mo-kv' },
            h('span', { className: 'mo-faint' }, '人口学'), h('span', {}, [P.sex, P.birth ? `${P.birth.slice(0, 4)} 年生` : null, age != null ? `D+0 时 ${age} 岁` : null].filter(Boolean).join(' · ') || '—'),
            h('span', { className: 'mo-faint' }, 'D+0'), h('span', {}, `${O.anchor.day}（${O.anchor.basis}）`),
            h('span', { className: 'mo-faint' }, '患者意愿'), h('span', {}, P.preferences.length ? P.preferences.map((c) => h('div', { key: c.mention }, h('span', { className: 'mo-ev', onClick: () => openDecision(c.decision) }, c.day), ` ${c.text}`)) : '原文没有记载拒绝或自行决定'),
            h('span', { className: 'mo-faint' }, '治疗限制因素'), h('span', {}, P.constraints.length ? P.constraints.map((c) => h('span', { key: c.mention, className: 'mo-chip w' }, `${c.kind}：${c.text}`)) : '—'),
            h('span', { className: 'mo-faint' }, '器官功能与营养'), h('span', {}, P.organFunction.length ? P.organFunction.map((o) => h('div', { key: o.concept }, h('b', {}, o.concept), ` ${o.first.v}（${o.first.d}）→ ${o.last.v}（${o.last.d}），${o.n} 次`)) : '—'),
            h('span', { className: 'mo-faint' }, '末次接触'), h('span', {}, `${P.lastContact.day} · 生存状态：${P.lastContact.survival}（${P.lastContact.note}）`)))
          : part === '诊' ? h('div', {},
            h('div', { className: 'mo-sec' }, h('b', {}, '诊断分类'), h('span', { className: 'mo-faint' }, '角色由所在问题线推出，需医生确认')),
            h('table', {}, h('thead', {}, h('tr', {}, ['分类', '诊断', '评测角色', '问题线', '首见', '确定程度历史', '复核'].map((x) => h('th', { key: x }, x)))),
              h('tbody', {}, O.diagnoses.map((x) => h('tr', { key: x.id },
                h('td', {}, h('span', { className: `mo-chip ${x.category === '主要诊断' ? 't' : x.category === '并发症' ? 'b' : ''}` }, x.category)), h('td', {}, h('b', {}, x.name)), h('td', {}, x.evalRole),
                h('td', { className: 'mo-faint' }, x.problems.map((p) => p.label).join('；')), h('td', { className: 'mo-num' }, `${x.firstSeen} ${relDay(O.anchor.day, x.firstSeen)}`),
                h('td', {}, x.certaintyHistory.map((c) => `${c.from} ${c.certainty}`).join(' → ')), h('td', {}, reviewChip(x.review)))))),
            h('div', { className: 'mo-sec' }, h('b', {}, '疾病关系'), h('span', { className: 'mo-faint' }, '只收原文命名或结构从属能说明的')),
            O.relations.length ? O.relations.map((r) => h('div', { key: r.id, className: 'mo-item' }, h('b', {}, r.from), ` —${r.kind}→ `, h('b', {}, r.to), ' ', provChip(r.provenance), h('span', { className: 'mo-faint' }, r.basisText), h(Evidence, { run, O, ids: r.basis }))) : h('div', { className: 'mo-faint' }, '—'))
            : part === '治' ? h('div', {},
              h('div', { className: 'mo-sec' }, h('b', {}, '按问题线统计的诊疗决策'), h('span', { className: 'mo-faint' }, '点击看决策闭环')),
              h('div', { className: 'mo-bars' }, Object.entries(byLine).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('div', { key: k }, h('span', {}, k), h('i', { style: { width: `${n / maxN * 100}%` } }), h('b', { className: 'mo-num' }, n)))),
              h('div', { className: 'mo-sec' }, h('b', {}, '全部决策')),
              h('table', {}, h('tbody', {}, O.decisions.map((d) => h('tr', { key: d.id, className: 'click', onClick: () => openDecision(d.id) },
                h('td', { className: 'mo-num' }, `${d.decidedAt} ${relDay(O.anchor.day, d.decidedAt)}`), h('td', {}, d.problemName), h('td', { style: { color: KIND_COLOR[d.pointKind] } }, d.pointKind), h('td', {}, d.actions.map(actText).join('；')),
                h('td', {}, d.outcomes.d0_90?.observed ? d.outcomes.d0_90.indicators.map((i) => `${i.concept}${i.direction}`).join('、') : '—'))))))
              : part === '伴' ? h('div', {},
                h('div', { className: 'mo-sec' }, h('b', {}, '伴发事件'), h('span', { className: 'mo-cap' }, 'NEXT')),
                h('div', { className: 'mo-muted', style: { lineHeight: 1.8 } }, '治疗开始后发生、改变原定治疗的事件（新发疾病、不良事件、合并症加重、药品短缺、自行停药、要求转院），以及它对主线的影响（不受影响／暂停后恢复／减量或降级／提前换线／中止）。', h('br'), '这是因果判断：需要模型给出并引用提及编号、通过原文核对，再经医生确认才能算数。本版只交付规则能做的部分，这里暂为空。'),
                h('div', { className: 'mo-sec' }, h('b', {}, '可作线索：同一住院／同一天，多条线同时有决策')),
                coOccur(O).map((g, i) => h('div', { key: i, className: 'mo-item' }, h('b', { className: 'mo-num' }, g.day), ' ', g.items.map((d) => h('span', { key: d.id, className: 'mo-ev', style: { marginRight: 10 }, onClick: () => openDecision(d.id) }, `${d.problemName}：${d.actions.map(actText).join('、')}`)))))
                : h('div', {},
                  h('div', { className: 'mo-sec' }, h('b', {}, '结局归因（候选）'), provChip('结构推出'), h('span', { className: 'mo-faint' }, '份额与可分离性待模型＋医生')),
                  h('table', {}, h('thead', {}, h('tr', {}, ['决策', '窗口', '观察到的结局', '归因干预', '份额', '混杂候选', '复核'].map((x) => h('th', { key: x }, x)))),
                    h('tbody', {}, O.attributions.map((a) => { const d = O.decisions.find((x) => x.id === a.decision); return h('tr', { key: a.id, className: 'click', onClick: () => openDecision(a.decision) },
                      h('td', { className: 'mo-num' }, d?.decidedAt), h('td', {}, { d0_90: '0–90', d91_180: '91–180', d180_plus: '180+' }[a.window]), h('td', {}, a.outcome), h('td', {}, a.shares[0].intervention),
                      h('td', { className: 'mo-faint' }, a.shares[0].share ?? '待判'), h('td', {}, a.confounders.length ? a.confounders.map((c) => h('div', { key: c.decision, style: { fontSize: 11 } }, c.text)) : h('span', { className: 'mo-faint' }, '同期其他线无治疗改变')), h('td', {}, reviewChip(a.review))) })))))
    }
    function coOccur(O) {
      const g = new Map()
      for (const d of O.decisions) { const k = d.encounterKind === '住院' && d.encounter ? d.encounter : d.decidedAt; if (!g.has(k)) g.set(k, []); g.get(k).push(d) }
      return [...g.values()].filter((xs) => new Set(xs.map((d) => d.problem)).size > 1).map((xs) => ({ day: xs[0].decidedAt, items: xs }))
    }

    /* ---------------------------------------------------------------- review */
    function reviewQueue(O) {
      const items = []
      for (const d of O.decisions) if (!d.formal || d.certainty === '需人工确认') items.push({ id: d.id, kind: '决策节点', title: `${d.decidedAt} ${d.actions.map(actText).join('；')}`, why: d.notFormalReasons.join('、') || '需人工确认', review: d.review, decision: d.id, basis: d.basis })
      for (const x of O.diagnoses) items.push({ id: x.id, kind: '诊断角色', title: `${x.name} → ${x.category}（${x.evalRole}）`, why: `规则：${x.rule}`, review: x.review, basis: x.basis })
      for (const r of O.relations) items.push({ id: r.id, kind: '疾病关系', title: `${r.from} —${r.kind}→ ${r.to}`, why: r.basisText, review: r.review, basis: r.basis })
      for (const a of O.attributions) items.push({ id: a.id, kind: '归因候选', title: `${a.outcome}`, why: `混杂候选 ${a.confounders.length} 条；份额待判`, review: a.review, decision: a.decision, basis: a.basis })
      return items
    }
    function Review({ run, O, reload, openDecision }) {
      const [onlyOpen, setOnlyOpen] = useState(true)
      const [busy, setBusy] = useState('')
      const all = reviewQueue(O)
      const list = all.filter((x) => !onlyOpen || (x.review?.status ?? '未复核') === '未复核')
      const decide = async (id, status, clear) => { setBusy(id); try { await call('decide', { runId: run.id, id, status, clear }); reload() } catch (e) { alert(msg(e)) } finally { setBusy('') } }
      return h('div', { className: 'mo-frame mo-scroll mo-pad', style: { flex: 1 } },
        h('div', { className: 'mo-h' }, h('b', {}, '医生复核'), h('span', { className: 'mo-cap' }, 'REVIEW'),
          h('span', { className: 'mo-muted' }, `${all.filter((x) => (x.review?.status ?? '未复核') !== '未复核').length}/${all.length} 已处理`), h('span', { className: 'mo-sp' }),
          h('label', {}, h('input', { type: 'checkbox', checked: onlyOpen, onChange: (e) => setOnlyOpen(e.target.checked) }), ' 只看未复核')),
        h('div', { className: 'mo-faint', style: { marginBottom: 8 } }, '裁定按稳定编号写入 _records/review.json，下次重跑沿用；不改事件包。没有医生确认的因果边、归因不能当事实用。'),
        list.length ? h('table', {}, h('thead', {}, h('tr', {}, ['类型', '内容', '为什么要复核', '状态', '操作'].map((x) => h('th', { key: x }, x)))),
          h('tbody', {}, list.map((x) => h('tr', { key: x.id },
            h('td', {}, h('span', { className: 'mo-chip' }, x.kind)),
            h('td', {}, x.decision ? h('span', { className: 'mo-ev', onClick: () => openDecision(x.decision) }, x.title) : x.title, h(Evidence, { run, O, ids: x.basis })),
            h('td', { className: 'mo-faint' }, x.why), h('td', {}, reviewChip(x.review)),
            h('td', { style: { whiteSpace: 'nowrap' } },
              h('button', { className: 'mo-btn sm', disabled: busy === x.id, onClick: () => decide(x.id, '已确认') }, '确认'), ' ',
              h('button', { className: 'mo-btn sm', disabled: busy === x.id, onClick: () => decide(x.id, '驳回') }, '驳回'), ' ',
              x.review?.status && x.review.status !== '未复核' ? h('button', { className: 'mo-btn sm', disabled: busy === x.id, onClick: () => decide(x.id, null, true) }, '撤销') : null)))))
          : h('div', { className: 'mo-empty' }, '没有待复核的条目'))
    }

    /* ----------------------------------------------------------------- rules */
    function Rules({ run }) {
      const d = useAsync(() => call('rulepack', { specialty: run.specialty }), [run.specialty])
      if (!d.value) return h('div', { className: 'mo-frame mo-empty', style: { flex: 1 } }, d.error ?? '加载中…')
      const S = d.value.specialty; const G = d.value.general
      return h('div', { className: 'mo-frame mo-scroll mo-pad', style: { flex: 1 } },
        h('div', { className: 'mo-h' }, h('b', {}, '规则包'), h('span', { className: 'mo-cap' }, 'RULEPACKS'), d.value.layers.map((l) => h('span', { key: l.id, className: 'mo-chip t' }, `${l.layer}/${l.id} ${l.version}`))),
        h('div', { className: 'mo-sec' }, h('b', {}, `病种层：${S.label}`), h('span', { className: 'mo-faint' }, `主线 ${S.mainProblems.join('、')} · D+0：${S.anchor.basis}`)),
        h('table', {}, h('thead', {}, h('tr', {}, ['编号', '问题', '类型', '父问题', '挂接的概念', '结局指标'].map((x) => h('th', { key: x }, x)))),
          h('tbody', {}, S.problems.map((p) => h('tr', { key: p.code }, h('td', { className: 'mo-num' }, p.code), h('td', {}, h('b', {}, p.name)), h('td', {}, p.kind), h('td', { className: 'mo-faint' }, p.parent ? `${p.parent}（${p.parentBasis}）` : ''),
            h('td', { style: { fontSize: 11 } }, Object.entries(p.concepts).map(([g, cs]) => h('div', { key: g }, h('span', { className: 'mo-faint' }, `${g}：`), cs.join('、')))), h('td', {}, (p.targets ?? []).join('、')))))),
        h('div', { className: 'mo-sec' }, h('b', {}, '通用层：决策节点来源判定（工序6）')),
        h('table', {}, h('tbody', {}, G.sources.map((s, i) => h('tr', { key: i }, h('td', {}, s.recordType), h('td', {}, s.section), h('td', {}, h('b', {}, s.role)))))),
        h('div', { className: 'mo-sec' }, h('b', {}, '参数')),
        h('div', { className: 'mo-kv' }, Object.entries(G.params).flatMap(([k, v]) => [h('span', { key: `k${k}`, className: 'mo-faint mo-num' }, k), h('span', { key: `v${k}` }, String(v))])),
        h('div', { className: 'mo-sec' }, h('b', {}, '写法')),
        h('div', { className: 'mo-kv' }, Object.entries(G.patterns).flatMap(([k, v]) => [h('span', { key: `k${k}`, className: 'mo-faint mo-num' }, k), h('span', { key: `v${k}`, className: 'mo-num', style: { fontSize: 11 } }, v)])))
    }

    function Report({ run }) {
      const d = useAsync(() => call('report', { runId: run.id }), [run.id, run.status])
      return h('div', { className: 'mo-frame mo-scroll mo-pad', style: { flex: 1 } },
        d.value ? h(React.Fragment, {}, h('div', { className: 'mo-faint', style: { marginBottom: 8 } }, d.value.path), h('div', { className: 'mo-md' }, d.value.markdown)) : h('div', { className: 'mo-faint' }, d.error ?? '加载中…'))
    }

    /* ----------------------------------------------------------------- plugin */
    const plugin = {
      inject: ['slots'],
      apply(ctx) {
        services.ctx = ctx
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Page))
        let disposeEntry = null
        const setSidebar = (visible) => {
          if (visible && !disposeEntry) disposeEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 32, label: () => '临床本体构建' }, Icon))
          else if (!visible && disposeEntry) { disposeEntry(); disposeEntry = null }
        }
        setSidebar(true)
        let stopped = false
        ;(async () => {
          for (let i = 0; i < 10 && !stopped; i++) {
            try { const c = await call('config'); if (!stopped) setSidebar(c.showSidebarEntry !== false); return } catch { await new Promise((r) => setTimeout(r, 1000)) }
          }
        })()
        ctx.effect?.(() => () => { stopped = true; setSidebar(false) })
      },
    }
    return plugin
  },
})
