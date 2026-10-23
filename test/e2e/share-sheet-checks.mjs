import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
const root=process.cwd(),out=path.join(root,process.env.PPG_SHARE_ARTIFACTS||'.dream-loop/community-share');
const serverRequests=[];
const mime={'.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exampleHash=hash(readFileSync(path.join(root,'app/assets/gallery/quiet-lake-share.jpg')));
mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;serverRequests.push({path:name,method:req.method});
 if(name==='/'){res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:'Water Brush';src:url('/app/fonts/water-brush-latin.woff2')}@font-face{font-family:'DM Sans';src:url('/app/fonts/dm-sans-latin.woff2')}*{margin:0}body{background:#fdfbf7}</style><link rel="stylesheet" href="/app/share-sheet.css"><link rel="stylesheet" href="/app/portrait.css"><div id="host"></div><button id="open">Share artwork</button><button id="save">Save artwork</button><script src="/app/share-sheet.js"></script><script src="/app/portrait.js"></script>`);return;}
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,home='https://www.pulsepainting.com/';
const results=[];let browser;
try{for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
 browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome',headless:true}:{headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 serverRequests.length=0;await page.goto(base);await page.evaluate(async()=>{await document.fonts.load('42px "Water Brush"');});
 await page.evaluate(async()=>{
   window.calls=[];window.sharedFiles=[];window.copyCalls=[];window.publishCalls=[];window.shareMode='cancel';
   window.nativeShare=data=>{
     calls.push({keys:Object.keys(data).sort(),files:data.files?.length,type:data.files?.[0]?.type,name:data.files?.[0]?.name,active:navigator.userActivation?.isActive});
     sharedFiles.push(data.files?.[0]);
     if(shareMode==='hold')return new Promise(resolve=>{window.finishNativeShare=resolve});
     return shareMode==='cancel'?Promise.reject(new DOMException('Cancelled','AbortError')):Promise.resolve();
   };
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
   Object.defineProperty(navigator,'share',{configurable:true,value:nativeShare});
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copyCalls.push(text)}}});
   const blob=await(await fetch('/app/assets/gallery/quiet-lake-share.jpg')).blob();window.testBlob=blob;
   window.openHub=(extra={})=>PulseShare.open({blob,title:'Pulse Painting',onPublish:(...args)=>publishCalls.push({args,sheetOpen:PulseShare.getState().open}),...extra});
   await openHub().ready;
 });
 await page.screenshot({path:path.join(out,`${name}-390.png`)});
 assert.equal(await page.locator('.ps-platform,.ps-paper-toggle,.ps-book-link,iframe').count(),0,'sharing has one artwork flow, without app-specific or book controls');
 assert.equal(await page.locator('.ps-caption').getAttribute('open'),null,'caption is optional and collapsed');
 assert.equal(await page.locator('.ps-caption summary').innerText(),'Caption');
 assert.equal(await page.locator('[data-action="copy-link"]').innerText(),'Copy app link');
 await page.locator('[data-action="copy-link"]').click();assert.equal(await page.evaluate(()=>copyCalls.at(-1)),home);
 await page.locator('.ps-caption summary').click();await page.locator('[data-action="copy-caption"]').click();
 assert.ok((await page.evaluate(()=>copyCalls.at(-1))).includes(home));await page.locator('.ps-caption summary').click();
 assert.equal(await page.locator('.ps-publish').innerText(),'Add to gallery');assert.equal(await page.evaluate(()=>publishCalls.length),0);
 await page.locator('.ps-publish').click();assert.equal(await page.locator('.pulse-share-sheet').count(),0);
 assert.deepEqual(await page.evaluate(()=>publishCalls),[{args:[],sheetOpen:false}],'gallery action closes sharing and requests the separate consent flow without publishing');
 await page.evaluate(async()=>{await openHub().ready});
 await page.locator('.ps-share').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
 assert.equal(await page.evaluate(()=>calls.length),1);assert.equal(await page.locator('.ps-status').innerText(),'','native cancellation is quiet');
 assert.deepEqual(await page.evaluate(()=>calls[0].keys),['files','title']);assert.equal(await page.evaluate(()=>calls[0].active),true,'prepared native file retains the trusted gesture');
 assert.equal(await page.evaluate(async()=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await sharedFiles[0].arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('')),exampleHash,'native share uses exact prepared artwork bytes');
 for(const width of[320,390,768,1440]){
   await page.setViewportSize({width,height:844});
   const layout=await page.evaluate(()=>{const d=document.querySelector('.pulse-share-sheet'),b=document.querySelector('.ps-body'),f=document.querySelector('.ps-footer'),s=document.querySelector('.ps-share');return{scroll:document.documentElement.scrollWidth,dialogScroll:d.scrollWidth,dialogWidth:d.clientWidth,bodyScroll:b.scrollWidth,bodyWidth:b.clientWidth,footerBottom:f.getBoundingClientRect().bottom,shareHeight:s.getBoundingClientRect().height,minFont:Math.min(...[...d.querySelectorAll('p,button,a,summary')].filter(el=>el.textContent.trim()).map(el=>parseFloat(getComputedStyle(el).fontSize)))}});
   assert.equal(layout.scroll,width);assert.ok(layout.dialogScroll<=layout.dialogWidth+1);assert.ok(layout.bodyScroll<=layout.bodyWidth+1);assert.ok(layout.footerBottom<=844);assert.ok(layout.shareHeight>=44);assert.ok(layout.minFont>=14);
   assert.equal(await page.locator('.pulse-share-sheet').evaluate(dialog=>{const r=dialog.getBoundingClientRect();return Math.abs(r.left-(innerWidth-r.width)/2)<1&&Math.abs(r.top-(innerHeight-r.height)/2)<1}),true,'sharing remains centered with the app global margin reset');
   if(width===1440)await page.screenshot({path:path.join(out,`${name}-1440.png`)});
 }
 await page.setViewportSize({width:390,height:844});
 // Unsupported native file sharing keeps both primary and explicit downloads useful.
 await page.evaluate(async()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});await openHub().ready});
 assert.equal(await page.locator('.ps-share').innerText(),'Save image to share');
 for(const selector of['.ps-share','[data-action="save"]']){
   const pending=page.waitForEvent('download');await page.locator(selector).click();const download=await pending;
   const saved=path.join(out,`${name}-${selector==='.ps-share'?'primary':'explicit'}-download.jpg`);await download.saveAs(saved);
   assert.equal(hash(readFileSync(saved)),exampleHash,'download fallback preserves exact prepared artwork');assert.match(download.suggestedFilename(),/\.jpg$/);
 }
 const permalink='https://www.pulsepainting.com/p/12345678-1234-1234-1234-123456789abc';
 await page.evaluate(async url=>{await openHub({publicURL:url,openBook:true}).ready},permalink);
 assert.equal(await page.locator('[data-action="copy-link"]').innerText(),'Copy painting link');assert.equal(await page.locator('.ps-publish').isVisible(),false);
 await page.locator('[data-action="copy-link"]').click();assert.equal(await page.evaluate(()=>copyCalls.at(-1)),permalink);
 assert.equal(await page.locator('iframe').count(),0,'legacy openBook options cannot load a book from sharing');
 for(const invalid of[`${permalink}?owner=secret`,`${permalink}#remove=${'a'.repeat(64)}`,'https://www.pulsepainting.com/book/12345678-1234-1234-1234-123456789abc','https://evil.example/p/123?delete=token','https://user:secret@www.pulsepainting.com/p/12345678-1234-1234-1234-123456789abc',`${permalink}/`]){
   await page.evaluate(async publicURL=>{await openHub({publicURL}).ready},invalid);assert.equal(await page.evaluate(()=>PulseShare.getState().published),false);
   await page.locator('[data-action="copy-link"]').click();assert.equal(await page.evaluate(()=>copyCalls.at(-1)),home,'only an exact safe public painting URL is copied');
 }
 const external=[];page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url())});
 await page.evaluate(async()=>{PulseShare.close();await PulseShare.open({imageURL:'https://evil.example/private.jpg'}).ready});
 assert.equal(await page.evaluate(()=>PulseShare.getState().ready),false);assert.ok(!external.some(url=>url.includes('evil.example')));
 // A late native-share completion cannot resurrect a closed sheet.
 await page.evaluate(async()=>{shareMode='hold';Object.defineProperty(navigator,'share',{configurable:true,value:nativeShare});await openHub().ready});
 await page.locator('.ps-share').click();await page.locator('.ps-close').click();await page.evaluate(()=>finishNativeShare());
 assert.equal(await page.locator('.pulse-share-sheet').count(),0);
 await page.evaluate(async()=>{history.pushState({},'', '#share-test');await openHub().ready});await page.goBack();await page.waitForFunction(()=>!PulseShare.getState().open);
 assert.equal(await page.locator('.pulse-share-sheet').count(),0,'browser Back closes sharing');
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
 assert.equal(serverRequests.some(request=>/sketchbook|react/i.test(request.path)),false,'artwork sharing never imports React, the book renderer or its assets');
 assert.ok(serverRequests.every(request=>['GET','HEAD'].includes(request.method)),'sharing and public preview do not upload or publish automatically');
 assert.deepEqual(errors,[]);results.push({name,publication,errors,passed:true});await context.close();await browser.close();browser=null;
 }}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS simple artwork sharing, trusted native files, exact downloads, strict links, optional caption, 320–1440 layouts and default-private publication in Chromium/WebKit');
