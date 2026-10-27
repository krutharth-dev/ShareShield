import { expect, test, type Page } from '@playwright/test'

test('appearance persists and command navigation works with a keyboard', async ({ page }) => {
  await page.goto('/')
  await page.locator('.theme-switcher button[title="Light appearance"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.locator('.theme-switcher button[title="Dark appearance"]').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Control+k')
  const dialog = page.getByRole('dialog', { name: 'ShareShield command menu' })
  await expect(dialog).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search workspace actions' }).fill('file upload')
  await page.getByRole('searchbox', { name: 'Search workspace actions' }).press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Start with your document' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('file selection rejects unsupported files and recovers from a busy analysis', async ({ page }) => {
  await page.goto('/')
  const input = page.locator('input[type=file]')
  await input.setInputFiles({ name: 'fictional.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('fictional') })
  await expect(page.getByText('Unsupported file extension.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyze document' })).toBeDisabled()
  await input.setInputFiles({ name: 'fictional.txt', mimeType: 'text/plain', buffer: Buffer.from('Email: fictional@example.org\n') })
  let attempts = 0
  await page.route('**/analyze', async route => {
    if (++attempts === 1) await route.fulfill({ status: 503, headers: { 'Retry-After': '0.001' }, json: { detail: 'Processor busy' } })
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Analyze document' }).click()
  await expect(page.getByRole('heading', { name: 'Review detections' })).toBeVisible()
  expect(attempts).toBe(2)
  await expect(page.getByRole('checkbox', { name: /fictional@example.org email/ })).toBeChecked()
})

test('busy previews retry and remain available for manual editing', async ({ page }) => {
  let attempts = 0
  await page.route('**/preview', async route => {
    if (++attempts === 1) await route.fulfill({ status: 503, headers: { 'Retry-After': '0.001' }, json: { detail: 'Processor busy' } })
    else await route.continue()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Use fictional ID image', exact: true }).click()
  await page.getByRole('button', { name: 'Analyze document' }).click()
  await expect(page.getByRole('img', { name: 'Original page 1', exact: true })).toBeVisible()
  expect(attempts).toBe(2)
  await drawBox(page, 1)
  await expect(page.locator('.manual-mask')).toHaveCount(1)
})

test('changing files during a scan discards the stale response', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/analyze', async route => { await gate; await route.continue() })
  await page.goto('/')
  await page.getByRole('button', { name: 'Use fictional sample', exact: true }).click()
  const request = page.waitForRequest('**/analyze')
  await page.getByRole('button', { name: 'Analyze document' }).click()
  await request
  await page.getByRole('button', { name: 'Remove selected file' }).click()
  await page.getByRole('button', { name: 'Use fictional ID image', exact: true }).click()
  await expect(page.getByText('fictional-identity.png', { exact: true })).toBeVisible()
  const oldResponse = page.waitForResponse('**/analyze')
  release()
  await oldResponse
  await expect(page.getByRole('heading', { name: 'Review detections' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Analyze document' }).click()
  await expect(page.getByRole('img', { name: 'Original page 1', exact: true })).toBeVisible()
})

function twoPagePdf() {
  const stream = (text: string) => {
    const contents = `BT /F1 18 Tf 50 350 Td (${text}) Tj ET\n`
    return `<< /Length ${contents.length} >>\nstream\n${contents}endstream`
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    stream('PUBLIC PAGE ONE - FICTIONAL REVIEW SAMPLE'),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    stream('PUBLIC PAGE TWO - FICTIONAL REVIEW SAMPLE'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const start = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
  return Buffer.from(pdf)
}

async function drawBox(page: Page, number: number) {
  const draw = page.getByRole('button', { name: 'Draw mask', exact: true })
  if (await draw.isVisible()) await draw.click()
  const image = page.getByRole('img', { name: 'Original page ' + number, exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true)
  await image.scrollIntoViewIfNeeded()
  const rect = await image.boundingBox()
  if (!rect) throw Error('Page preview missing')
  await page.mouse.move(rect.x + rect.width * .1, rect.y + rect.height * .4)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width * .4, rect.y + rect.height * .6, { steps: 5 })
  await page.mouse.up()
}

test('multiple PDF pages retain independent masks and require review of every exported page', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'fictional-two-pages.pdf', mimeType: 'application/pdf', buffer: twoPagePdf() })
  await page.getByRole('button', { name: 'Analyze document' }).click()
  await drawBox(page, 1)
  await expect(page.locator('.manual-mask')).toHaveCount(1)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await drawBox(page, 2)
  await expect(page.locator('.manual-mask')).toHaveCount(1)
  await page.getByRole('button', { name: 'Generate & verify' }).click()
  await expect(page.locator('.report-card')).toContainText('2 manual masks')
  const download = page.getByRole('button', { name: 'Download reviewed copy' })
  await page.getByRole('checkbox', { name: 'I have inspected the export' }).check()
  const pageTwo = page.getByRole('checkbox', { name: 'I have visually checked page 2' })
  await expect(pageTwo).toBeEnabled()
  await pageTwo.check()
  await expect(download).toBeDisabled()
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  const pageOne = page.getByRole('checkbox', { name: 'I have visually checked page 1' })
  await expect(pageOne).toBeEnabled()
  await pageOne.check()
  await expect(download).toBeEnabled()
  const receipt = page.waitForEvent('download')
  await download.click()
  expect(await (await receipt).failure()).toBeNull()
})
