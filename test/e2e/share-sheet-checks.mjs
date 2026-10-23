import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
const root=process.cwd(),out=path.join(root,process.env.PPG_SHARE_ARTIFACTS||'.dream-loop/community-share');
const entry=path.resolve(root,process.env.PPG_SKETCHBOOK_ENTRY||'dist/sketchbook-entry.js');
const serverRequests=[];
const mime={'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;serverRequests.push(name);
 if(name.startsWith('/sketchbook/'))res.setHeader('Access-Control-Allow-Origin','*');
 if(name==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:'Water Brush';src:url('/app/fonts/water-brush-latin.woff2')}@font-face{font-family:'DM Sans';src:url('/app/fonts/dm-sans-latin.woff2')}*{margin:0}body{background:#fdfbf7}</style><link rel="stylesheet" href="/app/share-sheet.css"><link rel="stylesheet" href="/app/portrait.css"><div id="host"></div><button id="open">Share artwork</button><button id="save">Save artwork</button><script src="/app/share-sheet.js"></script><script src="/app/portrait.js"></script>`);return;}
 const file=name==='/app/sketchbook-entry.js'?entry:path.resolve(root,'.'+(name.startsWith('/sketchbook/')?'/app'+name:name));if(!file.startsWith(root+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const results=[];
try{for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch(name==="chromium"?{channel:"chrome",headless:true}:{headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 serverRequests.length=0;await page.goto(base);await page.evaluate(async()=>{await document.fonts.load('42px "Water Brush"');});
 await page.evaluate(async()=>{
   window.calls=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.calls.push({files:data.files.length,type:data.files[0].type,name:data.files[0].name,active:navigator.userActivation?.isActive});return Promise.reject(new DOMException('Cancelled','AbortError'));}});
   const blob=await(await fetch('/app/assets/gallery/quiet-lake-share.jpg')).blob();window.testBlob=blob;
   window.openHub=(extra={})=>PulseShare.open({blob,title:'Pulse Painting',onPublish:()=>{window.published=true},...extra});
   await window.openHub().ready;
 });
 await page.screenshot({path:path.join(out,`${name}-390.png`)});
 assert.equal(await page.locator('.ps-platform').count(),6);
 assert.equal(serverRequests.some(url=>url.includes('sketchbook')),false,'normal sharing does not load React, the study or its assets');
 assert.equal(await page.locator('[data-action="copy-link"]').innerText(),'Copy app link');
 const hrefs=await page.locator('a.ps-platform').evaluateAll(nodes=>nodes.map(n=>n.href));
 assert.ok(hrefs.every(h=>h.includes('www.pulsepainting.com%2F')),'private link intents use homepage');
 await page.locator('.ps-share').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
 assert.equal(await page.evaluate(()=>calls.length),1);assert.equal(await page.locator('.ps-status').innerText(),'');
 assert.equal(await page.evaluate(()=>calls[0].active),true,'native call retains gesture');
 await page.locator('[data-platform="instagram"]').scrollIntoViewIfNeeded();await page.locator('[data-platform="instagram"]').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);assert.equal(await page.evaluate(()=>calls.length),2);
 for(const width of[320,390,768,1440]){
   await page.setViewportSize({width,height:844});
   const layout=await page.evaluate(()=>{const d=document.querySelector('.pulse-share-sheet'),b=document.querySelector('.ps-body'),f=document.querySelector('.ps-footer'),s=document.querySelector('.ps-share');return{viewport:innerWidth,scroll:document.documentElement.scrollWidth,dialogScroll:d.scrollWidth,dialogWidth:d.clientWidth,bodyScroll:b.scrollWidth,bodyWidth:b.clientWidth,footerBottom:f.getBoundingClientRect().bottom,shareHeight:s.getBoundingClientRect().height,minFont:Math.min(...[...d.querySelectorAll('p,button,a,summary')].map(el=>parseFloat(getComputedStyle(el).fontSize)))}});
   assert.equal(layout.scroll,width);assert.ok(layout.dialogScroll<=layout.dialogWidth+1);assert.ok(layout.bodyScroll<=layout.bodyWidth+1);assert.ok(layout.footerBottom<=844);assert.ok(layout.shareHeight>=44);assert.ok(layout.minFont>=14);
   const centered=await page.locator('.pulse-share-sheet').evaluate(dialog=>{const r=dialog.getBoundingClientRect();return Math.abs(r.left-(innerWidth-r.width)/2)<1&&Math.abs(r.top-(innerHeight-r.height)/2)<1});
   assert.equal(centered,true,'sharing stays centered even with the app global margin reset');
   if(width===1440)await page.screenshot({path:path.join(out,`${name}-1440.png`)});
 }
 const permalink='https://www.pulsepainting.com/p/12345678-1234-1234-1234-123456789abc';
 await page.evaluate(async url=>{await openHub({publicURL:url}).ready},permalink);
 assert.equal(await page.locator('[data-action="copy-link"]').innerText(),'Copy link');assert.equal(await page.locator('.ps-publish').isVisible(),false);
 assert.ok((await page.locator('[data-platform="facebook"]').getAttribute('href')).includes(encodeURIComponent(permalink)));
 await page.evaluate(async()=>{await openHub({publicURL:'https://evil.example/p/123?delete=token'}).ready});assert.equal(await page.evaluate(()=>PulseShare.getState().published),false);
 const external=[];page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url())});
 await page.evaluate(async()=>{PulseShare.close();await PulseShare.open({imageURL:'https://evil.example/private.jpg'}).ready});
 assert.equal(await page.evaluate(()=>PulseShare.getState().ready),false);assert.ok(!external.some(url=>url.includes('evil.example')));
 await page.evaluate(()=>PulseShare.close());
 // Closing while the optional import is still in flight cannot open a study
 // later, fetch its plates, or steal focus from the sharing flow.
 let heldImport,importRequested;
 const importSeen=new Promise(resolve=>{importRequested=resolve});
 await page.route('**/app/sketchbook-entry.js',route=>{heldImport=route;importRequested()});
 await page.evaluate(async()=>{await openHub().ready});
 await page.locator('.ps-paper-toggle').click();await importSeen;
 await page.locator('.ps-close').click();
 await heldImport.fulfill({status:200,contentType:'text/javascript',body:readFileSync(entry,'utf8')});
 await page.unroute('**/app/sketchbook-entry.js');await page.waitForTimeout(200);
 assert.equal(await page.locator('iframe').count(),0);assert.equal(serverRequests.some(url=>url.startsWith('/sketchbook/')),false,'abandoned import never mounts or fetches the plates');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{await openHub().ready});
 const originalPreview=await page.locator('.ps-preview img').getAttribute('src');
 await page.locator('.ps-paper-toggle').click();await page.locator('iframe').waitFor();
 const study=page.frames().find(frame=>frame!==page.mainFrame());
 await study.waitForFunction(()=>document.body.dataset.ready==='1');
 await study.waitForFunction(()=>[...document.querySelectorAll('.sb-book img')].some(image=>image.complete&&image.naturalWidth===1760&&image.naturalHeight===1240));
 await page.waitForFunction(()=>document.querySelector('.ps-paper-status').textContent.startsWith('Drag or tap'));
 assert.equal(await study.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
 assert.equal(await study.locator('#plateList .plate').count(),3);
 assert.equal(await page.locator('.ps-preview img').getAttribute('src'),originalPreview,'original personal artwork remains unchanged');
 assert.equal(await page.locator('.ps-share').isEnabled(),true,'primary sharing remains ready beside the study');
 await page.screenshot({path:path.join(out,`${name}-paper-390.png`)});
 await page.locator('.ps-paper-close').click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('.ps-paper').isVisible(),false);
 await page.locator('.ps-paper-toggle').click();await page.locator('iframe').waitFor();await page.locator('.ps-close').click();
 assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('.pulse-share-sheet').count(),0);
 const backPage=await context.newPage();await backPage.goto(base);
 let heldBackImport,backRequested;
 const backSeen=new Promise(resolve=>{backRequested=resolve});
 await backPage.route('**/app/sketchbook-entry.js',route=>{heldBackImport=route;backRequested()});
 await backPage.evaluate(async()=>{history.pushState({},'', '#share-test');const blob=await(await fetch('/app/assets/gallery/quiet-lake-share.jpg')).blob();await PulseShare.open({blob}).ready});
 await backPage.locator('.ps-paper-toggle').click();await backSeen;await backPage.goBack();
 await backPage.waitForFunction(()=>!PulseShare.getState().open);
 await heldBackImport.fulfill({status:200,contentType:'text/javascript',body:readFileSync(entry,'utf8')});await backPage.waitForTimeout(100);
 assert.equal(await backPage.locator('iframe').count(),0,'browser Back invalidates a pending study import');await backPage.close();
 const publication=await page.evaluate(async()=>{
   const image=new Image();image.src='/app/assets/gallery/quiet-lake.webp';await image.decode();
   window.PulseLandscape={FAMILIES:[{id:'quiet-lake',name:'Quiet lake'}],render:(scene,c)=>c.getContext('2d').drawImage(image,0,0,c.width,c.height)};
   const host=document.getElementById('host');window.host=host;
   await PulsePortrait.mount(host,{landscape:{family:'quiet-lake',strokes:[1],usableSeconds:148.9,seed:12},startedAt:new Date('2026-10-21T16:31:32Z'),metrics:{hr:71,rmssd:62,sdnn:51},shareButton:document.getElementById('open'),saveButton:document.getElementById('save')});
   const initial=PulsePortrait.getState(host);const checkbox=host.querySelector('input');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,200));
   const labels=[],original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(...args){labels.push(args[0]);return original.apply(this,args)};
   const privatePublic=await PulsePortrait.preparePublication({},host);const privateLabels=[...labels];labels.length=0;
   const optedIn=await PulsePortrait.preparePublication({includeMetrics:true},host);CanvasRenderingContext2D.prototype.fillText=original;
   return {initial,after:PulsePortrait.getState(host),plain:{bytes:privatePublic.blob.size,type:privatePublic.blob.type,metrics:privatePublic.metrics,revision:privatePublic.revision,labels:privateLabels},opted:{metrics:optedIn.metrics,labels}};
 });
 assert.equal(publication.plain.metrics,null);assert.equal(publication.plain.type,'image/jpeg');assert.ok(publication.plain.bytes<=2*1024*1024);assert.equal(publication.initial.revision,publication.after.revision);assert.equal(publication.after.includeMetrics,true);
 assert.ok(!publication.plain.labels.some(text=>/2026|148|2 min|Pulse$|RMSSD|SDNN|62 ms|51 ms/.test(text)));assert.deepEqual(publication.opted.metrics,{hr:71,rmssd:62,sdnn:51});
 await page.locator('#open').click();await page.waitForFunction(()=>PulseShare.getState().ready);assert.equal(await page.locator('.pulse-share-sheet').isVisible(),true);
 const stale=await page.evaluate(async()=>{const pending=PulsePortrait.preparePublication({},host);PulsePortrait.clear(host);try{await pending;return false}catch(error){return error.message.includes("report changed")}});assert.equal(stale,true,"replaced report cannot publish a stale canvas");assert.equal(await page.locator('.pulse-share-sheet').count(),0);
 assert.deepEqual(errors,[]);results.push({name,publication,errors,passed:true});await context.close();await browser.close();
 }}finally{await new Promise(resolve=>server.close(resolve));}
writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS sharing handoffs, cancellation, URL restrictions, 320–1440 layouts and default-private publication in Chromium/WebKit');
