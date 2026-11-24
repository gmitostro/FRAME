// Renders PWA icons from SVG with the preinstalled Chromium.
const { chromium } = require('playwright')
const path = require('path')
const out = path.join(__dirname, '..', 'public')
const mark = (pad) => {
  const s = 64, inner = s - pad * 2, k = inner / 64
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0a0b0b"/>
  <g transform="translate(${pad} ${pad}) scale(${k})"><path d="M14 26V18a4 4 0 0 1 4-4h8M38 14h8a4 4 0 0 1 4 4v8M50 38v8a4 4 0 0 1-4 4h-8M26 50h-8a4 4 0 0 1-4-4v-8" stroke="#8fb89a" stroke-width="4.5" stroke-linecap="round" fill="none"/><rect x="26" y="26" width="12" height="12" rx="2.5" fill="#8fb89a"/></g></svg>`
}
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const jobs = [
    ['pwa-192.png', 192, 0],
    ['pwa-512.png', 512, 0],
    ['apple-touch-icon.png', 180, 2],
    ['pwa-maskable-512.png', 512, 10],
  ]
  for (const [name, size, pad] of jobs) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<html><body style="margin:0;background:#0a0b0b">${mark(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } })
  }
  await browser.close()
  console.log('icons written')
})()
