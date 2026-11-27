import type { Comp, CompDetail, Item, Lookups, LookupsUnit, Trait } from 'types'
import type { EnhancedCompData } from './utils/compRating'
import { processComps } from './utils/compRating'
import { countCompTraits } from './utils/traitCounts'
import { isRadiantItem, RADIANT_FRAME } from './utils/itemAppearance'
import './kimi.css'
import './overlay.css'

type Detail = CompDetail & { builds?: { unit?: string, buildName?: string[], count?: number, avg?: number }[] }
const content = document.querySelector<HTMLElement>('#content')!
const picker = document.querySelector<HTMLButtonElement>('#comp-picker')!
const compName = document.querySelector<HTMLElement>('#comp-name')!
const compTier = document.querySelector<HTMLElement>('#comp-tier')!
const menu = document.querySelector<HTMLElement>('#comp-menu')!
const options = document.querySelector<HTMLElement>('#comp-options')!
const filters = document.querySelector<HTMLElement>('#tier-filters')!
const metrics = document.querySelector<HTMLElement>('#metrics')!
const tabs = document.querySelector<HTMLElement>('#tabs')!
let comps: EnhancedCompData[] = [], comp: EnhancedCompData, detail: Detail | null = null
let tab = 'board', tierFilter = 'all', request = 0
let units: Record<string, LookupsUnit> = {}, traits: Record<string, Trait> = {}, items: Record<string, Item> = {}
function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) {
  const element = document.createElement(tag)
  element.className = cls
  if (text !== undefined) element.textContent = text
  return element
}
async function get<T>(name: string): Promise<T> {
  const response = await fetch(new URL('./api/' + name, document.baseURI), { cache: 'no-store' })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const body = await response.json() as { success: boolean, data: T }
  if (!body.success) throw new Error('Invalid data')
  return body.data
}
function nameOf(c: Comp) {
  return (c.name ?? []).map(n => n.type === 'unit' ? units[n.name ?? '']?.name : traits[n.name ?? '']?.name).filter(Boolean).join(' · ') || 'S19 ' + c.id
}
function image(category: string, id: string, name?: string) {
  const img = node('img')
  img.loading = 'lazy'; img.alt = name || id; img.draggable = false
  img.src = new URL('./cdn/file/metatft/' + category + '/' + id.toLowerCase() + '.png', document.baseURI).href
  img.addEventListener('error', () => { img.src = new URL('./art/hachimi.png', document.baseURI).href }, { once: true })
  return img
}
function unit(id: string) {
  const element = node('div', 'unit')
  element.append(image('champions', id, units[id]?.name), node('small', '', units[id]?.name || id))
  return element
}
function itemIcon(id: string) {
  const frame = node('span', 'kimi-item-icon')
  const radiant = isRadiantItem(items[id])
  frame.dataset.itemFrame = radiant ? 'Radiant' : 'Normal'
  const img = image('items', id, items[id]?.name); img.className = 'item-image'; frame.append(img)
  if (radiant) { const border = node('img', 'radiant-frame'); border.src = new URL(RADIANT_FRAME, document.baseURI).href; border.alt = ''; border.setAttribute('aria-hidden', 'true'); frame.append(border) }
  return frame
}
function tierBadge(tier: string) { const badge = node('span', 'comp-tier', tier); badge.dataset.tier = tier; return badge }
function setMenu(open: boolean) { menu.hidden = !open; picker.setAttribute('aria-expanded', String(open)) }
function renderOptions() {
  options.replaceChildren()
  for (const row of comps.filter(c => tierFilter === 'all' || c.calculatedTier === tierFilter)) {
    const option = node('button', 'comp-option'); option.type = 'button'
    option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(row.compId === comp?.compId))
    option.dataset.compId = row.compId; option.dataset.tier = row.calculatedTier
    option.append(tierBadge(row.calculatedTier), node('span', 'option-name', nameOf(row)), node('span', 'option-avg', '均排 ' + Number(row.avg).toFixed(2)))
    option.addEventListener('click', () => { setMenu(false); void select(row.compId) })
    options.append(option)
  }
}
function buildCard(build: { unit?: string, buildName?: string[], count?: number, avg?: number }, statistics = false) {
  const card = node('div', 'build-card'), right = node('div', 'build-right'), icons = node('div', 'item-icons')
  for (const id of build.buildName ?? []) icons.append(itemIcon(id))
  right.append(icons)
  if (statistics) right.append(node('span', 'sub', (build.count ?? '—') + ' 次 · 均排 ' + Number(build.avg).toFixed(2)))
  card.append(unit(build.unit!), right)
  return card
}
function drawBoard() {
  const cells = new Map((detail?.positioning ?? []).filter(p => p.position && p.unit).map(p => [p.position!, p.unit!]))
  content.append(node('div', 'legend', '前排'))
  const board = node('div', 'board')
  for (let row = 3; row >= 0; row--) {
    const line = node('div', 'board-row')
    for (let col = 1; col <= 7; col++) {
      const id = cells.get(row * 7 + col), cell = node('div', id ? 'cell' : 'cell empty')
      if (id) { cell.title = units[id]?.name || id; cell.append(image('champions', id, units[id]?.name)); if (comp.stars?.includes(id)) cell.append(node('span', 'star', '★★★')) }
      line.append(cell)
    }
    board.append(line)
  }
  content.append(board, node('div', 'legend', '后排 · 实战常见站位，非实时对局识别'))
  const placed = new Set(cells.values()), missing = (comp.units ?? []).filter(id => !placed.has(id))
  if (missing.length) { const list = node('div', 'unplaced'); content.append(node('p', 'note', '源站尚缺 ' + missing.length + ' 个弈子的站位，保留空缺。')); missing.forEach(id => list.append(node('span', '', units[id]?.name || id))); content.append(list) }
  const tags = node('div', 'traits')
  for (const trait of countCompTraits(comp.units ?? [], comp.traits ?? [], units, traits)) {
    const tag = node('span', 'trait'); tag.dataset.traitId = trait.id; tag.dataset.count = String(trait.count)
    tag.title = trait.sourceThreshold ? '数量按源站激活档位显示' : trait.threshold ? '实际弈子数量；激活档位 ' + trait.threshold : '实际弈子数量'
    tag.append(image('traits', trait.id, trait.name), node('span', 'trait-count', String(trait.count)), document.createTextNode(trait.name))
    tags.append(tag)
  }
  content.append(tags)
  for (const build of comp.builds ?? []) if (build.unit && comp.units?.includes(build.unit)) content.append(buildCard(build))
}
function drawItems() {
  const builds = (detail?.builds ?? comp.builds ?? []).filter(build => build.unit && comp.units?.includes(build.unit))
  if (!builds.length) content.append(node('p', 'note', '该阵容暂无出装统计'))
  for (const build of builds) content.append(buildCard(build, true))
}
function drawOptions(early: boolean) {
  const data = (early ? detail?.early_options : detail?.options) ?? {}
  const levels = Object.keys(data).filter(level => data[level]?.length).sort((a, b) => Number(a) - Number(b))
  if (!levels.length) content.append(node('p', 'note', '源站暂无该阵容的有效 S19 过渡数据'))
  for (const level of levels) {
    content.append(node('h3', 'level', level + ' 人口'))
    for (const row of data[level] ?? []) {
      const card = node('div', 'option-card'), list = node('div', 'units'), meta = node('div', 'option-meta')
      row.unit_list?.split('&').forEach(id => list.append(unit(id)))
      meta.append(node('span', '', (row.count ?? '—') + ' 次实战'), node('span', '', '均排 ' + Number(row.avg).toFixed(2)))
      card.append(list, meta); content.append(card)
    }
  }
}
function render() { if (!detail) return; content.replaceChildren(); if (tab === 'board') drawBoard(); else if (tab === 'items') drawItems(); else drawOptions(tab === 'early'); content.scrollTop = 0 }
async function select(id?: string | null) {
  const token = ++request
  comp = comps.find(c => c.compId === id) || comps[0]!
  if (!comp) throw new Error('Empty comp pool')
  compName.textContent = nameOf(comp); picker.dataset.compId = comp.compId
  compTier.textContent = comp.calculatedTier; compTier.dataset.tier = comp.calculatedTier; compTier.setAttribute('aria-label', '当前阵容等级 ' + comp.calculatedTier)
  renderOptions(); metrics.replaceChildren()
  for (const [label, value, percent] of [['排名', comp.avg, false], ['前四', comp.top4Rate, true], ['吃鸡', comp.firstRate, true], ['登场', comp.pickRate, true]] as const) {
    const metric = node('span', '', label); metric.append(node('strong', '', Number(value).toFixed(percent ? 1 : 2) + (percent ? '%' : ''))); metrics.append(metric)
  }
  detail = null; content.replaceChildren(node('p', 'note', '正在读取阵容…'))
  try { const data = await get<Detail>('comps/' + comp.compId); if (token !== request) return; detail = data; render() }
  catch { if (token === request) content.replaceChildren(node('p', 'note', '详情读取中断，请切换阵容重试。')) }
}
picker.addEventListener('click', () => { const open = menu.hidden; renderOptions(); setMenu(open); if (open) options.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) })
document.addEventListener('click', event => { if (!menu.contains(event.target as Node) && !picker.contains(event.target as Node)) setMenu(false) })
document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false) })
tabs.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return; tab = button.dataset.tab!; tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button)); render() })
for (const grade of ['all', 'S', 'A', 'B', 'C', 'D']) { const button = node('button', '', grade === 'all' ? '全部' : grade); button.type = 'button'; button.setAttribute('aria-pressed', String(grade === tierFilter)); button.addEventListener('click', () => { tierFilter = grade; filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))); renderOptions() }); filters.append(button) }
try {
  const [lookups, pool] = await Promise.all([get<Lookups>('lookups'), get<Comp[]>('comps')])
  units = Object.fromEntries((lookups.units ?? []).map(u => [u.apiName!, u])); traits = Object.fromEntries((lookups.traits ?? []).map(t => [t.apiName!, t])); items = Object.fromEntries((lookups.items ?? []).map(i => [i.apiName!, i]))
  comps = processComps(pool).flatMap(group => [...group.normal, ...group.lowPickrate])
  await select(new URLSearchParams(location.search).get('comp'))
} catch { content.replaceChildren(node('p', 'note', '离线阵容数据读取出现问题，请重新打开助手。')) }
