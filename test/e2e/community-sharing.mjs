// Publication and community UI checks. API/native sharing are mocked; artwork
// geometry comes from the public fixture. This is not physical-phone acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';
import {replayPublicFixture} from '../landscape-fixture.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PPG_COMMUNITY_ARTIFACTS&&path.resolve(root,process.env.PPG_COMMUNITY_ARTIFACTS);
if(out)mkdirSync(out,{recursive:true});
const replay=replayPublicFixture(1,0,60);
assert.ok(replay.segments.length>0,'public recording supplies accepted artwork');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2'};
const server=createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'dist','.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(path.join(root,'dist')+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const BLOB='https://hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
const lease='12345678-1234-4234-8234-123456789abc';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const makePainting=(id,overrides={})=>({id,displayName:'Anonymous',metrics:null,imageURL:`${BLOB}/community/ui-test/${id}/${lease}/painting.jpg`,thumbnailURL:`${BLOB}/community/ui-test/${id}/${lease}/thumbnail.webp`,url:`https://www.pulsepainting.com/p/${id}`,createdAt:'2026-10-23T12:00:00.000Z',...overrides});
const publicJpeg=readFileSync(path.join(root,'app/assets/gallery/quiet-lake-share.jpg'));
const publicThumbnail=readFileSync(path.join(root,'app/assets/gallery/quiet-lake-640.webp'));
const results={scope:'Mocked publication API and native share; real public-fixture artwork geometry; Chromium/WebKit emulation; no real submissions or physical-phone claim',browsers:[]};
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function shot(page,name){if(out)await page.screenshot({path:path.join(out,name+'.png')});}
async function report(page){
  await page.evaluate(async segments=>{
    PulseCommunity.closePublication();PulseShare.close();
    manuscript.segments=segments;landscape=PulseLandscape.create({seed:39293,family:'quiet-lake'});
    segments.forEach(segment=>PulseLandscape.append(landscape,segment));landscapeCoverageComplete=true;
    monitor=null;elapsedMeasuringMs=60000;portraitStartedAt=Date.UTC(2026,9,23,12);
    // Deterministic report-only beat stimuli exercise optional summary fields;
    // no physiological-accuracy claim is made from these values.
    renderReport(Array.from({length:80},(_,i)=>850+45*Math.sin(i/3)),10,null);
    showScreen('summary');await reportArtworkReady;
  },replay.segments);
  await page.locator('.community-publish-invitation').waitFor({state:'visible'});
}
async function openPublisher(page){
  await page.locator('.community-publish-invitation').click();
  await page.waitForFunction(()=>{const image=document.querySelector('.community-publish-preview img');return image?.complete&&image.naturalWidth===1080&&!document.querySelector('.community-publish-status').textContent.includes('Preparing');});
}
async function consent(page){await page.locator('#community-public-consent').check();assert.equal(await page.locator('.community-publish-submit').isEnabled(),true);}
async function layout(page,width,selector){
  await page.setViewportSize({width,height:844});await settle(page);
  const measurements=await page.locator(selector).evaluate(el=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bounds:el.getBoundingClientRect().toJSON(),controls:[...el.querySelectorAll('button,input,select')].filter(n=>n.getClientRects().length&&n.type!=='checkbox').map(n=>({text:n.textContent||n.type,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,font:parseFloat(getComputedStyle(n).fontSize)}))}));
  assert.equal(measurements.scroll,width,'no horizontal document overflow');assert.ok(measurements.bounds.width<=width+1,'dialog fits viewport');
  for(const control of measurements.controls){assert.ok(control.height>=44&&control.width>=44,`touch target: ${control.text}`);assert.ok(control.font>=14,`readable control: ${control.text}`);}
  return measurements;
}
async function checkExampleRecovery(browser,name){
  const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];
  await context.route(`${BLOB}/**`,route=>route.fulfill({body:route.request().url().endsWith('thumbnail.webp')?publicThumbnail:publicJpeg,contentType:route.request().url().endsWith('thumbnail.webp')?'image/webp':'image/jpeg'}));
  const paintings=Array.from({length:8},(_,i)=>makePainting(`88888888-8888-4888-8888-${String(i).padStart(12,'0')}`,{displayName:`Maker ${i+1}`}));
  try{
    // A late public page can replace the card that opened the example viewer.
    const delayed=await context.newPage();delayed.on('pageerror',error=>errors.push(error.message));
    let holdList;const pendingList=new Promise(resolve=>{holdList=resolve;});
    await delayed.route('**/api/paintings**',route=>holdList(route));
    await delayed.goto(`${url}?collection=community#landscapes`);
    await delayed.waitForFunction(()=>document.querySelectorAll('.community-example-card').length===8);
    const opener=await delayed.locator('.community-example-card').first().elementHandle();
    await delayed.locator('.community-example-card').first().click();await delayed.locator('.gallery-lightbox').waitFor({state:'visible'});
    await (await pendingList).fulfill({json:{paintings,nextCursor:null}});
    await delayed.waitForFunction(()=>document.querySelectorAll('.community-card').length===8&&document.querySelectorAll('.community-example-card').length===0);
    assert.equal(await opener.evaluate(el=>el.isConnected),false,'late real paintings replace the example opener while its viewer remains open');
    await delayed.locator('.gallery-dialog-close').click();await delayed.locator('.gallery-lightbox').waitFor({state:'hidden'});
    await delayed.waitForFunction(()=>document.activeElement?.matches('.community-card'));
    assert.equal(await delayed.locator('.community-card').first().evaluate(el=>el===document.activeElement),true,'closing a replaced example returns focus to a visible shared painting');
    assert.equal(await delayed.locator('#gallery-tab-community').getAttribute('aria-pressed'),'true');await delayed.close();

    // Real paintings below the eight-card target must not hide example retry.
    for(const count of [1,7,8]){
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));let manifestFails=true,manifestRequests=0;
      await page.route('**/assets/gallery/manifest.json',route=>{manifestRequests++;return manifestFails?route.fulfill({status:503,json:{error:'Example manifest unavailable'}}):route.continue();});
      await page.route('**/api/paintings**',route=>route.fulfill({json:{paintings:paintings.slice(0,count),nextCursor:null}}));
      await page.goto(`${url}?collection=community#landscapes`);
      await page.waitForFunction(count=>document.querySelectorAll('.community-card').length===count&&document.getElementById('community-grid').getAttribute('aria-busy')==='false',count);
      if(count<8){
        assert.match(await page.locator('#community-status').innerText(),/example paintings could not load/);
        assert.equal(await page.locator('#community-more').innerText(),'Try loading again');assert.equal(await page.locator('#community-more').isVisible(),true,`${count} real paintings retain example retry`);
        if(count===1)await shot(page,`${name}-community-example-retry`);
        manifestFails=false;await page.locator('#community-more').click();
        await page.waitForFunction(count=>document.querySelectorAll('.community-example-card').length===8-count&&document.getElementById('community-grid').getAttribute('aria-busy')==='false',count);
        assert.ok(manifestRequests>=2,'Retry fetches the failed example manifest again');assert.equal(await page.locator('#community-status').innerText(),'');assert.equal(await page.locator('#community-more').isVisible(),false);
      }else{
        assert.equal(await page.locator('#community-status').innerText(),'','a full real gallery does not need fallback examples');assert.equal(await page.locator('#community-more').isVisible(),false);
      }
      await page.close();
    }
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}
let browser;
try{
  for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
    if(process.env.PPG_COMMUNITY_BROWSER&&process.env.PPG_COMMUNITY_BROWSER!==name)continue;
    browser=await engine.launch(name==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
    if(process.env.PPG_COMMUNITY_RECOVERY_ONLY==='1'){
      await checkExampleRecovery(browser,name);results.browsers.push({name,checks:'replaced example opener focus; mixed gallery manifest failure and retry at one, seven and eight real paintings'});
      await browser.close();browser=null;console.log(`COMMUNITY_EXAMPLE_RECOVERY_PASS ${name}`);continue;
    }
    const context=await browser.newContext({...devices['iPhone 13'],viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[],requests=[],posts=[],reports=[],deletes=[],held=[];
    let items=[],listMode='empty',postMode='success',listCalls=0;
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push({method:request.method(),url:request.url()}));
    await context.route(`${BLOB}/**`,route=>route.fulfill({body:route.request().url().endsWith('thumbnail.webp')?publicThumbnail:publicJpeg,contentType:route.request().url().endsWith('thumbnail.webp')?'image/webp':'image/jpeg',headers:{'Access-Control-Allow-Origin':'*'}}));
    await page.route('**/api/painting-report',async route=>{reports.push(route.request().postDataJSON());await route.fulfill({json:{reported:true}});});
    await page.route('**/api/paintings**',async route=>{
      const request=route.request(),parsed=new URL(request.url()),method=request.method();
      if(method==='POST'){
        const body=request.postDataJSON(),before=await page.evaluate(id=>JSON.parse(localStorage.getItem('pulsepainting.publications.v1')||'{}')[id],body.id);posts.push({body,before});
        if(postMode==='invalid'){await route.fulfill({status:400,json:{error:'Correct the display name.',code:'invalid_request'}});return;}
        if(postMode==='fail'){await route.fulfill({status:503,json:{error:'Try again shortly.',code:'unavailable'}});return;}
        if(postMode==='hold'){held.push({route,body});return;}
        const item=makePainting(body.id,{displayName:body.displayName,metrics:body.metrics});items=[item,...items.filter(p=>p.id!==item.id)];await route.fulfill({status:201,json:{painting:item,created:true}});return;
      }
      if(method==='DELETE'){deletes.push({id:parsed.searchParams.get('id'),...request.postDataJSON()});items=items.filter(p=>p.id!==parsed.searchParams.get('id'));await route.fulfill({json:{removed:true,cleanupPending:false}});return;}
      if(parsed.searchParams.has('id')){const item=items.find(p=>p.id===parsed.searchParams.get('id'));await route.fulfill(item?{json:{painting:item}}:{status:404,json:{error:'Not found',code:'not_found'}});return;}
      listCalls++;
      if(listMode==='error'){await route.fulfill({status:503,json:{error:'Gallery temporarily unavailable.',code:'unavailable'}});return;}
      if(listMode==='pages'){await route.fulfill({json:parsed.searchParams.has('cursor')?{paintings:items.slice(1),nextCursor:null}:{paintings:items.slice(0,1),nextCursor:'next-page'}});return;}
      await route.fulfill({json:{paintings:listMode==='empty'?[]:items,nextCursor:null}});
    });
    await page.goto(url);await page.evaluate(()=>document.fonts.ready);await settle(page);
    assert.equal(requests.filter(r=>r.url.includes('/api/')||r.url.startsWith(BLOB)).length,0,'default phone has no community request');
    assert.equal(requests.filter(r=>r.url.includes('/assets/gallery/')).length,0,'default phone does not preload fallback examples');
    await page.getByRole('button',{name:'Explore the paintings',exact:true}).click();await page.locator('.gallery-card').first().waitFor();
    assert.equal(listCalls,0,'example collection does not fetch community');assert.equal(await page.locator('.gallery-card').count(),16,'fixture examples retain all sixteen scenes');
    listMode='error';await page.locator('#gallery-tab-community').click();await page.getByRole('button',{name:'Try loading again',exact:true}).click({trial:true});
    assert.match(await page.locator('#community-status').innerText(),/unavailable/);
    await page.waitForFunction(()=>document.querySelectorAll('.community-example-card').length===8);
    listMode='empty';await page.locator('#community-more').click();await page.waitForFunction(()=>document.getElementById('community-grid').getAttribute('aria-busy')==='false');assert.equal(await page.locator('.community-card').count(),0,'examples are never represented as real shared paintings');
    assert.equal(await page.locator('.community-example-card').count(),8,'empty community shows eight curated examples');
    assert.deepEqual(await page.locator('.community-example-label').allTextContents(),Array(8).fill('Example'),'every fallback card has an explicit Example label');
    const exampleIds=await page.locator('.community-example-card').evaluateAll(cards=>cards.map(card=>card.dataset.example));
    assert.equal(new Set(exampleIds).size,8);for(const id of ['quiet-lake','alpine-peaks','aurora-night','sand-dunes'])assert.ok(exampleIds.includes(id),'fallback spans water, land and sky');
    assert.equal(await page.locator('#community-status').innerText(),'');
    await page.locator('.community-example-card').first().click();await page.locator('.gallery-lightbox').waitFor({state:'visible'});
    assert.match(await page.locator('#gallery-dialog-note').innerText(),/public pulse recording/);assert.equal(new URL(page.url()).searchParams.get('collection'),'community');
    await page.goBack();await page.locator('.gallery-lightbox').waitFor({state:'hidden'});assert.equal(await page.locator('#gallery-tab-community').getAttribute('aria-pressed'),'true');
    // Hiding the dialog precedes its queued close event and focus restoration.
    await page.waitForFunction(()=>document.querySelector('.community-example-card')===document.activeElement,null,{timeout:2000});
    assert.equal(await page.locator('.community-example-card').first().evaluate(el=>el===document.activeElement),true,'example close restores its community opener');
    await page.goForward();await page.locator('.gallery-lightbox').waitFor({state:'visible'});await page.locator('.gallery-dialog-close').click();await page.locator('.gallery-lightbox').waitFor({state:'hidden'});
    const widths=[];for(const width of[320,390,430])widths.push(await layout(page,width,'#community-gallery'));
    await page.setViewportSize({width:390,height:844});await shot(page,`${name}-community-examples`);

    await report(page);await page.locator('.portrait-options input').check();await page.waitForFunction(()=>PulsePortrait.getState().ready);
    await openPublisher(page);assert.equal(await page.locator('#community-include-metrics').isChecked(),false,'public metrics do not inherit report export opt-in');assert.equal(await page.locator('#community-public-consent').isChecked(),false);assert.equal(await page.locator('.community-publish-submit').isDisabled(),true);assert.equal(posts.length,0,'opening preview does not upload');
    for(const width of[320,390,430])await layout(page,width,'.community-publish-dialog');await page.setViewportSize({width:390,height:844});
    // A smaller visual viewport models the keyboard without claiming device QA.
    await page.evaluate(()=>{window.__realViewport=Object.getOwnPropertyDescriptor(window,'visualViewport');const proxy=new EventTarget();Object.assign(proxy,{height:450,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:proxy});dispatchEvent(new Event('resize'));});await settle(page);
    assert.ok(await page.locator('.community-publish-actions').evaluate(el=>el.getBoundingClientRect().bottom<=451),'publish actions fit above simulated keyboard');
    await page.evaluate(()=>{if(__realViewport)Object.defineProperty(window,'visualViewport',__realViewport);else delete window.visualViewport;dispatchEvent(new Event('resize'));});
    await page.locator('#community-display-name').fill('<Ada & friends>');await consent(page);await shot(page,`${name}-publish-consent`);
    await page.locator('.community-publish-submit').click();await page.locator('.community-publish-success').waitFor({state:'visible'});
    const first=posts[0];assert.equal(first.before.status,'pending','removal receipt persisted before POST');assert.equal(first.before.ownerToken,first.body.ownerToken);assert.match(first.body.ownerToken,/^[0-9a-f]{64}$/);assert.equal(first.body.metrics,null);assert.equal(first.body.includeMetrics,false);
    assert.deepEqual(Object.keys(first.body).sort(),['id','ownerToken','image','displayName','includeMetrics','metrics','consentVersion'].sort(),'upload has a strict explicit field set');assert.equal(first.body.displayName,'<Ada & friends>');assert.ok(Buffer.from(first.body.image,'base64').length<=2*1024*1024);
    await page.locator('.community-publish-cancel').click();
    await page.locator('.community-publish-invitation').click();await page.locator('.community-publish-preview img').evaluate(img=>img.decode());assert.equal(posts.length,1,'reopening a published preview does not republish');await page.locator('.community-publish-cancel').click();
    await page.locator('#btn-again').click();assert.equal(await page.locator('.community-publish-dialog').isVisible(),false);

    // Retry an uncertain timeout with the same immutable body and ownership key.
    await report(page);await openPublisher(page);await page.locator('#community-include-metrics').check();await page.waitForFunction(()=>document.querySelector('.community-publish-metrics dd'));
    assert.equal(await page.locator('#community-public-consent').isChecked(),false,'changed public fields require consent');await consent(page);
    await page.evaluate(()=>{window.__realTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>__realTimeout(fn,ms===25000?60:ms,...args);});
    postMode='hold';await page.locator('.community-publish-submit').click();await page.waitForFunction(()=>document.querySelector('.community-publish-status').textContent.includes('taking longer'));
    assert.equal(await page.locator('.community-publish-cancel').innerText(),'Close','submitted publication is never labeled Cancel');
    assert.equal(await page.locator('#community-display-name').isDisabled(),true,'retry cannot silently alter reviewed payload');
    postMode='success';await page.locator('.community-publish-submit').click();await page.locator('.community-publish-success').waitFor({state:'visible'});
    assert.deepEqual(posts[1].body,posts[2].body,'timeout retries same id, secret, image and choices');assert.equal(posts[2].body.includeMetrics,true);assert.ok(Object.values(posts[2].body.metrics).some(Number.isFinite));
    await held.shift().route.abort().catch(()=>{});await page.evaluate(()=>{window.setTimeout=__realTimeout;});await page.locator('.community-publish-cancel').click();

    // A response after Measure again retains ownership without reopening UI.
    await report(page);await openPublisher(page);await consent(page);postMode='hold';await page.locator('.community-publish-submit').click();await page.waitForFunction(()=>document.querySelector('.community-publish-status').textContent.includes('Publishing'));
    while(!held.length)await new Promise(resolve=>setTimeout(resolve,10));const late=held.shift();
    await page.locator('.community-publish-cancel').click();await page.locator('#btn-again').click();
    const latePainting=makePainting(late.body.id,{displayName:late.body.displayName,metrics:late.body.metrics});items=[latePainting,...items];await late.route.fulfill({status:201,json:{painting:latePainting,created:true}});
    await page.waitForFunction(id=>JSON.parse(localStorage.getItem('pulsepainting.publications.v1'))[id]?.status==='published',late.body.id);
    assert.equal(await page.locator('.community-publish-dialog').isVisible(),false,'late receipt cannot reopen publisher');assert.equal(await page.locator('#screen-ready').isVisible(),true);
    postMode='success';listMode='pages';items=[makePainting(first.body.id,{displayName:first.body.displayName}),makePainting(ids[1],{displayName:'Another maker',metrics:{hr:70,rmssd:null,sdnn:42}})];
    await page.goto(`${url}?collection=community#landscapes`);await page.locator('.community-card').first().waitFor();assert.equal(await page.locator('.community-card').count(),1);await page.locator('#community-more').click();await page.waitForFunction(()=>document.querySelectorAll('.community-card').length===2);
    await page.waitForFunction(()=>document.querySelectorAll('.community-example-card').length===6);
    assert.deepEqual(await page.locator('#community-grid').evaluate(el=>[...el.children].map(card=>card.hasAttribute('data-painting')?'shared':'example')),['shared','shared',...Array(6).fill('example')],'real paintings appear first and replace examples as pages arrive');
    assert.equal(await page.locator('.community-card img').first().evaluate(img=>img.src.endsWith('/thumbnail.webp')),true,'backend thumbnail URL accepted');await page.locator('.community-card img').first().evaluate(img=>img.decode());
    assert.equal(await page.locator('.community-card-caption strong').first().innerText(),'<Ada & friends>','public name is plain text');assert.equal(await page.locator('.community-card-caption ada').count(),0);
    await page.locator('.community-card').first().click();await page.waitForFunction(()=>document.querySelector('.community-byline').textContent.includes('<Ada'));
    await page.goBack();await page.locator('.community-viewer').waitFor({state:'hidden'});await page.goForward();await page.locator('.community-viewer').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('.community-view-share').disabled);
    await page.evaluate(()=>{window.__shares=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:payload=>{__shares.push({keys:Object.keys(payload).sort(),file:payload.files?.[0]?.type,active:navigator.userActivation?.isActive});return Promise.resolve();}});});
    await page.locator('.community-view-share').click();await page.waitForFunction(()=>PulseShare.getState().ready);assert.match(await page.locator('.ps-link-title').innerText(),/page for this painting/);assert.equal(await page.locator('[data-action="copy-link"] span').innerText(),'Copy link');
    await page.locator('.ps-share').click();assert.deepEqual(await page.evaluate(()=>__shares[0].keys),['files','title']);assert.equal(await page.evaluate(()=>__shares[0].active),true,'native share called in trusted tap');
    await page.locator('.ps-close').click();await shot(page,`${name}-community-viewer`);
    await page.locator('.community-report').click();await page.getByRole('combobox',{name:'Report reason'}).selectOption('privacy');await page.getByRole('button',{name:'Send report',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.community-view-status').textContent.includes('Report received'));assert.deepEqual(reports.at(-1),{id:first.body.id,reason:'privacy'});
    await page.locator('.community-remove').click();assert.equal(deletes.length,0,'opening removal prompt does not delete');await page.getByRole('button',{name:'Remove painting',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.community-view-status').textContent.includes('has been removed'));assert.equal(deletes[0].ownerToken,first.body.ownerToken);
    await page.getByRole('button',{name:'Close painting',exact:true}).click();await page.locator('.community-viewer').waitFor({state:'hidden'});
    // A private recovery fragment is consumed locally and never appears in requests.
    const secret='b'.repeat(64);items=[makePainting(ids[2])];listMode='all';await page.goto(`${url}?painting=${ids[2]}#remove=${secret}`);await page.waitForFunction(()=>document.querySelector('.community-owner-actions')&&!document.querySelector('.community-owner-actions').hidden);assert.equal(new URL(page.url()).hash,'#landscapes');assert.equal(requests.some(r=>r.url.includes(secret)),false,'removal secret never enters a request URL');
    await page.goto(`${url}?painting=${ids[2]}#remove=${'c'.repeat(64)}`);await page.locator('.community-viewer').waitFor({state:'visible'});assert.equal(await page.evaluate(id=>JSON.parse(localStorage.getItem('pulsepainting.publications.v1'))[id].ownerToken,ids[2]),secret,'a conflicting private link never overwrites an existing removal key');
    await page.getByRole('button',{name:'Close painting',exact:true}).click();await page.locator('#btn-gallery-back').click();await page.waitForFunction(()=>!document.getElementById('screen-ready').classList.contains('mobile-gallery-open'));
    // Definitive validation failures permit edits, unlike uncertain retries.
    await report(page);await openPublisher(page);await page.locator('#community-display-name').fill('Invalid\u202ename');await consent(page);postMode='invalid';const invalidIndex=posts.length;
    await page.locator('.community-publish-submit').click();await page.waitForFunction(()=>document.querySelector('.community-publish-status').textContent.includes('Correct the display name'));
    assert.equal(await page.locator('#community-display-name').isEnabled(),true);assert.equal(await page.locator('#community-public-consent').isChecked(),false);
    await page.locator('#community-display-name').fill('Corrected name');await consent(page);postMode='success';await page.locator('.community-publish-submit').click();await page.locator('.community-publish-success').waitFor({state:'visible'});assert.notEqual(posts[invalidIndex].body.id,posts[invalidIndex+1].body.id,'validation correction is a freshly consented request');await page.locator('.community-publish-cancel').click();await page.locator('#btn-again').click();
    // A new publication invalidates an unfinished pagination cursor and stale grid.
    listMode='pages';items=[makePainting(ids[1]),makePainting(ids[2])];await page.goto(`${url}?collection=community#landscapes`);await page.locator('.community-card').first().waitFor();assert.equal(await page.locator('.community-card').count(),1);assert.equal(await page.locator('#community-more').isVisible(),true);
    await report(page);await openPublisher(page);await consent(page);await page.locator('.community-publish-submit').click();await page.locator('.community-publish-success').waitFor({state:'visible'});const freshId=posts.at(-1).body.id;
    await page.locator('.community-publish-cancel').click();await page.locator('#btn-again').click();await page.locator('#gallery-tab-community').click();await page.waitForFunction(id=>document.querySelector('.community-card')?.dataset.painting===id,freshId);assert.equal(await page.locator('.community-card').count(),1,'refresh begins from newest page with no stale cards');
    const lastList=requests.filter(r=>r.method==='GET'&&new URL(r.url).pathname==='/api/paintings'&&!new URL(r.url).searchParams.has('id')).at(-1);assert.equal(new URL(lastList.url).searchParams.has('cursor'),false,'publication refresh never reuses an old cursor');
    // An owned pending row is hidden by the public API but remains withdrawable.
    const pendingId='44444444-4444-4444-8444-444444444444';await page.evaluate(id=>{const key='pulsepainting.publications.v1',all=JSON.parse(localStorage.getItem(key)||'{}');all[id]={id,ownerToken:'d'.repeat(64),status:'pending'};localStorage.setItem(key,JSON.stringify(all));},pendingId);
    await page.goto(`${url}?painting=${pendingId}#landscapes`);await page.getByRole('button',{name:'Remove pending publication',exact:true}).waitFor({state:'visible'});assert.equal(await page.locator('.community-view-share').isDisabled(),true);await page.getByRole('button',{name:'Remove pending publication',exact:true}).click();await page.getByRole('button',{name:'Remove painting',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.community-view-status').textContent.includes('has been removed'));assert.equal(deletes.at(-1).id,pendingId,'pending publication can be withdrawn without a public image');
    assert.deepEqual(errors,[]);await context.close();

    const desktop=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'}),desktopPage=await desktop.newPage();
    await desktop.route(`${BLOB}/**`,route=>route.fulfill({body:route.request().url().endsWith('thumbnail.webp')?publicThumbnail:publicJpeg,contentType:route.request().url().endsWith('thumbnail.webp')?'image/webp':'image/jpeg'}));
    let desktopPaintings=[];
    await desktopPage.route('**/api/paintings**',route=>route.fulfill({json:{paintings:desktopPaintings,nextCursor:null}}));await desktopPage.goto(url);await desktopPage.locator('.gallery-card').first().waitFor();assert.equal(await desktopPage.locator('.gallery-card').count(),16);await desktopPage.locator('#gallery-tab-community').click();await desktopPage.waitForFunction(()=>document.querySelectorAll('.community-example-card').length===8);assert.equal(await desktopPage.evaluate(()=>document.documentElement.scrollWidth),1440);await shot(desktopPage,`${name}-desktop-community`);
    desktopPaintings=Array.from({length:8},(_,i)=>makePainting(`77777777-7777-4777-8777-${String(i).padStart(12,'0')}`,{displayName:`Maker ${i+1}`}));
    await desktopPage.reload();await desktopPage.waitForFunction(()=>document.querySelectorAll('.community-card').length===8&&document.querySelectorAll('.community-example-card').length===0);assert.equal(await desktopPage.locator('#community-grid > button').count(),8,'eight shared paintings fully replace the fallback examples');await desktop.close();
    await checkExampleRecovery(browser,name);
    results.browsers.push({name,widths,checks:'consent, metrics isolation, pre-POST receipt, timeout/idempotency, late response, lazy/error/examples/mixed pagination, example history and focus, backend thumbnail URL, public history, native gesture, report/removal, recovery fragment, desktop layout'});
    await browser.close();browser=null;console.log(`COMMUNITY_SHARING_PASS ${name}`);
  }
  if(out)writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
