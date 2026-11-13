// RTC Logistique — JS port of `$env:TEMP\spF.py` + `$env:TEMP\mkF.py::lines_for` (spec §8).
// Python named groups (?P<x>…) → JS (?<x>…); finditer → matchAll; defaultdict → Map.
// Against the current `2025` sheet: 508 exact / 150,356.00, unparseable 4 / 860.00,
// no-fit 1 / 60.00, 0 `solde non expliqué` lines.
//
// Catch-all rules were later refined to cut review noise (see `RULES`):
//   · `GASOIL` (the sheet's spelling) classifies as gasoil — previously only the
//     misspelling `GAZOIL` matched, so itemized gasoil lines fell through to Divers.
//   · `DEPANNAGE|REMORQUAGE` classifies as reparation (previously only `AUTOROUTE`
//     inside the label matched, booking it to Auto route).
//   · BAGAGE is tested before PROCES, so "…(TACHYGRAPHE ENPANNE) - FRAIS DE BAGAGE"
//     books as bagage instead of Procès.

export const EXPENSE_COLUMNS = ['Auto route', 'Hotel', 'frais de route', 'Gardinnage', 'Divers', 'Procès', 'GASOIL', 'DÉPLACEMENT COMPLEMENTAIRE']
export const FIXED_COLUMNS = ['Auto route', 'Hotel', 'frais de route', 'Gardinnage', 'Procès', 'GASOIL']
export const CATCH_ALL = ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE']

export const fold = (x) =>
  (x || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')

export function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  let t = String(v).replace(/\u202f/g, '').replace(/\u00a0/g, '').replace(/ /g, '')
  if (t === '' || t === '-') return 0
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.')
  const n = parseFloat(t)
  return Number.isNaN(n) ? 0 : n
}

const PAT = /(?<bare>(?:=|:)\s*(?<n1>[0-9][0-9 .\u202f\u00a0,]*?)\s*(?:D{1,2}H\b|D\.H\.?|(?=\s*(?:\)|\(|-|\/|,|$)))|(?<dh>(?<![0-9])(?<n2>[0-9][0-9 .\u202f\u00a0,]*?)\s*(?:D{1,2}H\b|D\.H\.?)))/gi

export function parseObservation(o) {
  const out = []
  let pos = 0
  for (const m of o.matchAll(PAT)) {
    if (m.index < pos) continue
    const raw = m.groups.n1 ?? m.groups.n2
    let lab = o.slice(pos, m.index)
    pos = m.index + m[0].length
    lab = lab.replace(/^\s*[-+/,]\s*|\s*[-+/,]\s*$/, ' ')
    lab = lab.replace(/\s*[:=]\s*$/, '').trim().replace(/^=+/, '').trim()
    let t = raw.replace(/\u202f/g, '').replace(/\u00a0/g, '').replace(/ /g, '')
    if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.')
    const v = parseFloat(t)
    if (!Number.isNaN(v) && v > 0 && lab) out.push([lab.replace(/\s+/g, ' '), v])
  }
  return out
}

export function labelOf(o) {
  let t = o.replace(PAT, ' ')
  t = t.replace(/[=:]/g, ' ')
  t = t.replace(/\s*[-+/]\s*(?=FRAIS|PROCE|NB\b|TAXI|REPAS|PESAGE|CHARGE|DEGAG|EVACU|LAVAGE|ACHAT|GARIN)/gi, ' | ')
  return t.split('|')
    .map((x) => x.replace(/\s+/g, ' ').trim().replace(/^[\s\-—/:()]+|[\s\-—/:()]+$/g, ''))
    .filter((x) => /[A-Za-z]{3,}/.test(x))
}

const RULES = [
  [/TRANSPORT\s+PAR\s+(?:CTM|TARIN|AUTO-?CAR|CAR)|AUTOCAR/, 'autocar'],
  [/TRANSPORT\s+PAR\s+(?:TRAIN|TGV)|\bTGV\b|\bTRAIN\b/, 'train'],
  [/TAXI/, 'taxi'],
  [/DEGAGEMENT|DEBARRASSAGE|DEBARRAGE|EVACUATION|ORDURE|DECHET|GRAVAT|DEBLAI/, 'evacuation_dechets'],
  [/CHARGEMENT.*CIMENT|CHARGE.*CIMENT/, 'chargement_ciment'],
  [/PESAGE|PEUSAGE|PESSAGE/, 'pesage'],
  [/CREVAISON|CREVAISION|CREUVAISON|CHANGE PNEUS/, 'crevaison'],
  [/BAGAGE/, 'bagage'],
  [/PROCES|PROCE\b|TACHYGRAPHE|HORS GABARIT|AMENDE/, 'proce'],
  [/EXTINCTEUR|EXTEINCTEUR/, 'extincteur'],
  [/PNEU|EQUIL.?BRAGE/, 'pneus'],
  [/DOUANE|DEOUANE/, 'douane'],
  [/LAVAGE|NETTOY/, 'lavage'],
  [/REPARATION|SOUDURE|SONDURE|DEPANNAGE|REMORQUAGE/, 'reparation'],
  [/ACHAT|FOURNITURE|IMPRIM|RECEPTION COLIS/, 'achat'],
  [/ENVOI|POSTAL|COURRIER/, 'postal'],
  [/PARKING|STATIONN/, 'parking'],
  [/MAIN D.OEUVRE|CHARGE ARGANE/, 'main_oeuvre'],
  [/HOTEL|HEBERG/, 'hotel'],
  [/REPAS|DEJEUNER|DINER/, 'repas'],
  [/GARDI?ENN?AGE/, 'gardinnage'],
  [/AUTO\s*ROUTE|P(?:E|É)AGE/, 'auto_route'],
  [/ESSENCE|GAZOIL|GASOIL|CARBURANT/, 'gasoil'],
  [/ROUTE|ITINERAIRE/, 'frais_de_route'],
  [/TRANSPORT/, 'transport_personnes'],
  [/IMMATRICUL|PLAQUE\s+LIMITE/, 'achat'],
  [/CLE\s+CONTACT/, 'achat'],
  [/CHARIOT\s+AEROPORT/, 'divers'],
  [/LEGALISATION|COURSES|BON POUR TRAVAUX|VISITE/, 'frais_admin'],
]

const DESC_RULES = [
  [/CIMENT/, /CHARGEMENT|CHARGE\b/, 'chargement_ciment'],
  [/GRAVAT|GRAVAS|POUBELLE|ORDURE|DECHET|DEBLAI/, /DEGAGEMENT|EVACUATION|CHARG/, 'evacuation_dechets'],
  [/\bTRAIN\b|\bTGV\b/, /TRANSPORT/, 'train'],
  [/\bCTM\b|\bCAR\b|AUTOCAR/, /TRANSPORT/, 'autocar'],
]

// Description-only fallback, used when a row's Observation carries no itemization
// at all (empty, or nothing parseable/classifiable). The Description often names the
// cargo ("TRANSPORT CIMENT LA FARGE"). Keep this list short and unambiguous: a match
// books the whole catch column to the category instead of flagging it `unparseable`.
const DESC_ONLY = [
  [/CIMENT/, 'chargement_ciment'],
]

export function classifyDesc(desc) {
  const d = fold(desc).toUpperCase()
  for (const [p, c] of DESC_ONLY) if (p.test(d)) return c
  return null
}

export function classify(lab, om, gendOms, desc = '') {
  const u = fold(lab).toUpperCase().replace(/'/g, '')
  if (gendOms.has(om) && /GENDARM|MOTO\s+D?\'?E?S?C?O?R?T?/.test(u)) return 'escorte_gendarmerie'
  if (/^FRAIS\s+DE\s+REPAS/.test(u)) return 'repas'
  if (/^FRAIS\s+D[' ]ESSENCE/.test(u)) return 'gasoil'
  for (const [p, c] of RULES) if (p.test(u)) return c
  const d = fold(desc).toUpperCase()
  if (d) for (const [dp, lp, c] of DESC_RULES) if (dp.test(d) && lp.test(u)) return c
  return 'divers_inconnu'
}

const CAND = {
  proce: ['Procès'], hotel: ['Hotel'], gasoil: ['GASOIL'], frais_de_route: ['frais de route'],
  auto_route: ['Auto route'], gardinnage: ['Gardinnage'],
  autocar: ['DÉPLACEMENT COMPLEMENTAIRE', 'Divers'],
  train: ['DÉPLACEMENT COMPLEMENTAIRE', 'Divers'],
  taxi: ['DÉPLACEMENT COMPLEMENTAIRE', 'Divers', 'Auto route'],
  repas: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'], crevaison: ['Divers'], lavage: ['Divers'],
  achat: ['Divers'], reparation: ['Divers'], postal: ['Divers'], parking: ['Divers'],
  pesage: ['Divers', 'frais de route'], evacuation_dechets: ['Divers'], chargement_ciment: ['Divers'],
  extincteur: ['Divers'], pneus: ['Divers'], bagage: ['Divers'], douane: ['Divers'],
  main_oeuvre: ['Divers'], frais_admin: ['Divers'],
  transport_personnes: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'],
  escorte_gendarmerie: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE', 'frais de route', 'GASOIL', 'Auto route'],
  divers: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'],
  divers_inconnu: ['Divers', 'DÉPLACEMENT COMPLEMENTAIRE'],
}

const round2 = (n) => Math.round(n * 100) / 100

function record(r, col, booked, parsed, status, cats, obs, desc, rowIndex) {
  return { om: r.OM, date: toIso10(r['Date depart']), col, booked, parsed, status, cats, detail: '', obs: obs.trim().replace(/\n/g, ' '), desc, rowIndex }
}

export function buildCatchAllRecords(rows) {
  const gendOms = new Set(
    rows.filter((r) => r.Observation && /GENDARM/i.test(String(r.Observation))).map((r) => r.OM)
  )
  const records = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const r = rows[rowIndex]
    const o = String(r.Observation || '')
    const d = String(r.Description || '')
    const items = parseObservation(o)
    const booked = Object.fromEntries(EXPENSE_COLUMNS.map((c) => [c, toNumber(r[c])]))
    const have = CATCH_ALL.filter((c) => booked[c] > 0)
    if (!have.length) continue

    let src = []
    if (items.length) src = items.map(([l, v]) => [l, v, classify(l, r.OM, gendOms, d)])
    else {
      outer: for (const c of have) {
        for (const L of o ? labelOf(o) : []) {
          const k = classify(L, r.OM, gendOms, d)
          if (k !== 'divers_inconnu') { src.push([L, booked[c], k]); break outer }
        }
      }
    }

    // Last resort: no itemized observation to work from, so let the Description name
    // the cargo ("TRANSPORT CIMENT LA FARGE" → chargement ciment). Without this the
    // whole catch column is flagged `unparseable`.
    if (!src.length && d) {
      const k = classifyDesc(d)
      if (k) src.push([d.replace(/\s+/g, ' ').trim(), booked[have[0]], k])
    }

    if (!src.length) {
      for (const c of have) records.push(record(r, c, booked[c], 0, 'unparseable', {}, o, d, rowIndex))
      continue
    }

    const cols = EXPENSE_COLUMNS.filter((c) => booked[c] > 0)
    const fb = CATCH_ALL.filter((c) => cols.includes(c))
    const cand = src.map(([, , k]) => {
      const pc = (CAND[k] || ['Divers']).filter((x) => cols.includes(x))
      return pc.length ? pc : (fb.length ? fb : ['Divers'])
    })
    const res = new Array(src.length).fill(null)
    const bt = (i, s) => {
      if (i === src.length) return true
      for (const c of cand[i]) {
        if (s[c] + src[i][1] <= booked[c] + 0.01) {
          s[c] += src[i][1]; res[i] = c
          if (bt(i + 1, s)) return true
          s[c] -= src[i][1]; res[i] = null
        }
      }
      return false
    }
    const s0 = Object.fromEntries(EXPENSE_COLUMNS.map((c) => [c, 0]))
    if (!bt(0, s0)) {
      for (const c of have) records.push(record(r, c, booked[c], 0, 'no-fit', {}, o, d, rowIndex))
      continue
    }
    for (const c of have) {
      const idx = src.map((_, i) => i).filter((i) => res[i] === c)
      const got = idx.reduce((a, i) => a + src[i][1], 0)
      const cats = {}; const det = []
      for (const i of idx) { cats[src[i][2]] = (cats[src[i][2]] || 0) + src[i][1]; det.push(`${src[i][2]}: ${src[i][0]}=${src[i][1].toFixed(2)}`) }
      const st = Math.abs(got - booked[c]) < 0.01 ? 'exact' : got === 0 ? 'empty' : got < booked[c] ? 'solde' : 'over'
      const rec = record(r, c, booked[c], round2(got), st, cats, o, d, rowIndex)
      rec.detail = det.join(' | ')
      records.push(rec)
    }
  }
  return { records, gendOms }
}

// Port of mkF.py::lines_for for Option B (split everything, residual explicit).
export function linesFor(rec) {
  if (rec.status !== 'exact') return [['divers', rec.booked, '(inchangé)']]
  let out = []
  for (const d of (rec.detail || '').split(' | ')) {
    const m = d.match(/^(.*?):\s*(.*?)\s*=\s*([\d.,]+)$/)
    if (m) out.push([m[1], parseFloat(m[3].replace(',', '.')), m[2]])
  }
  if (out.some(([, a]) => a > rec.booked + 0.01)) return [['divers', rec.booked, '(inchangé)']]
  out = out.map(([c, a, l]) => [c, round2(a), l])
  const rem = round2(rec.booked - out.reduce((s, [, a]) => s + a, 0))
  if (Math.abs(rem) >= 0.005) {
    if (rem > 0) out.push(['divers', rem, 'solde non expliqué'])
    else { const [, a, l] = out[out.length - 1]; out[out.length - 1] = [out[out.length - 1][0], round2(a + rem), l] }
  }
  return out
}

function toIso10(v) {
  return v ? String(v).slice(0, 10) : null
}
