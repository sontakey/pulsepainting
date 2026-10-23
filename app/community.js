// Public paintings are separate from the fixture examples and local recordings.
// Only a reviewed raster and explicitly selected summary fields are submitted.
(() => {
  'use strict';
  const CANONICAL='https://www.pulsepainting.com/';
  const STORAGE='pulsepainting.publications.v1';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const TOKEN=/^[0-9a-f]{64}$/i;
  const BLOB_HOST='hnexw2ri5lomm3rg.public.blob.vercel-storage.com';
  const BLOB_PATH=/^\/community\/[a-z0-9-]{1,48}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(?:painting\.(?:jpg|png)|thumbnail\.webp)$/i;
  const byId=new Map(), drafts=new WeakMap(), memoryOwners=new Map();
  let hooks={},active=false,listLoaded=false,listBusy=false,cursor=null,listRequest=null,listVersion=0;
  let publishDialog=null,publishingView=null,publishVersion=0,viewer=null,viewVersion=0,viewRequest=null,viewed=null,viewOpener=null;
  const grid=document.getElementById('community-grid'),status=document.getElementById('community-status'),more=document.getElementById('community-more'),empty=document.getElementById('community-empty');
  const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!=null)el.textContent=text;return el;};
  function readReceipts(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  function receipt(id){return memoryOwners.get(id)||readReceipts()[id]||null;}
  function saveReceipt(value,{required=false}={}){
    memoryOwners.set(value.id,value);
    try{const all=readReceipts();all[value.id]=value;localStorage.setItem(STORAGE,JSON.stringify(all));if(readReceipts()[value.id]?.ownerToken!==value.ownerToken)throw new Error('Storage unavailable');return true;}
    catch{if(required)throw new Error('This browser cannot save your removal key. Allow site storage before publishing. You can still save or share the image privately.');return false;}
  }
  function owner(id){const value=receipt(id);return value&&TOKEN.test(value.ownerToken)?value:null;}
  function publicURL(id){return new URL(`p/${id}`,CANONICAL).href;}
  function privateURL(id,token){const url=new URL(CANONICAL);url.searchParams.set('painting',id);url.hash=`remove=${token}`;return url.href;}
  function imageURL(value){
    const url=new URL(value,location.href);
    if(url.username||url.password||url.search||url.hash)throw new Error('The painting image is unavailable.');
    if(url.origin===location.origin&&/\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)||url.protocol==='https:'&&url.hostname===BLOB_HOST&&!url.port&&BLOB_PATH.test(url.pathname))return url.href;
    throw new Error('The painting image is unavailable.');
  }
  function painting(value){
    if(!value||!UUID.test(value.id))throw new Error('The gallery returned an invalid painting.');
    const metrics=value.metrics&&typeof value.metrics==='object'?Object.fromEntries(['hr','rmssd','sdnn'].map(key=>[key,Number.isFinite(value.metrics[key])?value.metrics[key]:null])):null;
    return {id:value.id,displayName:typeof value.displayName==='string'?value.displayName.slice(0,60):'',metrics,imageURL:imageURL(value.imageURL),thumbnailURL:imageURL(value.thumbnailURL||value.imageURL),url:publicURL(value.id),createdAt:value.createdAt};
  }
  async function request(url,options={}){
    const response=await fetch(url,{cache:'no-store',...options});
    let result;try{result=await response.json();}catch{throw new Error('The gallery could not respond. Please try again.');}
    if(!response.ok){const error=new Error(result.error||'The gallery could not complete that request.');error.code=result.code;error.status=response.status;throw error;}
    return result;
  }
  function metricList(metrics){
    const list=node('dl','community-metrics');
    for(const [key,label,unit]of[['hr','Pulse','bpm'],['rmssd','RMSSD','ms'],['sdnn','SDNN','ms']]){
      if(!Number.isFinite(metrics?.[key]))continue;
      const pair=node('div');pair.append(node('dt','',label),node('dd','',`${Math.round(metrics[key])} ${unit}`));list.append(pair);
    }
    return list;
  }
  async function copy(text,target,success){
    try{await navigator.clipboard.writeText(text);target.textContent=success;}
    catch{target.replaceChildren(node('span','', 'Select and copy this link: '));const field=node('input','community-copy-field');field.type='text';field.readOnly=true;field.value=text;field.setAttribute('aria-label','Link to copy');target.append(field);field.focus();field.select();}
  }
  function addCard(item){
    byId.set(item.id,item);
    if(grid.querySelector(`[data-painting="${item.id}"]`))return;
    const card=node('button','community-card');card.type='button';card.dataset.painting=item.id;
    card.setAttribute('aria-label',`Open painting shared by ${item.displayName||'Anonymous'}`);
    const frame=node('span','community-card-art'),img=node('img');img.src=item.thumbnailURL;img.alt=`A pulse painting shared by ${item.displayName||'Anonymous'}`;img.width=1080;img.height=1350;img.loading='lazy';img.decoding='async';frame.append(img,node('span','community-card-arrow','↗'));
    const caption=node('span','community-card-caption');caption.append(node('strong','',item.displayName||'Anonymous'),node('span','', 'Shared a moment'));
    card.append(frame,caption);card.addEventListener('click',()=>hooks.openPainting?.(item.id,card));grid.append(card);
  }
  function ownedLinks(){
    const section=document.getElementById('community-owned'),host=section.querySelector('div');host.replaceChildren();
    const values=new Map(Object.entries(readReceipts()));for(const[id,value]of memoryOwners)values.set(id,value);
    const saved=[...values.values()].filter(value=>UUID.test(value?.id||'')&&TOKEN.test(value?.ownerToken||'')&&!['removed','rejected'].includes(value.status)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    section.hidden=!saved.length;
    for(const value of saved.slice(0,24)){
      const button=node('button','community-text-button',value.status==='pending'?'Check your recent publication':'Open your published painting');button.type='button';
      button.addEventListener('click',()=>hooks.openPainting?.(value.id,button));host.append(button);
    }
  }
  async function loadList({reset=false}={}){
    if(listBusy)return;
    const current=++listVersion;listRequest?.abort();listRequest=new AbortController();listBusy=true;more.hidden=true;
    if(reset){cursor=null;listLoaded=false;grid.replaceChildren();byId.clear();}
    grid.setAttribute('aria-busy','true');status.textContent='Gathering the shared paintings…';empty.hidden=true;
    const url=new URL('/api/paintings',location.origin);url.searchParams.set('limit','12');if(cursor)url.searchParams.set('cursor',cursor);
    try{
      const data=await request(url,{signal:listRequest.signal});
      if(current!==listVersion||!active)return;
      if(!Array.isArray(data.paintings))throw new Error('The gallery could not load. Please try again.');
      data.paintings.map(painting).forEach(addCard);cursor=typeof data.nextCursor==='string'?data.nextCursor:null;listLoaded=true;
      status.textContent=grid.children.length?'':'A shared gallery begins with one painting.';empty.hidden=grid.children.length>0;
      more.textContent='More paintings';more.hidden=!cursor;
    }catch(error){if(error.name!=='AbortError'&&current===listVersion&&active){status.textContent=error.message||'The gallery could not load.';more.textContent='Try loading again';more.hidden=false;}}
    finally{if(current===listVersion){listBusy=false;grid.setAttribute('aria-busy','false');}}
  }
  more.addEventListener('click',()=>loadList());

  function ensureViewer(){
    if(viewer)return;
    viewer=node('dialog','community-viewer');viewer.setAttribute('role','dialog');viewer.setAttribute('aria-labelledby','community-view-title');
    viewer.innerHTML='<button type="button" class="community-close" aria-label="Close painting">×</button><div class="community-view-art"><img alt="" width="1080" height="1350"></div><div class="community-view-copy"><p class="community-kicker">From the community</p><h2 id="community-view-title">A shared moment</h2><p class="community-byline"></p><div class="community-view-metrics"></div><p class="community-note">Shared by choice. The name and any measurements shown were selected by the person publishing this painting.</p><button type="button" class="community-primary community-view-share">Share painting</button><div class="community-view-navigation"><button type="button" aria-label="Previous community painting">←</button><span></span><button type="button" aria-label="Next community painting">→</button></div><div class="community-owner-actions" hidden><button type="button" class="community-text-button community-remove">Remove my painting</button><button type="button" class="community-text-button community-recovery">Copy private removal link</button></div><button type="button" class="community-text-button community-report">Report painting</button><div class="community-moderation" hidden></div><p class="community-view-status" role="status" aria-live="polite"></p></div>';
    document.body.append(viewer);
    const close=()=>hooks.closePainting?.();
    viewer.querySelector('.community-close').addEventListener('click',close);
    viewer.addEventListener('cancel',event=>{event.preventDefault();close();});
    viewer.addEventListener('close',()=>{if(viewer.open)return;++viewVersion;viewRequest?.abort();viewRequest=null;if(viewOpener?.isConnected&&viewOpener.getClientRects().length)viewOpener.focus({preventScroll:true});});
    const step=delta=>{const ids=[...byId.keys()],index=ids.indexOf(viewed?.id);if(ids.length>1)hooks.openPainting?.(ids[(Math.max(0,index)+delta+ids.length)%ids.length],viewOpener,{replace:true});};
    const nav=viewer.querySelectorAll('.community-view-navigation button');nav[0].addEventListener('click',()=>step(-1));nav[1].addEventListener('click',()=>step(1));
    viewer.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}});
    let gesture=null;const art=viewer.querySelector('.community-view-art');art.querySelector('img').draggable=false;
    art.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')gesture={id:event.pointerId,x:event.clientX,y:event.clientY};});
    art.addEventListener('pointercancel',()=>gesture=null);art.addEventListener('pointerup',event=>{if(!gesture||gesture.id!==event.pointerId)return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;gesture=null;if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);});
    viewer.querySelector('.community-view-share').addEventListener('click',()=>{if(viewed)window.PulseShare?.open({imageURL:viewed.imageURL,title:'A moment, painted by a pulse',fileName:'pulse-painting.jpg',publicURL:publicURL(viewed.id),caption:'A landscape made from a real pulse. Make your own at Pulse Painting.'});});
    viewer.querySelector('.community-recovery').addEventListener('click',()=>{const value=owner(viewed?.id);if(value)copy(privateURL(value.id,value.ownerToken),viewer.querySelector('.community-view-status'),'Private removal link copied. Keep it to yourself; anyone with it can remove this painting.');});
    viewer.querySelector('.community-remove').addEventListener('click',showRemoval);
    viewer.querySelector('.community-report').addEventListener('click',showReport);
  }
  function renderViewer(item){
    viewed=item;byId.set(item.id,item);
    viewer.querySelector('img').src=item.imageURL;viewer.querySelector('img').alt=`Pulse painting shared by ${item.displayName||'Anonymous'}`;
    viewer.querySelector('.community-byline').textContent=`Shared by ${item.displayName||'Anonymous'}`;
    viewer.querySelector('.community-view-metrics').replaceChildren(metricList(item.metrics));
    viewer.querySelector('.community-owner-actions').hidden=!owner(item.id);
    viewer.querySelector('.community-remove').textContent='Remove my painting';viewer.querySelector('.community-report').hidden=false;
    viewer.querySelector('.community-moderation').hidden=true;viewer.querySelector('.community-moderation').replaceChildren();
    viewer.querySelector('.community-view-status').textContent='';viewer.querySelector('.community-view-share').disabled=false;
    const ids=[...byId.keys()];viewer.querySelector('.community-view-navigation span').textContent=ids.length>1?`${ids.indexOf(item.id)+1} of ${ids.length} loaded`:'';
    viewer.querySelectorAll('.community-view-navigation button').forEach(button=>button.disabled=ids.length<2);
  }
  async function openPainting(id,opener){
    if(!UUID.test(id))return;
    window.PulseShare?.close();
    ensureViewer();viewOpener=opener||grid.querySelector(`[data-painting="${id}"]`)||document.getElementById('gallery-tab-community');
    const current=++viewVersion;viewRequest?.abort();viewRequest=new AbortController();viewed=null;
    viewer.querySelector('.community-view-status').textContent='Opening the painting…';viewer.querySelector('.community-view-share').disabled=true;
    viewer.querySelector('img').removeAttribute('src');viewer.querySelector('.community-byline').textContent='';viewer.querySelector('.community-view-metrics').replaceChildren();viewer.querySelector('.community-owner-actions').hidden=true;viewer.querySelector('.community-moderation').hidden=true;viewer.querySelector('.community-report').hidden=true;
    if(!viewer.open)viewer.showModal();viewer.querySelector('.community-close').focus({preventScroll:true});
    try{const data=await request(`/api/paintings?id=${encodeURIComponent(id)}`,{signal:viewRequest.signal});if(current!==viewVersion||!active||!viewer.open)return;renderViewer(painting(data.painting));}
    catch(error){if(error.name!=='AbortError'&&current===viewVersion){
      const saved=owner(id);
      if(error.status===404&&saved&&saved.status!=='removed'){
        viewed={id,pending:true};viewer.querySelector('.community-owner-actions').hidden=false;viewer.querySelector('.community-remove').textContent='Remove pending publication';
        viewer.querySelector('.community-view-status').textContent='This publication is not currently public. You can remove it now, including a submission that is still being prepared.';
      }else viewer.querySelector('.community-view-status').textContent=error.status===404?'This painting is no longer in the public gallery.':error.message;
    }}
  }
  function dismissViewer(){++viewVersion;viewRequest?.abort();if(viewer?.open){window.PulseShare?.close();viewer.close();}viewed=null;}
  function showRemoval(){
    const item=viewed,credentials=owner(item?.id);if(!item||!credentials)return;
    const panel=viewer.querySelector('.community-moderation');panel.replaceChildren(node('p','',item.pending?'Withdraw this publication so it cannot appear in the gallery?':'Remove this painting from the public gallery? Copies already saved by others are not affected.'));panel.hidden=false;
    const keep=node('button','community-secondary','Keep painting'),remove=node('button','community-primary','Remove painting');keep.type=remove.type='button';panel.append(keep,remove);
    keep.addEventListener('click',()=>{panel.hidden=true;viewer.querySelector('.community-remove').focus();});
    remove.addEventListener('click',async()=>{
      remove.disabled=true;keep.disabled=true;const feedback=viewer.querySelector('.community-view-status');feedback.textContent='Removing the painting…';
      try{await request(`/api/paintings?id=${item.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerToken:credentials.ownerToken})});saveReceipt({...credentials,status:'removed'});byId.delete(item.id);grid.querySelector(`[data-painting="${item.id}"]`)?.remove();listLoaded=false;if(viewed?.id!==item.id)return;viewer.querySelector('img').removeAttribute('src');viewer.querySelector('.community-view-share').disabled=true;viewer.querySelector('.community-owner-actions').hidden=true;panel.hidden=true;feedback.textContent='Your painting has been removed from the gallery.';}
      catch(error){if(viewed?.id===item.id){feedback.textContent=error.message;remove.disabled=false;keep.disabled=false;}}
    });remove.focus();
  }
  function showReport(){
    if(!viewed)return;const item=viewed,panel=viewer.querySelector('.community-moderation');panel.replaceChildren();panel.hidden=false;
    const label=node('label','community-field','Why are you reporting this painting?'),select=node('select');select.setAttribute('aria-label','Report reason');
    for(const[value,text]of[['inappropriate','Inappropriate content'],['privacy','Privacy concern'],['spam','Spam'],['other','Something else']]){const option=node('option','',text);option.value=value;select.append(option);}label.append(select);
    const send=node('button','community-primary','Send report'),cancel=node('button','community-secondary','Cancel');send.type=cancel.type='button';panel.append(label,send,cancel);
    cancel.addEventListener('click',()=>{panel.hidden=true;viewer.querySelector('.community-report').focus();});
    send.addEventListener('click',async()=>{send.disabled=true;const feedback=viewer.querySelector('.community-view-status');try{await request('/api/painting-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,reason:select.value})});if(viewed?.id===item.id){panel.hidden=true;feedback.textContent='Report received. Thank you for letting us know.';}}catch(error){if(viewed?.id===item.id){feedback.textContent=error.message;send.disabled=false;}}});select.focus();
  }

  function ensurePublisher(){
    if(publishDialog)return;
    publishDialog=node('dialog','community-publish-dialog');publishDialog.setAttribute('role','dialog');publishDialog.setAttribute('aria-labelledby','community-publish-title');
    publishDialog.innerHTML='<div class="community-publish-scroll"><p class="community-kicker">A shared moment</p><h2 id="community-publish-title">A place in the gallery.</h2><p class="community-publish-intro">A little of your world, for someone else to discover.</p><figure class="community-publish-preview"><img width="1080" height="1350" alt="Exact preview of the painting to publish"><figcaption>This is the image that will be public.</figcaption></figure><div class="community-publish-fields"><label class="community-field">Display name <span>Optional · leave blank for Anonymous</span><input id="community-display-name" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Anonymous"></label><label class="community-check"><input id="community-include-metrics" type="checkbox"><span>Include summary measurements<small>Pulse, RMSSD and SDNN, when available. These will be public.</small></span></label><div class="community-publish-metrics"></div><label class="community-check community-consent"><input id="community-public-consent" type="checkbox"><span>I choose to publish this image and the details shown here.<small>Anyone can view, share or save them. My raw recording stays on this device.</small></span></label></div><p class="community-publish-status" role="status" aria-live="polite"></p><div class="community-publish-success" hidden></div></div><div class="community-publish-actions"><button type="button" class="community-secondary community-publish-cancel">Cancel</button><button type="button" class="community-primary community-publish-submit" disabled>Publish painting</button></div>';
    document.body.append(publishDialog);
    publishDialog.querySelector('.community-publish-cancel').addEventListener('click',()=>closePublication());
    publishDialog.addEventListener('cancel',event=>{event.preventDefault();closePublication();});
    publishDialog.addEventListener('close',()=>{if(publishingView&&!publishDialog.open)closePublication();});
    publishDialog.querySelector('#community-display-name').addEventListener('input',()=>{if(!publishingView)return;publishingView.draft.displayName=publishDialog.querySelector('#community-display-name').value.trim();publishDialog.querySelector('#community-public-consent').checked=false;syncPublish();});
    publishDialog.querySelector('#community-include-metrics').addEventListener('change',()=>{if(!publishingView)return;publishingView.draft.includeMetrics=publishDialog.querySelector('#community-include-metrics').checked;publishDialog.querySelector('#community-public-consent').checked=false;preparePreview();});
    publishDialog.querySelector('#community-public-consent').addEventListener('change',syncPublish);
    publishDialog.querySelector('.community-publish-submit').addEventListener('click',submitPublication);
    const fit=()=>{if(publishDialog.open){publishDialog.style.setProperty('--community-viewport-height',`${Math.round(window.visualViewport?.height||innerHeight)}px`);publishDialog.style.setProperty('--community-viewport-top',`${Math.round(window.visualViewport?.offsetTop||0)}px`);}};
    window.visualViewport?.addEventListener('resize',fit,{passive:true});window.visualViewport?.addEventListener('scroll',fit,{passive:true});window.addEventListener('resize',fit,{passive:true});
    publishDialog.addEventListener('toggle',fit);
  }
  function syncPublish(){
    if(!publishingView)return;const draft=publishingView.draft;
    publishDialog.querySelector('.community-publish-submit').disabled=!draft.prepared||draft.busy||!publishDialog.querySelector('#community-public-consent').checked||draft.status==='published';
  }
  async function preparePreview(){
    const view=publishingView;if(!view)return;
    const version=++publishVersion;view.draft.prepared=null;syncPublish();
    publishDialog.querySelector('.community-publish-status').textContent='Preparing the exact public preview…';
    try{
      const prepared=await view.preparePublication({includeMetrics:view.draft.includeMetrics});
      if(publishingView!==view||version!==publishVersion)return;
      if(!(prepared.blob instanceof Blob)||prepared.blob.size>2*1024*1024)throw new Error('This painting could not be prepared for the gallery. Please try again.');
      view.draft.prepared=prepared;if(view.previewURL)URL.revokeObjectURL(view.previewURL);view.previewURL=URL.createObjectURL(prepared.blob);
      publishDialog.querySelector('.community-publish-preview img').src=view.previewURL;
      publishDialog.querySelector('.community-publish-metrics').replaceChildren(metricList(view.draft.includeMetrics?prepared.metrics:null));
      publishDialog.querySelector('.community-publish-status').textContent=view.draft.includeMetrics&&!Object.values(prepared.metrics||{}).some(Number.isFinite)?'No reliable summary measurements are available. Only your painting will be included.':'';
      syncPublish();
    }catch(error){if(publishingView===view&&version===publishVersion){publishDialog.querySelector('.community-publish-status').textContent=error.message||'Your preview could not be prepared. Close and try again.';}}
  }
  function openPublish({container,preparePublication}={}){
    if(!container?.isConnected||document.getElementById('screen-summary').hidden||typeof preparePublication!=='function')return;
    closePublication({focus:false});ensurePublisher();
    let draft=drafts.get(container);if(!draft){draft={displayName:'',includeMetrics:false,prepared:null,id:null,ownerToken:null,body:null,busy:false,status:'draft'};drafts.set(container,draft);}
    publishingView={container,preparePublication,draft,opener:document.activeElement,previewURL:null};
    publishDialog.querySelector('#community-display-name').value=draft.displayName;
    publishDialog.querySelector('#community-include-metrics').checked=draft.includeMetrics;
    publishDialog.querySelector('#community-public-consent').checked=false;
    publishDialog.querySelector('.community-publish-fields').hidden=false;publishDialog.querySelector('.community-publish-success').hidden=true;
    publishDialog.querySelector('.community-publish-submit').hidden=false;publishDialog.querySelector('.community-publish-submit').textContent=draft.body?'Retry publication':'Publish painting';
    publishDialog.querySelector('.community-publish-cancel').textContent='Cancel';
    for(const input of publishDialog.querySelectorAll('.community-publish-fields input'))input.disabled=!!draft.body;
    if(draft.body)publishDialog.querySelector('#community-public-consent').checked=true;
    publishDialog.style.setProperty('--community-viewport-height',`${Math.round(window.visualViewport?.height||innerHeight)}px`);publishDialog.style.setProperty('--community-viewport-top',`${Math.round(window.visualViewport?.offsetTop||0)}px`);
    publishDialog.showModal();publishDialog.querySelector('.community-publish-cancel').focus({preventScroll:true});
    if(draft.status==='published'){
      if(draft.prepared?.blob){publishingView.previewURL=URL.createObjectURL(draft.prepared.blob);publishDialog.querySelector('.community-publish-preview img').src=publishingView.previewURL;}
      else if(draft.published?.imageURL)publishDialog.querySelector('.community-publish-preview img').src=draft.published.imageURL;
      showPublished(draft);return;
    }
    if(draft.body&&draft.prepared){const view=publishingView;view.previewURL=URL.createObjectURL(draft.prepared.blob);publishDialog.querySelector('.community-publish-preview img').src=view.previewURL;publishDialog.querySelector('.community-publish-metrics').replaceChildren(metricList(draft.includeMetrics?draft.prepared.metrics:null));publishDialog.querySelector('.community-publish-status').textContent=draft.busy?'Publishing your painting…':'Retry to check the same publication. Its image and details are fixed.';syncPublish();}
    else preparePreview();
  }
  function closePublication({focus=true}={}){
    ++publishVersion;const view=publishingView;publishingView=null;
    if(view?.previewURL)URL.revokeObjectURL(view.previewURL);
    if(publishDialog?.open)publishDialog.close();
    if(focus&&view?.opener?.isConnected&&view.opener.getClientRects().length)view.opener.focus({preventScroll:true});
  }
  function base64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('The painting could not be read. Please try again.'));reader.readAsDataURL(blob);});}
  async function submitPublication(){
    const view=publishingView,draft=view?.draft;
    if(!view||!draft.prepared||draft.busy||draft.status==='published'||!publishDialog.querySelector('#community-public-consent').checked)return;
    const selection={blob:draft.prepared.blob,metrics:draft.prepared.metrics,includeMetrics:draft.includeMetrics,displayName:draft.displayName};
    draft.busy=true;syncPublish();for(const input of publishDialog.querySelectorAll('.community-publish-fields input'))input.disabled=true;
    const feedback=publishDialog.querySelector('.community-publish-status');feedback.textContent='Preparing your publication…';
    try{
      if(!draft.id){draft.id=crypto.randomUUID();draft.ownerToken=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');}
      saveReceipt({id:draft.id,ownerToken:draft.ownerToken,status:'pending',createdAt:new Date().toISOString()},{required:true});
      if(!draft.body){
        const image=await base64(selection.blob);
        // Consent can be dismissed while reading the raster; no POST in that case.
        if(publishingView!==view||document.getElementById('screen-summary').hidden)return;
        draft.body={id:draft.id,ownerToken:draft.ownerToken,image,displayName:selection.displayName,includeMetrics:selection.includeMetrics,metrics:selection.includeMetrics?selection.metrics:null,consentVersion:1};
      }
      for(const input of publishDialog.querySelectorAll('.community-publish-fields input'))input.disabled=true;
      publishDialog.querySelector('.community-publish-cancel').textContent='Close';feedback.textContent='Publishing your painting… You can close this window; publication will continue.';
      // Once submitted, leaving the screen only dismisses UI. A late successful
      // receipt must still be retained; aborting would not roll back publication.
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
      let data;try{data=await request('/api/paintings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft.body),signal:controller.signal});}finally{clearTimeout(timeout);}
      const result=painting(data.painting);draft.status='published';draft.published=result;
      saveReceipt({id:draft.id,ownerToken:draft.ownerToken,status:'published',createdAt:result.createdAt});listLoaded=false;
      if(publishingView?.draft===draft&&!document.getElementById('screen-summary').hidden)showPublished(draft);
    }catch(error){
      if(error.status===400&&error.code==='invalid_request'){
        // Definitive validation failure created no publication. Let the maker
        // correct the details and consent again; uncertain requests stay fixed.
        saveReceipt({id:draft.id,ownerToken:draft.ownerToken,status:'rejected'});draft.body=null;draft.id=null;draft.ownerToken=null;
        if(publishingView?.draft===draft){publishDialog.querySelector('#community-public-consent').checked=false;publishDialog.querySelector('.community-publish-cancel').textContent='Cancel';}
      }
      if(publishingView?.draft===draft){feedback.textContent=error.name==='AbortError'?'The response is taking longer than expected. Retry to check the same publication; it may already be public.':error.code==='publication_pending'?'Your painting is still being prepared. Wait a moment, then retry the same publication.':error.message;publishDialog.querySelector('.community-publish-submit').textContent=draft.body?'Retry publication':'Publish painting';}
    }
    finally{draft.busy=false;if(publishingView?.draft===draft){if(!draft.body)for(const input of publishDialog.querySelectorAll('.community-publish-fields input'))input.disabled=false;syncPublish();}}
  }
  function showPublished(draft){
    publishDialog.querySelector('.community-publish-fields').hidden=true;publishDialog.querySelector('.community-publish-submit').hidden=true;publishDialog.querySelector('.community-publish-cancel').textContent='Done';
    const feedback=publishDialog.querySelector('.community-publish-status');feedback.textContent='Your painting has a place in the gallery.';
    const success=publishDialog.querySelector('.community-publish-success');success.replaceChildren();success.hidden=false;
    const view=node('a','community-primary','View your painting');view.href=publicURL(draft.id);
    const share=node('button','community-secondary','Share public link');share.type='button';share.addEventListener('click',()=>window.PulseShare?.open({blob:draft.prepared?.blob,imageURL:draft.published?.imageURL,publicURL:publicURL(draft.id),title:'My Pulse Painting',fileName:'pulse-painting.jpg'}));
    const recovery=node('button','community-text-button','Copy private removal link');recovery.type='button';recovery.addEventListener('click',()=>copy(privateURL(draft.id,draft.ownerToken),feedback,'Private removal link copied. Keep it to yourself; it allows removal of your painting.'));
    success.append(view,share,recovery,node('p','community-note','This browser remembers your removal key. Save the private removal link to manage the painting from another device.'));
  }
  // A recovery secret stays in the fragment, never in a request, referrer or
  // public share URL. Consume it into this browser's private ownership receipt.
  const arrival=new URL(location.href),recoveryToken=arrival.hash.match(/^#remove=([0-9a-f]{64})$/i)?.[1],recoveryId=arrival.searchParams.get('painting');
  if(recoveryToken&&UUID.test(recoveryId||'')){if(!owner(recoveryId))saveReceipt({id:recoveryId,ownerToken:recoveryToken.toLowerCase(),status:'published'});arrival.hash='landscapes';history.replaceState(history.state,'',arrival);}
  window.PulseCommunity=Object.freeze({
    configure:value=>{hooks=value;},
    show:({paintingId=null,opener=null}={})=>{active=true;ownedLinks();if(!listLoaded&&!listBusy)loadList({reset:true});if(paintingId)openPainting(paintingId,opener);else dismissViewer();},
    hide:()=>{active=false;++listVersion;listRequest?.abort();listBusy=false;grid.setAttribute('aria-busy','false');dismissViewer();},
    dismiss:dismissViewer,openPublish,closePublication,
  });
})();
