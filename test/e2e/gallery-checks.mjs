// Desktop examples are generated from the public fixture, never visitor data.
// Native sharing and clipboard I/O are mocked. No physical scanner/share claim.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PPG_GALLERY_ARTIFACTS&&path.resolve(root,process.env.PPG_GALLERY_ARTIFACTS);
if(out)mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2'};
const server=createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'dist','.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(path.join(root,'dist')+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(readFileSync(file));});
const manifest=JSON.parse(readFileSync(path.join(root,'app/assets/gallery/manifest.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// A local design preview may deliberately use an immutable older renderer.
// Release/CI runs omit this override and must match the current app source.
const provisionalRenderer=process.env.PPG_GALLERY_PROVISIONAL_RENDERER;
if(provisionalRenderer){
 assert.ok(process.env.PPG_GALLERY_URL,'a provisional renderer requires an explicit local preview URL');
 assert.ok(!process.env.CI&&['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.PPG_GALLERY_URL).hostname),'provisional renderer overrides are only allowed for local design QA');
}
const rendererPath=path.resolve(root,provisionalRenderer||'app/landscape.js');
assert.equal(manifest.rendererSha256,hash(readFileSync(rendererPath)),'gallery images must be regenerated from the current renderer before release');
assert.equal(manifest.kind,'public-fixture-examples');assert.equal(manifest.scenes.length,16);assert.equal(new Set(manifest.scenes.map(s=>s.id)).size,16);
assert.equal(manifest.fixtureSha256,hash(readFileSync(path.join(root,manifest.fixture))),'gallery derives from the checked-in public fixture');
assert.equal(manifest.engineSha256,hash(readFileSync(path.join(root,'vendor/ppg-js/0.3.1/ppg.global.js'))),'gallery derives from the current pinned signal engine');
const appSource=readFileSync(path.join(root,'app/app.js'),'utf8');
const adapter=appSource.slice(appSource.indexOf('function acceptPaintWindow(metrics)'),appSource.indexOf('function paintManuscript(canvas'));
assert.ok(adapter.startsWith('function acceptPaintWindow(metrics)'),'actual accepted-window adapter is available');
assert.equal(manifest.adapterSha256,hash(adapter),'gallery derives from the current accepted-window adapter');
for(const scene of manifest.scenes){for(const [file,digest]of[[scene.image,scene.imageSha256],[scene.thumbnail,scene.thumbnailSha256],[scene.shareImage,scene.shareSha256]])assert.equal(hash(readFileSync(path.join(root,'app/assets/gallery',file))),digest,'published example matches its provenance manifest');}
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=process.env.PPG_GALLERY_URL||`http://127.0.0.1:${server.address().port}/`;
const results={scope:'Desktop browser UI; public fixture examples; mocked native share/clipboard; no physical phone or native-share acceptance',provisionalRenderer:Boolean(provisionalRenderer),rendererSha256:manifest.rendererSha256,browsers:[]};
let browser;
async function plainTextContrast(page,selector){
 const result=await page.locator(selector).first().evaluate(el=>{
  const rgb=value=>value.match(/[\d.]+/g).map(Number),luminance=color=>color.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  let parent=el,background;
  while(parent){const color=rgb(getComputedStyle(parent).backgroundColor);if(color.length===3||color[3]===1){background=color;break;}parent=parent.parentElement;}
  if(!background)throw Error('No opaque text background');
  const fg=luminance(rgb(getComputedStyle(el).color)),bg=luminance(background);
  return{ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),fontSize:getComputedStyle(el).fontSize};
 });
 assert.ok(result.ratio>=4.5,`${selector}: normal-text contrast ${result.ratio.toFixed(2)}:1`);return{selector,...result};
}
try{
 for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
  browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],failed=[],nonReadRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).origin===new URL(url).origin&&r.status()>=400)failed.push({path:new URL(r.url()).pathname,status:r.status()});});page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))nonReadRequests.push(r.method());});
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.gallery-card').length===16);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#desktop-phone-panel').isVisible(),true);assert.equal(await page.locator('#btn-start').isVisible(),false);
  await page.locator('#screen-ready').evaluate(el=>{el.hidden=true});assert.equal(await page.locator('#desktop-phone-panel').isVisible(),false,'desktop decoration respects screen lifecycle hiding');await page.locator('#screen-ready').evaluate(el=>{el.hidden=false});
  assert.match(await page.locator('.gallery-example-note').last().innerText(),/Example landscapes made from a public pulse recording/);
  const brushHeadings=await page.locator('#screen-ready h1,#screen-ready h2').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).fontFamily.includes('Water Brush')).length);assert.equal(brushHeadings,1);
  const widths=[];
  for(const width of[320,634,1024,1440,1920]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.getElementById('desktop-hero-title').getBoundingClientRect().toJSON()}));assert.equal(bounds.scroll,width,`${name}/${width}: no horizontal overflow`);assert.ok(bounds.title.left>=0&&bounds.title.right<=width,`${name}/${width}: headline fits`);widths.push(bounds);}
  await page.setViewportSize({width:1440,height:1000});
  for(const [filter,count]of[['water',8],['land',6],['sky',2],['all',16]]){await page.locator(`[data-gallery-filter="${filter}"]`).click();assert.equal(await page.locator('.gallery-card:visible').count(),count);assert.equal(await page.locator(`[data-gallery-filter="${filter}"]`).getAttribute('aria-pressed'),'true');}
  const opener=page.getByRole('button',{name:'Open Meadow example',exact:true});await opener.click();const dialog=page.locator('.gallery-lightbox');await dialog.waitFor({state:'visible'});
  const textContrast=[];for(const selector of['.gallery-card-caption>span','.gallery-step-index','.gallery-lightbox .gallery-eyebrow','.gallery-lightbox-note'])textContrast.push(await plainTextContrast(page,selector));
  for(let i=0;i<16;i++){assert.equal(await dialog.locator('h2').innerText(),manifest.scenes[i].name);await dialog.locator('img').evaluate(image=>image.decode());assert.equal(await dialog.locator('img').evaluate(i=>i.naturalWidth),1080);await page.keyboard.press('ArrowRight');}
  assert.equal(await dialog.locator('h2').innerText(),'Meadow');await page.keyboard.press('ArrowLeft');assert.equal(await dialog.locator('h2').innerText(),'Aurora night');
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.gallery-lightbox'))),true,`${name}: native dialog contains keyboard focus`);}
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);await opener.evaluate(el=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));assert.equal(await opener.evaluate(el=>document.activeElement===el),true,`${name}: close restores the gallery opener`);
  await opener.click();await page.waitForFunction(()=>!document.querySelector('.gallery-share').disabled);
  await page.evaluate(()=>{window.__galleryShares=[];window.__galleryCopies=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{const file=payload.files?.[0];window.__galleryShares.push({keys:Object.keys(payload).sort(),title:payload.title,url:payload.url,file:file?{name:file.name,type:file.type,size:file.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('')}:null});}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__galleryCopies.push(text)}});});
  await dialog.getByRole('button',{name:'Share this landscape',exact:true}).click();await page.waitForFunction(()=>__galleryShares.length===1);
  const fileShare=await page.evaluate(()=>__galleryShares[0]);assert.deepEqual(fileShare.keys,['files','title']);assert.equal(fileShare.file.sha256,manifest.scenes[0].shareSha256,'native sharing uses the actual labeled example pixels');assert.equal(fileShare.file.type,'image/jpeg');
  await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));await dialog.getByRole('button',{name:'Share this landscape',exact:true}).click();await page.waitForFunction(()=>__galleryShares.length===2);assert.equal(await page.evaluate(()=>__galleryShares[1].url),'https://www.pulsepainting.com/?scene=meadow#landscapes','unsupported file sharing falls back to canonical example link');
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}}));await dialog.getByRole('button',{name:'Share this landscape',exact:true}).click();assert.equal(await dialog.locator('.gallery-share-status').innerText(),'','native share cancellation is quiet');
  await dialog.getByRole('button',{name:'Copy example link',exact:true}).click();assert.deepEqual(await page.evaluate(()=>__galleryCopies),['https://www.pulsepainting.com/?scene=meadow#landscapes']);
  if(out)await page.screenshot({path:path.join(out,`${name}-lightbox.png`)});
  await dialog.getByRole('button',{name:'Make a painting of your own ↗',exact:true}).click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'paint-on-phone');
  const mobile=await browser.newContext({...devices['iPhone 13'],reducedMotion:'reduce'}),phone=await mobile.newPage(),requests=[];phone.on('request',r=>requests.push(new URL(r.url()).pathname));await phone.goto(url);await phone.evaluate(()=>document.fonts.ready);await phone.waitForTimeout(200);assert.equal(await phone.locator('#btn-start').isVisible(),true);assert.equal(await phone.locator('#desktop-phone-panel').isVisible(),false);assert.deepEqual(requests.filter(p=>p.includes('/assets/gallery/')),[],'default phone capture fetches no gallery data or images');
  await phone.goto(`${url}?scene=quiet-lake#landscapes`);await phone.locator('.gallery-lightbox').waitFor({state:'visible'});assert.equal(await phone.locator('.gallery-lightbox h2').innerText(),'Quiet lake');await phone.getByRole('button',{name:'Make a painting of your own ↗',exact:true}).click();assert.equal(await phone.locator('#btn-start').isVisible(),true);assert.equal(await phone.evaluate(()=>document.activeElement.id),'btn-start');
  const delayed=await mobile.newPage(),delayedErrors=[],delayedAssets=[];let heldManifest,manifestRequested;
  delayed.on('pageerror',error=>delayedErrors.push(error.message));delayed.on('request',request=>{if(new URL(request.url()).pathname.includes('/assets/gallery/'))delayedAssets.push(new URL(request.url()).pathname);});
  const requested=new Promise(resolve=>{manifestRequested=resolve;});
  await delayed.route('**/assets/gallery/manifest.json',route=>{heldManifest=route;manifestRequested();});
  await delayed.goto(`${url}?scene=quiet-lake#landscapes`,{waitUntil:'domcontentloaded'});await requested;
  await delayed.evaluate(()=>{
    // Hold only camera acquisition; use the real monitor lifecycle and Start action.
    window.PPGMonitor=class extends PPG.PPGMonitor{
      constructor(host,options){super(host,{...options,wakeLock:false,motion:false,debug:{persistLastSession:false}});}
      async _openCamera(){window.__galleryCameraPending=true;await new Promise(()=>{});}
      _installWatchers(){} _scheduleNextFrame(){}
    };
  });
  await delayed.getByRole('button',{name:'Begin pulse capture',exact:true}).click();await delayed.waitForFunction(()=>window.__galleryCameraPending===true);
  assert.equal(await delayed.locator('#screen-placement').isVisible(),true,'real Start action reaches placement while the gallery manifest is delayed');
  await heldManifest.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)});
  await delayed.waitForFunction(()=>Boolean(document.querySelector('.gallery-lightbox')));
  assert.equal(await delayed.locator('.gallery-lightbox[open]').count(),0,'late startup example cannot cover active placement');
  assert.equal(await delayed.locator('#screen-placement').isVisible(),true);assert.equal(await delayed.locator('#screen-ready').isVisible(),false);
  assert.ok(delayedAssets.every(file=>file.endsWith('/manifest.json')),'suppressed example does not fetch artwork while capture starts');assert.deepEqual(delayedErrors,[]);
  await delayed.locator('#btn-cancel-placement').click();assert.equal(await delayed.locator('#screen-ready').isVisible(),true);assert.equal(await delayed.locator('.gallery-lightbox[open]').count(),0,'suppressed startup example stays dismissed after cancellation');
  const delayedDeepLink={startedCapture:true,placementPreserved:true,modalOpened:false,errors:delayedErrors,galleryRequests:delayedAssets};await mobile.close();
  const unavailable=await browser.newPage({viewport:{width:1440,height:1000}});await unavailable.route('**/assets/gallery/manifest.json',r=>r.fulfill({status:503,body:'Unavailable'}));await unavailable.goto(url);await unavailable.getByText('The example gallery could not load. You can still scan the code to make your own painting.',{exact:true}).waitFor();assert.equal(await unavailable.locator('#phone-qr').isVisible(),true,'manifest failure preserves phone handoff');assert.equal(await unavailable.locator('.gallery-lightbox').count(),0,'failed data creates no broken modal');await unavailable.close();
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(nonReadRequests,[],'gallery never uploads biometric data or artwork');results.browsers.push({name,widths,textContrast,fileShare,delayedDeepLink,errors,failed,nonReadRequests,mobileDefaultGalleryRequests:[]});await browser.close();browser=undefined;
 }
 results.passed=true;if(out)writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log('PASS gallery: 16 actual examples, responsive desktop, keyboard lightbox, exact image sharing, canonical link fallback, quiet cancellation, phone deep links, manifest failure and no phone gallery downloads');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
