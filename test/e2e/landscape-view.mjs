// Presentation regression stimuli are synthetic, test-only paths. This checks
// geometry retention and the recording/reconstruction lifecycle, not physiology.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { replayPublicFixture } from '../landscape-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PPG_LANDSCAPE_ARTIFACTS;
const fragmentedRecording=replayPublicFixture(.5,.18);
const browser=await chromium.launch(process.platform==='darwin'?{channel:'chrome'}:{});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<style>body{margin:0}#view{width:100%;height:420px}</style><main id="view"></main>');
 await page.addStyleTag({content:readFileSync(path.join(root,'app/landscape.css'),'utf8')});
 await page.addScriptTag({path:path.join(root,'app/landscape.js')});
 await page.evaluate(()=>{
   window.testSegment=(start,duration)=>({score:.9,channel:'test-only',points:Array.from({length:duration*60+1},(_,i)=>({t:start+i/60,v:.5+.35*Math.sin(i/60*7)}))});
   window.scene=PulseLandscape.create({seed:33,family:'aurora-night'});
   window.view=PulseLandscape.createView(document.getElementById('view'),scene);
   PulseLandscape.append(scene,testSegment(0,5));view.sync();
 });
 await page.waitForFunction(()=>__pulseLandscapeStats.frames>5&&__pulseLandscapeStats.mode==='recording');
 const paused=await page.evaluate(()=>{view.pause(true);return{image:view.canvas.toDataURL(),frames:__pulseLandscapeStats.frames,source:JSON.stringify(scene),count:scene.strokes.length};});
 await page.evaluate(()=>{PulseLandscape.append(scene,testSegment(8,5));view.sync();});
 await page.waitForTimeout(100);
 assert.equal(hash(await page.evaluate(()=>view.canvas.toDataURL())),hash(paused.image),'pause freezes visible pigment while retaining new accepted geometry');
 assert.equal(await page.evaluate(()=>__pulseLandscapeStats.frames),paused.frames,'paused view does not spend animation frames');
 assert.ok(await page.evaluate(()=>scene.strokes.length)>paused.count,'source storage continues while presentation is paused');
 const sourceBefore=await page.evaluate(()=>JSON.stringify(scene));
 for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`landscape viewport fits ${width}px`);
   assert.equal(hash(await page.evaluate(()=>JSON.stringify(scene))),hash(sourceBefore),'resize never reseeds/repositions source geometry');
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{view.pause(false);window.revealSamples=[];window.revealStarted=performance.now();window.revealDone=false;window.finishedScene=null;const sample=()=>{const stats=__pulseLandscapeStats;revealSamples.push({mode:stats.mode,morphProgress:stats.morphProgress,camera:{...stats.camera},points:structuredClone(stats.revealSamples||[])});if(!revealDone)requestAnimationFrame(sample);};requestAnimationFrame(sample);view.finish().then(value=>{finishedScene=value;revealDone=true;});});
 await page.waitForFunction(()=>performance.now()-revealStarted>250&&__pulseLandscapeStats.mode==='pullback');
 for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.evaluate(()=>revealDone),false,'a real responsive resize reprojects the ongoing reveal instead of skipping to the final painting');
 }
 await page.waitForFunction(()=>revealDone,null,{timeout:12000});
 const finished=await page.evaluate(()=>({same:finishedScene===scene,source:JSON.stringify(scene),stats:__pulseLandscapeStats,samples:revealSamples,elapsed:performance.now()-revealStarted}));
 assert.equal(finished.same,true,'zoom-out resolves the exact capture scene object');
 assert.equal(hash(finished.source),hash(sourceBefore),'completion does not substitute or mutate the composition');
 assert.equal(finished.stats.finished,true);assert.equal(finished.stats.painted,finished.stats.strokes);
 assert.deepEqual(finished.stats.camera,{x:540,y:540,scale:1});
 assert.equal(finished.stats.mode,'finished');
 assert.ok(finished.samples.length>60&&finished.samples.some(s=>s.mode==='pullback')&&finished.samples.some(s=>s.mode==='reconstructing'),'finish pulls back to the manuscript before reconstructing its landscape');
 assert.ok(finished.samples.some(s=>s.mode==='reconstructing'&&s.morphProgress>.2&&s.morphProgress<.8&&s.points.length>0),'normal reconstruction includes real intermediate pulse geometry');
 assert.ok(finished.elapsed>=5700&&finished.elapsed<8000,'the two-stage reveal stays within its intended 5.8 seconds plus bounded raster preparation');
 assert.ok(finished.stats.cachedPixels<=finished.stats.pixelBudget,'raster storage stays bounded');
 assert.ok(finished.stats.materialPixels<=finished.stats.materialPixelBudget,'pigment canvases and pattern snapshots stay bounded');
 const raster=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=view.canvas.width;PulseLandscape.render(scene,c);const a=view.canvas.getContext('2d').getImageData(0,0,c.width,c.height).data,b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let different=0,max=0,sum=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);different+=delta>0?1:0;max=Math.max(max,delta);sum+=delta;}return{live:view.canvas.toDataURL(),direct:c.toDataURL(),different,max,mean:sum/a.length};});
 console.log('LANDSCAPE_RASTER_PARITY',JSON.stringify({different:raster.different,max:raster.max,mean:raster.mean}));
 assert.ok(raster.max<=1&&raster.mean<.001,'completed cache matches direct scene render within one-level Canvas2D drawImage rounding');
 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await page.evaluate(async()=>{view.dispose();window.scene=PulseLandscape.create({seed:45,family:'quiet-lake'});PulseLandscape.append(scene,testSegment(0,10));window.view=PulseLandscape.createView(document.getElementById('view'),scene);const started=performance.now();await view.finish();return{duration:performance.now()-started,camera:__pulseLandscapeStats.camera,frames:__pulseLandscapeStats.frames};});
 assert.ok(reduced.duration<500,'reduced motion reveals immediately');assert.deepEqual(reduced.camera,{x:540,y:540,scale:1});assert.equal(reduced.frames,0,'reduced motion does not run a pan/zoom animation');
 const initiallyPaused=await page.evaluate(async()=>{
   view.dispose();window.scene=PulseLandscape.create({seed:91,family:'aurora-night'});window.view=PulseLandscape.createView(document.getElementById('view'),scene);view.pause(true);
   PulseLandscape.append(scene,testSegment(0,10));view.sync();await view.finish();
   const c=document.createElement('canvas');c.width=c.height=view.canvas.width;PulseLandscape.render(scene,c);
   const a=view.canvas.getContext('2d').getImageData(0,0,c.width,c.height).data,b=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let max=0,sum=0;
   for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum+=d;}
   return{max,mean:sum/a.length,painted:__pulseLandscapeStats.painted,strokes:scene.strokes.length};
 });
 assert.ok(initiallyPaused.max<=1&&initiallyPaused.mean<.001,'finish from an initially paused scene includes its complete material and waveform composition');
 assert.equal(initiallyPaused.painted,initiallyPaused.strokes);
 // Replay the real public recording through the actual engine and accepted-window
 // adapter, with test-only dropped delivery. A large number of pen lifts must
 // remain a bounded scene and finish together instead of draining a long queue.
 await page.emulateMedia({reducedMotion:'no-preference'});
 const fragmentedBefore=await page.evaluate(({segments,seed,family})=>{
   view.dispose();window.scene=PulseLandscape.create({seed,family});window.view=PulseLandscape.createView(document.getElementById('view'),scene);view.pause(true);
   for(const segment of segments)PulseLandscape.append(scene,segment);view.sync();
   return{source:JSON.stringify(scene),strokes:scene.strokes.length,slots:scene.slots.length,usableSeconds:scene.usableSeconds,painted:__pulseLandscapeStats.painted};
 },{segments:fragmentedRecording.segments,seed:fragmentedRecording.scene.seed,family:fragmentedRecording.scene.family});
 assert.ok(fragmentedBefore.strokes>100,'fragmented public replay exercises a substantial number of separate recorded runs');
 assert.equal(fragmentedBefore.slots,fragmentedRecording.scene.slots.length,'browser layout follows accepted duration rather than fragment count');
 assert.ok(fragmentedBefore.usableSeconds>35&&fragmentedBefore.usableSeconds<45,'fragmented public replay retains its independently tested coverage');
 assert.equal(fragmentedBefore.painted,0,'paused stress input has not silently drained the paint queue');
 const fragmentedFinish=await page.evaluate(async()=>{const started=performance.now();const resolved=await view.finish();return{same:resolved===scene,source:JSON.stringify(scene),duration:performance.now()-started,stats:{...__pulseLandscapeStats}};});
 assert.equal(fragmentedFinish.same,true);assert.equal(hash(fragmentedFinish.source),hash(fragmentedBefore.source),'fragmented completion preserves every stored source run');
 assert.ok(fragmentedFinish.duration>=5700&&fragmentedFinish.duration<8000,'fragmented finish uses one bounded reveal rather than replaying each pending path');
 assert.equal(fragmentedFinish.stats.finished,true);assert.equal(fragmentedFinish.stats.painted,fragmentedBefore.strokes);
 assert.ok(fragmentedFinish.stats.cachedPixels<=fragmentedFinish.stats.pixelBudget,'fragmentation cannot grow the live raster cache');
 assert.deepEqual(fragmentedFinish.stats.camera,{x:540,y:540,scale:1});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>__pulseLandscapeStats.frames),fragmentedFinish.stats.frames,'a completed fragmented scene leaves no pending animation queue');
 const all=await page.evaluate(()=>PulseLandscape.FAMILIES.map(family=>{const s=PulseLandscape.create({seed:77,family:family.id});PulseLandscape.append(s,testSegment(0,20));const c=document.createElement('canvas');c.width=c.height=400;PulseLandscape.render(s,c);return{family:family.id,png:c.toDataURL(),strokes:s.strokes.length,usableSeconds:s.usableSeconds};}));
 assert.equal(all.length,16);assert.equal(new Set(all.map(s=>s.png)).size,16,'all sixteen families produce distinct actual renderings from the same source');
 // Every material path must finish identically after a partial live reveal,
 // repeated direct rendering and brush-atlas cache reuse across scene families.
 const materialParity=await page.evaluate(async()=>{
   const results=[];
   for(const family of PulseLandscape.FAMILIES){
     view.dispose();window.scene=PulseLandscape.create({seed:189,family:family.id});
     PulseLandscape.append(scene,testSegment(0,25));
     window.view=PulseLandscape.createView(document.getElementById('view'),scene,{reducedMotion:false});
     await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     const partial=__pulseLandscapeStats.painted<scene.strokes.length;
     view.pause(true);PulseLandscape.append(scene,testSegment(30,15));view.sync();
     const source=JSON.stringify(scene),finish=view.finish();view.cancelFinish();await finish;
     const a=document.createElement('canvas'),b=document.createElement('canvas');
     a.width=a.height=b.width=b.height=view.canvas.width;
     PulseLandscape.render(scene,a);PulseLandscape.render(scene,b);
     const live=view.canvas.getContext('2d').getImageData(0,0,a.width,a.height).data;
     const direct=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
     const repeated=b.getContext('2d').getImageData(0,0,a.width,a.height).data;
     let max=0,sum=0,repeatMax=0;
     for(let i=0;i<live.length;i++){const d=Math.abs(live[i]-direct[i]);max=Math.max(max,d);sum+=d;repeatMax=Math.max(repeatMax,Math.abs(direct[i]-repeated[i]));}
     results.push({family:family.id,materialPixels:__pulseLandscapeStats.materialPixels,materialPixelBudget:__pulseLandscapeStats.materialPixelBudget,partial,sourceStable:source===JSON.stringify(scene),max,mean:sum/live.length,repeatMax});
     a.width=a.height=b.width=b.height=1;
   }
   return results;
 });
 for(const result of materialParity){
   assert.ok(result.partial&&result.sourceStable,`${result.family} exercises partial painting without source mutation`);
   assert.ok(result.max<=1&&result.mean<.001,`${result.family} live/direct material parity`);
   assert.equal(result.repeatMax,0,`${result.family} repeat rendering is deterministic`);
   // The live ink wash adds one bounded 256² texture to the existing cache.
   assert.ok(result.materialPixelBudget<=4489216+256**2,`${result.family} bounds pigment memory including the live wash mask`);
   assert.ok(result.materialPixels<=result.materialPixelBudget,`${result.family} bounds pigment surfaces after multiple families and LRU eviction`);
 }
 console.log('LANDSCAPE_ALL_MATERIAL_PARITY',JSON.stringify(materialParity));
 await page.evaluate(()=>view.dispose());
 assert.equal(await page.evaluate(()=>document.querySelectorAll('.landscape-canvas').length),0,'dispose removes the live view');
 assert.ok(await page.evaluate(()=>__pulseLandscapeStats.cachedPixels)<=7,'dispose releases canonical caches, ambient snapshots and their fixed mask');
 assert.deepEqual(errors,[]);
 if(out){mkdirSync(out,{recursive:true});writeFileSync(path.join(out,'view.json'),JSON.stringify({scope:'Synthetic test-only view regression; not a public personal artwork',finished:{...finished,source:undefined,samples:finished.samples.slice(0,10)},reduced,fragmented:{strokes:fragmentedBefore.strokes,slots:fragmentedBefore.slots,usableSeconds:fragmentedBefore.usableSeconds,duration:fragmentedFinish.duration,stats:fragmentedFinish.stats},families:all.map(({png,...rest})=>rest)},null,2));}
 console.log('PASS landscape view: stable geometry, pause/resume, responsive recording, manuscript pullback and reconstruction, direct render parity, reduced motion, bounded fragmented recording, 16 distinct family rasters and disposal');
}finally{await browser.close();}
