import { chromium } from '../tools/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const output = `${process.env.KIMI_ROOT || '/opt/tft-kimi'}/docs/screenshots`
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 412, height: 850 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errors = []
const failures = []
page.on('pageerror', e => errors.push(e.message))
page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure()?.errorText }))
page.on('response', r => { if (r.status() >= 400) failures.push({ url: r.url(), status: r.status() }) })
await page.goto('http://127.0.0.1:8798/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const summary = { errors, failures, tabs: {} }
summary.initial = await page.locator('body').innerText()
await page.screenshot({ path: output + '/01-home.png', fullPage: true })
for (const label of ['装备', '英雄', '符文', '羁绊']) {
  await page.getByRole('navigation', { name: '主要功能' }).getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(800)
  summary.tabs[label] = await page.locator('.kimi-page:visible').innerText()
  const layout = await page.locator('.kimi-page:visible').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, scroll: [...el.querySelectorAll('[data-slot="scroll-area"]')].map(n => ({ h: n.clientHeight, sh: n.scrollHeight })) }))
  summary.tabs[label + '_layout'] = layout
  await page.screenshot({ path: output + '/tab-' + label + '.png' })
}
await page.getByRole('navigation', { name: '主要功能' }).getByRole('button', { name: '阵容', exact: true }).click()
await page.locator('.kimi-comp-card').first().click()
await page.waitForTimeout(700)
summary.detail = await page.locator('[data-slot="drawer-content"]').innerText()
for (const label of ['概览', '英雄', '装备', '过渡', '变阵']) {
  await page.locator('[data-slot="drawer-content"]').getByRole('tab', { name: label, exact: true }).click()
  await page.waitForTimeout(300)
  summary.tabs['detail_' + label] = await page.locator('[data-slot="drawer-content"]').innerText()
  await page.screenshot({ path: output + '/detail-' + label + '.png' })
}
await page.getByRole('button', { name: '返回阵容' }).click()
await page.getByRole('button', { name: '设置与数据更新' }).click()
summary.settings = await page.getByRole('dialog', { name: '设置' }).innerText()
await page.screenshot({ path: output + '/settings.png' })
const overlay = await browser.newPage({ viewport: { width: 340, height: 410 }, isMobile: true, hasTouch: true })
overlay.on('pageerror', e => errors.push('overlay: ' + e.message))
await overlay.goto('http://127.0.0.1:8798/overlay.html', { waitUntil: 'networkidle' })
summary.overlay = await overlay.locator('body').innerText()
await overlay.screenshot({ path: output + '/overlay.png' })
for (const label of ['出装', '过渡', '变阵']) {
  await overlay.getByRole('button', { name: label, exact: true }).click()
  summary.tabs['overlay_' + label] = (await overlay.locator('body').innerText()).slice(0, 1000)
}
summary.brokenImages = await page.locator('img').evaluateAll(imgs => imgs.filter(img => img.complete && !img.naturalWidth).map(img => img.src))
await fs.writeFile(`${process.env.KIMI_ROOT || '/opt/tft-kimi'}/docs/smoke-results.json`, JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ errors, failures: failures.slice(0, 15), initial: summary.initial.slice(0, 1100), tabLayouts: Object.fromEntries(Object.entries(summary.tabs).filter(([k]) => k.endsWith('_layout'))), detail: summary.detail.slice(0, 1000), overlay: summary.overlay.slice(0, 500), brokenImages: summary.brokenImages }, null, 2))
await browser.close()
