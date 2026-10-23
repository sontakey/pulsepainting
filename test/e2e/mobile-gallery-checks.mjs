// Phone gallery navigation and layout in browser emulation. Camera acquisition
// and touch pointer input are controlled here; this is not physical-phone QA.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PPG_MOBILE_GALLERY_ARTIFACTS&&path.resolve(root,process.env.PPG_MOBILE_GALLERY_ARTIFACTS);
if(out)mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync(path.join(root,'app/assets/gallery/manifest.json')));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'dist','.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(path.join(root,'dist')+'/')||!existsSync(file)||!statSync(file).isFile()){
    res.writeHead(404);res.end();return;
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=process.env.PPG_GALLERY_URL||`http://127.0.0.1:${server.address().port}/`;
const results={scope:'Chromium/WebKit phone emulation; synthetic touch pointers; mocked camera acquisition; no physical-phone or native-sharing claim',browsers:[]};
const galleryRequests=requests=>requests.filter(p=>p.includes('/assets/gallery/'));
const isGallery=page=>page.locator('#screen-ready').evaluate(el=>el.classList.contains('mobile-gallery-open'));
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const closeButton=page=>page.getByRole('button',{name:'Close landscape',exact:true});
async function waitGallery(page){
  await page.waitForFunction(()=>document.getElementById('screen-ready').classList.contains('mobile-gallery-open')&&document.querySelectorAll('.gallery-card').length===16);
  await settle(page);
}
async function waitReady(page){
  await page.waitForFunction(()=>!document.getElementById('screen-ready').hidden&&!document.getElementById('screen-ready').classList.contains('mobile-gallery-open'));
  assert.equal(await page.locator('#btn-start').isVisible(),true);
}
async function holdCamera(page){
  await page.evaluate(()=>{
    // Keep the actual Start/Cancel lifecycle. Only camera acquisition waits.
    window.PPGMonitor=class extends PPG.PPGMonitor{
      constructor(host,options){super(host,{...options,wakeLock:false,motion:false,debug:{persistLastSession:false}});}
      async _openCamera(){window.__mobileGalleryCameraPending=true;await new Promise(()=>{});}
      _installWatchers(){} _scheduleNextFrame(){}
    };
  });
}
async function swipe(page,direction){
  await page.locator('.gallery-lightbox-art').evaluate((el,direction)=>{
    const r=el.getBoundingClientRect(),y=r.top+r.height/2;
    const from=r.left+r.width*(direction==='left'?.8:.2),to=r.left+r.width*(direction==='left'?.2:.8);
    const send=(type,x)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:9,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1}));
    send('pointerdown',from);send('pointermove',to);send('pointerup',to);
  },direction);
}
async function layout(page,width,name){
  await page.setViewportSize({width,height:844});await settle(page);
  const state=await page.evaluate(()=>{
    const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
    const rect=el=>({id:el.id,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,fontSize:parseFloat(getComputedStyle(el).fontSize)});
    return {
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
      brushHeadings:[...document.querySelectorAll('#screen-ready :is(h1,h2)')].filter(el=>visible(el)&&getComputedStyle(el).fontFamily.includes('Water Brush')).map(el=>el.textContent),
      dock:rect(document.querySelector('#screen-ready .mobile-action-dock')),
      controls:[document.getElementById('btn-gallery-back'),document.getElementById('btn-start'),...document.querySelectorAll('[data-gallery-filter]')].filter(visible).map(rect),
      fonts:[...document.querySelectorAll('.gallery-card-caption strong,.gallery-example-note')].filter(visible).map(el=>parseFloat(getComputedStyle(el).fontSize)),
    };
  });
  assert.equal(state.scrollWidth,width,`${name}/${width}: no horizontal overflow`);
  assert.equal(state.brushHeadings.length,1,`${name}/${width}: exactly one visible brush heading`);
  assert.ok(state.dock.top>=0&&state.dock.bottom<=state.height+1,`${name}/${width}: floating actions stay in viewport`);
  assert.ok(state.dock.bottom>state.height-100,`${name}/${width}: actions remain near the bottom`);
  for(const control of state.controls){
    assert.ok(control.height>=44&&control.width>=44,`${name}/${width}/${control.id}: touch target fits`);
    assert.ok(control.fontSize>=14,`${name}/${width}/${control.id}: control text is readable`);
  }
  assert.ok(state.fonts.every(size=>size>=14),`${name}/${width}: artwork names and supporting copy remain readable`);
  return state;
}
let browser;
try{
  for(const [name,engine]of[['chromium',chromium],['webkit',webkit]]){
    browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
    const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[],requests=[],writes=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{requests.push(new URL(request.url()).pathname);if(!['GET','HEAD'].includes(request.method()))writes.push(request.method());});
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);await settle(page);
    assert.equal(await page.getByRole('button',{name:'Explore the paintings',exact:true}).isVisible(),true,'phone has a discoverable gallery entrance');
    assert.deepEqual(galleryRequests(requests),[],'ready does not fetch gallery data or artwork');
    assert.equal(await page.locator('#desktop-phone-panel').isVisible(),false);
    if(out)await page.screenshot({path:path.join(out,`${name}-ready.png`)});
    await page.locator('#btn-explore-gallery').click();await waitGallery(page);
    assert.equal(await page.locator('#desktop-phone-panel').isVisible(),true);
    assert.equal(await page.locator('#phone-qr').isVisible(),false,'mobile gallery does not ask the phone visitor to scan a QR');
    assert.equal(await page.getByRole('button',{name:'Back to capture',exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('button',{name:'Start painting',exact:true}).isVisible(),true,'gallery reuses the real capture button');
    assert.ok(galleryRequests(requests).some(p=>p.endsWith('/manifest.json')),'explicit opening fetches gallery data');
    assert.equal(await page.locator('.gallery-card img').evaluateAll(images=>images.every(image=>image.loading==='lazy')),true,'gallery thumbnails are lazy');
    await page.locator('.gallery-card:visible img').first().evaluate(image=>image.decode());
    assert.equal(await page.locator('.gallery-card:visible img').first().evaluate(image=>image.naturalWidth),640,'the mobile gallery shows an actual artwork thumbnail');
    const widths=[];for(const width of[320,390,430])widths.push(await layout(page,width,name));
    await page.setViewportSize({width:390,height:844});await settle(page);
    if(out){
      await page.screenshot({path:path.join(out,`${name}-gallery-viewport.png`)});
      await page.screenshot({path:path.join(out,`${name}-gallery.png`),fullPage:true});
    }
    for(const [filter,count]of[['water',8],['land',6],['sky',2],['all',16]]){
      await page.locator(`[data-gallery-filter="${filter}"]`).click();assert.equal(await page.locator('.gallery-card:visible').count(),count);
    }
    // Last gallery content must be scrollable above the floating action dock.
    await settle(page);
    await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await settle(page);
    const tail=await page.evaluate(()=>({note:document.querySelector('#landscapes .gallery-example-note:last-child').getBoundingClientRect().bottom,dock:document.querySelector('#screen-ready .mobile-action-dock').getBoundingClientRect().top,scrollY,scrollHeight:document.documentElement.scrollHeight,innerHeight,reserve:getComputedStyle(document.documentElement).getPropertyValue('--mobile-dock-reserve'),appPadding:getComputedStyle(document.getElementById('app')).paddingBottom,readyPadding:getComputedStyle(document.getElementById('screen-ready')).paddingBottom}));
    if(out)await page.screenshot({path:path.join(out,`${name}-gallery-bottom.png`)});
    assert.ok(tail.note<=tail.dock+1,`${name}: floating actions do not cover the last gallery note: ${JSON.stringify(tail)}`);
    await page.getByRole('button',{name:'Open Meadow example',exact:true}).click();
    const dialog=page.locator('.gallery-lightbox');await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.locator('h2').innerText(),'Meadow');
    await swipe(page,'left');await page.waitForFunction(()=>document.querySelector('.gallery-lightbox h2').textContent==='Open ocean');
    await swipe(page,'right');await page.waitForFunction(()=>document.querySelector('.gallery-lightbox h2').textContent==='Meadow');
    if(out)await page.screenshot({path:path.join(out,`${name}-viewer.png`)});
    // A horizontal scene change replaces viewer history, rather than adding a
    // Back entry for every swipe. Back should return to the gallery immediately.
    await page.goBack();await dialog.waitFor({state:'hidden'});assert.equal(await isGallery(page),true,'browser Back closes viewer first');
    await page.goBack();await waitReady(page);assert.equal(await page.locator('#desktop-phone-panel').isVisible(),false,'browser Back then returns to capture instructions');
    await page.locator('#btn-explore-gallery').click();await waitGallery(page);
    await page.locator('#btn-gallery-back').click();await waitReady(page);
    const backFocus=await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,hidden:!document.activeElement.getClientRects().length,url:location.href}));
    assert.equal(backFocus.id,'btn-explore-gallery',`Back restores the entrance focus: ${JSON.stringify(backFocus)}`);

    // Shared links open a mobile viewer with a gallery behind it; closing must
    // remain inside this app even when there is no prior app history entry.
    const linked=await context.newPage();
    await linked.goto(`${url}?scene=quiet-lake#landscapes`);await linked.locator('.gallery-lightbox').waitFor({state:'visible'});
    assert.equal(await isGallery(linked),true);assert.equal(await linked.locator('.gallery-lightbox h2').innerText(),'Quiet lake');
    await closeButton(linked).click();await linked.locator('.gallery-lightbox').waitFor({state:'hidden'});await waitGallery(linked);
    assert.equal(new URL(linked.url()).origin,new URL(url).origin);
    assert.equal(await linked.getByRole('button',{name:'Open Quiet lake example',exact:true}).evaluate(el=>document.activeElement===el),true,'direct-link close focuses its visible gallery card');
    await linked.goForward();await linked.locator('.gallery-lightbox').waitFor({state:'visible'});
    assert.equal(await linked.locator('.gallery-lightbox h2').innerText(),'Quiet lake','browser Forward reopens the same scene');
    await closeButton(linked).click();await linked.locator('.gallery-lightbox').waitFor({state:'hidden'});await waitGallery(linked);
    await linked.getByRole('button',{name:'Open Quiet lake example',exact:true}).click();
    await linked.getByRole('button',{name:'Make a painting of your own ↗',exact:true}).click();await waitReady(linked);
    assert.equal(await linked.evaluate(()=>document.activeElement.id),'btn-start');await linked.close();

    // Slow data must not reopen the gallery after Back or cover camera setup.
    const delayedResults=[];
    for(const action of['back','start']){
      const delayed=await context.newPage(),delayedRequests=[],delayedErrors=[];let heldManifest,requested;
      delayed.on('request',r=>delayedRequests.push(new URL(r.url()).pathname));delayed.on('pageerror',e=>delayedErrors.push(e.message));
      const manifestRequested=new Promise(resolve=>{requested=resolve;});
      await delayed.route('**/assets/gallery/manifest.json',route=>{heldManifest=route;requested();});
      await delayed.goto(url);await delayed.locator('#btn-explore-gallery').click();await manifestRequested;
      if(action==='back'){await delayed.locator('#btn-gallery-back').click();await waitReady(delayed);}
      else{
        await holdCamera(delayed);await delayed.locator('#btn-start').click();
        await delayed.waitForFunction(()=>window.__mobileGalleryCameraPending===true);
        assert.equal(await delayed.locator('#screen-placement').isVisible(),true);
      }
      await heldManifest.fulfill({status:200,contentType:'application/json',body:JSON.stringify(manifest)});
      await delayed.waitForTimeout(200);await settle(delayed);
      assert.equal(await isGallery(delayed),false,`${action}: late manifest does not reopen gallery`);
      assert.equal(await delayed.locator('.gallery-lightbox[open]').count(),0,`${action}: late manifest does not open a viewer`);
      assert.ok(galleryRequests(delayedRequests).every(p=>p.endsWith('/manifest.json')),`${action}: abandoned gallery does not start artwork downloads`);
      if(action==='start'){
        assert.equal(await delayed.locator('#screen-placement').isVisible(),true);
        await delayed.locator('#btn-cancel-placement').click();await waitReady(delayed);
        assert.equal(await delayed.locator('.gallery-lightbox[open]').count(),0,'Cancel returns to instructions, not a stale viewer');
      }
      assert.deepEqual(delayedErrors,[]);delayedResults.push({action,requests:galleryRequests(delayedRequests),errors:delayedErrors});await delayed.close();
    }
    const failure=await context.newPage();let manifestAttempts=0;
    await failure.route('**/assets/gallery/manifest.json',route=>{
      manifestAttempts++;return route.fulfill(manifestAttempts===1?{status:503,body:'Unavailable'}:{status:200,contentType:'application/json',body:JSON.stringify(manifest)});
    });
    await failure.goto(url);await failure.locator('#btn-explore-gallery').click();await failure.locator('#gallery-retry').waitFor({state:'visible'});
    assert.equal(await failure.locator('#btn-start').isEnabled(),true,'capture remains available after gallery failure');
    await failure.locator('#gallery-retry').click();await waitGallery(failure);
    assert.equal(manifestAttempts,2,'retry performs a fresh manifest request');assert.equal(await failure.locator('.gallery-card').count(),16,'retry creates one set of cards');
    await failure.close();
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'browsing never uploads artwork or recordings');
    results.browsers.push({name,widths,tail,delayedResults,manifestRetryAttempts:manifestAttempts,errors,writes});
    await context.close();await browser.close();browser=undefined;
  }
  results.passed=true;if(out)writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2)+'\n');
  console.log('PASS mobile gallery: explicit lazy entrance, readable phone layouts, filters, touch navigation, browser Back, deep links, delayed-load isolation, capture handoff and retry in Chromium/WebKit');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
