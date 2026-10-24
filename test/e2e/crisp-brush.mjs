// Public recorded samples pass through the real pinned PPG engine and app
// acceptance adapter. The stepped clock verifies presentation correctness;
// it is deliberately separate from the real-time mobile performance probe.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(root,process.env.PPG_BRUSH_ARTIFACTS||'.dream-loop/crisp-brush/verification');
mkdirSync(out,{recursive:true});
const source=readFileSync(path.resolve(root,process.env.PPG_BRUSH_SOURCE||'app/landscape.js'),'utf8');
const marker='sync();return {sync,pause,finish,cancelFinish,dispose,canvas,';
assert.equal(source.split(marker).length,2,'observe presentation without replacing its paint loop');
const observed=source.replace(marker,'sync();return {get captureState(){return {painted,progress};},sync,pause,finish,cancelFinish,dispose,canvas,');
const recording=replayPublicFixture(1,0,180);
const fragmented=replayPublicFixture(.5,.18);
assert.ok(recording.segments.length>20&&fragmented.scene.strokes.length>100);
const engines=(process.env.PPG_BRUSH_ENGINES||'chromium,webkit').split(',');
assert.ok(engines.every(name=>['chromium','webkit'].includes(name)));

for(const engine of engines){
 let browser;
 const result={engine,scope:'Public recorded samples, simulated delivery and stepped presentation. Not physical camera, physiological accuracy or mobile frame-rate validation.',rendererSha256:createHash('sha256').update(source).digest('hex'),cases:[],errors:[],failures:[]};
 try{
  browser=await(engine==='webkit'?webkit:chromium).launch(engine==='chromium'&&process.platform==='darwin'?{channel:'chrome'}:{});
  result.browserVersion=browser.version();
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,reducedMotion:'no-preference'});
  page.on('pageerror',error=>result.errors.push(String(error)));
  await page.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#fbf8f0}main{margin:0 14px;width:362px;max-width:calc(100% - 28px);height:520px}</style><main></main>');
  await page.addStyleTag({path:path.join(root,'app/landscape.css')});
  await page.evaluate(()=>{
   const pending=new Map();let id=0,time=0;
   window.requestAnimationFrame=callback=>{pending.set(++id,callback);return id};
   window.cancelAnimationFrame=key=>pending.delete(key);
   window.advancePaint=(dt=1000/60)=>{time+=dt;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(callback=>callback(time));return callbacks.length};
   window.pendingPaint=()=>pending.size;
   window.paintClock=()=>time;
  });
  await page.addScriptTag({content:observed});
  result.provenance=await page.evaluate(({regular,fragmented})=>{
   if(typeof PulseLandscape.strokeFrontier!=='function')throw Error('Timestamp frontier is not exposed for verification');
   const results=[];
   // Three seeds vary landscape layout, never the measured waveform. The
   // irregular case drops existing samples and marks a real pen lift; it does
   // not synthesize a physiological pulse or interpolate a gap into a beat.
   const irregular=structuredClone(regular.slice(0,2));
   irregular[0].points=irregular[0].points.filter((point,index)=>index<12||index%4===0);
   if(irregular[0].points.length>18)irregular[0].points[18].breakBefore=true;
   const inputs=[['full',regular],['short',regular.slice(0,2)],['irregular',irregular],['dropped-delivery',fragmented]];
   for(const family of PulseLandscape.FAMILIES)for(const seed of [1,39293,4294967295])for(const [label,segments]of inputs){
    const scene=PulseLandscape.create({family:family.id,seed});
    const samples=new Map(segments.flatMap(segment=>segment.points.map(point=>[point.t,point.v])));
    const lifts=segments.flatMap(segment=>segment.points.filter(point=>point.breakBefore).map(point=>point.t));
    segments.forEach(segment=>PulseLandscape.append(scene,segment));
    const before=JSON.stringify(scene);let checked=0,maxTimestampError=0;
    for(const stroke of scene.strokes){
     for(const point of stroke.points)if(!samples.has(point.t)||samples.get(point.t)!==point.v)throw Error(`${family.id}: source value was invented or changed`);
     for(let i=1;i<stroke.points.length;i++)if(stroke.points[i].t-stroke.points[i-1].t>.121)throw Error(`${family.id}: painted across a source-delivery gap`);
     if(lifts.some(t=>stroke.sourceStart<t&&stroke.sourceEnd>=t))throw Error(`${family.id}: painted across an explicit accepted-source pen lift`);
     const full=PulseLandscape.sampleStroke(stroke);
     for(const progress of [0,.113,.371,.713,1]){
      const frontier=PulseLandscape.strokeFrontier(stroke,progress);
      const expected=stroke.sourceStart+(stroke.sourceEnd-stroke.sourceStart)*progress;
      const error=Math.abs(frontier.t-expected);maxTimestampError=Math.max(maxTimestampError,error);
      if(error>1e-9)throw Error(`${family.id}: frontier follows sample index instead of elapsed sample time`);
      const prefix=PulseLandscape.sampleStroke(stroke,progress),last=prefix.at(-1);
      if(Math.abs(last.t-expected)>1e-9||Math.abs(last.v-frontier.v)>1e-7)throw Error(`${family.id}: tip disagrees with the canonical measured timestamp and value`);
      if(prefix.some(point=>point.t>expected+1e-9))throw Error(`${family.id}: a future recorded sample leaked into the painted prefix`);
      const right=stroke.points.findIndex(point=>point.t>=expected),a=stroke.points[Math.max(0,right-1)],b=stroke.points[Math.max(0,right)];
      if(frontier.v<Math.min(a.v,b.v)-1e-9||frontier.v>Math.max(a.v,b.v)+1e-9)throw Error(`${family.id}: interpolation invented an amplitude extremum`);
      checked++;
     }
     for(const point of stroke.points){const rendered=full.find(item=>Math.abs(item.t-point.t)<1e-9);if(!rendered||Math.abs(rendered.v-point.v)>1e-9)throw Error(`${family.id}: measured knot was smoothed away`);}
    }
    if(JSON.stringify(scene)!==before)throw Error(`${family.id}: presentation mutated source geometry`);
    results.push({family:family.id,seed,label,strokes:scene.strokes.length,usableSeconds:scene.usableSeconds,checked,maxTimestampError});
   }
   return results;
  },{regular:recording.segments,fragmented:fragmented.segments});
  await page.evaluate(()=>{
   window.inkVertices=path=>Array.from(path.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g),match=>({x:Number(match[1]),y:Number(match[2])}));
   window.fitInk=(source,rendered)=>{
    const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
    const a=mean(source),b=mean(rendered),variance=source.reduce((sum,value)=>sum+(value-a)**2,0);
    const slope=source.reduce((sum,value,i)=>sum+(value-a)*(rendered[i]-b),0)/variance;
    return {slope,offset:b-a*slope,residual:Math.max(...source.map((value,i)=>Math.abs(rendered[i]-(b+(value-a)*slope))))};
   };
   window.inspectRecording=(scene,view)=>{
    const stats=__pulseLandscapeStats,state=view.captureState,box=document.querySelector('main').getBoundingClientRect();
    const stage=document.querySelector('.landscape-stage'),style=stage&&getComputedStyle(stage);
    const snapshot={mode:stats.mode,state:{...state},bridging:!!stats.bridging,streamTime:stats.streamTime,paperOffsetX:stats.paperOffsetX,anchorX:stats.anchorX,projection:structuredClone(stats.projection),frontier:structuredClone(stats.frontier),nib:structuredClone(stats.nib),visibleIntervals:structuredClone(stats.visibleIntervals||[]),
     scenicHidden:!stage||stage.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0,
     cachedPixels:stats.cachedPixels,materialPixels:stats.materialPixels,pixelBudget:stats.pixelBudget,materialPixelBudget:stats.materialPixelBudget,viewport:{width:box.width,height:box.height}};
    if(!stats.nib||!stats.frontier||state.painted>=scene.strokes.length)return snapshot;
    if(stats.bridging)return snapshot;
    const stroke=scene.strokes[state.painted],path=document.querySelector(`.landscape-live-core[data-stroke-index="${state.painted}"]`);
    if(!path)throw Error('Active measured source has no inspectable cached core path');
    const original=PulseLandscape.sampleStroke(stroke),vertices=inkVertices(path);
    if(vertices.length!==original.length)throw Error('Cached foreground omitted original source/interpolation vertices');
    const timeFit=fitInk(original.map(point=>point.t),vertices.map(point=>point.x)),valueFit=fitInk(original.map(point=>point.v),vertices.map(point=>point.y));
    const expected=PulseLandscape.strokeFrontier(stroke,state.progress),matrix=path.getScreenCTM();
    const point=new DOMPoint(expected.t*timeFit.slope+timeFit.offset,expected.v*valueFit.slope+valueFit.offset).matrixTransform(matrix);
    const group=path.closest('.landscape-record'),clipId=group.getAttribute('clip-path').match(/#([^)]*)/)[1],clip=document.getElementById(clipId).querySelector('rect');
    const clipRight=new DOMPoint(Number(clip.getAttribute('x'))+Number(clip.getAttribute('width')),0).matrixTransform(matrix).x-box.x;
    snapshot.core={timeFit,valueFit,width:parseFloat(getComputedStyle(path).strokeWidth),endpoint:{x:point.x-box.x,y:point.y-box.y},clipRight,sourceError:Math.max(Math.abs(expected.t-stats.frontier.t),Math.abs(expected.v-stats.frontier.v))};
    const tip=document.querySelector('.landscape-tip'),tipBox=tip?.getBoundingClientRect();
    snapshot.tipBounds=tipBox&&{width:tipBox.width,height:tipBox.height};
    return snapshot;
   };
   window.inspectJoin=(scene,stats)=>{
    const join=document.querySelector(`.landscape-source-join[data-stroke-index="${stats.painted}"]`);
    if(!join)throw Error('Presentation handoff lacks an explicitly owned connector');
    const fromIndex=Number(join.dataset.fromStrokeIndex),toIndex=Number(join.dataset.strokeIndex),before=scene.strokes[fromIndex],after=scene.strokes[toIndex];
    if(toIndex!==fromIndex+1||!before||!after||before.channel!==after.channel||after.sourceStart-before.sourceEnd<0||after.sourceStart-before.sourceEnd>.1500001)throw Error('Presentation connector crossed an unverified source gap or channel');
    const vertices=inkVertices(join),previous=inkVertices(document.querySelector(`.landscape-live-core[data-stroke-index="${fromIndex}"]`)).at(-1),next=inkVertices(document.querySelector(`.landscape-live-core[data-stroke-index="${toIndex}"]`))[0];
    if(vertices.length!==2||JSON.stringify(vertices)!==JSON.stringify([previous,next]))throw Error('Handoff geometry does not join the two actual cached measured endpoints');
    let start=0;
    for(let i=0;i<=fromIndex;i++){const stroke=scene.strokes[i];start+=(i?Math.min(.45,Math.max(0,stroke.sourceStart-scene.strokes[i-1].sourceEnd)):0)+stroke.sourceEnd-stroke.sourceStart;}
    const [a,b]=vertices,end=start+after.sourceStart-before.sourceEnd,u=(stats.streamTime-start)/(end-start);
    const matrix=join.getScreenCTM(),q=new DOMPoint(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u).matrixTransform(matrix),box=document.querySelector('main').getBoundingClientRect();
    const group=join.closest('.landscape-record'),clipId=group.getAttribute('clip-path').match(/#([^)]*)/)[1],clip=document.getElementById(clipId).querySelector('rect');
    const clipRight=new DOMPoint(Number(clip.getAttribute('x'))+Number(clip.getAttribute('width')),0).matrixTransform(matrix).x-box.x;
    const sourceA=before.points.at(-1),sourceB=after.points[0],t=sourceA.t+(sourceB.t-sourceA.t)*u,v=sourceA.v+(sourceB.v-sourceA.v)*u;
    if(!stats.nib||Math.hypot(q.x-box.x-stats.nib.x,q.y-box.y-stats.nib.y)>.04||Math.abs(clipRight-stats.nib.x)>.05)throw Error('Brush left the clipped presentation handoff endpoint');
    if(Math.abs(t-stats.frontier.t)>1e-8||Math.abs(v-stats.frontier.v)>1e-8)throw Error('Handoff used an invented source time/value instead of its two recorded endpoints');
    if(stats.activeStroke!==null||stats.visibleIntervals.some(interval=>interval.index===toIndex))throw Error('Presentation handoff was falsely counted as accepted source coverage');
    return {fromIndex,toIndex,sourceGap:after.sourceStart-before.sourceEnd,endpointError:Math.hypot(q.x-box.x-stats.nib.x,q.y-box.y-stats.nib.y)};
   };
  });
  const families=await page.evaluate(()=>PulseLandscape.FAMILIES);
  for(const family of families){
   const item=await page.evaluate(({family,segments})=>{
    window.view?.dispose();window.scene=PulseLandscape.create({family:family.id,seed:39293});
    segments.slice(0,7).forEach(segment=>PulseLandscape.append(scene,segment));
    const before=JSON.stringify(scene);window.view=PulseLandscape.createView(document.querySelector('main'),scene);
    const target=scene.strokes.length-1,frames=[],cache=new Map(),textureCache=new Map(),transitions=[];
    let previous=null,immutableChecks=0,maxAnchorStep=0,maxPaperStep=0,bridgeFrames=0,maxBridgeError=0;
    for(let i=0;i<16000;i++){
     const snapshot=inspectRecording(scene,view),state=snapshot.state;
     if(snapshot.mode!=='recording')throw Error('Scenery started before the explicit finish action');
     if(!snapshot.scenicHidden)throw Error('A decorative landscape remains visible during source recording');
     for(const path of document.querySelectorAll('.landscape-live-core,.landscape-source-wash,.landscape-source-join,.landscape-source-blooms,.landscape-source-body,.landscape-source-edge')){
      const d=path.getAttribute('d');if(cache.has(path)&&cache.get(path)!==d)throw Error('Previously deposited source ink or pigment changed shape while paper moved');
      if(cache.has(path))immutableChecks++;else cache.set(path,d);
     }
     if(snapshot.bridging){const join=inspectJoin(scene,__pulseLandscapeStats);bridgeFrames++;maxBridgeError=Math.max(maxBridgeError,join.endpointError);}
     for(const material of document.querySelectorAll('.landscape-ink pattern,.landscape-ink mask')){
      const placement=['x','y','width','height','patternTransform','patternUnits','maskUnits','maskContentUnits'].map(name=>material.getAttribute(name)).join('|');
      if(textureCache.has(material)&&textureCache.get(material)!==placement)throw Error('Paper texture shifted relative to its deposited waveform');
      textureCache.set(material,placement);
     }
     if(previous){
      if(snapshot.streamTime<previous.streamTime-1e-9)throw Error('The session-wide cursor restarted at an accepted-window boundary');
      if(snapshot.paperOffsetX>previous.paperOffsetX+.01)throw Error('Paper moved backwards during forward source recording');
      maxPaperStep=Math.max(maxPaperStep,Math.abs(snapshot.paperOffsetX-previous.paperOffsetX));
      if(snapshot.nib&&previous.nib)maxAnchorStep=Math.max(maxAnchorStep,Math.abs(snapshot.nib.x-previous.nib.x));
      if(state.painted!==previous.state.painted)transitions.push({from:previous.state.painted,to:state.painted,streamBefore:previous.streamTime,streamAfter:snapshot.streamTime,anchorBefore:previous.nib?.x,anchorAfter:snapshot.nib?.x});
     }
     if(snapshot.core&&state.progress>=.12&&state.progress<=.88&&(state.painted===target||transitions.length<2))frames.push(snapshot);
     previous=snapshot;
     if(state.painted===target&&state.progress>=.72)break;
     if(!advancePaint())throw Error('The continuous source cursor stopped before the active checkpoint');
    }
    if(frames.length<8)throw Error('No sustained active measured source was observed');
    return{family:family.id,sourceStable:before===JSON.stringify(scene),frames,transitions,immutableChecks,maxAnchorStep,maxPaperStep,bridgeFrames,maxBridgeError,state:view.captureState};
   },{family,segments:recording.segments});
   assert.equal(item.sourceStable,true);
   const issues=new Set(),check=(condition,message)=>{if(!condition)issues.add(message)};
   check(item.transitions.length>=5&&item.immutableChecks>100,`${family.id}: one recording crosses accepted windows while reusing deposited core and wash geometry`);
   check(item.bridgeFrames>0&&item.maxBridgeError<.04,`${family.id}: clean accepted-window handoffs retain a continuously attached brush without changing source coverage`);
   check(item.maxAnchorStep<.05&&item.maxPaperStep<8,`${family.id}: the brush stays anchored while its paper scrolls smoothly across windows`);
   for(const frame of item.frames){
    check(frame.nib&&frame.core,`${family.id}: measured writing has a visible attached brush`);
    check(frame.core.sourceError<1e-7,`${family.id}: presentation retains the exact canonical source frontier`);
    check(Math.hypot(frame.core.endpoint.x-frame.nib.x,frame.core.endpoint.y-frame.nib.y)<.04,`${family.id}: brush contacts the actual clipped source path`);
    check(Math.abs(frame.core.clipRight-frame.nib.x)<.05,`${family.id}: clipping reveals no future pulse ahead of the contact point`);
    check(frame.core.width>=1.2&&frame.core.width<=2.5,`${family.id}: source ink has a readable crisp width`);
    check(frame.nib.width>=32&&frame.nib.width<=52&&frame.tipBounds.width<=64&&frame.tipBounds.height<=64,`${family.id}: pointed brush is visible but bounded on mobile`);
    check(Math.abs(frame.nib.x-frame.anchorX)<.04&&Math.abs(frame.anchorX-frame.viewport.width*.78)<.04,`${family.id}: contact stays at the fixed 78 percent horizontal anchor`);
    check(frame.nib.y>=16&&frame.nib.y<=frame.viewport.height-16,`${family.id}: source excursions remain inside the painting viewport`);
    check(frame.projection.kind==='continuous-source-time-value'&&frame.projection.windowSeconds===6,`${family.id}: recording has one continuous source-time/value projection`);
    check(frame.core.timeFit.slope>0&&frame.core.timeFit.residual<.011&&frame.core.valueFit.slope<0&&frame.core.valueFit.residual<.011,`${family.id}: every cached vertex preserves measured time and amplitude without terrain distortion`);
    check(frame.cachedPixels<=2560000&&frame.materialPixels<=4554752,`${family.id}: presentation keeps the established raster and material budgets`);
    for(const interval of frame.visibleIntervals)check(interval.sourceStart<=interval.sourceEnd&&interval.start<=interval.end,`${family.id}: visible source intervals are finite ordered pen runs`);
   }
   for(let i=1;i<item.frames.length;i++){
    const a=item.frames[i-1],b=item.frames[i];
    check(a.projection.baseline===b.projection.baseline&&a.projection.amplitude===b.projection.amplitude,`${family.id}: paper baseline and amplitude do not jump at measured-window boundaries`);
   }
   result.failures.push(...issues);result.cases.push(item);
   if(process.env.PPG_BRUSH_SCREENSHOTS==='1')await page.screenshot({path:path.join(out,`${engine}-${family.id}.png`)});
  }
  result.lifecycle=await page.evaluate(segments=>{
   const before=JSON.stringify(scene);view.pause(true);
   const pausedImage=view.canvas.toDataURL(),frames=__pulseLandscapeStats.frames,cursor=__pulseLandscapeStats.streamTime;
   PulseLandscape.append(scene,segments[7]);view.sync();
   for(let i=0;i<20;i++)advancePaint();
   const paused={sameImage:pausedImage===view.canvas.toDataURL(),sameFrames:frames===__pulseLandscapeStats.frames,sameCursor:cursor===__pulseLandscapeStats.streamTime,pending:pendingPaint(),sourceGrew:JSON.stringify(scene)!==before};
   view.pause(false);for(let i=0;i<5;i++)advancePaint();
   const resumed=__pulseLandscapeStats.frames>frames;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
   const hiddenFrames=__pulseLandscapeStats.frames,hiddenCursor=__pulseLandscapeStats.streamTime;advancePaint(5000);
   const hidden={sameFrames:hiddenFrames===__pulseLandscapeStats.frames,sameCursor:hiddenCursor===__pulseLandscapeStats.streamTime,pending:pendingPaint()};
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));advancePaint();
   hidden.resumeAdvance=__pulseLandscapeStats.streamTime-hiddenCursor;for(let i=0;i<5;i++)advancePaint();
   return{paused,resumed,hidden,recovered:__pulseLandscapeStats.frames>hiddenFrames};
  },recording.segments);
  assert.deepEqual(result.lifecycle.paused,{sameImage:true,sameFrames:true,sameCursor:true,pending:0,sourceGrew:true},'pause freezes presentation but retains newly accepted samples');
  assert.ok(result.lifecycle.resumed&&result.lifecycle.recovered,'pause and visibility interruption both recover');
  assert.ok(result.lifecycle.hidden.sameFrames&&result.lifecycle.hidden.sameCursor&&result.lifecycle.hidden.pending===0&&result.lifecycle.hidden.resumeAdvance<=.021,'hidden time cannot create a backlog jump on resume, including bounded 1.2x stream catch-up');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches&&pendingPaint()===0);
  result.reduced=await page.evaluate(async()=>{
   const before=JSON.stringify(scene),frames=__pulseLandscapeStats.frames;
   for(let i=0;i<20;i++)advancePaint();
   const resolved=await view.finish();
   const result={sameScene:resolved===scene,sourceStable:JSON.stringify(scene)===before,framesStable:frames===__pulseLandscapeStats.frames,pending:pendingPaint(),mode:__pulseLandscapeStats.mode,camera:__pulseLandscapeStats.camera};
   view.dispose();advancePaint();
   result.disposed=document.querySelectorAll('.landscape-ink,.landscape-stage,.landscape-tip').length===0&&pendingPaint()===0&&__pulseLandscapeStats.cachedPixels<=4;
   return result;
  });
  assert.deepEqual(result.reduced,{sameScene:true,sourceStable:true,framesStable:true,pending:0,mode:'finished',camera:{x:540,y:540,scale:1},disposed:true},'reduced motion finishes the exact scene without a running animation and disposal releases its surfaces');
  result.empty=await page.evaluate(segment=>{
   const empty=PulseLandscape.create({family:'quiet-lake',seed:3});PulseLandscape.append(empty,{...segment,quality:{good:false}});
   const view=PulseLandscape.createView(document.querySelector('main'),empty);advancePaint();
   const result={strokes:empty.strokes.length,frames:__pulseLandscapeStats.frames,nib:__pulseLandscapeStats.nib,pending:pendingPaint()};view.dispose();return result;
  },recording.segments[0]);
  assert.deepEqual(result.empty,{strokes:0,frames:0,nib:null,pending:0},'rejected source never produces a brush or invented pulse');
  await page.emulateMedia({reducedMotion:'no-preference'});
  result.continuityCases=await page.evaluate(segments=>{
   const result=[];
   for(const label of ['clean','explicit-lift','invalid-leading','invalid-trailing','rejected','channel-change','restored']){
    let scene=PulseLandscape.create({family:'quiet-lake',seed:39293});
    const first=structuredClone(segments[0]),next=structuredClone(segments[1]);
    const missingTime=(first.points.at(-1).t+next.points[0].t)/2;
    if(label==='invalid-trailing')first.points.push({t:missingTime,v:NaN});
    PulseLandscape.append(scene,first);
    if(label==='restored')scene=JSON.parse(JSON.stringify(scene));
    if(label==='explicit-lift')next.points[0].breakBefore=true;
    if(label==='invalid-leading')next.points.unshift({t:missingTime,v:NaN});
    if(label==='rejected')PulseLandscape.append(scene,{quality:{good:false},points:[]});
    if(label==='channel-change')next.channel=`different-${next.channel}`;
    const previous=scene.strokes.at(-1),added=PulseLandscape.append(scene,next),snapshot=JSON.stringify(scene);
    const view=PulseLandscape.createView(document.querySelector('main'),scene);
    const join=document.querySelector(`.landscape-source-join[data-from-stroke-index="${previous.id}"][data-stroke-index="${added[0].id}"]`);
    if(!!join!==(label==='clean'))throw Error(`${label}: live presentation ignored ingestion continuity proof`);
    if(JSON.stringify(scene)!==snapshot)throw Error(`${label}: presentation connector altered saved source coverage`);
    result.push({label,connected:!!join,sourceStable:true});view.dispose();
   }
   return result;
  },recording.segments);
  assert.equal(result.continuityCases.length,7,'normal handoffs connect while close-timestamp explicit, invalid, rejected, channel and restored barriers remain disconnected');
  result.gaps=await page.evaluate(segments=>{
   const scene=PulseLandscape.create({family:'quiet-lake',seed:39293});segments.slice(0,6).forEach(segment=>PulseLandscape.append(scene,segment));
   const original=JSON.stringify(scene),view=PulseLandscape.createView(document.querySelector('main'),scene);
   const sourceGaps=scene.strokes.slice(1).filter((stroke,index)=>stroke.sourceStart-scene.strokes[index].sourceEnd>.12).length;
   const result={sourceGaps,strokes:scene.strokes.length,gapFrames:0,checkedIntervals:0,checkedPaths:0};
   const explicitLifts=new Set(segments.flatMap(segment=>segment.points.filter(point=>point.breakBefore).map(point=>point.t)));
   for(const group of document.querySelectorAll('.landscape-record')){
    const index=Number(group.dataset.recordIndex),stroke=scene.strokes[index],core=group.querySelector('.landscape-live-core');
    if(Number(core.dataset.strokeIndex)!==index||!stroke)throw Error('A cached record lost its accepted source owner');
    if((core.getAttribute('d').match(/M/g)||[]).length!==1)throw Error('A source record contains an unowned connecting subpath');
    if(explicitLifts.has(stroke.sourceStart)&&group.querySelector('.landscape-source-join'))throw Error('A real adapter pen lift acquired a presentation connector');
    const vertices=inkVertices(core),source=PulseLandscape.sampleStroke(stroke);
    if(vertices.length!==source.length)throw Error('A fragmented source path dropped measured/interpolated vertices');
    const timeFit=fitInk(source.map(point=>point.t),vertices.map(point=>point.x)),valueFit=fitInk(source.map(point=>point.v),vertices.map(point=>point.y));
    if(timeFit.residual>=.011||valueFit.residual>=.011)throw Error('Source delivery gaps altered the measured pulse geometry');
    result.checkedPaths++;
   }
   for(let i=0;i<12000;i++){
    const stats=__pulseLandscapeStats;
    if(stats.mode!=='recording')throw Error('A delivery gap triggered premature scenic reconstruction');
    if(stats.bridging)inspectJoin(scene,stats);
    else if(stats.activeStroke===null&&stats.streamTime>0&&view.captureState.painted<scene.strokes.length){
     result.gapFrames++;if(stats.nib!==null)throw Error('Brush continued drawing through a period with no accepted source');
    }
    for(const interval of stats.visibleIntervals){
     const stroke=scene.strokes[interval.index];
     if(!stroke||interval.sourceStart!==stroke.sourceStart||interval.sourceEnd>stroke.sourceEnd+1e-8||interval.sourceEnd<stroke.sourceStart-1e-8)throw Error('Visible paper interval invented or combined accepted source runs');
     const group=document.querySelector(`.landscape-record[data-record-index="${interval.index}"]`);
     if(!group||group.querySelectorAll('.landscape-live-core').length!==1)throw Error('A true pen lift was joined to a neighbouring source path');
     result.checkedIntervals++;
    }
    if(!advancePaint())break;
   }
   result.sourceStable=JSON.stringify(scene)===original;result.mode=__pulseLandscapeStats.mode;view.dispose();return result;
  },fragmented.segments);
  assert.ok(result.gaps.sourceGaps>5&&result.gaps.gapFrames>10&&result.gaps.checkedIntervals>100&&result.gaps.checkedPaths===result.gaps.strokes&&result.gaps.sourceStable&&result.gaps.mode==='recording','dropped real delivery produces separate measured paths and visible pen lifts, never fabricated connecting pulses');
  result.reconstruction=[];
  for(const family of families){
  const reconstructed=await page.evaluate(async({segments,family})=>{
   const scene=PulseLandscape.create({family,seed:39293});segments.slice(0,7).forEach(segment=>PulseLandscape.append(scene,segment));
   const original=JSON.stringify(scene),view=PulseLandscape.createView(document.querySelector('main'),scene);
   for(let i=0;i<60;i++)advancePaint();
   let complete=false,resolved;const start=paintClock(),completion=view.finish().then(value=>{complete=true;resolved=value});
   const phases=new Set(),morphs=[];let checkedColors=0;
   for(let i=0;i<600&&!complete;i++){
    advancePaint();const stats=__pulseLandscapeStats;phases.add(stats.mode);
    if(stats.mode==='reconstructing'&&stats.morphProgress>.02&&stats.morphProgress<.98){
     for(const line of document.querySelectorAll('.landscape-reveal-core')){
      const color=line.getAttribute('stroke');
      if(!color||!CSS.supports('color',color)||getComputedStyle(line).stroke==='none')throw Error('Reconstruction pulse has an invalid or invisible stroke color');
      checkedColors++;
     }
     for(const point of stats.revealSamples||[]){
      const p=stats.morphProgress,expected={x:point.from.x*(1-p)+point.to.x*p,y:point.from.y*(1-p)+point.to.y*p};
      const stroke=scene.strokes[point.strokeIndex],progress=(point.t-stroke.sourceStart)/(stroke.sourceEnd-stroke.sourceStart),source=PulseLandscape.strokeFrontier(stroke,progress);
      const path=document.querySelector(`.landscape-reveal-core[data-stroke-index="${point.strokeIndex}"]`),vertex=path&&inkVertices(path)[point.pointIndex];
      if(!vertex)throw Error('Reconstruction sample has no corresponding rendered source vertex');
      const box=document.querySelector('main').getBoundingClientRect(),side=Math.min(box.width,box.height);
      const target={x:(box.width-side)/2+source.x/1080*side,y:(box.height-side)/2+source.y/1080*side};
      const rows=Math.max(1,scene.slots.length),rowH=860/rows,domain=stroke.transform.domain;
      const unit=Math.min(1,Math.max(0,(point.v-domain.min)/(domain.max-domain.min||1)));
      const manuscript={x:(box.width-side)/2+(100+880*Math.min(1,Math.max(0,(stroke.slotStart+point.t-stroke.sourceStart)/5)))/1080*side,y:(box.height-side)/2+(110+(stroke.slot+.5)*rowH+(.5-unit)*Math.min(34,rowH*.72))/1080*side};
      morphs.push({progress:p,strokeIndex:point.strokeIndex,t:point.t,v:point.v,sourceError:Math.max(Math.abs(source.t-point.t),Math.abs(source.v-point.v)),interpolationError:Math.hypot(point.current.x-expected.x,point.current.y-expected.y),domError:Math.hypot(vertex.x-expected.x,vertex.y-expected.y),targetError:Math.hypot(point.to.x-target.x,point.to.y-target.y),manuscriptError:Math.hypot(point.from.x-manuscript.x,point.from.y-manuscript.y),travel:Math.hypot(point.from.x-point.to.x,point.from.y-point.to.y)});
     }
    }
    if(i%30===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(!complete)throw Error('Reconstruction exceeded its bounded presentation duration');await completion;
   const output={family,elapsed:paintClock()-start,phases:[...phases],morphs,checkedColors,sameScene:resolved===scene,sourceStable:JSON.stringify(scene)===original,finished:__pulseLandscapeStats.finished,mode:__pulseLandscapeStats.mode};
   view.dispose();return output;
  },{segments:recording.segments,family:family.id});
  result.reconstruction.push(reconstructed);
  assert.ok(reconstructed.sameScene&&reconstructed.sourceStable&&reconstructed.finished&&reconstructed.mode==='finished',`${family.id}: reconstruction resolves the same complete accepted scene`);
  assert.ok(reconstructed.phases.includes('pullback')&&reconstructed.phases.includes('reconstructing'),`${family.id}: manuscript pullback precedes scenic reconstruction`);
  assert.ok(reconstructed.elapsed>=5700&&reconstructed.elapsed<8000,`${family.id}: one bounded reconstruction replaces per-window settling`);
  assert.ok(reconstructed.morphs.length>12&&reconstructed.checkedColors>50&&reconstructed.morphs.some(point=>point.progress>.3&&point.progress<.7&&point.travel>10),`${family.id}: valid visible pulse vertices pass through intermediate terrain geometry`);
  assert.ok(reconstructed.morphs.every(point=>point.sourceError<1e-7&&point.interpolationError<1e-6),`${family.id}: morphing keeps source t/v and interpolates the same point between manuscript and terrain`);
  assert.ok(reconstructed.morphs.every(point=>point.domError<.002&&point.targetError<1e-6&&point.manuscriptError<1e-6),`${family.id}: actual DOM vertices follow measured manuscript locations into canonical pulseCore terrain coordinates`);
  }
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.failures,[],'all scene families preserve continuous measured ink, an anchored brush and immutable pigment on moving paper');
  result.passed=true;
 }catch(error){result.failure=String(error.stack||error);process.exitCode=1;}
 finally{writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(result,null,2));await browser?.close();console.log(JSON.stringify({engine,passed:!!result.passed,cases:result.cases.length,provenance:result.provenance?.length,failure:result.failure,out}));}
}
