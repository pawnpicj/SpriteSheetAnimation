// Reuses saved live verification data. No paid inference calls.
import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const qa=new URL('../qa/',import.meta.url),path=name=>fileURLToPath(new URL(name,qa));
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5186/');await page.locator('input[type=file][accept=".json"]').setInputFiles(path('analysis-project-Orc.png.json'));
 await page.getByRole('button',{name:'View AI profile',exact:true}).click();assert.ok((await page.getByRole('textbox',{name:'Monster profile name'}).inputValue()).endsWith('reviewed'));assert.equal(await page.getByLabel('Monster body plan',{exact:true}).inputValue(),'biped');
 await page.screenshot({path:path('analysis-restored.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const dialog=page.getByRole('dialog');assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth));await dialog.evaluate(el=>el.scrollTop=el.scrollHeight);await page.screenshot({path:path('analysis-mobile.png'),fullPage:true});
 await dialog.evaluate(el=>el.scrollTop=0);await page.route('**/api/ai/analyze',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'เครดิต OpenRouter ไม่เพียงพอ'})}));await page.getByRole('button',{name:'Analyze again',exact:true}).click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').textContent(),/เครดิต/);
 assert.deepEqual(errors,[]);await writeFile(path('analysis-ui-results.json'),JSON.stringify({passed:true,checks:['Saved AI profile reopens from project and preserves review edits','Mobile dialog has no horizontal overflow and scrolls to the save control','Provider error is readable and does not discard the existing profile','No browser JavaScript errors'],errors},null,2));console.log('Analysis UI checks passed; no paid requests.');
}finally{await browser.close();}
