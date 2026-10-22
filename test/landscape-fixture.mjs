// Replay the public recording through the pinned engine and actual app adapter.
// Camera delivery is simulated; this is not physical-device validation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appSource=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');
const adapter=appSource.slice(appSource.indexOf('function acceptPaintWindow(metrics)'),appSource.indexOf('function paintManuscript(canvas'));
assert.ok(adapter.startsWith('function acceptPaintWindow(metrics)'),'the actual accepted-window adapter is available');
const fixture=JSON.parse(readFileSync(new URL('fixtures/iphone-200s.json',import.meta.url),'utf8'));
const vendor=readFileSync(new URL('../vendor/ppg-js/0.3.1/ppg.global.js',import.meta.url),'utf8');
const landscapeSource=readFileSync(new URL('../app/landscape.js',import.meta.url),'utf8');

export function replayPublicFixture(period=1,gap=0){
  const replayContext=vm.createContext({console,performance,EventTarget,document:{getElementById:()=>({})},matchMedia:()=>({matches:true}),animateManuscript(){},paintManuscript(){},useManuscriptFallback(){throw new Error('Unexpected landscape failure');},recoverLandscapeCoverage(){},landscapeCoverageComplete:true,landscapeView:null,manuscript:{lastWindow:-1,pending:[],segments:[]}});
  replayContext.window=replayContext;
  vm.runInContext(vendor,replayContext);vm.runInContext(landscapeSource,replayContext);vm.runInContext(adapter,replayContext);
  const engine=new replayContext.PPG.PpgEngine({...fixture.meta?.engineConfig?.engine,hopSec:1,windowSec:5});
  replayContext.monitor={engine};replayContext.landscape=replayContext.PulseLandscape.create({seed:1,family:'meadow'});
  const t0=fixture.samples[0].t;let goodWindows=0;
  for(const sample of fixture.samples){
    const t=(sample.t-t0)/1000;if(t>100)break;
    if(t>30&&t%period<gap)continue;
    const result=engine.push({...sample,t});
    if(result.window){if(result.window.quality.good)goodWindows++;replayContext.acceptPaintWindow(result.window);}
    if(result.state==='MEASURING'&&Number.isFinite(result.waveform))replayContext.manuscript.pending.push({t,v:result.waveform});
  }
  const scene=replayContext.landscape,segments=replayContext.manuscript.segments;
  return {scene,segments,goodWindows,acceptedSegments:segments.length,breaks:segments.reduce((n,s)=>n+s.points.filter(p=>p.breakBefore).length,0)};
}
