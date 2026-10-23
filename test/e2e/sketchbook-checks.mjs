// The exact unmodified component is exercised only through this test fixture.
// Browser emulation verifies the authored interactions, not physical-phone fps.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const entry=path.resolve(root,process.env.PPG_SKETCHBOOK_ENTRY || 'dist/sketchbook-entry.js');
const out=process.env.PPG_SKETCHBOOK_ARTIFACTS && path.resolve(root,process.env.PPG_SKETCHBOOK_ARTIFACTS);
if(out)mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync(path.join(root,'vendor/threeui-sketchbook/PROVENANCE.json')));
const mime={'.js':'text/javascript','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
let fontCors=true,serverRequests=[];
const server=createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  serverRequests.push(name);
  const file=name==='/'?path.join(root,'test/fixtures/sketchbook-study.html'):name==='/sketchbook-entry.js'?entry:path.resolve(root,'app','.'+name);
  if((!file.startsWith(root+'/'))||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  if(name.startsWith('/sketchbook/')&&fontCors)res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,results=[];
let browser;
try{
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
    browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
    for(const [label,viewport,reducedMotion] of [['desktop',{width:1440,height:1000},'no-preference'],['mobile',{width:390,height:844},'no-preference'],['reduced',{width:390,height:844},'reduce']]){
      const context=await browser.newContext({viewport,reducedMotion,isMobile:label!=='desktop',hasTouch:label!=='desktop'}),page=await context.newPage(),errors=[],failed=[],requests=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));page.on('request',r=>requests.push(new URL(r.url()).pathname));
      serverRequests=[];
      await page.goto(base);assert.equal(serverRequests.some(url=>url.startsWith('/sketchbook/')||url==='/sketchbook-entry.js'),false,'component stays lazy before explicit action');
      await page.locator('#mount').click();await page.locator('iframe').waitFor();
      const iframe=page.frames().find(frame=>frame!==page.mainFrame());assert.ok(iframe);
      await iframe.waitForFunction(()=>document.body.dataset.ready==='1');
      await iframe.waitForFunction(()=>!document.getElementById('sbWrap').classList.contains('intro'));
      // Intro starts on a short timer. Wait for its settled LAND spread where
      // applicable without changing the authored component or source document.
      await iframe.waitForFunction(()=>document.querySelector('#sbBook .sb-full img')?.alt==='Marina Bay Skyline',{timeout:15000});
      const props=await page.locator('iframe').evaluate(frame=>({title:frame.title,sandbox:frame.getAttribute('sandbox'),srcDoc:frame.srcdoc}));
      assert.equal(props.sandbox,'allow-scripts');assert.equal(props.title,'Interactive Singapore sketchbook');
      assert.ok(props.srcDoc.includes("const DIR='/sketchbook/'"));
      const fontState=await iframe.evaluate(async()=>{
        await Promise.all([document.fonts.load('16px "Instrument Serif"'),document.fonts.load('italic 16px "Instrument Serif"'),document.fonts.load('16px "Newsreader"')]);
        return {serif:document.fonts.check('16px "Instrument Serif"'),italic:document.fonts.check('italic 16px "Instrument Serif"'),newsreader:document.fonts.check('16px "Newsreader"')};
      });
      assert.equal(fontState.serif,true);assert.equal(fontState.newsreader,true);
      const plates=await iframe.locator('#plateList .plate').count();assert.equal(plates,9,'all authored Singapore spreads retained');
      await iframe.locator('#sbRight').click();
      await iframe.waitForTimeout(700);
      const pointerArrowAdvances=await iframe.locator('#sbBook .sb-full img').getAttribute('alt')==='Singapore River';
      // Preserve the authored source and record its arrow hit-target limitation:
      // stage pointer capture consumes a physical arrow click. Real page taps
      // and keyboard navigation must still work; no synthetic onclick shortcut.
      if(!pointerArrowAdvances)await iframe.locator('.sb-zone.sb-next').click();
      await iframe.waitForFunction(()=>document.querySelector('#sbBook .sb-full img')?.alt==='Singapore River');
      await iframe.locator('#zIn').click();assert.equal(await iframe.locator('#zRead').innerText(),'116%');
      await iframe.locator('body').press('ArrowLeft');await iframe.waitForFunction(()=>document.querySelector('#sbBook .sb-full img')?.alt==='Marina Bay Skyline');
      await iframe.locator('#zOut').click();
      const bounds=await iframe.locator('#sbBook').boundingBox();
      const from={x:bounds.x+bounds.width*.82,y:bounds.y+bounds.height*.5},to={x:bounds.x+bounds.width*.2,y:bounds.y+bounds.height*.5};
      let dragInput='mouse pointer';
      if(name==='chromium'&&label!=='desktop'){
        const cdp=await context.newCDPSession(page);dragInput='emulated touch';
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
        for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else{
        await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
      }
      await iframe.waitForFunction(()=>document.querySelector('#sbBook .sb-full img')?.alt==='Singapore River');
      let loupeDrag=false,tilt=false;
      const loupeHidden=await iframe.locator('#loupe').evaluate(el=>getComputedStyle(el).display==='none');
      if(label==='desktop'){
        await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.4);
        await iframe.waitForFunction(()=>Math.abs(parseFloat(document.getElementById('sb3d').style.getPropertyValue('--ry')))>0.1);tilt=true;
        const ring=await iframe.locator('#loupe .ring').boundingBox(),before=await iframe.locator('#loupe').evaluate(el=>el.style.transform);
        await page.mouse.move(ring.x+ring.width*.5,ring.y+ring.height*.45);await page.mouse.down();await page.mouse.move(ring.x+ring.width*.5-60,ring.y+ring.height*.45-40,{steps:6});await page.mouse.up();
        loupeDrag=before!==await iframe.locator('#loupe').evaluate(el=>el.style.transform);assert.equal(loupeDrag,true);
      }else assert.equal(loupeHidden,true,'authored coarse-pointer layout hides loupe');
      for(const image of ['marina-bay-sands','gardens-by-the-bay','merlion','buddha-tooth','joo-chiat','lau-pa-sat','marina-bay-skyline','singapore-river','botanic-gardens'])assert.ok(serverRequests.includes(`/sketchbook/${image}.png`), `${name}/${label} missing ${image}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),viewport.width);
      if(out)await page.screenshot({path:path.join(out,`${name}-${label}.png`),fullPage:true});
      await page.locator('#destroy').click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('.pulse-sketchbook-island').count(),0);
      assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
      results.push({browser:name,label,plates,fontState,pointerArrowAdvances,dragInput,tilt,loupeDrag,loupeHidden,reducedMotion:reducedMotion==='reduce',requests:[...new Set(serverRequests)],errors,failed,passed:true});await context.close();
    }
    await browser.close();browser=null;
  }
  if(out)writeFileSync(path.join(out,'results.json'),JSON.stringify({sourceRevision:manifest.sourceRevision,scope:'Exact original ThreeUI component; browser emulation only',results},null,2)+'\n');
  console.log('PASS exact Sketchbook: lazy entry, nine original spreads, sandbox, fonts, page taps, keyboard turns, zoom, reduced-motion mounting and disposal. Original pointer-arrow behavior recorded separately.');
  const arrowFailures=results.filter(result=>!result.pointerArrowAdvances).length;
  if(arrowFailures)console.log(`KNOWN UPSTREAM LIMITATION: physical pointer clicks on the original arrow buttons did not advance in ${arrowFailures}/${results.length} cases. Page taps, drags and keyboard navigation passed; original source is unchanged.`);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
