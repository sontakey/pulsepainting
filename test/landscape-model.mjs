// Synthetic edge cases are test-only. Scenic previews use the public recording.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { replayPublicFixture } from './landscape-fixture.mjs';
const context = vm.createContext({ console });
const rendererSource = readFileSync(new URL('../app/landscape.js', import.meta.url), 'utf8');
vm.runInContext(rendererSource, context);
const L = context.PulseLandscape;
const plain = value => JSON.parse(JSON.stringify(value));
const segment = (start, duration, hz = 60, convert = x => x) => ({ score: .8, channel: 'green', quality: { good: true }, points: Array.from({ length: Math.round(duration * hz) + 1 }, (_, i) => ({ t: start + i / hz, v: convert(Math.sin(i / hz * Math.PI * 2) + .3 * Math.sin(i / hz * Math.PI * 4)) })) });
const merge = intervals => {
  const out = [];
  for (const [start,end] of intervals.sort((a,b) => a[0]-b[0])) {
    if (out.length && start <= out.at(-1)[1] + 1e-7) out.at(-1)[1] = Math.max(end,out.at(-1)[1]);
    else out.push([start,end]);
  }
  return out;
};
function verifyCoverage(scene, input) {
  const actual = merge(scene.strokes.flatMap(s => s.points.slice(1).map((p,i) => [s.points[i].t,p.t])));
  const expected = merge(input.flatMap(s => s.points.slice(1).flatMap((p,i) => !p.breakBefore && Number.isFinite(p.t) && Number.isFinite(p.v) && Number.isFinite(s.points[i].t) && Number.isFinite(s.points[i].v) && p.t>s.points[i].t && p.t-s.points[i].t <= .1500001 ? [[s.points[i].t,p.t]] : [])));
  assert.deepEqual(plain(actual), expected, 'every accepted edge is represented, with no bridging gaps or omitted tail');
  assert.deepEqual(plain(scene.sourceIntervals.map(s => [s.start,s.end]).filter(([a,b])=>b>a)), expected, 'private provenance equals independent interval union');
  const duration=expected.reduce((n,[a,b])=>n+b-a,0);
  assert.ok(Math.abs(scene.usableSeconds-duration)<1e-7, 'usable time is union duration');
  const drawnDuration=scene.strokes.reduce((sum,stroke)=>sum+stroke.points.slice(1).reduce((n,p,i)=>n+p.t-stroke.points[i].t,0),0);
  assert.ok(Math.abs(drawnDuration-duration)<1e-7,'each accepted time edge appears once; shared chunk endpoints never duplicate coverage');
  for (const stroke of scene.strokes) {
    assert.ok(stroke.points.every((p,i,all)=>i===0 || p.t>all[i-1].t && p.t-all[i-1].t<=.1500001), 'each stroke is a contiguous recorded path');
    assert.ok(['a','b','c','d','e','f'].every(key=>Number.isFinite(stroke.transform[key])), 'placement coefficients remain finite');
    assert.ok(stroke.transform.curve&&['start','offset','min','max'].every(key=>Number.isFinite(stroke.transform.domain[key])), 'curved placement retains a finite source domain');
    const sampled=L.sampleStroke(stroke),knots=new Map(sampled.map(p=>[p.t,p.v]));
    assert.ok(sampled.length>=stroke.points.length&&sampled.length<=stroke.points.length*8,'organic interpolation has bounded source-relative complexity');
    let edge=0;
    for(const [i,p] of sampled.entries()){
      assert.ok(['x','y','t','v'].every(key=>Number.isFinite(p[key])),'all interpolated coordinates remain finite, including extreme finite source values');
      assert.ok(p.x>=0&&p.x<=1080&&p.y>=0&&p.y<=1080,'interpolated paths stay inside the artwork');
      assert.ok(i===0||p.t>sampled[i-1].t,'organic interpolation preserves forward source time');
      while(edge+1<stroke.points.length-1&&p.t>stroke.points[edge+1].t)edge++;
      const a=stroke.points[edge],b=stroke.points[Math.min(edge+1,stroke.points.length-1)];
      assert.ok(p.v>=Math.min(a.v,b.v)&&p.v<=Math.max(a.v,b.v),'organic interpolation cannot invent an amplitude beyond the adjacent measured knots');
    }
    assert.equal(JSON.stringify(L.sampleStroke(stroke)),JSON.stringify(sampled),'sampling the same saved stroke is deterministic');
    for(const p of stroke.points)assert.equal(knots.get(p.t),p.v,'organic interpolation includes each original source knot unchanged');
    for (const p of stroke.points) {
      const q=L.worldPoint(p,stroke.transform);
      assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.x>=0&&q.x<=1080&&q.y>=0&&q.y<=1080, 'entire source fits the canvas without peak clipping');
      assert.ok(input.some(s=>s.points.some(source=>source.t===p.t&&source.v===p.v)), 'every scenic centerline sample is an unchanged accepted sample');
    }
  }
}
function verifyAllocation(scene) {
  assert.equal(scene.slots.length,Math.ceil((scene.usableSeconds-1e-8)/5),'scene placement count follows usable time, not the number of pen lifts');
  assert.ok(Math.abs(scene.paintSeconds-scene.usableSeconds)<1e-7,'allocation clock counts each drawable interval once');
  let elapsed=0;
  for(const stroke of scene.strokes){
    const slot=scene.slots[stroke.slot],duration=stroke.sourceEnd-stroke.sourceStart;
    assert.equal(stroke.slot,Math.floor((elapsed+1e-8)/5),'a source fragment occupies its cumulative usable-time slot');
    assert.ok(Math.abs(stroke.slotStart+stroke.slot*5-elapsed)<1e-7,'a pen lift does not advance the allocation clock');
    assert.ok(Math.abs(stroke.slotEnd-stroke.slotStart-duration)<1e-7,'fragment width is proportional to its accepted duration');
    assert.ok(stroke.slotStart>=0&&stroke.slotEnd<=5.1500002,'only one complete measured edge can cross a slot boundary');
    assert.deepEqual(plain(stroke.material),plain(slot.material),'all fragments in a slot retain the same seeded material cadence');
    elapsed+=duration;
  }
}
assert.equal(L.FAMILIES.length,16); assert.equal(new Set(L.FAMILIES.map(f=>f.id)).size,16);
for (const family of L.FAMILIES) {
  const scene=L.create({seed:'fixture-seed',family:family.id});
  assert.equal(scene.strokes.length,0); assert.equal(scene.usableSeconds,0);
  const first=segment(0,5), second=segment(8,175);
  L.append(scene,first); const frozen=JSON.stringify(scene.strokes), firstCount=scene.strokes.length;
  L.append(scene,second);
  assert.equal(JSON.stringify(scene.strokes.slice(0,firstCount)),frozen, `${family.id}: growth never repositions or recolors prior strokes`);
  verifyCoverage(scene,[first,second]);
  verifyAllocation(scene);
  const count=scene.strokes.length, duration=scene.usableSeconds;
  L.append(scene,first); L.append(scene,second);
  assert.equal(scene.strokes.length,count,'duplicate input adds no geometry');assert.equal(scene.usableSeconds,duration);
  const replay=plain(scene); L.append(replay,second);assert.equal(replay.strokes.length,count,'serialized private descriptors retain duplicate protection');
  const clone=L.create({seed:'fixture-seed',family:family.id}); L.append(clone,first); L.append(clone,second);
  assert.equal(JSON.stringify(clone),JSON.stringify(scene),'same saved seed and source produce exactly the same scene');
}
const sampleRateCounts=[];
for(const hz of [24,30,60,120]) {
  const scene=L.create({seed:'sample-rate',family:'meadow'}), input=segment(0,30,hz);L.append(scene,input);
  verifyCoverage(scene,[input]);assert.equal(scene.usableSeconds,30,'duration does not increase with camera sample rate');
  sampleRateCounts.push(scene.strokes.length);
}
assert.ok(Math.max(...sampleRateCounts)-Math.min(...sampleRateCounts)<=1,'layer density is stable across sample rates at equal accepted duration');
for(const convert of [()=>.5,x=>x*1e-12,x=>x*1e12+1e14,x=>x===0?1e300:x]) {
  const scene=L.create({seed:'extremes'}),input=segment(0,3,60,convert);L.append(scene,input);verifyCoverage(scene,[input]);
}
// The final two samples cross a five-second scenery slot but span only 2% of
// the original accepted window's amplitude. A short continuation must not be
// enlarged into a full-amplitude mountain merely because its slot changed.
const crossing=L.create({seed:'shared-window-domain',family:'alpine-peaks'});
const crossingInput={score:.9,points:Array.from({length:252},(_,i)=>({t:i/50,v:i===0?0:i===1?1:i===251?.42:.4}))};
L.append(crossing,crossingInput);verifyCoverage(crossing,[crossingInput]);verifyAllocation(crossing);
const tiny=crossing.strokes.at(-1);
assert.equal(tiny.points.length,2,'cross-slot regression exercises the small final continuation');
assert.deepEqual(plain(tiny.transform.domain),{start:5,offset:0,min:0,max:1},'short continuation keeps the accepted window amplitude range');
const amplitudeFraction=(tiny.points[1].v-tiny.points[0].v)/(tiny.transform.domain.max-tiny.transform.domain.min);
assert.ok(Math.abs(amplitudeFraction-.02)<1e-12,'a 2% measured change stays 2% when the artistic terrain slot changes');
const partial=L.sampleStroke(tiny,.5),complete=L.sampleStroke(tiny);
assert.ok(partial.length<complete.length&&partial.every(p=>p.t<=tiny.sourceStart+(tiny.sourceEnd-tiny.sourceStart)*.5),'partial painting reveals only the already reached source time');
const rejected=L.create({seed:'rejected'});
for(const input of [null,{points:[]},{...segment(0,5),quality:{good:false}},{...segment(0,5),accepted:false}])L.append(rejected,input);
assert.equal(rejected.strokes.length,0);assert.equal(rejected.usableSeconds,0);
const gapped=L.create({seed:'gaps'}), ranges=[segment(0,2),segment(4,2),segment(6,2)];
L.append(gapped,{...ranges[0],points:ranges.flatMap(s=>s.points)});verifyCoverage(gapped,ranges);
const overlap=L.create({seed:'overlap'}), rangeA=segment(0,5),rangeB=segment(3,5);
L.append(overlap,rangeA);L.append(overlap,rangeB);verifyCoverage(overlap,[rangeA,rangeB]);assert.equal(overlap.usableSeconds,8);
// Saved identity must reconstruct without hashing a previously saved seed again.
const saved=L.create({seed:'saved-session'}), rebuilt=L.create({seed:saved.seed,family:saved.family});
L.append(saved,segment(0,7));L.append(rebuilt,segment(0,7));
assert.equal(JSON.stringify(rebuilt),JSON.stringify(saved),'saved seed/family reconstruct identical plan, pigment and source transforms');
const singleton=L.create({seed:'single'});L.append(singleton,{points:[{t:0,v:.5}]});
assert.equal(singleton.strokes.length,0,'isolated samples without a continuous edge cannot fabricate a personal scene');
const barrier=L.create({seed:'invalid'});
L.append(barrier,{points:[{t:0,v:0},{t:.04,v:1},{t:.08,v:NaN},{t:.12,v:0},{t:.16,v:1}]});
assert.deepEqual(plain(barrier.sourceIntervals),[{start:0,end:.04},{start:.12,end:.16}],'nonfinite samples split the source path even when neighboring valid points are close');
const explicitBreak=L.create({seed:'source-barrier'});
L.append(explicitBreak,{points:[{t:0,v:0},{t:.04,v:1},{t:.08,v:0,breakBefore:true},{t:.12,v:1}]});
assert.deepEqual(plain(explicitBreak.sourceIntervals),[{start:0,end:.04},{start:.08,end:.12}],'explicit adapter barriers retain the valid adjacent runs without drawing a missing edge');
const mutable=segment(0,2), retained=L.create({seed:'owned-data'});L.append(retained,mutable);const snapshot=JSON.stringify(retained);mutable.points[0].t=999;mutable.points[0].v=999;mutable.points.push({t:1000,v:4});assert.equal(JSON.stringify(retained),snapshot,'appending copies source points so later caller mutations cannot rewrite captured geometry');
const seedA=L.create({seed:'one'}),seedB=L.create({seed:'two'});
assert.notEqual(seedA.seed,seedB.seed,'session seeds vary without consulting physiological metrics');

// The same accepted duration must not buy extra full-size scenery when camera
// delivery splits it into many short paths. Frames/materials are slot-owned.
const continuous=L.create({seed:'fragmentation',family:'meadow'}),fragmented=L.create({seed:'fragmentation',family:'meadow'});
const continuousInput=segment(0,2);L.append(continuous,continuousInput);
const fragments=Array.from({length:20},(_,i)=>segment(i*.3,.1));
for(const fragment of fragments){
  const frozen=JSON.stringify(fragmented.strokes);
  L.append(fragmented,fragment);
  assert.equal(JSON.stringify(fragmented.strokes.slice(0,JSON.parse(frozen).length)),frozen,'extending a partly filled slot never changes its earlier source geometry');
}
verifyCoverage(fragmented,fragments);verifyAllocation(continuous);verifyAllocation(fragmented);
assert.equal(fragmented.slots.length,1);assert.equal(fragmented.strokes.length,20,'pen lifts remain separate measured paths');
assert.deepEqual(plain(fragmented.slots),plain(continuous.slots),'fragment count cannot change scene placement, hero cadence or pigment choices');
const serialized=plain(fragmented),continuation=segment(10,8);
L.append(fragmented,continuation);L.append(serialized,continuation);
assert.equal(JSON.stringify(serialized),JSON.stringify(fragmented),'serialized slot allocation resumes deterministically');
verifyCoverage(fragmented,[...fragments,continuation]);verifyAllocation(fragmented);

// Replay the actual app adapter against the pinned engine and public recording.
// Dropped camera frames can leave quality-good windows but introduce pen lifts;
// they must reduce painted coverage instead of generating extra scene slots.
const baseline=replayPublicFixture(1,0),dropped=replayPublicFixture(1,.18),fragmentedDelivery=replayPublicFixture(.5,.18);
for(const {scene,segments} of [baseline,dropped,fragmentedDelivery]){
  verifyCoverage(scene,segments);verifyAllocation(scene);
}
assert.ok(baseline.goodWindows>0&&baseline.scene.usableSeconds>60,'public fixture produces accepted data');
for(const candidate of [dropped,fragmentedDelivery]){
  assert.ok(candidate.breaks>0&&candidate.goodWindows>0,'dropped-frame replay exercises accepted windows with real adapter pen lifts');
  assert.equal(candidate.acceptedSegments,baseline.acceptedSegments,'comparison retains the same number of accepted analysis windows');
  assert.ok(candidate.scene.usableSeconds<baseline.scene.usableSeconds,'missing delivery reduces usable accepted time');
  assert.ok(candidate.scene.slots.length<baseline.scene.slots.length,'fragmentation cannot add scene placements');
  assert.deepEqual(plain(candidate.scene.slots),plain(baseline.scene.slots.slice(0,candidate.scene.slots.length)),'source fragmentation leaves the seeded plan/material sequence unchanged');
}

// Observe the production brush helper without adding a public runtime export.
// Canvas commands are recorded, not rasterized: this checks source ownership
// and mirrored pressure independently of native Canvas2D pixel rounding.
class RecordedBrushPath {
  constructor(){this.commands=[];}
  moveTo(...args){this.commands.push(['moveTo',...args]);}
  quadraticCurveTo(...args){this.commands.push(['quadraticCurveTo',...args]);}
  closePath(){this.commands.push(['closePath']);}
  addPath(path){this.commands.push(...path.commands);}
}
const brushMarker='global.PulseLandscape=Object.freeze({';
assert.equal(rendererSource.split(brushMarker).length,2,'the production brush helpers are observed at one module boundary');
const brushContext=vm.createContext({Path2D:RecordedBrushPath});
vm.runInContext(rendererSource.replace(brushMarker,'global.__brushTest={strokePaint,pulseImpressions};'+brushMarker),brushContext);
const brushEvidence=[];
for(const family of ['coastal-cliffs','quiet-lake']){
  const scene=brushContext.PulseLandscape.create({seed:39293,family});
  baseline.segments.forEach(input=>brushContext.PulseLandscape.append(scene,input));
  const frozen=JSON.stringify(scene),strokes=scene.strokes.filter(s=>s.role==='water'&&!s.material.underpaint);
  assert.ok(strokes.length>0,`${family}: the actual public-fixture adapter reaches water impressions`);
  let knots=0,longStrokes=0;
  for(const stroke of strokes){
    const paint=brushContext.__brushTest.strokePaint(stroke);
    const marks=brushContext.__brushTest.pulseImpressions(stroke,paint).flatMap(chunk=>chunk.items);
    assert.deepEqual(plain(marks.map(({t,v})=>({t,v}))),plain(stroke.points),`${family}: each measured knot owns exactly one impression with its original time and value`);
    assert.ok(marks.every(mark=>mark.paths.every(path=>path.commands.every(command=>command.slice(1).every(Number.isFinite)))),`${family}: all emitted brush coordinates are finite`);
    const travel=marks.at(-1).x-marks[0].x;
    assert.ok(family==='coastal-cliffs'?travel<0:travel>0,`${family}: the public-fixture regression exercises the expected travel direction`);
    if(Math.abs(travel)>100){
      longStrokes++;
      assert.ok(marks.some(mark=>mark.pressure>.35),`${family}: interior brush pressure must exceed the endpoint-only maximum`);
    }
    knots+=marks.length;
  }
  assert.ok(longStrokes>0,`${family}: the regression includes a full-width pressure interior`);
  assert.equal(JSON.stringify(scene),frozen,`${family}: brush generation preserves the complete source, domain, quality and accepted-time model`);
  brushEvidence.push({family,strokes:strokes.length,knots,longStrokes});
}
console.log('LANDSCAPE_BRUSH_DIRECTION',JSON.stringify(brushEvidence));
console.log('LANDSCAPE_FRAGMENTATION',JSON.stringify([baseline,dropped,fragmentedDelivery].map(({scene,segments,...stats})=>({...stats,sourceFragments:scene.strokes.length,slots:scene.slots.length,usableSeconds:scene.usableSeconds,allocatedSeconds:scene.paintSeconds}))));
console.log('PASS landscape model: 16 families, source provenance, usable-time slot allocation, public-recording adapter fragmentation, repeatability, immutable history, source-preserving organic curves, shared-window amplitudes, duplicates, overlaps, gaps, rejection and extreme amplitudes');
