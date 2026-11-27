import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from '../tools/node_modules/playwright/index.mjs'

const ROOT = '/root/tft-kimi'
const BASE = process.env.TEST_BASE ?? 'http://127.0.0.1:8798/'
const require = createRequire(ROOT + '/frontend/package.json')
const { build } = require('esbuild')
const generated = ROOT + '/tests/generated'
await fs.mkdir(generated, { recursive: true })
for (const utility of ['traitCounts', 'compRating', 'itemAppearance']) {
  await build({ entryPoints: [ROOT + '/frontend/apps/react/src/utils/' + utility + '.ts'], bundle: true, format: 'esm', platform: 'node', outfile: generated + '/' + utility + '.mjs' })
}
const { countCompTraits } = await import('./generated/traitCounts.mjs')
const { processComps } = await import('./generated/compRating.mjs')
const { isRadiantItem } = await import('./generated/itemAppearance.mjs')
const lookup = await fetch(BASE + 'api/lookups').then(r => r.json()).then(r => r.data)
const pool = await fetch(BASE + 'api/comps').then(r => r.json()).then(r => r.data)
const units = Object.fromEntries(lookup.units.map(u => [u.apiName, u]))
const traits = Object.fromEntries(lookup.traits.map(t => [t.apiName, t]))
const grades = new Map(processComps(pool).flatMap(g => [...g.normal, ...g.lowPickrate]).map(c => [c.compId, c.calculatedTier]))
const checks = []
const evidence = {}
const check = (name, value) => { assert.ok(value, name); checks.push(name) }
const number = css => css.match(/[\d.]+/g).slice(0, 3).map(Number)
const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0)
const contrast = (a, b) => { const x = luminance(number(a)), y = luminance(number(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
const screenshotDir = ROOT + '/docs/screenshots/v1.2.1'
await fs.mkdir(screenshotDir, { recursive: true })
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 400, height: 800 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai' })
const page = await context.newPage()
const errors = [], failures = []
context.on('page', p => { p.on('pageerror', e => errors.push(e.message)); p.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }) }) })
page.on('pageerror', e => errors.push(e.message))
page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }) })
const nav = name => page.getByRole('navigation', { name: '主要功能' }).getByRole('button', { name, exact: true }).click()
try {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.locator('.kimi-comp-card').first().waitFor()
  evidence.theme = await page.locator('html').evaluate(el => ({ background: getComputedStyle(el).getPropertyValue('--paper').trim(), colorScheme: getComputedStyle(el).colorScheme }))
  check('dark theme applied', evidence.theme.background === '#111722' && evidence.theme.colorScheme === 'dark')
  await page.screenshot({ path: screenshotDir + '/home.png' })
  await nav('符文')
  await page.locator('.augment-source-note').waitFor()
  for (const rarity of ['Silver', 'Gold', 'Prismatic']) {
    const filter = page.locator('.augment-tier-filter [data-rarity="' + rarity + '"]')
    await filter.click()
    const expected = lookup.augments.filter(a => a.rarity === rarity).length
    await page.waitForFunction(n => document.querySelectorAll('.kimi-augment-card').length === n, expected)
    const card = page.locator('.kimi-augment-card').first()
    await card.locator('.augment-glyph').evaluate(img => img.decode())
    const colors = await card.evaluate(el => {
      const name = el.querySelector('.augment-card-name'), badge = el.querySelector('.augment-rarity-badge')
      return { text: getComputedStyle(name).color, background: getComputedStyle(el).backgroundColor, badgeText: getComputedStyle(badge).color, badgeBackground: getComputedStyle(badge).backgroundColor, fontSize: getComputedStyle(name).fontSize, material: getComputedStyle(el.querySelector('.augment-material')).backgroundImage, glyphFilter: getComputedStyle(el.querySelector('.augment-glyph')).filter }
    })
    colors.textContrast = contrast(colors.text, colors.background)
    colors.badgeContrast = contrast(colors.badgeText, colors.badgeBackground)
    const filterColors = await filter.evaluate(el => ({ text: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }))
    colors.filterContrast = contrast(filterColors.text, filterColors.background)
    evidence[rarity] = { count: expected, ...colors }
    check(rarity + ' text contrast >= 4.5', colors.textContrast >= 4.5 && colors.badgeContrast >= 4.5 && colors.filterContrast >= 4.5)
    check(rarity + ' glyph material is applied', colors.glyphFilter.includes('kimi-augment-glyph') && colors.material.includes(rarity === 'Prismatic' ? 'tier3.png' : 'linear-gradient'))
    await card.locator('.kimi-augment-icon').screenshot({ path: screenshotDir + '/icon-' + rarity + '.png' })
    await page.screenshot({ path: screenshotDir + '/augments-' + rarity + '.png' })
  }
  check('all source augment variants preserved', Object.values(evidence).filter(x => x?.count).reduce((n, row) => n + row.count, 0) === lookup.augments.length)
  await nav('装备')
  await page.locator('.kimi-page:visible').getByRole('tab', { name: '光明', exact: true }).click()
  await page.locator('[data-item-frame="Radiant"]').first().waitFor()
  const itemFrames = await page.locator('.kimi-page:visible .kimi-item-icon').evaluateAll(nodes => nodes.map(el => ({ frame: el.dataset.itemFrame, overlay: el.querySelector('.radiant-frame')?.src, border: getComputedStyle(el).borderColor })))
  check('radiant category uses official gold frame', itemFrames.length > 0 && itemFrames.every(f => f.frame === 'Radiant' && f.overlay?.endsWith('/itemframes/t_item_frame_radiant.png')))
  const frame = await fetch(BASE + 'cdn/file/metatft/itemframes/t_item_frame_radiant.png').then(r => r.arrayBuffer())
  check('official radiant frame valid PNG', Buffer.from(frame).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
  check('radiant frame follows source metadata rather than name alone', isRadiantItem(lookup.items.find(i => i.apiName === 'DA_RadiantLuckyItemChest')) && !isRadiantItem({ apiName: 'SyntheticRadiantName', tags: [] }))
  evidence.radiant = { goldFramedIcons: itemFrames.length, frameBytes: frame.byteLength }
  await page.screenshot({ path: screenshotDir + '/radiant-items.png' })
  await page.locator('.kimi-page:visible').getByRole('tab', { name: '核心', exact: true }).click()
  await page.locator('[data-item-id]').first().waitFor()
  check('normal items stay normal', await page.locator('.kimi-page:visible .radiant-frame').count() === 0)
  const overlay = await context.newPage()
  await overlay.setViewportSize({ width: 340, height: 440 })
  const target = pool.find(c => c.traits?.some(t => t.startsWith('DA_Arcanist19_')) && c.traits?.some(t => t.startsWith('DA_Bodyguard19_')))
  assert.ok(target, 'reference composition exists')
  await overlay.goto(BASE + 'overlay.html?comp=' + target.compId, { waitUntil: 'networkidle' })
  await overlay.locator('.cell').first().waitFor()
  await overlay.locator('#comp-picker').click()
  const allOptions = await overlay.locator('.comp-option').evaluateAll(nodes => nodes.map(el => ({ id: el.dataset.compId, tier: el.dataset.tier, text: el.textContent })))
  check('overlay and main use identical grades for every composition', allOptions.length === pool.length && allOptions.every(row => row.tier === grades.get(row.id)))
  check('overlay dropdown scrollable inside window', await overlay.locator('#comp-options').evaluate(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === 'auto'))
  await overlay.screenshot({ path: screenshotDir + '/overlay-dropdown.png' })
  await overlay.locator('#tier-filters').getByRole('button', { name: 'A', exact: true }).click()
  check('overlay grade filter works', await overlay.locator('.comp-option').evaluateAll(nodes => nodes.length > 0 && nodes.every(el => el.dataset.tier === 'A')))
  await overlay.locator('#tier-filters').getByRole('button', { name: '全部', exact: true }).click()
  await overlay.locator('#comp-picker').click()
  const expectedTraits = countCompTraits(target.units, target.traits, units, traits)
  const displayedTraits = await overlay.locator('.trait[data-count]').evaluateAll(nodes => nodes.map(el => ({ id: el.dataset.traitId, count: Number(el.dataset.count), text: el.textContent })))
  check('overlay trait counts match unit composition', displayedTraits.length === expectedTraits.length && displayedTraits.every(t => expectedTraits.some(e => e.id === t.id && e.count === t.count)))
  evidence.overlay = { tier: await overlay.locator('#comp-tier').innerText(), composition: target.compId, traits: displayedTraits, options: allOptions.length }
  await overlay.screenshot({ path: screenshotDir + '/overlay-board.png' })
  check('mage and bodyguard counts are visible', displayedTraits.some(t => t.id === 'DA_Arcanist19' && t.text.includes('法师')) && displayedTraits.some(t => t.id === 'DA_Bodyguard19' && t.text.includes('护卫')))
  await overlay.locator('#comp-picker').click()
  const last = pool.at(-1)
  await overlay.locator('.comp-option[data-comp-id="' + last.compId + '"]').click()
  await overlay.waitForFunction(id => document.querySelector('#comp-picker').dataset.compId === id && document.querySelectorAll('.cell').length === 28, last.compId)
  check('dropdown selection updates composition and grade', await overlay.locator('#comp-tier').innerText() === grades.get(last.compId))
  check('no page errors or image failures', errors.length === 0 && failures.length === 0)
  await fs.writeFile(ROOT + '/docs/visual-results.json', JSON.stringify({ ok: true, checks, evidence, errors, failures }, null, 2))
  console.log(JSON.stringify({ ok: true, count: checks.length, checks, evidence }, null, 2))
} catch (error) {
  await fs.writeFile(ROOT + '/docs/visual-results.json', JSON.stringify({ ok: false, checks, evidence, errors, failures, error: error.stack }, null, 2))
  throw error
} finally { await browser.close() }
