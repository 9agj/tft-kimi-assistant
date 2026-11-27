import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from '../tools/node_modules/playwright/index.mjs'

const ROOT = process.env.KIMI_ROOT || '/opt/tft-kimi'
const base = process.env.TEST_BASE ?? 'http://127.0.0.1:8798/'
const output = ROOT + '/docs/screenshots'
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 412, height: 850 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai' })
const page = await context.newPage()
const checks = []
const errors = []
const failures = []
page.on('pageerror', e => errors.push(e.message))
page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }) })
const check = (name, value) => { assert.ok(value, name); checks.push(name) }
const pause = () => page.waitForTimeout(300)
const nav = label => page.getByRole('navigation', { name: '主要功能' }).getByRole('button', { name: label, exact: true }).click()
const data = name => fetch(base + 'api/' + name).then(r => r.json()).then(r => r.data)
try {
  const [lookups, pool, ranking] = await Promise.all([data('lookups'), data('comps'), data('augmentRanking')])
  await page.goto(base, { waitUntil: 'networkidle' })
  check('home renders S19 composition count', (await page.locator('.kimi-status-strip').innerText()).includes(pool.length + ' 套阵容'))
  const first = page.locator('.kimi-comp-card').first()
  const firstId = await first.getAttribute('data-comp-id')
  await first.getByRole('button', { name: '收藏阵容' }).click()
  await page.getByRole('button', { name: '仅显示收藏', exact: true }).click()
  await pause()
  check('favorite-only filter', await page.locator('.kimi-comp-card').count() === 1)
  await page.reload({ waitUntil: 'networkidle' })
  check('favorite survives restart', await page.locator('.kimi-comp-card').filter({ has: page.getByRole('button', { name: '取消收藏' }) }).count() > 0)
  const compSearch = page.getByPlaceholder('搜索英雄/羁绊...')
  await compSearch.fill('心之钢')
  await pause()
  check('comp search returns matches', await page.locator('.kimi-comp-card').count() > 0)
  await compSearch.fill('definitely-empty-query')
  await pause()
  check('comp search filters unrelated results', await page.locator('.kimi-comp-card').count() === 0)
  await compSearch.fill('')
  await nav('英雄')
  await pause()
  const shopCount = lookups.units.filter(u => u.shopUnit).length
  await page.waitForFunction(count => document.querySelectorAll('[data-unit-id]').length === count, shopCount)
  check('all shop units displayed', await page.locator('[data-unit-id]').count() === shopCount)
  await page.getByRole('button', { name: '包含特殊单位', exact: true }).click()
  check('all special unit records displayed', await page.locator('[data-unit-id]').count() === lookups.units.length)
  await page.getByPlaceholder('搜索英雄 / 羁绊 / 拼音…').fill('伊泽瑞尔')
  await pause()
  check('unit Chinese search', await page.locator('[data-unit-id]').count() > 0)
  const ezreal = page.locator('[data-unit-id="DA_Ezreal19"]')
  await ezreal.click()
  const ability = await page.locator('[data-slot="popover-content"]').innerText()
  check('ability curve values render correct one-star value', ability.includes('220'))
  await page.keyboard.press('Escape')
  await nav('装备')
  await pause()
  let itemCount = 0
  for (const category of ['核心', '光明', '神器', '转职', '其他']) {
    await page.locator('.kimi-page:visible').getByRole('tab', { name: category, exact: true }).click()
    await pause()
    itemCount += await page.locator('[data-item-id]').count()
  }
  check('all item categories preserve complete catalog', itemCount === lookups.items.length)
  await page.locator('.kimi-page:visible').getByRole('tab', { name: '核心', exact: true }).click()
  await page.getByPlaceholder('搜索装备 / 拼音…').fill('无尽')
  await pause()
  check('item search', await page.locator('[data-item-id]').count() > 0)
  await page.locator('[data-item-id]').first().click()
  check('item description and recipe render', (await page.locator('[data-slot="popover-content"]').innerText()).includes('技能暴击'))
  await page.keyboard.press('Escape')
  await nav('符文')
  await page.locator('.augment-source-note').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelectorAll('.kimi-augment-card').length > 0)
  const augmentText = await page.locator('.kimi-page:visible').innerText()
  check('augment ranking source is stated', augmentText.includes('MetaTFT · S → A → B → C → D 分组排序'))
  await page.waitForFunction(() => !document.querySelector('.augment-ranking-note')?.textContent.includes('正在读取'))
  const gradeOrder = await page.locator('.augment-grade-group').evaluateAll(rows => rows.map(row => row.dataset.grade))
  check('SABCD groups followed by unrated', JSON.stringify(gradeOrder) === JSON.stringify(['S', 'A', 'B', 'C', 'D', 'Unrated']))
  const sourceGrades = new Map(ranking.groups.flatMap(g => g.content.map(item => [item.id, g.label])))
  const cardsWithGrades = await page.locator('.kimi-augment-card').evaluateAll(rows => rows.map(row => ({ id: row.dataset.augmentId, grade: row.dataset.grade })))
  check('card grades match MetaTFT', cardsWithGrades.every(card => card.grade === (sourceGrades.get(card.id) || 'Unrated')))
  const rarityOrder = ['Silver', 'Gold', 'Prismatic']
  for (const grade of ['S', 'A', 'B', 'C', 'D', 'Unrated']) {
    const expected = lookups.augments.filter(a => (sourceGrades.get(a.apiName) || 'Unrated') === grade)
      .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
        || (a.en_name || a.name || a.apiName).localeCompare(b.en_name || b.name || b.apiName, 'en'))
      .map(a => a.apiName + '|' + a.rarity + '|' + a.name)
    const displayed = await page.locator('.augment-grade-group[data-grade="' + grade + '"] .kimi-augment-card')
      .evaluateAll(rows => rows.map(row => row.dataset.augmentId + '|' + row.dataset.rarity + '|' + row.querySelector('.augment-card-name').textContent))
    check('official in-grade ordering ' + grade, JSON.stringify(displayed) === JSON.stringify(expected))
  }
  check('unrated is never assigned D', cardsWithGrades.some(card => card.grade === 'Unrated') && cardsWithGrades.filter(card => !sourceGrades.has(card.id)).every(card => card.grade === 'Unrated'))
  check('ranking season label is truthful', (await page.locator('.augment-ranking-note').first().innerText()).includes(ranking.isCurrentSet ? 'S19 评级' : ranking.rankingSet.replace('TFTSet', 'S')))
  await page.screenshot({ path: output + '/augment-SABCD-v1.2.1.png' })
  for (const stage of ['2-1', '3-2', '4-2']) {
    await page.getByRole('group', { name: '强化出现阶段' }).getByRole('button', { name: stage, exact: true }).click()
    const expected = lookups.augments.filter(a => a.rounds?.includes(stage)).length
    await page.waitForFunction(count => document.querySelectorAll('.kimi-augment-card').length === count, expected)
    check('stage filter ' + stage, await page.locator('.kimi-augment-card').count() === expected)
  }
  await page.getByRole('tablist', { name: '强化阶位' }).getByRole('tab', { name: /银色/ }).click()
  const combinedCount = lookups.augments.filter(a => a.rarity === 'Silver' && a.rounds?.includes('4-2')).length
  await page.waitForFunction(count => document.querySelectorAll('.kimi-augment-card').length === count, combinedCount)
  check('stage and rarity filters compose', await page.locator('.kimi-augment-card').count() === combinedCount)
  await page.getByRole('group', { name: '强化出现阶段' }).getByRole('button', { name: '全部阶段', exact: true }).click()
  await page.getByRole('tablist', { name: '强化阶位' }).getByRole('tab', { name: /全部/ }).click()
  await page.waitForFunction(count => document.querySelectorAll('.kimi-augment-card').length === count, lookups.augments.length)
  for (const [rarity, label] of [['Silver', '银色'], ['Gold', '金色'], ['Prismatic', '棱彩']]) {
    await page.getByRole('tablist', { name: '强化阶位' }).getByRole('tab', { name: new RegExp(label) }).click()
    await pause()
    const cards = page.locator('.kimi-augment-card')
    check('rarity count ' + rarity, await cards.count() === lookups.augments.filter(a => a.rarity === rarity).length)
    check('rarity labels ' + rarity, await cards.evaluateAll((rows, expected) => rows.every(row => row.dataset.rarity === expected), rarity))
    await page.screenshot({ path: output + '/augment-' + rarity + '.png' })
  }
  await page.getByRole('tablist', { name: '强化阶位' }).getByRole('tab', { name: /全部/ }).click()
  await page.getByPlaceholder('搜索符文...').fill('高级贷款')
  await pause()
  check('augment search', (await page.locator('.kimi-page:visible').innerText()).includes('高级贷款'))
  await nav('羁绊')
  await page.getByPlaceholder('搜索羁绊 / 拼音…').fill('心之钢')
  await pause()
  await page.locator('.kimi-trait-card summary').first().click()
  check('trait description and champions display', (await page.locator('.kimi-trait-card[open]').innerText()).includes('伊泽瑞尔'))
  await nav('阵容')
  await page.locator('.kimi-comp-card').first().click()
  await pause()
  const drawer = page.locator('[data-slot="drawer-content"]')
  for (const tab of ['概览', '英雄', '装备', '过渡', '变阵']) {
    await drawer.getByRole('tab', { name: tab, exact: true }).click()
    await pause()
    check('detail tab ' + tab, (await drawer.innerText()).length > 70)
  }
  const popup = context.waitForEvent('page')
  await drawer.getByRole('button', { name: '悬浮查看' }).click()
  const overlay = await popup
  overlay.on('pageerror', e => errors.push(e.message))
  await overlay.waitForLoadState('networkidle')
  await overlay.locator('#comp-picker').click()
  check('overlay composition picker', await overlay.locator('#comp-options [role="option"]').count() === pool.length)
  check('overlay dropdown scrolls', await overlay.locator('#comp-options').evaluate(el => el.scrollHeight > el.clientHeight))
  await overlay.screenshot({ path: output + '/overlay-dropdown.png' })
  await overlay.locator('#comp-picker').click()
  check('overlay renders 28-cell board', await overlay.locator('.cell').count() === 28)
  for (const tab of ['出装', '过渡', '变阵', '站位']) {
    await overlay.getByRole('button', { name: tab, exact: true }).click()
    check('overlay tab ' + tab, (await overlay.locator('#content').innerText()).length > 20)
  }
  const other = pool.find(c => c.compId !== firstId)
  await overlay.locator('#comp-picker').click()
  await overlay.locator('#comp-options [data-comp-id="' + other.compId + '"]').click()
  await overlay.waitForTimeout(500)
  check('overlay switches composition', await overlay.locator('#comp-picker').getAttribute('data-comp-id') === other.compId)
  check('overlay grade displayed', /^[SABCD]$/.test(await overlay.locator('#comp-tier').innerText()))
  check('overlay numbered traits displayed', await overlay.locator('.trait[data-count]').count() > 0 && await overlay.locator('.trait[data-count]').evaluateAll(rows => rows.every(row => /^[1-9][0-9]*$/.test(row.dataset.count))))
  await overlay.screenshot({ path: output + '/acceptance-overlay.png' })
  await overlay.close()
  await drawer.getByRole('button', { name: '返回阵容' }).click()
  await page.getByRole('button', { name: '设置与数据更新' }).click()
  check('refresh schedule visible', (await page.getByRole('dialog', { name: '设置' }).innerText()).includes('每 4 小时一次'))
  await page.getByRole('button', { name: '关闭设置' }).click()
  for (const viewport of [{ width: 360, height: 740 }, { width: 850, height: 412 }]) {
    await page.setViewportSize(viewport)
    await pause()
    check('responsive width ' + viewport.width, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await page.setViewportSize({ width: 412, height: 850 })
  await page.screenshot({ path: output + '/acceptance-home.png' })
  check('no JS errors', errors.length === 0)
  check('no HTTP failures', failures.length === 0)
  check('all loaded images valid', await page.locator('img').evaluateAll(imgs => imgs.every(img => !img.complete || img.naturalWidth > 0)))
} catch (error) {
  await page.screenshot({ path: output + '/acceptance-failure.png' }).catch(() => {})
  await fs.writeFile(ROOT + '/docs/acceptance-results.json', JSON.stringify({ ok: false, checks, errors, failures, error: error.stack }, null, 2))
  throw error
} finally { await browser.close() }
await fs.writeFile(ROOT + '/docs/acceptance-results.json', JSON.stringify({ ok: true, checks, errors, failures }, null, 2))
console.log(JSON.stringify({ ok: true, count: checks.length, checks }, null, 2))
