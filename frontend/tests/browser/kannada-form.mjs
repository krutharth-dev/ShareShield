import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  // The fixture deliberately uses an invalid Aadhaar checksum. Approve review.
  page.on("dialog", dialog => dialog.accept());
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:4174/app');
  // Fictional printed fixture from the pilot, with two repeated Aadhaar values
  // and a patient number separated from its Kannada label by column spacing.
  const fixture = fileURLToPath(new URL('./fixtures/kannada-form.png', import.meta.url));
  await page.locator('input[type=file]').setInputFiles(fixture);
  await page.getByLabel('Printed OCR language').selectOption('kan');
  await page.getByRole('button',{name:/Analyze pending files/}).click();
  const cards = page.locator('.finding-card');
  await cards.filter({hasText:'PATIENT ID'}).waitFor({timeout:120000});
  assert.equal(await cards.filter({hasText:'AADHAAR REVIEW'}).count(),2);
  await page.getByRole('button',{name:'Select all',exact:true}).click();
  await page.getByRole('button',{name:/Redact & verify export/}).click();
  const link = page.locator('.report-heading a[download]');
  await link.waitFor({timeout:120000});
  const maskFractions = await page.evaluate(async href => {
    const image = await createImageBitmap(await (await fetch(href)).blob());
    const canvas = document.createElement('canvas');
    canvas.width=image.width; canvas.height=image.height;
    const context=canvas.getContext('2d');
    context.drawImage(image,0,0);
    // Known value boxes in the source fixture. Spaces between Aadhaar
    // groups stay white, so a correctly covered row is about 90% black.
    return [[560,35,364,33],[560,160,364,33],[560,285,196,33]].map(([x,y,w,h]) => {
      const pixels=context.getImageData(x,y,w,h).data;
      let black=0;
      for(let i=0;i<pixels.length;i+=4)
        if(pixels[i]===0 && pixels[i+1]===0 && pixels[i+2]===0 && pixels[i+3]===255) black++;
      return black/(w*h);
    });
  },await link.getAttribute('href'));
  assert.ok(maskFractions[0]>.85 && maskFractions[1]>.85 && maskFractions[2]>.95,JSON.stringify(maskFractions));
  console.log('PASS Kannada scan: both Aadhaar occurrences and patient ID covered in reopened PNG',maskFractions);
} finally { await browser.close(); }
