// Offline publishing step: real app renderer + already-public replay fixture.
// Generated images are examples, never uploaded visitor recordings.
// Run after the renderer freezes: node tools/generate-gallery.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const option=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];};
const output=path.resolve(root,option('--out')||'app/assets/gallery');
const rendererPath=path.resolve(root,option('--renderer')||'app/landscape.js');
const fixturePath=path.join(root,'test/fixtures/iphone-200s.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
const [fixtureBytes,renderer,appSource,vendor,font,portrait,sans]=await Promise.all([
  readFile(fixturePath),readFile(rendererPath,'utf8'),readFile(path.join(root,'app/app.js'),'utf8'),
  readFile(path.join(root,'vendor/ppg-js/0.3.1/ppg.global.js'),'utf8'),readFile(path.join(root,'app/fonts/water-brush-latin.woff2')),
  readFile(path.join(root,'app/portrait.js'),'utf8'),readFile(path.join(root,'app/fonts/dm-sans-latin.woff2')),
]);
const adapter=appSource.slice(appSource.indexOf('function acceptPaintWindow(metrics)'),appSource.indexOf('function paintManuscript(canvas'));
assert.ok(adapter.startsWith('function acceptPaintWindow(metrics)'),'actual app window adapter is available');
const fixture=JSON.parse(fixtureBytes);
const ctx=vm.createContext({console,performance,EventTarget,document:{getElementById:()=>({})},matchMedia:()=>({matches:true}),animateManuscript(){},paintManuscript(){},useManuscriptFallback(){throw new Error('Unexpected landscape fallback');},recoverLandscapeCoverage(){},landscapeCoverageComplete:true,landscapeView:null,manuscript:{lastWindow:-1,pending:[],segments:[]}});ctx.window=ctx;
vm.runInContext(vendor,ctx);vm.runInContext(renderer,ctx);vm.runInContext(adapter,ctx);
const engine=new ctx.PPG.PpgEngine({...fixture.meta?.engineConfig?.engine,hopSec:1,windowSec:5});
ctx.monitor={engine};ctx.landscape=ctx.PulseLandscape.create({seed:39293,family:'meadow'});
const t0=fixture.samples[0].t;
for(const sample of fixture.samples){const t=(sample.t-t0)/1000;if(t>180)break;const result=engine.push({...sample,t});if(result.window)ctx.acceptPaintWindow(result.window);if(result.state==='MEASURING'&&Number.isFinite(result.waveform))ctx.manuscript.pending.push({t,v:result.waveform});}
const segments=JSON.parse(JSON.stringify(ctx.manuscript.segments));assert.ok(segments.length>20,'public fixture supplies the example strokes');
await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.platform==='darwin'?{channel:'chrome'}:{});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1200}});
 await page.setContent('<!doctype html><html><body></body></html>');await page.addScriptTag({content:renderer});await page.addScriptTag({content:portrait});
 await page.evaluate(async encoded=>{const font=new FontFace('Water Brush',`url(data:font/woff2;base64,${encoded})`);await font.load();document.fonts.add(font);},font.toString('base64'));
 await page.evaluate(async encoded=>{const font=new FontFace('DM Sans',`url(data:font/woff2;base64,${encoded})`,{weight:'100 1000'});await font.load();document.fonts.add(font);},sans.toString('base64'));
 const rendered=await page.evaluate(segments=>{
  const scenes=[];
  for(const family of PulseLandscape.FAMILIES){
   const scene=PulseLandscape.create({seed:39293,family:family.id});segments.forEach(segment=>PulseLandscape.append(scene,segment));
   const full=document.createElement('canvas');full.width=full.height=1080;PulseLandscape.render(scene,full);
   const thumb=document.createElement('canvas');thumb.width=thumb.height=640;thumb.getContext('2d').drawImage(full,0,0,640,640);
   const share=document.createElement('canvas');share.width=1080;share.height=1350;
   PulsePortrait.paintCard(share,{art:full,name:family.name,footerLeft:'Example · public recording'});
   scenes.push({id:family.id,name:family.name,seed:scene.seed,usableSeconds:scene.usableSeconds,strokeCount:scene.strokes.length,image:full.toDataURL('image/webp',.91),thumbnail:thumb.toDataURL('image/webp',.86),shareImage:share.toDataURL('image/jpeg',.92)});
  }
  const hero=scenes.find(scene=>scene.id==='quiet-lake');
  return {version:PulseLandscape.VERSION,scenes,hero:hero.id};
 },segments);
 const records=[];
 for(const scene of rendered.scenes){
  const full=Buffer.from(scene.image.split(',')[1],'base64'),thumb=Buffer.from(scene.thumbnail.split(',')[1],'base64');
  const shareBytes=Buffer.from(scene.shareImage.split(',')[1],'base64');
  const image=`${scene.id}.webp`,thumbnail=`${scene.id}-640.webp`,shareImage=`${scene.id}-share.jpg`;
  await writeFile(path.join(output,image),full);await writeFile(path.join(output,thumbnail),thumb);await writeFile(path.join(output,shareImage),shareBytes);
  records.push({...scene,image,thumbnail,shareImage,shareImageType:'image/jpeg',shareWidth:1080,shareHeight:1350,shareBytes:shareBytes.length,shareSha256:hash(shareBytes),width:1080,height:1080,thumbnailWidth:640,thumbnailHeight:640,imageBytes:full.length,thumbnailBytes:thumb.length,imageSha256:hash(full),thumbnailSha256:hash(thumb)});
 }
 const social=await page.evaluate(async data=>{
  const art=new Image();art.src=data;await art.decode();
  const c=document.createElement('canvas');c.width=1200;c.height=630;const x=c.getContext('2d');x.fillStyle='#f5f4eb';x.fillRect(0,0,1200,630);x.drawImage(art,570,0,630,630);
  const g=x.createLinearGradient(460,0,680,0);g.addColorStop(0,'#f5f4eb');g.addColorStop(1,'#f5f4eb00');x.fillStyle=g;x.fillRect(460,0,220,630);
  x.fillStyle='#193f4b';x.font='96px "Water Brush"';x.fillText('Pulse Painting',62,200);x.font='38px sans-serif';x.fillText('Your pulse,',67,285);x.fillText('made into a place.',67,335);x.font='23px sans-serif';x.fillStyle='#4c6a71';x.fillText('Three quiet minutes. Entirely you.',67,410);x.font='20px sans-serif';x.fillText('pulsepainting.com · by ChatPPG',67,556);x.font='14px sans-serif';x.fillText('Example from a public pulse recording',67,585);return c.toDataURL('image/jpeg',.9);
 },rendered.scenes.find(scene=>scene.id===rendered.hero).image);
 const socialBytes=Buffer.from(social.split(',')[1],'base64');await writeFile(path.join(output,'social.jpg'),socialBytes);
 const manifest={schema:1,kind:'public-fixture-examples',rendererVersion:rendered.version,rendererSha256:hash(renderer),cardRendererSha256:hash(portrait),fixture:'test/fixtures/iphone-200s.json',fixtureSha256:hash(fixtureBytes),engineSha256:hash(vendor),adapterSha256:hash(adapter),seed:39293,recordingReplaySeconds:180,acceptedSegments:segments.length,description:'All examples are actual Pulse Painting renders of one already-public recording. They are not a community feed or private visitor recordings.',scenes:records,social:{file:'social.jpg',width:1200,height:630,bytes:socialBytes.length,sha256:hash(socialBytes)}};
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({examples:records.length,rendererSha256:manifest.rendererSha256,usableSeconds:records[0].usableSeconds,imageBytes:records.reduce((n,s)=>n+s.imageBytes+s.thumbnailBytes,0),output:path.relative(root,output)}));
}finally{await browser.close();}
