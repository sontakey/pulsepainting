// Public example gallery. This module never reads a recording or uploads art.
const ready = document.getElementById('screen-ready');
const desktop = ready?.classList.contains('desktop-ready');
const requestedScene = new URL(location.href).searchParams.get('scene');
const manifestURL = new URL('./assets/gallery/manifest.json', import.meta.url);
const canonicalURL = 'https://www.pulsepainting.com/';
const groups = {
  water: ['open-ocean','quiet-lake','coastal-cliffs','river-valley','island-archipelago','waterfall-gorge','glacial-fjord','reed-wetland'],
  land: ['meadow','alpine-peaks','rolling-hills','sand-dunes','desert-mesas','forest-canopy'],
  sky: ['sea-of-clouds','aurora-night'],
};
const descriptions = {
  meadow:'An open field, written in the rise and fall of a pulse.',
  'open-ocean':'A wide horizon. Traces of a rhythm become the movement of water.',
  'alpine-peaks':'A distant ridge, with every contour carrying a little of the recording.',
  'quiet-lake':'Still water and soft shores, shaped by a living rhythm.',
  'coastal-cliffs':'A meeting of land and water, drawn from the same pulse strokes.',
  'river-valley':'A winding passage through layered land, following the recording’s contours.',
  'rolling-hills':'Gentle folds of land, made from the changing shape of a pulse.',
  'sand-dunes':'A quiet sweep of sand, with a rhythm running through every ridge.',
  'desert-mesas':'Broad, sunlit landforms rising from small movements in the recording.',
  'island-archipelago':'Islands and open water, a landscape assembled from pulse-shaped marks.',
  'waterfall-gorge':'Water moving between steep banks, traced by the recording.',
  'glacial-fjord':'Cool water held between distant slopes, built from a single rhythm.',
  'reed-wetland':'A low, quiet landscape where land and water meet.',
  'forest-canopy':'Overlapping growth and shelter, following the pulse’s natural variations.',
  'sea-of-clouds':'A soft horizon of drifting forms, drawn from the same recorded rhythm.',
  'aurora-night':'A night sky carrying a pulse in its ribbons of light.',
};

if (desktop || requestedScene) initGallery().catch(() => {
  const status = document.getElementById('gallery-load-status');
  if (status) status.textContent = 'The example gallery could not load. You can still scan the code to make your own painting.';
  document.getElementById('gallery-grid')?.setAttribute('aria-busy','false');
});

async function initGallery() {
  if (desktop) {
    const heading = ready.querySelector(':scope > h1');
    heading.id = 'desktop-hero-title';
    heading.replaceChildren(document.createTextNode('Your pulse,'),document.createElement('br'),document.createTextNode('made into a place.'));
    document.getElementById('desktop-title-slot').append(heading);
    const jump = event => {
      const target = document.getElementById(event.currentTarget.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
      if (target.id==='paint-on-phone') {
        target.tabIndex=-1;target.focus({preventScroll:true});
      }
    };
    ready.querySelectorAll('.desktop-experience a[href^="#"]').forEach(link=>link.addEventListener('click',jump));
  }
  const response = await fetch(manifestURL);
  if (!response.ok) throw new Error('Example manifest unavailable');
  const manifest = await response.json();
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length!==16) throw new Error('Incomplete example gallery');
  const scenes = manifest.scenes.filter(scene => /^[a-z-]+$/.test(scene.id) && typeof scene.name==='string' && typeof scene.thumbnail==='string' && typeof scene.image==='string');
  if (scenes.length!==16) throw new Error('Invalid example gallery');
  const assets = value => {
    const url = new URL(value,manifestURL);
    if (url.origin!==manifestURL.origin || !url.pathname.startsWith(new URL('./',manifestURL).pathname)) throw new Error('Unexpected gallery asset');
    return url.href;
  };
  const sceneLink = scene => { const url=new URL(canonicalURL);url.searchParams.set('scene',scene.id);url.hash='landscapes';return url.href; };
  let activeIndex=0, previousFocus=null, activeFilter='all', shareFile=null, sharePreparation=null, generation=0;
  const dialog=document.createElement('dialog');
  dialog.className='gallery-lightbox';dialog.setAttribute('aria-labelledby','gallery-dialog-title');dialog.setAttribute('aria-describedby','gallery-dialog-note');
  dialog.innerHTML=`<button class="gallery-dialog-close" type="button" aria-label="Close landscape">×</button><div class="gallery-lightbox-art"><img id="gallery-dialog-image" width="1080" height="1080" alt=""></div><div class="gallery-lightbox-copy"><p class="gallery-eyebrow">A Pulse Painting example</p><h2 id="gallery-dialog-title"></h2><p class="gallery-lightbox-description"></p><p id="gallery-dialog-note" class="gallery-lightbox-note">An example made from a public pulse recording. Your painting comes from your own rhythm.</p><button class="gallery-share" type="button">Share this landscape</button><button class="gallery-copy-link" type="button">Copy example link</button><p class="gallery-share-status" role="status" aria-live="polite"></p><button class="gallery-dialog-paint" type="button">Make a painting of your own ↗</button><div class="gallery-lightbox-navigation"><span id="gallery-dialog-position" aria-live="polite"></span><button type="button" data-gallery-step="-1" aria-label="Previous landscape">←</button><button type="button" data-gallery-step="1" aria-label="Next landscape">→</button></div></div>`;
  document.body.append(dialog);
  const image=dialog.querySelector('#gallery-dialog-image'), title=dialog.querySelector('h2'), status=dialog.querySelector('.gallery-share-status');
  const update = index => {
    activeIndex=(index+scenes.length)%scenes.length;
    const scene=scenes[activeIndex];
    title.textContent=scene.name;
    dialog.querySelector('.gallery-lightbox-description').textContent=descriptions[scene.id]||'A landscape made from recorded pulse strokes.';
    image.src=assets(scene.image);image.alt=`${scene.name}: an example generated from the public pulse recording`;
    dialog.querySelector('#gallery-dialog-position').textContent=`${activeIndex+1} / ${scenes.length}`;
    status.textContent='';
    sharePreparation?.abort();sharePreparation=new AbortController();shareFile=null;
    const current=++generation,button=dialog.querySelector('.gallery-share');
    button.disabled=true;button.textContent='Preparing image…';
    if(!scene.shareImage){button.disabled=false;button.textContent='Share this landscape';return;}
    fetch(assets(scene.shareImage),{signal:sharePreparation.signal}).then(async response=>{
      if(!response.ok)throw new Error('Example image unavailable');
      const blob=await response.blob();
      if(blob.size>4*1024*1024||blob.type!=='image/jpeg')throw new Error('Unexpected example image');
      if(current!==generation)return;
      shareFile=new File([blob],`pulse-painting-${scene.id}.jpg`,{type:'image/jpeg'});
    }).catch(error=>{if(error.name!=='AbortError'&&current===generation)status.textContent='Image unavailable. You can still share the example link.';}).finally(()=>{
      if(current===generation){button.disabled=false;button.textContent='Share this landscape';}
    });
  };
  const open = (index,opener=document.activeElement) => {
    previousFocus=opener;update(index);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.gallery-dialog-close').focus({preventScroll:true});
  };
  const close = () => dialog.close();
  dialog.querySelector('.gallery-dialog-close').addEventListener('click',close);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  dialog.addEventListener('close',()=>{generation++;sharePreparation?.abort();sharePreparation=null;shareFile=null;if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Tab'){
      const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href]')].filter(node=>node.getClientRects().length);
      if(controls.length){
        event.preventDefault();
        const current=controls.indexOf(document.activeElement);
        const next=current<0?(event.shiftKey?controls.length-1:0):(current+(event.shiftKey?-1:1)+controls.length)%controls.length;
        controls[next].focus();
      }
    }
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();update(activeIndex+(event.key==='ArrowRight'?1:-1));}
  });
  dialog.querySelectorAll('[data-gallery-step]').forEach(button=>button.addEventListener('click',()=>update(activeIndex+Number(button.dataset.galleryStep))));
  async function copyLink() {
    const url=sceneLink(scenes[activeIndex]);
    try {await navigator.clipboard.writeText(url);status.textContent='Example link copied. Invite someone to make their own.';}
    catch {status.replaceChildren(document.createTextNode('Copy this example link: '));const link=document.createElement('a');link.href=url;link.textContent=url;status.append(link);}
  }
  dialog.querySelector('.gallery-copy-link').addEventListener('click',copyLink);
  dialog.querySelector('.gallery-share').addEventListener('click',async()=>{
    const scene=scenes[activeIndex];status.textContent='';
    if(!navigator.share){await copyLink();return;}
    try {
      // File preparation happens on open. Invoke share synchronously from this
      // click so Safari retains the user activation for its native sheet.
      const payload=shareFile&&navigator.canShare?.({files:[shareFile]})
        ?{files:[shareFile],title:`${scene.name} · Pulse Painting`}
        :{title:`${scene.name} · Pulse Painting`,text:'A landscape painted by a pulse. Take three quiet minutes and make your own.',url:sceneLink(scene)};
      await navigator.share(payload);status.textContent='Thanks for sharing a little inspiration.';
    }
    catch(error){if(error?.name!=='AbortError')await copyLink();}
  });
  dialog.querySelector('.gallery-dialog-paint').addEventListener('click',()=>{
    previousFocus=desktop?document.getElementById('paint-on-phone'):document.getElementById('btn-start');
    if(desktop)previousFocus.tabIndex=-1;
    close();
    if(desktop){const target=document.getElementById('paint-on-phone');target.tabIndex=-1;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target.focus({preventScroll:true});}
    else document.getElementById('btn-start')?.focus();
  });
  if(desktop){
    const hero=scenes.find(scene=>scene.id==='quiet-lake')||scenes[0];
    const heroImage=document.getElementById('gallery-hero-image');heroImage.src=assets(hero.image);
    document.getElementById('gallery-hero-scene').textContent=hero.name;
    const grid=document.getElementById('gallery-grid');
    const fragment=document.createDocumentFragment();
    scenes.forEach((scene,index)=>{
      const figure=document.createElement('figure');figure.className='gallery-card';figure.dataset.scene=scene.id;
      const button=document.createElement('button');button.type='button';button.className='gallery-open';button.setAttribute('aria-label',`Open ${scene.name} example`);
      const frame=document.createElement('span');frame.className='gallery-art-frame';
      const thumb=document.createElement('img');thumb.src=assets(scene.thumbnail);thumb.width=640;thumb.height=640;thumb.loading='lazy';thumb.decoding='async';thumb.alt=`${scene.name} generated from the public example recording`;
      frame.append(thumb);
      const caption=document.createElement('span');caption.className='gallery-card-caption';const name=document.createElement('strong');name.textContent=scene.name;const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');caption.append(name,number);button.append(frame,caption);button.addEventListener('click',()=>open(index,button));figure.append(button);fragment.append(figure);
    });
    grid.append(fragment);grid.setAttribute('aria-busy','false');document.getElementById('gallery-load-status').textContent='';
    ready.querySelectorAll('[data-gallery-filter]').forEach(button=>button.addEventListener('click',()=>{
      activeFilter=button.dataset.galleryFilter;let count=0;
      ready.querySelectorAll('[data-gallery-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      grid.querySelectorAll('.gallery-card').forEach(card=>{card.hidden=activeFilter!=='all'&&!groups[activeFilter]?.includes(card.dataset.scene);if(!card.hidden)count++;});
      document.getElementById('gallery-count').textContent=`${count} example landscapes`;
    }));
  }
  const requestedIndex=scenes.findIndex(scene=>scene.id===requestedScene);
  // The manifest can finish loading after a phone visitor starts capture.
  // A startup example must never interrupt placement or an active recording.
  if(requestedIndex>=0 && ready && !ready.hidden)open(requestedIndex);
}
