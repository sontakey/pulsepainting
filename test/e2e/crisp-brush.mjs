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
  // Drive presentation at known intervals, without making a wall-clock frame
  // rate claim. Scenic work may skip frames; measured ink must not share that
  // slower clock, and explicit rest boundaries must expose an exact raster.
  result.cadence=await page.evaluate(segments=>{
   const scene=PulseLandscape.create({family:'quiet-lake',seed:39293});
   segments.forEach(segment=>PulseLandscape.append(scene,segment));
   const before=JSON.stringify(scene),view=PulseLandscape.createView(document.querySelector('main'),scene);
   if(!Number.isFinite(__pulseLandscapeStats.rasterFrames)||!Number.isFinite(__pulseLandscapeStats.rasterProgress))throw Error('Scenic raster cadence must be observable separately from the measured foreground');
   const observations={frames:0,skippedForegroundAdvances:0,slowSkippedAdvances:0,maxPresentationLagMs:0,maxEndpointError:0,maxCameraStep:0,phases:[]};
   let previous=null;
   const step=dt=>{
    if(!advancePaint(dt))throw Error('Cadence recording exhausted before the lifecycle checks');
    const stats=__pulseLandscapeStats,state=view.captureState,core=document.querySelector('.landscape-live-core');
    const current={painted:state.painted,progress:state.progress,rasterFrames:stats.rasterFrames,frontier:stats.frontier?.t,path:core.getAttribute('d'),camera:{...stats.camera}};
    observations.frames++;
    if(stats.nib&&!stats.settling&&state.progress>0){
     const end=core.getPointAtLength(core.getTotalLength());
     observations.maxEndpointError=Math.max(observations.maxEndpointError,Math.hypot(end.x-stats.nib.x,end.y-stats.nib.y));
     if(stats.rasterPainted!==state.painted)throw Error('The scenic raster belongs to an obsolete stroke');
     const lag=(state.progress-stats.rasterProgress)*(stats.playbackMs-stats.settleDurationMs);
     if(lag< -1e-7)throw Error('Scenic pigment advanced beyond the measured foreground');
     observations.maxPresentationLagMs=Math.max(observations.maxPresentationLagMs,lag);
     if(previous&&previous.painted===state.painted&&state.progress>previous.progress&&stats.rasterFrames===previous.rasterFrames){
      if(current.path===previous.path||!(current.frontier>previous.frontier))throw Error('Measured ink stopped when only scenic paint was skipped');
      observations.skippedForegroundAdvances++;
      if(stats.rasterIntervalMs>=49)observations.slowSkippedAdvances++;
     }
    }
    if(previous)observations.maxCameraStep=Math.max(observations.maxCameraStep,Math.hypot(current.camera.x-previous.camera.x,current.camera.y-previous.camera.y));
    previous=current;
   };
   const phase=(name,frames,dt)=>{
    const before={frames:__pulseLandscapeStats.frames,rasters:__pulseLandscapeStats.rasterFrames,skips:__pulseLandscapeStats.rasterSkipped};
    for(let i=0;i<frames;i++)step(dt);
    const stats=__pulseLandscapeStats,result={name,interval:stats.rasterIntervalMs,foregroundFrames:stats.frames-before.frames,rasterFrames:stats.rasterFrames-before.rasters,skips:stats.rasterSkipped-before.skips};
    observations.phases.push(result);return result;
   };
   const normal=phase('normal',60,1000/60);
   phase('brief interruption',2,1000/30);
   const briefRecovery=phase('brief recovery',20,1000/60);
   const pressure=phase('sustained pressure',36,1000/30);
   const seekStaleFrame=()=>{
    for(let i=0;i<30;i++){
     step(1000/60);const stats=__pulseLandscapeStats,state=view.captureState;
     if(!stats.settling&&state.progress>0&&stats.rasterPainted===state.painted&&state.progress-stats.rasterProgress>1e-7)return {...state};
    }
    throw Error('No deferred scenic frame was available to test the explicit flush');
   };
   const pausedState=seekStaleFrame(),beforePauseRaster=__pulseLandscapeStats.rasterFrames;
   view.pause(true);
   const pause={flushed:__pulseLandscapeStats.rasterFrames>beforePauseRaster,exact:__pulseLandscapeStats.rasterPainted===pausedState.painted&&__pulseLandscapeStats.rasterProgress===pausedState.progress,pending:pendingPaint()};
   const pausedFrames=__pulseLandscapeStats.frames,pausedImage=view.canvas.toDataURL();
   advancePaint(5000);pause.stable=__pulseLandscapeStats.frames===pausedFrames&&view.canvas.toDataURL()===pausedImage;
   view.pause(false);
   const resume=phase('early resume',15,1000/60),recovered=phase('sustained recovery',150,1000/60);
   const hiddenState=seekStaleFrame(),beforeHiddenRaster=__pulseLandscapeStats.rasterFrames;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
   const hidden={flushed:__pulseLandscapeStats.rasterFrames>beforeHiddenRaster,exact:__pulseLandscapeStats.rasterPainted===hiddenState.painted&&__pulseLandscapeStats.rasterProgress===hiddenState.progress,pending:pendingPaint()};
   const hiddenFrames=__pulseLandscapeStats.frames;advancePaint(5000);hidden.stable=__pulseLandscapeStats.frames===hiddenFrames;
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));step(1000/60);
   hidden.recovered=__pulseLandscapeStats.frames>hiddenFrames;
   const output={...observations,normal,briefRecovery,pressure,resume,recovered,pause,hidden,sourceStable:JSON.stringify(scene)===before};
   view.dispose();return output;
  },recording.segments);
  assert.ok(result.cadence.normal.interval>=33&&result.cadence.normal.interval<=34&&result.cadence.normal.skips>0,'normal presentation budgets scenic raster work to 30 Hz');
  assert.equal(result.cadence.briefRecovery.interval,result.cadence.normal.interval,'one brief presentation interruption does not lower scenic cadence');
  assert.ok(result.cadence.pressure.interval>=49&&result.cadence.pressure.interval<=50.1&&result.cadence.slowSkippedAdvances>0,'sustained presentation pressure reduces only scenic raster work to 20 Hz');
  assert.equal(result.cadence.resume.interval,result.cadence.pressure.interval,'resuming does not immediately oscillate the scenic budget');
  assert.equal(result.cadence.recovered.interval,result.cadence.normal.interval,'sustained healthy presentation restores scenic cadence');
  assert.ok(result.cadence.skippedForegroundAdvances>20&&result.cadence.maxEndpointError<.03&&result.cadence.maxPresentationLagMs<=50.01,'real source ink and attached nib advance through skipped scenic frames with at most 50 ms presentation lag');
  assert.deepEqual(result.cadence.pause,{flushed:true,exact:true,pending:0,stable:true},'pause flushes the current exact pigment once and leaves no scheduled work');
  assert.deepEqual(result.cadence.hidden,{flushed:true,exact:true,pending:0,stable:true,recovered:true},'visibility interruption flushes the exact pigment and resumes without hidden catch-up');
  assert.ok(result.cadence.maxCameraStep<250&&result.cadence.sourceStable,'raster budgeting preserves source data and continuous camera damping');
  const families=await page.evaluate(()=>PulseLandscape.FAMILIES);
  for(const family of families){
   const item=await page.evaluate(({family,segments})=>{
    window.view?.dispose();window.scene=PulseLandscape.create({family:family.id,seed:39293});
    segments.slice(0,7).forEach(segment=>PulseLandscape.append(scene,segment));
    const before=JSON.stringify(scene);window.view=PulseLandscape.createView(document.querySelector('main'),scene);
    const target=scene.strokes.length-1,frames=[],cameraSteps={samples:0,maxContinuousStep:0,worst:null};
    let previousCamera=null,previousStroke=0;
    for(let i=0;i<12000;i++){
     const state=view.captureState,camera={...__pulseLandscapeStats.camera};
     if(previousCamera){
      const step=Math.hypot(camera.x-previousCamera.x,camera.y-previousCamera.y);cameraSteps.samples++;
      if(step>cameraSteps.maxContinuousStep){cameraSteps.maxContinuousStep=step;cameraSteps.worst={fromStroke:previousStroke,toStroke:state.painted,from:previousCamera,to:camera};}
     }
     previousCamera=camera;previousStroke=state.painted;
     if(state.painted===target&&state.progress>=.12&&state.progress<=.88){
      const core=document.querySelector('.landscape-live-core'),tip=document.querySelector('.landscape-tip'),ink=document.querySelector('.landscape-ink');
      const end=core.getPointAtLength(core.getTotalLength()),bounds=tip.getBoundingClientRect(),container=document.querySelector('main').getBoundingClientRect();
      const stats=__pulseLandscapeStats,vertices=Array.from(core.getAttribute('d').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g),match=>({x:Number(match[1]),y:Number(match[2])}));
      const original=PulseLandscape.sampleStroke(scene.strokes[target],state.progress).filter(point=>point.t>=stats.projection.start);
      if(vertices.length!==original.length)throw Error('Foreground dropped measured/interpolated source vertices');
      const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
      const fit=(source,rendered)=>{const a=mean(source),b=mean(rendered),variance=source.reduce((sum,value)=>sum+(value-a)**2,0),slope=source.reduce((sum,value,i)=>sum+(value-a)*(rendered[i]-b),0)/variance;return{slope,residual:Math.max(...source.map((value,i)=>Math.abs(rendered[i]-(b+(value-a)*slope))))};};
      const timeFit=fit(original.map(point=>point.t),vertices.map(point=>point.x)),valueFit=fit(original.map(point=>point.v),vertices.map(point=>point.y));
      frames.push({...structuredClone({...stats}),inkVisible:!ink.hasAttribute('hidden'),core:{x:end.x,y:end.y,width:parseFloat(getComputedStyle(core).strokeWidth),length:core.getTotalLength(),timeFit,valueFit},tipBounds:{x:bounds.x-container.x,y:bounds.y-container.y,width:bounds.width,height:bounds.height},viewport:{width:container.width,height:container.height,dpr:devicePixelRatio}});
     }
     if(state.painted===target&&state.progress>=.72)break;
     if(!advancePaint())throw Error('The active paint queue stopped before the sampled source frontier');
    }
    if(frames.length<8)throw Error('No sustained active stroke was observed');
    return{family:family.id,sourceStable:before===JSON.stringify(scene),frames,cameraSteps,sourceEnd:scene.strokes[target].sourceEnd,state:view.captureState};
   },{family,segments:recording.segments});
   assert.equal(item.sourceStable,true);
   const issues=new Set(),check=(condition,message)=>{if(!condition)issues.add(message)};
   check(item.cameraSteps.samples>20&&item.cameraSteps.maxContinuousStep<250,`${family.id}: healthy frames damp camera movement across distant stroke boundaries`);
   for(const frame of item.frames){
    check(frame.inkVisible&&frame.nib,`${family.id}: the ongoing stroke has visible ink and a brush tip`);
    check(frame.nib&&Math.hypot(frame.core.x-frame.nib.x,frame.core.y-frame.nib.y)<.03,`${family.id}: pointed brush contacts the exact end of the drawn pulse`);
    check(frame.core.width>=1.2&&frame.core.width<=2,`${family.id}: crisp core keeps a readable fixed CSS width`);
    check(frame.tipBounds.width<=16&&frame.tipBounds.height<=16,`${family.id}: pointed nib stays below 16 CSS pixels despite terrain zoom`);
    check(frame.nib&&frame.nib.x>=12&&frame.nib.x<=frame.viewport.width-12&&frame.nib.y>=12&&frame.nib.y<=frame.viewport.height-12,`${family.id}: active nib stays inside the mobile painting`);
    check(frame.wetTrail&&frame.wetTrail.end<=frame.frontier.t-.249&&frame.wetTrail.end-frame.wetTrail.start<=1.351,`${family.id}: blooms remain behind the crisp frontier with bounded history`);
    check(frame.wetTrail&&frame.wetTrail.deposits<=2&&frame.wetTrail.pores<=Math.ceil(frame.wetTrail.points/11)&&frame.wetTrail.branches<=Math.ceil(frame.wetTrail.points/10),`${family.id}: connected pigment and paper pores stay bounded as a session grows`);
    check(frame.camera.scale<=2.31&&frame.camera.scale>=1.54,`${family.id}: calmer framing avoids extreme magnification`);
    check(frame.projection.kind==='source-time-value'&&frame.projection.settle===0&&frame.projection.windowSeconds>=2.5&&frame.projection.windowSeconds<=3.5,`${family.id}: ongoing writing uses a short true time/value window`);
    check(frame.core.timeFit.slope>0&&frame.core.timeFit.residual<.011&&frame.core.valueFit.slope<0&&frame.core.valueFit.residual<.011,`${family.id}: every foreground vertex preserves measured timing and relative amplitude without terrain distortion`);
    // One additional 256-square decoded scan textures the small live wash.
    // This is explicit allocation, separate from the unchanged scene caches.
    check(frame.cachedPixels<=2560000&&frame.materialPixels<=4554752&&frame.liveTexturePixels===65536,`${family.id}: scene cache and explicit live texture stay within their budgets`);
    check(frame.washBounds.height<=160&&frame.washBounds.width<=frame.viewport.width&&frame.liveMaskPixelEstimate<=Math.ceil(frame.viewport.width*frame.viewport.dpr)*Math.ceil(160*frame.viewport.dpr),`${family.id}: estimated transient mask surface stays confined to the short wet trail`);
   }
   for(let i=1;i<item.frames.length;i++){
    const a=item.frames[i-1],b=item.frames[i],scale=b.viewport.width/1080*b.camera.scale;
    check(Math.hypot(b.camera.x-a.camera.x,b.camera.y-a.camera.y)*scale<8,`${family.id}: framing does not jump after each measured peak`);
    check(a.projection.baseline===b.projection.baseline&&a.projection.amplitude===b.projection.amplitude,`${family.id}: foreground does not bob or rescale each beat`);
   }
   result.failures.push(...issues);
   result.cases.push(item);
   if(process.env.PPG_BRUSH_SCREENSHOTS==='1')await page.screenshot({path:path.join(out,`${engine}-${family.id}.png`)});
  }
  result.lifecycle=await page.evaluate(segments=>{
   const before=JSON.stringify(scene);view.pause(true);
   const pausedImage=view.canvas.toDataURL(),frames=__pulseLandscapeStats.frames;
   PulseLandscape.append(scene,segments[7]);view.sync();
   for(let i=0;i<20;i++)advancePaint();
   const paused={sameImage:pausedImage===view.canvas.toDataURL(),sameFrames:frames===__pulseLandscapeStats.frames,hidden:document.querySelector('.landscape-ink').hasAttribute('hidden'),pending:pendingPaint(),sourceGrew:JSON.stringify(scene)!==before};
   view.pause(false);for(let i=0;i<5;i++)advancePaint();
   const resumed=__pulseLandscapeStats.frames>frames;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
   const hiddenFrames=__pulseLandscapeStats.frames;for(let i=0;i<20;i++)advancePaint();
   const hidden={sameFrames:hiddenFrames===__pulseLandscapeStats.frames,hidden:document.querySelector('.landscape-ink').hasAttribute('hidden'),pending:pendingPaint()};
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));for(let i=0;i<5;i++)advancePaint();
   return{paused,resumed,hidden,recovered:__pulseLandscapeStats.frames>hiddenFrames,source:JSON.stringify(scene)};
  },recording.segments);
  assert.deepEqual(result.lifecycle.paused,{sameImage:true,sameFrames:true,hidden:true,pending:0,sourceGrew:true},'pause freezes visible pigment and brush while newly accepted source remains stored');
  assert.ok(result.lifecycle.resumed&&result.lifecycle.recovered,'pause and document-visibility interruption both resume painting');
  assert.deepEqual(result.lifecycle.hidden,{sameFrames:true,hidden:true,pending:0},'hidden document removes ink and leaves no scheduled paint work');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>matchMedia('(prefers-reduced-motion: reduce)').matches&&pendingPaint()===0);
  result.reduced=await page.evaluate(async()=>{
   const before=JSON.stringify(scene),frames=__pulseLandscapeStats.frames;
   for(let i=0;i<20;i++)advancePaint();
   const resolved=await view.finish();
   const result={sameScene:resolved===scene,sourceStable:JSON.stringify(scene)===before,framesStable:frames===__pulseLandscapeStats.frames,hidden:document.querySelector('.landscape-ink').hasAttribute('hidden'),pending:pendingPaint(),camera:__pulseLandscapeStats.camera};
   view.dispose();advancePaint();
   result.disposed=document.querySelectorAll('.landscape-ink,.landscape-stage,.landscape-tip').length===0&&pendingPaint()===0&&__pulseLandscapeStats.cachedPixels===4&&__pulseLandscapeStats.liveTexturePixels===0&&__pulseLandscapeStats.liveMaskPixelEstimate===0;
   return result;
  });
  assert.deepEqual(result.reduced,{sameScene:true,sourceStable:true,framesStable:true,hidden:true,pending:0,camera:{x:540,y:540,scale:1},disposed:true},'reduced motion, finish and disposal remove live brush work while retaining the exact scene');
  delete result.lifecycle.source;
  result.empty=await page.evaluate(segment=>{
   const empty=PulseLandscape.create({family:'quiet-lake',seed:3});PulseLandscape.append(empty,{...segment,quality:{good:false}});
   const view=PulseLandscape.createView(document.querySelector('main'),empty);advancePaint();
   const result={strokes:empty.strokes.length,frames:__pulseLandscapeStats.frames,inkHidden:document.querySelector('.landscape-ink').hasAttribute('hidden')};view.dispose();return result;
  },recording.segments[0]);
  assert.deepEqual(result.empty,{strokes:0,frames:0,inkHidden:true},'rejected data never produces a brush or a fabricated pulse');
  await page.emulateMedia({reducedMotion:'no-preference'});
  result.settling=await page.evaluate(segment=>{
   const scene=PulseLandscape.create({family:'quiet-lake',seed:39293});PulseLandscape.append(scene,segment);
   const source=JSON.stringify(scene),view=PulseLandscape.createView(document.querySelector('main'),scene),start=paintClock(),frames=[];
   let writing=null;
   for(let i=0;i<2000;i++){
    advancePaint();const stats=__pulseLandscapeStats;
    if(stats.settling){
     const box=document.querySelector('main').getBoundingClientRect(),scale=Math.min(box.width,box.height)/1080*stats.camera.scale;
     const terrain={x:box.width/2+(stats.frontier.x-stats.camera.x)*scale,y:box.height/2+(stats.frontier.y-stats.camera.y)*scale};
     writing??={...stats.nib};
     const t=stats.projection.settle,expected={x:writing.x*(1-t)+terrain.x*t,y:writing.y*(1-t)+terrain.y*t};
     frames.push({settle:t,progress:stats.progress,frontier:stats.frontier.t,endpointError:Math.hypot(stats.nib.x-expected.x,stats.nib.y-expected.y),duration:stats.settleDurationMs});
    }
    if(view.captureState.painted>0)break;
   }
   const elapsed=paintClock()-start,expectedMs=Math.max(420,(scene.strokes[0].sourceEnd-scene.strokes[0].sourceStart)*1000);
   const result={frames,elapsed,expectedMs,sourceEnd:scene.strokes[0].sourceEnd,sourceStable:JSON.stringify(scene)===source};view.dispose();return result;
  },recording.segments[0]);
  assert.ok(result.settling.frames.length>3&&result.settling.frames.some(frame=>frame.settle>.3&&frame.settle<.8),'completed source visibly settles into its own scenic projection');
  assert.ok(result.settling.frames.every(frame=>frame.progress===1&&frame.frontier===result.settling.sourceEnd&&frame.endpointError<1e-7),'settling transforms the same completed pulse without advancing or inventing samples');
  assert.ok(result.settling.elapsed<=result.settling.expectedMs+40,'settling fits inside source playback time instead of adding delay to every stroke');
  assert.equal(result.settling.sourceStable,true,'settling retains the exact canonical scene for exports');
  // Traverse the full accepted recording quickly through the normal backlog
  // playback. Sampling only the middle of one line misses a hard camera jump
  // when the next real stroke belongs to a distant layer. Every stepped frame
  // remains a healthy 60 Hz frame; this is correctness, not wall-clock timing.
  result.cameraTraversal=await page.evaluate(segments=>{
   const scene=PulseLandscape.create({family:'quiet-lake',seed:39293});segments.forEach(segment=>PulseLandscape.append(scene,segment));
   const before=JSON.stringify(scene),view=PulseLandscape.createView(document.querySelector('main'),scene);
   const result={samples:0,transitions:0,maxContinuousStep:0,worst:null,strokes:scene.strokes.length};
   let previous={...__pulseLandscapeStats.camera},previousStroke=0;
   for(let i=0;i<15000&&view.captureState.painted<scene.strokes.length;i++){
    if(!advancePaint())throw Error('Full-recording camera traversal stopped while accepted strokes remained');
    const current={...__pulseLandscapeStats.camera},stroke=view.captureState.painted,step=Math.hypot(current.x-previous.x,current.y-previous.y);
    result.samples++;if(stroke!==previousStroke)result.transitions++;
    if(step>result.maxContinuousStep){result.maxContinuousStep=step;result.worst={fromStroke:previousStroke,toStroke:stroke,from:previous,to:current};}
    previous=current;previousStroke=stroke;
   }
   result.complete=view.captureState.painted===scene.strokes.length;result.sourceStable=JSON.stringify(scene)===before;view.dispose();return result;
  },recording.segments);
  assert.ok(result.cameraTraversal.complete&&result.cameraTraversal.transitions>30&&result.cameraTraversal.sourceStable,'full-recording traversal crosses distant real stroke layers without altering source');
  assert.ok(result.cameraTraversal.maxContinuousStep<250,'healthy frames damp scene camera movement across the full accepted recording');
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.failures,[],'all scene families preserve readable active ink, a visible pointed brush and calm bounded framing');
  result.passed=true;
 }catch(error){result.failure=String(error.stack||error);process.exitCode=1;}
 finally{writeFileSync(path.join(out,`${engine}.json`),JSON.stringify(result,null,2));await browser?.close();console.log(JSON.stringify({engine,passed:!!result.passed,cases:result.cases.length,provenance:result.provenance?.length,failure:result.failure,out}));}
}
