/* Pulse Painting landscape renderer.
 * Every scenic mark retains an accepted source path and a documented artistic terrain mapping.
 * Paper/granulation are materials, never synthetic pulse or scenery geometry.
 */
(function (global) {
  'use strict';
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
    meadow:{roles:['hill','grass','sky'],cycle:[0,1,0,0,1,0,1]},
    'open-ocean':{roles:['water','sky'],cycle:[0,0,0,0,0,1]},
    'alpine-peaks':{roles:['ridge','sky'],cycle:[0,0,0,0,0,0,1]},
    'quiet-lake':{roles:['shore','water','sky'],cycle:[0,1,1,0,1,1,1]},
    'coastal-cliffs':{roles:['shelf','water','cliff','sky'],cycle:[0,1,2,1,2,0,3]},
    'river-valley':{roles:['bank-left','water','bank-right','sky'],cycle:[0,2,1,0,2,1]},
    'rolling-hills':{roles:['hill','sky'],cycle:[0,0,0,0,0,1]},
    'sand-dunes':{roles:['dune','sky'],cycle:[0,0,0,0,0,1]},
    'desert-mesas':{roles:['mesa','sky'],cycle:[0,0,0,0,0,1]},
    'island-archipelago':{roles:['water','island','sky'],cycle:[0,1,0,1,0,2]},
    'waterfall-gorge':{roles:['wall-left','cascade','wall-right','pool','sky'],cycle:[0,2,1,3,0,2,1,3]},
    'glacial-fjord':{roles:['wall-left','water','wall-right','sky'],cycle:[0,2,1,0,2,1]},
    'reed-wetland':{roles:['reeds-left','water','reeds-right','sky'],cycle:[0,1,2,1,0,2,3]},
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
    const distant=family==='waterfall-gorge'?300:family==='glacial-fjord'?360:385;
    const y=distant+p.horizon+(960-distant-p.horizon)*near;
    const fjord=family==='glacial-fjord',gorge=family==='waterfall-gorge';
    const width=gorge?40+72*Math.pow(s,1.8):(fjord?28+530*Math.pow(s,1.65):22+400*Math.pow(s,1.8))*p.channelWidth;
    const turn=Math.sin(s*5.35+p.bendPhase)-Math.sin(p.bendPhase);
    const drift=gorge?15*Math.sin(s*3.8):fjord?(s-.3)*p.bend*.15:turn*p.bend*(.18+.66*s);
    const center=clamp(p.viewpoint+drift,90+width/2,990-width/2);
    return {y,center,width};
  }
  function guide(curve,u){
    const z=curve.depth,role=curve.role,family=curve.family,phase=curve.phase,p=curve.composition;
    const distance=Math.pow(z,1.55);
    let x=42+996*u,y=500;
    if(role==='sky'){
      x=80+(p.summit<.5?380:0)+470*u;y=130+p.horizon*.5+20*Math.sin(u*Math.PI*1.2+phase);
    }else if(family==='alpine-peaks'){
      // The far silhouette owns one summit. Nearer contours become broad,
      // asymmetrical foothills instead of repeating that peak like a stack.
      const summit=p.summit;
      const far=1-smooth((z-.12)/.50),front=smooth((z-.30)/.65);
      const peak=summit+front*p.foregroundShift;
      y=470+500*distance+p.horizon*(1-z)
        -(300*far+90*(1-far))*bell(u,peak,.12+.19*front)
        -(115*far+75*front)*bell(u,summit-.22-p.asymmetry*.05,.17+.11*front)
        -155*front*bell(u,p.asymmetry>0?.13:.88,.25)
        +28*front*Math.sin(u*Math.PI*1.4+p.phase);
    }else if(role==='hill'||role==='grass'){
      if(family==='meadow'){
        const level=role==='grass'?680+distance*290:420+distance*480;
        y=level-95*bell(u,.25+p.asymmetry*.13,.42)+50*u+28*Math.sin(u*3.3+p.phase);
      }else{
        const center=.27+.38*smooth(z)+p.asymmetry*.16;
        y=400+distance*565-(110+95*z)*bell(u,center,.31+.10*z)-70*z*bell(u,1-center,.23)+45*z*(u-.5);
      }
    }else if(role==='dune'){
      const peak=.30+.24*z+p.asymmetry*.12,spread=u<peak?.50:.20+.06*z;
      y=445+distance*540-(165+40*z)*bell(u,peak,spread)+(110+60*z)*(u-.5)*Math.sin(z*3.2+p.phase*.15);
    }else if(role==='mesa'){
      const shift=p.asymmetry*.05+z*p.foregroundShift*.4;
      const left=smooth((u-.09-shift)/.08)*(1-smooth((u-.41-shift)/.13));
      const right=smooth((u-.67+shift)/.07)*(1-smooth((u-.85+shift)/.10));
      const fore=smooth((z-.38)/.55);
      y=555+distance*410-(265-195*fore)*left-(130-90*fore)*right-75*fore*bell(u,.3+p.asymmetry*.2,.40);
    }else if(role==='canopy'){
      const near=smooth((z-.2)/.75),left=.16+p.asymmetry*.06+near*.09,right=.77-p.asymmetry*.09-near*.08;
      y=410+distance*580
        -(115+90*near)*bell(u,left,.17+.06*near)
        -(75+145*near)*bell(u,right,.24-.02*near)
        -(30+55*near)*bell(u,.47+Math.sin(z*5+p.phase)*.07,.10+.04*near)
        +30*Math.sin(u*2.8+p.phase)*near;
    }else if(role==='cloud'){
      y=450+distance*500-65*bell(u,.27+p.asymmetry*.08+z*.16,.25)-40*bell(u,.77-z*.14,.29);
    }else if(role==='summit'){
      x=115+850*u;y=425+z*60-175*bell(u,p.summit,.13)-48*bell(u,p.summit-.20,.17);
    }else if(role==='curtain'){
      // One wide, shared atmospheric sweep: its source-bearing curves fan
      // gently through a luminous curtain rather than forming vertical poles.
      x=80+920*u;
      y=155+245*Math.sin(u*Math.PI*.87+.35)-100*u
        +z*(170+95*Math.sin(u*Math.PI))
        +36*Math.sin(u*Math.PI*2.1+p.phase*.25)+p.horizon*.3;
    }else if(family==='aurora-night'&&role==='ridge'){
      y=800+distance*65-72*(1-z*.6)*bell(u,.31+p.asymmetry*.1,.14)-36*bell(u,.73,.22);
    }else if(family==='coastal-cliffs'&&(role==='shelf'||role==='cliff')){
      if(role==='shelf'){
        x=40+610*u;y=265+415*Math.pow(Math.max(0,u),1.6)+distance*120-35*Math.sin(u*Math.PI)+p.horizon;
      }else{
        const along=.05+.88*z,shelf=265+415*Math.pow(along,1.6)+p.horizon;
        x=40+610*along+55*u+15*Math.sin(u*Math.PI);y=shelf+u*(205-55*z);
      }
    }else if(role==='cascade'){
      const river=riverAt(family,u,curve);
      x=river.center+(z-.5)*river.width*.68;y=river.y;
    }else if(role==='pool'){
      x=145+790*u;y=895+distance*85+16*Math.sin(u*Math.PI);
    }else if(role==='shore'){
      const height=85+z*150;
      y=525-z*125-height*bell(u,.13+p.asymmetry*.04,.22)-height*.72*bell(u,.86,.18)+12*Math.sin(u*Math.PI);
    }else if(role.includes('left')||role.includes('right')){
      const left=role.endsWith('left'),side=left?-1:1,river=riverAt(family,u,curve);
      const wall=family==='waterfall-gorge'||family==='glacial-fjord';
      const edge=river.center+side*river.width/2;
      // Depth here is distance away from the shared bank. Every contour
      // follows the complete far-to-near corridor, including its upper lip.
      const outside=left?edge-40:1040-edge;
      x=edge+side*outside*z;
      y=river.y-z*(wall?235:90)*(.42+.58*Math.sin(clamp(u,0,1)*Math.PI*.8));
      if(wall)y-=z*(left?55:95)*bell(u,.35,.29);
    }else if(role==='island'){
      y=410+distance*525-(115-25*z)*bell(u,.25+p.asymmetry*.1,.13+.02*z)-(68+30*z)*bell(u,.74-p.asymmetry*.06,.10+.03*z);
    }else if(role==='water'){
      if(family==='river-valley'||family==='glacial-fjord'||family==='reed-wetland'){
        const river=riverAt(family,z,curve);x=river.center+(u-.5)*river.width;y=river.y+5*Math.sin(u*Math.PI);
      }else if(family==='quiet-lake')y=535+distance*430+8*Math.sin(u*Math.PI);
      else if(family==='coastal-cliffs'){
        y=360+distance*600+p.horizon;const edge=40+610*Math.pow(clamp((y-265-p.horizon)/415,0,1),1/1.6);x=mix(edge,1030,u);y+=8*Math.sin(u*Math.PI);
      }else if(family==='aurora-night')y=860+distance*120+5*Math.sin(u*Math.PI);
      else y=(family==='island-archipelago'?390:310)+distance*(family==='island-archipelago'?580:670)+12*Math.sin(u*Math.PI*1.6+phase)-28*z*bell(u,.24,.20);
    }
    if(role!=='sky'&&role!=='curtain'&&!['alpine-peaks','coastal-cliffs','river-valley','glacial-fjord','reed-wetland','waterfall-gorge'].includes(family))y+=p.horizon*(1-z)*.5;
    return {x,y};
  }
  function curvePoint(curve,u,v){
    const base=guide(curve,u),before=guide(curve,u-.0001),after=guide(curve,u+.0001);
    const dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy)||1;
    const amplitude=curve.amplitude*(curve.role==='island'?.30+.70*(bell(u,.28,.18)+bell(u,.74,.16)):1);
    let x=base.x+dy/length*amplitude*(v-.5),y=base.y-dx/length*amplitude*(v-.5);
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
    const longitudinal=role.includes('left')||role.includes('right');
    // Prefix-stable anchors establish distance and one foreground mass early.
    // Later source duration fills their intervals; sample fragmentation never
    // creates another scene element or moves the existing composition.
    const anchors=[.035,.88,.46,.23,.69];
    const depth=longitudinal?(count===0?0:radical(count)):(anchors[count]??radical(count+2));
    const night=scene.family==='aurora-night';
    const prominence=longitudinal?1-depth:role==='shore'?(.32-depth*.14):depth;
    const hero=role!=='sky'&&(longitudinal?count===0:(role==='ridge'||role==='mesa'||role==='summit')&&count===0||depth>.80);
    let amplitude=role==='sky'?7:role==='water'?7+depth*29:role==='cascade'?11:role==='curtain'?15+depth*9:role==='cloud'?10+depth*10:12+depth*36;
    if(longitudinal)amplitude=role.startsWith('reeds-')?34+depth*48:10+depth*(scene.family==='river-valley'?25:18);
    if(role==='grass')amplitude=55+depth*75;
    if(role==='mesa'||role==='dune')amplitude=10+depth*20;
    if(role==='water'&&(scene.family==='quiet-lake'||scene.family==='glacial-fjord'))amplitude=7+depth*17;
    const curve={mapping:'terrain-normal-v1',family:scene.family,role,count,depth,amplitude,phase:scene.plan.palettePhase*.2,composition:scene.plan};
    // One shared projection preserves connections between ridge, bank and
    // water roles. The guide envelopes are designed inside this paper margin;
    // fitting each line independently would tear the terrain apart.
    curve.fit={scale:.86,x:75.6,y:75.6};
    const first=curvePoint(curve,0,.5),last=curvePoint(curve,1,.5),a=last.x-first.x,b=last.y-first.y,length=Math.hypot(a,b)||1;
    const frame={a,b,c:b/length*amplitude,d:-a/length*amplitude,e:first.x-b/length*amplitude/2,f:first.y+a/length*amplitude/2};
    const layer=role==='sky'?0:role==='curtain'?1:role==='cascade'?1:longitudinal?2:role==='shore'?0:depth<.34?0:depth<.68?1:2;
    let pigment=role==='water'||role==='grass'||role==='hill'||role.startsWith('reeds-')||role==='canopy'?2:role==='dune'||role==='cloud'||role==='sky'?1:0;
    if(role.includes('right')||role==='curtain'&&count%3===2)pigment=1;
    if(role==='curtain'&&count%3!==2)pigment=count%3===1?2:0;
    const foliage=['meadow','rolling-hills','forest-canopy','reed-wetland','river-valley'].includes(scene.family)&&role!=='water'&&role!=='sky';
    const land=role!=='sky'&&role!=='water'&&role!=='pool'&&role!=='curtain'&&role!=='cascade'&&role!=='cloud';
    const flow=longitudinal?'outward':role==='curtain'?'curtain':role==='water'||role==='pool'?'water':role==='cascade'||role==='cliff'?'outward':'down';
    const reach=longitudinal?110+prominence*95:role==='shore'?26+depth*70:role==='curtain'?70+depth*70:land?70+depth*125:role==='water'||role==='pool'?22+depth*70:role==='cloud'?60:36;
    const alpha=role==='sky'?.075:role==='shore'?.23+prominence*.15:role==='cloud'?.22+depth*.15:longitudinal?.38+prominence*.34:night?.39+prominence*.50:.22+prominence*.60;
    const core=role==='sky'?.12:role==='cloud'?.14:role==='shore'?.20:longitudinal?(count===0?.65:.18):hero?.62:.10+depth*.24;
    return {id:index,region,role,layer,frame,curve,material:{width:role==='sky'?1.4:2.2+prominence*3.7,wash:role==='sky'?12:role==='cloud'?50:26+prominence*28,alpha,core,color:pigment,hero,foliage,depth:prominence,volume:land?.55+.35*prominence:role==='curtain'?.70:.34+.28*depth,land,flow,reach,side:role.endsWith('left')?-1:1,perspective:longitudinal||role==='cascade'?'along':'constant',phase:scene.plan.palettePhase+depth*.4,grainSeed:hash(`${scene.seed}:${index}:pigment`)}};
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
    let count=0;while(count<path.length&&path[count].t<=stop)count++;
    return path.slice(0,Math.max(1,count));
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
  function append(scene, segment) {
    if (!scene || scene.version!==VERSION) throw new Error('Unsupported landscape version.');
    if (!segment || segment.quality?.good===false || segment.good===false || segment.accepted===false) return [];
    ensurePrivate(scene);
    const sourceDomain={min:Infinity,max:-Infinity};
    for(const point of segment.points||[])if(Number.isFinite(point?.t)&&Number.isFinite(point?.v)){sourceDomain.min=Math.min(sourceDomain.min,point.v);sourceDomain.max=Math.max(sourceDomain.max,point.v);}
    // Invalid samples are explicit pen lifts, even when their neighboring
    // timestamps are closer than the gap threshold. Sort only within each
    // valid block; never erase the barrier while cleaning input.
    const source=[];let block=[];
    const flush=()=>{source.push(...block.sort((a,b)=>a.t-b.t),null);block=[];};
    for(const point of segment.points||[]){
      if(point?.breakBefore)flush();
      if(Number.isFinite(point?.t)&&Number.isFinite(point?.v))block.push({t:point.t,v:point.v});else flush();
    }
    flush();
    const runs=[];let run=[], previous=null;const inputTimes=new Set();
    for(const point of source){
      if(!point){if(run.length)runs.push(run);run=[];previous=null;continue;}
      const inputKey=Math.round(point.t*1e7);if(inputTimes.has(inputKey))continue;inputTimes.add(inputKey);
      const key=Math.round(point.t*1e7), existing=scene._seen.get(key);
      if(existing){
        if(run.length) { runs.push(run);run=[]; }
        previous=existing;continue;
      }
      if(previous && point.t-previous.t>GAP){if(run.length)runs.push(run);run=[];}
      if(!run.length && previous && point.t>previous.t && point.t-previous.t<=GAP)run.push(previous);
      run.push(point);scene._seen.set(key,point);previous=point;
    }
    if(run.length)runs.push(run);
    const added=[];
    for(const points of runs){
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
        scene.strokes.push(stroke);added.push(stroke);
        scene.paintSeconds+=stroke.sourceEnd-stroke.sourceStart;
        if(last===points.length-1)break;
        first=last;
      }
    }
    scene.sourceIntervals=unionIntervals(scene.sourceIntervals);
    scene.usableSeconds=scene.sourceIntervals.reduce((sum,range)=>sum+range.end-range.start,0);
    return added;
  }
  const color=(rgb,alpha=1)=>`rgba(${rgb.map(v=>Math.round(v)).join(',')},${alpha})`;
  function pigment(scene,stroke,t,depth=1) {
    const night=scene.family==='aurora-night',m=stroke.material,role=stroke.role;
    let palette=night?[[89,137,221],[178,148,226],[88,204,177]]:m.foliage?[[42,99,81],[115,155,125],[55,126,111]]:scene.palette;
    if(!night&&role==='water')palette=[[36,108,174],[99,168,190],[30,132,157]];
    if(role==='dune')palette=[[67,103,193],[145,142,199],[79,139,169]];
    if(role==='mesa')palette=[[63,99,180],[142,119,184],[88,143,165]];
    const blend=.10+.32*(.5+.5*Math.sin(t*Math.PI*1.65+m.phase+stroke.slot*.14));
    const primary=palette[m.color],secondary=palette[(m.color+1)%3];
    const distance=m.depth??stroke.transform.curve?.depth??.5;
    const air=night?0:role==='sky'?.38:.30*Math.pow(1-distance,1.4),paper=[251,248,240];
    return primary.map((v,i)=>mix(mix(v,secondary[i],blend)*depth,paper[i],air));
  }
  function pathPoints(ctx,points) { ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); }
  const paintCache=new WeakMap(),paintAnchors=new WeakMap();
  function strokePaint(stroke) {
    let paint=paintCache.get(stroke);if(paint)return paint;
    const source=sampleStroke(stroke),m=stroke.material,seed=m.grainSeed,role=stroke.role;
    const land=m.land??!['water','sky','cloud','curtain','cascade','pool'].includes(role);
    const flow=m.flow||(role==='curtain'?'curtain':role==='water'?'water':'down');
    const reach=m.reach??m.wash*(land?2.5:1.1),volume=m.volume??(land?.9:.35);
    const curve=stroke.transform.curve;
    let anchor=curve&&paintAnchors.get(curve);
    if(!anchor){
      const envelope=[];
      if(curve)for(let i=0;i<=48;i++)for(const v of [0,1])envelope.push(curvePoint(curve,i/48,v));
      else envelope.push(...source);
      anchor={minY:Math.min(...envelope.map(p=>p.y)),maxY:Math.max(...envelope.map(p=>p.y)),start:curve?curvePoint(curve,0,.5):source[0],end:curve?curvePoint(curve,1,.5):source.at(-1)};
      if(curve)paintAnchors.set(curve,anchor);
    }
    const {minY,maxY}=anchor;
    const channel=flow==='water'&&curve&&['river-valley','glacial-fjord','reed-wetland'].includes(curve.family);
    const confine=(x,y)=>{
      if(!channel)return {x,y};
      const fit=curve.fit||{scale:1,x:0,y:0},at=(y-fit.y)/fit.scale;
      let low=0,high=1.04;
      for(let i=0;i<12;i++){const middle=(low+high)/2;if(riverAt(curve.family,middle,curve).y<at)low=middle;else high=middle;}
      const river=riverAt(curve.family,(low+high)/2,curve);
      return {x:clamp(x,(river.center-river.width/2)*fit.scale+fit.x,(river.center+river.width/2)*fit.scale+fit.x),y};
    };
    const softNoise=(at,salt)=>{at=at*9+salt;const whole=Math.floor(at),part=at-whole,ease=part*part*(3-2*part);return mix(noise(seed,whole),noise(seed,whole+1),ease);};
    const points=source.map(p=>{
      const u=clamp((stroke.slotStart+p.t-stroke.sourceStart)/SLOT_SECONDS,0,1);
      const perspective=m.perspective==='along'?.22+.78*smooth(u):1;
      // Pigment settles below the measured edge into a common, source-derived
      // base. Compressing its lower contour produces a land body rather than
      // an equal-width sleeve around every pulse peak.
      const wet=.72+.32*softNoise(u,31),rim=.78+.22*Math.pow(Math.sin(Math.PI*u),.2);
      let dx=0,dy=reach*wet*perspective*rim;
      if(flow==='outward'){dx=(m.side||1)*dy;dy*=.09;}
      else if(flow==='curtain'){dx=p.nx*dy*.72;dy*=.48;}
      else if(land)dy=((maxY-p.y)*(.74+.18*volume)+reach*wet)*rim;
      return {...p,u,perspective,dx,dy,wet,under:[1,.72,.24].map(amount=>confine(p.x+dx*amount,p.y+dy*amount))};
    });
    // Grain uses slot-time coordinates rather than fragment-local distance,
    // retaining the same material cadence through accepted pen lifts.
    const granules=[],steps=land?380:240;
    let index=Math.ceil((stroke.slotStart/SLOT_SECONDS)*steps-1e-7),next=index/steps;
    for(let i=1;i<points.length;i++){
      const p=points[i-1],q=points[i],span=q.u-p.u;
      while(span>0&&next<=q.u&&index<=steps){
        const u=clamp((next-p.u)/span,0,1),n=noise(seed,index*7+117),r=noise(seed,index*11+317),f=Math.pow(r,1.5);
        const x=mix(p.x,q.x,u),y=mix(p.y,q.y,u),dx=mix(p.dx,q.dx,u),dy=mix(p.dy,q.dy,u);
        granules.push({...confine(x+dx*f+(n-.5)*2.5,y+dy*f),t:mix(p.t,q.t,u),u:mix(p.u,q.u,u),size:.45+noise(seed,index*13+713)*1.25,alpha:(.025+n*.11)*(1-f*.8)*mix(p.perspective,q.perspective,u)});
        index++;next=index/steps;
      }
    }
    paint={points,granules,land,flow,minY,maxY:maxY+reach,volume,start:anchor.start,end:anchor.end};paintCache.set(stroke,paint);return paint;
  }
  function drawStroke(ctx,scene,stroke,progress=1) {
    if(progress<=0)return;
    const paint=strokePaint(stroke),stop=stroke.sourceStart+(stroke.sourceEnd-stroke.sourceStart)*clamp(progress,0,1);
    let length=paint.points.length;if(progress<1){length=0;while(length<paint.points.length&&paint.points[length].t<=stop)length++;length=Math.max(1,length);}
    const points=paint.points.slice(0,length),m=stroke.material,first=points[0],last=points.at(-1),night=scene.family==='aurora-night';
    const fullFirst=paint.start,fullLast=paint.end;
    let endX=fullLast.x,endY=fullLast.y;
    if(Math.hypot(endX-fullFirst.x,endY-fullFirst.y)<1)endX+=1;
    const depth=m.depth??stroke.transform.curve?.depth??.5,alpha=m.alpha*(.86+stroke.score*.14);
    const gradient=(opacity,density=1,edge=false)=>{const g=ctx.createLinearGradient(fullFirst.x,fullFirst.y,endX,endY);for(let i=0;i<=8;i++){const u=i/8,air=m.perspective==='along'?.24+.76*smooth(u):1,dry=edge?.52+.48*noise(m.grainSeed,i+127):1;g.addColorStop(u,color(pigment(scene,stroke,u,density),opacity*air*dry));}return g;};
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.globalCompositeOperation=night?'screen':'multiply';
    // Three bounded wet passes share one immutable source edge. Their lower
    // contours and granules are cached from the complete accepted fragment,
    // so revealing a prefix never changes paint that has already appeared.
    const wetPass=(pass,opacity,bleed)=>{
      ctx.beginPath();
      points.forEach((p,i)=>{const x=p.x-p.nx*bleed,y=p.y-p.ny*bleed;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
      for(let i=points.length-1;i>=0;i--){const p=points[i].under[pass];ctx.lineTo(p.x,p.y);}
      ctx.closePath();
      if(paint.flow==='outward'||paint.flow==='curtain')ctx.fillStyle=gradient(opacity);
      else{
        const g=ctx.createLinearGradient(0,paint.minY,0,Math.max(paint.minY+1,paint.maxY));
        for(const [at,falloff] of [[0,.82],[.20,1],[.52,.64],[.80,.22],[1,0]])g.addColorStop(at,color(pigment(scene,stroke,.15+at*.7),opacity*falloff));
        ctx.fillStyle=g;
      }
      ctx.fill();
    };
    wetPass(0,alpha*(paint.land?.22:.16),m.width*(.30-.18*depth));
    wetPass(1,alpha*(paint.land?.17:.10),0);
    wetPass(2,alpha*(paint.land?.12:.08),0);
    // Small, sparse pigment deposits replace circular dabs. Every deposit is
    // located between the accepted path and its own source-derived wash base.
    for(const grain of paint.granules){
      if(grain.t>last.t)break;
      ctx.fillStyle=color(pigment(scene,stroke,grain.u,.96),alpha*grain.alpha);
      ctx.fillRect(grain.x,grain.y,grain.size,grain.size*.55);
    }
    pathPoints(ctx,points);
    ctx.strokeStyle=gradient(alpha*m.core*(m.hero?.92:.48)*(.34+.66*depth),night?1.08:.96,true);
    ctx.lineWidth=m.width*(.24+.23*depth);ctx.stroke();
    if(points.length===1){ctx.fillStyle=gradient(.25*alpha);ctx.fillRect(first.x,first.y,Math.max(.6,m.width*.3),Math.max(.6,m.width*.3));}
    ctx.restore();
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
  function render(scene,canvas,options={}) {
    if(!scene||scene.version!==VERSION)throw new Error('Unsupported landscape version.');
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Landscape canvas is unavailable.');
    const width=canvas.width||WORLD,height=canvas.height||WORLD;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
    const side=Math.min(width,height),scale=side/WORLD;
    // Export uses the same three raster layers as the live cache. Compositing
    // semitransparent paint directly onto paper would round pigment differently.
    const layers=Array.from({length:3},()=>{
      const item=canvas.ownerDocument?canvas.ownerDocument.createElement('canvas'):new global.OffscreenCanvas(width,height);
      item.width=width;item.height=height;
      const layer=item.getContext('2d');
      layer.setTransform(scale,0,0,scale,(width-side)/2,(height-side)/2);
      return {canvas:item,ctx:layer};
    });
    if(options.paper!==false)paper(layers[0].ctx,scene);
    const through=options.through??scene.strokes.length;
    for(let i=0;i<Math.min(through,scene.strokes.length);i++)drawStroke(layers[scene.strokes[i].layer].ctx,scene,scene.strokes[i],i===through-1?(options.progress??1):1);
    for(const layer of layers){ctx.drawImage(layer.canvas,0,0);layer.canvas.width=layer.canvas.height=1;}
    return canvas;
  }
  function createView(container,scene,options={}) {
    if(!container)throw new Error('A landscape view container is required.');
    const doc=container.ownerDocument,win=doc.defaultView||global;
    const stage=doc.createElement('div');stage.className='landscape-stage';
    const canvas=doc.createElement('canvas'),caches=Array.from({length:3},()=>doc.createElement('canvas'));
    canvas.className='landscape-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','A landscape formed from your accepted pulse waveforms');
    const tip=doc.createElement('span');tip.className='landscape-tip';tip.setAttribute('aria-hidden','true');
    stage.append(canvas,tip);container.append(stage);container.classList.add('landscape-view');
    const pixels=2560000,side=800;for(const item of [canvas,...caches])item.width=item.height=side;
    let disposed=false,paused=false,frame=0,last=0,painted=0,progress=0,finished=false,revealing=false;
    let revealStart=0,revealFrom=null,resolveFinish=null,finishPromise=null,finishing=false;
    let box={width:1,height:1},camera={x:540,y:540,scale:1},target={x:540,y:540,scale:1};
    const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced=options.reducedMotion===true||options.reducedMotion==='reduce'||!!motion?.matches;
    if(!reduced)camera.scale=target.scale=2.8;
    const stats=global.__pulseLandscapeStats={frames:0,active:false,revealing:false,frameMs:0,pixelBudget:pixels,cachedPixels:side*side*4,camera:{...camera},finished:false,strokes:0,painted:0};
    const ctx=canvas.getContext('2d'),cached=caches.map(item=>item.getContext('2d'));
    function base() {const back=cached[0];back.setTransform(side/WORLD,0,0,side/WORLD,0,0);paper(back,scene);back.setTransform(1,0,0,1,0,0);}
    base();ctx.drawImage(caches[0],0,0);
    function strokeIntoCache(stroke){const layer=cached[stroke.layer];layer.setTransform(side/WORLD,0,0,side/WORLD,0,0);drawStroke(layer,scene,stroke);layer.setTransform(1,0,0,1,0,0);}
    function fitCamera(){return {x:540,y:540,scale:1};}
    function transform(){
      const size=Math.min(box.width,box.height),left=(box.width-size)/2,top=(box.height-size)/2;
      stage.style.width=stage.style.height=`${size}px`;
      stage.style.transform=`translate3d(${left+size/2-camera.x/WORLD*size*camera.scale}px,${top+size/2-camera.y/WORLD*size*camera.scale}px,0) scale(${camera.scale})`;
      stats.camera={...camera};
    }
    function paintFrame(){
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,side,side);
      const active=scene.strokes[painted];
      for(let layer=0;layer<3;layer++){
        ctx.drawImage(caches[layer],0,0);
        if(active&&active.layer===layer&&progress>0){ctx.setTransform(side/WORLD,0,0,side/WORLD,0,0);drawStroke(ctx,scene,active,progress);ctx.setTransform(1,0,0,1,0,0);}
      }
      if(active&&!reduced&&!paused&&!revealing){
        const p=active.points[Math.min(active.points.length-1,Math.max(0,Math.ceil(progress*active.points.length)-1))],point=worldPoint(p,active.transform);
        tip.style.left=`${point.x/WORLD*100}%`;tip.style.top=`${point.y/WORLD*100}%`;tip.hidden=progress<=0;
      }else tip.hidden=true;
    }
    function schedule(){if(!disposed&&!paused&&!doc.hidden&&!frame&&(revealing||painted<scene.strokes.length))frame=win.requestAnimationFrame(tick);}
    function settle(){
      camera=fitCamera();target={...camera};finished=true;revealing=false;finishing=false;
      stats.finished=true;stats.revealing=false;stats.active=false;tip.hidden=true;transform();
      const done=resolveFinish;resolveFinish=null;done?.(scene);
    }
    function bakeAll(){if(painted===0&&scene.strokes.length)base();for(;painted<scene.strokes.length;painted++)strokeIntoCache(scene.strokes[painted]);progress=0;paintFrame();stats.painted=painted;}
    function tick(now){
      frame=0;if(disposed||paused||doc.hidden){last=0;return;}
      const begin=performance.now(),delta=last?Math.min(64,Math.max(0,now-last)):16.7;last=now;
      stats.active=true;stats.frames++;
      if(revealing){
        if(!revealStart)revealStart=now;
        const t=clamp((now-revealStart)/3500,0,1),ease=1-Math.pow(1-t,4);
        camera={x:mix(revealFrom.x,540,ease),y:mix(revealFrom.y,540,ease),scale:Math.exp(mix(Math.log(revealFrom.scale),0,ease))};
        transform();if(t>=1)settle();
      }else if(painted<scene.strokes.length){
        const active=scene.strokes[painted],duration=finishing?120:scene.strokes.length-painted>8?150:Math.max(420,(active.sourceEnd-active.sourceStart)*1000);
        progress=clamp(progress+delta/duration,0,1);
        const point=worldPoint(active.points[Math.min(active.points.length-1,Math.floor(progress*(active.points.length-1)))],active.transform);
        target=reduced?fitCamera():{x:point.x,y:point.y,scale:2.8};
        const damp=1-Math.exp(-delta/260);camera={x:mix(camera.x,target.x,damp),y:mix(camera.y,target.y,damp),scale:mix(camera.scale,target.scale,damp)};
        paintFrame();transform();
        if(progress>=1){strokeIntoCache(active);painted++;progress=0;stats.painted=painted;if(finishing)beginReveal();}
      }
      stats.frameMs=performance.now()-begin;stats.strokes=scene.strokes.length;
      if(!revealing&&painted>=scene.strokes.length)stats.active=false;
      schedule();
    }
    function resize(){const rect=container.getBoundingClientRect();box={width:Math.max(1,rect.width),height:Math.max(1,rect.height)};transform();}
    const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(container);resize();
    function sync(){
      if(disposed)return;stats.strokes=scene.strokes.length;
      if(paused)return;
      if(painted===0&&progress===0&&scene.strokes.length)base();
      if(reduced||finished){bakeAll();camera=fitCamera();transform();return;}
      schedule();
    }
    function beginReveal(){
      if(disposed)return;
      bakeAll();tip.hidden=true;
      if(reduced||doc.hidden||!scene.strokes.length){settle();return;}
      revealing=true;finishing=false;stats.revealing=true;revealStart=0;revealFrom={...camera};last=0;schedule();
    }
    function finish(){
      if(disposed)return Promise.resolve(scene);
      if(finishPromise)return finishPromise;
      finishPromise=new Promise(resolve=>resolveFinish=resolve);paused=false;finishing=true;
      if(painted===0&&scene.strokes.length)base();
      if(reduced||doc.hidden||painted>=scene.strokes.length)beginReveal();else schedule();
      return finishPromise;
    }
    function cancelFinish(){if(disposed)return;win.cancelAnimationFrame(frame);frame=0;bakeAll();settle();}
    function pause(value){paused=!!value;stats.active=false;if(paused){win.cancelAnimationFrame(frame);frame=0;last=0;tip.hidden=true;}else sync();}
    function visibility(){if(doc.hidden){win.cancelAnimationFrame(frame);frame=0;last=0;tip.hidden=true;stats.active=false;if(finishing||revealing)cancelFinish();}else sync();}
    function motionChanged(event){reduced=!!event.matches;win.cancelAnimationFrame(frame);frame=0;last=0;if(reduced){if(finishing||revealing)cancelFinish();else if(!paused){bakeAll();camera=fitCamera();transform();}}else sync();}
    doc.addEventListener('visibilitychange',visibility);motion?.addEventListener?.('change',motionChanged);
    function dispose(){if(disposed)return;disposed=true;win.cancelAnimationFrame(frame);observer?.disconnect();doc.removeEventListener('visibilitychange',visibility);motion?.removeEventListener?.('change',motionChanged);stage.remove();for(const item of [canvas,...caches])item.width=item.height=1;stats.active=false;stats.revealing=false;stats.cachedPixels=4;const done=resolveFinish;resolveFinish=null;done?.(scene);}
    sync();return {sync,pause,finish,cancelFinish,dispose,canvas,get scene(){return scene;}};
  }
  global.PulseLandscape=Object.freeze({VERSION,WORLD,FAMILIES:Object.freeze(FAMILIES),create,append,render,createView,worldPoint,sampleStroke});
})(typeof window!=='undefined'?window:globalThis);
