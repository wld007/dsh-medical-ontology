/**
 * 虚构的血透病人（区域平台导出格式，按月分文件）。内容全部编造，只用来生成
 * 演示与测试用的事件包：多年门诊随访、几次住院、换抗凝药、感染、骨折、拒绝住院。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const ts = (s) => String(Date.parse(`${s.replace(' ', 'T')}:00+08:00`))
const ym = (s) => s.slice(0, 7).replace('-', '')
const cn = (s) => s.replace(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/, '$1年$2月$3日$4时$5分')

export function demoTables() {
  let seq = 0
  const key = (p) => `${p}-${String(++seq).padStart(6, '0')}`
  const files = {}
  const put = (dir, t, file, rows) => { const p = `${dir}/${ym(t)}/${file}`; files[p] = [...(files[p] ?? []), ...rows] }

  put('人口信息学/病史', '1900-01-01', 'p_doc_dwd_psn_rcd.json', [{ PRM_KEY: key('病历'), BTH_DT: '19560312', GDR_NM: '女性' }])

  const visit = (no, t, fields) => put('就诊/就诊记录', t, 'p_doc_fact_vst_infmt.json', [{ PRM_KEY: key('病历'), VST_DT: ts(t), MDC_ORG_NM: '医院-000009', ...fields }])
  const lab = (t, item, v, unit, ref, enc = {}) => put('检验/检验记录', t, 'p_doc_fact_test_rcd.json', [{ PRM_KEY: key('检验'), TEST_DT: ts(t), ADT_TM: ts(t), CRT_TM: ts(t), TEST_CHD_ITM_NM: item, TEST_RSLT_VLU: v, TEST_RSLT_VLU_UNT: unit, RFRC_VLU: ref, ...enc }])
  const diag = (t, name, tp, enc = {}) => put('诊断/诊断记录', t, 'p_doc_fact_diag_infmt.json', [{ PRM_KEY: key('诊断'), DIAG_DT: ts(t), CRT_TM: ts(t), DIAG_DSCPT: name, VST_TP: tp, ...enc }])

  // ── 门诊：每次一份门诊病历＋就诊登记＋若干检验与诊断
  const OPD = (no, t, { hpi, plan, exam = '神清，双肺呼吸音清，双下肢无水肿。', labs = [], dx = [] }) => {
    visit(no, t, { VST_TP: '1', VST_DT_TM: ts(t), OTPT_EMG_NO: `就诊-${no}`, VST_DPT_NM: '肾病内科' })
    put('病历记录/门急诊病历', t, 'p_doc_fact_otpt_emg_mdc_htr_rcd.json', [{ PRM_KEY: key('病历'), OTPT_EMG_NO: `就诊-${no}`, CRT_TM: ts(t), INVLD_FLG: '0', CHF_COMPLNT: '规律血透，复诊', PRST_ILLNS_HST: hpi, PSQ_EXAM: exam, HDL_SGST: plan }])
    const day = t.slice(0, 10)
    for (const [item, v, unit, ref] of labs) lab(`${day} 07:30`, item, v, unit, ref, { OTPT_EMG_NO: `就诊-${no}` })
    for (const name of ['慢性肾脏病5期', ...dx]) diag(t, name, '1', { OTPT_EMG_NO: `就诊-${no}` })
  }

  // ── 住院：就诊登记＋入院记录＋出院记录＋诊断
  const ADM = (no, admit, discharge, dept, { chief, hpi, past = '有“高血压病”史10年余。否认“糖尿病”史。', aux = '', dx, course, labs = [], surgery = null }) => {
    visit(no, admit, { VST_TP: '2', ADMN_DT_TM: ts(admit), DSCG_DT_TM: ts(discharge), INHOS_NO: `住院-${no}`, ADMN_DPT_NM: dept })
    const rec = `${admit.slice(0, 10)} ${String(Number(admit.slice(11, 13)) + 3).padStart(2, '0')}:20`
    const text = ['', '入院记录', '姓    名:化名-000001      性     别:女', `入院时间 :${cn(admit)}`, `病史陈述者:患者本人      记录时间 :${cn(rec)}`,
      `主  诉：${chief}`, `现病史：${hpi}`, `既往史：${past}`, '个人史：生于地址-000002，久居本地。否认烟酒嗜好。', '家族史：无殊。',
      '', '体格检查', '一般情况:  意识清醒,脉搏84次/分,呼吸19次/分,血压148/86mmHg,体温36.7℃', '', '辅助检查', aux, '初步诊断:', ...dx.map((d) => `  ${d}`), '医生签名：医生-000003', `          ${rec.slice(0, 10)}`, ''].join('\n')
    put('病历记录/住院病历', admit, 'p_doc_fact_admn_mdc_htr_rcd.json', [{ PRM_KEY: key('病历'), INHOS_NO: `住院-${no}`, ADMN_DT_TM: ts(admit), DSCG_DT_TM: ts(discharge), RCD_DT_TM: ts(rec), CRT_TM: ts(rec), CHF_COMPLNT: chief, PST_ILLNS_HST: text }])
    put('病历记录/出院记录', discharge, 'p_doc_fact_dscg_rcd.json', [{ PRM_KEY: key('病历'), INHOS_NO: `住院-${no}`, CRT_TM: ts(discharge), ADMN_CDT: `此次因“${chief.replace(/。$/, '')}”入院。`, DSCG_CDT: course }])
    for (const [t, item, v, unit, ref] of labs) lab(t, item, v, unit, ref, { INHOS_NO: `住院-${no}` })
    for (const name of dx) diag(admit, name.replace(/^\d+[.、]/, ''), '2', { INHOS_NO: `住院-${no}` })
    if (surgery) put('手术/手术记录', surgery.t, 'p_doc_fact_oprt_rcd.json', [{ PRM_KEY: key('手术'), INHOS_NO: `住院-${no}`, OPRT_DT_TM: ts(surgery.t), OPRT_STRT_DT_TM: ts(surgery.t), CRT_TM: ts(surgery.t), OPRT_NM: surgery.name, OPRT_DPT_NM: dept }])
  }

  const HB = (v, f = '') => ['血红蛋白', v, 'g/L', '115-150']
  const K = (v) => ['钾', v, 'mmol/L', '3.5-5.3']
  const P = (v) => ['磷', v, 'mmol/L', '0.85-1.51']
  const PTH = (v) => ['甲状旁腺激素', v, 'pg/mL', '15-65']
  const INR = (v) => ['国际标准化比值', v, '', '0.8-1.2']

  // 2019：初次住院，开始血透
  ADM('A', '2019-03-08 10:00', '2019-03-20 09:00', '肾脏内科', {
    chief: '乏力纳差1月，气急2天。',
    hpi: '患者1月前出现乏力、纳差，未予重视。2天前出现气急，夜间不能平卧，今至我院急诊，查肌酐 986μmol/L，血钾 5.9mmol/L，拟“慢性肾脏病5期”收治入院。',
    aux: '（2019-03-08本院）血红蛋白 76g/L，肌酐 986μmol/L',
    dx: ['1.慢性肾脏病5期', '2.肾性贫血', '3.高血压病'],
    course: '入院后行右颈内静脉临时置管，予血液透析治疗，并予促红素纠正贫血。患者气急好转，予出院。',
    labs: [['2019-03-08 08:00', '血红蛋白', '76', 'g/L', '115-150'], ['2019-03-08 08:00', '肌酐', '986', 'μmol/L', '45-84'], ['2019-03-08 08:00', '钾', '5.9', 'mmol/L', '3.5-5.3']],
  })
  OPD('O01', '2019-04-12 09:00', { hpi: '规律血透中，一周三次。乏力较前好转。', plan: '1、低盐低磷饮食\n2、继续规律血液透析\n3、不适随诊', labs: [HB('84'), K('4.9'), P('1.92'), PTH('312')], dx: ['肾性贫血'] })
  OPD('O02', '2019-06-14 09:00', { hpi: '规律血透中。近来活动后乏力。', plan: '1、加用琥珀酸亚铁0.1g tid\n2、两周后复查血常规\n3、不适随诊', labs: [HB('81'), ['铁蛋白', '85', 'ng/mL', '30-400'], K('5.0')], dx: ['肾性贫血'] })
  OPD('O03', '2019-09-20 09:00', { hpi: '规律血透中，无殊不适。', plan: '1、加用骨化三醇0.25ug qd\n2、加用司维拉姆0.8g tid\n3、一月后复查甲状旁腺激素', labs: [HB('96'), P('2.31'), PTH('688')], dx: ['继发性甲状旁腺功能亢进'] })
  OPD('O04', '2019-12-13 09:00', { hpi: '规律血透中，口服骨化三醇、司维拉姆。', plan: '1、低磷饮食\n2、不适随诊', labs: [HB('104'), P('1.86'), PTH('702')], dx: ['继发性甲状旁腺功能亢进'] })
  OPD('O05', '2020-02-21 09:00', { hpi: '规律血透中，皮肤瘙痒。', plan: '1、加用西那卡塞25mg qd\n2、一月后复查甲状旁腺激素', labs: [P('1.78'), PTH('846')], dx: ['继发性甲状旁腺功能亢进'] })
  OPD('O06', '2020-06-05 09:00', { hpi: '规律血透中。近1周心悸，心电图示心房颤动。', plan: '1、予华法林2.5mg qd抗凝\n2、一周后复查INR\n3、心内科随诊', labs: [INR('1.1'), HB('108'), PTH('402')], dx: ['心房颤动'] })
  OPD('O07', '2020-08-14 09:00', { hpi: '规律血透中，口服华法林2.5mg qd，牙龈出血3天。', plan: '1、暂停华法林\n2、2天后复查INR', labs: [INR('4.1')], dx: ['心房颤动'] })
  OPD('O08', '2020-09-11 09:00', { hpi: '规律血透中。停华法林后牙龈出血好转。', plan: '1、改用利伐沙班10mg qd\n2、不适随诊', labs: [INR('1.3'), HB('110')], dx: ['心房颤动'] })
  // 2021：肺部感染住院
  ADM('B', '2021-03-02 11:00', '2021-03-12 09:00', '呼吸内科', {
    chief: '发热、咳嗽咳痰3天。',
    hpi: '患者3天前受凉后出现发热，体温最高38.9℃，伴咳嗽咳痰，今至我院门诊，查白细胞计数 13.6×10^9/L，拟“肺部感染”收住入院。',
    aux: '（2021-03-02本院）胸部CT：右下肺炎症。',
    dx: ['1.肺部感染', '2.慢性肾脏病5期', '3.心房颤动'],
    course: '住院期间予莫西沙星抗感染治疗，患者体温平稳，咳嗽好转，予出院。',
    labs: [['2021-03-02 12:00', '白细胞计数', '13.6', '10^9/L', '3.5-9.5'], ['2021-03-02 12:00', 'C反应蛋白', '68', 'mg/L', '0-10'], ['2021-03-09 08:00', 'C反应蛋白', '9', 'mg/L', '0-10']],
  })
  OPD('O09', '2021-04-16 09:00', { hpi: '规律血透中，肺部感染出院后无发热。', plan: '1、继续利伐沙班10mg qd\n2、不适随诊', labs: [HB('112'), K('4.8')], dx: ['心房颤动'] })
  OPD('O10', '2021-06-18 09:00', { hpi: '规律血透中，近期透析中反复低血压，头晕。', plan: '1、停用硝苯地平\n2、下调干体重0.5kg\n3、两周后复诊', labs: [HB('113'), K('4.6')], dx: ['透析低血压'] })
  OPD('O11', '2021-10-22 09:00', { hpi: '规律血透中，透析中血压平稳。', plan: '1、低盐低磷饮食\n2、不适随诊', labs: [HB('118'), P('1.62'), PTH('256')], dx: ['继发性甲状旁腺功能亢进'] })
  // 2022：跌倒骨折
  ADM('C', '2022-02-15 15:00', '2022-02-26 09:00', '骨科', {
    chief: '跌倒致左肩部疼痛活动受限2小时。',
    hpi: '患者2小时前不慎跌倒，左肩着地，即感左肩部疼痛、活动受限，至我院急诊，摄片示左肱骨近端骨折，拟“左肱骨近端骨折”收住入院。',
    dx: ['1.左肱骨近端骨折', '2.慢性肾脏病5期'],
    course: '入院后完善检查，于2022-02-17行左肱骨骨折切开复位内固定术，术后恢复可，予出院。',
    surgery: { t: '2022-02-17 09:30', name: '肱骨骨折切开复位内固定术' },
  })
  OPD('O12', '2022-03-25 09:00', { hpi: '规律血透中，骨折术后复诊，伤口愈合可。', plan: '1、骨科随诊\n2、不适随诊', labs: [HB('105')], dx: ['左肱骨近端骨折'] })
  OPD('O13', '2022-10-14 09:00', { hpi: '规律血透中，内瘘口红肿伴发热1天。', exam: '左前臂内瘘口红肿，触痛，震颤可。', plan: '1、予头孢地尼0.1g tid口服\n2、建议住院治疗，患者拒绝\n3、三天后复诊', labs: [['白细胞计数', '11.2', '10^9/L', '3.5-9.5'], ['C反应蛋白', '42', 'mg/L', '0-10']], dx: ['人工血管感染'] })
  OPD('O14', '2022-10-21 09:00', { hpi: '规律血透中，内瘘口红肿较前好转，无发热。', plan: '1、继续头孢地尼0.1g tid口服3天\n2、不适随诊', labs: [['C反应蛋白', '11', 'mg/L', '0-10']], dx: ['人工血管感染'] })
  // 2023：急性心衰
  ADM('D', '2023-05-06 20:00', '2023-05-15 09:00', '肾脏内科', {
    chief: '胸闷气急加重2天。',
    hpi: '患者规律血透中，2天前透析间期体重增加明显，出现胸闷气急，不能平卧，至我院急诊，查BNP 4820pg/mL，拟“急性心力衰竭”收住入院。',
    dx: ['1.急性心力衰竭', '2.慢性肾脏病5期', '3.心房颤动'],
    course: '住院期间予加强超滤，下调干体重，患者胸闷气急好转，予出院。',
    labs: [['2023-05-06 21:00', 'B型钠尿肽', '4820', 'pg/mL', '0-100'], ['2023-05-13 08:00', 'B型钠尿肽', '960', 'pg/mL', '0-100']],
  })
  OPD('O15', '2023-06-16 09:00', { hpi: '规律血透中，无胸闷气急。', plan: '1、控制透析间期体重增长\n2、不适随诊', labs: [HB('121'), ['B型钠尿肽', '820', 'pg/mL', '0-100']], dx: ['心力衰竭'] })
  OPD('O16', '2024-01-19 09:00', { hpi: '规律血透中，无殊不适。', plan: '1、停用琥珀酸亚铁\n2、三月后复查血常规', labs: [HB('128'), ['铁蛋白', '420', 'ng/mL', '30-400'], PTH('188')], dx: ['肾性贫血'] })
  OPD('O17', '2024-05-17 09:00', { hpi: '规律血透中，无殊不适。', plan: '1、低盐低磷饮食\n2、不适随诊', labs: [HB('124'), K('5.1'), P('1.55')], dx: ['肾性贫血'] })
  return files
}

export async function writeDemoRaw(dir) {
  const files = demoTables()
  for (const [rel, rows] of Object.entries(files)) {
    const p = join(dir, rel)
    await mkdir(join(p, '..'), { recursive: true })
    await writeFile(p, JSON.stringify(rows))
  }
  return dir
}
