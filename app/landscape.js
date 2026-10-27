/* Pulse Painting landscape renderer.
 * Every scenic mark retains an accepted source path and a documented artistic terrain mapping.
 * Paper/granulation are materials, never synthetic pulse or scenery geometry.
 */
(function (global) {
  'use strict';
  // Capture the script location once so the worker follows hashed deployments
  // and subdirectory installs rather than assuming the site root.
  const rasterWorkerUrl=global.document?.currentScript?.src?new URL('landscape-raster-worker.js',global.document.currentScript.src).href:null;
  const rasterDocument=global.document||{createElement:()=>new global.OffscreenCanvas(1,1)};
  const VERSION = 'landscape-2';
  const WORLD = 1080, GAP = .1500001, SLOT_SECONDS = 5;
  const FAMILIES = [
    ['meadow', 'Meadow'], ['open-ocean', 'Open ocean'], ['alpine-peaks', 'Alpine peaks'],
    ['quiet-lake', 'Quiet lake'], ['coastal-cliffs', 'Coastal cliffs'], ['river-valley', 'River valley'],
    ['rolling-hills', 'Rolling hills'], ['sand-dunes', 'Sand dunes'], ['desert-mesas', 'Desert mesas'],
    ['island-archipelago', 'Island archipelago'], ['waterfall-gorge', 'Waterfall gorge'],
    ['glacial-fjord', 'Glacial fjord'], ['reed-wetland', 'Reed wetland'], ['forest-canopy', 'Forest canopy'],
    ['sea-of-clouds', 'Sea of clouds'], ['aurora-night', 'Aurora night'],
  ].map(([id, name]) => Object.freeze({ id, name }));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  function normalized(value,min,max){if(max===min)return .5;const scale=Math.max(1,Math.abs(min),Math.abs(max));return (value/scale-min/scale)/(max/scale-min/scale);}
  function hash(value) {
    let h = 2166136261;
    for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function random(seed) {
    let state = seed >>> 0;
    return () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const noise = (seed, index) => { let x = Math.imul(seed ^ index, 0x45d9f3b); x = Math.imul(x ^ x >>> 16, 0x45d9f3b); return ((x ^ x >>> 16) >>> 0) / 4294967296; };
  function radical(index, base = 2) { let value = 0, fraction = 1 / base; while (index > 0) { value += (index % base) * fraction; index = Math.floor(index / base); fraction /= base; } return value; }
  // These are artistic terrain guides, never separately drawn geometry. A
  // guide receives ink only where an accepted, unchanged source path exists.
  const SCENES = {
    meadow:{roles:['hill','grass','sky'],cycle:[0,1,1,1,0,1,1,1]},
    'open-ocean':{roles:['water','sky'],cycle:[0,0,0,0,0,1]},
    'alpine-peaks':{roles:['ridge','sky'],cycle:[0,0,0,0,0,0,1]},
    'quiet-lake':{roles:['shore','water','reflection','lake-ridge'],cycle:[0,1,0,3,1,1,0,0,0,1,0,1,0,0,3,1,1,0,0,1,0,0,1,1,3,1,1,1,1,1]},
    'coastal-cliffs':{roles:['shelf','water','cliff','sky'],cycle:[0,2,1,2,1,2,1,2]},
    'river-valley':{roles:['bank-left','water','bank-right','sky'],cycle:[0,2,1,0,2,1]},
    'rolling-hills':{roles:['hill','sky'],cycle:[0,0,0,0,0,1]},
    'sand-dunes':{roles:['dune','sky'],cycle:[0,0,0,0,0,1]},
    'desert-mesas':{roles:['mesa','sky'],cycle:[0,0,0,0,0,1]},
    'island-archipelago':{roles:['water','island','sky'],cycle:[0,1,0,0,1,0,0]},
    'waterfall-gorge':{roles:['wall-left','cascade','wall-right','pool','sky'],cycle:[0,2,1,3,0,2,1,3]},
    'glacial-fjord':{roles:['wall-left','water','wall-right','sky'],cycle:[0,2,1,0,2,1]},
    'reed-wetland':{roles:['reeds-left','water','reeds-right','sky'],cycle:[0,1,2,1,0,2,1]},
    'forest-canopy':{roles:['canopy','sky'],cycle:[0,0,0,0,0,0,1]},
    'sea-of-clouds':{roles:['cloud','summit','sky'],cycle:[0,0,1,0,0,0,2]},
    'aurora-night':{roles:['curtain','ridge','water'],cycle:[0,0,1,0,2,0,0,2,0]},
  };
  const bell=(u,c,w)=>Math.exp(-Math.pow((u-c)/w,2));
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  function riverAt(family,z,curve){
    // A single perspective field is shared by both banks and every water
    // cross-section. Their edges cannot separate as more source ink arrives.
    const p=curve.composition,s=clamp(z,0,1.04),near=Math.pow(s,1.35);
    const distant=family==='waterfall-gorge'?230:family==='glacial-fjord'?365:350;
    const y=distant+p.horizon+(960-distant-p.horizon)*near;
    const fjord=family==='glacial-fjord',gorge=family==='waterfall-gorge';
    const fjordWidth=(45+530*Math.pow(s,1.65))*(.94+.10*Math.sin(s*4.1+p.phase*.25)+.045*Math.sin(s*8.6+p.phase*.4));
    const width=gorge?(185+60*Math.sin(s*Math.PI*.75))*p.channelWidth:(fjord?fjordWidth:28+360*Math.pow(s,1.8))*p.channelWidth;
    const turn=Math.sin(s*5.35+p.bendPhase)-Math.sin(p.bendPhase);
    const fjordTurn=Math.sin(s*3.2+p.bendPhase)-Math.sin(p.bendPhase);
    const direction=p.asymmetry<0?-1:1;
    const drift=gorge?22*Math.sin(s*2.2+p.phase*.1)+p.asymmetry*20:fjord?fjordTurn*p.bend*.42*direction+(s-.4)*p.asymmetry*35:turn*p.bend*(.18+.66*s)*direction;
    const center=clamp(p.viewpoint+drift,90+width/2,990-width/2);
    return {y,center,width};
  }
  function guide(curve,u){
    const z=curve.depth,role=curve.role,family=curve.family,phase=curve.phase,p=curve.composition;
    const distance=Math.pow(z,1.55);
    let x=42+996*u,y=500;
    if(family==='quiet-lake'&&role==='lake-ridge'){
      x=42+996*u;
      y=478+p.horizon*.24+curve.count*17-(149-curve.count*15)*bell(u,.81+p.asymmetry*.05,.27)-89*bell(u,.22,.20)-33*bell(u,.02,.18);
    }else if(role==='sky'){
      x=42+996*u;y=(family==='sea-of-clouds'?300:family==='island-archipelago'?325:285)+p.horizon*.4+12*Math.sin(u*Math.PI*1.2+phase);
    }else if(family==='alpine-peaks'){
      // The far silhouette owns one summit. Nearer contours become broad,
      // asymmetrical foothills instead of repeating that peak like a stack.
      const summit=p.summit;
      const far=1-smooth((z-.12)/.50),front=smooth((z-.30)/.65);
      const peak=clamp(summit+front*(p.foregroundShift+.16*Math.sin(curve.count*2.4+p.phase)),.08,.92);
      y=470+500*distance+p.horizon*(1-z)
        -(300*far+90*(1-far))*bell(u,peak,.12+.19*front)
        -(115*far+75*front)*bell(u,summit-.22-p.asymmetry*.05,.17+.11*front)
        -155*front*bell(u,p.asymmetry>0?.13:.88,.25)
        +28*front*Math.sin(u*Math.PI*1.4+p.phase);
    }else if(role==='hill'||role==='grass'){
      if(family==='meadow'){
        if(role==='grass'){
          const centers=[.18,.78,.48],center=centers[curve.count%3]+p.asymmetry*.035;
          const width=430+z*70;
          x=clamp(center*1080-width/2,32,1048-width)+width*u;
          const across=(x-42)/996;
          y=610+distance*345-65*bell(across,.27,.36)+30*across+25*Math.sin(across*3+p.phase);
        }else{
          y=345+distance*245-55*bell(u,.28+p.asymmetry*.16,.42)+50*u+22*Math.sin(u*3.3+p.phase);
        }
      }else{
        const center=.27+.38*smooth(z)+p.asymmetry*.16+.07*Math.sin(curve.count*1.7+p.phase);
        y=400+distance*565-(110+95*z)*bell(u,center,.31+.10*z)-70*z*bell(u,1-center,.23)+45*z*(u-.5);
      }
    }else if(role==='dune'){
      const peak=.28+.28*z+p.asymmetry*.10+.10*Math.sin(curve.count*1.9+p.phase),spread=u<peak?.50:.20+.06*z;
      y=445+distance*540-(165+40*z)*bell(u,peak,spread)+(110+60*z)*(u-.5)*Math.sin(z*3.2+p.phase*.15);
    }else if(role==='mesa'){
      const shift=p.asymmetry*.05+z*p.foregroundShift*.4;
      const left=smooth((u-.09-shift)/.08)*(1-smooth((u-.41-shift)/.13));
      const right=smooth((u-.67+shift)/.07)*(1-smooth((u-.85+shift)/.10));
      const fore=smooth((z-.38)/.55);
      y=555+distance*410-(265-195*fore)*left-(130-90*fore)*right-75*fore*bell(u,.3+p.asymmetry*.2,.40);
    }else if(role==='canopy'){
      // Unequal, overlapping crown groups replace regular full-width rows.
      // Every crown edge is still a measured path; the guide only carries it.
      const group=curve.count%5,centers=[.20,.77,.44,.10,.88],widths=[560,470,590,370,340];
      const center=curve.count===0?.5:centers[group]+p.asymmetry*.055,width=curve.count===0?1000:widths[group]*(.70+.30*z);
      x=clamp(center*1080-width/2,30,1050-width)+width*u;
      const shoulder=.21+.12*noise(curve.count+71,7),second=.66+.14*noise(curve.count+91,3);
      y=325+distance*610
        -(70+55*z)*bell(u,shoulder,.20+.06*noise(curve.count,17))
        -(45+62*z)*bell(u,second,.24)
        +18*Math.sin(u*3+p.phase+group);
    }else if(role==='cloud'){
      const group=curve.count%4,centers=[.24,.76,.42,.70],widths=[700,610,800,570];
      const width=widths[group],center=centers[group]+p.asymmetry*.025;
      x=clamp(center*1080-width/2,28,1052-width)+width*u;
      y=390+distance*560-(40+10*z)*bell(u,.27,.23)-36*bell(u,.70,.28)+15*Math.sin(u*3+p.phase+group);
    }else if(role==='summit'){
      const group=curve.count%3,center=[.40,.78,.22][group]+p.asymmetry*.04,width=[680,410,380][group];
      x=clamp(center*1080-width/2,40,1040-width)+width*u;
      y=345+z*310-(180-65*z)*bell(u,.45+p.asymmetry*.12,.14)-45*bell(u,.70,.18);
    }else if(role==='curtain'){
      // Parallel, overlapping curtains share a sweeping wind field. Unequal
      // heights and breadth keep the aurora open without crossing at a waist.
      const group=curve.count%3,centers=[135,395,655],height=[660,545,610],starts=[35,80,20];
      const spread=165+group*8,sway=145*Math.sin(u*2.65+.12*group)+24*Math.sin(u*5.7+.3*group);
      x=centers[group]+(z-.5)*spread+sway+p.asymmetry*25;
      y=starts[group]+u*height[group]+z*32+p.horizon*.10;
    }else if(family==='aurora-night'&&role==='ridge'){
      y=800+distance*65-72*(1-z*.6)*bell(u,.31+p.asymmetry*.1,.14)-36*bell(u,.73,.22);
    }else if(family==='coastal-cliffs'&&(role==='shelf'||role==='cliff')){
      if(role==='shelf'){
        x=40+600*u;y=230+425*Math.pow(Math.max(0,u),1.6)+distance*58-38*Math.sin(u*Math.PI)+p.horizon;
      }else if(curve.count===0){
        // The first accepted cliff path establishes the whole face beneath
        // the lip. Later accepted paths add the vertical rock seams.
        x=40+600*u;y=242+425*Math.pow(Math.max(0,u),1.6)-38*Math.sin(u*Math.PI)+p.horizon;
      }else{
        const along=.035+.91*z,top=230+425*Math.pow(along,1.6)-38*Math.sin(along*Math.PI)+p.horizon;
        const foot=440+425*Math.pow(along,1.6)+p.horizon;
        x=40+600*along+22*Math.sin(u*Math.PI)*Math.sin(along*4+p.phase);
        y=mix(top+10,foot,u);
      }
    }else if(role==='cascade'){
      const river=riverAt(family,u,curve);
      x=river.center+(z-.5)*river.width*.82-12;y=river.y;
    }else if(role==='pool'){
      x=145+790*u;y=895+distance*85+16*Math.sin(u*Math.PI);
    }else if(role==='shore'){
      const left=curve.count%2===0,group=Math.floor(curve.count/2);
      const width=group===0?(left?475:425):[0,285,245,320][group%4]||265;
      const inset=group===0?0:[0,30,187,74][group%4];
      x=(left?42+inset:1038-width-inset)+width*u;
      const across=left?(x-42)/505:(1038-x)/455;
      const height=[133,65,105,54,84,44][group%6];
      y=507-height*bell(across,.03,.48)-27*bell(across,.54,.24)+group*2;
    }else if(role==='reflection'){
      const left=curve.count%2===0,group=Math.floor(curve.count/2),width=(left?430:390)*(1-.12*Math.min(group,4));
      x=(left?48:1032-width)+width*u;
      const near=left?u:1-u;
      y=534+132*bell(near,.08,.31)+62*bell(near,.55,.22)+group*27;
    }else if(role.startsWith('reeds-')){
      const left=role.endsWith('left'),shift=95*Math.sin(curve.count*1.7+p.phase),width=235+z*180;
      const center=(left?230:810)+shift+p.asymmetry*55;
      x=clamp(center-width/2,40,1040-width)+width*u;
      y=365+distance*575+24*Math.sin(u*Math.PI)-18*Math.sin(z*5+p.phase);
    }else if(role.startsWith('wall-')){
      const left=role.endsWith('left'),river=riverAt(family,z,curve),edge=river.center+(left?-1:1)*river.width/2;
      x=left?mix(40,edge,u):mix(edge,1040,u);
      const away=left?1-u:u;
      if(family==='waterfall-gorge'){
        // Close rock faces surround a broad, nearly vertical falling column.
        // Unequal shoulders distinguish the gorge from the distant fjord.
        y=river.y-(left?35:90)*(1-z*.35)*away-(25+20*z)*Math.sin(away*Math.PI*.9)
          -(left?20:45)*bell(away,left?.4:.65,.3);
      }else{
        y=river.y-(155+145*z)*away-70*(.25+.75*z)*Math.sin(away*Math.PI*.82)-24*bell(away,.55,.24);
      }
    }else if(role.startsWith('bank-')){
      const left=role.endsWith('left'),river=riverAt(family,z,curve),edge=river.center+(left?-1:1)*river.width/2;
      x=left?mix(40,edge,u):mix(edge,1040,u);
      const away=left?1-u:u;
      y=river.y-(35+55*z)*away-(35+20*z)*Math.sin(away*Math.PI*.86);
    }else if(role==='island'){
      const group=curve.count%4,centers=[.24,.76,.43,.82],widths=[220,310,455,235];
      const center=centers[group]+p.asymmetry*.055,width=widths[group]*(.80+.25*z);
      x=clamp(center*1080-width/2,45,1035-width)+width*u;
      y=430+distance*475-(70+z*85)*bell(u,.40+group*.045,.29)-36*bell(u,.72,.16);
    }else if(role==='water'){
      if(family==='river-valley'||family==='glacial-fjord'){
        const river=riverAt(family,z,curve);x=river.center+(u-.5)*river.width;y=river.y+5*Math.sin(u*Math.PI);
      }else if(family==='reed-wetland')y=350+distance*610+6*Math.sin(u*Math.PI);
      else if(family==='quiet-lake'){
        // Shorter foreground passages keep a measured beat intimate at phone
        // scale. The same five seconds of source still occupy each slot.
        const span=1-.42*smooth((z-.22)/.60);
        const width=curve.count===0?996:(660+330*noise(curve.count,29))*span,left=42+(996-width)*radical(curve.count+1);
        x=left+width*u;
        // Water's measured cross-sections occupy one continuous lake plane.
        // Linear depth spacing avoids the former unpainted middle shelf;
        // gentle terrain drift belongs to the deterministic artistic guide.
        y=curve.count===0?507:518+z*330+5*Math.sin(u*4.7+curve.count*1.63);
      }
      else if(family==='coastal-cliffs'){
        y=330+distance*630+p.horizon;const edge=40+600*Math.pow(clamp((y-440-p.horizon)/425,0,1),1/1.6);x=mix(Math.max(90,edge),1030,u);y+=8*Math.sin(u*Math.PI);
      }else if(family==='aurora-night')y=860+distance*120+5*Math.sin(u*Math.PI);
      else y=(family==='island-archipelago'?330:290)+distance*(family==='island-archipelago'?635:680)+12*Math.sin(u*Math.PI*1.6+phase)-(family==='open-ocean'?65:25)*z*bell(u,.24+p.asymmetry*.1,.18+.10*z);
    }
    if(role!=='sky'&&role!=='curtain'&&!['alpine-peaks','coastal-cliffs','river-valley','glacial-fjord','reed-wetland','waterfall-gorge'].includes(family))y+=p.horizon*(1-z)*.5;
    if(family==='coastal-cliffs'&&p.asymmetry<0)x=WORLD-x;
    return {x,y};
  }
  function curvePoint(curve,u,v){
    const base=guide(curve,u),before=guide(curve,u-.0001),after=guide(curve,u+.0001);
    const dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy)||1;
    const amplitude=curve.amplitude*(curve.role==='island'?.30+.70*(bell(u,.28,.18)+bell(u,.74,.16)):1)*(curve.endEnvelope?smooth(Math.min(u/.12,(1-u)/.12)):1);
    const bank=curve.family==='quiet-lake'&&curve.role==='shore';
    const left=curve.count%2===0,bankEnvelope=bank?.18+.82*smooth((left?1-u:u)/.58):1;
    // Upright pulse displacement lets a wooded bank descend without leaning
    // its measured peaks sideways. Only the artistic projection changes.
    let x=base.x+(bank?0:dy/length)*amplitude*(v-.5),y=base.y-(bank?bankEnvelope:dx/length)*amplitude*(v-.5);
    const fit=curve.fit||{scale:1,x:0,y:0};
    return {x:x*fit.scale+fit.x,y:y*fit.scale+fit.y};
  }
  function create(options = {}) {
    const bytes = new Uint32Array(1);
    if (options.seed == null) {
      if (global.crypto?.getRandomValues) global.crypto.getRandomValues(bytes);
      else bytes[0] = hash(`${Date.now()}-${Math.random()}`);
    }
    const seed = options.seed == null ? bytes[0] : Number.isFinite(options.seed) ? options.seed >>> 0 : hash(options.seed);
    const rng = random(seed);
    const chosen = FAMILIES[Math.floor(rng() * FAMILIES.length)].id;
    const family = FAMILIES.find(f => f.id === options.family || f.name === options.family)?.id || chosen;
    const scene = { version: VERSION, mapping: 'terrain-normal-v1', interpolation: 'bounded-monotone-hermite-v1', seed, family, strokes: [], slots: [], paintSeconds: 0, sourceIntervals: [], usableSeconds: 0,
      palette: [[40,85,222],[119,82,174],[26,137,143]],
      plan: { x: (rng() - .5) * 60, y: (rng() - .5) * 34, tilt: (rng() - .5) * .065, palettePhase: rng() * Math.PI * 2,
        horizon:(rng()-.5)*110,summit:.33+rng()*.36,bend:105+rng()*120,bendPhase:-1.35+rng()*.9,channelWidth:.86+rng()*.26,
        foregroundShift:(rng()-.5)*.65,phase:rng()*Math.PI*2,viewpoint:450+rng()*180,asymmetry:rng()*2-1 },
    };
    Object.defineProperty(scene, '_seen', { value: new Map(), configurable: true });
    Object.defineProperty(scene, '_counts', { value: {}, configurable: true });
    return scene;
  }
  function ensurePrivate(scene) {
    if (!scene._seen) {
      const seen = new Map();
      for (const stroke of scene.strokes) for (const p of stroke.points) seen.set(Math.round(p.t * 1e7), p);
      Object.defineProperty(scene, '_seen', { value: seen, configurable: true });
    }
    if (!scene._counts) {
      const counts = {};
      for (const slot of scene.slots) counts[slot.region] = (counts[slot.region] || 0) + 1;
      Object.defineProperty(scene, '_counts', { value: counts, configurable: true });
    }
  }
  function placeSlot(scene,index){
    const config=SCENES[scene.family],sky=config.roles.indexOf('sky'),cycle=config.cycle.filter(region=>region!==sky);
    const hasSky=['open-ocean','island-archipelago','sea-of-clouds'].includes(scene.family);
    const region=hasSky&&sky>=0&&index%23===22?sky:cycle[index%cycle.length],role=config.roles[region];
    const count=scene._counts[region]||0;scene._counts[region]=count+1;
    const reeds=role.startsWith('reeds-');
    const walls=role.startsWith('wall-'),longitudinal=role.startsWith('bank-');
    // Prefix-stable anchors establish distance and one foreground mass early.
    // Later source duration fills their intervals; sample fragmentation never
    // creates another scene element or moves the existing composition.
    const anchors=[.035,.88,.46,.23,.69];
    const clustered=role==='canopy'||role==='grass',row=role==='grass'?Math.floor(count/3):role==='curtain'?Math.floor(count/3):count;
    const roleAnchors=role==='canopy'?[.08,.44,.86,.26,.72]:role==='curtain'?[.5,.88,.12,.69,.32]:role==='cloud'?[.12,.76,.43,.28,.92]:role==='water'&&scene.family==='quiet-lake'?[0,.18,.32,.08,.64,.04,.53,.84,.73,.42,.94,.99,.25,.79]:anchors;
    const depth=roleAnchors[row]??radical(row+2);
    const night=scene.family==='aurora-night';
    const prominence=role==='shore'?.55:depth;
    const hero=role!=='sky'&&((role==='ridge'||role==='mesa'||role==='summit')&&count===0||depth>.80||role==='island'||role==='shore');
    let amplitude=role==='sky'?7:role==='water'?10+depth*48:role==='cascade'?8:role==='curtain'?5+depth*5:role==='cloud'?8+depth*12:19+depth*45;
    if(longitudinal)amplitude=18+depth*52;
    if(walls)amplitude=(scene.family==='waterfall-gorge'?30:26)+depth*(scene.family==='waterfall-gorge'?50:65);
    if(role==='grass')amplitude=80+depth*110;
    if(role==='canopy')amplitude=28+depth*46;
    if(reeds)amplitude=65+depth*110;
    if(role==='cliff')amplitude=10+depth*19;
    if(role==='island')amplitude=30+depth*45;
    if(role==='mesa'||role==='dune')amplitude=10+depth*20;
    if(role==='water'&&scene.family==='open-ocean')amplitude=14+depth*80;
    if(role==='water'&&['quiet-lake','glacial-fjord','river-valley'].includes(scene.family))amplitude=5+depth*15;
    if(role==='water'&&scene.family==='reed-wetland')amplitude=4+depth*12;
    if(role==='reflection')amplitude=4+depth*5;
    if(role==='shore')amplitude=scene.family==='quiet-lake'?count<2?77:48+depth*25:count===0?28:82+depth*22;
    if(role==='lake-ridge')amplitude=56;
    if(scene.family==='quiet-lake'&&role==='reflection')amplitude=-32;
    if(scene.family==='quiet-lake'&&role==='water')amplitude=1.6+depth*3.6;
    const curve={mapping:'terrain-normal-v1',projection:scene.family==='quiet-lake'&&role==='shore'?'upright-amplitude-v1':undefined,family:scene.family,role,count,depth,amplitude,endEnvelope:role==='shore',phase:scene.plan.palettePhase*.2,composition:scene.plan};
    // One shared projection preserves connections between ridge, bank and
    // water roles. The guide envelopes are designed inside this paper margin;
    // fitting each line independently would tear the terrain apart.
    curve.fit=scene.family==='quiet-lake'?{scale:1,x:0,y:0}:{scale:.86,x:75.6,y:75.6};
    const first=curvePoint(curve,0,.5),last=curvePoint(curve,1,.5),a=last.x-first.x,b=last.y-first.y,length=Math.hypot(a,b)||1;
    const frame={a,b,c:b/length*amplitude,d:-a/length*amplitude,e:first.x-b/length*amplitude/2,f:first.y+a/length*amplitude/2};
    const layer=role==='sky'||role==='summit'?0:role==='island'||role==='cloud'||role==='shelf'||role==='shore'?2:role==='curtain'||role==='cascade'?1:role==='water'&&scene.family==='island-archipelago'?0:role==='reflection'?1:depth<.34?0:depth<.68?1:2;
    let pigment=role==='water'||role==='grass'||role==='hill'||role.startsWith('reeds-')||role==='canopy'?2:role==='dune'||role==='cloud'||role==='sky'?1:0;
    if(role.includes('right')||role==='curtain'&&count%3===2)pigment=1;
    if(role==='curtain'&&count%3!==2)pigment=count%3===1?2:0;
    const foliage=(['meadow','rolling-hills','forest-canopy','reed-wetland','river-valley'].includes(scene.family)&&role!=='water'&&role!=='sky')||role==='island'||role==='reflection'||role==='shore'||role==='shelf';
    const land=!['sky','water','reflection','pool','curtain','cascade','cloud'].includes(role);
    const flow=role==='curtain'||role==='cliff'?'outward':role==='water'||role==='pool'||role==='reflection'?'water':role==='cascade'?'outward':'down';
    const reach=longitudinal?45+depth*55:role==='shore'?50:role==='curtain'?100+depth*25:role==='cliff'?56:role==='shelf'?35:role==='island'?75:role==='canopy'?80+depth*45:role==='grass'?42+depth*65:reeds?35+depth*45:land?42+depth*75:role==='water'||role==='pool'?16+depth*45:role==='cloud'?100:role==='cascade'?60:24;
    const alpha=role==='sky'?.075:role==='shore'?(count===0?.32:.57):role==='cascade'?.75:role==='island'?.75:role==='cloud'?.32+depth*.18:longitudinal?.30+prominence*.45:night?.45+prominence*.45:.22+prominence*.60;
    const core=role==='sky'?.12:role==='cloud'?.12:role==='curtain'?.10:role==='cascade'?.08:role==='shore'?(count===0?.20:.45):longitudinal?.25+depth*.30:hero?.62:.10+depth*.24;
    const baseY=role==='island'?(430+Math.pow(depth,1.55)*475+scene.plan.horizon*(1-depth)*.5)*curve.fit.scale+curve.fit.y:role==='shore'?(510+scene.plan.horizon*(1-depth)*.5)*curve.fit.scale+curve.fit.y:undefined;
    const slot={id:index,region,role,layer,frame,curve,material:{opacityGain:role==='island'?1.3:role==='cliff'?1.10:1,edgeGain:role==='island'||role==='shelf'?1.25:role==='cascade'?.35:role==='cloud'?.55:1,washGain:role==='canopy'?1.2:role==='cascade'?1.5:role==='cloud'?1.25:1,width:role==='sky'?1.4:2.2+prominence*3.7,wash:role==='sky'?12:role==='cloud'?50:26+prominence*28,alpha,core,color:pigment,hero,foliage,depth:prominence,volume:land?.55+.35*prominence:role==='curtain'?.70:.34+.28*depth,land,flow,reach,baseY,cluster:clustered,side:role==='curtain'?1:role==='cliff'?(scene.plan.asymmetry<0?-1:1):role.endsWith('left')?-1:1,perspective:role==='cascade'?'along':'constant',phase:scene.plan.palettePhase+depth*.4,grainSeed:hash(`${scene.seed}:${index}:pigment`)}};
    // The first few accepted paths load the paper with a complete, broad
    // underpainting. More accepted duration adds small marks and contours.
    // These are material supports of those same paths, never new pulse paths.
    const foundationLand=['ridge','hill','dune','mesa','canopy','grass'].includes(role)&&count<3;
    const foundationBank=(longitudinal||walls)&&count<2;
    const foundationWater=role==='water'&&count===0;
    const foundationCurtain=role==='curtain'&&count<3;
    const foundationCliff=role==='cliff'&&count<3;
    const foundationCloud=role==='cloud'&&count<2;
    const m=slot.material;
    // One porous pigment material unifies the scenes. Geometry, palette and
    // measured amplitude still belong to each scene's own terrain roles.
    m.painterly=true;
    m.underpaint=foundationLand||foundationBank||foundationWater||foundationCurtain||foundationCliff||foundationCloud;
    if(m.underpaint){
      m.edgeGain*=.65;
      m.core*=.65;
      m.alpha=foundationWater?.48:foundationCurtain?.62:foundationCloud?.30:count===0?.46:.55;
      m.washGain=foundationCloud?.80:foundationWater?1.05:foundationCurtain?.95:1.2;
      if(foundationLand||foundationBank||foundationWater){
        m.baseY=(role==='water'&&night?990:955)*curve.fit.scale+curve.fit.y;
        // A river plane follows the same channel projection as the source
        // cross-section, expanding with perspective instead of bridging banks.
        m.channelUnderpaint=foundationWater&&['river-valley','glacial-fjord'].includes(scene.family);
        if(m.channelUnderpaint){m.alpha=.78;m.washGain=1.15;}
        m.landUnderpaint=foundationBank;
      }
      if(foundationCurtain)m.reach=245;
      if(foundationCliff)m.reach=210;
      if(foundationCloud)m.reach=200;
    }
    if(role==='cliff'&&count===0){
      m.faceUnderpaint=true;m.flow='down';m.reach=210;m.alpha=.64;m.washGain=1.35;
      // Keep the coherent warm face above the initial open-water wash.
      slot.layer=1;
    }
    if(scene.family==='quiet-lake'){
      m.lake=true;
      if(role==='shore'){
        m.alpha=count<2?.75:count<6?.92:.98;m.core=count<2?.21:.25;
        m.lakeColor=count<2?2:Math.floor(count/2)%2===1?1:0;m.lakeFoundation=count<2;
        delete m.baseY;m.reach=count<2?44:23+depth*22;
        if(count<2||count%4===0||count%4===1){m.baseY=512+scene.plan.horizon*(1-depth)*.5;if(count<2)m.alpha=.64;}
        m.edgeGain=.95;m.width=2.8;m.washGain=1.30;
      }else if(role==='lake-ridge'){
        slot.layer=0;m.alpha=.45;m.core=.28;m.color=0;m.foliage=false;
        m.reach=42+depth*18;m.hero=true;m.width=2.8;m.edgeGain=1.25;
        delete m.baseY;
      }else if(role==='reflection'){
        slot.layer=1;m.alpha=.94;m.core=0;m.flow='lake-reflection';m.reach=80;m.edgeGain=0;m.washGain=1.5;
      }else if(role==='water'){
        slot.layer=count===0?0:1;m.alpha=count===0?.22:.38+depth*.10;
        m.core=.25;m.width=2.2+depth*2.0;m.reach=count===0?m.reach:105-52*smooth((depth-.68)/.32);m.edgeGain=1.05;m.washGain=1.12;
        if(count===0)m.baseY=900;
        if(count===1||count===2){m.lakeEarly=count;m.reach=count===1?70:76;m.alpha=count===1?.44:.46;}
        if(count===6){m.lakeBridge=true;m.reach=92;}
      }
    }
    return slot;
  }

  function placeFragment(slot, points, offset, sourceDomain) {
    const frame=slot.frame,start=points[0].t,end=points.at(-1).t;
    const {min,max}=sourceDomain;
    // A pen lift changes neither the scene slot nor its material cadence.
    // Only the fragment's accepted duration occupies the horizontal time axis;
    // its unchanged source amplitudes use the original accepted window's
    // frozen range, including tiny fragments at a duration-slot boundary.
    const a=frame.a/SLOT_SECONDS,b=frame.b/SLOT_SECONDS;
    const c=max>min?frame.c/(max-min):0,d=max>min?frame.d/(max-min):0;
    const centerT=start/2+end/2,centerV=min/2+max/2;
    const center=worldPoint({t:(offset+(end-start)/2)/SLOT_SECONDS,v:.5},frame);
    const transform={a,b,c,d,e:center.x-a*centerT-c*centerV,f:center.y-b*centerT-d*centerV,curve:slot.curve,domain:{start,offset,min,max}};
    return {slot:slot.id,slotStart:offset,slotEnd:offset+end-start,region:slot.region,role:slot.role,layer:slot.layer,material:slot.material,transform,bounds:getBounds(points,transform)};
  }

  function worldPoint(point,transform){
    if(transform.curve){const d=transform.domain;return curvePoint(transform.curve,(d.offset+point.t-d.start)/SLOT_SECONDS,normalized(point.v,d.min,d.max));}
    return {x:transform.a*point.t+transform.c*point.v+transform.e,y:transform.b*point.t+transform.d*point.v+transform.f};
  }
  const pathCache=new WeakMap();
  function sampleStroke(stroke,progress=1){
    let path=pathCache.get(stroke);
    if(!path){
      const source=stroke.points,n=source.length,slopes=[],domain=stroke.transform.domain;
      const units=source.map(p=>normalized(p.v,domain.min,domain.max));
      for(let i=0;i<n-1;i++)slopes.push((units[i+1]-units[i])/(source[i+1].t-source[i].t));
      const tangents=source.map((p,i)=>{if(i===0)return slopes[0]||0;if(i===n-1)return slopes[n-2]||0;const a=slopes[i-1],b=slopes[i];return Math.sign(a)!==Math.sign(b)||!a||!b?0:2/(1/a+1/b);});
      path=[];
      for(let i=0;i<n-1;i++){
        const a=source[i],b=source[i+1],dt=b.t-a.t;
        for(let j=0;j<3;j++){
          const u=j/3,u2=u*u,u3=u2*u;
          const unit=clamp((2*u3-3*u2+1)*units[i]+(u3-2*u2+u)*dt*tangents[i]+(-2*u3+3*u2)*units[i+1]+(u3-u2)*dt*tangents[i+1],Math.min(units[i],units[i+1]),Math.max(units[i],units[i+1]));
          const value=j===0?a.v:clamp(domain.min*(1-unit)+domain.max*unit,Math.min(a.v,b.v),Math.max(a.v,b.v));
          const point={t:mix(a.t,b.t,u),v:value};path.push({...worldPoint(point,stroke.transform),...point});
        }
      }
      const last=source.at(-1);if(last)path.push({...worldPoint(last,stroke.transform),...last});
      for(let i=0;i<path.length;i++){const before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy)||1;path[i].nx=-dy/length;path[i].ny=dx/length;}
      pathCache.set(stroke,path);
    }
    if(progress>=1)return path;
    const stop=stroke.sourceStart+(stroke.sourceEnd-stroke.sourceStart)*clamp(progress,0,1);
    return markPrefix(path,stop);
  }
  // Paint, live ink and the brush all end at the same source timestamp. The
  // frontier interpolates the existing bounded path, never an idealized beat.
  function strokeFrontier(stroke,progress=1){
    const nodes=pulseCore(stroke,strokePaint(stroke));
    const t=stroke.sourceStart+(stroke.sourceEnd-stroke.sourceStart)*clamp(progress,0,1);
    let low=0,high=nodes.length-1;
    while(low<high){const mid=(low+high)>>1;if(nodes[mid].t<t)low=mid+1;else high=mid;}
    const after=nodes[low],before=nodes[Math.max(0,low-1)];
    if(!after)return null;
    const u=after.t>before.t?clamp((t-before.t)/(after.t-before.t),0,1):0;
    const dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy);
    return {t,x:mix(before.x,after.x,u),y:mix(before.y,after.y,u),v:mix(before.v,after.v,u),
      tangent:{x:length?dx/length:after.ny,y:length?dy/length:-after.nx}};
  }
  function getBounds(points,transform) {
    const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
    for(const point of points){ const p=worldPoint(point,transform); bounds.minX=Math.min(bounds.minX,p.x);bounds.maxX=Math.max(bounds.maxX,p.x);bounds.minY=Math.min(bounds.minY,p.y);bounds.maxY=Math.max(bounds.maxY,p.y); }
    return bounds;
  }
  function unionIntervals(intervals) {
    const ordered=intervals.map(x=>({start:x.start,end:x.end})).sort((a,b)=>a.start-b.start), merged=[];
    for(const interval of ordered){ const last=merged.at(-1);if(last&&interval.start<=last.end+1e-8)last.end=Math.max(last.end,interval.end);else merged.push(interval); }
    return merged;
  }
  // Recording-only continuity is known at ingestion time, before cleaning
  // removes explicit barriers. Keep that proof outside the saved model: a
  // restored scene cannot infer a safe connection merely from close times.
  const continuityTails=new WeakMap(),continuityPredecessors=new WeakMap();
  function continuousPredecessor(stroke){return continuityPredecessors.get(stroke)||null;}
  function append(scene, segment) {
    if (!scene || scene.version!==VERSION) throw new Error('Unsupported landscape version.');
    if (!segment || segment.quality?.good===false || segment.good===false || segment.accepted===false){continuityTails.delete(scene);return [];}
    const incomingTail=continuityTails.get(scene)||null;
    continuityTails.delete(scene);
    ensurePrivate(scene);
    const sourceDomain={min:Infinity,max:-Infinity};
    for(const point of segment.points||[])if(Number.isFinite(point?.t)&&Number.isFinite(point?.v)){sourceDomain.min=Math.min(sourceDomain.min,point.v);sourceDomain.max=Math.max(sourceDomain.max,point.v);}
    // Invalid samples are explicit pen lifts, even when their neighboring
    // timestamps are closer than the gap threshold. Sort only within each
    // valid block; never erase the barrier while cleaning input.
    const source=[],blockEnds=[];let block=[];
    const flush=()=>{block.sort((a,b)=>a.t-b.t);blockEnds.push(block.at(-1)?.t);source.push(...block,null);block=[];};
    for(const point of segment.points||[]){
      if(point?.breakBefore)flush();
      if(Number.isFinite(point?.t)&&Number.isFinite(point?.v))block.push({t:point.t,v:point.v});else flush();
    }
    flush();
    const runs=[],runBlocks=new WeakMap();let run=[],previous=null,sourceBlock=0;const inputTimes=new Set();
    const saveRun=()=>{if(run.length){runBlocks.set(run,sourceBlock);runs.push(run);}};
    for(const point of source){
      if(!point){saveRun();run=[];previous=null;sourceBlock++;continue;}
      const inputKey=Math.round(point.t*1e7);if(inputTimes.has(inputKey))continue;inputTimes.add(inputKey);
      const key=Math.round(point.t*1e7), existing=scene._seen.get(key);
      if(existing){
        if(run.length) { saveRun();run=[]; }
        previous=existing;continue;
      }
      if(previous && point.t-previous.t>GAP){saveRun();run=[];}
      if(!run.length && previous && point.t>previous.t && point.t-previous.t<=GAP)run.push(previous);
      run.push(point);scene._seen.set(key,point);previous=point;
    }
    saveRun();
    const added=[];let previousStroke=null,previousBlock=-1;
    for(const points of runs){
      const blockIndex=runBlocks.get(points);
      let predecessor=previousBlock===blockIndex?previousStroke:blockIndex===0?incomingTail:null;
      previousBlock=blockIndex;previousStroke=null;
      if(points.length<2)continue; // A lone sample has no drawable measured interval.
      scene.sourceIntervals.push({start:points[0].t,end:points.at(-1).t});
      let first=0;
      while(first<points.length-1){
        const slotIndex=Math.floor((scene.paintSeconds+1e-8)/SLOT_SECONDS);
        const slot=scene.slots[slotIndex]||(scene.slots[slotIndex]=placeSlot(scene,slotIndex));
        const offset=Math.max(0,scene.paintSeconds-slotIndex*SLOT_SECONDS);
        let last=first+1;
        while(last+1<points.length && offset+points[last].t-points[first].t<SLOT_SECONDS-1e-8)last++;
        const chunk=points.slice(first,last+1), id=scene.strokes.length;
        const stroke={id,points:chunk,sourceStart:chunk[0].t,sourceEnd:chunk.at(-1).t,score:clamp(Number.isFinite(segment.score)?segment.score:.65,0,1),channel:segment.channel||'selected',...placeFragment(slot,chunk,offset,sourceDomain)};
        // Beat metadata follows the same retained fragment as its real samples.
        // An explicit empty list differs from legacy artwork with no beat data.
        if(Array.isArray(segment.beatTimes))stroke.beatTimes=[...new Set(segment.beatTimes.filter(t=>Number.isFinite(t)&&t>=stroke.sourceStart&&t<=stroke.sourceEnd&&(!predecessor||t>predecessor.sourceEnd)))].sort((a,b)=>a-b);
        const separation=predecessor?stroke.sourceStart-predecessor.sourceEnd:Infinity;
        if(predecessor===scene.strokes.at(-1)&&predecessor?.channel===stroke.channel&&separation>=0&&separation<=GAP)continuityPredecessors.set(stroke,predecessor);
        scene.strokes.push(stroke);added.push(stroke);
        predecessor=previousStroke=stroke;
        scene.paintSeconds+=stroke.sourceEnd-stroke.sourceStart;
        if(last===points.length-1)break;
        first=last;
      }
    }
    scene.sourceIntervals=unionIntervals(scene.sourceIntervals);
    scene.usableSeconds=scene.sourceIntervals.reduce((sum,range)=>sum+range.end-range.start,0);
    const tail=added.at(-1);
    if(tail&&previousBlock===blockEnds.length-1&&tail.sourceEnd===blockEnds.at(-1))continuityTails.set(scene,tail);
    return added;
  }
  const color=(rgb,alpha=1)=>`rgba(${rgb.map(v=>Math.round(v)).join(',')},${alpha})`;
  function pigment(scene,stroke,t,depth=1) {
    const night=scene.family==='aurora-night',m=stroke.material,role=stroke.role;
    const z=m.depth??stroke.transform.curve?.depth??.5;
    let palette=night?[[69,130,230],[153,115,224],[52,207,183]]:scene.palette;
    if(m.foliage)palette=[[29,102,68],[157,165,54],[30,128,101]];
    if(!night&&['water','pool','reflection','cascade'].includes(role))palette=[[18,99,179],[64,161,190],[15,137,151]];
    if(role==='dune')palette=[[194,108,31],[216,163,72],[181,129,54]];
    if(role==='mesa')palette=[[178,69,40],[139,88,156],[212,125,65]];
    if(role==='cliff')palette=[[185,137,80],[122,132,153],[222,178,113]];
    if(role==='shelf'||role==='island')palette=[[27,94,74],[121,145,61],[32,111,95]];
    if(role==='canopy')palette=[[24,90,64],[154,162,52],[29,119,96]];
    if(role.startsWith('wall-')&&scene.family==='waterfall-gorge')palette=[[27,88,111],[58,117,125],[36,104,87]];
    if(scene.family==='quiet-lake'&&role==='reflection')palette=[[9,89,100],[61,126,102],[20,112,130]];
    if(role==='lake-ridge')palette=[[24,119,229],[64,146,221],[123,181,218]];
    if(m.lake&&(role==='shore'||m.reflected))palette=[[3,65,77],[116,134,37],[32,119,104]];
    if(m.lake&&role==='water')palette=[[24,123,204],[27,143,181],[55,148,192]];
    if(m.reflected)palette=[[5,77,105],[10,99,124],[31,116,132]];
    if(role==='cloud')palette=[[185,201,225],[206,194,228],[177,209,224]];
    // A single trace mixes neighboring pigments continuously. Across a scene,
    // distance and role establish a restrained warm/cool value hierarchy.
    const blend=(m.lake&&role==='shore'?.08:.14)+(m.lakeFoundation?.43:m.lake&&role==='shore'?.23:.43)*(.5+.5*Math.sin(t*Math.PI*1.65+m.phase+stroke.slot*.14));
    let colorIndex=m.color;
    if(m.foliage)colorIndex=role==='shelf'||role==='island'||z>.74?0:Math.floor(z*7)%3;
    if(m.lake&&(role==='shore'||m.reflected))colorIndex=m.lakeColor;
    if(m.reflected)colorIndex=m.lakeColor===1?1:0;
    if(role==='dune')colorIndex=z>.6?0:1;
    if(role==='mesa')colorIndex=z>.7?0:z<.3?1:2;
    const primary=palette[colorIndex],secondary=palette[m.lakeFoundation?1:(colorIndex+1)%3];
    const air=night?0:role==='sky'?.40:role==='cloud'?.23:.13*Math.pow(1-z,1.4),paper=[251,248,240];
    return primary.map((v,i)=>mix(mix(v,secondary[i],blend)*depth,paper[i],m.lake&&role==='lake-ridge'?air+.45*bell(t,.49,.18):air));
  }
  function pathPoints(ctx,points) { ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); }

  const paintCache=new WeakMap(),pigmentAtlases=new WeakMap(),reflectionPasses=new WeakMap();
  const INK_LIMIT=8,INK_SIDE=256,INK_LENGTH=1080,INK_PIXEL_LIMIT=INK_LIMIT*INK_SIDE*INK_LENGTH;
  function pigmentAtlas(doc,porous=false){
    let atlas=pigmentAtlases.get(doc);if(atlas&&atlas.porous===porous)return atlas;
    const tile=atlas?.tile||doc.createElement('canvas');tile.width=tile.height=INK_SIDE;
    const ctx=tile.getContext('2d',{willReadFrequently:true}),pixels=ctx.createImageData(INK_SIDE,INK_SIDE),seed=38837;
    const grain=Uint8Array.from(global.atob(PIGMENT_GRAIN_BASE64),c=>c.charCodeAt(0));
    // The embedded pigment scan supplies paper tooth; a periodic field varies
    // wetness gently. Neither field contains scene or pulse geometry.
    const field=(x,y,cells,salt)=>{const a=x/INK_SIDE*cells,b=y/INK_SIDE*cells,ix=Math.floor(a),iy=Math.floor(b),u=smooth(a-ix),v=smooth(b-iy),n=(i,j)=>noise(seed,(i%cells)+(j%cells)*127+salt);
      return mix(mix(n(ix,iy),n(ix+1,iy),u),mix(n(ix,iy+1),n(ix+1,iy+1),u),v);};
    for(let y=0;y<INK_SIDE;y++)for(let x=0;x<INK_SIDE;x++){
      const natural=grain[x+y*INK_SIDE]/255, broad=field(x,y,8,31),medium=field(x,y,32,619);
      const body=smooth((broad*.63+medium*.37-.18)/.66);
      const concentration=porous?.58*field(x,y,5,31)+.28*field(x,y,13,619)+.14*field(x,y,37,977):0;
      const dry=porous?smooth((.86*concentration+.14*natural-.25)/.42):1;
      const alpha=porous?dry*(.62+.38*natural)*(.68+.32*smooth((concentration-.25)/.55)):(.17+natural*.78)*(.90+body*.10),at=(y*INK_SIDE+x)*4;
      pixels.data[at]=pixels.data[at+1]=pixels.data[at+2]=255;pixels.data[at+3]=Math.round(alpha*255);
    }
    ctx.putImageData(pixels,0,0);atlas={tile,porous,inks:atlas?.inks||new Map(),pixels:atlas?.pixels||0};pigmentAtlases.set(doc,atlas);return atlas;
  }
  function poolPattern(ctx,scene,stroke){
    const doc=ctx.canvas.ownerDocument||rasterDocument,m=stroke.material,atlas=pigmentAtlas(doc,!!m.painterly);
    const vertical=['curtain','cascade','cliff'].includes(stroke.role)&&!m.faceUnderpaint,curve=stroke.transform.curve;
    const first=curvePoint(curve,0,.5),last=curvePoint(curve,1,.5),axis=vertical?'y':'x';
    let from=Math.min(first[axis],last[axis]),to=Math.max(first[axis],last[axis]);
    // A source cross-section paints a perspective plane. Its pigment must
    // continue beyond the original distant width as the channel widens.
    if(m.channelUnderpaint||m.landUnderpaint){from=75.6;to=1004.4;}
    const colors=Array.from({length:17},(_,i)=>pigment(scene,stroke,i/16));
    const key=scene.family+':'+stroke.slot+':'+stroke.role+':'+(m.painterly?'porous':'normal')+':'+(m.reflected?'mirror':'body')+':'+m.grainSeed+':'+from.toFixed(2)+':'+to.toFixed(2)+':'+colors.map(c=>c.map(Math.round).join(',')).join(';');
    let ink=atlas.inks.get(key);
    if(ink){atlas.inks.delete(key);atlas.inks.set(key,ink);}else{
      const width=m.underpaint?INK_LENGTH:vertical?INK_SIDE:INK_LENGTH;
      const height=m.underpaint?INK_LENGTH:vertical?INK_LENGTH:INK_SIDE,pixels=width*height;
      // CanvasPattern owns an immutable snapshot on some browsers. Budget
      // both the source canvas and its one shared pattern, evicting before
      // allocating a broad underpaint tile. No per-context pattern copies.
      while(atlas.pixels+pixels>INK_PIXEL_LIMIT&&atlas.inks.size){
        const oldest=atlas.inks.keys().next().value,old=atlas.inks.get(oldest);
        atlas.pixels-=old.pixels;old.tile.width=old.tile.height=1;atlas.inks.delete(oldest);
      }
      const tile=doc.createElement('canvas');tile.width=width;tile.height=height;
      const tc=tile.getContext('2d',{willReadFrequently:true}),mask=tc.createPattern(atlas.tile,'repeat');
      const grainScale=m.painterly?(stroke.role==='water'?1.05:stroke.role==='reflection'?.90:stroke.role==='lake-ridge'?1.20:1.0+noise(m.grainSeed,93)*.50):1;
      mask.setTransform({a:grainScale,b:0,c:0,d:grainScale,e:noise(m.grainSeed,71)*INK_SIDE,f:noise(m.grainSeed,211)*INK_SIDE});
      tc.fillStyle=mask;tc.fillRect(0,0,tile.width,tile.height);
      tc.globalCompositeOperation='source-in';
      const gradient=tc.createLinearGradient(vertical?0:from,vertical?from:0,vertical?0:to,vertical?to:0);
      colors.forEach((rgb,i)=>{const u=i/16,fade=m.channelUnderpaint?1:m.lake?smooth(u/.008)*smooth((1-u)/.012):smooth(u/.12)*smooth((1-u)/.14);gradient.addColorStop(u,color(rgb,fade));});tc.fillStyle=gradient;tc.fillRect(0,0,tile.width,tile.height);
      if(m.lake&&stroke.role==='water'&&m.underpaint){
        // A luminous reserve opens the lake; the source-bound wash remains continuous.
        tc.globalCompositeOperation='destination-out';
        const reserve=tc.createRadialGradient(570,525,30,570,570,390);
        reserve.addColorStop(0,'rgba(0,0,0,.78)');reserve.addColorStop(.50,'rgba(0,0,0,.45)');reserve.addColorStop(1,'rgba(0,0,0,0)');
        tc.fillStyle=reserve;tc.fillRect(0,0,width,height);
      }
      if(m.lake&&['shore','lake-ridge'].includes(stroke.role)){
        tc.globalCompositeOperation='destination-out';
        for(let pocket=0;pocket<26;pocket++){
          const x=noise(m.grainSeed,pocket*7+201)*width,y=noise(m.grainSeed,pocket*7+203)*height;
          const radius=14+noise(m.grainSeed,pocket*7+207)*42;
          const reserve=tc.createRadialGradient(x,y,0,x,y,radius);
          reserve.addColorStop(0,'rgba(0,0,0,.52)');reserve.addColorStop(.6,'rgba(0,0,0,.30)');reserve.addColorStop(1,'rgba(0,0,0,0)');tc.fillStyle=reserve;tc.fillRect(x-radius,y-radius,radius*2,radius*2);
        }
      }
      if(m.underpaint){
        const samples=[0,.25,.5,.75,1].map(u=>curvePoint(curve,u,.5));
        tc.globalCompositeOperation='destination-in';
        if(!vertical){
          // Continuous absorption into paper, not another hard parallel strip.
          const floor=m.baseY??Math.min(1035,Math.max(...samples.map(p=>p.y))+(m.reach??160));
          const falloff=m.lake&&stroke.role==='water'?145:185;
          const mask=tc.createLinearGradient(0,floor-falloff,0,floor-4);
          mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(.45,'rgba(0,0,0,.82)');mask.addColorStop(.80,'rgba(0,0,0,.22)');mask.addColorStop(1,'rgba(0,0,0,0)');
          tc.fillStyle=mask;tc.fillRect(0,0,width,height);
        }else if(stroke.role==='curtain'){
          // A quiet luminous field follows the accepted curtain edge and
          // dissolves laterally; it never ends as a cut fabric panel.
          const left=Math.min(...samples.map(p=>p.x))-20,right=Math.max(...samples.map(p=>p.x))+(m.reach??125)*.9;
          const mask=tc.createLinearGradient(left,0,right,0);
          mask.addColorStop(0,'rgba(0,0,0,.12)');mask.addColorStop(.24,'rgba(0,0,0,.85)');mask.addColorStop(.60,'rgba(0,0,0,.55)');mask.addColorStop(1,'rgba(0,0,0,0)');
          tc.fillStyle=mask;tc.fillRect(0,0,width,height);
        }
      }
      ink={tile,pixels,pattern:ctx.createPattern(tile,'repeat')};
      atlas.pixels+=pixels;atlas.inks.set(key,ink);
    }
    return ink.pattern;
  }
  function materialField(seed,x,salt){const cell=Math.floor(x),u=smooth(x-cell);return mix(noise(seed,cell+salt),noise(seed,cell+salt+1),u);}
  function strokePaint(stroke){
    let paint=paintCache.get(stroke);if(paint)return paint;
    if(stroke._mirrorOf){
      // A reflected deposit is a material pass of this exact accepted path.
      // It adds no scene stroke, slot, source interval, sample or usable time.
      const original=strokePaint(stroke._mirrorOf),curve=original.curve;
      const horizon=512+curve.composition.horizon*(1-curve.depth)*.5;
      const points=original.points.map(p=>({...p,y:horizon+(horizon-p.y)*1.62,nx:-p.nx,ny:p.ny,dx:0,dy:(p.y-horizon)*1.62,bleed:p.bleed*.35,rag:p.rag*.25,under:{x:p.x,y:horizon}}));
      paint={points,flow:'lake-reflection',land:false,curve};paintCache.set(stroke,paint);return paint;
    }
    const source=sampleStroke(stroke),m=stroke.material,seed=m.grainSeed,curve=stroke.transform.curve;
    const flow=m.flow||'down',land=!!m.land,reach=Math.min(m.underpaint?360:125,m.reach??m.wash*1.6);
    const points=source.map(p=>{
      const u=clamp((stroke.slotStart+p.t-stroke.sourceStart)/SLOT_SECONDS,0,1);
      const perspective=m.perspective==='along'?.25+.75*smooth(u):1;
      const w=.78+.30*Math.sin(u*9+noise(seed,13)*6)+.16*Math.sin(u*27+noise(seed,33)*6)+.08*Math.sin(u*67+noise(seed,53)*6);
      let dx=0,dy=reach*w*perspective*(stroke.role==='curtain'?.40+.60*Math.pow(1-u,.6):1);
      if(flow==='lake-reflection'){dy=(510+curve.composition.horizon*(1-curve.depth)*.5)*curve.fit.scale+curve.fit.y-p.y;}
      else if(flow==='outward'){dx=(m.side||1)*dy;dy*=.08;}
      else if(flow==='curtain'){dx=p.nx*dy;dy=p.ny*dy;}
      else if(Number.isFinite(m.baseY)){const floor=m.baseY+(m.underpaint?22*Math.sin(u*5+m.phase)+12*Math.sin(u*17+m.phase*.3):0);dy=Math.max(3,floor-p.y);}
      if(flow!=='lake-reflection'&&!m.underpaint&&!Number.isFinite(m.baseY)){
        const guide=curvePoint(curve,u,.5);
        if(flow==='outward')dx+=(guide.x-p.x)*.72;
        else if(flow!=='curtain')dy=Math.max(2,guide.y+reach*w*perspective-p.y);
      }
      if(m.lake&&stroke.role==='lake-ridge')dy=Math.min(dy,Math.max(4,511-p.y));
      let bleed=0,rag=0,drift=0,pool=1;
      if(m.painterly){
        const macro=materialField(seed,u*13,701),meso=materialField(seed,u*41,1701),fine=materialField(seed,u*137,2701);
        const ends=smooth(u/.025)*smooth((1-u)/.025);
        bleed=(1.5+macro*6+meso*3+fine*1.7)*ends;
        rag=((macro-.5)*19+(meso-.5)*11+(fine-.5)*4)*ends;
        drift=(materialField(seed,u*27,3701)-.5)*7*ends;
        pool=smooth((materialField(seed,u*9,4701)-.28)/.48);
        if(stroke.role==='shore'){bleed*=.32;rag*=.48;}
        if(stroke.role==='water'&&!m.underpaint){bleed*=.40;rag*=.28;}
        if(stroke.role==='lake-ridge'){bleed*=.67;rag*=.75;}
        if(!m.lake){
          // Preserve delicate cloud/aurora edges and the narrow river corridor.
          // A material bleed never substitutes a new terrain or pulse path.
          const restraint=stroke.role==='sky'||stroke.role==='cloud'||stroke.role==='curtain'?.35:m.channelUnderpaint||m.landUnderpaint?.45:.65;
          bleed*=restraint;rag*=restraint;drift*=restraint;
        }
      }
      return {...p,u,perspective,dx,dy,bleed,rag,drift,pool,under:{x:p.x+dx,y:p.y+dy}};
    });
    paint={points,flow,land,curve};paintCache.set(stroke,paint);return paint;
  }
  function nibHull(nodes,roundStart=true,roundEnd=true){
    const path=new global.Path2D();if(nodes.length<2)return path;
    const first=nodes[0],last=nodes.at(-1);
    const top=p=>({x:p.x-p.nx*p.above,y:p.y-p.ny*p.above});
    const bottom=p=>({x:p.x+p.nx*p.below,y:p.y+p.ny*p.below});
    const a=top(first),b=top(last),c=bottom(last),d=bottom(first);
    path.moveTo(a.x,a.y);for(let i=1;i<nodes.length;i++){const p=top(nodes[i]);path.lineTo(p.x,p.y);}
    if(roundEnd){const radius=(last.above+last.below)*.64;path.bezierCurveTo(b.x+last.ny*radius,b.y-last.nx*radius,c.x+last.ny*radius,c.y-last.nx*radius,c.x,c.y);}else path.lineTo(c.x,c.y);
    for(let i=nodes.length-2;i>=0;i--){const p=bottom(nodes[i]);path.lineTo(p.x,p.y);}
    if(roundStart){const radius=(first.above+first.below)*.64;path.bezierCurveTo(d.x-first.ny*radius,d.y+first.nx*radius,a.x-first.ny*radius,a.y+first.nx*radius,a.x,a.y);}else path.lineTo(a.x,a.y);
    path.closePath();
    // Reverse-wound dry paper channels belong to each positive pigment body.
    // Other overlapping marks can naturally cover them; no composed paint is erased.
    let hole=[];
    const closeHole=()=>{if(hole.length>2){let q=hole.at(-1);path.moveTo(q.x+q.nx*q.voidTop,q.y+q.ny*q.voidTop);for(let i=hole.length-2;i>=0;i--){q=hole[i];path.lineTo(q.x+q.nx*q.voidTop,q.y+q.ny*q.voidTop);}for(q of hole)path.lineTo(q.x+q.nx*q.voidBottom,q.y+q.ny*q.voidBottom);path.closePath();}hole=[];};
    for(let i=0;i<nodes.length;i++){const q=nodes[i];if((q.voidBottom??0)-(q.voidTop??0)>.04){if(!hole.length&&i)hole.push(nodes[i-1]);hole.push(q);}else if(hole.length){hole.push(q);closeHole();}}
    closeHole();return path;
  }
  function pigmentIslands(stroke,paint){
    if(paint.islands)return paint.islands;
    const m=stroke.material,seed=m.grainSeed,z=m.depth??.5,source=paint.points,first=source[0],last=source.at(-1),reflection=!!m.reflected;
    const curve=paint.curve,a=curvePoint(curve,0,.5),b=curvePoint(curve,1,.5),span=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
    const horizon=512+curve.composition.horizon*(1-curve.depth)*.5,groups=Array.from({length:3},()=>[]);
    const at=u=>{
      let lo=0,hi=source.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(source[mid].u<=u)lo=mid;else hi=mid;}
      const p=source[lo],q=source[hi],v=q.u>p.u?clamp((u-p.u)/(q.u-p.u),0,1):0;
      return {x:mix(p.x,q.x,v),y:mix(p.y,q.y,v),t:mix(p.t,q.t,v),u,nx:mix(p.nx,q.nx,v),ny:mix(p.ny,q.ny,v)};
    };
    const emit=(nodes,group,roundStart,roundEnd,pool,salt=0)=>{
      if(nodes.length<2)return;
      // Paper tooth alters the positive pigment support itself. The measured
      // core is untouched; dry channels and edge losses stay inside its nib.
      const startU=nodes[0].u,endU=nodes.at(-1).u,runs=[];let run=[],dryEnd=null;
      const lift=v=>{const a=clamp(v,0,1);return Math.sqrt(a*(2-a));};
      for(const q of nodes){
        const x=q.u*span,wet=materialField(seed,x/9,12031+salt),tooth=materialField(seed,x/1.55,12731+salt);
        const dry=.72+.28*smooth((wet-.10)/.20),tip=Math.min(lift((q.u-startU)*span/(roundStart?10:5)),lift((endU-q.u)*span/(roundEnd?13:5)));
        const topLoss=q.above*.05+.10+.55*materialField(seed,x/2.8,13101+salt)+.30*tooth;
        const lowLoss=q.below*.05+.10+.55*materialField(seed,x/2.1,14101+salt)+.30*(1-tooth);
        const above=Math.max(0,q.above-topLoss)*dry*tip,below=Math.max(0,q.below-lowLoss)*dry*tip;
        if(above+below<.22){const zero={...q,above:0,below:0,voidTop:0,voidBottom:0};if(run.length>1){run.push(zero);runs.push(run);}run=[];dryEnd=zero;continue;}
        if(!run.length&&dryEnd){run.push(dryEnd);dryEnd=null;}
        const paper=smooth((.21-materialField(seed,x/8,17101+salt))/.16),center=(below-above)*.30+Math.min(above,below)*(materialField(seed,x/13,18101+salt)-.5)*.72,voidRadius=Math.min(1.25,Math.min(above,below)*.22)*paper*(.40+.60*materialField(seed,x/.95,19101+salt));
        run.push({...q,above,below,voidTop:center-voidRadius,voidBottom:center+voidRadius});
      }
      if(run.length>1)runs.push(run);
      for(const body of runs){
        // Dry lifts end with tiny uneven deposits rather than a vector cap.
        // Each detached body keeps its original source-time range.
        const path=nibHull(body,false,false),edgePath=new global.Path2D(),edgeNodes=[];
        let active=false;
        for(let j=1;j<body.length-1;j++){
          const q=body[j],x=q.u*span,wet=materialField(seed,x/14,15101+salt);
          const present=wet>(reflection?.64:.54)&&pool>.28;
          if(!present){active=false;continue;}
          const lower=materialField(seed,x/32,16101+salt)>.66;
          const radius=lower?q.below:-q.above;
          const node={x:q.x+q.nx*radius*.93,y:q.y+q.ny*radius*.93,t:q.t,move:!active};
          edgeNodes.push(node);active?edgePath.lineTo(node.x,node.y):edgePath.moveTo(node.x,node.y);active=true;
        }
        groups[group].push({nodes:body,path,edgePath,edgeNodes,pooled:edgeNodes.length>1,roundStart:false,roundEnd:false,start:body[0].t,end:body.at(-1).t});
      }
    };
    // The same accepted cross-section wets an irregular depth footprint.
    // Interleaved pigment patches occupy that field, not parallel copies of
    // accepted traces. Their phases/coverage are fixed in slot coordinates.
    const lanes=reflection?1:3;
    for(let lane=0;lane<lanes;lane++){
      const accent=!reflection&&lane===lanes-1;
      let u=-noise(seed,1021+lane*211)*.11,window=0;
      while(u<1){
        const salt=5101+window*37+lane*2309;
        const extent=(reflection?68+noise(seed,salt)*102:accent?48+noise(seed,salt)*110:125+noise(seed,salt)*220)/span;
        const end=u+extent,lo=Math.max(u,first.u),hi=Math.min(end,last.u);
        if(hi-lo>.001&&noise(seed,salt+3)>(reflection?.07:accent?.58:.09)){
          const middle=at(clamp((u+end)/2,first.u,last.u)),available=Math.max(0,middle.y-horizon);
          const tiers=reflection?clamp(Math.ceil(available/19),2,11):1;
          const weights=Array.from({length:tiers},(_,j)=>.56+noise(seed,salt+j*131+107)*1.04),weightTotal=weights.reduce((a,b)=>a+b,0);let tierStart=0;
          for(let tier=0;tier<tiers;tier++){
            const salt2=salt+tier*701,pitch=available*weights[tier]/weightTotal,level=(tierStart+weights[tier]*.5)/weightTotal;tierStart+=weights[tier];
            if(reflection&&noise(seed,salt2+5)<(tier<2?.03:.12))continue;
            const shared=reflection?noise(seed,salt+Math.floor(tier/3)*107+9):0;
            const inset=reflection?extent*(level*.11+shared*.03):0;
            const drift=reflection?extent*(noise(seed,salt+Math.floor(tier/2)*149+43)-.5)*.68:0;
            let left=u+inset+drift,right=end-inset*.60+drift;
            // The first two real water traces form complementary passages.
            // Their primary wash still follows the whole accepted source;
            // only the secondary pigment footprint is grouped asymmetrically.
            if(m.lakeEarly&&lane===1){left=Math.max(left,m.lakeEarly===1?.015:.42);right=Math.min(right,m.lakeEarly===1?.64:.985);}
            const start=Math.max(left,first.u),finish=Math.min(right,last.u);if(finish-start<.001)continue;
            const nodes=[],num=Math.max(4,Math.ceil((finish-start)*span/1.25));
            for(let i=0;i<=num;i++){
              const q=at(mix(start,finish,i/num)),local=clamp((q.u-left)/(right-left),0,1);
              const broad=materialField(seed,q.u*17,6101+lane*229),upper=materialField(seed,q.u*47,7101+lane*313+tier*53),lower=materialField(seed,q.u*61,8101+lane*331+tier*71);
              const ends=reflection?Math.min(1,.36+Math.min(local,1-local)*5.0):1;
              if(reflection){
                const depth=Math.max(0,q.y-horizon),radius=pitch*(.48+.16*noise(seed,salt2+19))*(.83+.22*upper);
                const cy=horizon+level*(available*.96+depth*.04)+(upper-.5)*.7;
                if(cy-radius<horizon+1||cy+radius*1.22>q.y-1){emit(nodes.splice(0),level<.22?2:level>.75?0:Math.floor(noise(seed,salt+Math.floor(tier/2)*173)*3),true,true,noise(seed,salt2+31),salt2);continue;}
                nodes.push({...q,x:q.x,y:cy,nx:0,ny:1,above:radius*ends,below:radius*(.77+.38*lower)*ends});
              }else{
                q.nx=0;q.ny=1;
                const wet=materialField(seed,q.u*8,9201+lane*431),branch=materialField(seed,q.u*29,10301+lane*433);
                const offset=(accent?-.035:lane*(m.lakeEarly?.40:.48)-.10)*(m.reach??90);
                const neck=.58+.42*smooth((broad-.12)/.65);
                const radius=(accent?.75+z*.65:(10.5+z*7.5)*(m.lakeBridge?1.4:1))*(.80+.34*noise(seed,salt+19))*neck*ends;
                nodes.push({...q,x:q.x,y:q.y+offset,above:Math.max(.20,radius*(.62+.70*upper)),below:Math.max(.20,radius*(.57+.78*lower))});
              }
            }
            const focused=m.lakeEarly&&!accent&&Math.abs((start+finish)/2-(m.lakeEarly===1?.31:.70))<.18;
            emit(nodes,reflection?(level<.22?2:level>.75?0:Math.floor(noise(seed,salt+Math.floor(tier/2)*173)*3)):accent?0:focused?2:Math.floor(noise(seed,salt2+29)*3),start<=left+1e-7,finish>=right-1e-7,noise(seed,salt2+31),salt2);
          }
        }
        u=end+(reflection?(-extent*span*.26)+noise(seed,salt+41)*6:4+noise(seed,salt+41)*19)/span;window++;
      }
    }
    const chunks=[];
    groups.forEach((marks,group)=>{
      marks.sort((a,b)=>a.end-b.end);
      for(let offset=0;offset<marks.length;offset+=8){
        const items=marks.slice(offset,offset+8),path=new global.Path2D(),edge=new global.Path2D();
        for(const mark of items){path.addPath(mark.path);if(mark.pooled)edge.addPath(mark.edgePath);}
        chunks.push({group,items,path,edge,start:Math.min(...items.map(m=>m.start)),end:Math.max(...items.map(m=>m.end))});
      }
    });
    paint.islands=chunks;return chunks;
  }
  function drawPigmentIslands(ctx,stroke,paint,wash,alpha,stop){
    const z=stroke.material.depth??.5;
    ctx.fillStyle=ctx.strokeStyle=wash;ctx.lineCap='round';ctx.lineJoin='round';
    const draw=(path,edge,group)=>{
      ctx.globalAlpha=clamp(alpha*[.64,.96,1.20][group],0,1);ctx.fill(path);
      if(!stroke.material.reflected){ctx.globalAlpha=alpha*.085;ctx.lineWidth=2.6;ctx.stroke(path);}
      ctx.globalAlpha=alpha*.43;ctx.lineWidth=.65+z*.30;ctx.stroke(edge);
    };
    for(const chunk of pigmentIslands(stroke,paint)){
      if(stop>=chunk.end){draw(chunk.path,chunk.edge,chunk.group);continue;}
      if(stop<=chunk.start)continue;
      const visible=new global.Path2D(),visibleEdge=new global.Path2D();
      const prefix=(nodes,time)=>{
        const out=[];
        for(let i=0;i<nodes.length;i++){
          const q=nodes[i];if(q.t<=time){out.push(q);continue;}
          if(i&&nodes[i-1].t<time){const p=nodes[i-1],v=(time-p.t)/(q.t-p.t),tip={};for(const key of Object.keys(p))tip[key]=typeof p[key]==='number'?mix(p[key],q[key],v):p[key];tip.t=time;out.push(tip);}
          break;
        }
        return out;
      };
      for(const mark of chunk.items){
        if(stop>=mark.end){visible.addPath(mark.path);visibleEdge.addPath(mark.edgePath);continue;}
        if(stop<=mark.start)continue;
        const nodes=prefix(mark.nodes,stop);if(nodes.length>1)visible.addPath(nibHull(nodes,mark.roundStart,false));
        const edge=prefix(mark.edgeNodes,stop);if(edge.length>1){visibleEdge.moveTo(edge[0].x,edge[0].y);for(let i=1;i<edge.length;i++)edge[i].move?visibleEdge.moveTo(edge[i].x,edge[i].y):visibleEdge.lineTo(edge[i].x,edge[i].y);}
      }
      // Completed and partial windows share one coverage pass. Switching to
      // the cached complete chunk must not remove accumulated overlap alpha.
      draw(visible,visibleEdge,chunk.group);
    }
  }
  function pulseCore(stroke,paint){
    if(paint.pulseCore)return paint.pulseCore;
    if(stroke._mirrorOf)return paint.pulseCore=paint.points;
    const curve=stroke.transform.curve,water=stroke.material.lake&&stroke.role==='water',strong=water&&[4,7,11].includes(curve.count);
    // The wash stays a calm plane; this pigment edge gives the same measured
    // samples a readable artistic amplitude. The source/domain never change.
    const projected=water?{...stroke,transform:{...stroke.transform,curve:{...curve,amplitude:strong?19+curve.depth*14:curve.count<3?22:14+curve.depth*13}}}:stroke;
    const nodes=sampleStroke(projected).map(q=>{const u=clamp((stroke.slotStart+q.t-stroke.sourceStart)/SLOT_SECONDS,0,1),edge=water?7+curve.depth*10:0;return {...q,u,nx:water?0:q.nx,ny:water?1:q.ny,above:water?.65:0,below:edge*(.62+.38*materialField(stroke.material.grainSeed,u*37,20501))};});
    paint.pulseCore=nodes;paint.coreStrong=strong;return nodes;
  }
  function revealKnots(stroke){
    const nodes=pulseCore(stroke,strokePaint(stroke));
    // Match the reconstruction's measured-knot selection exactly. The worker
    // already warmed this paint; transfer only its canonical coordinates/data.
    return nodes.filter((_,i)=>i%3===0||i===nodes.length-1).map(({x,y,t,v})=>({x,y,t,v}));
  }
  function pulseImpressions(stroke,paint){
    if(paint.pulseImpressions)return paint.pulseImpressions;
    const curve=paint.curve,z=curve.depth,seed=stroke.material.grainSeed,core=pulseCore(stroke,paint);
    const lakeWater=stroke.material.lake&&stroke.role==='water';
    const originalTimes=new Set(stroke.points.map(q=>q.t));
    // Every original measured knot owns one pressure impression. Hermite
    // interpolation remains available in pulseCore, but no fabricated knot
    // or repeated accepted wave is needed to populate this pigment field.
    const source=core.filter(q=>originalTimes.has(q.t)),first=source[0],last=source.at(-1),items=[];
    const dab=(q,rx,ry,dy,salt)=>{
      const path=new global.Path2D(),rim=[];
      // Small rounded ragged tips replace long upper/lower ribbon polygons.
      // All impressions wind in the same direction and have no cutout holes.
      for(let j=0;j<10;j++){
        const angle=j*Math.PI*2/10,r=.74+.26*noise(seed,salt+j*113);
        rim.push({x:q.x+Math.cos(angle)*rx*r,y:q.y+dy+Math.sin(angle)*ry*r});
      }
      const a=rim.at(-1),b=rim[0];path.moveTo((a.x+b.x)/2,(a.y+b.y)/2);
      for(let j=0;j<rim.length;j++){const a=rim[j],b=rim[(j+1)%rim.length];path.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);}
      path.closePath();return path;
    };
    for(const q of source){
      const unit=normalized(q.v,stroke.transform.domain.min,stroke.transform.domain.max),key=Math.round(q.t*1e7);
      const wet=materialField(seed,q.x/31,41301),tooth=materialField(seed,q.x/8,41901);
      // Mirrored coastal strokes travel right to left. Taper only their ends,
      // rather than reducing pressure throughout the whole measured path.
      const direction=last.x>=first.x?1:-1;
      const ends=.35+.65*Math.min(smooth((q.x-first.x)*direction/18),smooth((last.x-q.x)*direction/23));
      const pressure=(.69+.31*unit)*(.67+.33*wet)*ends;
      // Keep the wet footprint below the pulse excursion so the measured
      // upstroke and decay remain legible rather than merging into a cord.
      const rx=(8+z*8+tooth*4)*(.63+.37*pressure)*(lakeWater?.46:1),ry=(6+z*6+unit*2)*pressure*(lakeWater?.38:1);
      const dy=ry*.62,halo=dab(q,rx*(lakeWater?1.16+tooth*.10:1.28+tooth*.16),ry*(lakeWater?1.23+wet*.12:1.45+wet*.22)+(lakeWater?.35:1.2)*ends,dy+ry*.20,key+42101);
      const body=dab(q,rx,ry,dy,key+42901),pool=new global.Path2D();
      // Local concentration is another small impression inside the wet tip,
      // selected by the real normalized sample value and material pressure.
      if(unit*(.5+wet*.5)>.27)pool.addPath(dab(q,rx*(.36+tooth*.19),ry*(.34+wet*.22),dy-ry*.13,key+43701));
      items.push({...q,pressure,paths:[halo,body,pool]});
    }
    const chunks=[];
    for(let offset=0;offset<items.length;offset+=64){
      const group=items.slice(offset,offset+64),paths=Array.from({length:3},()=>new global.Path2D());
      for(const item of group)for(let pass=0;pass<3;pass++)paths[pass].addPath(item.paths[pass]);
      chunks.push({items:group,paths,start:group[0].t,end:group.at(-1).t});
    }
    paint.pulseImpressions=chunks;return chunks;
  }
  function markPrefix(nodes,stop){
    const prefix=[];
    for(let i=0;i<nodes.length;i++){
      const q=nodes[i];if(q.t<=stop){prefix.push(q);continue;}
      if(i&&nodes[i-1].t<stop){const p=nodes[i-1],v=(stop-p.t)/(q.t-p.t),tip={};for(const key of Object.keys(p))tip[key]=typeof p[key]==='number'?mix(p[key],q[key],v):p[key];tip.t=stop;prefix.push(tip);}break;
    }
    return prefix;
  }
  function drawPulseImpressions(ctx,scene,stroke,paint,alpha,stop){
    if(stop<=stroke.sourceStart)return;
    const wash=poolPattern(ctx,scene,stroke),z=paint.curve.depth,density=(.71+stroke.score*.29)*(.74+z*.26);
    ctx.save();ctx.fillStyle=wash;
    for(const chunk of pulseImpressions(stroke,paint)){
      if(stop<chunk.start)break;
      const complete=stop>=chunk.end;
      const paths=complete?chunk.paths:Array.from({length:3},()=>new global.Path2D());
      if(!complete){
        for(const item of chunk.items){if(item.t>stop)break;for(let pass=0;pass<3;pass++)paths[pass].addPath(item.paths[pass]);}
      }
      // Full and active chunks use the exact same positive-winding unions,
      // alpha and pass order. Completing a chunk cannot erase an earlier dab.
      ctx.globalAlpha=alpha*density*.36;ctx.save();ctx.clip(paths[0]);ctx.fillRect(0,0,WORLD,WORLD);ctx.restore();
      ctx.globalAlpha=density*(.45+z*.09);ctx.save();ctx.clip(paths[1]);ctx.fillRect(0,0,WORLD,WORLD);ctx.restore();
      ctx.globalAlpha=density*(.20+z*.13);ctx.save();ctx.clip(paths[2]);ctx.fillRect(0,0,WORLD,WORLD);ctx.restore();
      if(!complete)break;
    }
    ctx.restore();
  }
  function drawPulseCore(ctx,scene,stroke,paint,alpha,stop){
    // A mirrored shoreline is a secondary pigment deposit, not another source
    // waveform. Keep its original soft reflection instead of a second outline.
    if(stroke._mirrorOf||stroke.material.reflected)return;
    const source=pulseCore(stroke,paint),nodes=markPrefix(source,stop);
    if(nodes.length<2)return;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    const curve=paint.curve,m=stroke.material,night=scene.family==='aurora-night';
    const delicate=['sky','cloud','reflection','curtain'].includes(stroke.role),reflected=!!m.reflected;
    const first=source[0],last=source.at(-1),gradient=ctx.createLinearGradient(first.x,first.y,last.x,last.y);
    for(let i=0;i<=12;i++){
      const u=i/12,base=pigment(scene,stroke,u,night?1.1:delicate?.82:.69);
      gradient.addColorStop(u,color(base,.70+.30*smooth(Math.min(u/.025,(1-u)/.025))));
    }
    // Keep the measured edge continuous after the wet pigment settles. Broad
    // washes retain their existing depth; a restrained fine core remains above
    // them even for foundation, sky and reflected roles.
    ctx.globalCompositeOperation='source-over';pathPoints(ctx,nodes);ctx.strokeStyle=gradient;
    ctx.globalAlpha=reflected?.28:delicate?clamp(.25+alpha*.28,.27,.46):clamp(.48+alpha*.24,.50,.74);
    ctx.lineWidth=delicate?1.65:1.95+curve.depth*.35;ctx.stroke();ctx.restore();
  }
  function drawStroke(ctx,scene,stroke,progress=1){
    if(progress<=0)return;
    const paint=strokePaint(stroke),stop=stroke.sourceStart+(stroke.sourceEnd-stroke.sourceStart)*clamp(progress,0,1);
    const points=progress>=1?paint.points:markPrefix(paint.points,stop),m=stroke.material,night=scene.family==='aurora-night';
    if(!points.length)return;
    const depth=m.depth??.5,alpha=clamp(m.alpha*(m.opacityGain??1)*(.84+stroke.score*.16),0,1);
    const delicate=['sky','cloud','reflection','curtain'].includes(stroke.role),wet=['water','pool','cascade'].includes(stroke.role);
    const confine=(x,y)=>{
      const curve=paint.curve,role=stroke.role,family=curve?.family;
      const inside=(role==='water'&&['river-valley','glacial-fjord'].includes(family))||(role==='cascade'&&family==='waterfall-gorge');
      const outside=(['wall-left','wall-right'].includes(role)&&['waterfall-gorge','glacial-fjord'].includes(family))||(['bank-left','bank-right'].includes(role)&&family==='river-valley');
      if(!inside&&!outside)return {x,y};
      const fit=curve.fit||{scale:1,x:0,y:0},at=(y-fit.y)/fit.scale;let low=0,high=1.04;
      for(let i=0;i<12;i++){const middle=(low+high)/2;if(riverAt(family,middle,curve).y<at)low=middle;else high=middle;}
      const river=riverAt(family,(low+high)/2,curve),left=(river.center-river.width/2)*fit.scale+fit.x,right=(river.center+river.width/2)*fit.scale+fit.x;
      return {x:inside?clamp(x,left,right):role.endsWith('left')?Math.min(x,left):Math.max(x,right),y};
    };
    const support=(amount,absorption=0)=>{
      ctx.beginPath();points.forEach((p,i)=>{
        const edge=m.painterly?p.bleed*absorption:.8,x=p.x-p.nx*edge,y=p.y-p.ny*edge;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      });
      if(m.channelUnderpaint||m.landUnderpaint){
        const curve=paint.curve,fit=curve.fit,start=curve.depth,finish=mix(start,1,amount),leftU=points[0].u,rightU=points.at(-1).u;
        const at=(z,u)=>{
          const river=riverAt(curve.family,z,curve),left=stroke.role.endsWith('left'),edge=river.center+(left?-1:1)*river.width/2;
          const x=m.landUnderpaint?(left?mix(40,edge,u):mix(edge,1040,u)):river.center+(u-.5)*river.width;
          return {x:x*fit.scale+fit.x,y:river.y*fit.scale+fit.y};
        };
        for(let i=1;i<=16;i++){const q=at(mix(start,finish,i/16),rightU);ctx.lineTo(q.x,q.y);}
        let q=at(finish,leftU);ctx.lineTo(q.x,q.y);
        for(let i=15;i>=0;i--){q=at(mix(start,finish,i/16),leftU);ctx.lineTo(q.x,q.y);}
      }else{
        for(let i=points.length-1;i>=0;i--){const p=points[i];const q=confine(p.x+p.dx*amount+(m.painterly?p.drift*amount:0),p.y+p.dy*amount+(m.painterly?p.rag*amount:0));ctx.lineTo(q.x,q.y);}
      }
      ctx.closePath();
    };
    ctx.save();
    if(m.landUnderpaint){
      // Clip to the shared terrain projection before laying a broad mass.
      // Its edge cannot cover the curved water corridor between source banks.
      const curve=paint.curve,fit=curve.fit,side=stroke.role.endsWith('left')?-1:1;
      ctx.beginPath();ctx.moveTo(side<0?0:WORLD,0);ctx.lineTo(side<0?0:WORLD,WORLD);
      for(let i=32;i>=0;i--){const river=riverAt(curve.family,i/32,curve);ctx.lineTo((river.center+side*river.width/2)*fit.scale+fit.x,river.y*fit.scale+fit.y);}
      ctx.lineTo(side<0?0:WORLD,0);ctx.closePath();ctx.clip();
    }
    ctx.globalCompositeOperation=night?'screen':stroke.role==='cloud'||m.lake&&stroke.role==='shore'?'source-over':'multiply';
    const wash=poolPattern(ctx,scene,stroke);
    if((m.painterly&&['water','pool'].includes(stroke.role)&&!m.underpaint)||m.reflected){
      if(m.reflected){support(1,0);ctx.clip();drawPigmentIslands(ctx,stroke,paint,wash,alpha,stop);}
      else {
        drawPulseImpressions(ctx,scene,stroke,paint,alpha,stop);
      }
      drawPulseCore(ctx,scene,stroke,paint,alpha,stop);
      ctx.restore();return;
    }
    // Uneven, overlapping deposits form one wash. Most pigment pools
    // close to its measured edge; long soft bleeds and dry pockets vary by slot.
    const wetness=noise(m.grainSeed,801),body=m.underpaint?1.5:m.painterly?(delicate?1.25:wet?1.45:1.70):night&&stroke.role==='curtain'?2.25:delicate?.85:wet?.95:1.25;
    const deposits=m.painterly?[[1.13,.18,1.3],[1,.40,.55],[.69,.35,.10]]:m.underpaint?[[1,.36],[.90,.29],[.72,.23]]:[[1,.17],[.82,.28],[.46+.18*wetness,.45]];
    for(const [extent,opacity,absorption] of deposits){
      ctx.save();support(extent,absorption||0);ctx.clip();ctx.globalAlpha=alpha*opacity*body*(m.washGain??1);ctx.fillStyle=wash;ctx.fillRect(0,0,WORLD,WORLD);ctx.restore();
    }
    // Local pooling has the real waveform as its boundary. It is strongest in
    // selected foreground marks, rather than the same dark outline everywhere.
    ctx.save();support(1,.32);ctx.clip();pathPoints(ctx,points);ctx.strokeStyle=wash;
    ctx.globalAlpha=m.lake&&stroke.role==='reflection'?0:alpha*(delicate?.18:m.hero?.45:.20)*(m.washGain??1);ctx.lineWidth=delicate?7:9+depth*10;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.restore();
    ctx.lineJoin='round';ctx.lineCap='round';
    const chunk=12,edge=(stroke.role==='cloud'?.48:delicate?.28:wet?.53:.65)+m.core*.48;
    const edgeCoverage=m.hero?.84:wet?.59:.25;
    for(let first=0;first<points.length-1;first+=chunk){
      const end=Math.min(points.length,first+chunk+1),part=points.slice(first,end),u=part[0].u;
      const grain=.45+.55*noise(m.grainSeed,Math.floor(u*180)+313);
      const lostEdge=m.painterly?(.02+.98*part[0].pool):.15+.85*smooth((Math.sin(u*12+m.phase+noise(m.grainSeed,67)*6)+.45)/1.3);
      const pressure=.62+.38*(.5+.5*Math.sin(u*19+m.phase)),ends=smooth(u/.10)*smooth((1-u)/.12);
      pathPoints(ctx,part);ctx.strokeStyle=color(pigment(scene,stroke,u,night?1:.86),clamp(alpha*edge*grain*ends*edgeCoverage*lostEdge*(m.edgeGain??1),0,1));
      ctx.lineWidth=Math.max(.55,m.width*(delicate?.35:.75+.30*depth)*pressure);ctx.stroke();
    }
    drawPulseCore(ctx,scene,stroke,paint,alpha,stop);
    ctx.restore();
    if(m.lake&&stroke.role==='shore'&&!m.reflected){
      let reflected=reflectionPasses.get(stroke);
      if(!reflected){
        reflected={...stroke,_mirrorOf:stroke,role:'reflection',material:{...m,reflected:true,lakeFoundation:false,underpaint:false,baseY:undefined,land:false,hero:false,alpha:m.lakeFoundation?.53:m.lakeColor===0?.68:.54,core:0,width:1.4,edgeGain:0,washGain:1.26,flow:'lake-reflection'}};
        reflectionPasses.set(stroke,reflected);
      }
      drawStroke(ctx,scene,reflected,progress);
    }
  }
  function paper(ctx,scene) {
    const night=scene.family==='aurora-night'&&scene.strokes.length;
    ctx.fillStyle=night?'#192a43':'#fbf8f0';ctx.fillRect(0,0,WORLD,WORLD);
    // Only material texture exists before any accepted data arrives.
    const grain=random(hash(`${scene.seed}:paper`));
    for(let i=0;i<6500;i++){
      const x=grain()*WORLD,y=grain()*WORLD;
      ctx.fillStyle=night?(i%2?'rgba(8,14,28,.12)':'rgba(196,207,221,.07)'):i%2?'rgba(115,100,79,.035)':'rgba(255,255,255,.45)';ctx.fillRect(x,y,.5+grain()*1.2,.5+grain());
    }
    if(night){
      const g=ctx.createRadialGradient(540,450,80,540,530,620);
      g.addColorStop(0,'rgba(67,88,129,.18)');g.addColorStop(.75,'rgba(39,53,81,.08)');g.addColorStop(1,'rgba(8,16,31,.2)');
      ctx.fillStyle=g;ctx.fillRect(0,0,WORLD,WORLD);
    }
  }
  function publishLayer(output,layer){
    // Consuming a layer between writes fixes the rasterization cadence. The
    // existing output is repainted before a frame/export becomes visible.
    output.save();output.setTransform(1,0,0,1,0,0);output.globalAlpha=1;
    output.globalCompositeOperation='source-over';output.drawImage(layer,0,0);output.restore();
  }
  function rasterCanvas(width,height,doc=global.document){
    // Use the same 2D layer implementation for worker, preview and export.
    // Mixing DOM and Offscreen layers changes antialiased pigment edges in
    // some engines even when every draw command is otherwise identical.
    if(global.OffscreenCanvas){
      try{const item=new global.OffscreenCanvas(width,height);if(item.getContext('2d',{willReadFrequently:true}))return item;}catch{ /* Older 2D implementations use DOM canvases below. */ }
    }
    const item=doc.createElement('canvas');item.width=width;item.height=height;return item;
  }
  function render(scene,canvas,options={}) {
    if(!scene||scene.version!==VERSION)throw new Error('Unsupported landscape version.');
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Landscape canvas is unavailable.');
    const width=canvas.width||WORLD,height=canvas.height||WORLD;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
    const side=Math.min(width,height),scale=side/WORLD;
    // Export uses the same three raster layers as the live cache. Compositing
    // semitransparent paint directly onto paper would round pigment differently.
    const layers=Array.from({length:3},()=>{
      const item=rasterCanvas(width,height,canvas.ownerDocument);
      item.width=width;item.height=height;
      const layer=item.getContext('2d',{willReadFrequently:true});
      return {canvas:item,ctx:layer};
    });
    if(options.paper!==false){const back=layers[0].ctx;back.setTransform(scale,0,0,scale,(width-side)/2,(height-side)/2);paper(back,scene);back.setTransform(1,0,0,1,0,0);}
    publishLayer(ctx,layers[0].canvas);
    const through=options.through??scene.strokes.length;
    const partial=options.progress!=null&&options.progress<1&&through>0&&through<=scene.strokes.length?scene.strokes[through-1]:null;
    for(let i=0;i<Math.min(through,scene.strokes.length);i++){
      if(partial&&i===through-1)break;
      const layer=layers[scene.strokes[i].layer];
      layer.ctx.setTransform(scale,0,0,scale,(width-side)/2,(height-side)/2);
      drawStroke(layer.ctx,scene,scene.strokes[i],i===through-1?(options.progress??1):1);
      layer.ctx.setTransform(1,0,0,1,0,0);publishLayer(ctx,layer.canvas);
    }
    ctx.clearRect(0,0,width,height);
    if(partial){
      // Match the live active-layer accumulation order as well as its blend
      // target. Opposite equivalent orders can round translucent edges apart.
      ctx.globalCompositeOperation='source-over';ctx.drawImage(layers[partial.layer].canvas,0,0);
      ctx.save();ctx.setTransform(scale,0,0,scale,(width-side)/2,(height-side)/2);drawStroke(ctx,scene,partial,options.progress);ctx.restore();
      ctx.globalCompositeOperation='destination-over';
      for(let i=partial.layer-1;i>=0;i--)ctx.drawImage(layers[i].canvas,0,0);
      ctx.globalCompositeOperation='source-over';
      for(let i=partial.layer+1;i<layers.length;i++)ctx.drawImage(layers[i].canvas,0,0);
      for(const layer of layers)layer.canvas.width=layer.canvas.height=1;
    }else for(const layer of layers){ctx.drawImage(layer.canvas,0,0);layer.canvas.width=layer.canvas.height=1;}
    return canvas;
  }
  // The worker uses the exact export compositor and pigment material. Moving
  // this work off the UI thread never reduces source points or artwork quality.
  function createRaster(scene,side=800){
    const make=()=>rasterCanvas(side,side),output=make(),layers=Array.from({length:3},make);
    const ctx=output.getContext('2d',{willReadFrequently:true}),cached=layers.map(c=>c.getContext('2d',{willReadFrequently:true}));
    let count=0,ambient=null,grain=null;
    return {
      append(stroke){
        scene.strokes.push(stroke);
        if(!count){cached[0].setTransform(side/WORLD,0,0,side/WORLD,0,0);paper(cached[0],scene);cached[0].resetTransform();publishLayer(ctx,layers[0]);}
        const layer=cached[stroke.layer];layer.setTransform(side/WORLD,0,0,side/WORLD,0,0);drawStroke(layer,scene,stroke);layer.resetTransform();publishLayer(ctx,layers[stroke.layer]);count++;
        return revealKnots(stroke);
      },
      snapshot(kind='final'){
        if(kind==='ambient'){
          ambient ||= new global.OffscreenCanvas(480,480);
          if(!grain){grain=new global.OffscreenCanvas(INK_SIDE,INK_SIDE);const gc=grain.getContext('2d');gc.drawImage(pigmentAtlas(rasterDocument,true).tile,0,0);gc.globalCompositeOperation='destination-over';gc.fillStyle='rgba(255,255,255,.18)';gc.fillRect(0,0,INK_SIDE,INK_SIDE);}
          paintAmbient(ambient.getContext('2d'),layers,grain,480);return ambient.transferToImageBitmap();
        }
        ctx.resetTransform();ctx.clearRect(0,0,side,side);for(const layer of layers)ctx.drawImage(layer,0,0);return output.transferToImageBitmap();
      },
      get cachedPixels(){return side*side*4+(ambient?480*480+INK_SIDE*INK_SIDE:0);},
      get materialPixels(){return 2*INK_SIDE*INK_SIDE+2*(pigmentAtlases.get(rasterDocument)?.pixels||0);},
    };
  }
  function paintAmbient(output,layers,grain,side){
    output.clearRect(0,0,side,side);output.filter='blur(.45px)';
    for(const layer of layers)output.drawImage(layer,0,0,side,side);
    output.save();output.beginPath();output.rect(0,side*.58,side,side*.42);output.clip();output.filter='blur(3.8px)';output.drawImage(output.canvas,0,0);output.restore();output.filter='none';
    const pattern=output.createPattern(grain,'repeat');pattern.setTransform({a:.44,b:0,c:0,d:.44,e:0,f:0});
    output.globalCompositeOperation='destination-in';output.fillStyle=pattern;output.fillRect(0,0,side,side);
    output.globalCompositeOperation='destination-over';output.fillStyle='#fbf8f0';output.fillRect(0,0,side,side);output.globalCompositeOperation='source-over';
  }
  let brushSequence=0;
  function createView(container,scene,options={}) {
    if(!container)throw new Error('A landscape view container is required.');
    const doc=container.ownerDocument,win=doc.defaultView||global,svgNode=name=>doc.createElementNS('http://www.w3.org/2000/svg',name);
    const uid=`pulse-stream-${++brushSequence}`,side=800,records=[],lines=new Map(),lineSeconds=6,turnDuration=560;
    const stage=doc.createElement('div');stage.className='landscape-stage';stage.dataset.scene=scene.family;stage.style.opacity='0';
    const canvas=doc.createElement('canvas'),caches=Array.from({length:3},()=>rasterCanvas(side,side,doc));
    canvas.className='landscape-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Your finished landscape, composed from accepted pulse waveforms');
    for(const item of [canvas,...caches])item.width=item.height=side;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),cached=caches.map(item=>item.getContext('2d',{willReadFrequently:true}));
    // Low-resolution, infrequent copies of the already baked accepted pigment.
    // The canonical caches and the foreground source geometry are never altered.
    const emergence=doc.createElement('div'),emergencePaper=doc.createElement('div'),ambientSide=480;
    emergence.className='landscape-emergence';emergence.setAttribute('aria-hidden','true');emergencePaper.className='landscape-emergence-paper';
    const ambient=Array.from({length:2},()=>{const item=doc.createElement('canvas');item.width=item.height=ambientSide;emergencePaper.append(item);return item;});
    const ambientCtx=ambient.map(item=>item.getContext('2d'));emergence.append(emergencePaper);
    const discovery=doc.createElement('p');discovery.className='landscape-discovery';discovery.setAttribute('aria-hidden','true');
    const ink=svgNode('svg'),defs=svgNode('defs'),paperViewport=svgNode('g'),trace=svgNode('g'),reconstruction=svgNode('g'),tip=svgNode('g');
    ink.setAttribute('class','landscape-ink');ink.setAttribute('aria-hidden','true');trace.setAttribute('class','landscape-paper-trace');reconstruction.setAttribute('class','landscape-reconstruction');tip.setAttribute('class','landscape-tip');
    const gradient=(id,stops,attrs={})=>{const g=svgNode('linearGradient');g.id=id;for(const[k,v]of Object.entries(attrs))g.setAttribute(k,v);for(const[offset,c]of stops){const s=svgNode('stop');s.setAttribute('offset',offset);s.setAttribute('stop-color',c);g.append(s);}defs.append(g);return g;};
    gradient(`${uid}-bristles`,[['0%','#183e86'],['24%','#253b51'],['72%','#655743'],['100%','#b4a485']],{x1:0,y1:0,x2:29,y2:-11,gradientUnits:'userSpaceOnUse'});
    gradient(`${uid}-metal`,[['0%','#535e61'],['24%','#d8d9cd'],['42%','#f9f7e9'],['64%','#8f9692'],['100%','#4d595d']],{x1:27,y1:-19,x2:32,y2:-5,gradientUnits:'userSpaceOnUse'});
    const addTip=(tag,attrs)=>{const n=svgNode(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);tip.append(n);return n;};
    addTip('ellipse',{cx:1.8,cy:.35,rx:2.7,ry:.85,fill:'#263e53',opacity:'.16'});
    addTip('path',{d:'M33 -18Q41 -23 47 -24Q51 -23 49 -19L37 -11Z',fill:'#775f46'});
    addTip('path',{d:'M37 -17L47 -22',fill:'none',stroke:'#b5a184','stroke-width':'.7',opacity:'.7'});
    addTip('path',{d:'M23 -14L35 -19L39 -11L26 -7Z',fill:`url(#${uid}-metal)`,stroke:'#5d625d','stroke-width':'.35'});
    addTip('path',{d:'M26 -15L29 -8M33 -17L36 -10',fill:'none',stroke:'#f4efe0','stroke-width':'.6',opacity:'.7'});
    addTip('path',{d:'M0 0C8 -2 12 -13 23 -14L26 -7C17 -3 8 1 0 0Z',fill:`url(#${uid}-bristles)`,stroke:'#263e53','stroke-width':'.3'});
    for(let i=0;i<9;i++)addTip('path',{d:`M${23+i*.35} ${-13.7+i*.8}Q${12+i*.5} ${-6+i*.5} ${.5+i*.65} ${-.2+i*.1}`,fill:'none',stroke:i%3?'#c9b795':'#263129','stroke-width':i%3?'.25':'.38',opacity:i%3?'.5':'.65'});
    const loadedTip=addTip('path',{d:'M0 0C5 -2 7 -5 11 -7C9 -3 7 -.6 3 .2Z',fill:'#2855b8'});
    paperViewport.append(trace);ink.append(defs,paperViewport,reconstruction,tip);stage.append(canvas);container.append(emergence,stage,ink,discovery);container.classList.add('landscape-view');
    let disposed=false,paused=false,frame=0,last=0,painted=0,progress=0,finished=false,revealing=false,finishing=false;
    let cursor=0,total=0,cachePainted=0,cacheReady=false,revealElapsed=0,resolveFinish=null,finishPromise=null,warmTask=0;
    let rasterWorker=null,workerBusy=false,workerTimer=0,workerSnapshot=0,workerMaterials=0,workerStarted=false,pendingAmbient=null;
    let captureFirst=0,captureViewBox='',captureTransform='',writingLine=0,turnElapsed=0,turning=false;
    let warmedSeconds=0,ambientFront=0,ambientElapsed=0,ambientStage=0,ambientPreparedStage=0,ambientThrough=0,ambientAnimating=false,ambientTask=0,ambientCandidate=null,activeAmbient=null,ambientFade=0,ambientTarget=0,captionElapsed=6000,captionIndex=-1;
    const ambientOpacity=.58,ambientDuration=3200,ambientSettleMs=1200,ambientStepSeconds=5,captionStages=[1,9,17,25],captions=['Your first colors are appearing.','A landscape is taking shape.','Your pulse is adding the details.','A place that is yours alone.'];
    let box={width:1,height:1},camera={x:540,y:540,scale:1};
    const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced=options.reducedMotion===true||options.reducedMotion==='reduce'||!!motion?.matches;
    const atlas=pigmentAtlas(doc,true);atlas.svgMaskUrl ||= atlas.tile.toDataURL('image/png');
    const ambientGrain=doc.createElement('canvas');ambientGrain.width=ambientGrain.height=INK_SIDE;
    const grainContext=ambientGrain.getContext('2d');grainContext.drawImage(atlas.tile,0,0);grainContext.globalCompositeOperation='destination-over';grainContext.fillStyle='rgba(255,255,255,.18)';grainContext.fillRect(0,0,INK_SIDE,INK_SIDE);
    const pattern=svgNode('pattern');pattern.id=`${uid}-grain`;pattern.setAttribute('patternUnits','userSpaceOnUse');pattern.setAttribute('width','85');pattern.setAttribute('height','85');
    const texture=svgNode('image');texture.setAttribute('href',atlas.svgMaskUrl);texture.setAttribute('width','85');texture.setAttribute('height','85');pattern.append(texture);defs.append(pattern);
    const paperFade=gradient(`${uid}-paper-fade`,[['0%','black'],['100%','white']],{gradientUnits:'userSpaceOnUse',x1:0,x2:0,y1:0,y2:1});
    const paperMask=svgNode('mask'),paperMaskRect=svgNode('rect');paperMask.id=`${uid}-paper-window`;paperMask.setAttribute('maskUnits','userSpaceOnUse');paperMask.setAttribute('maskContentUnits','userSpaceOnUse');paperMaskRect.setAttribute('fill',`url(#${paperFade.id})`);paperMask.append(paperMaskRect);defs.append(paperMask);paperViewport.setAttribute('mask',`url(#${paperMask.id})`);
    const stats=global.__pulseLandscapeStats={frames:0,rasterFrames:0,forcedRasterFrames:0,rasterSkipped:0,rasterIntervalMs:0,rasterPainted:-1,rasterProgress:0,active:false,revealing:false,mode:'recording',frameMs:0,pixelBudget:3086336,cachedPixels:side*side*4+ambientSide*ambientSide*2+INK_SIDE*INK_SIDE,get materialPixelBudget(){return 2*INK_SIDE*INK_SIDE+2*INK_PIXEL_LIMIT+(rasterWorker?2*INK_SIDE*INK_SIDE+2*INK_PIXEL_LIMIT:0);},get materialPixels(){return 2*INK_SIDE*INK_SIDE+2*(pigmentAtlases.get(doc)?.pixels||0)+workerMaterials;},liveTexturePixels:INK_SIDE*INK_SIDE,liveMaskPixelEstimate:0,camera:{...camera},finished:false,strokes:0,painted:0,activeStroke:null,progress:0,frontier:null,nib:null,visibleSeconds:6,wetTrail:null,projection:null,settling:false,streamTime:0,streamStart:-6,paperOffsetX:0,anchorX:0,visibleIntervals:[],morphProgress:0,revealSamples:[],emergence:{updates:0,stage:0,sourceSeconds:0,strokeCount:0,sourceEnd:null,animating:false,fade:0,target:0,beatDriven:false,beatsRevealed:0,beatCount:0,lastBeatTime:null,snapshotRequests:0,opacity:0,caption:'',captionVisible:false,clearTop:0,clearBottom:1,pixelBudget:ambientSide*ambientSide*2+INK_SIDE*INK_SIDE}};
    stats.rasterBackend='main-thread';stats.workerFrameMs=0;stats.workerRequests=0;
    stats.queuedSeconds=0;stats.playbackRate=0;stats.awaitingSource=false;
    // Numeric payload accounting is separate from canvas backing pixels. At
    // most one four-number knot is retained per original accepted source point.
    stats.revealKnotCount=0;stats.revealKnotLimit=0;stats.revealKnotDataBytes=0;
    function stopWorker(){rasterWorker?.terminate();rasterWorker=null;workerBusy=false;holdWorkerWatchdog();pendingAmbient?.bitmap?.close();pendingAmbient=null;workerMaterials=0;stats.workerMaterialPixels=0;}
    function holdWorkerWatchdog(){win.clearTimeout(workerTimer);workerTimer=0;}
    function watchWorker(){
      if(workerTimer||!workerBusy||paused||doc.hidden)return;
      workerTimer=win.setTimeout(()=>{if(!disposed)fallbackRaster();},10000);
    }
    function fallbackRaster(){
      stopWorker();workerStarted=true;workerSnapshot=0;workerMaterials=0;cachePainted=0;warmedSeconds=0;cacheReady=false;
      for(const c of caches)c.width=c.height=side;
      stats.rasterBackend='main-thread-fallback';stats.warmStrokes=stats.emergence.strokeCount;
      stats.cachedPixels=side*side*4+ambientSide*ambientSide*2+INK_SIDE*INK_SIDE;stats.pixelBudget=3086336;
      warmNext();schedule();
    }
    function startWorker(){
      if(workerStarted)return;workerStarted=true;
      if(options.rasterWorker===false||!rasterWorkerUrl||!win.Worker||!win.OffscreenCanvas)return;
      try{
        const worker=rasterWorker=new win.Worker(rasterWorkerUrl);
        // Three canonical layers live only in the worker. One bitmap may be
        // in flight; account for it, the worker output and the main snapshot.
        for(const c of caches)c.width=c.height=1;
        stats.rasterBackend='worker';stats.cachedPixels=side*side*6+ambientSide*ambientSide*3+INK_SIDE*INK_SIDE*2+3;stats.pixelBudget=stats.cachedPixels;
        worker.onerror=event=>{event.preventDefault();if(!disposed&&rasterWorker===worker)fallbackRaster();};
        worker.onmessage=event=>{
          const result=event.data,begin=performance.now();
          if(disposed||rasterWorker!==worker){result.bitmap?.close();return;}
          win.clearTimeout(workerTimer);workerTimer=0;workerBusy=false;
          if(result.type==='error'){fallbackRaster();return;}
          if(result.type!=='painted'&&result.type!=='snapshot'){result.bitmap?.close();fallbackRaster();return;}
          const record=result.type==='painted'?records[result.count-1]:null,knots=result.revealNodes;
          if(record&&Array.isArray(knots)&&knots.length===record.stroke.points.length&&knots.every((p,i)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.t===record.stroke.points[i].t&&p.v===record.stroke.points[i].v)){
            stats.revealKnotCount+=knots.length-(record.revealKnots?.length||0);stats.revealKnotDataBytes=stats.revealKnotCount*4*8;record.revealKnots=knots;
          }
          if(result.bitmap&&result.snapshot==='ambient'){pendingAmbient?.bitmap?.close();pendingAmbient=null;if(finishing)result.bitmap.close();else pendingAmbient={bitmap:result.bitmap,...ambientMetadata(result.count)};}
          else if(result.bitmap){
            try{ctx.resetTransform();ctx.clearRect(0,0,side,side);ctx.drawImage(result.bitmap,0,0);workerSnapshot=result.count;}
            catch{fallbackRaster();return;}
            finally{result.bitmap.close();}
          }
          cachePainted=result.count;warmedSeconds=records.slice(0,cachePainted).reduce((sum,r)=>sum+r.stroke.sourceEnd-r.stroke.sourceStart,0);
          workerMaterials=result.materialPixels||workerMaterials;stats.workerMaterialPixels=workerMaterials;
          stats.warmStrokes=cachePainted;stats.workerFrameMs=result.durationMs||0;
          if(finishing&&cachePainted===records.length&&workerSnapshot===records.length){cacheReady=true;stats.rasterFrames++;stats.forcedRasterFrames++;stats.rasterPainted=records.length;stats.rasterProgress=1;}
          discover();stats.warmFrameMs=performance.now()-begin;warmNext();schedule();
        };
      }catch{fallbackRaster();}
    }
    function warmWorker(){
      if(disposed||paused||doc.hidden||finished)return;
      if(workerBusy){watchWorker();return;}
      const r=records[cachePainted];let message;
      if(r){
        const nextSeconds=warmedSeconds+r.stroke.sourceEnd-r.stroke.sourceStart;
        const nextStage=ambientStageFor(nextSeconds);
        const candidate=nextStage>ambientPreparedStage?ambientMetadata(cachePainted+1):null;
        const snapshot=finishing?(cachePainted+1===records.length?'final':false):candidate&&(!candidate.beatDriven||candidate.beats.length)?'ambient':false;
        if(snapshot==='ambient'){ambientPreparedStage=nextStage;stats.emergence.snapshotRequests++;}
        message={type:'paint',stroke:r.stroke,snapshot};
        if(!cachePainted)message.scene={...scene,strokes:[],slots:[],sourceIntervals:[]};
      }else if(finishing&&workerSnapshot!==records.length)message={type:'snapshot'};
      else {
        if(finishing&&!cacheReady&&workerSnapshot===records.length){cacheReady=true;stats.rasterFrames++;stats.forcedRasterFrames++;stats.rasterPainted=records.length;stats.rasterProgress=1;}
        return;
      }
      workerBusy=true;stats.workerRequests++;
      // A failed or suspended worker must never leave the final reveal pending.
      watchWorker();
      try{rasterWorker.postMessage(message);}catch{fallbackRaster();}
    }
    const path=nodes=>nodes.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join('');
    const liveColor=t=>{const a=[[36,82,194],[103,73,157],[31,121,134],[36,82,194]],q=(t/11+.15*Math.sin(t/19))%3,i=Math.floor(q),u=smooth(q-i);return a[i].map((v,j)=>mix(v,a[i+1][j],u));};
    const settings=()=>({left:Math.min(22,box.width*.055),baseline:box.height*.50,sx:Math.max(1,box.width-Math.min(22,box.width*.055)-58)/(lineSeconds*100),sy:clamp(box.height*.16,52,72)/100,lineSpacing:clamp(box.height*.145,78,116),fadeTop:Math.min(198,box.height*.31)});
    const pageRow=()=>writingLine+(turning?smooth(turnElapsed/turnDuration):0);
    function paperPoint(r,p,line=Math.floor((r.start+p.t-r.stroke.sourceStart)/lineSeconds)){
      const s=settings(),q=sourcePoint(r,p);
      return {x:s.left+(q.x-line*lineSeconds*100)*s.sx,y:s.baseline+(line-pageRow())*s.lineSpacing+q.y*s.sy};
    }
    function placePaperWindow(open=0){
      const s=settings(),top=s.fadeTop*(1-open),feather=28*(1-open)+.01;
      const bottom=mix(s.baseline+s.sy*100+8,box.height,open);
      for(const node of [paperMask,paperMaskRect])for(const[k,v]of Object.entries({x:0,y:top,width:box.width,height:bottom-top}))node.setAttribute(k,v);
      paperFade.setAttribute('y1',top);paperFade.setAttribute('y2',top+feather);
    }
    const sourcePoint=(r,p)=>({x:(r.start+p.t-r.stroke.sourceStart)*100,y:(.5-normalized(p.v,r.stroke.transform.domain.min,r.stroke.transform.domain.max))*100});
    function placeEmergence(){
      const s=settings(),width=box.width*1.12,height=box.height*1.6,top=clamp((s.baseline-s.lineSpacing-s.sy*50-26)/box.height,0,1),bottom=clamp((s.baseline+s.sy*50+32)/box.height,0,1),feather=28/box.height;
      // Spread the accepted landscape vertically around the quiet writing
      // corridor, retaining its banks and full contour density at phone width.
      // This fixed atmospheric projection never follows or pans with the nib.
      emergencePaper.style.width=`${width}px`;emergencePaper.style.height=`${height}px`;emergencePaper.style.transform=`translate3d(${(box.width-width)/2}px,${(box.height-height)/2-box.height*.07}px,0)`;
      const mask=`linear-gradient(to bottom,transparent,black 10%,black ${Math.max(.1,top-feather)*100}%,transparent ${top*100}%,transparent ${bottom*100}%,black ${Math.min(.92,bottom+feather)*100}%,black 92%,transparent)`;
      emergence.style.maskImage=mask;emergence.style.webkitMaskImage=mask;stats.emergence.clearTop=top;stats.emergence.clearBottom=bottom;
    }
    const ambientStageFor=seconds=>seconds<3?0:Math.floor((seconds-3)/ambientStepSeconds)+1;
    function ambientMetadata(count){
      if(ambientCandidate?.count===count&&ambientCandidate.from===ambientThrough)return ambientCandidate;
      const prefix=records.slice(0,count),fresh=prefix.slice(ambientThrough),seen=new Set(),beats=[];
      let sourceSeconds=0;for(const r of prefix)sourceSeconds+=r.stroke.sourceEnd-r.stroke.sourceStart;
      const beatDriven=fresh.every(r=>Array.isArray(r.stroke.beatTimes));
      if(beatDriven)for(const r of fresh)for(const t of r.stroke.beatTimes){
        const key=Math.round(t*1e7);if(seen.has(key))continue;seen.add(key);
        beats.push({t,at:r.start+t-r.stroke.sourceStart});
      }
      beats.sort((a,b)=>a.at-b.at);
      return ambientCandidate={count,from:ambientThrough,sourceSeconds,sourceEnd:prefix.at(-1)?.stroke.sourceEnd??null,stage:ambientStageFor(sourceSeconds),beatDriven,beats,beatIndex:0};
    }
    function hideDiscovery(){captionElapsed=6000;discovery.style.opacity='0';stats.emergence.captionVisible=false;}
    function completeEmergence(){
      ambientFront=1-ambientFront;ambient[ambientFront].style.opacity='1';ambient[1-ambientFront].style.opacity='0';
      ambientThrough=activeAmbient?.count??ambientThrough;activeAmbient=null;ambientFade=ambientTarget=1;
      ambientAnimating=false;stats.emergence.animating=false;stats.emergence.fade=stats.emergence.target=1;
    }
    function ambientNeedsFrame(){return ambientAnimating&&(!activeAmbient?.beatDriven||ambientFade<ambientTarget-.0001);}
    function prepareAmbient(){
      if(rasterWorker||ambientTask||disposed||paused||doc.hidden||finishing||finished||ambientAnimating||pendingAmbient||ambientStageFor(warmedSeconds)<=ambientStage)return;
      const candidate=ambientMetadata(cachePainted);
      if(candidate.beatDriven&&(!candidate.beats.length||candidate.beats[0].at>cursor))return;
      const prepare=()=>{
        ambientTask=0;if(disposed||paused||doc.hidden||finishing||finished||ambientAnimating)return;
        const meta=ambientMetadata(cachePainted);
        if(meta.stage<=ambientStage||meta.beatDriven&&(!meta.beats.length||meta.beats[0].at>cursor))return;
        // Only the two bounded snapshot canvases are retained. Heavy pigment
        // copying stays in an idle callback, never in a beat animation frame.
        paintAmbient(ambientCtx[1-ambientFront],caches,ambientGrain,ambientSide);
        pendingAmbient={...meta,prepared:true};ambientPreparedStage=meta.stage;stats.emergence.snapshotRequests++;discover();
      };
      ambientTask=win.requestIdleCallback?win.requestIdleCallback(prepare,{timeout:1200}):win.setTimeout(prepare,60);
    }
    function discover(){
      if(disposed||paused||doc.hidden||finishing||finished||ambientAnimating||warmedSeconds<3)return;
      if(!pendingAmbient){prepareAmbient();return;}
      // Recompute only the small timestamp list after the previous snapshot
      // settles: a worker may have coalesced a newer accepted-data prefix.
      const meta=ambientMetadata(pendingAmbient.count);
      if(meta.stage<=ambientStage){pendingAmbient.bitmap?.close();pendingAmbient=null;return;}
      if(meta.beatDriven&&(!meta.beats.length||meta.beats[0].at>cursor))return;
      const next=1-ambientFront,output=ambientCtx[next];
      if(pendingAmbient.bitmap){output.clearRect(0,0,ambientSide,ambientSide);output.drawImage(pendingAmbient.bitmap,0,0);pendingAmbient.bitmap.close();}
      pendingAmbient=null;activeAmbient=meta;
      ambient[next].style.zIndex='1';ambient[ambientFront].style.zIndex='0';ambient[next].style.opacity='0';
      ambientStage=meta.stage;ambientElapsed=ambientFade=ambientTarget=0;ambientAnimating=true;emergence.style.opacity=`${ambientOpacity}`;
      Object.assign(stats.emergence,{updates:stats.emergence.updates+1,stage:ambientStage,sourceSeconds:meta.sourceSeconds,strokeCount:meta.count,sourceEnd:meta.sourceEnd,animating:true,fade:0,target:0,beatDriven:meta.beatDriven,beatsRevealed:0,beatCount:meta.beats.length,lastBeatTime:null,opacity:ambientOpacity});
      // Captions remain sparse source-duration milestones, never a heartbeat flash.
      const nextCaption=captionStages.findLastIndex(stage=>stage<=ambientStage);
      if(nextCaption>captionIndex){captionIndex=nextCaption;captionElapsed=0;discovery.textContent=captions[nextCaption];stats.emergence.caption=captions[nextCaption];stats.emergence.captionVisible=true;}
      if(reduced){
        if(meta.beatDriven){stats.emergence.beatsRevealed=meta.beats.length;stats.emergence.lastBeatTime=meta.beats.at(-1)?.t??null;}
        completeEmergence();
      }
      schedule();
    }
    function emergenceFrame(delta){
      discover();
      if(ambientAnimating){
        if(activeAmbient.beatDriven){
          const beats=activeAmbient.beats;
          while(activeAmbient.beatIndex<beats.length&&beats[activeAmbient.beatIndex].at<=cursor){
            stats.emergence.lastBeatTime=beats[activeAmbient.beatIndex].t;activeAmbient.beatIndex++;
          }
          ambientTarget=activeAmbient.beatIndex/beats.length;
          // Successive real beats add pigment monotonically. The 1.2-second
          // settling tail spans beats without pulsing opacity or moving ink.
          ambientFade+=(ambientTarget-ambientFade)*(1-Math.exp(-4*delta/ambientSettleMs));
          if(ambientTarget-ambientFade<.003)ambientFade=ambientTarget;
          stats.emergence.beatsRevealed=activeAmbient.beatIndex;
        }else{ambientElapsed+=delta;ambientTarget=1;ambientFade=smooth(clamp(ambientElapsed/ambientDuration,0,1));}
        ambient[1-ambientFront].style.opacity=`${ambientFade}`;stats.emergence.fade=ambientFade;stats.emergence.target=ambientTarget;
        if(ambientFade===1||reduced)completeEmergence();
      }
      if(captionElapsed<6000){captionElapsed=Math.min(6000,captionElapsed+delta);const opacity=reduced?Number(captionElapsed<6000):Math.min(smooth(captionElapsed/700),smooth((6000-captionElapsed)/1200));discovery.style.opacity=`${opacity}`;stats.emergence.captionVisible=captionElapsed<6000;}
      discover();
    }
    function washPath(r,nodes){
      if(nodes.length<2)return '';
      const upper=nodes.map(p=>({x:p.x,y:p.y-1.4}));
      const lower=nodes.map((p,i)=>{const source=r.nodes[i],seed=r.stroke.material.grainSeed,wet=materialField(seed,source.t*2.7,53101),s=2+32*wet*wet+8*materialField(seed,source.t*31,53701);return {x:p.x,y:p.y+s};}).reverse();
      return path([...upper,...lower])+'Z';
    }
    function inkBodyPath(r,nodes){
      const edge=sign=>nodes.map((p,i)=>{const before=nodes[Math.max(0,i-1)],after=nodes[Math.min(nodes.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,n=Math.hypot(dx,dy)||1,w=.9+1.8*materialField(r.stroke.material.grainSeed,r.nodes[i].t*43,54701);return {x:p.x-sign*dy/n*w,y:p.y+sign*dx/n*w};});
      return path([...edge(1),...edge(-1).reverse()])+'Z';
    }
    function bloomPath(r,nodes){
      // Small, irregular deposits are generated once in paper coordinates.
      // They decorate the measured path without changing its geometry or timing.
      let d='';
      for(let i=2;i<nodes.length;i+=7){const p=nodes[i],t=r.nodes[i].t,seed=r.stroke.material.grainSeed,wet=materialField(seed,t*9,54101),rx=2+wet*6,ry=2+wet*10,y=p.y+ry*.7;
        d+=`M${p.x-rx} ${y}Q${p.x-rx*.8} ${y-ry} ${p.x} ${y-ry*.7}Q${p.x+rx*1.4} ${y-ry*.4} ${p.x+rx} ${y+ry*.3}Q${p.x+rx*.4} ${y+ry*1.3} ${p.x-rx*.7} ${y+ry*.6}Z`;
      }return d;
    }
    function refreshRecords(){
      for(let i=records.length;i<scene.strokes.length;i++){
        const stroke=scene.strokes[i],prior=records.at(-1);
        // Long periods without accepted data are pen lifts, not invented beats
        // or a long playback backlog. Source timestamps within every stroke stay exact.
        const gap=prior?Math.min(.45,Math.max(0,stroke.sourceStart-prior.stroke.sourceEnd)):0;
        const r={index:i,stroke,start:total+gap,end:total+gap+stroke.sourceEnd-stroke.sourceStart,nodes:sampleStroke(stroke)};total=r.end;
        r.displayStart=r.start;
        if(prior&&gap>0&&continuousPredecessor(stroke)===prior.stroke){
          const a=sourcePoint(prior,prior.nodes.at(-1)),b=sourcePoint(r,r.nodes[0]);
          r.join={a,b,from:prior.stroke.points.at(-1),to:stroke.points[0]};r.displayStart=prior.end;
        }
        r.group=svgNode('g');r.group.id=`${uid}-source-${i}`;r.group.setAttribute('class','landscape-record');r.group.dataset.recordIndex=i;r.visible=false;r.clipWidth=-1;
        r.clip=svgNode('clipPath');r.clip.id=`${uid}-clip-${i}`;r.clip.setAttribute('clipPathUnits','userSpaceOnUse');r.clipRect=svgNode('rect');r.clipRect.setAttribute('x',r.displayStart*100-.01);r.clipRect.setAttribute('y','-100');r.clipRect.setAttribute('height','220');r.clip.append(r.clipRect);defs.append(r.clip);r.group.setAttribute('clip-path',`url(#${r.clip.id})`);
        const g=gradient(`${uid}-color-${i}`,Array.from({length:7},(_,j)=>[`${j/6*100}%`,color(liveColor(mix(r.start,r.end,j/6)))]),{gradientUnits:'userSpaceOnUse',x1:r.start*100,y1:0,x2:r.end*100,y2:0});
        r.mask=svgNode('mask');r.mask.id=`${uid}-mask-${i}`;r.mask.setAttribute('maskUnits','userSpaceOnUse');r.mask.setAttribute('maskContentUnits','userSpaceOnUse');r.mask.setAttribute('mask-type','alpha');
        for(const[k,v]of Object.entries({x:r.start*100-2,y:-100,width:(r.end-r.start)*100+4,height:220}))r.mask.setAttribute(k,v);
        const grain=svgNode('rect');for(const[k,v]of Object.entries({x:r.start*100-2,y:-100,width:(r.end-r.start)*100+4,height:220,fill:`url(#${pattern.id})`}))grain.setAttribute(k,v);r.mask.append(grain);defs.append(r.mask);
        r.wash=svgNode('path');r.wash.setAttribute('class','landscape-source-wash');r.wash.setAttribute('fill',`url(#${g.id})`);r.wash.setAttribute('mask',`url(#${r.mask.id})`);
        r.core=svgNode('path');r.core.setAttribute('class','landscape-live-core');r.core.dataset.strokeIndex=i;r.core.setAttribute('stroke',`url(#${g.id})`);r.core.setAttribute('vector-effect','non-scaling-stroke');
        const nodes=r.nodes.map(p=>sourcePoint(r,p));r.core.setAttribute('d',path(nodes));r.wash.setAttribute('d',washPath(r,nodes));
        const body=svgNode('path');body.setAttribute('class','landscape-source-body');body.setAttribute('d',inkBodyPath(r,nodes));body.setAttribute('fill',`url(#${g.id})`);body.setAttribute('mask',`url(#${r.mask.id})`);
        const blooms=svgNode('path');blooms.setAttribute('class','landscape-source-blooms');blooms.setAttribute('d',bloomPath(r,nodes));blooms.setAttribute('fill',`url(#${g.id})`);blooms.setAttribute('mask',`url(#${r.mask.id})`);
        const edge=svgNode('path');edge.setAttribute('class','landscape-source-edge');edge.setAttribute('d',path(nodes));edge.setAttribute('stroke',`url(#${g.id})`);edge.setAttribute('mask',`url(#${r.mask.id})`);edge.setAttribute('vector-effect','non-scaling-stroke');
        if(r.join){const join=svgNode('path');join.setAttribute('class','landscape-source-join');join.dataset.fromStrokeIndex=prior.index;join.dataset.strokeIndex=i;join.setAttribute('d',path([r.join.a,r.join.b]));join.setAttribute('stroke',`url(#${g.id})`);join.setAttribute('vector-effect','non-scaling-stroke');r.group.append(join);}
        // These paths, color stops, and paper texture never change during capture.
        // Only the clip edge and the whole paper's transform advance.
        r.group.append(r.wash,blooms,edge,body,r.core);defs.append(r.group);records.push(r);stats.revealKnotLimit+=stroke.points.length;
      }
      stats.strokes=records.length;
    }
    function stopWarming(){if(ambientTask){if(win.cancelIdleCallback)win.cancelIdleCallback(ambientTask);else win.clearTimeout(ambientTask);ambientTask=0;}if(warmTask){if(win.cancelIdleCallback)win.cancelIdleCallback(warmTask);else win.clearTimeout(warmTask);warmTask=0;}}
    function warmNext(){
      if(!disposed&&records.length&&!workerStarted)startWorker();
      if(rasterWorker){warmWorker();return;}
      if(warmTask||disposed||paused||doc.hidden||finishing||finished||cachePainted>=records.length)return;
      const warm=()=>{warmTask=0;if(disposed||paused||doc.hidden||finishing||finished)return;const begin=performance.now();prepareRaster(0,false);stats.warmStrokes=Math.max(cachePainted,stats.emergence.strokeCount);discover();stats.warmFrameMs=performance.now()-begin;warmNext();};
      // Bake one accepted deposit between animation frames. The layer remains
      // copied infrequently for the pale background; no mark is repainted or moved.
      warmTask=win.requestIdleCallback?win.requestIdleCallback(warm,{timeout:1200}):win.setTimeout(warm,60);
    }
    function currentRecord(){
      while(painted<records.length&&cursor>records[painted].end+1e-8)painted++;
      const r=records[painted];progress=r?clamp((cursor-r.start)/(r.end-r.start),0,1):0;
      stats.painted=painted;stats.progress=progress;stats.activeStroke=r&&cursor>=r.start?painted:null;return r;
    }
    function hideBrush(){if(tip.style.display!=='none')tip.style.display='none';stats.nib=null;}
    function liveFrontier(record,fraction){
      // Live drawing needs only measured time/value interpolation. Preparing
      // terrain pigment here duplicates the worker and can stall a new stroke.
      const nodes=record.nodes,t=mix(record.stroke.sourceStart,record.stroke.sourceEnd,clamp(fraction,0,1));
      let lo=0,hi=nodes.length-1;
      while(hi-lo>1){const mid=(lo+hi)>>1;if(nodes[mid].t<=t)lo=mid;else hi=mid;}
      const a=nodes[lo],b=nodes[hi],u=b.t>a.t?clamp((t-a.t)/(b.t-a.t),0,1):0;
      return {t,v:mix(a.v,b.v,u)};
    }
    function captureFrame(){
      const s=settings(),row=pageRow(),firstLine=Math.max(0,writingLine-1),lastLine=writingLine+(turning?1:0);
      const viewBox=`0 0 ${box.width} ${box.height}`,transform=`translate(0 ${s.baseline-row*s.lineSpacing})`;
      if(captureViewBox!==viewBox){ink.setAttribute('viewBox',viewBox);captureViewBox=viewBox;}
      if(trace.style.display!=='')trace.style.display='';
      if(reconstruction.style.display!=='none')reconstruction.style.display='none';
      if(stage.style.opacity!=='0')stage.style.opacity='0';
      if(captureTransform!==transform){trace.setAttribute('transform',transform);captureTransform=transform;}
      // Keep only the current sheet window mounted. Original paths, pigment,
      // masks and color stops are immutable source definitions, shared by uses
      // when a measured record crosses a line boundary.
      for(const [index,line]of lines)if(index<firstLine||index>lastLine){line.group.remove();line.clip.remove();lines.delete(index);}
      while(captureFirst<records.length&&records[captureFirst].end<firstLine*lineSeconds)captureFirst++;
      const visible=[];let instances=0;
      for(let index=firstLine;index<=lastLine;index++){
        let line=lines.get(index);
        if(!line){
          const group=svgNode('g'),clip=svgNode('clipPath'),rect=svgNode('rect');
          group.setAttribute('class','landscape-line');group.dataset.lineIndex=index;
          clip.id=`${uid}-line-${index}`;clip.setAttribute('clipPathUnits','userSpaceOnUse');
          for(const[k,v]of Object.entries({x:index*lineSeconds*100,y:-100,width:lineSeconds*100,height:220}))rect.setAttribute(k,v);
          clip.append(rect);defs.append(clip);group.setAttribute('clip-path',`url(#${clip.id})`);trace.append(group);
          line={group,clip,uses:new Map(),transform:''};lines.set(index,line);
        }
        const lineTransform=`translate(${s.left-index*lineSeconds*100*s.sx} ${index*s.lineSpacing}) scale(${s.sx} ${s.sy})`;
        if(line.transform!==lineTransform){line.group.setAttribute('transform',lineTransform);line.transform=lineTransform;}
        const opacity=index===writingLine-1&&turning?1-smooth(turnElapsed/turnDuration):1;
        if(line.opacity!==opacity){line.group.style.opacity=`${opacity}`;line.opacity=opacity;}
        const begin=index*lineSeconds,end=begin+lineSeconds;
        for(let i=captureFirst;i<records.length;i++){
          const r=records[i];if(r.displayStart>Math.min(end,cursor))break;
          if(r.end<=begin||r.displayStart>=end)continue;
          if(!line.uses.has(i)){
            const use=svgNode('use');use.setAttribute('href',`#${r.group.id}`);use.setAttribute('class','landscape-line-fragment');use.dataset.recordIndex=i;line.group.append(use);line.uses.set(i,use);
          }
          const width=Math.max(0,Math.min(r.end,cursor)-r.displayStart)*100+.001;
          if(r.clipWidth!==width){r.clipRect.setAttribute('width',width);r.clipWidth=width;}
          r.visible=true;instances++;
          const from=Math.max(r.start,begin),to=Math.min(r.end,end,cursor);
          if(to>from)visible.push({index:r.index,line:index,sourceStart:r.stroke.sourceStart+from-r.start,sourceEnd:r.stroke.sourceStart+to-r.start,start:from,end:to});
        }
      }
      const r=currentRecord(),lineProgress=clamp((cursor-writingLine*lineSeconds)/lineSeconds,0,1);
      stats.streamTime=cursor;stats.streamStart=firstLine*lineSeconds;stats.paperOffsetX=s.left;stats.paperOffsetY=-row*s.lineSpacing;stats.visibleIntervals=visible;
      stats.queuedSeconds=Math.max(0,total-cursor);stats.awaitingSource=cursor>=total&&!paused&&!doc.hidden&&!finished;
      stats.playbackRate=paused||doc.hidden||reduced||turning||stats.awaitingSource?0:1;
      stats.lineTurn={active:turning,progress:turning?turnElapsed/turnDuration:0,fromLine:writingLine,toLine:writingLine+1};
      stats.projection={kind:'wrapped-source-time-value',windowSeconds:lineSeconds,lineSeconds,lineIndex:writingLine,lineProgress,lineSpacing:s.lineSpacing,paperOffsetY:stats.paperOffsetY,start:writingLine*lineSeconds,baseline:s.baseline+(writingLine-row)*s.lineSpacing,amplitude:s.sy*100,settle:0};
      stats.visibleLines=lines.size;stats.visibleFragments=instances;stats.visibleSeconds=(lastLine-firstLine+1)*lineSeconds;
      stats.liveMaskPixelEstimate=Math.ceil(box.width*(win.devicePixelRatio||1))*Math.ceil((90*instances+s.baseline+s.sy*100+8-s.fadeTop)*(win.devicePixelRatio||1));
      const bridging=r?.join&&cursor>=r.displayStart&&cursor<r.start;stats.bridging=!!bridging;
      if(!r||cursor<r.start&&!bridging||paused||reduced||doc.hidden){hideBrush();return;}
      const u=bridging?(cursor-r.displayStart)/(r.start-r.displayStart):0;
      const frontier=bridging?{t:mix(r.join.from.t,r.join.to.t,u),v:mix(r.join.from.v,r.join.to.v,u)}:liveFrontier(r,progress);
      const q=bridging?{x:mix(r.join.a.x,r.join.b.x,u),y:mix(r.join.a.y,r.join.b.y,u)}:sourcePoint(r,frontier);
      let x=s.left+(q.x-writingLine*lineSeconds*100)*s.sx,y=s.baseline+(writingLine-row)*s.lineSpacing+q.y*s.sy;
      const earlier=bridging?r.join.from:liveFrontier(r,Math.max(0,progress-.005));
      const dy=-(frontier.v-earlier.v)*s.sy*100;
      let angle=clamp(Math.atan2(dy,Math.max(.001,(frontier.t-earlier.t)*100*s.sx))*180/Math.PI*.08,-8,8);
      if(turning){
        // The brush crosses the paper in the air. The source clock is held at
        // the exact seam, and no return connector is deposited as pulse data.
        const lift=smooth(turnElapsed/turnDuration),arc=Math.sin(Math.PI*lift);
        x=mix(s.left+lineSeconds*100*s.sx,s.left,lift);
        y=s.baseline+q.y*s.sy-24*arc;angle=-12*arc;
      }
      stats.anchorX=x;
      if(tip.style.display!=='')tip.style.display='';tip.style.opacity=turning?`${1-.22*Math.sin(Math.PI*turnElapsed/turnDuration)}`:'1';
      tip.setAttribute('transform',`translate(${x} ${y}) rotate(${angle})`);loadedTip.setAttribute('fill',color(liveColor(cursor)));
      stats.frontier=frontier;stats.nib={x,y,angle,width:50,coreWidth:1.25,drawing:!turning};stats.wetTrail={start:firstLine*lineSeconds,end:cursor,points:visible.length,persistent:true};
    }
    function composeRaster(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,side,side);for(const c of caches)ctx.drawImage(c,0,0);stats.rasterFrames++;stats.forcedRasterFrames++;stats.rasterPainted=records.length;stats.rasterProgress=1;cacheReady=true;}
    function prepareRaster(budget=6,publish=true){
      if(rasterWorker){
        if(budget!==Infinity){warmWorker();return;}
        // Immediate hidden/reduced-motion completion cannot await a worker.
        // Rebuild deterministically only on this exceptional finish path.
        fallbackRaster();stopWarming();
      }
      const start=performance.now();
      if(!cachePainted){cached[0].setTransform(side/WORLD,0,0,side/WORLD,0,0);paper(cached[0],scene);cached[0].setTransform(1,0,0,1,0,0);publishLayer(ctx,caches[0]);}
      do{if(cachePainted>=records.length)break;const stroke=records[cachePainted++].stroke,layer=cached[stroke.layer];layer.setTransform(side/WORLD,0,0,side/WORLD,0,0);drawStroke(layer,scene,stroke);layer.setTransform(1,0,0,1,0,0);publishLayer(ctx,caches[stroke.layer]);warmedSeconds+=stroke.sourceEnd-stroke.sourceStart;}while(cachePainted<records.length&&performance.now()-start<budget);
      if(publish&&cachePainted===records.length&&!cacheReady)composeRaster();
    }
    function screenTerrain(p){const size=Math.min(box.width,box.height);return {x:(box.width-size)/2+p.x/WORLD*size,y:(box.height-size)/2+p.y/WORLD*size};}
    function manuscriptPoint(r,p){const rows=Math.max(1,scene.slots.length),rowH=860/rows;return screenTerrain({x:100+880*clamp((r.stroke.slotStart+p.t-r.stroke.sourceStart)/SLOT_SECONDS,0,1),y:110+(r.stroke.slot+.5)*rowH+(.5-normalized(p.v,r.stroke.transform.domain.min,r.stroke.transform.domain.max))*Math.min(34,rowH*.72)});}
    function prepareReconstruction(){
      for(const r of records){
        // Reconstruction keeps every measured knot. Split only the live
        // presentation at paper seams and the current cursor, so a turn never
        // draws a diagonal from one row's right edge to the next row's left.
        const knots=r.revealKnots||revealKnots(r.stroke);
        const projected=(p,line)=>({t:p.t,v:p.v,from:manuscriptPoint(r,p),to:screenTerrain(p),live:paperPoint(r,p,line)});
        const at=t=>{
          let lo=0,hi=knots.length-1;
          while(hi-lo>1){const mid=(lo+hi)>>1;if(knots[mid].t<=t)lo=mid;else hi=mid;}
          const a=knots[lo],b=knots[hi],u=b.t>a.t?clamp((t-a.t)/(b.t-a.t),0,1):0;
          return {t,v:liveFrontier(r,(t-r.stroke.sourceStart)/(r.stroke.sourceEnd-r.stroke.sourceStart)).v,x:mix(a.x,b.x,u),y:mix(a.y,b.y,u)};
        };
        r.revealColor=pigment(scene,r.stroke,.5);r.liveColor=liveColor((r.start+r.end)/2);
        r.fragments=[];
        const cuts=[r.start,r.end];
        for(let line=Math.floor(r.start/lineSeconds)+1;line*lineSeconds<r.end-1e-8;line++)cuts.push(line*lineSeconds);
        if(cursor>r.start+1e-8&&cursor<r.end-1e-8)cuts.push(cursor);
        cuts.sort((a,b)=>a-b);
        for(let i=1;i<cuts.length;i++){
          const start=cuts[i-1],end=cuts[i];if(end-start<1e-8)continue;
          const line=Math.floor((start+end)/2/lineSeconds),a=r.stroke.sourceStart+start-r.start,b=r.stroke.sourceStart+end-r.start;
          const nodes=[at(a),...knots.filter(p=>p.t>a+1e-8&&p.t<b-1e-8),at(b)].map(p=>projected(p,line));
          const wasVisible=end<=cursor+1e-8&&line>=writingLine-1&&line<=writingLine;
          const core=svgNode('path'),wash=svgNode('path');
          core.setAttribute('class','landscape-reveal-core');core.dataset.strokeIndex=r.index;core.dataset.lineIndex=line;core.dataset.fragmentIndex=r.fragments.length;core.setAttribute('fill','none');core.setAttribute('stroke',color(r.liveColor));
          wash.setAttribute('class','landscape-reveal-wash');wash.setAttribute('fill',color(r.liveColor,.16));reconstruction.append(wash,core);
          r.fragments.push({nodes,wasVisible,initialOpacity:line===writingLine-1&&turning?1-smooth(turnElapsed/turnDuration):1,core,wash,widths:nodes.map(p=>2+3*materialField(r.stroke.material.grainSeed,p.t*12,53101))});
        }
      }
    }
    function revealFrame(){
      ink.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);trace.style.display='none';reconstruction.style.display='';hideBrush();
      const pull=clamp(revealElapsed/1800,0,1),morph=smooth(clamp((revealElapsed-1800)/3000,0,1)),dry=cacheReady?smooth(clamp((revealElapsed-4800)/1000,0,1)):0;
      const ease=smooth(pull);stats.mode=pull<1?'pullback':'reconstructing';stats.morphProgress=morph;stats.revealSamples=[];
      // Retain the exact live clipping at Finish, then open the sheet quickly.
      // Masking every reconstructed source path for the full pullback forces
      // WebKit to rasterize a large offscreen layer on every frame.
      if(revealElapsed<180){placePaperWindow(smooth(revealElapsed/180));reconstruction.setAttribute('mask',`url(#${paperMask.id})`);}else reconstruction.removeAttribute('mask');
      emergence.style.opacity=`${ambientOpacity*(1-ease)}`;stats.emergence.opacity=ambientOpacity*(1-ease);
      const position=(p,visible)=>pull<1&&visible?{x:mix(p.live.x,p.from.x,ease),y:mix(p.live.y,p.from.y,ease)}:{x:mix(p.from.x,p.to.x,morph),y:mix(p.from.y,p.to.y,morph)};
      for(const r of records){
        for(const [fragmentIndex,fragment]of r.fragments.entries()){
          const nodes=fragment.nodes.map(p=>position(p,fragment.wasVisible));
          fragment.core.setAttribute('d',path(nodes));fragment.core.style.opacity=`${(fragment.wasVisible?mix(fragment.initialOpacity,1,ease):ease)*(1-dry)}`;
          fragment.core.setAttribute('stroke',color(r.liveColor.map((v,i)=>mix(v,r.revealColor[i],morph))));
          const wash=nodes.map((p,i)=>({x:p.x,y:p.y+fragment.widths[i]})).reverse();
          fragment.wash.setAttribute('d',path([...nodes,...wash])+'Z');fragment.wash.style.opacity=`${(fragment.wasVisible?mix(fragment.initialOpacity,1,ease):ease)*(1-dry)}`;
          if(stats.revealSamples.length<3&&nodes.length>3){const pointIndex=Math.floor(nodes.length/2),p=fragment.nodes[pointIndex];stats.revealSamples.push({strokeIndex:r.index,fragmentIndex,pointIndex,t:p.t,v:p.v,from:p.from,to:p.to,current:nodes[pointIndex]});}
        }

      }
      stage.style.opacity=cacheReady?`${smooth(clamp((morph-.30)/.70,0,1))}`:'0';
    }
    function settle(){
      win.cancelAnimationFrame(frame);frame=0;last=0;
      if(!cacheReady)prepareRaster(Infinity);
      if(rasterWorker){stopWorker();workerMaterials=0;stats.workerMaterialPixels=0;stats.cachedPixels=side*side+ambientSide*ambientSide*2+INK_SIDE*INK_SIDE+3;}
      finished=true;revealing=false;finishing=false;painted=records.length;progress=0;cursor=total;
      stats.mode='finished';stats.finished=true;stats.revealing=false;stats.active=false;stats.painted=painted;stats.morphProgress=1;stats.progress=0;hideBrush();
      emergence.style.opacity='0';stats.emergence.opacity=0;ambientAnimating=false;stats.emergence.animating=false;hideDiscovery();
      trace.style.display='none';reconstruction.style.display='none';stage.style.opacity='1';ink.setAttribute('hidden','');
      const done=resolveFinish;resolveFinish=null;done?.(scene);
    }
    function schedule(){if(!disposed&&!paused&&!doc.hidden&&!finished&&!frame&&(revealing||cursor<total||ambientNeedsFrame()||captionElapsed<6000))frame=win.requestAnimationFrame(tick);}
    function tick(now){
      frame=0;if(disposed||paused||doc.hidden||finished){last=0;return;}
      const begin=performance.now(),delta=last?clamp(now-last,0,64):1000/60;last=now;stats.frames++;stats.active=true;
      if(revealing){
        if(!cacheReady)prepareRaster();
        revealElapsed+=delta;revealFrame();if(revealElapsed>=5800&&cacheReady)settle();
      }else{
        // Preserve a steady brush speed even after delayed frames or source
        // windows. Never rush through buffered pulse data to catch up.
        if(turning){
          turnElapsed=Math.min(turnDuration,turnElapsed+Math.min(delta,1000/30));
          if(turnElapsed===turnDuration){writingLine++;turning=false;turnElapsed=0;}
        }else{
          const lineEnd=(writingLine+1)*lineSeconds;
          cursor=Math.min(total,lineEnd,cursor+Math.min(delta,1000/30)/1000);
          if(cursor>=lineEnd&&total>lineEnd+1e-8){turning=true;turnElapsed=0;}
        }
        emergenceFrame(delta);captureFrame();stats.rasterSkipped++;if(cursor>=total&&!ambientNeedsFrame()&&captionElapsed>=6000){stats.active=false;last=0;}
      }
      stats.frameMs=performance.now()-begin;schedule();
    }
    function resize(){
      const rect=container.getBoundingClientRect(),previous=box,next={width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
      if(Math.abs(next.width-previous.width)<.01&&Math.abs(next.height-previous.height)<.01)return;
      box=next;
      const size=Math.min(box.width,box.height);stage.style.width=stage.style.height=`${size}px`;stage.style.transform=`translate3d(${(box.width-size)/2}px,${(box.height-size)/2}px,0)`;stats.camera={...camera};
      placeEmergence();placePaperWindow();
      if(revealing){
        // Browser chrome and rotation may resize the paper during the reveal.
        // Reproject its coordinates without skipping the animation.
        for(const r of records)for(const p of r.fragments.flatMap(fragment=>fragment.nodes)){
          p.live={x:p.live.x*box.width/previous.width,y:p.live.y*box.height/previous.height};
          p.from=manuscriptPoint(r,p);
          const oldSize=Math.min(previous.width,previous.height);
          p.to=screenTerrain({x:(p.to.x-(previous.width-oldSize)/2)*WORLD/oldSize,y:(p.to.y-(previous.height-oldSize)/2)*WORLD/oldSize});
        }
        revealFrame();return;
      }
      if(!finished)captureFrame();
    }
    const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(container);
    function sync(){
      if(disposed||finished)return;refreshRecords();if(paused)return;
      warmNext();
      if(reduced){cursor=total;writingLine=Math.max(0,Math.ceil(total/lineSeconds)-1);turning=false;turnElapsed=0;if(ambientAnimating)completeEmergence();captureFrame();hideBrush();schedule();return;}
      captureFrame();schedule();
    }
    function finish(){
      if(disposed||finished)return Promise.resolve(scene);if(finishPromise)return finishPromise;
      stopWarming();
      pendingAmbient?.bitmap?.close();pendingAmbient=null;
      resize();
      finishPromise=new Promise(resolve=>resolveFinish=resolve);paused=false;refreshRecords();
      hideDiscovery();ambientAnimating=false;stats.emergence.animating=false;
      if(reduced||doc.hidden||!records.length){settle();return finishPromise;}
      // Finish never rewrites source or spends minutes draining accepted data.
      // The captured part starts in place; all retained knots enter the overview.
      finishing=true;revealing=true;stats.revealing=true;stats.mode='pullback';revealElapsed=0;last=0;prepareReconstruction();revealFrame();schedule();return finishPromise;
    }
    function cancelFinish(){if(disposed)return;stopWarming();win.cancelAnimationFrame(frame);frame=0;refreshRecords();settle();}
    function pause(value){paused=!!value;stats.active=false;if(paused){stopWarming();holdWorkerWatchdog();win.cancelAnimationFrame(frame);frame=0;last=0;hideBrush();}else if(revealing)schedule();else sync();}
    function visibility(){if(doc.hidden){stopWarming();holdWorkerWatchdog();win.cancelAnimationFrame(frame);frame=0;last=0;stats.active=false;hideBrush();if(revealing)cancelFinish();}else sync();}
    function motionChanged(event){reduced=!!event.matches;win.cancelAnimationFrame(frame);frame=0;last=0;if(reduced&&revealing)cancelFinish();else sync();}
    doc.addEventListener('visibilitychange',visibility);motion?.addEventListener?.('change',motionChanged);
    function dispose(){if(disposed)return;disposed=true;stopWarming();stopWorker();win.cancelAnimationFrame(frame);observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);motion?.removeEventListener?.('change',motionChanged);stage.remove();ink.remove();emergence.remove();discovery.remove();for(const item of [canvas,...caches,...ambient,ambientGrain])item.width=item.height=1;for(const r of records)r.revealKnots=null;stats.revealKnotCount=0;stats.revealKnotDataBytes=0;ambientAnimating=false;hideDiscovery();stats.emergence.animating=false;stats.emergence.opacity=0;stats.active=false;stats.revealing=false;stats.nib=null;stats.frontier=null;stats.liveMaskPixelEstimate=0;stats.cachedPixels=7;stats.liveTexturePixels=0;const done=resolveFinish;resolveFinish=null;done?.(scene);}
    resize();sync();return {sync,pause,finish,cancelFinish,dispose,canvas,get scene(){return scene;}};
  }  // Fixed 256×256 monochrome pigment material. See docs/design/materials/pigment-grain.md.
  const PIGMENT_GRAIN_BASE64='oMWywqenq1Rhh4tdp7KEfGm4TGF4OY9pVEykRy5HTBpxeG1tdaCEuLWEkrKAj6eHuNxpaXWPYTRHpK6HfFB4h494nWGAtYBQkot8rryggL+SnXydgHGScXWPlq6AR11hUISHhIt4kpJlfGFhgIApgHGWkqSrj3GE0rWAp8LM1tK1z6CkvN+/rnyPwnzm5sWgj+bWxZmdv11xloCHaVlULj4+WS4aTHxMWT5llml4WRp8XVlUfBpMaVQ5XZJtXRpHWVlxZZKAdYCHRyIaVFltUHFlR6SWuIeWz6uumYSnsq6dWZakq3i1sq6SZaenrqSAmbyPpHx1fG2PkpmHnXFdcYeyuLLSpK51XaSLdYBlaXxlZXU5IlSPXRopTHyPfG1dcYBxdUxtacWnrqSSxcnm5ubmpIuLgIBpeJ2roIBddaerZWVxdZKSv66rnZmkq3iykoekq5aEdXyHmXiHbXh8h51pND6gknhhfJJMbXhZdWFUYW2HgJaWsuarnYSWydJ1sryEdWXPvLyExdnF2ebFi4+14tmEdYePnYSAfDRMTEN1aUxUR1lQgDlxpISLXTllQ1ltgISZcVA5VIunj0eAoHy4fJlpdXx8YWltNHGkfDllXXFpmaugj7K4tbWup5KSlodxgJllsrVlgISPna6PuNbiuIRtXYR4nVlZWY9pcWWEtcyZpICrmXiEbV14eJ2LbXFdLkw0aXU5GjlQbW14oI98oJaknaeklp2HlsW11snMroCkkmmEj5adcaBhi3yknS6EnYCWlouAhIeglouHp5mnoKuri3V4hI+HmZlthHGki3g+WXVUYUNteI+PNCJUaXV4gHV8krLFq8y1abKnj5m1pKR8lpaWeNLFpL/Fxb+1vMXCkrKLkp2AlnhUeI9hLlBhi11dWYdthLWyxWFDXWVpaWWEklBxgFSEgJJxgHiEnb+/hHVhXYdQYRo+WW1dhHiLtbKruLjPvKCgq4eZmad1mZ2yh6CrhI98kqCypObmzKTWnXx1aWldYWFhWWWLloCroISZzLyShHVhi3x1fHFDR2mEaUeZh3FHWWl1fHyLgIedpJaWnWG4wqeShI/Wda68q2WdoM+4tYuPj4S4q3Flp6uZi49tTFCHp4CEpLzcuMKSbZ2dkmVphLyPj4tUkpaWZVlZGikaTISPlm1hR2VMeHGAh2GSmYeEcYuSj66dhIeWxXh1dcyHuNK8cZa8q8XClo+ui4B8mZZtfJJxcVldZXVDR2FtgHx4eHGAhFRlZWFhR0yHfIRMcYSEfDl8louylo94fGV4i5J4bT4pdXWHmZ1xlpaA36SZq7JpwouHktbSydm/gJm1wouHcc/WrqSdp3F8kmU+VFmWknx4ZYRlfIe81quAcaCZfHiWZWFtZTRxbSkpWXWSWRoaaT5UpId8rot1hF11i4u1bc+8pJJQh7gah5mHR21hh4Tiq7yWq3VHbWGdp6eLlm2LbZKPnauAq6ekaUx8q5JheHyglo+Wsot1TGGEbV24gGFHfHWAoGW4gLKPkpaEeGVphHiZQ0x8wrLZi6vfoLKrp4udoLji2cKui66keIt1fGFtZXVhfJKLTExtbYBxlqddQz5xIo9HUFRpPoCHhFCkh0OypJJxi6CrmclZGmGAoFkaklmHp5mdpKtxpJmEloSSfHV4hLK/2biHhHFxoLXClovJrqDFv8yEbbyEoFkiGnWSeId8eHyEnaSLj66HnaCSgGlULl1ZbXUuGjRDUGV8j2GLtW1DccKZVIDSv6unrr/JkmlHXXGkvNm42eZQaae1taRxmauAfHWEWZZ4mbKHcYCHnY+Ej0NlloBlcXWAZRqAhHFQgD51ZWVZNFBHWVBUfG2ZuJaSv6eLcYCdp3xZZWF8j5mPj4euz7igzHidhJaPkqSWssLFtYSSwqR8eEc0ZW1xR0OLnVR4lnGui1kuWYR4nXh4bVRldZllkkdpmZmZsoddPlmkta6WaWUpYWEiZWFpfKSPXUyEhGGPmZmkj6SPoJmZgIePteLCxdnmp+bZz8/ip4eAbZKSfFRZNBoaPmlthKSSfICgoMLJp52PcVldTDlMoHU+Q1BhYYSPdY91lnVpdYC1oJakxd+ddZmrsniguIegv7zPyZnmTL+/uIdZcZKHi4RZOVRtdZ2gq6CEeJm1p6SHmaegfHiPgGFlhJaHcYtHdXh8eFBli11MKXFhh3yEj7WLh21leIeSeHxdh4eEvK6HmcXMWb+4gJJ8i3y4h6e1rrKgsry/h4eAaXhQbWVdfGWAkoB1hGF8YWFZPot8RzlQZa6deHxDdYCZcZKktYCklouSkod8cV2AmbyAWW2rkniPZXVtZYeSkpKAfIurpIeZq7zCvMnCkny/vLjS4qSLcXiPcXVlR0N4gGVQcXyZh21poLi/q9Krh4RUcV1ZeIRhcYBlaXxhhKegaauHnXWHya6nadynxbyyvK4+3I+dcbzPzNmryXGPq6CLj4e1h66gi4u1koSAh2F8cZKSdbWroK6Ep4tlnYdhYXGAj4ePh3yLhG2HPkN4hHiPcYedoKCEbWW/i4+rrrhlZYurzL+AeGXC2Xik2auulpLMuJbMknjCwr+Ah4+WdW2ZaXh1TISLvLWZcXFpZYRxj4euXUdlh2F4nXyPgGVdpKCWnZaHeHVpVEN8h2VQUFlMh4BxXXiHnXxtcWVpdXyPpKCnkpaPlqSyv8K/5oudoKSroLyWq6dtgHF1fG2HmS5ZOWl8dXxphICHpI+EoLVhcYDZkoBtZXyWPmmWkpKHnXh8v5ltxc/C5tKS1rjMsrWZKebmxb+1h7XPuMWrxZZxlpmEeJmkj491kqerlmmZ0qCEq52ywqSPNEPWtXFlGlRQhItlXZakGhoamWE5aXyZnYCSuI/Fi7Wgh6R8gISngHyPz7WWydy/5tarkpm4v9mkdWFh5tLf2d/mfKC1rnhxbV21j2lpi7yShJKHTENHnZJ8pFRQcXWAh3ySllSurr9pnXxxXaSAgDl8R22gyVSLPkyni3FxlqSLhHiZi3E0dXGSgIvCoLKSsnzC0uK1q52Emb+y2b/mtaedYRqHdW1xR100UFl1gISSp4uSdY+rcWGSpKCSOVCgi65HcZJUmZaSlmllZXyWh9/mz+K1gL+k0ubm5rXMgKeAoF1dltKSVJK/i6SWi118TG2grsmukoeSpIR8bZ3Mq8KuaXhZeJ2uj3ygj0M0TGWEhJ1DGl2geD5UpKSgkkMaLpadcXyZro+LeJm/q6uLq3iHuK6rfIt1p4SETF3W5ubcz8WdmbW1lmGZi52dfGmAq6R1cYt1dZ2LeG2LeENxlpKSpKC/ZWl1oLyucVlQGmFxj2lHZXhUaWmLaZZ8UGFHfKd4llRdQ4d8XXikkoS4zJaWrrji1rxUUIfmyaS1i0xMeIeLeIBQYV1xVHWgloePnVSWnXVdgM+/pHxUh7WZgF2PeHh4eFlpgG14fHW4zHyLpKe1q6Cgxby/ydK8vISguHyPlqd8nYR1v53FhG2Ph6S/pI+Wh6SHq3i1gJKLZZmnmYCgj5ZpWXyPj2FQfHiZq4BQZaBpR0dZbZJ8dZmAkpZ4WW2Wq4+ZeFRtp66kh6SnhICSnb+4p4+Ei4t1rrySmcmuj5KunZmPfIuZnYdhZXVpQ66WgIS4knw+XaSAgKuPh5mPgHF1tdZli3VhXZmPcVRxnZZZcZ2gi3F8eGU+WWlxdWVpYW14q66Wrrx1kp3FvI+nroeEi2mkwqCdlqdhdUw0XYRZcWFhTFmPhF1ZZYRMksmAbZaLhHiSrpKyfEwaYXiPYXFxZXidbZKdhLVUkrLfxaenvLXPv8mZj5akaYS8v7W4bbyktea1p4uScXGStYdpdZJpkoCZyY+goFmAgG1xfF1hVD5xi3FUq2kpIik5bYSyVFB1fHyWbYuZj4d1eI+Zlpa4eJJ8vLy4q4CLmZ2ZpIfJzJJtaXVteKunp4CWnZaSvLLPyYuAcXV4WVB8gF18j4d1cYC4q6BQWXFdfKuEp9mAj7+kj6uPaVSdknVDQ4CguNnMq4B4hGmAnY9xdYeLgJKPgHyAtbjZi3ynv7iZlpanmXxUfKCPcXx1knhZR2WLYY9QVId1dY+AVG1pVC5xZXF4YWldj7idnaSnYaRhcV00lpaSyaSkpIthdUdUbdKgq+bcoJa4v+akj114tYvm5snmsr/SqzRpq6SZhJaSlpJpUKS1j6dHfISHgKCkfId4dYRpTEx8ko9hi4R1bWWSUEdhPiKHcVmEcYSrkouPtZaSpLKLz5l1j6CP3Jm4oKSkv5mAoKR8fHhxfGFhq6ePnclxj4QiLp1xGpIaVEyAvItleLV8rnFhR4+uuExUoNLWp4uWZWWAgKuyj1AaXXxM0ubJuIeAcZJxklRxUBpxXW11oKCEhLKdi6CPpIeSj3iPtYCWpJKWfHhMcW2PXUMuR2UiKSJhR0N4YXVtTFmZq1l4j53JpJagcXVpQ6BlVEyEKXxMXaeHfFlMlt/maWmZdavP3ITJuN/SYWGSq49dkubm5qTmlrigyZnPksWnv5JZp51thG2ZeDRZi1CEpIAaabh1XVRxgENhGl1deGFxeHidrniEWWWHj3GZmY+gGmmSVFCWnbzCcaCElnideIRpfGF8j4tlfIdDQ3htGquumYvJmTlDh5KgdWVUdYBhi3g+dWmufFCknVmLdVSZp0ySv66ywnVlR4SPaRphXZaEkoTMpMKkso+dvMJ1TEdph3hpXVRloHGgnbinmXh4hI+kxXWHloRZbYeWcebS2YRxUFRthIdDcTlhQ1lhUGFlfIBU0pKHj4dxh21tUFCkgGFZaZ2SnY+Hkm2Wksnmv3iE5rV4vObMvL+8rquPq66ytdzmpMW1wqeZlqSgtdanh3iSq4RhdYthfHWLnaeLaXFtgD4aUHGHcV11ZWWLpHFdhJaHkilhPi45UJl8j3V4gG1tcYd4xdKyvKeLcZ2WkpmLoHxdeHV8vIuWoHhdhLLWwpmkgKeEgJauXWlxkkNhaY98fJZMYWW8kpZ1p4+Ev6S4nauEZaBxfG0pGl1pnZJdGlR4aZm1mY+ZdZ14fHxdfHVUXXVhloSEoKdtbYuLpJadtXxZXZmWbZ11rm3m1ng+Pkx4lmVUVF11ZVldYVmPkq6dpKCEgKCnj49hfI9lhHGrh3yki52LfGVUYebm5tKuycnSlj7PoJKrgGGSi5aWpJKupJ2gcV2ErszSz4CLgIeLgMKWmZmdoJm1lmVQi3xpYVlhVGlhNGFMYVBHaYB4Pm1QYUc0ZYCgQ1CkuKBpYW2Hh4ddVHGnj4+WaW2ApJaLgJ2ZgKe1j66EfOZlaW2ZtauknV2Sj4SkhICEeHh4xaBxQ3hxhKSPma6LtYeAv3yrmaSEgHVxaXFMKRqLsrxtPjRZbWVlcXVtp6eWi4BlXZJ8hKuLdTSSaZadq4eAbYSLsqRpcXFpcYeHkoddXY+SmWmAdaSSdWlhgEwpVGE+knGLgI+SeHiymZagaZKPdYB8lnF1j3iZfK54h4/i5uagNEyZq21tnXhpbZmHfIuZmW2LfLykgGV8rsnMvMlth3iylq6Hq6egj4SgmYBMQ3FpeG14fGFMIjQuWXF4j3xpaV2PWVR4XXWPklRhoMzJi3xDfFRQgHiEi5ZlaXyPkoSkj21MdYeWpJl8taTCz6SLltmkoJZhcXGdi4ttbYeZp7WukmFUnbKSi6Ckq8xHeKSSwr+ukp2HjzRDYYBhhKRMGmmAbWFdUG2PXaBdXWGLi6CWp6Sdh2WHh5aSgIuSj49ZlpaAUIB4WWV1hHGEkpJ8bVCSh2WEnY9UWYSki4Rpj8LZoF2LhI98Lm1laUNtXae8hKfFslCZp7+unWVUUM/PoKSunZaWi2EuRyllmbWglpl8hIC4ya54cXh8fHzFVGFDj1R4h7KnZW1twta8vICkknGHWaRMQzSEaWVxUEwaR3GreFRhfEd8pHxxgFCAi1CAvJ3PnZlZXSmkNI+naWXWlnGAmW2SkoeWcY+r2aS/loCPkpmWfHFxXV1lknWWvJ2HeIeWoIeLoJI5mcXmnZltyearUF2dcVB4bXWAfI8aPou1loQ5OS6Lp3FpUHGEZbKStYR4smm4bUdhgHGZeF3CR3xxUEwaTIBhrrzFoItMWWXFstaWVHxDVLKnfHW1q1CEkqeScYu8q518nXyHfIugyV2LgJanbaC8Q4CAp7LPv6B4p4+Eh3V4WWlpUG2SeGGPi3iAlrWSrsW8wo+Sv4BdfKBDgI+WllRMbUw+R3Gdkod8R6tteJlQGkeATF11YW1ZYXiAXa58ZT5dbXGLp3ygaaCrvJ2LdXxhbWGWeIdpmWlQaXGLlqdxfFmLhKSWpG1tpHGHj1SSZXVxgJ3Srq6Zp4tti5K4uJaSfIDP0kM5bZLJh4tdeIR1nUdlhId4eFSE31lQTIdpmaCLcXxxnZJ4dV1MnaCglkMahId8yaBhXWV1ZV1DUGl8pI+HeG1ZXWWWsrySdW0+aWWgZXxpfJakh6SnnWF1aVmgbYRhcXWZvLJti5andZmdsoe8q7jZrpaWlo91fGV4q52AVD54hGVhbVSAlmVxsrWgXZKAoJ280ml8ssy/nWVxknWkkoCHeHhHnZ18i3VxgGVUgHWPkoeEWVlMeG2/nYtMbWl1p6C8vISSh52WtUxpfG2PgGmHnUNtaXiWp6SPWXGLdYt4hIeEQ2VxaW2HcYSSi221xa6nmZKSh4CSj7Krh4tHuKdpVFSgwoBtbYd8gJ1UaaCHWaR8hKeEeG2SuId4aUdpYXiLq654ZVCZkqvMj3WZlp2WdUNZXUNUPl1ZZaeLYXiPdXyHp7iSaVl1hGlthJlpcZmuxad1h4SWrpKAnT5dbVCdrnWEaXh1gDmEj7Kn4uLmyZKHpLiPsmGAj3V4eId8ZWF4VI9tj4dMXY+Ph5muq5akltLFcbikoIuZcYSPeJKEmZZxVFkuLo94YYt8eGVdZVBlj5mki0yAj3GEgICHbZmWh4B8kouSma6WQ11lhFBQXXVHPi5pkq5pXYB4j5KkXXGSoItxYWWEi2F8j3xlj52rpKCEpLKgq6Cy4syneD5xkrhUrpmSaWmHjz7Fv2WWh22PhG18fGVtj491gL+SgHVph7LSTBptroBpq6BlkqSSgFlxcV1ZVDlZVHGHj3hUXaCHhKuWnVmZoI9MaYuHIlmWmZ2deHWAsqurtYCHhJlxj3GLv5agmYBdkqunq5nZ37/mpJmAfMWngGVdPlBloJJMZYB8p5mEeHiAq65tlqeEq8XCtXFdhFkihI94cXiHj2GgPjlxNEd1hF1ZgIt4WVBDeGVMkoCAv1mglnhtaWlxv6uPbaR1kod1cXGLeDQ+aYRpGhqdoK5ph4uAUG2AfJ0uYXWgcW2AgKQaca6neHWAj7Kntdyywo+goMzFv4dMdY/SOcl4XUwpTDQpv7+PdY+gi6tdh0dljzRZcXzfxcKEfI+/xYc5Q7WnpJKWgJ2ndWGrh3F1fHV4TGl4h6C4ZRpDeISLpKCgq52/koSHksx1aZZxlryHloBMpKQacau11qRtYZl1ZVRHi+bioHx8xae/v4SLaYCEbVkiGlSZmZaPh1llvKdtZZZ1fKA0WZarnWXfrr+Zh2lUYcLFp79tcWmSWZZdR5KAkiIaOTl1WTRxVEwueFm4q9ZHOY+1fKuHUJltTGFMpHineLiHVHFZZW1HGpanhJK/TIB8ZZarh3GPdW1hfFQ0TFRhXV2SktKdaV3J5uadi5aErqSEcXWWRyJdkoCProspfIek1qu1nXWkcat4YTkpi1RDLkxpteagZWEacbW4uEdUfMKdfJ2AeDlHmcLCZVBlPmFpVGl4oHFlQ12PcTSLxeaSGil8aZ2ukmVlgKvSuJ2AgJKHWaSgh3i4bXGZq6R8h7KPcZmLncK1oHiSj4eElnxpLo+Lq2lUVExUaaereHyAv8XCmVTJvKTCp6vfwp2HhLW/mY+yoK6ZdWWAi3W/Q1lttWVUZXhlfHydnZKdi7WulmV4eIC4oLJ1eD5pgK6kYXyEnYRxYXFdTF18dUNZPoBdR0d8YWlhdY+yq6SSTHynvICEfICPj3yEj8+rsqCrp7yPbXGLi5JdfG2Eh8KWkoSnssWSj6CguHGHoIePbXidZWVZq7iyuIuZaZZ8ko+dgLygp6DCoFmgkqCZdY+1rmWyllRxbW2Ah4SZkm1tcbKnlnGWnYd1VICLrnGWpJ1ZvL+EfKuyoIuPhJJpPl2kls/ceG1hfHyWq5ZUh7LMeIBZIlRDVHhpZW2EXXydpJmuoKSAi4uki4+uvLiki898i6Cn36dpgLWSlpmHp7yEfFBdfLxHPi5thLySnWmEaXGZrtKnmW2Ai3yEi514h6R8j3ySZYCEkmlMTGVQLm1ZXVRdaWVpWXV8dY9phGlpeG1xfHF8R2F4pHFlfJKAuMm8h9nmv5JlYaencW1UlnV4h6Tm5qSSpIuWsszMnbinrlQpYWlxYXVhhKSZq22PmZlxv7irbZaSwqtlj3xleHWdv6eAnauWhHFDh4+AhIRlkl1ZbWWHkmFtaWltdZJxp8/Clq6gi22ysnxpVFRUR21xnYSup2Ftcb8paY+yj5J1bUNhaZmPlpZ1h8WSlnhZgHF1oIt4j4BttZadoMyPhKvMuJmri7yPfJmnh5Kyi3ydeG00WWFdXWVpZWFpYYugPlmulnGHp3V1YXGSmcw5WXVhVHV8h8KkknF4ZVQaVHVhQxoaGkxhaT5MaWmHQ3FtYUyAeD6rWWVlXY9tQ5Zxda64h5Lm3L+dfJJ1h3FHWTlQdW2E4ryWdXWEsrjFXYeWp5ZtcXigWXVpeHyLeKekZYB1Zbiup6CdcY+nYbJxYYedi6d8WY+Lj6SWZXGSYW1QeFSkR4t8nbKgXXF8aXhxddakoExhXVCZoItMLkw+ca5lTBp8gD54pJadXTmgnaCnq4ddbYugmYuPnbKPGnE5cVBZpHVpYZbWnaCWkri/hG14XZKZq6uZyd/ch7iLlot1fGVMaVmrls/Mh2GgfKurltyPq4eHndaPfGmSLj6neGVxhIuSgK6nkl14LkMuloSWLhoakjRMWYQ+GkxUXYSHYXFhj6Cg0j5dhLiubWWLhHjP5uaZxZk+OV1hllSkXT5MaXEpYdynoLWEWZnMgHxlgIenhHiEcbiEccmgoI9pXYc0oKSAZaCZtW2gi4B8dYeWmY+PhGFMbW2Lh6t1nZ11VDnFaXiAfHWSq3UieF1hTHVhhJKEgFldWVk+gJJMTG1QZWW/mZLMq3GEdXiLfGmZnY+SZWFHhHyHZVBxYW1lXW18j52dcZaLfKdQloSEdYuWko+dlqeAsqCknXirxbXJi21xoHWdz4Rlh5KAlp3C1p3JnYBZcZ2dGmFxeHGdp5LCjyJQi5lpcYt1YcJDfGFteExtZUcukm1QNEx8mYSdbWFdbW1pdaSEkpKAeIedeHx4rsLmz7zmsrLmpIBxeJJxZXhdeOa4q6C4uKu1j4d4VIe8pKBpbVlheF2noIs5bXGZi6vFtauWbT6Wtb+yj0yPfGk0dZ2Lj22HgJJ1eJmnR1lxtauHeGGWkpagdWVQYWG1aZl1cYdtcYedXWFxcWVQj7Kgh21dZZJ4fHGElqR4kqudlpaHaYSPh22Sh3WAbWF8j3jFloeumZKZeISkuLWyv67SrtyumbKLoHirv7iuj214h4SE5s+AWZKk0rWZp9bM0sWnfI+ZmWEph21dj4+HgId1eKSrnYd1hISgmT4pdVB4q4ePIkNZWT54cT45eExUcYRlgKegss+4vJJ4so+1lpK/5syPrubm5tmAWV1lWXFDZYvMsm18maTfq4C8eG2HgHGgmZKW1parsrKnlqSLgJaLkourpJKZxWmAv7Kup505YbzCnZJtj0yLeJKnfEOPi2Wukp2yh3yElnF4j3iAbVSAh4d4j6R1iyltTKB8WXyAR0dpq3hlYXFZXWV1pI+ZdYungHFlTF1MaW1xeHhtj3WLv668YYuPcZKAgKCrta64p6eWgKSylp14nXWdkq58lq6Ency/mZKrmYt8i4Cdz9zFnUenq6CPcZ14cVmLj2Fdh21Zj4RxTFl1pI9dOTQ0gIB1fGllloRMaW1lbXxdVIuAXV2PgJ24oGWgnaSdbYTCvObFxczM5uK/hNJlaVQ+YZmHh7xxktKZ5ocucYuWfJKAi5Zlna5ph3GHj66nTLyZWSK1ro+Ph5llYc+WoJ2AgGWAbXVdbYRpaVB1i5l4loRhloeytXFHWW1hXVR8ksI+XYe1ZV2SgDk0PmFxh6uZoL9teISugHxhdW1ZeKB1lnFMfICHoFlhQ2E+WZ2kkkdQeJLCVKSLR3ySpKCHWW2rpIvCrsySvKePv7W4nZ2up22Lq4erj6erxauWpMWdj4fmna4alo+/hK6ycV1MYWVxOXw+bXUalkN4YY85WRouXYR4cYQaGkxhslSLkhoabZJtoGGAlpaglpK8p7yHneanmaDZxbK4ybW/eHFUhGFpZT5ldXHPsuKkpLxheCmnXYRZR2WnoMyrh798lnhpj7yuYXiZVKRUZVTZ5qQibUdQlpmdpGVUeIR1dVCEaUxZkm2SOXxZfI9Ui3WkeKCLaYR8R3WdmZl4j5J4vIuSbXjfq9l8uICHlnUuncnMq3x1OXzPj52yh5aPeFmrh4SAeIR1fC4iVGGAVG1dcYCAv4BQgJJ4q8W4hDSPWYR1tZKEj221zLiZzLjmrqeLfLXSoIBhfHG85qvFsp2khFSZLkeAhIfmYW1hfFRlYXw+GlA+NGmEaTRHmebm0nU0dYBlbT6P0m2dnbyntZ1twsKLmdzJ5nxhZea/3Na4tYenq0x8dbjFh3yAh3G1XXyk2ae85oe1nXhdYYenhKeLwua1rqCZ5uaPGtZxoLWWhL+PeIuZ3KSLrqSLnbVZR2mdgI+rp4uruC54cbW4hEOHeI+ZoJJUpKSLXZmkbXxloKSWh1CAkqSdbVBth2WZnaC/xY94h7/Fv4udcZKPdWlhXUdtZVlpVI+Lnat4bXWdgGFQaXxhhGWZv4+SpFlMkp2LfMKWdVCEq+akydbmxcKnfLLWnbI5UIDZz7yyoIuHoJKZskcaNJKu2eZxfIRpTGmudUeAeF21bYdMImm1pISPbZmHmY94fFQifIeAi7+ni7xxkqviv7W/v3y/5sLmh6SZlmV4h4eAj218XW2Abcy8Q4DS2eZpgIeHq3VpZXG8ls/SuJKkoKegaauugIu1THi13JmWkrWuLoB4fG1hUHiHYXFUcYu1vHVdYYSup8KPUFmdkoCAdaCuuHw+XUxtgEyup51pfJKHgG1phJlHbY+Lj52Aj3i8srKkv3GHgI9pcVBUhHx4WYR1h4CHeIBlhJ11mXVHZat8p7yZkotlXW11TISAko+SmbLPtaDJuLzWoKSuq5muh21pq6Cri3V1XZmkcXxlcYu1ma6WgHF8VGl4fI94q7xxsnF8YXyLj4euZY98bXyEZWlMcZ2Pi5KEh5KyuJ2Wta7FwsyLhMnm5qu1i4eWmZJtbXxhZWWAhJmdhD58q5aSR11ZfMWuuMK/4r+ylrykq3WPkninTGWLvJ3fwsl4mXh8hFRlbV1ZYYR8hICHh3FZmcmgWYeAhJ3PUGGkh6uSh52kdbWnZUxHmV1UhHxpeEx8dY9xfHyStaedpIeWkmWWpJJhfI+EZV1xmXWZTCIpNCmLnXGHkpKLcWmPpGFxcZm8dV2g0plxbWWHcVRpZXGSp498vMKntYuZzNmZlml4h4thKauglmlMaXx8oEeEmaBxloSZkmlhh8+/QxpQkoSdoMJlUDmZZZmZh6uSZZaSmV1HYYe1mXVZj4dltYBlq6Tfso91vKSZj6CLhIBlVLiZgGl1j4dUGnx8woePuMlpfFk+pLyygJJprqSrxYe4tbXPlpadhyJpgOK8sp2nbXikwqt4ND5UeENtR5adpMJ4nXVlq2m/v2myfDmHrqeurquW4kdhcUeHcSJdh2VxbXinrpZxcXWdxYR8WY/FZWV81ottQ5l1lo9MR3F1dRphsmlUi2mAPhqZpJKPi5KPknyZfJbSbZ1lp3GAh3y4nZaSfKRHbaCyp6SPXXjM38+EoGVxfMJ4eF00TG1lj0cucaQaR2WycYuHR2HCXZ0uUNydfJ2HtWWSsmWdgEwaKT5DdXy15qCdj6RdaYCLko9Di66rhIeSkridq6R4fGGgj5ZpR6A+fBo+Q3Fdi6C8gL+y5pYaWW3FmZ2dgL+8yaSSrrWdp7iPhLWPv1lpZVSZeHFHrrKuTDlpWWFlUGEuLodhaXWWLl2rp6SLeDRlhG21cby1eFC1sml4kqR8aauAbWGZtYdQadzJhIBdoKeugIuWvKTJlm18jzSWVFBMQ1CEvGV4gEyER3FDZauSaWGLVGVMoL+ZgJaAgGVUTEdDgHxtQ2WSgK6Hp6vPkqurpLV8LlAiVLy4fG1MUKuEdXVtWYe/vLxQLkxhmae8v4d1pLy1p4eAh9nFwoSZkp18pGldVGFpj6Srv3VUgGmPh21DWXh1aYuEYXGEq5aAbXV1aYdUgJKLXWVpTIenpJJpbZ11pMJhR2FtacXS2Ytp0s+g0q6Wi6e1oHxxwrW8gKt4YXykgGVleICSi21ZLlmHuHxxgIuPp3Gnj3GAUENxfIeZi2mSoHiAkoCgzJK1lpa/ko+duMKreFmnq3FhmbiypGmdrriHh22AeHykwoRUi211hNKkeCIah3VpPnhldUdtUFBHfISZmZKAhGl1fGV1cXiEUGVttcmSlqSyuKCZlqeyh11pVHGHv5mHcWmWknx1cYtdfGWdi4t1oICPq5Jpj5aEwoRxmZ2nlo+doJmnuKvCpIs5VEdpkod8aYekdV1xmXykmYBtcXh1kr+geG2WnZl1ImldbVmAhJKLbXVtTFmkh11duLLCYXy1rqSgtbygp7K4srjfrqCHgI+dtVRpVGWPq6eybXxhgIuZZUNtgIBxR2mPuIB4dW2Aq3ht0l1lTIdQj5KgvJKdrsx4p51pqy5UoMnJnXGZcZagnby4xYSAdauuv5mPdW2Lq2V4j52dhJZZZWVllml1UDlZVGGAbXFhQ214hJZxgEc+TIt4kqdpYZ11WUO4oHWZlryrkpmLeG2HR3hdR21haVRdp3GgoKuAi5Kkj7Kkp6SAh7V4eIegWYRdj3WnfKvPfG2dfIR4lrzJcUxHdW2Ep5adi5l1aYB8h4uAlnGugJ1ZgHFp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WW1paXgpTHFHKW11j8KAZTldVENpmae10rx4fLJ4ZVRdVGllQ1RpVCl4ZY+nZaRxVFlhIodU1od8UICEp6uAzMK4oJ2doKR1p4e/spZteFl1hIBUnZmPz3iyh5mW5rWWoKCWkouAeHxpWUc+ZW14LmV4ktJpi3xth7jJdYerXVRdhHVxkjlheI94TC5QIjl4hIdli0yHvKuEsuLCoHirzK6nfGFtgJ2gi5mghF1HYXhpLoeZnYthaXiWfL+ZhG1leHFxfF1MdWl1bbKSfEx1nVDmmYSnybynv13Sq6eSnZKdhIBdZWFdeIeWhI9tYY+AbXhlLml8lmltdYRdbXh1TCJQfHU+fD5xUIApknFUYXh1YbyHZXySxaRUUIDSuJlUZUNxkmV4aUxUOTlhq4t1hHVpXW2LmY+LfFSWtaR4bYeyp2FhhL+SfG1ploRdZWGgktLFhI+LeIBQPkxdfJKSnYuykpmuj1lMaXVdcUciQ1SEzMmnXYSgruaEj3WLZa7JTHh4WZZMbaCdKathXWGLcXyHZVk+cZmHPmGn1pmEp7yShG1UoMmLgHGLeHFDVKAuWUNxfJJUmXF1NDSZXYtZUI91hMxldWV1UHy4yXVZko+Aq6C4mcKrp52rz3ydh4uyrpZ4WY9tXWGHh0N1XWF4h4B4fKB8fICSbYeLZSmEmYCrgGFHUHVpZUNhOUciLoSAv5nmxb+kUGF4YZaWq5adUIR1j4BHLlRpGkMiUFl1XXVZXWGdsp2AdXF4eGVpcVSkp7hDQ5K/pJKAj4CLh6R1tZ14lrzSnZ2AQ11lro+EdZauoGmLrnGgNC5phD4+TIAaYauuUMJlxcVZbYQ5gHiLoHxdR1A+hIBQLotZNG1UaZmPhIRMR7jFj3VxdcmSbYuPq4R4oHWgyaQ+GniddYQ0OVRlYW1DPoTMcWFHdYthXYB8eGUaZXVHkoedgGGyh3FZcZ2gbaSkrpmkh6CnpKeHdXFtdWFHeBplnYAugJKHbXx8tclleHGPsoRxlqAufId4kkMaR2mZUEOdfG1ZR1k0cTRZgLySVItDYYSkyXhdi6ttbVBdGkNMi0MaGhp8fICHcV14bVkafIfFtaR4dbXFVFl1ZWGgnaSHj2GZknVheKA5aYuEi1mEkpZttcWHfGlddXXCh3hQLm2AcXx4eFRDUFCSfExZXYePfIuulmVQYWlMVGWLWYA5gFlhVFlDWVA+LmVpfIdxnVR8dYudtb+ucY+Li3xhcXyLOUdHkqdldad4R0x4kouAhz40UMm/gHFUaWFpNG11Q5KkgHhZbXiHdYCkmYSHnbW8uISEmZardWl1VHVUWaBxTGVlj3ySeG2HhIR1i4+SdWmrhI+ZhNJQR2GLGoCEZV05fGFZQ105cWFhXWl8jzSZfHFdj8WdR3F8izlHPpJpNF1pVHhZpHyPoHyZfIttnZKdtZ2nlnx4pHhQWXHZlm2LQ7WSh4+EUFCLeG2PcVSPydaSdaughy5UZXy1uLi4lp2EOVBdNFl1abyEi4A5TJldZXynZXh8j5a1hFSEj0NZaWllOXyWi1RdfFSAZT4afNnc2YuStZJ8pJ2EmYt1OWmSh7xZfFSHhM+4pIRUh6SPYYtdWSlQh4CdfHFZknWLcTl4bW2Wi2mdoFRpfJaZgKCnmbKgnZKngFRtv8Wgiz5xXVRdUGmEgISAj3iHoMyrh5aHtXhQcWl1cYRMgISHeJ21fJKPaUOLZVBZeEd4dW2Hi5ZtfGWWp5mrpIRxYXGubV1lj5ZhbYCAgFCgnV2SnbKkrquWTKuulrJlbWWuvHyEi2mdgEx1nYBHfJ1tZXV1hKCrcYencYBtUGFhta6Zlm2SgENHPhpDaa6Zll1hUHG4eFlMh2mPhKCkyWFQPmlMNF1QOTSPaWkpPm2PgL9pGlmg39+ZULy8uLiWi4dUWXF4gJ2Hi3xhmaSknYRlhLLPtYe/aVRHgJJUcVSEhFBdR3hHWV1dhJk5eHVpj49UgKC8fIuu38W4uHGHeGlxVG1dXTRQaXw0YXh1j2WApKeWtatth22kYT5QQ11ddW2Lq8KL35ltVDlhaWWni49ZdZKZloBdYVCLq4SW2aRUi4Rpj1BhUGWPfIdpTHxp2c+rloCElp2AcV2Wq4CPbXyAlrinh6Cdp4dHWZKkhGltfI+ZwpmkoNKgp2l1uHFpInxpmXVHbUNZcUMaaTRQspY5TGF4klA5TGWZp1mLtXhUXWFdYXVdKXzFkj51PoC1j3GApI+Z5uK4bRq4p9zmllR1eEygp4+EYUx8p5K/nZ2HQ1SgbXE5j8x1YYdhPrKkkoeZUD4iTI+/mWmEdYSPUIePgJltbXxUq7/JgMxdhISEGiI5mT51h0c5Q4ePXXiLq5mgoLyktZZxnW00IkdthItl5qSPh7V4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hKCSbVlhad/JrnE+tZmZgK5prtmPuJ2/vG2AZaRMVG2LYVlMeJayi66dllR4hJ3Mpy5ZXV18q51xUIePXaCnmZmdmYCElnV4R4dlR3WLkoCnR21QTHVtaXWSaVlpGj5UaY9ZUFmHWYekbYSZUC6Ev6fFcXGkZcXmvMWnmYe45uageK7ZeKu1R4BUdWWPbXx4gJaduKDCyaedpOa4hHWLgHFMcT5lgKtlmXGScbiSp1CEVEdt3L+PzL+8wqSPpMm/gIRpXVkaTI+85qdpXXh1h1Q+VJkpVFR1UIBUZZmSgFRQaY+WdaeSlmFtcZaPVHF4j3xxq5l4sqeLhGWEj3y8ZZnJ2XyrpJmrpKB1nVkuVFR8R6SAi2WHhI94eKSdkqCnp4+ScY+WfIA0loSAdXyuLqukfKd4h5JDXYCnj52ZhHyLmYuPh2VhQ21pnZlpeFmWq4SSgIB4fHySgGkafGGLYUxpUDldeGWHllRlj1RpfJansoSAp66A5ubFeLy4v7+Ph3iS5ubfklRpfHV1eHWAcXVxlquEfJJhaUzJpK6dlpmnTHVHWXyyhJ1xgLi8nbxMkm1ZlrW1vMWLv6SdpJKynW1dXVRZQ0yk1qePQzk+cXxhZXykaV1xQ1BxhGVhXXVZYWFhcW1xi4SSLodth5m/tbiPtaCuq7irnYugZYCPYXWupJ2WhJKLbXyWh3yPYYdlfGlhbatxXWWdmYuZfKSroIdpspl8nZbmycm4hIvJ5pK/q4+kj4RdZWmHaYCAYaCPklR1h2VMZVRMNHx4h4BhtaeHhylteHGEVIeSUClth4BQhGVUcVRHVFRUaWU5XXiduJ2SmXHMcavmsqekuIeWWau/j7zJv1SAXY9tgFR1cWFpUJa1j52HkotdtaeyVHW4p105fI8pcV1Qh4edi4t4TMxtpJ2kxaurlpadlpmHhFBMUGE5WUNpdZKLlmlxiz6HYUxpR2VDlqc0NHG4hHFDTF1DLnVUknhxaV2/lofZmbW1tdaZksKggKSWj5J1srWrgJmHfFBxVF00q8+rkmVlWWmSroB1eHFxYVmAmXyW3Jl4WYudwpmdrsK8v4R8p+bZrq6gdXHmwtmLOTmEybKPZYtHUHGWZWEaUFlDcYSLq3xMWda8jz6Ev4dZYSlxWXidmVSEGlmHQ4tHkkN1sq6Lh4SnGny4xaSgspautbyLj+aHz7KnsqSnsrygtXhUuIdpYYB8h3xQsubmi4+LtcK1xaDPeNnfaaA5ncKPbUxtlp2dxaeykquAlrjP5oSHcZKdaRphbVRdaYBhcYdZVISup5mW1hqgp66uaYRHnYSnkllDaYB8eFSHwpKLmZlHi4B4ndmkp4tZj6SAIoRluNnfnYSHhMWgp4BQq2VQTHyroHGrfJ2SXVBlXUNxloR4pJZ8eLigp66gQ3GPssLMi8nM5tKkdYBxv4+gWZlxXYdMVEc+gFRMXWVxcXUuWVAaYb+WaWmrfG1hUEd8oK6AroddaW1QR1kpKXF4THWEYXW4i5mWXVRMhISEvNanXa6ueL/mvNakgIuWkmmHh5Z8kpJxdaSdi1RdoKC137J8hLLZnWmZoOakrquuhJKrsnFpcaS/XXhQXWm1sqB8gI+EaYtpj51UgIuHlq6Li1R4baCZaYd8kpZ4sqSLR5KHYV0uWXGELnE+Ll1ZgJZZdXh1v+aPdWWLoNmgfJKrvIR8kry8dXiLgHF8p6SPxclZTGGEmb/cGnWWfEdlQ12HeJJMTISWkourh4fWma54lqeLssWutaegbVmLaaeWh22SYXFlgIR8aXhhVFBdLm1leHV1j491aWllp5Z1kouPrpZhaZKLfGl4YSk+fFQ0TDl8h4SAoHFpaUyEbZakrqfJ34CWuKeWnda/oHhxq7VteKSPeHGLpKSEfG1Hh6SL0sLmkoCLpLygrsLZfF1pkoBMXXyPdXG/spZ8cZJlloRxcZaEkrWWfIe/i6BhTISPh3VlZWV1hHWLeExli6e4bXyEbVRUWYd4ZVRHVEdhaWVpWaSdZXzmyYuWoLiEnZbmp7Wnh8mWhHhZcWFxbaenwuKWoIerfIu1rmV4oHxQgHVheF1dVISZfHyZoIdxoLjCyY+SgL+kvMyHZXxxbbydrs9teISLRz5tgFRQi211XVl8UF1UYYCglnygkodhfJI0p22AcXGEeFB1h6eWmYc0gL+LYUd8ZWF8WSkinae4ta5hhLy/5sWuv13SwoSLfITJxae8q49xR5J8llSdgIudoLy15nyEXXh8VHi8pJ1UXauEVFCui2WWxdmWi5JlPjltXVSEhJaWoIuSrrWSv2WPh3GHVFRdWUdhknx1XXyggIenYYeAgHhdcVB1VGl4NBoaaXFtcUMass+1srLMdaCurp2gv3WkbYeWVF2EbZJ8aaCZeICkzG1tWXhdeKePeKB8kpZtcVlxXWmEhJaHnW21nbyPmXWuz8Xcp9+dbWnFpLXPXW18fIQ+aXhZOVlleHE+Q3xQgHxlj8/Pv4uEmbWLvHxdoLWkXXxxcXVph7VDUK7Sq1BDmWE5llCLcdnFvJ1ppKvW2ebcj4TfwuaPq0yHpKSHyZJhXVRdcaSdh2myfM/Jq+YiQ0PmmVAaYVCAoJmyh3VM5q5xrmVpi528p2FQaSKLj8nJi3yyh2WEgMXCpK6SYVlZfEw+VK5th5K/WVmLp4+HsqAiPm2LYWVZcVCAbS6HlnG8YS6HxZmWxW18vKeLhKR4pHWgoOKEhI94cYeLmS5xVEw+cWVxXVBpfJJQaaePbVRHUKSHZYRxaXydz9m1fJbfycyd2avWxYSgaTm4fExDba6ugIuEaSIpbXyAPmVxYbjWvHVMca7cnYe8wr/FhEdMhJKLi3hhGkOAp7igfG1tPmFxv9a1hHjcq2k0nVlUdZbcwoSLp9bZ5odDR12WeHxhfHWPj65ZQ4t10s+LgKCLz4+A5houVMKdh4/F5ounbcKnh5ZQQzlhlpltj2V1tYQ0kqdhR7jZp9KSzF2Lj4RhTObmuD6S5tIaeFBlmbyulp2ygGl1q79pUJKdXT45cWltzObfuKdlIq6AfF2n3M+yv7+4wqCEuN+umT6gpNK1j0xdoHF1R0ygq7+8lriLizRUdXh8dT4+q5auh4DPcYTcuKuPxa54nau/5lRZeIA0gGWWi5ZdKVB1h1RUeHyEmXWggKSETGltknx4kqB8h51HQ2FxVHyPYXhxp49UhIRlUKC1j3iZh4eLnWVQXXWWj4ttwubCj6RpeMl1dW1xi3FpVF1tUFl1XWWHh7KPmXWWq7ySv+ZZh53M1q6Atday5syki4Cgh51xeKSuhG2ErmlQNIfMkr+Lh3iynbWkpLVxgNbcwplZh7W1q2VZaWGEhJaANGllkslxi2GEkmlladKPbYSZgKCWgKSHlovFz6e8kqSPq5mZsquyh2F1sq6WmbidhIRlfExlkmV1YaCHj52LYYd8bXVtOWFtmY9dvHh1p6CHh52PpLLFneKSVFRMeG2Ah5mSZVBHaZIaGkeSna6Li22Eh2V1hFnFpLyroJ2PZV1MPkyHgHxlfK5pdW2EhJKEWVBQYWmLPkNZYWkuaZaWaY/JtbyyaW2guKCLhIRdVDRlbSk0VEdhfHzCcZ1tnXG1fK7MkoeyZdKgj2lZ0tzf3IuSkpaZnW1hi4tdcYdULlRxwlTFspKZhJKAq3WZv8yWp6urlsLCuJ18WVBlkmGEhIRtabyyi4uWgJKSh6udzKCnmYSErriufNK/p7Krp6S/mcK8xaB4h4thgI98UGGAbYdHp1lZcXhhaYCAlpKZ0qSncYB8aXxpllSAdZaLyauLvLLJvKfFuMLiVF1DhKuEfClpeJaLcRo+OS6Hkp2deIt1WZZUhLx1YdKyoFk+VHiAKUxUcXyPq51DNHVxh654kkyAwqQunYuZi2lDXZaAfICAp4R1v3yWj4enbZ14cXx4aWE+GlBHgHyAuHGLpJ2Lj521oJJMca61ycJ8UISWwsWSeLyZssLCeDRpVD4uOYCAhGVhv3WShKCEXbLCvIvJxafCwrXJv7+LhId1p4t1maePp4+udWmEycmnbaSdloC81sxQNI+np2HFpICyoLKydYCgnbXClnigPmE+cWlplmFdPtyHi1kaIo+ZwpZtaXiScVCLhF1ph4+SgJKPp4B4mbiPtc/WxauA34ereHHFbYcafFSAi105fHxlpHFxQ5JMPmF8q1A5hEPmlsWLeGl4pCJ1YVRZsq6ANGGPhJ2Ayb9xPot4dXinz1lZmYQ+XYSyaaSknZZ1p4SdpJayuKtpOUeyRxpxcaeHhK6ZbZ21uHiumYeSgCmrq8zZi4dlgLg5v7JtZa6dsrJUhGWLbV0aVLJd5nykaXhlbY98rqCZmb+Zq6u4wpagfGWHWY9xi3iAlrxpWYRDfKSrVF2ZYYu4fLy/rotphLXmlpl4tYukpDSuro9837iSmWWHmXVdgGGPmTSnsm1tZVldrmVhgISkhDlDoKSglnFheItMQ3GAuIukcbzPj9yri66SeIuPv4uPWRpZaZmEZXGWi4dDeJ1hhKedna6WaZnZj3V4ba58v4SgoKt8j7igfLXmoIB8hGWdq5Z15oedhJJ4hEzWcZ21wrKHi8WkaUw0nXF1gG1hgHxDZXiEp6dxgIR8fHV8XYBtfKS8dYugrriyq7KWp9KkR0OnaWkiZZ3Jj4+kltyLUHVZGoSEpJadtaCZaaC1gHGPmZ2kj5aZsoRtv8Jlj4CLaUy/zMyuba6/ad+EeJZ4q7WyspK1z8+kpNyrz8W1eJK45o91mWW1pLXSnaSWuFCLlp2kuI80UJnZydJMTFRdkp3C5nEiWYvfv2VMPjSAkmFHmZ2gmdmWpMKAcWGEh6uLnVkaGmWSkl1lfIt1hHxphIeWh3G1kpZMrtyncWkai5nCoFR1gHVxi7WdmYt4kmlxkoS45tnSi3iAoGmk3KuHi1llUFSkZZ2ZcXxpRz5dmZKLR11MXaBlVISAUDlhp4SrpI+Ah22AWVlth4SZUJm8q5aWwsl4UGGEv5aPZW2LOTlpXYB8UJKLtdarp3zip51pvJagp7jJoHFhfJansnx4mXxZwubWhIRdsnGWlnyWZYuurp2EspmZLouEeGGgp3ydpLygtcmyrsnF5mVZUI9pNJKLTGGSgFmWuKBDNGVhbV2ZpKR1kmmnq5aEVFm4kqCdfMyWnXy/pLKdZXF1dWGLWYSAaXGZcYCZgIBhdYuWoL+rvK6EnXhZhJmghD6LgI+ScVmWoGUuZVBxbYuEgLikXYSgtbKrxcJtcaCdnd+nbWVZaXVpmWWSj3y8cW1tTG2HfHUpgJ2dR2VteCkaKXh4i7KSaYeZoIeLWYdpi4CLkpmup7zFj2VDaZmSR1R8gIt8lm1UVGGPrp2ui6S8mc+reK6dpKCAsqeAfKekpIvJh8XWR7/m5ouPsmmWpM9leG2g3+aylquZwnyEvJaWxda1srK8yc/fwrjW0uYuNFCAkmFxmXVlZZ1xh4euj7KEgIc+yZ2dhJZQZZZxrmWA1nhUh8mSv66kaYSLoIBdbT5dXUdxpICAWTlQcXWWfHGZbZmEi4uPp8mZcVlhZauLjz6EZYd4kqBdcWlthG1ZOaCSoFBMeI/CmaCnq49phJmLpLidhJK/rkePh3FtgHhZWXFHTDmPeJmnlouLgIs+bV1xhFRph2ltpJ14bYCLj651UId8vLKLp+bCsm1dUFSuq8mui20iGm2HmYSHlpnP4qDMUDSrq5mrsllpcdnJpLy8lpbC5ua4eId4uMWShLWWdd91eObipJanksLFi2WSi4eLoOLmv494srWuh+JHYT51lmlQko+Lh5nJtZI+YebMVFldeEePnWm1VFSggMmyVHFpXTmgTG2dvLKr1p2/YV1troBtoHVlZYB8rmWHZWWrq3h8q3VxoHHPpLKHYVRlsr+keI+EbVRUKW1Uj0dUoD5tj3VdWXHPtbWkq53FybiyYYSAj1CAj4+ddZanp21pj7hhZXyLdbVtaYt1hFRdGl1ZWVApj5ZtVENxh4CEOWmWNHzWpIRQrniu5qeWoIBxv5mAVGF1hGFl1rKWQ4C8pNa4rosip8KApKuAcYRxcXWgh22ZkpnWz8XfoLigncmyZYBDYXXMj5Y+oMyruNbCp4S8p9bJycWWdW11Ljltlmlph21lTJJleIeWpK7JOTmWpIs+PhpQp5lZfIeLmbJ8aWVHQ6eLQ49ploSLpHhppHVhaVSLh6R8dVB1gHiSnVRQwsmWbWl8rr+reJ2dmY+AabXC2WmLhI+SgKCPZWFlj211WczFvJmH5odDLpZl5pnJi3W4pLWZgIenoISWnYtQPlmWeGVDq7/mhC5QPnyWaV2ntYeEVFRQaVRxQ4RxeHVtZWW/dWFxPrWgnbXFcZ1Qi7yrso+HbaSAsotxaY+EvHXmlqeWgJ14hJJ1hIeWpG1UbbLm4sW1q7LFvMyLlll4xYfCpzlZsp2SlqCLaZZ4q6urnae/p4Cgq8XC0lRhZZaWp5ZpcV2HoLidgGmEv7irrnyWhHFMgGmPj4ttnXw+h3yZgFmgdUxHGl18YXh4XXxZVHhxkp2dgFR4dXWdh51lpI+knZJlVIePnZaLhHV8hI+SzKSgq49hfIekuI94i4+Pi22rnZJti+ZlUHydpObipIDmi4u8wofCsnx1knGdGoCEZSKLi52g2YBleExdXUdthI98gG18XVk0VGldaWVxp4Blq3xpj1SHoHhlkqSWv0yuTG1xcUy4zHySeISSndLCmYukkr+AZYRdfIdxoLiEeHWyuL+Sj3idwpbFh4B1fLidq3hDgHFthKCgwrySlovP35a1q5mSloSSgHWAgKRtmaSdGmmgdV2Sh3WAaZ2knYB1bYCPnadpYZmSoHhZTIRxdYeHj3g+KVSAuKSgZXEuGkc5aYSZeHiWaZaEj4+ni5mraY+daY+Zq5mHp6e4kpanhKR8UMmdaXWrsp2yKUyHVJ3Wv9auVKfm5sVp4pbm5uLWz8W4q+adfEdUYbhZXRqEtWEpR1l8XYuSbYSHhHx1p6RxdY+/VEwaPkdZWXVxi7ygp52Wj6fMwqtdR1Q+dXh8dT4ueI9xnaeETDSnspJhXbV8nXW4vL+1dWm1hKCPuLi4rpaZj3yruKukxZZxdXiWbYBpgJJhImmEstayuKersqvFmYS1fIudgLh4eIuWj8KneJKZ2atlQ3xtbbKnpHgpND5ZdYR4YRrJyaSnj0xQh4d1kniPj3V1fIvPi0dtQxpZQ0xdkllQpGmguGGEeIvmq2ldTF2WeGGSlm14p6SPrpakpHGZ0qRZVI/FtSKPTBo+j6SnYYSrrrLW5slU2da4fKfJ0o+/lnhlgISWycXPbUd4wqSPgFR1fFRU2WltZVRdXXU0Gi4uXW14Q3iHbaCulnhZPlCkq51tQ3FpYXGWdUNtOcynp5mHpG2ShKCZbUynv5K1taersot4rp2LbXyrh51DZa6Wj6u4mW2SfHVUXXhxgJJZeFCkpL+nkqC4rqS/bbigoKuynY/F5sxlfI+EkpZ8R8W8h3yEaZ2ZdZl8ZYeAgKtxaW1DR+aZIlBZcV2HfHFlWUyAeISPZXhZNFmuTGWLTGVhdZmulpkuh4SHq4B4fHxQoGldj2WSlmmnq4eEfNaSXWmZlot8gIttncWPnYDJhK6ki7KA0smdxUzSp5K84rySkniAbVlMbZagp4BZNICdrnh4baugi211LlB4pItdR0xUVBoafI9UImFpj4+ukpm/taeHoM+LvEdUh11ZeK6ZbWl1gJKLklSHtcLfsqS1nY+gzKvCndKrhG2LwqCHaY+dj7i4q6BUgIeSR3xdh3GAh4BpfGWWpLLSxcWSv4SrdaTWvJ3iz79xTG2geG1ppJ2ykpKuv6eklougsp2ucWVDbXyEloR1eIR8WY9leJJxR1RhkniEdVRtPj6HVEdQTExMYae8mZ2ndaeZrqBhpKSHgExdeICHkpZxmV1tbWGZeFRQmY9dbYuygG2Hj8mZloCLeG2HlquyuOZtp5mLuNzWnWl8h7hlWVBQaYCgbV1UmatlIl3CgHFMoFRdpHyHZVRMcY9UVHFHVG1tgItdZVl8eIu8h6uypKdhR4d4TI+8XYBlkpm1pLiLVIu8yYddcWV4gKe4q52Zlo+ZuMKdnXyZkpaAlpaHaXxhcYSEj2lMKYCdbVlUbWWE5sm/spJtoICr3MLCnb+ZsnidnUcudczm5rx1wt/FmXGHhHiPoFldbY9taW18dV2LhIt8hGWSkp1pR1BZcYdQfC5MKWVMZV0aZWVUh4+HgHySlm2LfHVtaa5hgJ2dcXiLVI91YXV4R52rh49QXWVxp1Rdp6CgUClhrm18gKCyv4+kUF1tnczCvJZhi4e4h3GEfF2SnaQuUG14bUeEh3FZcYSWknhHTDQaWVA0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ZUyLsrh4YXGnhKeHpIRUaXhtdYSneIttdUMaTHVQTHxpWbiPfGWLj2UaGiKAfHV4i5mHgHi8v791navW3GF1nSLm1pltUOaWh7zMnbzFeHE+UL9lKWGSTD54cT5HlrWSgItphHiuhKedWXydlmlUVENhi6CAllRlQ4SkaXW1tZakkoB1hLKAIoCWj21dYWVlbXVlgJKSpKSgcS5lGllpZUNMYT4uKVlHh4dpXW2gtZ2Ei4BheF2SgI9tgGVtWZ2Si2V8bRoaaXx1WSmEeCKSgHxhVFRhllRtj49ZmaSdXXjJkl1xhGlheHx8oI+SZauHdW2utaCEPpmnbYtxmaeAnW18mcV4j4R4kmmnv5lpaVmAllRQbZJDTGVQGho0UEdUR4S8sqCWaXV4ZV0+Q1R1NHx4gHx4mbKHmYuyls+8ssKH0pnmpIvmoHVt5pK1h2lpWWnFWXWSp1ldYWlMPnhxXXVdgK6PpICPgFlxh1kuTIuEbYSPoGGgnYR8cXGEkqtxq5KHmaRhZY+ktYBhh0xxbXVZGm1MOW1lgEdDh2lDhHg5GjQ5UHFtOWGLbYCSbXWrwrhpdZJ4pJmShFSELjRMR1lpgGlpkl18VHFlYZJdVISWfFlZlodZTJKWZaBtOUOgv654bWVMZYBtdY+geICEZYSZlpaPeF2AZXVlfJm1rrJ4dUyPbZ2SgJJ4j49xYVlZUHyyh2GAQy4+bWlUcUc5NGVQh3yEoDSEmZJti2EpYUdHeIdlgJKnoJ1UgFCHwottXeLCq6eZxbWdv9KPcYBUi4SAv4t8ZT5dTDlQjz5lXaDfp4uZlnhMgGVMhIRdVFmgoJmZhIeAVId1h6eLR23MnbV4srW/h52AfK7CvJKkh21ZdXGneIedklR8i4RpKXVHKUNtUD58hFBMYXhUnXF4fKu8rlRpTKCHfI98eKR4GjRxaZl8ZWmEZVBZXWllh3GPnV0ulnx1cYSZoHWgdZa8gNKSh6ddYVSEgJZ1kqSLlmVhcXF8uK6EnYvCh3W4xczPwrVxoGGAh1l4aaBQZXxtgIfMfFA5p2GAtZaAZXVtNC51gGk+WXFdZW14Pml4aa68bYCPoOaZrnxpaWVdpOa/VKd8vNa8pHiyv6uZlj54smGHq6R8ZWltdWUpWb+PaTRtyc+rdbV1ZXGgrmGPVHV4j21pVENpRzl8soB4gHidoICWi3V4koBhZWmSzK6dnaBlUHxxhLKZgG1laZmEi6RhZVBxR1l1j205OYSAgK5ZeKCdmXzF1lBlhxpUfIuWgFBxaXGSWTQugGmSWYdHaVBlZYugbW05TG2Sp5JhdaSuzISgmYedj22nhLyWR4+rpJaEcauHZVmHdZKd1sx4xbW4fMyZLhqWmWVQi6SyklB4dWmPVIRtZVQaGi5dbV1hRzRUcWmHUDk0R1Q+eKeLR12nZZ2rnWmSlmk0Q21hpLzmwsK1nbzWsqCndczZi7y8j7J4lnVdXYB8YXynUEd8lnWZksKdoHhtsoCrTI+4mZ2EtV1Di0xdXZaEZWlpeIeWycW8h49HhIeri3WAtZbCgHx8bYTFgJaEaUc+gHF1dXxtaaugQ0xdXZ0+cYSHxZ2HVKSyydnmv8lQfHxDkqe/fFBQYXV1soeLsryHi0NhgJKLeHVUVFlQVENUNHFltcLJj3iHbXWEzOKrtaCrXYBlmXV8fJLCp4CLp2mLv3x4q5arnY+HhGGgbYenhITFj4SruItMWUw+UENZi5JZGj5DR4+Pj2VtTG2SdZ1dLj51j218q3xxgGl8h51xlpmykp2E5rWPq6eyuL+LnXigj6CZi5Jhh8y1oJKgdWGHYV2P0q5lbVCZh4SgeMy8vKuSi2l1i3iEYYsaUGlUh4eHlqB4Yaudz4uLvISrq6S/snF4h52gfISShJ1lQz5dgJl8WV1pQ1B4fHh1VFmAj4+yi4egi51tR5m4zLyZrp3WnW18mXyLhIB8gGkpUIdxcWlUeHF4i3VDZavWcYu1uISAhLXCeFSAoIu1lq7Ch5KddVBpWUOSWWFh2Zlli3yZh3w5TGWSoKCnnaCufF2Hj5KPxbKHgIuZWSlDZWl8gJl8THFhcWmSWYtldUxhcYCkZW1dZXhUUJKLeHidbZaHkpmPrqugdaCZrqSSp5bFycWugJZxdYu/R6urfHideFRZnXFMh5KLdWmAknF8soSklpmPvHV8UJmHoJJ8YXWdPmFlXV1xh3x1XbyZh5mHkr+LfOaucYBpcY+Hj3FZUKBheHWEgIt8XUydj4RtVFBpgIA+q5KknbLmQ2mLdXjFlqSdq7JQYYSkj2VMXXxdNFCAdVQ0VHFZYWl4cZK1sot4ma61hLXMoJZ4ltKLh3yngHh4RyJxXXFpdWmEi65pYWV1aY+SgGFhfJanpKuggGF8cYCLhLyui4d8cXFteHh4Q4tlR221j6CgpIuALlSSWYBxVIB8v7+yoJKLXWWksmUaPmVtbbKWj5Zlq4ugoJ18oG2Ap7KLloCklqe4p6R1p79tNGmLZY91eJlUv3FdYY+HbbKZ5uaWYWmHgLJQh6t8fG00VJarkod8eHF8oJm8oNnMh7LJh1RxxaSPlpZ8i2lxnZ2LbZKEYVmdgGF4mY+ueJ2kaYS8v3i8uId15mlhWVCEpL+rdWl4hJmHbZmAknyLnVk5NGV8LhoaoIR8nZaEgJm1q12dbWWZpLWulqCgnY+Si3WrfGVQQ2lpZXhxh8zCj0NUeKRhdZaLeK6nq7WZwr9xXXWWuLiETG1tpJaZZYAadW2ycbWZOaukeJI+Lkc+PkxMmXxpoJmZlmU5WZKLtXWHfDmHeI9QQ7+ruIdlbY9dR49dWVSAhJK8vHh4q6ugUK51xaSLi4CguLJleJ2dpI+43Iu8q4BtoGV8XSKdUFR4hENth6SuhF1hYXiLcYCPq6ePpF14gKuup3GPwpK/VEx4j511VHVdeJK1rsKdVEx1uJaHbaSultmumbi/j1RQssWE366Eq6SZp52dtW1pUClthFQiGjRMhJKAnY+kq6u/ksLipOaZnavCcXiPcT51i2Flq21xhJJxOWlxp3WdnY+raYTWoLy1aby8oJnZZUNdQ3GWpISAYYR8bUdHgJKWbY+PnWl8squWRzl8Q3VUbWFQgJmPWSKLcXx8bXV8bY+Ej218YY+nTICnoHyPj4SWq4uWp4R1oHyEZZl1TIeZi3FtnXWPdXygwo+Wj12Ei3zPuKenrs+8oGl4pMJ8dYSWcWVdWXhZaXg5WVmEq5mHfKSrxau/kpnZwrJxZVRtaaR4i66ATJ2WeKSZaWW8j2VtrqfJoLXMv8J8fKuWi0dhlmmZnZKkoL+EpKCdv2VdeExxbYePTFlDWZKynZJ4mWF1vLyZuJ14vNnmpHV1tZmyeF1hdZmufHWgfGV1j6t4nZKWklBpq7/PsoBtdaenskNZdWF4dbiybWlHWWlMkqSLi11ti5J1aYSEYXhpq4SkaWmdPnzMmYtxdW2dgHxDPlC8hG1dknWZaZKuhHiuloeZab+EaY+Arr+8j6d4dbjPoIuW2daynZ2dkqC4lqSZfEyP0sKkaY94pHGdcY9xeFBlcYuAh21lUGVhYXWAbauZsouWstykkpmdyc/WfF1pgGE0kpKPhHySeHXJspaypMWZeJlluNnCj5mgpIu1nTRMdXGnq52PyatpXa68wpllVJ2LgFl1h3UaeKCPj2mEh22WhLLPq5KSmd/FybWEuLLFwjSSi4tQeF2LfICZZVBpZaCPnZJ8dYursrykUGWSncV1dZZ8wmGWtatUQzlH0pmZfGFdbWF4hHiPdZ28gKDMUF1UmWmZz7yggC6SoEeScVl1snhpaV1dUC7SmYBpcY+PgHGWkoB1kpLJuKe/oJmr5sKPmYuHhFCkwqeAfISdq2WuXa6yuD6WUHWnhHhMhHVDdVBHWYt4dWFZcWWLhGGEWV2EpKuy1tbSxcK4uG0uVGl4kqBHPniPZWVlz6CHpLKdmcKZQ4/MtaSnTId4j8w+1lldp65UgKSnbafSwnVMh3idroBlUG1ZTICWaVR4dYSSq4uHoKuWuMLZp66ruKCy2dm/j4eANGlZcWVlh0NQPllxh7+guIeAi52EeHV1hKBxj3iEsl05gIe4VJ2kuJJ4ZZKgWY+8pHGAi4c0GoDSvLyHmYCSzJ2133xMaXzSab/MpxpheJJMUMKuq6RHfGGPoIeWoG1pj+a1q5adkmFlhznFh6u8oM+1i2lhbb+dp6Tclo91nbjFi3GEtWHCfFmPi4B8TIBdZWWrR1mPkniLfGFxpIC42eanp4/Jz22gpFCPnW2LfIeZi6e/tYttj5KZpI+yizSA5tm/3y40i53Zkp2HeKvCsp2SgIe1oK51bYSPaYuuTFAupEdpeISHeGF8acKysofc5s+ShKSryauHQ12EmYukmW2kp6t1aaB8ORp1eJ2Lya5QQ3E5YZKgOWVleJKHWXGkwoQauClHgKeHdTlUdXWHi5aZi7ygh6dlgIu8taePfKCgp66WWXV1h1B8i0c+bYu4tVltTHhtTG1pZWmSYXF8gJmHZXGukpa/p6Bdh66WnYu4ltK8vI+grrxZR6Rpp6CPoI+Sv4+AfIePp4dhoHxxUFlDNGlpZWlldWltuJmWxdK4knVMhKt4dYR1YWk+aXg5PrJti22yp5llpKSuoIdtYaSyxUOWXbzJrmHiVMmZYXWSh3Fth214j3FQkjmLrkdDQxplfIun0o9QaZ2nzLWdh66Li3yHvMnmQ8+WoIRxp+bmbVlZVF2drnVhIllDPpmAXV1tdVlhj4tdYT5Hi1mAj494eHFtgGFpZV1xhItQp6SLq4+grrKHfG1hh7KZpFSPfKuSkm2EYYBlYVlHi4BdTJKgnYeSVDl4nVBli4ttj5KPnXVtVJKntd98TFmgspmPrnyArtK8oHikoICnkpmWhHGnpLWguHWWcYeWkpZlNFBtXWFlaWV4i3GEZXynnb+reI+EpJKWh4eroJadkkdDXYC4h3x1q5Z4YZ2nlqeHgGmnh3yEdYBhdYfC4nGAj3F4ybiLYWFhcY94h4tHfGldeHxxh3GgwpKPfIeSgIuLzMW1pL+rxcyk0rzJnYu4eLXc32ldWV18cXVtUG1xYXirdYuPWWVddathVF1ZZXxQlm2HTENtZaBtWVQ5R12LeJmSgKuubZKSoKCEcWmHnbW4p3htaZZlj6eLgGkuWYtQbW2HaXiEgHFUYYtth2lth2Vpi6BlbYunuKDM3HWPnbikp6eEp6DJz7iAaYu4xcmLgItddYCLstmScYCdmYCPh11pVF2LcWlhZYB1hIuytbWuj4Sdq7KLVGlpZYeHeIdZfI+Alp14YW2PaYeZdZJdWXG4p3Fdj1CZhL+ApLWAfGWEh7KPlnVpvMKghHyncXynbYughF2dtWlZi4Cgz52uoI+kq6TSvMydi8Lip5JMroeLsqB4lm1dUFBlYYBdZYCAfI+LmW1dZWlZhHVhUCmPbXwpXWlpVJmgUC5pbYCdj4tdh5anaUxxND5lVC51eKCurpaPkl1MWWmdoHhZR3y/oIt1dUxZfIedaRqWTFldVGFtdWFtaY+dmcWgcY/mQ6enfHF8gJ2ExdnChJmEfK7ZcY+gh2lUR1C1pEw+VKRUkm1MmXVhGoCZj4dxfF28p6udfHGPlry/v4B4VFl8gFBlgFBZQ5aZhHVhZYB1h3WHdYtxoJakpK45luK8dUdZ35KLzKCrgHGnxbzcpJncPkMuXXyLgItpQ1kaGkedxae4snx4lpaAi7XPz4Blj4e/wniHrmlth4dMQzk5PmWuj3FdtaCyhHVxaVBtZXg+YVQ0dZZtLnxlWWGEaXw+PkyLhGGSvIuEnbiAsnEidcLCGnyPfKB8dcJ8XXWAdb91aWmWkll1oHyWZWFQkquLZWVMOYBhYV1tfIeLlq6nh7WWq6C1cZKdi7ygkqe4kodUeKukpKt1YVRlWUw5taSrj3VpVG2SnXiPOVQ+WVSnfGFtmaS8i5KAVI+8i12LhLXidXh4dYuLaYdtVHVtNEyWtW2ZbXy1GlB8pJKHgIeEcYeHhHxHpM+Zwq58kpmHoJ280oSShOaHfI+Zq4dxPoSgZW1tbZaunaDcz4+AhJaWj5aPq49lpKBxR4Bdj5Kdj0NHYVSZcRqHhIencUxlWa6EPl2gccmWhGVdXWEiTFlUzL+nloBxfIBhZS54p67PvFSugLV8hIR8oJaSi49MWXiWp49lj7iHYVBDZVBUQ1SAlotdeIRhhG2Lq3GZj5mksr+Zh2nWroSWxYCdkrx8mbiWeICApMXCsm1MVFltj2GAbbKLfGF1pHhheHhUbUdMuGWrq4+ShHh8gFBtgK6AcafJ5oCdlnWucWVUZW1pfLyLfGF4hFld4ua1hHxpcY+uNG1lnZnmvOaLPsLmwr98rsK4lpa4oLzcfHWEXXh4hFRtVGFdaYBlbXiHvLy/q7yEYYu1bZ2gj5KEbUNtgJZ8hJlMTExhuOa1bXiEh2FxeGFllnhpdUzWstJ8VGGLoHhteJKHj4SdXWVQXUdQj4B1lr98mXinj4uPeLi4cVlDYYuAUF2Pi7+ZnWlMUEdZfHVdZW14YWlUUFBMkp2yoIuLfLWZoKuP1syrmaC8uKeAh53JkoR4p7K8q2ldWYB8aZmHfI+EuGmSi4SSgI+LeHF1pHyWoJ1tkqd4fHWSeHiEfHh4fFSdwqSHfG11dUxUZW2yq4tUOVB1TLi1cRqAj7XFyWVZGo/S4ry8hIe1uKC8rovCvJZQgJ3CkrJxmV1ZeIeSnZKgfHiLXXWkp9K1q6eglpmgwqSni1l8i4dZXXVdmZ24mXVheMLZ3Hx8eG2SoHxtcYeAZWGHlpmkZaCEgItpcYSdoIePxXx4j11dYYR8TF1dhI+nyYeETJm1v7htTGWHgHhloJlxi3V8gItZeHFQVFRQXXVhi11ti4thj4eEj66WkqvMrrzZ37/CrsLFdZ2Hq8zMj5aSsnx8ZS6nkmVpknyZkpmHpHxdaWGWnYeZWYuLtYt4pIegaWVxnWltZWmyxXG1q6uHi524mbJhfIeEcV14h12rhJaAll14bWWEtatHRxqS0riguMy4p4Srj6Crj52AtaeWoNzPq2FZGmllmcmZlngpUHigdV18ZYtQlougp8nPwquPgF2kZWVhWadxlo+SeF2EzIuLfICEeJagj66WfGF1h3iAi6eSeGGuWaDWq8KWbYedWZ2HkmVUPhpth22SksWSv7yZh528i6CyyYRl0nxZmYuPUDSZgHidUCJdYY9tUF1UnS5HYZJpVHyShIudi8m84payp7y1mc9xkq6ytaCZhG14gLXmwqtlmY9xj5J4gIuLi66daXE5v6untcl8R4u8cSlHj6t8dUffpLKWmaSgdXyZj2VheGWPaTS1mXhUhGV4kubMtWFHwo9tljTP2cmWuL+rknzSpI9tpJ2PgIeSbZm8gFQ5oLVtcXFtmW1UXYcudZmHyYeHYa6HVI9MlqDMWZk+YXxpYWE+UHyni6BxPnxZcXiLeGllXXFxR3GLgLhtaXGPdYddeIC1q7KPh4CEsquyTEw5GkyEtWlHfJmuoKfmuHhxWUePi52ZhF2dp4B4fJ2Lp4+PaTlhUFBHWVB1THxDj4RDZWGHh5K4mW281r/iuICHuNJxh52EhMXMmXx8h2Vtspmyh11MWT5li52reHiLq2mkpJaHgMl8YXGgXXiki0M0YbWgdZl8i4S/p5ad0ryAi6CZi3h1hHFlGi5MeHFhuL+WbS5tfKfm3I+Pma6kNGmklrKgdYeAh7hlUJmymYB1i6R8dUOHdWFZZZ14bWXJzHhZdXyAdXWuoICPbWlZUEcaGkxlOT5tXXiLh21hlnhxgFRQnYd1dYedgJmgi22PpKCrkqt8q5J8XZ2yi3WWfG18bUxxXZl1gJbFj494vMWPloCEzHx1cV2dnZmgYW2LnbKSYXVpdT5HWW1UXXFpeFlxVGVdca6HtZZxi7y40smdhICrv8K1i7K/xaugTISHpI+rknVtGlBUUI+Wsqeui6uSnZK1lod1XYegVF1Qi2GPUGGgsp2SgIuHh52AlpmyncWugI+POVSEcXg+UKCHmZmAvFA0VKSrvI9DVKSypGW8dYeSi6C/mZbJh4CEnXGZi2mLfFlZeIR8XWGEhJaEXXyHdWlZbY+umYdxh22PYWF1Q3VpcYtZfHFpq491cZ2Ej5ZZfIRpaXhllsmykqCWh6SWp6uZoLyWmUx4vJlHfFlQZUNtaUyAnZ11rpaWlp2SmbWkVJ2Ai1ltpKR1mW2Pp5artYCPfHg5LhoaaV18aZ2geDSAkpagh6CSh1mutdnWvJaHhLi/0r+1lqeZkmGulqCZsoRheHiShHFpcZ2HnZm4rpZli5mZhHiZj5a4hF1Qh3yPhIRpUGFdcZmPpHWPq67CyaeEj4BQZWmZhExdnWGWh52kpId8sq6HUG1Mv7K40qC4gICkgISZpLyZpLWrh3htZXVdh3WugItthIuAbXhhWWWApI+1tYSLfIBlbYB8eJayi3xpXYtpZYCHkot4nWF1dWFMbXyulp2rp6CgoISWkpakpLWg36R1pJaWp9aLZVBhUGGEnXFhfJ2WfJZlUN+1i49haV11hJlpWVmknbJZaYBdfKRMhIdpOV05YVR8fFlph3Wkkq7M1pZth4uP1rK4knGutbiutaeSmZK1q6uLh6eHcWWWbZKLh518lp2EYXyrv52ktZm1hIt1kllMaZKAi4t8YYB4bcWWi5K41o9hj6ughLLFcWlZLj5HZWGreHyEtbhQWWGuq3h8ac+4wquZkotlrp2rrmmrwrxlZW2WpIeLsuaWTGl1lkMuVD4aYWVxcSltpJKEdWV4YXV1bXyEdYR8naCPkpZ1VIB4aYCSlnWrR12EeJbMvGWAmZ2WnafFq894ncWLxcnMz5l4h22PNDRhR4SEbXGLvI+4hGHWzKC1WV1xmZlxTF2/v4uncV1pi8XMsmlxQzS1WUNhaW18dXygoF2Lv6e4ks+yrrjP33VlZaC1ycXCpKCunaSWpLikdT5HXYeWpFlQdY+HoHiAhNyglpmusqe1h5Z4OVBQdW1xmXyPj7+Pkp3Z5t98j8yAj3iWYW11j22AXZnZfClpdauHgHhMcYuHlrygp7+ZgG2AeHynsqR1vObWRz6yoNmZYXydtVSZlpaAXYCEPhplj3GrVDQ+WWmAUHF4XW2HmWV8bXGHdYdhYV1lbWmLbYBtdZaLaW2koKdxkparkpmHnZbcq6C1soCHkmGEeIe8xZKytXVUgIB1rua8oIuu37/JmbidnaSP0plt0nWSaXxHlpmrzJZ1oHGZoHx1UFBtcUeAj4+dpJ2n36udh3yntdyrwqu1squ8pJmgoJmkrtKHWXGAPnyZnbKSkq7SroSShHx4oLWdpHyknauggKCZgI9lXW2Arr98daDCzJaHj2l8maePj6SAXVA0ZZ2PaXUpR6SLQ4TPhL/Pq4R8cZ2rsnyAdVk+nYuZq6S/rqQafHzfv4CZbaSPq6CrrpJpWWllbWk5ZXiHi2VZXWFlj3iPhHxQYYSgj5mrnW1pTC5HWXV4j3i/mZJ8oICHhKCknaeupJnCpLy8j4+rfGl4zJl8kmXflqSAXXx4h+bmyYB4yaB8gLLSnW11q9LMi4dUXXyPeISEj7iSeHyLtXidmYtZUIeLmYuSwpmrxdK/squdnZmSzMzMuJmHq66doKeWwtbCYXWPp4BlTHWLoKTPv8Krv6CddXyAgHiEwqeyWXGPsoBlYWFtq8m8q2WP0uagz7ySi7h8dXV8q3FhYXiddVBpdYdpnUx8mcLWp7WSR4R8j52ypJaWhICAhJKrmY+dGrLi2eJdZXWSgICgi4Q0QzldUEMiGp2HgIBHWWlZZYCLhHyHfHxxvKCrmadhaVlDaVRZUG1xrpmdtaSAUISWuI+dXbWShJ2Z1pagj7y4i3hdfLWktXinVFRhZauL0s/ZrsyLmae438VlsoDMrqCgdUx8oHWdsqd8aYR8p3VlNIR4ZUeAj12Zrsy8xdbJzL9lYb+HtczSz6S8fJZpfKSdvNnFwnyAmauHdWlhVHzPro+uxa6yhI+AUFmAZaugloeHkrIihHhlh9yrp9mydXiZssK4nbiLlqB1UEygoF2WwnxxsqRteKS8hFS40rJ8ZaeWaYensp2AnYtQYZmgcZmEj49lkqensll4oICLgHh4kl1ZhzkaGi6dbUxMbTltj3WEbYd8aXVhoJ2Ai4CEgGVtVISLYUxplqensrKPi4euq7/SbWWPhJa4rnGk0jRZq7yZcb+gsoS8oISHklSdq4BUOYeAp3F83J3MuLWZh5mLsm11hKCSXUOAaa6gi2nZkmU5VFCPlpZli6e/3HGSuIegvJmuoJagp8V1bZ3m5nW1ya6HZZLJuLy/fBp4nYSLj6uEgKd4q4+dYV1xi66/fEedeHhhKbJxPllth3Wyv6SnoNmPq8XPbXiPnauPYZmdtW2EeKRhNDmnNICHgLWybXGWfHxtVJ2di4+LknWH0ryAkrXJ5ua/wlBUZYtpUId8KW1plnVtR4d4h4egkpZMfHhpbWFxgGmHq7yndUdHaYdpmVmZh1RUQ+bZoIBUh+KSXXxZp4uPfKd4uK61v5mdTG11h3VZXZZ8hHhpq12HuKuLpLWEoJltndy4rplDj2W1tWHJlnirncy8ZS4phGWSXWV8WW1tnYCSklCHp6vCsri/2czClo+45sXS2cJ8pObPv6vWhGVph7yyzJKEmW1tkni8h5aZrpKLzKCdmXWkkm1hi3xZWc/fZVlp3JaWi7/cruaPpLzPmZmAfLKAgEegxYRhZYSEkodxgDltpGm4aWGdnXhDoGmZgICER1ApaXhxgHGn36ekoF2ZpICAi7VlVBo+aWkaIm2WcXyLWVBpdYuAj2lhUFSSoJmuuNZhXXiWoLinllSScUegj4SEZWF8ma5lgJadtau4j4S8xbJhwnWduL+rWXyWVIugrriSp6ugmae8oOarma6/oMWrXbKHxa4ai3G8loSgoGFti5aHhHhhdWmgcXVpWbyAfHF4wp280qSn1paksqdZi4uZj6uyp2l1yYuPi3yWsszmwuZtVI94hFlpWYCSroSEZZakj0yZhJKup4dti8Wuwry/oHyZ5ubFmbzivKu/xXGHhJ18i+aENGWLzOKEaZl4tdKrkpKPgJ2Ej3hlbYB4oF1xdUdZcaBtlp2gTGWWeJaWnVltLkc0TI+dYWlUTENxQ1ldbVBZZYegi3V1aZKSuJ2ukqC1rsmguBouXY98aWFxeIBhoKS4pJ11lrKSdYfFxa5lPpmdhKB4sqeZeFBtoKu/YXGSfHi4v7XJoHyEwqvCsrKEh6edpKCPq5aHhJKPgFSdnW1MQ3WEj3GLZYuyi4RxbbydpIe4hKu1nYekgIRxfLJ8ZYukoLVlZXWZpJ2dhHyZbXiWWXVxhGltdbWEkp2ApHFhoKCAgI+PvGl4hMKdq4uZoMy/ks+/p6u4oLWudV1UfKCumaCEmWmgh5mreJmglou1fDmyoI9lTGmAdWltXV1HgGWLkqCnjzlphHiLeI+HdVA+WY+ZGj5tQ0xZNEMuNHVtTGldfG2LgHF4kqRUcY+Lj4eLdXidOWWZYXFUQ2lUksWghF2Lj6eZkmWP2YfWtZLc5s+4dbyyoHxtnZJpzLLmlqB1h7KWkmVd0tbm5sK4Q3WruMyyhLU5kqBtp5bJpHx4j21DUC6EVEOSLlmyoJLFkp2groSSp7JhNExHTG14tau8vKSdcXWZvKeuz5aAh5LizId4VJZ1j51leKePmZl4i3hdYaRhba6dp3Grj4Cr3Mnip7LP3KuPpLLmwry/p3GPki5lcWlDdZnf5qBpbXydmbiLj3F4XXU+eHWSlryLVFApOWmdmYCLZWGAcXh85quyQ4dDGhpxxbJ1bTk+YV1QTFBtj3hMeJmWj2mHgGl8VGGHh2lMaYurmXFxNGV4bafMnYdMVJmnmYR1caCLnaCgp6e4q3h1j518xadpUKurj3F8uLigyaR4eJLF351tkmWW37Wksnxpkp2Ah6enq6eETEx8XVSLkm2LPll4maCLmWl8maSHlm2dbYCHh5aWeI+4kounro+LmYuHaXiyda64lodlR3irsoSPh3iWxcmkuKCnXZmHq51dvL+yi4SEtc+PpKeLpKSnzNzWsqCLgKe8q2VhaYekXau4uHinkrWrmYSSdZ1MbXWHWWmLfHxdeHVtYXiZgISLrnV8cXFldZaSeJkaGhqZaUw+WUw5XSkuXXFtdV2Eh11UhGWLoMKWVGFMcXV1bZJxRzkph5mLfKd1fGmZuIukUI+ycZJUnXydsqegtaBlbWWAq4BpcYerpJmSq5ZpmdareG24oISyj8+ZmdykVLx8i7U+h4SgpI+ZjyldbXF1eHhdUENlhISHhJJ1hJKdoJKAbXVhcWl1YYSZvHiSkpagzIeZp4txZaCZp6edcYt8h658caR8YW2dq8lti6e4WXGSkoe4v49tj7jCv7/ChGmgq4+/rpaWj4d4pFRlvIePfGW/j4/PlqCkoKedi3F1eENlOVBdgJadsoB4KXigv2VhfHhdcXhhWRoaeIBxYSIaGho+XWFQZWlMQ3iEfEcumYt4h12Ei4dQhIdMQ3yHgJKkaWllTJKZgFl4cWV1nYRtQ1CSv4ddba54hJ3CkpaAi3WHuM+ZoMJUdbikp4CEgKvZq4Sgj2ltpIt8eLjmtZaZfJK4vI+Wi3EagJ2LbXykj3FlUGlhfHF8TIePloS4j22WmWmLkqRtR21lkoeAfHiPv7JlmW11j4udcXySxZZ4WUegpJm4gGVhlou4eJmruJl8h+aWhJ2rkqudp7i1wqR8uMKywqekuHyyvLJUcYSki21UsnVxspa1zK5UrrKubZJtXZaHZVRpdb9tfJaktaeSj2mgWTlHR1k5PnF8caeLVBoaGodtTD5ZGhoaQ1QuLlQ+GkdpR0xlaY+PknVlhG2LZXFtgKCPuHg+hz5doLidoHGZi6SdfI/FmYCZlsU+cbjMi5KkgHx8pI+uvK6yj53Wv6dpncmEgHWLq3F4wty1dZaAdZnCh11lTG1xgHGPh3VUaTkaYaSLUD4amZ2ElsJ1i494fGl4aW14nZZ4fJ2SoLi8pIttXXGSh3iWi4eEbZJQeKtxZZl8kpl1fIR1oJ2ghBrcoJ2dtbjWmZ3crqudq7y1p3Fdkp2/37+/da6SxaeAR8WWp5mEh7/mq8+rcRp4eICExV18TG3mmVSH2bykpEykhCltGqCSbVRxkottaVQaKRp1bT4aGi4pKTQpNJaglpl1GkNHdZY0cbjJgF1HeDS4q4SE5qB1Q8mydZKgzLJltcLJrq7mvMKkpMWSgHGLtYRxaUenq5LmyadxeJnW5pay4uZ4cVnJ5r/ispaEhItxbXidta5U5qCgYVl1roeEoGV4abWZh0MaKW2HfLWnhFlxgKd4lrKynYunTHhdh6eHmZltGnWELnWkllS4OVC45oSPdYDirqfFsoSPTHhx3+bMkqt8cYSynY+PZcWLvLyurtm8bYunrp14ss+/2eK8kofm5tLJ5sK4tbiWj5aZXV1MaYfCgGVhcXWkoHh8dY+kXVmPfG2EuK7JfHw+XV1hPpKHeICPbVBlgGkpKXG1ZVlpGhpMZXG8YYSLdXxxi4eHdYSAhGVtZaCPxdKHoLi4lrWnspagmbLmmZJ1R211dWl1gISPtYedmbW8v7+ZrsLSq6enwo+kna7cwqeWaWV1maCHbXGdks+PdVSWgIBtOXiHcZZQNG2HbY+HZVlZaXVpcWU5Pj6WgIdxoHV8mXFxUCk5aYdtfHGAcXWSrrKSq7WnnZ3P2ZaEgG11maSybbzPi3i4p3yAsqCgZaS1nYuSmY+PmYunna6Zq514rnWWeMzmpI+136C/xbWPi3hhgHGEdVCZfJ2ZhxoaaYuHZZKucYCdsrxhaYvFj3V1eEMpYVRDlik+aWFxZWltUD5tbXx1dVk0fMKWXVlxgIR8lod1h2mEoGVUZXigh5m1hHiLgKeLh7+PpKek5sKybWmgnYeyhFlQZYSnnbiyq6ukoKS1p7KZj4C45pagp8y/j3U+bYCuoHhpaXGdi3FZYWldXWWgtauEcWllWVBdi3FdNGVddV18YWFpnXhheJltcYRMUG1MbXhpYXFxdXF1p7inj5JxdaSZloeZcV1hYWGEZZKHsq6Ei3hxfJ2ShIdtrqeypJmZq6R4pK64h3xxfIeEh5m4pMyZp8Wgv7+/XYdpUG1ddXE0gIuPhDRUUIt1fF1UeKSyrqCyfGmHhHVQR2F4WYCWbWldTHyALlQpXRpDVENHGimER5mgp4R1aXGEdWVxbV1hbXhlfG1li218aXxlhISEmavCkpadxbLJq12LpIRlgHVHaVSEp4t8rnyEoKCytbjmq6SHhKRlh4+gp3hlNG11ZXV8WWVpi5Z8YUxMVD6Elo+ggHiSXYBtnYt8VEcpPkwuWTl8dbKAknhHj3FhZS5lbXxUR1RpnZZ8h5KHQ4errni1oHydfGGLp8+kVHyybYedmZarsmVtdZ2gXZm1uHV8dXi8tcWggFCAaYCWsquLbXGgnbiyq6C8pIB4fIB8gJKkj3xHTGGHfHh8ZYtxhGGgZaR4i5aEdVCHaVSAeFl8mWGZmVRZdVQ5GlldTEdUTCIaTMy8roAuPqSEoJKHcV1HeHxdIrirzLykpHx8YTS4lp1tlmmHhLLSoGF8p5K1yacaYTmEcZaWXcKgstK/q67mXbWAbatQtXFxkodxdYt1j218Pni/UF05XaBUVDSkxYeAlnyZoGltWbU+R0NMGmFHXRphcSkav5lhlniZeD4uaYCSXW1UaXyHWVmStbKLksKLeKCdj1ltVHGgroSnmaB4fISutbjSmW1xZXWWkouSgKeukuaPtaRtlrjJtaudyWka5qud5qeLbaS/roeSpBoaZatheF1xeIeErimAbbJ1gKt1ZXiHsq6AeHFHGkxtgHhdXXGHQz5DVGHZj3xhGnxUPhqnkp3fydJUp780Q1mLUCkuoOZtVFSrv66P5ovF0r+kbaenso9tYXh1tb+yqzmZ5uantXyZlkNpXVSZ38WnvIvWrq7C5qRUj0xZcWmEi3xhQylldYs+h8nJ4lRMVIAph4RZUEeSh5lpGkyHR22Pi21ZLl1lR1Btp6BQgKCZfG1UWTSAdXjFzIuWmbySmVB8p7WHh4+EeLK/v6fJgFlZWT6HaYCZpISZhICkj3WHhLh4lubZq6eHuIuZnbiWnebm5uLmvJKLcUyPfICWq7JDdZZtrnyLhMyZroeEhKePh3VpaVB1cXEiPo+dwq7mv2ldWWV1R3FQIilDeHh1VBoaoKe8eKCAmbXFz0fmfF1UGmXclkynstyZTLh4j7/c4ryduKuAWWWAaV18kqvFtZaLkrLF4ot8dXg5R2FdksyrhId8oIeywsyrfJKHYXiAfItdUD5MdY98Gke4tZmAYYtxTC4+gKtteJ2/TClMaVApXRouKTlMPpJUUIeAmYR1ZVlDPmFULkM+p6C1lp2nlpZtQ3iWcYR4i3yZxaeHeG11bWF4mZmnmZKAtaCkpIRxeJmksrKyyaSdknyAp4CrhITf2au10qdthKCdfF11p6TCdWVhgFl1ZVlpaW1lcWF4fG2PeFRpj6ddcYekdYudcYdHZYRMPlR4ZXGZlqSAdWVMi4CSj3VlfKeddZKurqt4aV1xj3Vp0sm/uIeAhIBttb+nnbKgaTlQYXhldZKHfHxxbY+dpMKAYXxUUGlDaWmddYSPh5Z8uJmZrrKdgFlxcVBlcWVQhGmdi0dlfIRDWWFdVCJUVLWZaZKrj1ApNHykaWlQVCJUZWl4R11HZVlhaXxQQy5HKWmLZafPfJmroFRlWYuysq6LgJmgq3iukqeEeHVpaad4gId4dbirvHyEj3WZh8LSmcWWi5mEp4CZnY+gybJ4lrK1j52WeHhtj5Jxi1l8gGFZmZllcW1dGjkiYT6ngIBlZXiEVGltYYuEfFmLXaB8hG2Ej49tnYtHNF18srJ4oJJpPkyShHGElquurospVKRZXZaSmZl8kod1dYR8q4edeIBUVIB8YYCnOauAfEdtv6B1rnGWknxUbWlQi4+Pro+EmcWuhIeWnW2nsmEpj2GEWWFlWXFxlnF1p9/mwo/FrpnJaZantZJ4WRpUeHxDRxp4YVBDGhpMZRp1LjQpGnF8Ljl8loB4dVBUh1RhXYtxcYu4qy6rtcLcoIeWrkeSuHyyhGllUICggHhQcYuWspl8so/CmWl1lrjPp7KWuLKgmaSrnaunnauEq4R8cbJHgHhxoIB4oFRHXW14lpJ8hJKAnaeSsl2AYauuq5Z8Q3ySZXxUPlC1ZZKEeENdh6uklos5jzQadXiPh7V85ubmzI+dp51ZXXWgwnFppNxhXaRleF2EkoCAbaR4bVBhgGGPacKZp3xpZW1hWVB4YVRDh5mPhHHCp7irq22HeKCEcWVlcXhMWUyAfOJ1IqCdkjQaQ5Kr5uZUfKS1sua4srIuNFBtWXxlGlkaGho5KW1lZXyAdYBQLho+YYdUhIRHQ4+4h2l1tb9xYZ2nq7VDQ52HmWlZbbWnsnyrrpKPmad8hIt1j66ZfJnclnWdtbhlsuarsquSpId1p4d8gGltcV2WkoBhPlCPh3GPi0w5R3F8UHhhj3iPWXVxaYuHhHhhaYCSj5Z8VGFMq3hlhBo+i52reKCEKVmSj3irdYCPmau4spZxfJK4cXFpYYS4LoDmhLyAfI/PZVlQZYAuR0dZbXyEdXGPkniPYXGSaUeAeGk+WXiHR1QiInyLfHiPq5aAaYttcZJ4izlZfKSWpIfFsm1l5nWWi8KSuJKWzJ3SgFRleGVxj4CdmSkiTFA5WT6HUGmLpDmHhC5MeFk5THGkcV1dmWVQXbKuoKeWcY9xrrKyeLyAaVmAfJ24nZaHfEyEcYtxgM+8eI+82cKuz7KStZ2u0ty1oHhhgLzFeJ2Zh2VMPnhtdUd1gGF1WY8+XXF4bWm4nYeAp5aHnaeZtXGAYV0pYVRtbWlxaV1lhKc+OYS4uI+HbXGuxcWHpKSrXYegrp14gId4UGGPnYSW4nxHVLXCwniSv8+SgIRdZV1pZYdlj6eWbYttR3GErmldcVlpPnFxXSlHVEOLnZJpbY+LZVkaWT5tq3xQcT4aOXiHv8Kgnbzm5paPq5KreK6gzIBlR0NdfHiLcVAuXZJ4XW0+R0xpLmldh1RZYZmWaZJpbXVlVJlpQ2l1vKu1pI/Jkp2SkounkpJQi3WWuKtpeIe1hIBpoHiHmYCPq7KroJa1ZV2yp5mWuI91h5nMwoCEv2ldbVl8i4BHUHVHhxqLoHxpYT5ZeHyEj52EhJnCgJmPj3iAcYeHoHx8eGlMVGmHcWl8fKSZwqCueJKAdYuZyZaAkpZ8lqCPi5mLbYBxma7ccWHisq5UhGWZXYt1ZaSgbTRQTIfSlningGGPYXWLcXVtfDlQaT4abVlUWbKPcXWPcT4pNHhZdVRMOWlQOS5xNGE+nXWHhLXCVLKrpI9DVGl1Pi5dbYd8WauLZYRUUF0aQ2VpOTRUh11MXYBdgFRlgI91YXWEeId8ZavCq7yZi66dmW2Sq3yWi4RlQ3iugGVQcV1lVKBxxYdUi4+ZpMLMxZ2nkq6dhL9UTEd8fIePndKSljlZGkeSbVlZR20aPnh4gDmSrmVZYa7WtcKnrm1Mv52rp3iEkrXFlmWdVENdj12LnRoap6e8wrWZWVmEdXh8rpJUi5Jxj1mWYVR8i1DJyZZ4z6eZsqCPgFlUbZZlgIsuYTkicVmHpMx8hIdUOXWZTGWgLlA0GlRZbUyPeICEsqB8aYtHGiI0hIuLj8k5KS6/mRpMNIuERz40vLV8UMI5ZVnmpId1i2VdYVSybVkpGnFUeK40nXh8gICkUEcaKWVpcXxhj11pgGWPQ66PmTl8gISrxaRpoMWZdZJQWV0+UDSAba7WrszCj4eynYSHq651j+ayaV1HdWFdR4RlXZJ1h7/FnbW4ta6EcV1lNBoabZlZuLW/rnxpXbV8kplQIotlXZlUi3yLmW24VD4iaWFpp9mgR7W8p4+EbXVZnaCSfKdHVHGkgIeWi8xlWWGZrqt8ltJ1YZ1xh6d8OWVheHyHPmlUhFRZeISgp514aVA+UEc0bW18VDRddV21z4tlnZI+NBp4aW1ZQ1k+cYtHlotx0nWdluaZkp1dj4+Lj6SupIBth3iZso9MaSI+dUdxWUeSaYeAeHi1ZWXCmZmAR4R4i6tZXUePTFmHcbiEhI+ZdaSZoLyPpLLCcXVpWXV1gIB1Pkd8smmnkq6/kpaLmYunvIu4pIeHeHVtVKSEpHgikoB4hGEiUF18dV11knx1R4B1GiJ4izmZgJZxfHhlNF2dnZl8j0waQ1l8eJZZXUxhbYRpfJ3MkqePtbWPz+arZXxxfHh4gIdQcXF8fIeSwqfFuJ2ScUePaYuPWXFMpIt1dZKZmZ1ZbT51dV2EdW1UKUxhUHxtbSk0PmVMYT5DQ4uZi6BlgGVHTExQPovFoK6LXYtUmcyuoKCAR4DCloBZxY945rydUGmLQ3yEoJaEoJ1toLWSgD7FyaeHnYBxmad8VGV1hIB1XW1UWWWZj6C/loB8oISLkryuycyHj7+ZroSShGldlrKdnYt8lniWmVSAeHVldYd1q3Wkko9ZYaSgbXVUmYdtdXw5pDl8p6BMYXFlR3yAfHiSj5KEj6CrcUOHYWWHXWmHbV1xaXFQloSHj3WAUICgp3yHncKdi6S1pGFULjRxUHWEfIu4v3igycnmycy1VFB4oIePi12LdZKAaUxpnZaETDRphHh8bVk0cVRpWUw+TFSAi3x4UJIaLlSgmY+8q3FlbVB1WW2SeGWnaZJxma54kq6uyZZp1tmPR2WSluZlnUdDi1R8p49pj7LJ1m2ymXFlv5KSlqCgaZ2nXWFhPm2AlkxpaYCLoKDFz3E5XXyHUGGkmcyEdZmWnYdpWW2SlpmZuIB8kpKWp7IuWZKEZXF1gKR8h0dpaVl8mYRQWW2LsplZIodppJl4hF2ZmVB8rm2dq3yrrqCSh2WSq6dpLmllj4tZXXGPkmmufHGgXbyZdW1haa7mq8myZYc5dWV4ZWVxmYdxrpmPspa1uKe4zF2guLWZj66Hkl14gI91aY+WUI91p2WkgG1dgDmZmXU0WRqkq5ZtTGFhgEOdrouEp6QiIj58pEePtbKZgC6E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zIuEdYSkabKyYRquz1mW1q6dh4CAnZaup3W/srzCtd/Mj3h1VFSAgHV8cW05Qxp1WZlZGmmnhJKSh8xdtTmHWXxxTExxkkdZcVCkdVSZi12EdUyWpGldYYB1gISAeD64pICdj8KZYZKnNBoaInyWixoah4unkrKZVG2gklRheHG1lpZ1eKerstZ8wrxxZXyknWWAeISWoLydknxtR3yWZWWShHFQaV05WUenstKuaaCSvKC8Ry5xVHzZuNy4352HtbKnq9KEgHVpYT5ZTEdlaT6Hjy5UZaA+NGWETF1MXZlUko+gsouSbZ11nZadbUdlmauWj7WZv9/m5snCq52dzKtZR5ZQIqB8fF1xuI+gnc+Lp5KPj6Tm5uaulquZuKunp7jMkl1pTHhxgGVhdZJdQ0w+YWF1h2VhTEyAoJaAZYc0ZaRtGl1dbXiEh3iAlmWAZWGdpItdIm1ZbXGAUDQ5bVR1ZbincS4aQ8mLeFl1h6dDVKCLfLWPfI+up7htVFlMi4tdcYunj3jCnZ2Eq66nvKuAeKuPj6CdeHiEmWE5hJ2ymZmnoLiHp5I5kpKruKerlqCAVLK/1syStcmkv7yymY+Wna7fxYs5R1RQYVRUi5mkknySeHF8hHFpZVBUWV2kj5Z8nbKncYeLXXGEkl1QgHGLpK61mY/S2b+8xcmubaTCgM/PcVDJmZJ1Od+rq5l4h9zFxaCn5rynq52dh7Kki4+Ssp2EaWl8cV2SdWmLWYB4pI9hdV1ZhI+H0tKLgGlZhGVhgHVUaV14bYCLlmlxbXhdq52EXXiLXUxddW1lcXVZj111eHxHR1nJvJa4WaCki5mElnyyj4SW1ty8j2mLVICWj1l8WXyk5rykkoedpIuZhJagoKCHkoSWi4BlhGFxdZmLcYCnrri/YZmLmb+1p5KAbYSA2cW1bZK4wrKyxbXSzKCPsqRtQ3XWoHw+UMKrfGFUXSJ1q9+ngHhUcYB8gI9xUHiEsoB8mYRdpHyHp3FldUyEh4udsr+S366WaYDJybzmfIRp5ua/srJ4sq685rLJ4ofC5ubJ36uruMy/pHxQj3GSrkNMYYCHZXV4cSl1VHWnkqRteLziwsl8eG14spZdWW1UhHFMZUxZaXGgp3GnllBQaXWktYSAkjlHVJKkdXWSYW1DhF3Swo+PgFSdhK6AnZZ85ty/wtLCz66Wh5m1q8+/36Dirs+SR2FMZWmyj4CnoKurkoBMpI+Zh3hthJKPv6R8tZaAlqdpzLKZq5K8khqEp8/Jlq6SYc+SoKe/2aCHkp2/j6TCeFk5PqeSfHxDXbi8eLVthHF4snySZXXMh5Jpi2lhUHWSXW2HfHyPj1B4daCuoITM0lSAi12Sya6u0l1pGry1uGl1j5bCxaeSq52yoObJsua4vMzWvKentbJxlkxUnaRhTDSEh4dtPniEeJ3Ji3hhdUwaUK5hPlR4bWWZcSlhKXiELkNQKZK4wkxxi4R1zK6PVFlpmXyEcWVQNFl4XW0+2YCWi8JpwsmSi6dMj9+yvKe/ZRoaR9yyuIeHgIukv+a/eGFpj6ekmWl8ZW2ngGlx1oSHj+adlqddmZ2ZVD54ZXWrpKCZq6DCuIspKUzffISAYY/mh7zMnYuZh7J8squdgFmdrm18LmF4oLWnj7+ubZaEbYRhUHFhpIt4p3GAXWmrh7JDLlRHVKdtgIeW0pKZsqRhlpaEncWkpJKZeMXJj5adh5mWlpZpgLiL5qSgpNnF5rKngJ2krpmkbW2AfGFMfJJtVDSdpJbSrou8fIt4nXF8pGFpfHGkTFlpbZKrdWE+VF1lVMKgeHUaUId4eJKgoFRQhHGPdXxlQ1A+i0dHKauAj521p5JtXclUgMmLi6C1zLVlhLiynau8ZY+ZpI+yoHWZfJZ4eI+SsqCWloegh5KLp4CkmZaPbWGdzIeHcXiHna7cknF1i2W4ybykmZlxNG2kZaer0sKkq7WWdbWEmYtDrp2/slRULkyWpEyHfJ2gYYRtZXx4fHyWh5KLq10pcXGAgLWdh2mAp4euaWFxaXyHdZ2kp52Zv4e8eI+Lq66krpZph6u1gLzFcczSyaCPp8WgpHyueHWLdZKgi4RxTDk5knFxj3hMXZlpmaTP0p2Sj3GZv6B8h200YTRMTEddQ1mHfEeWh3VxLmGAYWWAdXWAj22LmXiAVKCkNHxQj3hdaYBtgISSta7FoLXPTJZ8j5Kni1B1i4CLuNbioIe1v6SdoJl4na51gHxplnydkoeEoKeLbXGAknGSp4RleLWuj4+rxdmSvMmSj3iddaeugIuLpKB45riuq8+8na6/gJagLo+ryZaZj4BUcXEaKVBpq4SPi22AbYdpp4/FbXxxbYRtcWFtgIBhj4RHh4CdmXFUWXySpLx8rquAlpm8fHyyq7WkmYuLhJKktbXSxebSfLXFmZKyoLyEnYSAkpmWbXhDGl11cY+AWVR4TKegtZayz4eHdaeEVHiLWW2AbXhlUBqgrnhQYZaddUN4cUNlPpmSh7h1fJayq4edcVAiQ7KgNGFthHySmafFp2FxwpbJTHyLba6AaYR8gEyrrqunrryZj5bCmZKAVC6LcXWHYY+dpIuWfGmngJKrq49xfGmSh3Vlz7XczLikcYeEgIuSwsmPfGWLaWGgnaCr3M+1yaRpVIdtkmGPmbxUVIBpacKHaW11TICSgHhMQ4B8eKttmYRMOTRlj518p+aWnaerhGFdv2VpmZ1Zab+AhI/CyY+SXYCEeOKAvLjCuKSnzNnP5uJhdbK/uJmLaXHWspaWmWFdfGFtZYunh51MZZ3FkmmEpI9dmVR1dWVHYXGSlngpNFB1dYBQTJnFj8WSmZl8mYRpXYTmYUNQh3hxVI9ZGhpHnXVQTFSgmbiW4uZMp7XF1qd8tVmAtZmWWXyAnZKksmmgmaTMvHF8dY+AtbJ1aW11i5KLdYt4uKdpklmHdZ2HuM+uR4TWv4A+Q2FQeGWLi4DFpIuArniLvK7CnXWgnZKZWTSSoIRUpKedruZlR1mApHVttXhHfId1YWFUcYdhXY+HkmlMcYurfHiWsriysoCHnVldwrWdfI9MhLiSgKuni3GWj4vFnaS4mYR1lsWnroS1tb+rroSkh1l4i4BxYZllLlCPeGmAaZ2Zp5Zxi4BdaZ2ShJmuVIeZVEdtgKRtPlBUhJZlUIQ5tbWklmGEgKd8pHiSgJ1DTDlhj3WWh51lhG1lh7LWhMy1lsXm5nWHoId8rpZQhI+nUExtUEydvHhhhNx4VJ2Plot8fG11TGVhcYeyeK6EZZbMknhlZYR4h654cVlZmcKdi4euroB1mW1Uh4RhWWFth52uj3hHVJ2WeCJli52HfHyElnyWZXigbXV4i49MWb+4h3g+cXVthICPh4RZh2WWcT5lvICywqeywl1tkrWZgKtdlqekKby1uKenlpl1v4txh49pj7LJ2daggGmgrrWdeG2Lj6CuYWmAlkdpj1RUdXh8aaeLnbVDh514YZLi4ofMh1SWbWFdhF11XWU+ZWk5taeSlpnJj5Ztp1ldv8KWYWV4dW14YYc+aXxxZUx8h53JlnyupN+8mYuAZYRUbZmLgIRdhHxZrnGEaWHS4snmpJ2SeIeSmY8+ZYBth4SLfIRxj4CEloS1sqe8pHFhi6CynYSAj4uHQ3WZfFldWW1poIB1j3GAbZbCpDlhmVlMfHini1nJz2ni5o98lp2kgHGWh3WdfGFdTKeEaV1QaWV1YXxhj66drqSuaYt1srigYV1DQ5aHnc/PrqBZj4CHZauLmXF4j4Sgi52HgHyPi3V1pKuWlrzm5m1HdXWLj6R1WYRph0OAoMKdeJZhxUxtvL+1zKtlnWFMXXVUWWmgeG1pOXiyz6ugtZZ4na5paau8hG2PhJJMdYBZGmltWWF4ZXF1pK7W5oTSnbKHq11haWl4lp2/uLyyhIRpoKuE5ubC3+aAfHh1cVl8maCWeJZ4fHFpfHGPoJ18pKCLv4eHaWFdZXx8km11ZTlleFltVEdxi5JdUJltcUyurrySp4BMi7iPbZJpYTRti7KZdXFpmY+Sll0pWUw5NFSHroBtZYCHi3U5WXyEtdagmUyZtaSdLhpQTGmdrofZtcy8eLJdj1l1cXiSbYSHoL+SmbLMknyShIC4nYDCxacaWXWSj2V1h4dppHVdh6uyv5Z8q8/Cz7yPbYudWYR8YRo+aXFUkmlHbXFxmYBxhMmZj7W8q7+ScY+4aXWZaUdDZTmWhGlMWV1xhKSHsubWvLW4lquAPl2EdWllkpKgyea/VKDPz9nFxczfnYt1aXFtoHVdXZZpaXWLnXWZgKuSmZKPi4BtcVlZYVRhfI9lLjldeJZ4XYeAhDRhXYSER0M0XeJ8vLVhfBpthGEacV18ULi1q3gpOXGZz8Kulm14aXhhj3iZoIR1nW0amaSkWZl4fK7CuM+AzxpddZZ8h5ZZrpmgmbJQUFlMp5m8pJbJsqCHoObm2c/JpIeu2YeLdVCui5mLpFmZXSmdj4+gpI9UpMnCq2VpzMKHtbW8uG1QoKCAeGFxUDlpgJakaVBxnXyH5qSnuObmsoR4hIthOS4uXYd4cYCLeMnMmebclnht0q54hKSgda7mpEcuaXWnXb+rVGWrfDS4tebmxb/F5q54knE+XXV4h5mEnWFlmYuZZYd4dYeSkmVphz5HQ4ddcZY+Il1QUFB8bTRpVGmPfFR1dYfFLpbfq3VtWT6AkpaufKePnbWyj3F1j4ePaVRDj66nQ1mEeIdxhGllPm2gpI+AbYCZh7KETL+nhKCdTISdXVmnj4SElqSHnV18caCSmYSAmb+ywsK10pmWdXiHj4vCZW2Eh7y1eJldVF2Swi45bZmHsnWAZTSuma6nlo98TEyZq6BUTG11YaudfG1pNGGZq6fFj9y1zLyWXauuixpdVF0acYtxdeagyaBZOUyuhL+Als+Pj3VxbaeZq3Vl3MXmfIfCXWVhuLyuYWVUca6SnZmPgHVhQ2FhYVmZh3GAbVSkh2WER2WEXVlHbXFhPlni37+AWWU+YTlUWWFxWXGEdWmElmFhh2FMmYdlbV1phKdxXYCZrl1HoLXJfF1UhJZldWF4cW1xvF18NHx1mZ2khKeEhKeWnafCoHykp1ldbaeLnYeggFRttZJph3iHrouLdY+8wqSkzK6rj8WndZKSj4eStYCSlml8h3WEZXFpi5m4v7igeD6ZpKuWoKeSq20+i11xR1BhbVmSj3xUWYRxYXW4oLigmY+AkninkmltUC58TIttWVDmwsmEaXiHj52uoJaSkpaLZZ2gh3g5UJ18tb+8dXzWzMK/hFm8mYd8nYePkplhXUdQkoB4mY+LhItxhHx4Pod8dYtUIi51kl05XbK8h3hhVDllWUNhQz5DTGF4mZaEVBqLmXyHq3WEVGWngJmEfIukoL+ytWFtrqCPoGFlNC5tj5anmYCWeIuHoJa4h3invJmPaXGSvMKdj5ZtTIdpi111hLx1fGFph6uPi6u14sWni3yPzKRxpHF8h3yAlrWAgFlxbZmZz6S/bZl1dYSWwm2Aro+PoJmni4erVJKZdWmPfIeneHFlYYenmVCZ2dmuuJKLj6ekp3iup2llgEdQUFBdybWdeIekrquAnaeShKCEj5ZdcYDZfKeHcZbMvKC4uObFuKSyvLxxYbVlkod8Q0NZaYeHacKLj3F8gG1tTFl1XXFdaVBUVGk+XXGLknV8cV1hllRtXWl4hxo5gI+LeJmdmVCPcYRxGniEYW0aZbWLi3yAR1mHuHhdbZKdWTRUj4eZq4Q5kl14uKDJoGmHVLKyoIt8i3WgbYSPdZmWj3U+TFB1OY+gq6Ckj4uSssW4vMV1gLLf5kekdYedj498XWlpbUOSXYedfGmkfJmgq8zJdYDJWaCHp4+EoGGAaW21dT6PdWF8eJmAi2VtVNKni7W8v4CAmXhteHydlllhNGFMaYBlZXWr1rVZhKu8hIunlkOLuGVhyWnimaSATItxXa7CWXi/5oTJq+bmeISAv66ZdbJ4bYRHGkxUdVlxh21UUEx1ZRo+GoRhgJl8nXh1NHWuaXFHcRpDro+WhICnvy5dZXVxaYSPrlQ+WUNhj49dXaS8klBZdYSkgId8eGmAi3yHkod1YSJUaXiPlsK/pymukl1M0sJ8aXi4roBhmV1MpIdZOT5ZWXi8taeZxbKnoKfmmUOypL+8v5l8XaungNx1KT5xTCkuQ12Ei6B1VNm1NBphlkwaeIdQR4SgxZZhnYt8oKdpXUdphGmLdauP5tzPeJadgHGPnZaEhGV8koBxfHh1cXiPh52Ldb9MhL+PpIeu4rVlZUd8oKCLiyI5ZXzCPkOZp8Xm3KfMtYttXWl1bYRteG2WaW14cWGEPlBtZWEuOUyLq6tQPmWnfGVQdbyWPilZR485OUdpQ3Vph7yEh4CEh2VlTIB1dYSLkotxkm21ybJdeHiZoMKkma64lnhZQ4SrbYspbXFlj4CWloSSwrW/XZaLh3zWtbJ4bV1Ui8Wdj11Zi6egpI+LmZbmwr/CzJarnZ2StcmAhHGHj4R8kqegmXh8j3yEoGllWXi1zIA0hEMpgLJ4mVSdoJaStZmEhHxhZVl4hGFplqCLxdnm5qTWso+AmaSWbY+SkmmAdVRQmT5HeJKgq4fFrtLWmZKAi480kouSuLJli5KHQ4C85oeSspLmoHiHsnGdbWlpmZ2dbYuki6uWh3xQYT4+TFlMIkxheIuZh2Gdkl14ZV2PnXxZUCJ8R0NHZXxldXy8dWlUdZmSeHV4ZW2neHxlaXhhq7XCbV1QgMzMzJJtfIunXWlUmWlhYXh8R1C8p4+yv7/c0ryWmcnM33iSizlUYaSWj6eSnVmrh0ykgLxlp4vJzNKghICZj5KAeGE5i11tlo/WuJaEbY+PdWmHYYSdi5mPrnhQXS68rsykh4en5uLmcVRUmXx8i3h1Ycmyj9K42cLc4rWnlr+/2XW4tbyrj4RHWW1HQ2Vd5pJ10tau2ZmZmZmgdbx1meagoIt4hKSHq+bSbYBh37WursWSoIS8eIeEi4SHp51ti49tVBpHR0w+ZSlxh1llhKCHgIBQUIBxhHFxYUMaR5ZtcYRtdXVtkodlgFR1hzRHXXyEko+di5a1xYeZstm8nZKysrW4j21teKtph1RQR12kdVmEj2VQi4vfv7LcKXGu2YdQbXikp22yVDk5UJI5bXxhkqd4VHFUtdLfuK5xroQ5dWWWR3VZZcKnrpKghGV8i66PnYu8fHWHbSm/TBoazMWZmcxpgKTMyWGLxT6PstKHi23CnaCZkp2ZzObSma6/5rx81sKdeJZ4R0xMZWVUaW1DdY/Jq3x8i3FtgIuPZYRx5oBxoM+WhGllNBp1ca6uspZxsrzmsniEgHxZxWWHkodtdYAaeDRQTGFDZWVxUGlUbTlMWZK8gHUifLxMWaBULlBpcaR1XTQ5aYeAGi54Q3hlbWF1h7KWoLJ4aY/Fv7WSvJarsoB4VHVxp5J4UGVxmYRQUFlZi5mWuItQoI91hJ3SbWlZXYBteGVpfISugHVdh3GgmXGPkpKAz7XmnZbmsoRdTLWHnWWAR2llklCgeGmrTBqErp14j3xZnebmq6uAj4eEzLiWYb+rh7IihKermYQpycKLbXWZYbXC2cKZtdK4gObWsrWdkrhMpFllYW2Ei6B8VLKrteaWpKBxeGl8yY+nYVlphHhxh5mdoJJxrq6/fEeLfKSEyVBxyY+ZcbK/nZ2EVFRdlkddYS51UHFQfJ2SQ4CPVKddQyl4h3hZWUxdR0x1fIA+gGFlYXh8bS5dUGmdUGVxYXyrgI91dbLMsp1xj3WPv9LfhFlZXY9hLi5hTDlZZYBdR4B8ZaCkhF1dnXxHND5Zj3FpWTlxlougaWk5WZbJmXhxXYBtlq6/q66dnbiEgExQaaunp49thJ2AgHhMXYRZVIdldY+SzK6EkpmAfLyPj2mAh4eSq8y4h3yuv7ikz7iZrrV1hKDFwq6Znb+8gKC1km2Zq2FMLhoaPml8ZYSZacmWv9aZGmGEvG1dgHWHloBdUF185t+4nYeWmYuymaSE5tKgpICPhG24h4CEbXVxGlRQbV1ZPkySbYuygIR1eBpHYW3m5ryulj6AaVRhZUx4cZk+PlRMaVRtTFlDPlmETF1hZYCZgJK8ya54fHiSq8yurlBlOWWAVEx8aXE+UG1tfFlZZW18XXWSmXVxdWlZcWlhVENZXWWEi4tpaWmHnYTPlkySi5KyoJaElniHVG1tbWmLh4BtNHVpZbWyhG1teGlpabKHZaurcYCdh2Xfv7WZj5K1sr+gloePp6vShMKuj6SumYeSyb+8nXzcp4TJtW1HXaSWXWVxVENlZS6Asmlxi5KkVEdphKeHeHGSndx8WV1pYZKgsrhxh6C8pGmWgI+Wq5JpgJaZeIRxfF2LVF05UEc+VEeWcWlZdW11eFlpaVl11quLOW1ZYYdttVlZi2WZR0d4OUNMi4s+ZV1ZgKerj3GHi2ltrsKrTGmLoJ1UvJJdv5lZnVmEabyki1lZZXVpOTSEgHFxq5KSj6tlOWV4j21MXTRhQ4eygHhtR0xMuJm4km2Hj8zMcXV4dWFHVHxHi52ycWl4YWVtj4eWbXyLaY+klpKHmXGAhKCd38+kcaSPlq7Wp5lUz+LPtWXmuKSguL+AeLjCvJm/0nV8vEOdoEeri2VHQ1lhVFl1luKduMLci2Vpp4+ghJKWoJllfHFUoMzSuLygcWFQ0llxi6uZsniWLlmdzIeZj211dY+kZWVQdW1HPkNdhKCZhJ2PZYuLuL+kfFBHh3FMhKRpYVRUR1RHPmk+cXU5LlBthMWWrqS1knV4aWmgvMld1pbSVFmn2Z28fJ0pbY9thIBph21HdZmrq6BMh4c0Pp2SeKeEVHikh4RQGlltXVBMeI+ZmWmynXyufIuEbXhdcXFZcXgaGnxdj6saoJageJJlXYSSoGFQuKR8pK6SaTRZktKdgJ2PuHyAq7K85s/mdY9lh7y8sqdtkmUii9/F39xZdXF85rKdpM9xcaRHdbJxgKS/kpbFv1k+XY9lUFCLoHydwuZ8Ihrcv5JxR5adrpnmgGWEcbjJ2eZ1YVm/oIeZeBpdmYAaYWUacYCEj1RHWa6ukoR8uK6PmYuPuGVxiymAq22rj7WHoHGANGllXW0aOY9xbWVtbZKdtY9hlqeZslS8wsKElnxxYaTJnaCPbWmHoG2EnbJhcWVMlp2AlnFtnc94dXUpZSk+WVQ0Q3xlYXV8gIt8rq6klriWdbJ8dVBQYUw5Pj5QhG1ti4+nhFmAGmG/z6RdZearz8+ndYBpWYSEi524uLK4i3G/0szm5ougj3F8XUdp5pJ4vLyyvICSsnV10mGS5nFUOVRxhEM5j5JdKW2Si791VIttq4CWdcm4wrzm5o9dspJ4gJmHhGWLvIdZVJZpktJdNG1ti0x1mYuEh2VtcXVdR2GPmZZdhGV4eHhtYWl1pICZpENhYYdQrpZtZY9ZNExUkkxdOUx8i2VlUGltaVSWpJZ8dWVteLKnpI+dZYeWmWWPhJKLklRxgFmSgGlHaXFhdXhZfHGEQ1mkgGl8gEcaVHFZaXyPtYCSZYeZrqSyxYukXXGZi2VHUIAiXXx4PmV4fG2rlqBlpF14i7JhaVm/gKCdtatti518eISZnaDCi4d1uMXCtXigq3iHnWEprq5xbWWk4sKHq6egroA0dZl1GkNpdUxHR23CuIeypICAgHGHbXGHh4fCpMKntYBtq66WfKR8nXxtxXxxaXGEnYSP3ISZbVRHKVmAcWlxRzlHXaCSeItxfJaSpJmHeGVQaYBlj6eLhFBlGr98hIuScUdlNEOHnWV8ZVmEcYRQgFB1h2V4YV1dfMXZ36ePdXWWlo9tcYSZtUdUi3gukotth4uScXWAYV1xZVBtj0NMbXyEdUxUZVlhcYegtYS8loeAlp14yWllaZ1tXWF4fIBtiyIaUHhxgI+ZfIuAcVm1oKRZaVRxcXG8Q4eWYV2n3MyAsqCWUKeZv7XCzGWHrsKSi3yZtdaEeKttVIeuv5mEgICAj4t8VIt8p3xphHyknY9xZWFpXYBpfIeHoMXCbWV4j9nPhLKEWZLClquSta6ZWZmPeJaEi2lUYVBlWXyZZYt1oJZxaVmAnY94XWmAh5aLfGl1j2WLkplpeI+HmVBhR51ZbUxUZVRHYYRUfI+1h2ltlmlxj7W1dYSS0s+ucYdHTFR8p1RMYaB4hENdGi4aImmLlkNMgGltYUd1WVmWkllpLmlUWWmdGho0snVpcafMp2WSj+KdmVCAXVBdgGVHTIQ5YVmWhGlxq3F8XSlxVLiknY+AVEOElllxYa7FpMLcsszWuLzPj7XM4ryrluanv7VxgGldYYCZmZmSnbKEpLyZkpbPQ2lxXV1lNEdMcXx433Fxq4dtkqCHacK/gGldkquHfHXJuHVhz51lgNzSh4+Lj4eLq52ysnirPl2rtdmLWcWEYVSdfG18gIeEh6SgwqeLdZ2dq7WH0rJx1taycTlUh4dteGF8LqdQi3VlcXGWTI85VGlxLlBdNLxQGlBxpKBlUKuAp3WLgKugOW1ZbZ18YXyWVFlQklRZlmU0cWUaWVQaORplKYBtR1l8pIeWuG2SXZKrnaBhTHFQUJZQeDRddV1lR3GAXUNlp498WUdxnY+rjz5lccx4ZV2WaUyLlou1zK6ZaY+LXeJpZebfyYSufJKAllmSNEN4lnWWoLKdGjlQcaeEZVBhgGnCi4d41ryyh6DmUHHFlubFya64nbWPR0dtv+agh8LWXZaPhIvZq49MQ4e8wr98mXgicYuHOWmdq4RQcYRdfJl1kounsrWWcY9dYXyAhJKWoNKZoJ2LLl2SVGF8WW2uh21laTSHfKDMgItlVIennXykgHiHh21ZPlBDeGlti2ltdYuPh2GHfEdpWYt4aWmHdWl1dV0aVIcaQ2VhZYddeHGPfJ2Si7KgpKe/q6unYWl8kmGHdWlpUJZ1hFSAcYCdh3htcV05TGVQGlB1bVSdeGlpeD5Ukp1x39LSi11tcc/MvN+1yaeSj3VZpItdYVl4WVmddavmgGVUtWGymb9lbXyAhGVUdbKZq4ePv4urtbWWq6SyhLWkh51hhM/m5mG1oJarpHFxaXGHi11di6dlR5JpVICEcYRpq52dbbJlXY9QfIRpeI+ZnZ1ptWFdaXxUgMW8pKSgli4+cXh1bW2AgHFQfKCHeG14sqe8p4tZpLKSh3FpYXGHh6vCfG1hbWl4knFlPm2AYRqEeGlHkmWAj6BdYUxUXXFtPl05PjlpbXyWeI+Pna6guL+rrsJ4i4t8YXFUTG1dXXiAdXFUbW1luMlpgHxpQ2l8RxpMnaSHj21DgDk5fHhMi6Cdv7yZaXXm0qfFz9l8i2mnZYRhgGlHXVB1VIuWp2Wki1BZgJ2/p3iAcVl4kp2kNGmZrqvJuK68gJKSoIervM+8gKCZrqDCyaDMyaenNHVtdWVldXyHh2GANDRQdXyWQ1B4mYuyfICLhGGgoFmZmZKHdadxhHVpGke8eIuEXa45XWlhaV1hlryWhJKAroBddY9pcaeZGoeLmW2ZYS5ZeHidoG14ZUdxacKglnhtUBqEfFlxGkxQTIB4IkN8Gjl4aUNtNEM+ZWF1bWGWeGWZeJay1oeucV1lPo+EeGFpWV1pgGE5ZYBZZcLCh51lh4dQhHFphIuAnUw+Q5auVGk0i2mEpNLmYYCW5ua1nbXJpGV4fGl4aXyHfIuP5rhxRznf5qRUWbjS5pZpUHyycbK8bS6Wh21tpJbP1ouAoOLPgICHz7/cv6fM34uEzISLi49QLkOAXaSnoJZDeItpaaR4oF1tYYegz66Sh2mkrpJdcaudoHi4q5KEGp2n5njW5tJ4p11lXXFdhIvJspakp7yPmZLSoI+duHyyhGm4j10aNFmPpK5UfLWymYB8km1ppICPmaAaTDlxUExlloBQXUyLfEcanZZZhEwaXZmLtaDC5q64uHUpaXhxYavPoIBMbYSkz4R4bVA0fGmAz6tpfHxxi6RQVJJMlhoabXjJv12EIoBhmdnWvMK8gMKytbin5pm1rnU0UCmHq5aPh8LmuIdDrubJtZJhvL/meGl41oCSrm3SPp144pm1oHyusuaZaXiylnirtYeu39KgcdnmdYRtvISPaXFtlsKuzLyEdZJltcm4oHW/0rKyq7LJj7K8ddbPp4BdkrXJeJKngEe8cZZlPpmLhFSnvJlxUJZ1j654j7WrNF14h+akj3FhcYBlgJl1pHE+XXyHhKRxUFRtaYeEi4dDGoRMmZJ4VD40VKQufIBpUGk+KWVtTIAuXXiHq7/FrrKdi3xZXZlMeIR1XbxldZIiPkNlmWFMR22nYZbJq3yAkpZli6eyTFBHPoSkyYtQi8/FgKDFyebPp7KuvHVdrqeZtbiZq2lxfIu8i3iZQ2mZnVRHbZK1rq5xj7+EoIBlj3WWgKeLoKtxuHyHvK6ZsqvSZdncz8Xm1s/i5sJZUKekq51pWTRQksmroJaEpJadmVDM3KDZfHVMYWl4eHGLp4dxR4BxoNmAfICEPo+8dWG/h0NxloeSmZ2ggHyLdZmgeClZnT6ZpIRQcVmHWUdlVENUjzRhWUxhdVBHOUxHWYSEYXhtUFlZTDRZTC4aYVBlR0yHTBppXTlZXV2ki2mSi5mSknWnmWl8cWF1h0NHaWVdh1RhVFllUGVUdYuSlqtdfHWLZYegpGFMQ0xhmYt8XXG1pIDSltzm1qTFxZllUIB4Pnx4aUd8hIBZNGmLi4B4ZWFtj6uWq4BteJKggJZhZXigq4d8i6C/i21MhICdfIvWzKvctau8vMKyuLirfHi4lml1cWFQXZarfHVUdZari5lhpKePoGlxcad1Lml1rp11q5mdgICLhFl1mVl1gHirvId1nZKgoFCPpMKSbc+PbWF1aWVDZYdZQ1mdlmFpbUc5gMVQbVRtKVllUBp8TENxZVRxmYc5TEx1PlkaGnyAj49Hh1RHQ3htbWFxdYSAfFmSj4uEh5ltq4uSfGGHUFRpOaurgEcaXVB8Q4BdcZJ8XYt1roR8hF1DVF2LpLy8pLJ1v5Ky5ovP1sLM4sxZUFBUdYuWh1k5PouSnVRZcXiZeISPoLjMcSkakpmPpKCZfJa1h6eZgISHda54aaB1pKC8oK6SrqSSi4+8oI+HtYCrvItUYWE+TGG8i3x4TKekp111VFSgsmFxQ3zCWVRlpKSEi5aLnauSkml8WXySoHyrR4dxi8l8mW18oF2HeIeWoFltlqurhHxxR0M5NDl8loA5Q2Wkp6BQXT5UdW2LXUdQXVAaXcyPhxoaGho+XV1tPm2LpyKAhKQaXXiui4CkaXFdoKRtcXykoIt8cXiHtY+ZbYCHgJ2ZpD5pfHxpna7ihJKAOaS1tZ2PWVQ+fJKyv4t1eIdpoObJtau8Pqe/rtyZXWldhHGLq11xOYA+VF1UmaBppOayj2UuccmnfD5UdYfJuLKrj2lMQ3iWh5aPxcm/uKuggJZxrtKnj7jmrtyuoHiEYZmuoIS1i6dZmb/cgGVZRz5peHW4i4+WWXh8ZUdQj2GSYcyHZZKPaVBMYXyLmZmZbaCZmcWri6RphJ1tv7iPz2GgoHV4WW1QNGFpp2VdZXVdp12AYVRxeExHZXhQGm05fF2ZUIBdQ0dxoKA0NEMaVJlhoJldfJ2AeFRZTGlQVEMpWVni1tLZrrigpC6gh5mktXxhXV1taWmSfKS8hKCLyY9pdYuAoGVxmY+roJbfdea4cXHmacK/5tydeEeWp4txPnVMVGV1RyI5Q2VxWXxZfEc5xd+WbYS1lmmnp2FMcXFpaYdMi11lPsmZdXhtv8Wrq6SZdaurloe8p7iEz66nuJ14R6CEgHF8sqeP5tZlj3yLmXU5kp3JwnySbXF1bY+15qRlp3i1nYd4hG14gIthh3FpZY+klnh1VFCWp518vM+/UFlUVGEpNC5Hh3h4Gm2LmY9HeJaPwm1ZaXEuVFldi5l1TENMUF1xhGVpR3VMZXy8kl2PpG2SpHx4R3WZtaB8Rz58sqe4ll2LlpZxh4t1nYSLfGldj2V4fHy8mRqHsq7JZXVlYaBtj52Hh5KLpOLPvJa8km215ubmzGFdcXVHeJ00XVlteF1MLikaGmWHgIRtVLyZkp1pdW2HmZZhWYSEZUyPj5JphExlh4vCkpaEj5LF2biZmaeyws/Pj6C8j7incXhxhJmSq8+r0tm1cWmH5nVhfHiWpKdpi4BtR5bm1qvZwpJZp0xtfI+LaZZtaYukq6eZi3iZUIuup4R4i4ekrmGZfJY+R0xDR4+LeGF1sqBteI+kkpZlaYRtWWFdXY98gDRQVIeAgGUpcVB4aWV8R2U5TGlUfKCLi491p7KLh1Q+lmWdoGmrncWSkmF4fG2Ah4eLcWVZeKdhaXWHnbKSrkePcYSymVBdeJmnrnHW5r/f5kOZpLi1nbKHeIt8TEOraaeHj3VdPj5MUFRtGmF1i2mgh4C/R49tgGmZlotxPo9pi2lxXWFxdVSLi52kp6S82bygtZmPnbXCrqS8yb98j4ekUF11caCScaurxbyduLiZh1Rpsrh1cXW1z7Vpq7+rtcXMhKBhRzRDi1RZVI94wqSSsm1pfBqktZl4ZYCAgGnCsoBHR3U+WXV8gGWLPoR4q2GSfGEuKXWPfC5lVFR8WV1HKT45R3FZWWVQQxo0Q1CEVGl8hHVQoICdpK6AUEdhrq5DcYeLTGGZh6dpR1SSTFlHp0NDbY+Pj21ph4ukh5Jxh5mPvKR4WUOSpNbmh6Su3+Y+oLK1i52Zj6uAaUxtnXxtdTlpbV1ZTEdUTEdDfIR4InVxmVSdknw5YVRpmYRUi498nXEaKWFZTGVQVLWyhKSgoKCutcWnh8mAp8/WtcmkfGFUWRpxaVCEuHjCvK5leIBQeHhZeHWLxc/JxXxtaae/zI+Wp6edfKt8R5KkcaCrcVSAoLJ1ZW1HGoe1kniErnyWUG1heHFxaWWZtZmAQxpxp2mEUGWAh3hpUDQ5hHF4h205gMWgGkNDZRp4lllZdTlHdWmEoKeuq0MafIugeHEpGi5lwrKgj4+gh7VxOXydfBp4fJlli6RZoK6Akp2HddnCj3xheJauydKrwo/mmYAuh1Tmya6ExXyggHyHbVCWi4QaGhoaR3WkeC5Dh1ApGmmghJJdhGVZVGWLkkNDZVCEhHxhbYRZq6RQWa7JpHGEv5KAq3hMbZl8gJ2Wv9zmeJK/XYdpUIRQ3LiP2ebJGl2yhxo0hFk5j7Wkso9Zh7yuv5Yuj3xdhGllVFR8NF2SbYCSzMW1kot1WRp8aXGHpIRQgF2dgF2EeHykkm1tZXyAgENhdVl4mXU+lp1xIlQaGpJtXWmAUC6Hi2GSmWlQbZmZi4/Fh4+uoI/JeG2gaWmWnad4baTiq4SAmW2PbWlhlqCZv4SLR4Sgq8WLsriPXaegq5KAWYe/q7WuoHi84o9ZgObmq4txNLXCvFlMVEeLtYCPUGFpZWVpVHFlgG1lNC5pYXhQaWVlXXhUTDmdlpZ4VClZcT4ikouEfOanfLLPlqu1v8XfuLWgbZ18h3HFpJmExYeAlrKEma7JuJK43FmE0qR4cVRxWYB4oK64nVCPq7+Zj3VZZXVZaYdxbV1dq4eZkoSusotpdTRxXUxZTGmATEeHeIRlcXE+j4C4dV1xkqSAUENMTGVhOUeHdUNHR3F4cWlhbWFMWWlxgHw+aWmHkp2PzGWHj3GPp4+SWWF4eLWdsoeroLhxaXVhbXV1uHxtdcykVFl8q5mLfG2rvK6WbZKnwpZpq5m8xZaEeNmnq4Df0sVxNHWZsotDTG1tXWV1XVkiTDlMhFBQOWVQZVRhj2WEcZJhZW2Pi2kaUFSHi2lhaVl4UJ1tZXGPp661tauSoMW8wp1QdaCnp5J1maCri494ZaS/uISdwrx8mbjJq4uLtWVlaYSLdYCgrqt4mYugsq6ZPnFZPqd4UDmLh2VlhKSEcWFtj498pIdQLmWSgFQpXXFtcWWdNJKPj6SLfIeWmVRhVENlbaB8gHg0XUxxaZaPVClHh6B4XUxdeLJphKSWcaeSpK51aZKubWk5UIuPaaegfHGWbWVZYT5dVLWLaZmyoJanpIeLcbh8h5LFeJ2LoJ14XVB8pMykdYCPZZK/xbygi5aHoJKSh4B4h0xZQ3F1VFRUInxlfD4aUEdllmFDZXWEgHxdUFk+UIunVHVHR11ZWTSLbW1tlnigkoeLYXGn5uaWh1BxdXiSWYuHzJZtgG2SnYBZmaeWlqu13+a4hIeSfFB1YYDfdZmPhKCZp6RhcXGPRzmEdWm4rrw5eICkTEw+ZaApeMLWXS5haSJtWRpdgD58Q3iygMWLeIspZZaEbRoaeG3Pz0eEhHE5spKnWWlHoKA+i6urVIuLdY9tUGGrhJaWdbx1YXiALl2LbWGdp5KLi5mSeBpUgJmdUICduLWPaVBhlm1tVJaEsoCWGi6rQz6HhMnPuNzmhKuLlmF4lplUnXx4i6d1TExhLlBHcRopPhpDPl2STDRZOUdtUDSZmWVUR2FQVHF8WVBQaWEicZlpLhphnVl4oIR1IoBphIuEnaBtaZJ4km2HoKtlYZlthFRhgLWnbcmPrq7CoI+EuKR4VHHm36Bph2UanaCgdXhhXXw0h3WHi7xtkpmEUIBpgId1nW1xUBpdeFmAaYd4VIugbY+WmbyyXZagZRpheJ2Ph21hQ2mEj5JUpIe1i2Fpkkd8eGGgsnx4ZaBDXVA5klB8cZ3Fp21Zh3VpQ3W1kpmWhLKEWYtlgD5tLkySpJK8j4SdxcKkkll8snG8p3gamZJpfLinrpK4p518WcxUaZ2kgG1UdYTFh3xxQ4t1q654XUxHaUc+KZZMPpZUfGlZi79haXGWQ11ZRxo5UHxHi49MoIBxeExDUJ2LfK6gYZaLmYSSnYthLj4+nYBtUHWuv7h8eG2Sv4S8v7irgId8i4B8lmVl1s/Frj5pv6CZp4TMdaCdUKegkquLhI+HYUdDTFCAeGltj11Mj3FhNF2rh1RpaUePj4+P2YeLi0dDVGFtYZ2AVC5tnWmPwtKLq49Qj6vMi2l4rqeHYYuAWWWAfEedh6Cup7KSaXyudV18aXFpj4CLcWFteHhZaXxxbWltcZmkycmLcWFxhHx1WXWSkmlthHVxZY94td+kwniPXY9lVItxTF1loJJxi4BtVF1xTHVlZV1tfIedaVBheIuPhGFldWlpWYCAj2VMQy5MZVBUWb+kUFlhTHWki4uuhHyWWWl8oJmPi1lpYWV1aTl8eJmEcW2kpC5lq+aPv5KAZW2Sssm4eKe8z9+WoMLMspaHhENHYbK4p4B8VHyPQ3E+TG2AUIdZgGmWVHikcXxQQ4BhYWl1j4uZmYeSh7JtPnh1TIdxcWFxgItppKB8ZYRdeKekh6dtPnV8i4uWdWFtnYBHnbWPoG2LfGFdaXiAknFQR52nnVl8dZ2LnWWEgHVdZTmHrrx8gHhdfF1pgHFUgIRlkp2gko9paY+1xc+Pj3WZWVCgcWVhdXV4aWltgItxYUxdfHxHZVSPtYBxYVlxlpJZR4uLhENQVGUuGkw+XXhdXXh4UC5lZXh4spauvISLq4t4ZWV8gHhxnZ14mZaPeI/c5oudq4AaeMK/eKCLfItHh7LZyYCgspLFtd+/uJ2gj6CuhJ24ZZakZRqAZXhtkosuNFlHGlQai5l8aXxHeIuunW1tnbKSaYSHwmF4cTmnroQ5WVSAYZ1ddWldtZZUXaB8uMWZvIeSuISkcYt4bYBMfJmZaaDPxbyZcVBUXWWgeHygdWVdVGVdUGG4roeEeGllvNKWv4uHv6BpGnGnKWWrp3WAfLWZeKCSXYSgxdJQaXVhoD5dZVlleIdUaYBhWXVxYYBtbWl4PrJlUId8ZYRQR10pcWFQbWVth4dlWWllGjRpcVRUXWWucYCWeI+Pkod8j11laY+nklnmnXGHpGVh5ubmnZZ8z67Zq6C1dZauv5nW1uadoG2AoLXFv4+ddXG1j5mPoKt8i7J4fGVtPodQOUdlKSI5bUekh214YXh1VJJUVICgoHhpbbKudW1pdZaERxp4i1mPUFRptYCEfGlpmbJDaaerpIdprpKHWVl8ZZl8bY+ZnbKrmYdheF1xbYCdxYS/h21MtaC1lm11kqd1z67CkpaEgK6nWYdhOYtUTHxHR111sqCLhOaWXUNdgGmHVIt1VF0aQ5ZhdZJtZUw5gI9xcZJ1p12yeGGEsmV8cT5MUGGHIhpdUC6AgISLGnFHj6CdKUxUeHF8R3FlhHg0bZakZZmZlnh1oIRUp4Srj7iWoKd1caTcya6u5nF1aZnM5tbC0qCH37iust9xvFlDgJKAgKekp4thUBouaVSdgFRUGlB1fD6AeIeHgGlZeJldQ3GEi5JtWZmLgEyLi0d4cTSZq9+Wj4Bplm1Hh5KyeKSkh1mPxbh4cY+WdYdtaXhdWV2EhJ2WkmWAaW1lUHG1na6drrydmdy8nXFxXYBtpG2Lp6C8eIuPnaC8lhq/bV2LhIRpR7KruLySlpKAgI9dWUdxbWltYUddZV2ZWWltcYdlXXVpsqdxj4Rdv5mdi3FQTBoagIureGVxOVltj6SkWT5hhDlhZbjJtWVlaXiEkmF8dWF8cXiWq6eyj7Jhtb+1q7KWdZLC5r/m5pKgq9+PncW41riSYZbmuLiLh49dgHFhlpKPdaSLgJ1ZR2ltUFlhWTlhTEc+ZVBpeK58YWV8dYBpaXF4cXyAlqukdW1tQz6nv7WkQ6C1mYeWmYeSgEOAoKCSpMm1ZW24gFSLdYdtQ3GAcXingKudYWlhllSSi4ugj52klridpJlti5mHlrKLcXyHq5mnYYSEcUw+tYdtfHGEUG2ZfIeHrouPnYSHgGFdTFRZXVCHfFBQbVlxhJ1tZXWLj6CLWWmWeKuSkl1Mi4tDWXVhYVR8Q0w+R2mgi0NdpHhtVEdQkp2ATHh1aTRQXYuEZXhpWZagp7Knsot1na6PtdnW5niSv+aurtLf5qCWmbLPzL9pmaC1dTSnaUyEj22klp2Pj2WkWXV4UCJZPkdZGkxZgKt8dYfSgICHcYSHXS6STGlhNJarpI+AdYTWvKeLeIeEzJk+neay5uZM4q6Sv8XP5plQkqBUfFlhYUNlh2mPh0xph118aXyLvJ2kv5adhHyAZZaZh52/yaCSdYCgpG2Pp8XirnFpUJ2PgISkj4+AVISgj66ZnZarfIRMWRpHNG1UYV1hOYdDWaCPWYCdoDmri5lt2cmrh8KEQ1lhTGl4cWGERy45XV1dgGVZYaRMdXWHlo+SnWGWkodUR0M5gHxxp4ukko+doLyPUJadkrXZybyWp+bF5smyp7i1sp2Pkr/CvIuPh2mgpGFHmVCATBoaPnVZGouAlpaZdaSHWTlDaY8aGj7FpLzPaWFHfHVZkoCZaSmZpHF8hHhhteLMndLmv4eSuJJ8vOZl0rKysquLwnE5fC5HuIeHTEyrnW1QfJKWq49luHyrpLxlna7cgHFhfM/flouHaWVtroBdhHGyv8VZncJ8pDQ0ccWdGi5pspagWZLCdUM+ZWkiGll1KWWdrl1QPoekmV2WfJmE2bKPuJY0VC5lYXGZcUw5eFBQR0eSWXE5mYePbUNHUFRpuKTmdVA0KXFUfHFZKXynmVlUq5ZtWZmLmaCurmmyoKeWyebm37+EnbiLv8zmvHxx4oeS0rLcuIB8LnVDstyEgD5ZYYdDWVmEVC5QdW1dLjldaXg5OXFllpZ4YT5MWWk0IkxZLjRHfJ2dfJLSnUxxkoekpHVx1p2gkoerkrKrta6ngLWPknVMZYR1VHWWXZJ4gHWZwri8hKfMwr+kdXFtgISWnbhHlpmkpJKHPniAYXVpgG2LYZKgj5lQVFSZlmVDi3VQbT6Sp3hZgGkiR0NQZZmEbRqPQ2GAVHFQZWWZkpmHkquPVHG/tYBpdXhZpEwaWYd1hFl4hGGPaT5MbWl1GmF1nV1MgISLaVl4aaSLeHxMpHyLdYSWaY+1gKSPtc+uq7zC1tKZgIeS0sXMyXiSi4uPhK6LdaS8v5l4Ryl1aTlDWXiZaXxDUGWEZXV1dVRhWZaZZUcigIekcUx1Q1lhOWGnWUdZUF2kwqCyi4dUXZ2ZnY+Plp1dfKdtsp2dmZ2PeIBxfHh1mY+rQ4BUlnxthHhxcW18hK6yq7jMp5KAp66glrXMmZaHpICHpGl1oKSLdXFtWYRHXbzMoISLv2l8gHFhTEw+VBppUEx8cYRthExZcS4+dV18dWFdaW2Wlpmgj4ursrJQVKSAh5lULjQ+mY9pR1R1h2VUaVBMZXhUi4uPtZlZh2VHZZaLkm1lrqenfLJph4t8knVli5arv8mdpKunpLKgvMKdmbXCtbi1uK6Zh6e/mZ2keFm1oHydfCkiOT5ph3VMKRp1h4RUbZKLi5Z4fFA5R4dlhFBlZUNxRymLbTRZgHh4pObmYYu/nZ2LZYCrXaCrpGmZj7ikuKegXT5dXXh1fJmdi4CWoHyAlqu8xZKWgGmHzKRhdZmrnWF8caR1j8Wyq658louHdXySeF1UVFmShFmHvJmHmauZfIt1aWVdXSmLYSJUcS5MlsVxOVk+RzR1aVA+h3hxQ5Z4i66LloerWT6LpKeZhJagpK6rVG1QhGV8h2ldWWmWPmlHUHVMbaRpcYCEpISHkoeApIeZh21DNGmAYaddeJ28ssLMsoeustm/oK6dxcy4wsWudZ2Pp4ukbVRQTKS4q10acXhUQ5KkeClQlp1tKUx4eJ2LlniAGmWZgG1dbTlQp1RxjzlQj4B15ubP5kN4v7LPll2dnVncnY9xtaCkuJKri11McVRDQ3igoL/Fj6DmNJKusqCPaXGAdeaWhK61kpZZfL+WYV21p8+/fKurloBUWZmrhy4ph4+yp7iykpmZh4dQVIRDTJaPR0dpaYeHYauWh4eSeBoaXVBpGsWkQ3XMlmmL5nyAtbyEnaSyuLiEgGFxR1QpNDRQIlBMj51heHiHbW18XXWZYZKEcSJDTGVlzHhtj4+ZcUNtGnV1fLXFknGSncKu3NKdoMmd0sK1q5m4v3G1yaCSklSAmae436dteIBtYYAaKVBdYaePsm1QljltmauAh0eAeDRppHiAUHF4fISuaW18ZVmnp5k5YaeZvyI+ksKyzLWLsry1nZbSp7WZhK6ER5mAj4SAZauWVIe1ssmWfHiHnc+nmatxgISEi52nrqe4lriEgKSEgKDmi52HYXhxQ1RhR3Wgh0ydnbWyZXEpIjl1bTR8KRpDOXyHj8mAwpJxYV0+ZYSSdVCkv4uWzKeW2cnCpJJ8TFCEtYuykp28aeJth4saPnV1UItdQxoafJ18mXxQcZ2rhIBUTFmPuFBxaVRdYYtxdWWnrr+ri4vFrrJdbWmSsr/Wsrh8eICkh4+up6SAbWU5mbyHllBlcXFpUFBZR4+AfIuLp7JxdVCWi4dlaVQ0NFRhXW2PcWlMUDlHdW1deJKdlqunxeKEwq6S2b+kgKvfzLyLv4eHhICnp22EbUNQj7Wui2lZgHyHsoenspmSknhhlovJ5qukxb+dxaeupHiPv5ZtgGlQPl1hbYBdcVl1i2mPYbyHgHFxkoRQkmVhUD4+UJaAhISkeG18dXFQPmVdfGlxh7+Wh6SnrsmdvKeLaVR1j5aSmXWAnc+geJmAbV05YauAh2GETIBdXZZlbW2nhIBxfHhlh4+AUFCAgGmLgIR8q514pIDCtcW8j53MmXGPmZmuv4uncXyLfHFtTHGgsoeAi2mAkmlZZT5Zkj64bY+HktK/wm2Ej4ugfFBthD4+ZXUaOUyAXUNUdXhxeId1fIS8h6eLzJmHfObFvJ3J4r+ygLJ1cZmPaXWLdVRxWYe8naCrh52HgIeZ1uKdsnyWnYRtlr98aaS/lqS4rqtxh6uAgGmWbY+gh3iLj5lHbVl8kodxdYdpdXGEbXhUGhpUbYeufJarbYRxcVBtnXhxj8LPsqBlaVBMrquAmYe1ll0+TOK8q3WSoLKklmV8ZW14mXWPVFl8v3gpGoCZdYBxTFR4kpKnWZKLj3F1lo+uh3E+R7WgbcXF2b+8p6C4rqCSp52Lj21dj6CAgJJxoFSPfHxMZXxpcSlMcVCAh6SSYWWHVKCHbaCPZV18aXU+gItDLkeEZT40VKCnfHWWgExxrnydj3xxspmPeMLJwr/JycLfwnF8gFmnj3FldV1HUJKni4eZrsnPlq5tdby8uJKEh4txdZ18hGGPoKuAgJ2dvK6EfHGPkpllmV1toJ1tWbWuZXVlWXFDWWF4YZZlcTldXYtdR3VxXV2dnZ18fHV4lmWkvMl4VISL0qednYcamXiuuDS8uKBDYYudj3xti511gKSLWaBUdYRZKUeAhI9haXxpj7KSfGVpdVmHbWGHgI+uVGHMv4uZhLi1xb/JuKunpLLMkrKkaWGPfFRdwnXW5qR8XUw5R4uPhGFxdYuZaVBdv5mWrqB8oMl4ZV1hTIdhYXFxTG11GkegloeEpF1ZgIt8hJ2SoIDf5ubmxdnizK6StdxhfLV8YbiAVFkahIB8OXiHmZK8yZmSaauupKTmspbFgKCSdYCWhKfPp4CPspKLuLx1aXx4WXiPR49Zq4SnhOan0oRpbad8TFBUbT4+Q118gHgaWVTChEyyq3V4kr9ZTKSLlpmyvK6nzN+d2WmPkq51aaCHh5mAlpmdi4tQtV2ynXhDhHxUUFmEh4eLrquAeFQ+gF1xYYthZXh4ZW2SlmGHlsW4maB1v5Kni7WAknigrpJ80ry8vGlpXXWSvNKSrrxpWT5daYuLdXw+ZaRtj4eSrou4oI+Sh5KAeHyLoGFMYVQ+UG2WgGlZmZl8R2Fxp4eLWWVDv8W4nZ3C2cKkWZa8q7XMxeadOUdhpHyLq6Bxna6LgLzm0oSukniWpKSgi5KWi4dUdXWPxcmZlrK4hJa84rXcrnw0aY98aUN1WaSurp0uWYSneIt8KSkaKUxMGnXMaYdMhJK80oBUNENHfKu/nXGWj8Xmp5nmzHiEZZK85rygtcWnknE5XZ2yxYSEXXVUfExUdWmSYW1ZWWF8dXWPrnhZcVl8ZYuWYUdpj8+4lpLFycygvLLfvJmrmaR8q7WEeHGAYW2LaXWHad+44l14aYSEhG18cV1pWYd4j4+yh3x8rrxpeIB1gI+PhIBQYYBZvGVleIRlj5ZpVIB4WZaAlmV4mc+8rr+kuMW1tZKrybi/rrWEXXFxeFlZh111suaymb/m5tmApIuEZXiZtcKgdZaPhHiEj9nCpJ2PoL/Jrq7FtZ2ghG2HnYtxh4ekq4SHj0xxdYB8cSl4hEydZWFtZWmWab/CrqCkdYuWdXXFoLKS0p2gj8y83MKSq6eElqSLgLy8v66EbWm1sqSHUFl1hHFdhG1pbZZxWUd1h9y/kotheKeWWY9thG1QpL+PtZaZpL+1krinwqfFnZKZro+EYWl8gG14h3h4ZXWWmYRph4R8uGlxi11hVI+HVI+Ej4SEgKSPaVSWkoCScVkucavJgHWZi3FxTICHWZagdUNdR4ddZXFQmbjSnZ2dp6CErqePloBxYXiHvG0uYYBlgJKymavW2dnPnae1p3FpaYePh3GEj4RtQ0zFz518hF1tta6kkp2AYXiWgJ1hhFBdOW14h4CSaWFZGkNxeISEgD5tcUOPfGHCvKRxh3Wdp4+AvJ21mbKWfIfJwoeLkqTSoLLJyb/CvNbJh4tUlryuh4dpeHVHknhdOVRMWVl4i7WSkoe11nWWdWmLVIdHTG28p521h4SEgJ2dsquSsrhti7+Lh3x8XW11cYB8cT5hcTltgIeAh4A+UHGSkoRtPj5xR0ySYaeSh4eEhGlxi5KnslkuWVllXUNUWRqPkkwaOVC1aW1th4tpXYSL1r+yeGG8nY+EoICuv6A5YZJ4NGF8ZV18lp2EkrzCoL94eGFxcXWAtZKrhIuEaWFpgKursllhhLV1j7JdbXV4pGFUPjmgnVBdbW24gBpQUF1QOS5HZRptrkMahFBdxbiSWYukxYRhGq6knaugsqeZzHWZ2bXJz8/MZbyup6u/gLWWcWl1UKRZcVRdkpJZIniSdZlhcXFppJa4h6dtUFlhcXGPgJKSkr+Ah4d1koCZi4eWi52u4qC/lm1DcXxpeExxTEdlnYBHKRplhIuETGWEj6CLkjkubYBdgD5DQ2G4lqvi1pJtbV3CzIurspJhPjlDLlQ0VJaPhF2Ez4uZh4eScXyrh4t4cZarfGU5TIeyoI+LYUNpYaCHeM/CeNnPpMm1nYRQcZaEbWGPdbiri2V1ZVm1hHh4j9KyhIenYW21i1RUTFSWcYSPkm11uNaLXTQaIlRUi52EWW1DOWFdbUNtj2l4gHFpdZLJvKurj6vFuJmAdZ3CzJmni0ydv6d4fKeSh651aXGEdXhHZWlxXVBhfHFZtY+PkniPh7yyUKeZko+AGnWPfIt4fObPp3WPYWmEdZKSloR1q4d8srK1fDlMbWFxoG1heHGuoI94TFRhYXF1ZVk+R3WAj7V1h3yHxaSglniZloR4KaudYYCZeIdxVExMKXF4bWl4PlR8oF2rp5nSpICWvIBpTI98bUyZknyLko+EgFmS5nygkm2PvLirhJJ4caCHoK61gHhhYXiPko+Hi3h4YUe1p49ldYePknVZUHGEhGmEbUd8eFBDlho+LkdHIlSSWUySXWVxgKSPdZKPj4RdsqtDlqeWsqenuISLj5aSlqSuoF2kp7XJ0r+1eKR1fJaPmYd4h4s5THyPgIt8q6BUnWlZi52PgEw+baCPknx1cVSAi3F4v5aWj4uuoHySp6d4gIuLsriSdXw+ZTQaNIR1LkxxsnFMVJZ1eGFQZVBZgIRhaYRxWXySWXy1j21DR3GHh3GkeHhlZVlpYXWAWUyHoJlpkjlMgMzWv52LsqCEj4dtZVlph22AgG1QmWlZj0d4pMmyz7i1nbyukniZrqSZdY+SkpmWaYRxj6SWi5l1WXhlgJZ8XYeSp3hlbUxhhJl4gHxlbVQuTJ2PVEwaPkM0UGGShISdq4uHj3yAmafMrrWPTIeHhNKup6B8fISWoIuEmYt1wqCZwqSSq6SdRzlQdZaEVHVQPlSPpGlxko+Sj114lnGHlnVhZYSkpI+ZgG2Hi3FtZY+krtynkpl4kq68mbVMma6raVRDIlA+VD4pR0M5cZlxYTlhXXhDRy5dPlRZWaCShJaHYVQabYtp4lA+fIuLh21hUIeEj2lheFRQdYt4j3iHUMnmtbyrq3irroRHR1BtbYeAuJaAPottR8WWvLKuuMXW5ryrwsKPdXySq7JMNHW8sqS1h3FdeKuELjl1aa5pp8x8tZ18i3GEj7KZYXx1eEcpZYCgi0c0NHiAdRp4mYCgeJZhOUwaTJa15rikbSKWh4BxnZJ8aZarpJmnrpKnab9xi9+ki4u15lRlaYt1i211YZKWgIedh5J1i1lHi6t4i5ZhUENheI94koeWgHGHpJ2EvLXSz6CunY91lpmdj53MZWWHZUyHTIBQZVk0Pi5lPiJQfDRQNExxi3xtUD4+UIR1cZJhZVCPxUyWh5JUxUOAXXVpRy5xhKCPND5hYWlUTG2uxaSuhLzPpJZlhJaEcW2AgGlxspKEcYvFnW14h6uWxdm4naer5uakpHh4h2F1XWVpp4CWVIR4hG1hgJJtmZLmoJ2SmWVtfGlpVF05UDRlWT6Lq4d8fNmScWVpbZ2Ewmmyrp1DNClHp6DFq8x1tbidhGVZfHF1j5Kg4q645uau0p055s+8vxplgGmSwpJlUClMfLi8cWl8lodlYWHWUIeWaYR1XXEuXWVhfClUZYC/q8mAp7KktdlUv5lpq9yHj2mWWVRlTGl8oEc+OXFpOVlHPnF1XVBdYV2WbaB4WT5xkqS8vGVUXXxlp3iHTBq4p3Vph6edoFSAaV00bVBHYYfMULzmpJaHnXV1dY+Wj6eraXiddXyHh4uZnXGZmbx1j7K8fIuSlq7M2YBdZaCSaXGPhG2SgFmylj6rpKSZVGGytaeEoLiLpJaLcXVlTGE+bVRZZUw+XXidi3F8cVlxgI9lUFlhh3iETDnCrqCkv8niq22LhFlxfHiEnae1q6Tm5nySgK64pMJHZYegll0uTC5xwpKElpa/hKBx0ryAdXxhhHiAkpKZmWmHdXFhaWVtUHzm5rLmvL/fvKSdxaTmlouynXyAYWF1gHg5NF1tTExUTDk0cWlheHxtnYdQkl1hj3iWpMIiORpUWXhtR10ilnx8j2FpfHFQTHFdVHFtaYddaXik0oRDeIttR22Ez5aLsoeSi4tdbYSAYWWLcWGAj4enmaeudZLM0uZ1h3ykp5aLfF1xnaBpmWk0pJagYXyApIerdW2AvHh1eICAeFlMaXVZZVBtXUNphGWLh5KPj4R1pItpoHFpbWUivJaHtZ1xq4t4hI9hbWl8nZZ8ta61z1k5dZltR1BpWXxdTFA5NIddlpmWhJmShI+kdbWdfIdZaXF8UIBxUItMbVRMhG1tfG2AxdzPuIuyvISScauEhIuLeISSoI+ulnE+TF00WWlQOTRdZUxlZXFth2lHhJmEi49pwqvWVFBxfHxUNCKLcVlDaVR4i2l8eCJHcYdlaZa/vLWgkoe1q5lhVG2Ej7KWpHyZaYSZi4BldYdxi5mknYeusrXS5qegxauHYZmEhJJxNGltknx1hHiWnZKAhISEkp3FpHVlj4ukXYBZaVBheIBlQ1CAh21lbWmWj1R8WXVlh8KEhKRZUHWggJJxhNmkj52/i3h1YW2Ah4SEhGm/pM+AbXVQORouNHFhUD4afENUQ1mEYV2PwoCSlqSyloB1q1A+TJltaVBph5Z8bXGLgHV4j6DMq8KntavFkm14daBUZYSSnaSyYTQ5UFQ0VF1ZPoA+PkM5UGWEbZKnaY94oHWdNFBhh3FheJK8KT5lj6d8YXGLVExdj5KEq9/CaS6/5sK8rpYahLzm5rVhp3hQZXGHbaS/oMJ1eJmLi2VlnaSWltK/uK7PxbWnmeLCh6fP5q6Hv494bYBpGl0aGj54ko9lVLKElpmgh0eSyYd4fJadtYCHQ1RhNEc5da6gsoengIeHmcm/i1C14sncfLintbJ1matxYTRpgKR1cWVZloSSWVSAh4RpUENQ5pk5ZXirbTlUYYCSp4eulqvWpKunaWWdLmU5cWV1aXxxfG2raYRZdXyLeFlHj5m8mcLmnXy1rotpZXGHoKTWdW00bRoaGjlUYWFMWXGkcV1xcYCLsqSLbW2EYYCLeDlQbUdpj3xdOVSHhGlZdUOPrr+10mVZoIfFq6SyOV212aRpeG1hZYSPj5J1fHhDh4uPbYRlbZmStZ2PaYCgq4RdGqCyeI+1v7LivGVQIlkpUHiHXXyEdXGLQ3iyhHh4tYSrdXxxh2FdtZZldWlhj3FpeJ2HnUednYeLcbK/ybLJtY9pcXiZwrWkUF1DQ0xdeFRlh3xUaXWdnW1HR3FQdW1HZVkueI9xcUMadXF1i3h4pHyuh5ZdKRphR11DgF18kmlxeJJtWZKgpHzJycldba7Jj6R1VHWSzK6LfKekfKB1gHhpRxo0NEdZUGV4cXV1hHhphIeSp52Sj2FUTGlDaZZpfIuSeKR4YWlxTENMnZZ1oICPmaeZoKBpbaCEi6SEp9+gi66LroRUdZlxh21pgJJpj5lpaWWkloR1YXhdYZmPfITMwr+/mZaHuKCdbY9ZoHVpYTQ+WWV1cVCEmXWAhKePdZKkq52AZYuShJaAi3iAi3h4krxt2ZKWj52kpJaSoK6HaYSHi5KWgFRZVGFZUHiLp4uAfFBpgD5UXWWAbYR4XVlDVGWAhHVZPnFQi4tlj4eEdYRUXZl1bYSHYUd8kouAknWAj5adsquZmauueHWkhISLxbiAfHiLpJmWlpmypHh8bXhhVFApbXhtWXhDdY+Aj21hro+kR4ddgG00NFBtbXGLWWGEXVl8eHGHbZl1i4SAhHhtpKSrRymunW2gaZKklqC4pJaEeIBtpJ2LYYdUeHiHYW18knyWj3iEdWlUXSJ1maCPp6SZeFmSj3ikkqR1fItMZXFZaWVQZW2AcW2Ej4eHkpanpHVxcXWEkkdtXVRUhIeZp6eHhIvFlp1xi5Kuwp2reHh1gHVUND6dcYeAhJJ4i5lZeEMiUGV4PlmEaVBhGjRZaW1xh4eLVI+klqSAfGlxcXWHhHxhTEx1gHxtj2VxZXyrXXGW3HF4i53Sp4eroLyEi6udmY91j66Hq7iPhHh1XW1pQz5dYXhdhLyWYY+1mZaEsnyPR21pcUxth4CEhHVtmVBlNHV4oG2PfK6HmauyrkN4eI+AyXVHTJm4ncWWnXy4rpKWgEN8ZXySPlBUgICLoLyAZUxZZWFtkqBxloSZvI+ZmbJ1oG14p3GStYAaXVRpWTQaNEeuVFSLdYurlnhphMKuuLx1UKdxR52LoIunp9mSi3xtYYeEhK7FfHGdnad4YZYuTFCWnZadXVl4fICZh49UbUOEkm05Za6doFRleKSHoG2AfFlMVF1DZXFteJlMPi5DgJZxbaBpYbWggGFduJmdtcKuv7jZ36u/lqfCtcWnpK6gh5Zdj7XWlou/hGEuWUc5eIuShA==';
  global.PulseLandscape=Object.freeze({VERSION,WORLD,FAMILIES:Object.freeze(FAMILIES),create,append,render,createRaster,createView,worldPoint,sampleStroke,strokeFrontier});
})(typeof window!=='undefined'?window:globalThis);
