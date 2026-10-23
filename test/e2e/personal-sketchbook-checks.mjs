// The live personal adaptation, using the actual already-public painting file.
// Browser emulation does not certify physical-phone rendering or native apps.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { PERSONAL_BOOK_PORTRAIT } from '../../src/pulse-sketchbook-spreads.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const entry=path.resolve(root,process.env.PPG_SKETCHBOOK_ENTRY||'dist/sketchbook-entry.js');
const entryBytes=readFileSync(entry),entryHash=createHash('sha256').update(entryBytes).digest('hex');
const out=process.env.PPG_PERSONAL_SKETCHBOOK_ARTIFACTS&&path.resolve(root,process.env.PPG_PERSONAL_SKETCHBOOK_ARTIFACTS);
if(out)mkdirSync(out,{recursive:true});
const sourceBytes=readFileSync(path.join(root,'app/assets/gallery/quiet-lake-share.jpg'));
const sourceHash=createHash('sha256').update(sourceBytes).digest('hex');
const manifest=JSON.parse(readFileSync(path.join(root,'vendor/threeui-sketchbook/PROVENANCE.json')));
for(const item of [...manifest.files,...manifest.assets,...manifest.notices]){
  const file=item.path.startsWith('public/')?path.join(root,'app',item.path.slice(7)):path.join(root,'vendor/threeui-sketchbook',item.path);
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),item.sha256,`preserved ThreeUI reference: ${item.path}`);
}
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=name==='/'?path.join(root,'test/fixtures/personal-sketchbook.html')
    :name==='/app/sketchbook-entry.js'?entry
    :path.resolve(root,'.'+(name.startsWith('/sketchbook/')?'/app'+name:name));
  if(!file.startsWith(root+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  if(name.startsWith('/sketchbook/'))res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(file===entry?entryBytes:readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,results=[];
const title='Your painting',nextTitle='A closer look',lastTitle='A moment to share';
let browser,diagnosticPage,diagnosticLabel;

async function openHub(page){
  await page.goto(base);await page.locator('#open').click();
  await page.waitForFunction(()=>PulseShare.getState().ready);
}
async function openBook(page){
  await page.locator('.ps-paper-toggle').click();await page.locator('iframe').waitFor();
  const frame=page.frames().find(frame=>frame!==page.mainFrame());assert.ok(frame);
  await frame.waitForFunction(()=>document.body.dataset.ready==='1');
  // Authored desktop intro begins 220 ms after readiness. Let that scheduled
  // start occur before waiting for the first personal spread to settle.
  await frame.waitForTimeout(300);
  await frame.waitForFunction(()=>!document.getElementById('sbWrap').classList.contains('intro'));
  await frame.waitForFunction(expected=>document.querySelector('#sbBook .sb-full img')?.alt===expected,title,{timeout:15000});
  await frame.waitForFunction(()=>{
    const image=document.querySelector('#sbBook .sb-full img');
    return image?.complete&&image.naturalWidth===1760&&image.naturalHeight===1240;
  },null,{timeout:5000});
  await page.waitForFunction(()=>document.querySelector('.ps-paper-status')?.textContent.startsWith('Drag or tap'));
  return frame;
}
async function waitTitle(frame,value){
  await frame.waitForFunction(expected=>{
    const image=document.querySelector('#sbBook .sb-full img');
    return image?.alt===expected&&image.complete&&image.naturalWidth===1760&&image.naturalHeight===1240;
  },value);
}
async function assertNoLiveURLs(page,except){
  const live=await page.evaluate(except=>[...testURLs].filter(([url,item])=>!item.revoked&&url!==except).map(([url,item])=>({url,type:item.blob.type})),except);
  assert.deepEqual(live,[],'all personal page and decoder object URLs are revoked');
}
async function shareHash(page){
  await page.locator('.ps-share').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
  return page.evaluate(async()=>{
    const call=shareCalls.at(-1),hash=await crypto.subtle.digest('SHA-256',await call.file.arrayBuffer());
    return {hash:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join(''),active:call.active,type:call.file.type,bytes:call.file.size};
  });
}
async function sourceProjection(page){
  return page.evaluate(async rect=>{
    const pngs=[...testURLs].filter(([,item])=>!item.revoked&&item.blob.type==='image/png');
    if(pngs.length!==3)return {pages:pngs.length};
    const source=new Image();source.src=document.querySelector('.ps-preview img').src;await source.decode();
    const expected=document.createElement('canvas');expected.width=rect.w;expected.height=rect.h;
    expected.getContext('2d').drawImage(source,0,0,rect.w,rect.h);
    const pixels=expected.getContext('2d').getImageData(0,0,rect.w,rect.h).data;
    const projections=[];
    for(const index of [0,2]){
      const plate=new Image();plate.src=pngs[index][0];await plate.decode();
      const canvas=document.createElement('canvas');canvas.width=plate.naturalWidth;canvas.height=plate.naturalHeight;
      canvas.getContext('2d').drawImage(plate,0,0);
      const got=canvas.getContext('2d').getImageData(rect.x,rect.y,rect.w,rect.h).data;
      let total=0,maximum=0;for(let i=0;i<got.length;i++){const delta=Math.abs(got[i]-pixels[i]);total+=delta;maximum=Math.max(maximum,delta);}
      projections.push({index,width:plate.naturalWidth,height:plate.naturalHeight,meanDelta:total/got.length,maximum});
    }
    return {pages:pngs.length,source:{width:source.naturalWidth,height:source.naturalHeight},projections};
  },PERSONAL_BOOK_PORTRAIT);
}

try{
  const engines=[['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.PPG_PERSONAL_SKETCHBOOK_BROWSER||name===process.env.PPG_PERSONAL_SKETCHBOOK_BROWSER);
  for(const [name,engine]of engines){
    browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
    for(const [label,viewport,reducedMotion]of[
      ['desktop',{width:1440,height:1000},'no-preference'],
      ['mobile',{width:390,height:844},'no-preference'],
      ['reduced',{width:390,height:844},'reduce'],
      ['small',{width:320,height:568},'reduce'],
    ]){
      const context=await browser.newContext({viewport,reducedMotion,isMobile:label!=='desktop',hasTouch:label!=='desktop'}),page=await context.newPage();
      diagnosticPage=page;diagnosticLabel=`${name}-${label}`;
      const errors=[],requests=[],failed=[];
      page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));page.on('requestfailed',request=>failed.push(request.url()));
      await openHub(page);
      assert.equal(await page.locator('.ps-paper-toggle strong').innerText(),'Open your sketchbook');
      assert.equal(requests.some(url=>url.includes('sketchbook')),false,'personal renderer and fonts remain lazy until explicit action');
      const originalPreview=await page.locator('.ps-preview img').getAttribute('src');
      const before=await shareHash(page);assert.equal(before.hash,sourceHash);assert.equal(before.active,true);
      const frame=await openBook(page);
      const initialBounds=await frame.evaluate(()=>({
        width:innerWidth,height:innerHeight,scrollY,
        controls:[...document.querySelectorAll('.sb-tools,.tool,#sbCaptions,.sb-hint')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{
          const rect=el.getBoundingClientRect();return{className:el.className,top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right};
        }),
      }));
      assert.equal(initialBounds.scrollY,0,'personal book must fit before an automated click can scroll its iframe');
      assert.ok(initialBounds.controls.length>=6,JSON.stringify(initialBounds));
      for(const control of initialBounds.controls){
        assert.ok(control.top>=-1&&control.bottom<=initialBounds.height+1,`${name}/${label}: ${control.className} fits vertically at first render (${control.top}–${control.bottom} of ${initialBounds.height})`);
        assert.ok(control.left>=-1&&control.right<=initialBounds.width+1,`${name}/${label}: ${control.className} fits horizontally`);
      }
      const iframe=await page.locator('iframe').evaluate(el=>({title:el.title,sandbox:el.getAttribute('sandbox')}));
      assert.deepEqual(iframe,{title:'Your pulse painting sketchbook',sandbox:'allow-scripts'});
      assert.equal(await frame.locator('#plateList .plate').count(),3);
      assert.deepEqual(await frame.locator('#plateList .plate .t').allTextContents(),[title,nextTitle,lastTitle]);
      assert.equal(/Singapore|Marina Bay|Meng To|RMSSD|SDNN|bpm/.test(await frame.locator('body').innerText()),false,'the personal book contains neither reference travel content nor fabricated biometrics');
      const projection=await sourceProjection(page);assert.equal(projection.pages,3);assert.deepEqual(projection.source,{width:1080,height:1350});
      // Browser canvas paths can round a resampled JPEG by a channel value.
      // The complete projected rectangle still has to match within 1/255.
      for(const p of projection.projections){assert.equal(p.width,1760);assert.equal(p.height,1240);assert.ok(p.meanDelta<1,`full source portrait stays intact on page ${p.index+1}: ${p.meanDelta}`);}
      if(out)await page.screenshot({path:path.join(out,`${name}-${label}-first.png`),fullPage:true});
      // The adaptation fixes pointer capture only in its derived document.
      await frame.locator('#sbRight').click();await waitTitle(frame,nextTitle);
      await frame.locator('#sbRight').click();await waitTitle(frame,lastTitle);
      await frame.locator('#sbLeft').click();await waitTitle(frame,nextTitle);
      await frame.locator('body').press('ArrowLeft');await waitTitle(frame,title);
      await frame.locator('#zIn').click();assert.equal(await frame.locator('#zRead').innerText(),'116%');
      await frame.locator('#zOut').click();assert.equal(await frame.locator('#zRead').innerText(),'100%');
      await frame.locator('.sb-zone.sb-next').click();await waitTitle(frame,nextTitle);
      await frame.locator('body').press('ArrowLeft');await waitTitle(frame,title);
      const bounds=await frame.locator('#sbBook').boundingBox();assert.ok(bounds);
      const from={x:bounds.x+bounds.width*.82,y:bounds.y+bounds.height*.5},to={x:bounds.x+bounds.width*.2,y:fromY(bounds)};
      let dragInput='mouse pointer';
      if(name==='chromium'&&label!=='desktop'){
        const cdp=await context.newCDPSession(page);dragInput='emulated touch';
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
        for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();}
      await waitTitle(frame,nextTitle);
      let loupeDrag=false,tilt=false;
      const loupeHidden=await frame.locator('#loupe').evaluate(el=>getComputedStyle(el).display==='none');
      if(label==='desktop'){
        await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.4);
        await frame.waitForFunction(()=>Math.abs(parseFloat(document.getElementById('sb3d').style.getPropertyValue('--ry')))>0.1);tilt=true;
        const ring=await frame.locator('#loupe .ring').boundingBox(),initial=await frame.locator('#loupe').evaluate(el=>el.style.transform);
        await page.mouse.move(ring.x+ring.width*.5,ring.y+ring.height*.45);await page.mouse.down();await page.mouse.move(ring.x+ring.width*.5-60,ring.y+ring.height*.45-40,{steps:6});await page.mouse.up();
        loupeDrag=initial!==await frame.locator('#loupe').evaluate(el=>el.style.transform);assert.equal(loupeDrag,true);
      }else assert.equal(loupeHidden,true,'the glass does not obstruct coarse-pointer mobile views');
      if(reducedMotion==='reduce'){
        assert.equal(await frame.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),true);
        assert.equal(await frame.locator('#sbWrap').evaluate(el=>el.classList.contains('intro')),false);
        const view=await frame.locator('#sb3d').evaluate(el=>({rx:el.style.getPropertyValue('--rx'),ry:el.style.getPropertyValue('--ry')}));
        assert.ok(Math.abs(parseFloat(view.rx)||0)<.01&&Math.abs(parseFloat(view.ry)||0)<.01,'reduced motion avoids decorative tilt');
      }
      const layout=await page.evaluate(()=>{
        const dialog=document.querySelector('.pulse-share-sheet'),stage=document.querySelector('.ps-paper-stage'),footer=document.querySelector('.ps-footer'),button=document.querySelector('.ps-share');
        return{viewport:innerWidth,scroll:document.documentElement.scrollWidth,dialogScroll:dialog.scrollWidth,dialogWidth:dialog.clientWidth,stageWidth:stage.clientWidth,stageHeight:stage.clientHeight,footerBottom:footer.getBoundingClientRect().bottom,buttonHeight:button.getBoundingClientRect().height};
      });
      assert.equal(layout.scroll,viewport.width);assert.ok(layout.dialogScroll<=layout.dialogWidth+1);assert.ok(layout.stageWidth>=260&&layout.stageHeight>=300);assert.ok(layout.footerBottom<=viewport.height+1);assert.ok(layout.buttonHeight>=44);
      const controls=await frame.locator('#sbLeft,#sbRight,#zIn,#zOut').evaluateAll(nodes=>nodes.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
      assert.ok(controls.every(control=>control.w>=44&&control.h>=44),'adapted controls retain mobile tap targets');
      assert.equal(await page.locator('.ps-preview img').getAttribute('src'),originalPreview);
      if(out)await page.screenshot({path:path.join(out,`${name}-${label}.png`),fullPage:true});
      const after=await shareHash(page);assert.equal(after.hash,sourceHash,'the book never replaces or mutates the default shared file');assert.equal(after.active,true);
      await page.locator('.ps-paper-close').click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('.pulse-sketchbook-island').count(),0);
      assert.equal(await page.locator('.ps-paper-toggle').evaluate(el=>el===document.activeElement),true);
      await assertNoLiveURLs(page,originalPreview);
      await page.locator('.ps-close').click();await assertNoLiveURLs(page);
      const sketchbookRequests=requests.filter(url=>new URL(url).pathname.startsWith('/sketchbook/'));
      assert.ok(sketchbookRequests.length>0,'authored local type is loaded');
      assert.ok(sketchbookRequests.every(url=>url.endsWith('.woff2')),'no Singapore image is fetched by the personal adaptation');
      assert.equal(requests.some(url=>url.startsWith('http')&&!url.startsWith(base)),false,'personal preparation sends no remote requests');
      assert.equal(requests.some(url=>new URL(url).pathname.startsWith('/api/')),false,'opening the book never publishes an image');
      assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
      results.push({browser:name,label,projection,layout,initialBounds,dragInput,tilt,loupeDrag,loupeHidden,sharedSourceHash:after.hash,sketchbookRequests,passed:true});await context.close();
    }

    // Import, preparation, and decode failures must not reopen a closed sheet
    // or keep private object URLs alive. These paths use fresh browser pages.
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    for(const navigate of [false,true]){
      const page=await context.newPage();await openHub(page);
      let held,resolveSeen;const seen=new Promise(resolve=>{resolveSeen=resolve;});
      await page.route('**/app/sketchbook-entry.js',route=>{held=route;resolveSeen();});
      if(navigate)await page.evaluate(()=>history.pushState({},'','#sharing'));
      await page.locator('.ps-paper-toggle').click();await seen;
      if(navigate)await page.goBack();else await page.locator('.ps-close').click();
      await held.fulfill({status:200,contentType:'text/javascript',body:entryBytes});
      await page.waitForTimeout(150);assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>PulseShare.getState().open),false);await assertNoLiveURLs(page);await page.close();
    }
    const page=await context.newPage();await openHub(page);
    const preview=await page.locator('.ps-preview img').getAttribute('src');
    await page.evaluate(()=>{
      const original=HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob=function(callback,...args){
        HTMLCanvasElement.prototype.toBlob=original;
        return original.call(this,blob=>{window.releaseEncode=()=>callback(blob);window.encodeHeld=true;},...args);
      };
    });
    await page.locator('.ps-paper-toggle').click();await page.waitForFunction(()=>window.encodeHeld);
    await page.locator('.ps-paper-close').click();await page.evaluate(()=>releaseEncode());await page.waitForTimeout(100);
    assert.equal(await page.locator('iframe').count(),0);await assertNoLiveURLs(page,preview);
    assert.equal(await page.locator('.ps-paper-toggle').getAttribute('aria-expanded'),'false');
    await openBook(page);await page.locator('.ps-close').click();await assertNoLiveURLs(page);
    const invalid=await page.evaluate(async()=>{
      const{mountPulseSketchbook}=await import('/app/sketchbook-entry.js');
      const book=mountPulseSketchbook(document.getElementById('direct-book'),{blob:new Blob(['invalid'],{type:'image/jpeg'})});
      try{await book.ready;return false;}catch{return true;}finally{book.destroy();}
    });
    assert.equal(invalid,true,'a non-decodable supplied image rejects cleanly');await assertNoLiveURLs(page);assert.equal(await page.locator('iframe').count(),0);
    await page.evaluate(async()=>{
      await openHub();const original=HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob=function(callback){HTMLCanvasElement.prototype.toBlob=original;callback(null);};
    });
    await page.locator('.ps-paper-toggle').click();await page.waitForFunction(()=>document.querySelector('.ps-paper-status').textContent.includes('could not open'));
    assert.equal(await page.locator('.ps-share').isEnabled(),true,'optional rendering failure does not block normal sharing');
    assert.equal((await shareHash(page)).hash,sourceHash);await page.locator('.ps-close').click();await assertNoLiveURLs(page);
    await page.close();await context.close();
    results.push({browser:name,lifecycle:{closeDuringImport:true,backDuringImport:true,closeDuringPreparation:true,invalidImage:true,encoderFailure:true,allURLsRevoked:true},passed:true});
    await browser.close();browser=null;
  }
  if(out)writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Personal adapted ThreeUI book; public-fixture image and browser emulation only',sourceHash,entryHash,originalSourceRevision:manifest.sourceRevision,results},null,2)+'\n');
  console.log('PASS personal sketchbook: supplied pixels, three local spreads, pointer arrows, page taps/drags, keyboard, zoom, tilt/loupe, mobile/reduced motion, lazy loading, failure/disposal and unchanged share bytes.');
}catch(error){
  if(out&&diagnosticPage&&!diagnosticPage.isClosed())await diagnosticPage.screenshot({path:path.join(out,`failure-${diagnosticLabel}.png`),fullPage:true}).catch(()=>{});
  throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

function fromY(bounds){return bounds.y+bounds.height*.5;}
