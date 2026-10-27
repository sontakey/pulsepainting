// Public recorded samples pass through the real pinned PPG engine and app
// acceptance adapter. The stepped clock verifies presentation correctness;
// it is deliberately separate from the real-time mobile performance probe.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import sharp from 'sharp';
import { replayPublicFixture } from '../landscape-fixture.mjs';

// Software Chromium can change edge coverage when adding an otherwise opaque
// SVG compositing surface. Interior pixels retain the one-level rounding gate;
// larger differences must be within one physical pixel of contrast, bounded by
// 1/8 of that channel's local contrast (+1 rounding level), never above 16.
// Geometry below separately proves no paint touches the mask feather or clip.
function compareMaskRaster(plain,forced){
 const {width,height}=plain.info;let max=0,sum=0,changedChannels=0,edgeChannels=0,edgeViolations=0,maxContrastExcess=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let channel=0;channel<4;channel++){
  const i=(y*width+x)*4+channel,difference=Math.abs(plain.data[i]-forced.data[i]);
  max=Math.max(max,difference);sum+=difference;if(difference)changedChannels++;
  if(difference<=1)continue;
  edgeChannels++;let pmin=255,pmax=0,fmin=255,fmax=0;
  for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++){
   const j=(yy*width+xx)*4+channel;
   pmin=Math.min(pmin,plain.data[j]);pmax=Math.max(pmax,plain.data[j]);fmin=Math.min(fmin,forced.data[j]);fmax=Math.max(fmax,forced.data[j]);
  }
  const contrast=Math.max(pmax-pmin,fmax-fmin),excess=difference-1-contrast/8;
  maxContrastExcess=Math.max(maxContrastExcess,excess);
  if(difference>16||excess>1e-9)edgeViolations++;
 }
 return {max,mean:sum/plain.data.length,changedChannels,edgeChannels,edgeViolations,maxContrastExcess};
}

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
    const snapshot={mode:stats.mode,state:{...state},bridging:!!stats.bridging,streamTime:stats.streamTime,paperOffsetY:stats.paperOffsetY,lineTurn:structuredClone(stats.lineTurn),anchorX:stats.anchorX,projection:structuredClone(stats.projection),frontier:structuredClone(stats.frontier),nib:structuredClone(stats.nib),visibleIntervals:structuredClone(stats.visibleIntervals||[]),
     finalScenicHidden:!stage||stage.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0,
     cachedPixels:stats.cachedPixels,materialPixels:stats.materialPixels,pixelBudget:stats.pixelBudget,materialPixelBudget:stats.materialPixelBudget,viewport:{width:box.width,height:box.height}};
    if(!stats.nib||!stats.frontier||state.painted>=scene.strokes.length)return snapshot;
    if(stats.bridging||stats.nib.drawing===false)return snapshot;
    const stroke=scene.strokes[state.painted],path=document.querySelector(`.landscape-live-core[data-stroke-index="${state.painted}"]`);
    if(!path)throw Error('Active measured source has no inspectable cached core path');
    const original=PulseLandscape.sampleStroke(stroke),vertices=inkVertices(path);
    if(vertices.length!==original.length)throw Error('Cached foreground omitted original source/interpolation vertices');
    const timeFit=fitInk(original.map(point=>point.t),vertices.map(point=>point.x)),valueFit=fitInk(original.map(point=>point.v),vertices.map(point=>point.y));
    const fragment=document.querySelector(`.landscape-line[data-line-index="${stats.projection.lineIndex}"] .landscape-line-fragment[data-record-index="${state.painted}"]`);
    if(!fragment)throw Error('Active measured source has no visible row fragment');
    const expected=PulseLandscape.strokeFrontier(stroke,state.progress),matrix=fragment.getScreenCTM();
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
    const fragment=document.querySelector(`.landscape-line[data-line-index="${stats.projection.lineIndex}"] .landscape-line-fragment[data-record-index="${toIndex}"]`);
    if(!fragment)throw Error('Source handoff has no visible row fragment');
    const matrix=fragment.getScreenCTM(),q=new DOMPoint(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u).matrixTransform(matrix),box=document.querySelector('main').getBoundingClientRect();
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
    let previous=null,immutableChecks=0,maxContactStep=0,maxPaperStep=0,bridgeFrames=0,maxBridgeError=0,returnFrames=0,lineTurns=0,maxVisibleLines=0,threeRowChecks=0;
    for(let i=0;i<16000;i++){
     const snapshot=inspectRecording(scene,view),state=snapshot.state;
     if(snapshot.mode!=='recording')throw Error('Final reconstruction started before the explicit finish action');
     if(!snapshot.finalScenicHidden)throw Error('The full-contrast final landscape is visible before finish');
     for(const path of document.querySelectorAll('.landscape-live-core,.landscape-source-wash,.landscape-source-join,.landscape-source-blooms,.landscape-source-body,.landscape-source-edge')){
      const d=path.getAttribute('d');if(cache.has(path)&&cache.get(path)!==d)throw Error('Previously deposited source ink or pigment changed shape while paper moved');
      if(cache.has(path))immutableChecks++;else cache.set(path,d);
     }
     if(snapshot.bridging&&snapshot.nib?.drawing){const join=inspectJoin(scene,__pulseLandscapeStats);bridgeFrames++;maxBridgeError=Math.max(maxBridgeError,join.endpointError);}
     if(snapshot.lineTurn?.active){returnFrames++;if(snapshot.nib?.drawing)throw Error('The returning brush left ink across the paper');}
     const paperViewport=document.querySelector('.landscape-paper-trace').parentElement,paperMask=document.querySelector('.landscape-ink mask[id$="-paper-window"]');
     if(snapshot.lineTurn?.active){if(!paperMask||paperViewport.getAttribute('mask')!==`url(#${paperMask.id})`)throw Error('The exiting oldest row has no paper-window mask during its return');}
     else if(paperViewport.hasAttribute('mask'))throw Error('Settled manuscript rows retain an unnecessary parent raster mask');
     const rows=[...document.querySelectorAll('.landscape-line')],lineIndex=snapshot.projection.lineIndex;
     if(snapshot.projection.retainedLines!==3)throw Error('The live manuscript no longer retains three rows');
     if(rows.length>(snapshot.lineTurn?.active?4:3))throw Error('The manuscript mounted more than its three retained rows and return destination');
     if(!snapshot.lineTurn?.active&&lineIndex>=2&&snapshot.projection.lineProgress>.02){
      const expected=[lineIndex-2,lineIndex-1,lineIndex];
      if(JSON.stringify(rows.map(row=>Number(row.dataset.lineIndex)))!==JSON.stringify(expected))throw Error('Three consecutive settled rows are not mounted');
      if(rows.some(row=>!row.querySelector('.landscape-line-fragment')||Number(getComputedStyle(row).opacity)!==1))throw Error('A settled retained row has no visible accepted ink');
      if(expected.some(index=>!snapshot.visibleIntervals.some(interval=>interval.line===index)))throw Error('A settled visible row has no measured source coverage');
      threeRowChecks++;
     }
     maxVisibleLines=Math.max(maxVisibleLines,rows.length);
     for(const material of document.querySelectorAll('.landscape-ink pattern,.landscape-ink mask')){
      const placement=['x','y','width','height','patternTransform','patternUnits','maskUnits','maskContentUnits'].map(name=>material.getAttribute(name)).join('|');
      if(textureCache.has(material)&&textureCache.get(material)!==placement)throw Error('Paper texture shifted relative to its deposited waveform');
      textureCache.set(material,placement);
     }
     if(previous){
      if(snapshot.streamTime<previous.streamTime-1e-9)throw Error('The session-wide cursor restarted at an accepted-window boundary');
      if(snapshot.paperOffsetY>previous.paperOffsetY+.01)throw Error('Paper moved downwards during forward source recording');
      maxPaperStep=Math.max(maxPaperStep,Math.abs(snapshot.paperOffsetY-previous.paperOffsetY));
      if(snapshot.lineTurn?.active&&previous.lineTurn?.active&&Math.abs(snapshot.streamTime-previous.streamTime)>1e-8)throw Error('Brush return consumed accepted source time');
      const lineStep=snapshot.projection.lineIndex-previous.projection.lineIndex;
      if(lineStep<0||lineStep>1)throw Error('The manuscript skipped or repeated a row');
      lineTurns+=lineStep;
      if(snapshot.nib?.drawing&&previous.nib?.drawing&&lineStep===0)maxContactStep=Math.max(maxContactStep,Math.abs(snapshot.nib.x-previous.nib.x));
      if(state.painted!==previous.state.painted)transitions.push({from:previous.state.painted,to:state.painted,streamBefore:previous.streamTime,streamAfter:snapshot.streamTime,anchorBefore:previous.nib?.x,anchorAfter:snapshot.nib?.x});
     }
     if(snapshot.core&&snapshot.nib?.drawing&&state.progress>=.12&&state.progress<=.88&&(state.painted===target||transitions.length<2))frames.push(snapshot);
     previous=snapshot;
     if(state.painted===target&&state.progress>=.72)break;
     if(!advancePaint())throw Error('The continuous source cursor stopped before the active checkpoint');
    }
    if(frames.length<8)throw Error('No sustained active measured source was observed');
    return{family:family.id,sourceStable:before===JSON.stringify(scene),frames,transitions,immutableChecks,maxContactStep,maxPaperStep,bridgeFrames,maxBridgeError,returnFrames,lineTurns,maxVisibleLines,threeRowChecks,state:view.captureState};
   },{family,segments:recording.segments});
   assert.equal(item.sourceStable,true);
   const issues=new Set(),check=(condition,message)=>{if(!condition)issues.add(message)};
   check(item.transitions.length>=5&&item.immutableChecks>100,`${family.id}: one recording crosses accepted windows while reusing deposited core and wash geometry`);
   check(item.bridgeFrames>0&&item.maxBridgeError<.04,`${family.id}: clean accepted-window handoffs retain a continuously attached brush without changing source coverage`);
   check(item.maxContactStep<8&&item.maxPaperStep<12,`${family.id}: drawing and upward paper scrolling advance in bounded steps`);
   check(item.lineTurns>=3&&item.returnFrames>30,`${family.id}: the measured manuscript crosses several rows with a visible brush lift`);
   check(item.maxVisibleLines===4&&item.threeRowChecks>100,`${family.id}: three populated settled rows remain visible with at most the fourth return destination`);
   for(const frame of item.frames){
    check(frame.nib&&frame.core,`${family.id}: measured writing has a visible attached brush`);
    check(frame.core.sourceError<1e-7,`${family.id}: presentation retains the exact canonical source frontier`);
    check(Math.hypot(frame.core.endpoint.x-frame.nib.x,frame.core.endpoint.y-frame.nib.y)<.04,`${family.id}: brush contacts the actual clipped source path`);
    check(Math.abs(frame.core.clipRight-frame.nib.x)<.05,`${family.id}: clipping reveals no future pulse ahead of the contact point`);
    check(frame.core.width>=1.2&&frame.core.width<=2.5,`${family.id}: source ink has a readable crisp width`);
    check(frame.nib.width>=32&&frame.nib.width<=52&&frame.tipBounds.width<=64&&frame.tipBounds.height<=64,`${family.id}: pointed brush is visible but bounded on mobile`);
    check(Math.abs(frame.nib.x-frame.anchorX)<.04&&frame.nib.x>=0&&frame.nib.x<=frame.viewport.width,`${family.id}: the writing contact remains on the current paper row`);
    check(frame.nib.y>=16&&frame.nib.y<=frame.viewport.height-16,`${family.id}: source excursions remain inside the painting viewport`);
    check(frame.projection.kind==='wrapped-source-time-value'&&frame.projection.windowSeconds===6&&frame.projection.lineSeconds===6,`${family.id}: recording wraps six seconds of measured source per line without changing values`);
    check(frame.core.timeFit.slope>0&&frame.core.timeFit.residual<.011&&frame.core.valueFit.slope<0&&frame.core.valueFit.residual<.011,`${family.id}: every cached vertex preserves measured time and amplitude without terrain distortion`);
    check(frame.cachedPixels<=frame.pixelBudget&&frame.pixelBudget<=3086336&&frame.materialPixels<=4554752,`${family.id}: presentation keeps the bounded raster and material budgets, including ambient snapshots and their fixed mask`);
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
   view.dispose();window.scene=PulseLandscape.create({family:'quiet-lake',seed:39293});segments.slice(0,7).forEach(segment=>PulseLandscape.append(scene,segment));window.view=PulseLandscape.createView(document.querySelector('main'),scene);
   for(let i=0;i<2000;i++){advancePaint();if(__pulseLandscapeStats.lineTurn?.active&&__pulseLandscapeStats.lineTurn.progress>=.25&&__pulseLandscapeStats.lineTurn.progress<=.6)break;}
   if(!__pulseLandscapeStats.lineTurn?.active)throw Error('Lifecycle check did not reach a visible brush return');
   const heldTurn=JSON.stringify(__pulseLandscapeStats.lineTurn),heldPaper=__pulseLandscapeStats.paperOffsetY;
   const before=JSON.stringify(scene);view.pause(true);
   const pausedImage=view.canvas.toDataURL(),frames=__pulseLandscapeStats.frames,cursor=__pulseLandscapeStats.streamTime;
   PulseLandscape.append(scene,segments[7]);view.sync();
   for(let i=0;i<20;i++)advancePaint();
   const paused={sameImage:pausedImage===view.canvas.toDataURL(),sameFrames:frames===__pulseLandscapeStats.frames,sameCursor:cursor===__pulseLandscapeStats.streamTime,sameTurn:heldTurn===JSON.stringify(__pulseLandscapeStats.lineTurn),samePaper:heldPaper===__pulseLandscapeStats.paperOffsetY,pending:pendingPaint(),sourceGrew:JSON.stringify(scene)!==before};
   view.pause(false);for(let i=0;i<5;i++)advancePaint();
   const resumed=__pulseLandscapeStats.frames>frames;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
   const hiddenFrames=__pulseLandscapeStats.frames,hiddenCursor=__pulseLandscapeStats.streamTime,hiddenTurn=JSON.stringify(__pulseLandscapeStats.lineTurn),hiddenPaper=__pulseLandscapeStats.paperOffsetY;advancePaint(5000);
   const hidden={sameFrames:hiddenFrames===__pulseLandscapeStats.frames,sameCursor:hiddenCursor===__pulseLandscapeStats.streamTime,sameTurn:hiddenTurn===JSON.stringify(__pulseLandscapeStats.lineTurn),samePaper:hiddenPaper===__pulseLandscapeStats.paperOffsetY,pending:pendingPaint()};
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));advancePaint();
   hidden.resumeAdvance=__pulseLandscapeStats.streamTime-hiddenCursor;for(let i=0;i<5;i++)advancePaint();
   return{paused,resumed,hidden,recovered:__pulseLandscapeStats.frames>hiddenFrames};
  },recording.segments);
  assert.deepEqual(result.lifecycle.paused,{sameImage:true,sameFrames:true,sameCursor:true,sameTurn:true,samePaper:true,pending:0,sourceGrew:true},'pause freezes the lifted brush and scrolling paper but retains newly accepted samples');
  assert.ok(result.lifecycle.resumed&&result.lifecycle.recovered,'pause and visibility interruption both recover');
  assert.ok(result.lifecycle.hidden.sameFrames&&result.lifecycle.hidden.sameCursor&&result.lifecycle.hidden.sameTurn&&result.lifecycle.hidden.samePaper&&result.lifecycle.hidden.pending===0&&result.lifecycle.hidden.resumeAdvance<=.021,'hidden time cannot create a backlog jump on resume, without catching up through hidden source time');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>{
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
   // A discrete discovery still has a quiet, time-limited caption. Drain that
   // presentation timer on the stepped clock before asserting the idle state.
   for(let i=0;i<400;i++)advancePaint();
   return (__pulseLandscapeStats.warmStrokes||0)>=scene.strokes.length&&!__pulseLandscapeStats.emergence.animating&&!__pulseLandscapeStats.emergence.captionVisible&&pendingPaint()===0;
  });
  result.reduced=await page.evaluate(async()=>{
   const before=JSON.stringify(scene),frames=__pulseLandscapeStats.frames;
   for(let i=0;i<20;i++)advancePaint();
   const resolved=await view.finish();
   const result={sameScene:resolved===scene,sourceStable:JSON.stringify(scene)===before,framesStable:frames===__pulseLandscapeStats.frames,pending:pendingPaint(),mode:__pulseLandscapeStats.mode,camera:__pulseLandscapeStats.camera};
   view.dispose();advancePaint();
   result.disposed=document.querySelectorAll('.landscape-ink,.landscape-stage,.landscape-tip,.landscape-emergence,.landscape-discovery').length===0&&pendingPaint()===0&&__pulseLandscapeStats.cachedPixels<=7;
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
    if(stats.bridging&&stats.nib?.drawing)inspectJoin(scene,stats);
    else if(!stats.lineTurn?.active&&stats.activeStroke===null&&stats.streamTime>0&&view.captureState.painted<scene.strokes.length){
     result.gapFrames++;if(stats.nib!==null)throw Error('Brush continued drawing through a period with no accepted source');
    }
    for(const interval of stats.visibleIntervals){
     const stroke=scene.strokes[interval.index];
     if(!stroke||interval.sourceStart<stroke.sourceStart-1e-8||interval.sourceEnd>stroke.sourceEnd+1e-8||interval.sourceEnd<interval.sourceStart-1e-8)throw Error('Visible paper interval invented or combined accepted source runs');
     const group=document.querySelector(`.landscape-record[data-record-index="${interval.index}"]`),fragment=document.querySelector(`.landscape-line[data-line-index="${interval.line}"] .landscape-line-fragment[data-record-index="${interval.index}"]`);
     if(!group||!fragment||group.querySelectorAll('.landscape-live-core').length!==1)throw Error('A visible row lost its source owner or a true pen lift was joined');
     result.checkedIntervals++;
    }
    if(!advancePaint())break;
   }
   result.sourceStable=JSON.stringify(scene)===original;result.mode=__pulseLandscapeStats.mode;view.dispose();return result;
  },fragmented.segments);
  assert.ok(result.gaps.sourceGaps>5&&result.gaps.gapFrames>10&&result.gaps.checkedIntervals>100&&result.gaps.checkedPaths===result.gaps.strokes&&result.gaps.sourceStable&&result.gaps.mode==='recording','dropped real delivery produces separate measured paths and visible pen lifts, never fabricated connecting pulses');
  // Finish must begin at the actual sub-sample frontier, including a brush
  // return halfway through scrolling. A rounded original knot is not enough:
  // live interpolation can differ visibly between recorded samples.
  result.finishSeams=await page.evaluate(async segments=>{
   const results=[];
   for(const label of ['sub-sample','mid-return']){
    const scene=PulseLandscape.create({family:'quiet-lake',seed:39293});segments.slice(0,7).forEach(segment=>PulseLandscape.append(scene,segment));
    const view=PulseLandscape.createView(document.querySelector('main'),scene),sourceBefore=JSON.stringify(scene);
    for(let i=0;i<3000;i++){
     advancePaint(17.173);
     const stats=__pulseLandscapeStats;
     if(label==='sub-sample'&&stats.streamTime>1.731&&stats.nib?.drawing){advancePaint(.319);break;}
     if(label==='mid-return'&&stats.lineTurn?.active&&stats.lineTurn.toLine===3&&stats.lineTurn.progress>.4&&stats.lineTurn.progress<.6)break;
    }
    const before=structuredClone(__pulseLandscapeStats),stroke=scene.strokes[before.painted];
    if(label==='mid-return'&&(!before.lineTurn?.active||before.nib?.drawing))throw Error('Finish-mid-return case never reached a lifted brush');
    if(label==='sub-sample'&&stroke.points.some(p=>Math.abs(p.t-before.frontier.t)<1e-5))throw Error('Arbitrary finish happened on a recorded knot');
    const core=document.querySelector(`.landscape-live-core[data-stroke-index="${before.painted}"]`),vertices=inkVertices(core),source=PulseLandscape.sampleStroke(stroke);
    const fitT=fitInk(source.map(p=>p.t),vertices.map(p=>p.x)),fitV=fitInk(source.map(p=>p.v),vertices.map(p=>p.y));
    const fragment=document.querySelector(`.landscape-line[data-line-index="${before.projection.lineIndex}"] .landscape-line-fragment[data-record-index="${before.painted}"]`);
    if(!fragment)throw Error('The live endpoint has no manuscript row');
    const box=document.querySelector('main').getBoundingClientRect(),point=new DOMPoint(before.frontier.t*fitT.slope+fitT.offset,before.frontier.v*fitV.slope+fitV.offset).matrixTransform(fragment.getScreenCTM());
    const expected={x:point.x-box.x,y:point.y-box.y};
    const oldRow=document.querySelector(`.landscape-line[data-line-index="${before.projection.lineIndex-2}"]`),oldOpacity=oldRow?Number(getComputedStyle(oldRow).opacity):null;
    if(label==='mid-return'&&!(oldOpacity>0&&oldOpacity<1))throw Error('Finish case did not reach a fading oldest retained row');
    const completion=view.finish();
    if(__pulseLandscapeStats.mode!=='pullback'||__pulseLandscapeStats.streamTime!==before.streamTime)throw Error('Finish advanced source before its first reveal frame');
    const activePaths=[...document.querySelectorAll(`.landscape-reveal-core[data-stroke-index="${before.painted}"][data-line-index="${before.projection.lineIndex}"]`)].filter(path=>Number(path.style.opacity)>0);
    const endpointError=Math.min(...activePaths.map(path=>{const p=inkVertices(path).at(-1);return Math.hypot(p.x-expected.x,p.y-expected.y);}));
    if(!(endpointError<.025))throw Error(`${label}: first reveal frame shifted the exact live source endpoint by ${endpointError}px`);
    let opacityChecks=0;
    if(label==='mid-return')for(const path of document.querySelectorAll(`.landscape-reveal-core[data-line-index="${before.projection.lineIndex-2}"]`)){
     if(Math.abs(Number(path.style.opacity)-oldOpacity)>1e-6)throw Error('Finish resurrected the fading oldest retained row');
     opacityChecks++;
    }
    view.cancelFinish();await completion;
    if(JSON.stringify(scene)!==sourceBefore)throw Error('Finish seam changed accepted source');
    results.push({label,endpointError,opacityChecks,oldestLine:before.projection.lineIndex-2,oldOpacity,frontier:before.frontier,turn:before.lineTurn,sourceStable:true});view.dispose();
   }
   return results;
  },recording.segments);
  assert.ok(result.finishSeams.length===2&&result.finishSeams[1].opacityChecks>0,'arbitrary-cursor and mid-return Finish preserve endpoint placement and row fade');
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
      const path=document.querySelector(`.landscape-reveal-core[data-stroke-index="${point.strokeIndex}"][data-fragment-index="${point.fragmentIndex}"]`),vertex=path&&inkVertices(path)[point.pointIndex];
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
  // The settled three-row footprint fits the opaque region of the old parent
  // mask. Compare actual browser pixels, not only geometry/stat metadata, before
  // and after forcing that mask back on at normal and short/narrow phone sizes.
  result.settledMaskParity=[];
  for(const size of [{width:390,height:844,paperHeight:520},{width:320,height:568,paperHeight:320}]){
   await page.setViewportSize({width:size.width,height:size.height});
   const state=await page.evaluate(({segments,paperHeight})=>{
    document.querySelector('main').style.height=`${paperHeight}px`;
    window.scene=PulseLandscape.create({family:'quiet-lake',seed:39293});segments.slice(0,7).forEach(segment=>PulseLandscape.append(scene,segment));
    window.maskParitySource=JSON.stringify(scene);window.view=PulseLandscape.createView(document.querySelector('main'),scene);
    for(let i=0;i<2400;i++){
     advancePaint();const p=__pulseLandscapeStats.projection;
     if(p.lineIndex===3&&p.lineProgress>.45&&!__pulseLandscapeStats.lineTurn.active)break;
    }
    const stats=__pulseLandscapeStats,viewport=document.querySelector('.landscape-paper-trace').parentElement;
    if(stats.projection.lineIndex!==3||stats.visibleLines!==3||stats.lineTurn.active||viewport.hasAttribute('mask'))throw Error('Pixel parity did not reach three settled unmasked rows');
    // The stepped clock remains fixed; pause also cancels asynchronous warming
    // so both screenshots show exactly the same deposited source and pigment.
    view.pause(true);
    const mask=document.querySelector('.landscape-ink mask[id$="-paper-window"]'),maskRect=mask.querySelector('rect'),paper=document.querySelector('main').getBoundingClientRect();
    const reference=node=>document.getElementById(node.match(/#([^)'"\s]+)/)?.[1]);
    const attributes=node=>Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(node.getAttribute(key))]));
    const windowRect=attributes(maskRect),fade=reference(maskRect.getAttribute('fill'));
    if(mask.getAttribute('maskUnits')!=='userSpaceOnUse'||fade.getAttribute('gradientUnits')!=='userSpaceOnUse'||fade.querySelector('stop:last-child').getAttribute('stop-color')!=='white')throw Error('Parent mask no longer has an inspectable fully opaque paper region');
    const opaque={left:windowRect.x,top:Number(fade.getAttribute('y2')),right:windowRect.x+windowRect.width,bottom:windowRect.y+windowRect.height};
    const footprints=[];
    for(const fragment of document.querySelectorAll('.landscape-line-fragment')){
     const record=document.getElementById(fragment.getAttribute('href').slice(1)),row=fragment.parentElement;
     const bounds=fragment.getBBox(),recordClip=attributes(reference(record.getAttribute('clip-path')).querySelector('rect')),rowClip=attributes(reference(row.getAttribute('clip-path')).querySelector('rect'));
     const left=Math.max(bounds.x,recordClip.x,rowClip.x),top=Math.max(bounds.y,recordClip.y,rowClip.y),right=Math.min(bounds.x+bounds.width,recordClip.x+recordClip.width,rowClip.x+rowClip.width),bottom=Math.min(bounds.y+bounds.height,recordClip.y+recordClip.height,rowClip.y+rowClip.height);
     if(right<=left||bottom<=top)continue;
     const matrix=fragment.getScreenCTM(),a=new DOMPoint(left,top).matrixTransform(matrix),b=new DOMPoint(right,bottom).matrixTransform(matrix);
     // getBBox includes the wash/body/blooms. Include the full 4px non-scaling
     // edge stroke too, even where record/line clipping would trim its radius.
     const footprint={record:Number(fragment.dataset.recordIndex),line:Number(row.dataset.lineIndex),left:a.x-paper.x-2,top:a.y-paper.y-2,right:b.x-paper.x+2,bottom:b.y-paper.y+2};
     footprint.whiteMargin=Math.min(footprint.left-opaque.left,footprint.top-opaque.top,opaque.right-footprint.right,opaque.bottom-footprint.bottom);
     if(footprint.whiteMargin<.5)throw Error(`Settled pigment touches the parent's feather/clip region: ${JSON.stringify({footprint,opaque})}`);
     footprints.push(footprint);
    }
    if(![1,2,3].every(line=>footprints.some(item=>item.line===line)))throw Error('Mask geometry proof does not cover each settled source row');
    return {projection:structuredClone(stats.projection),streamTime:stats.streamTime,visibleLines:stats.visibleLines,pixelRatio:devicePixelRatio,opaqueMask:opaque,footprints};
   },{segments:recording.segments,paperHeight:size.paperHeight});
   const prefix=`${engine}-${size.width}x${size.height}-settled`;
   const unmasked=await page.locator('main').screenshot({path:path.join(out,`${prefix}-unmasked.png`)});
   await page.evaluate(()=>{
    const mask=document.querySelector('.landscape-ink mask[id$="-paper-window"]');
    document.querySelector('.landscape-paper-trace').parentElement.setAttribute('mask',`url(#${mask.id})`);
   });
   const masked=await page.locator('main').screenshot({path:path.join(out,`${prefix}-forced-mask.png`)});
   await page.evaluate(()=>document.querySelector('.landscape-paper-trace').parentElement.removeAttribute('mask'));
   const restored=await page.locator('main').screenshot({path:path.join(out,`${prefix}-restored.png`)});
   const [plain,forced,again]=await Promise.all([unmasked,masked,restored].map(buffer=>sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true})));
   assert.deepEqual(forced.info,plain.info,'forcing the parent mask cannot resize the settled screenshot');
   assert.deepEqual(again.info,plain.info);
   const difference=compareMaskRaster(plain,forced);
   let inkPixels=0,restoredMax=0;
   for(let i=0;i<plain.data.length;i++)restoredMax=Math.max(restoredMax,Math.abs(plain.data[i]-again.data[i]));
   for(let i=0;i<plain.data.length;i+=4)if(plain.data[i+2]-plain.data[i]>15)inkPixels++;
   const parity={size,...state,width:plain.info.width,height:plain.info.height,...difference,inkPixels,restoredMax};
   result.settledMaskParity.push(parity);
   await page.evaluate(()=>{if(JSON.stringify(scene)!==maskParitySource)throw Error('Parent-mask comparison changed accepted source');view.dispose();});
   assert.ok(inkPixels>100,'the compared screenshots contain visible measured blue pigment');
   assert.equal(restoredMax,0,'restoring the unmasked parent produces the exact same settled screenshot');
   assert.equal(difference.edgeViolations,0,`${engine}/${size.width}: removing the settled parent mask changes interior pigment or exceeds bounded edge coverage (${JSON.stringify(difference)})`);
   if(size.width===390){
    // Demonstrate that edge tolerance cannot bless visibly displaced, erased,
    // or faded ink. These controls mutate only temporary screenshot bytes.
    parity.regressionControls=[];
    for(const mutation of ['shift-one-css-pixel','erase-oldest-row','fade-five-percent']){
     const altered={info:plain.info,data:Buffer.from(plain.data)},shift=Math.round(state.pixelRatio),firstRow=state.footprints.filter(item=>item.line===1);
     const top=Math.floor(Math.min(...firstRow.map(item=>item.top))*state.pixelRatio),bottom=Math.ceil(Math.max(...firstRow.map(item=>item.bottom))*state.pixelRatio);
     for(let y=0;y<plain.info.height;y++)for(let x=0;x<plain.info.width;x++)for(let c=0;c<3;c++){
      const i=(y*plain.info.width+x)*4+c;
      if(mutation==='shift-one-css-pixel')altered.data[i]=x<shift?plain.data[c]:plain.data[(y*plain.info.width+x-shift)*4+c];
      else if(mutation==='erase-oldest-row'&&y>=top&&y<=bottom)altered.data[i]=plain.data[c];
      else if(mutation==='fade-five-percent')altered.data[i]=Math.round(plain.data[i]*.95+plain.data[c]*.05);
     }
     const diagnostic=compareMaskRaster(plain,altered);
     assert.ok(diagnostic.edgeViolations>0,`${engine}: the mask parity gate accepted ${mutation}`);
     parity.regressionControls.push({mutation,...diagnostic});
    }
   }
  }
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.failures,[],'all scene families preserve measured ink, smooth line returns and immutable pigment on scrolling paper');
  result.passed=true;
 }catch(error){result.failure=String(error.stack||error);process.exitCode=1;}
 finally{writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(result,null,2));await browser?.close();console.log(JSON.stringify({engine,passed:!!result.passed,cases:result.cases.length,provenance:result.provenance?.length,failure:result.failure,out}));}
}
