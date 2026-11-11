import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto(process.env.TEST_URL??'http://127.0.0.1:4174/app');
 await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../phase3/fixtures/development-multipage.pdf',import.meta.url)));
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 await page.getByRole('button',{name:'Cancel processing',exact:true}).click();
 await page.getByRole('button',{name:'Clear workspace',exact:true}).click({timeout:15000});
 assert.equal(await page.locator('.finding-card').count(),0);assert.equal(await page.locator('.report').count(),0);
 await page.locator('input[type=file]').setInputFiles({name:'recovery.txt',mimeType:'text/plain',buffer:Buffer.from('Password: FictionalCancelRecovery4829')});
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 await page.locator('.report-heading').waitFor({timeout:20000});
 assert.equal((await page.locator('.report-heading h2').textContent()).trim(),'SCOPED CLEAR');
 console.log('PASS cancellation cleanup and subsequent local analysis/export');
}finally{await browser.close();}
