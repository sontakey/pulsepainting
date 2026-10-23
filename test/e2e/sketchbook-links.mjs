// Browser integration with a mocked publication API/native share destination.
// No real paintings are published and this does not certify physical phones.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';
import {replayPublicFixture} from '../landscape-fixture.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PPG_BOOK_LINK_ARTIFACTS&&path.resolve(root,process.env.PPG_BOOK_LINK_ARTIFACTS);
if(out)mkdirSync(out,{recursive:true});
const replay=replayPublicFixture(1,0,60);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'dist','.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(path.join(root,'dist')+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
  if(pathname.startsWith('/sketchbook/'))res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const id='12345678-1234-4234-8234-123456789abc',lease='22345678-1234-4234-8234-123456789abc';
const canonical='https://www.pulsepainting.com',publicURL=`${canonical}/p/${id}`,bookURL=`${canonical}/book/${id}`;
const blobOrigin='https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
const makePainting=body=>({id:body.id,displayName:body.displayName||'Anonymous',metrics:body.metrics,imageURL:`${blobOrigin}/community/book-test/${body.id}/${lease}/painting.jpg`,thumbnailURL:`${blobOrigin}/community/book-test/${body.id}/${lease}/thumbnail.webp`,url:`${canonical}/p/${body.id}`,createdAt:'2026-10-23T12:00:00.000Z'});
const results=[];
async function readyPublisher(page){await page.waitForFunction(()=>{const image=document.querySelector('.community-publish-preview img');return image?.complete&&image.naturalWidth===1080&&!document.querySelector('.community-publish-status').textContent.includes('Preparing');});}
async function report(page){
  await page.evaluate(async segments=>{
    PulseCommunity.closePublication();PulseShare.close();
    manuscript.segments=segments;landscape=PulseLandscape.create({seed:39293,family:'quiet-lake'});
    segments.forEach(segment=>PulseLandscape.append(landscape,segment));landscapeCoverageComplete=true;
    monitor=null;elapsedMeasuringMs=60000;portraitStartedAt=Date.UTC(2026,9,23,12);
    renderReport(Array.from({length:80},(_,i)=>850+45*Math.sin(i/3)),10,null);
    showScreen('summary');await reportArtworkReady;
  },replay.segments);
  await page.locator('#btn-share-artwork').waitFor({state:'visible'});
}
async function privateBookPublisher(page){
  await page.locator('#btn-share-artwork').click();await page.waitForFunction(()=>PulseShare.getState().ready);
  await page.locator('.ps-book-link').click();await readyPublisher(page);
}
let browser;
try{
  for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
    if(process.env.PPG_BOOK_LINK_BROWSER&&process.env.PPG_BOOK_LINK_BROWSER!==name)continue;
    browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
    const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[],posts=[],held=[];let postMode='success';
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/paintings**',async route=>{
      if(route.request().method()!=='POST'){await route.fulfill({json:{paintings:[],nextCursor:null}});return;}
      const body=route.request().postDataJSON();posts.push(body);
      if(postMode==='hold'){held.push({route,body});return;}
      await route.fulfill({status:201,json:{painting:makePainting(body),created:true}});
    });
    await context.route(`${blobOrigin}/**`,route=>route.fulfill({contentType:'image/jpeg',body:readFileSync(path.join(root,'app/assets/gallery/quiet-lake-share.jpg')),headers:{'Access-Control-Allow-Origin':'*'}}));
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(async()=>{
      window.shareCalls=[];window.copyCalls=[];window.shareMode='success';
      window.nativeShare=data=>{shareCalls.push({keys:Object.keys(data).sort(),url:data.url,files:data.files?.length,active:navigator.userActivation?.isActive});return shareMode==='cancel'?Promise.reject(new DOMException('Cancelled','AbortError')):Promise.resolve();};
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:nativeShare});
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:value=>{copyCalls.push(value);return Promise.reject(new DOMException('Blocked','NotAllowedError'));}}});
      window.testBlob=await(await fetch('/assets/gallery/quiet-lake-share.jpg')).blob();
      window.openTestHub=extra=>PulseShare.open({blob:testBlob,...extra});
    });

    // A public book URL is derived only from a validated public painting link.
    await page.evaluate(async publicURL=>{await openTestHub({publicURL}).ready;},publicURL);
    assert.equal(await page.locator('.ps-book-link').innerText(),'Share sketchbook link');
    await page.locator('.ps-book-link').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
    assert.deepEqual(await page.evaluate(()=>shareCalls.at(-1)),{keys:['text','title','url'],url:bookURL,files:undefined,active:true});
    await page.locator('.ps-share').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
    const imageCall=await page.evaluate(()=>shareCalls.at(-1));assert.deepEqual(imageCall.keys,['files','title']);assert.equal(imageCall.files,1);assert.equal(imageCall.active,true,'image sharing remains a trusted file share');
    await page.evaluate(()=>{shareMode='cancel';});await page.locator('.ps-book-link').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
    assert.equal(await page.locator('.ps-status').innerText(),'','native cancellation is quiet');assert.equal(await page.locator('.ps-book-url').isVisible(),false);

    // Clipboard failure leaves the actual book link selectable, even without
    // opening the optional sketchbook. The painting-page caption is not a fallback.
    await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});});
    await page.locator('.ps-book-link').click();await page.locator('.ps-book-url').waitFor({state:'visible'});
    assert.equal(await page.locator('.ps-book-url').inputValue(),bookURL);assert.equal(await page.locator('.ps-book-url').getAttribute('readonly'),'');
    assert.equal(await page.evaluate(()=>copyCalls.at(-1)),bookURL);
    for(const width of[320,390,430]){
      await page.setViewportSize({width,height:844});
      const layout=await page.locator('.ps-book-url').evaluate(el=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,box:el.getBoundingClientRect().toJSON(),font:parseFloat(getComputedStyle(el).fontSize)}));
      assert.equal(layout.documentWidth,width);assert.ok(layout.box.width<=width&&layout.box.height>=44);assert.ok(layout.font>=14);
    }
    await page.setViewportSize({width:390,height:844});
    if(out)await page.screenshot({path:path.join(out,`${name}-copy-fallback.png`)});
    for(const invalid of[`${publicURL}?owner=secret`,`${publicURL}#remove=${'a'.repeat(64)}`,`${canonical}/book/${id}`,`https://evil.example/p/${id}`,`https://user:secret@www.pulsepainting.com/p/${id}`,`${publicURL}/`]){
      await page.evaluate(async publicURL=>{await openTestHub({publicURL}).ready;},invalid);
      assert.equal(await page.evaluate(()=>PulseShare.getState().published),false,`invalid public URL stays private: ${invalid}`);
      assert.equal(await page.locator('.ps-book-links').isVisible(),false,'an invalid URL cannot produce a book link');
    }

    await page.evaluate(async publicURL=>{shareMode='success';Object.defineProperty(navigator,'share',{configurable:true,value:nativeShare});await openTestHub({publicURL,openBook:true}).ready;},publicURL);
    await page.locator('iframe').waitFor();
    await page.waitForFunction(()=>document.querySelector('.ps-paper-status').textContent.startsWith('Drag or tap'));
    await page.locator('.ps-paper-link').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
    assert.equal(await page.evaluate(()=>shareCalls.at(-1).url),bookURL);assert.equal(await page.evaluate(()=>shareCalls.at(-1).active),true);
    await page.locator('.ps-book-copy').click();assert.equal(await page.locator('.ps-book-url').inputValue(),bookURL);
    await page.locator('.ps-close').click();assert.equal(await page.locator('iframe').count(),0);

    // A private maker follows the real report -> hub -> consent flow. Sharing
    // a book never bypasses public preview, metric opt-in or explicit publication.
    await report(page);await page.locator('.portrait-options input').check();await page.waitForFunction(()=>PulsePortrait.getState().ready);
    await privateBookPublisher(page);
    assert.equal(await page.locator('#community-publish-title').innerText(),'Share your sketchbook.');
    assert.match(await page.locator('.community-publish-intro').innerText(),/community gallery/);
    assert.equal(await page.evaluate(()=>PulseShare.getState().open),false);
    assert.equal(await page.locator('#community-include-metrics').isChecked(),false,'private export metrics do not opt in public metrics');
    assert.equal(await page.locator('#community-public-consent').isChecked(),false);assert.equal(await page.locator('.community-publish-submit').isDisabled(),true);assert.equal(posts.length,0);
    await page.locator('.community-publish-cancel').click();assert.equal(posts.length,0);
    await page.locator('.community-publish-invitation').click();await readyPublisher(page);
    assert.equal(await page.locator('#community-publish-title').innerText(),'A place in the gallery.','book intent belongs to the current view, not the reusable draft');
    await page.locator('.community-publish-cancel').click();await privateBookPublisher(page);
    await page.locator('#community-display-name').fill('Ada & friends');await page.locator('#community-public-consent').check();
    const beforePublicationCalls=await page.evaluate(()=>shareCalls.length);
    await page.locator('.community-publish-submit').click();await page.locator('.community-publish-success').waitFor({state:'visible'});
    assert.equal(posts.length,1);assert.equal(posts[0].displayName,'Ada & friends');assert.equal(posts[0].includeMetrics,false);assert.equal(posts[0].metrics,null);
    assert.equal(await page.evaluate(()=>shareCalls.length),beforePublicationCalls,'POST completion does not attempt native sharing');
    assert.equal(await page.evaluate(()=>PulseShare.getState().open),false,'POST completion leaves success actions for a new trusted click');
    const publishedBook=`${canonical}/book/${posts[0].id}`;
    assert.equal(await page.locator('.community-publish-success a').first().getAttribute('href'),publishedBook);
    const successLinks=await page.locator('.community-publish-success a').evaluateAll(nodes=>nodes.map(n=>n.href));
    assert.equal(successLinks.some(link=>link.includes(posts[0].ownerToken)),false,'removal capability never appears in public links');
    await page.locator('.community-publish-success').getByRole('button',{name:'Preview & share sketchbook',exact:true}).click();
    await page.waitForFunction(()=>PulseShare.getState().ready);await page.locator('iframe').waitFor();
    assert.equal(await page.locator('.community-publish-dialog').isVisible(),false,'only the active share dialog remains open');
    const sharedRaster=await page.locator('.ps-preview img').evaluate(async img=>{const blob=await(await fetch(img.src)).blob();return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});});
    assert.equal(sharedRaster,posts[0].image,'public book uses the exact consented raster, not the metrics-bearing private export');
    assert.equal(await page.evaluate(()=>shareCalls.length),beforePublicationCalls,'opening the book is not a native share');
    await page.locator('.ps-paper-link').click();await page.waitForFunction(()=>!PulseShare.getState().sharing);
    assert.equal(await page.evaluate(()=>shareCalls.at(-1).url),publishedBook);assert.equal(await page.evaluate(()=>shareCalls.at(-1).active),true);
    await page.locator('.ps-close').click();await page.locator('.community-publish-invitation').click();await page.locator('.community-publish-success').waitFor({state:'visible'});
    assert.equal(posts.length,1,'opening an existing publication does not create another');await page.locator('.community-publish-cancel').click();

    // A delayed publication keeps the owner receipt but cannot reopen either
    // dialog, a book or native sharing after the maker leaves the report.
    await report(page);await privateBookPublisher(page);await page.locator('#community-include-metrics').check();
    await page.waitForFunction(()=>document.querySelector('.community-publish-metrics dd'));
    assert.equal(await page.locator('#community-public-consent').isChecked(),false);
    await page.locator('#community-public-consent').check();postMode='hold';await page.locator('.community-publish-submit').click();
    await page.waitForFunction(()=>document.querySelector('.community-publish-status').textContent.includes('Publishing'));
    while(!held.length)await new Promise(resolve=>setTimeout(resolve,10));
    const late=held.shift();assert.equal(late.body.includeMetrics,true);assert.ok(Object.values(late.body.metrics).some(Number.isFinite));
    await page.locator('.community-publish-cancel').click();await page.locator('#btn-again').click();
    const nativeCallsBeforeLate=await page.evaluate(()=>shareCalls.length);
    await late.route.fulfill({status:201,json:{painting:makePainting(late.body),created:true}});
    await page.waitForFunction(id=>JSON.parse(localStorage.getItem('pulsepainting.publications.v1'))[id]?.status==='published',late.body.id);
    assert.equal(await page.locator('.community-publish-dialog').isVisible(),false);assert.equal(await page.evaluate(()=>PulseShare.getState().open),false);
    assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.locator('#screen-ready').isVisible(),true);
    assert.equal(await page.evaluate(()=>shareCalls.length),nativeCallsBeforeLate);
    assert.deepEqual(errors,[]);results.push({browser:name,passed:true,scope:'URL/file share separation, trusted clicks, cancellation, selectable fallback, strict URLs, public raster consent, metric opt-in, private removal keys, delayed response'});
    await context.close();await browser.close();browser=null;console.log(`SKETCHBOOK_LINKS_PASS ${name}`);
  }
  if(out)writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
