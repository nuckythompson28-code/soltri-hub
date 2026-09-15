// Interpreter checks use the same programs that the browser loads.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context=vm.createContext({console});
for(const file of ['machine-setups.js','simulator-samples.js','simulator-engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
function run(source){context.source=source;return vm.runInContext('runProgram(source,2000)',context);}
function sample(key){return vm.runInContext(`SAMPLES[${JSON.stringify(key)}]`,context);}
const source=fs.readFileSync(path.join(root,'programs/o0600-unit5.nc'),'utf8').replace(/\r\n/g,'\n');
for(const [name,text,parts] of [
 ['O0600',source,13],['O0500',fs.readFileSync(path.join(root,'programs/o0500-unit5.nc'),'utf8'),13],['O2026',fs.readFileSync(path.join(root,'programs/o2026-o2027-jeil-unit5.nc'),'utf8'),20],
 ['O0400',sample('O0400'),13],['O8000',sample('O8000'),13],['O0852',sample('O0852'),50],
 ...['basic','idod','step'].map(k=>[k,sample(k),0])]){
 const result=run(text);assert.equal(result.info.alarm,null,name);assert.equal(result.info.endReason,'M30',name);assert.equal(result.trace.at(-1).state.parts,parts,name);
 for(const s of result.trace)if(s.seg)for(const k of ['x0','x1','z0','z1','zOff'])assert.ok(Number.isFinite(s.seg[k]),`${name} ${k}`);
 console.log(`${name}: ${parts} parts, finite paths, M30`);
}
for(const text of [source,source.replace('#122=0','#122=1'),source.replace('#118=0','#118=1')]){
 const result=run(text);
 const cuts=result.trace.filter(s=>s.seg&&s.seg.tool===3&&s.seg.type===1&&Math.abs(s.seg.x1+65)<1e-8);
 const faces=result.trace.filter(s=>s.seg&&s.seg.tool===2&&s.seg.type===1);assert.equal(faces.length,13);assert.ok(!result.trace.some(s=>s.pull));
 assert.equal(cuts.length,13);cuts.forEach((s,i)=>{assert.ok(Math.abs(s.seg.z1+s.seg.zOff-224.7+(i+1)*16.9)<1e-8);assert.ok(s.seg.x0<0);assert.ok(s.seg.x1>s.seg.x0);});
 assert.ok(result.trace.some(s=>s.state.toolNo===1&&s.state.brakeUp));
 assert.ok(result.trace.some(s=>s.state.toolNo===1&&!s.state.brakeUp));
 assert.ok(result.trace.some(s=>s.act==='stop'));
 assert.equal(result.trace.find(s=>s.act==='offset').state.zOff,224.7);
}
assert.ok(run(source.split('%')[1]).info.alarm,'Missing subprogram must be visible');
assert.ok(run('O1000\nGOTO 999\nM30').info.alarm,'Missing label must be visible');
assert.equal(run('O1000\n#1=1\nIF [#1 EQ 1] THEN #2=2\nM30').trace.find(s=>s.changed?.n===2).changed.v,2);
const offsets=run('O1000\nG10 L2 P0 Z100\nG00 X80 Z0\nG10 L2 P0 W-20\nG00 X80 Z0\nG01 Z-10\nM30').trace;
assert.equal(offsets.filter(s=>s.act==='offset').at(-1).state.zOff,80);
assert.equal(offsets.find(s=>s.seg).seg.zOff,80);
const invalid=run(source.replace('#120=13','#120=0'));assert.ok(invalid.info.alarm);assert.ok(!invalid.trace.some(s=>s.seg||s.act==='offset'));
console.log('T2 chamfer, T3 parting, skip/retract options, machine 5 directions, UP/DOWN, M00, offsets, IF THEN, missing files/labels and invalid quantity: OK');

const legacy=fs.readFileSync(path.join(root,'programs/archive/o0500-o0400-20260910/o0500-unit5.nc'),'utf8');
assert.equal(run(legacy).trace.at(-1).state.parts,13);
context.source=legacy;assert.equal(vm.runInContext('programVariant(source)',context),'500');
context.source=source;assert.equal(vm.runInContext('machineProfile(source).tools[2][2]',context),'chamfer');
// Pneumatics use executed M words (including variables), independent of tool selection and comments.
const pneumatic=run('O0600\nG00 X-72 Z20 T02\nM55\nG00 Z20 (M56 COMMENT)\n#101=56\nM#101\nG01 Z0 F10\nT03\nM55\nM30').trace;
assert.equal(pneumatic.find(s=>s.act==='motion').state.chamferExtended,false);
assert.equal(pneumatic.find(s=>s.act==='motion'&&s.seg.type===1).state.chamferExtended,true);
assert.equal(pneumatic.find(s=>s.act==='tool').state.chamferExtended,true);
assert.equal(pneumatic.at(-1).state.chamferExtended,false);
assert.equal(run('O0500\nM56\nM30').trace.at(-1).state.chamferExtended,null);
assert.ok(run(source).trace.filter(s=>s.seg?.tool===2&&s.seg.type===1).every(s=>s.state.chamferExtended===true));
console.log('5호기 T2 M56/M55 state, comments, variable M codes and extended cutting: OK');

// Physical carriage invariants: independent expectations use the photographed
// offsets, not the renderer's derived tips or a copy of its coordinate formula.
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const setup=vm.runInContext('SoltriMachineSetups.unit5',context);
assert.deepEqual(JSON.parse(JSON.stringify(setup.geometry)),{
  1:{X:-752.942,Z:-543,radius:0,tip:0,label:'복합 보링바'},
  2:{X:-243.772,Z:-542.340,radius:0,tip:0,label:'공압 면취기'},
  3:{X:-194.772,Z:-546.200,radius:0,tip:0,label:'아래쪽 절단바이트'}
});
assert.equal(setup.t2DatumConfirmed,true);
near(setup.tips[1].r,279.085);near(setup.tips[1].z,-3.2);
near(setup.tips[2].r,24.5);near(setup.tips[2].z,-3.86);
const selection=run('O0600\nG00 X-72 Z10 T02\nT03\nG00 X-79\nG00 Z-16.35\nT01\nT03\nG00 U4 W2 T02\nG10 L2 P0 W-20\nG00 X-74\nM30').trace;
const sels=selection.filter(s=>s.act==='tool');
near(sels[0].state.X,-121);near(sels[0].state.Z,13.86);assert.ok(!sels[0].seg);
const motions=selection.filter(s=>s.seg);
near(motions[0].seg.x0,-121);near(motions[0].seg.x1,-79);
near(motions[0].seg.z0,13.86);near(motions[0].seg.z1,13.86);
near(sels[1].state.X,479.17);near(sels[1].state.Z,-19.55);
near(sels[2].state.X,-79);near(sels[2].state.Z,-16.35);
near(motions[2].seg.x0,-30);near(motions[2].seg.x1,-26);
near(motions[2].seg.z0,-20.21);near(motions[2].seg.z1,-18.21);
const offset=selection.find(s=>s.act==='offset');
near(offset.state.Z+offset.state.zOff,-18.21);
near(motions[3].seg.z0+motions[3].seg.zOff,-18.21);
assert.ok(motions[3].seg,'G10 must not swallow the next actual move');
assert.equal(run('O0600\nG00 X-72 Z10 T02\nT02\nM30').trace.at(-1).state.X,-72,'Repeated T02 must not double-apply geometry');
const reference=run('O0600\nG00 X-72 Z10 T02\nG30 U0 W0\nT03\nG00 X-79\nG00 Z2\nM30').trace;
assert.equal(reference.find(s=>s.act==='tool').state.Z,null,'Reference position is not invented');
assert.equal(reference.find(s=>s.act==='tool').state.X,null);
assert.equal(run('O0500\nG00 X-72 Z10 T02\nT03\nM30').trace.at(-1).state.X,-72,'Archived tooling must not use current geometry');
assert.equal(run('O8000\nG00 X-72 Z10 T02\nT03\nM30').trace.at(-1).state.X,-72,'Other machines must not use unit 5 geometry');
console.log('Photographed tool geometry, stationary T selection, X-only handoff, U/W, G10 continuity and setup isolation: OK');

// The early T02 handoff must preserve every feed path and eliminate the
// second X move at N320 for consecutive parts within a group.
const priorHandoff=source.replace('G00 X-[#508] T02;\nG00 W[#505+20.] M52;','G00 X-[#101+10.];\nG00 W[#505+20.] M52;');
assert.notEqual(priorHandoff,source);
for(const group of [1,2,3]) for(const retract of [0,1]) {
 const config=s=>s.replace('#107=3',`#107=${group}`).replace('#118=0',`#118=${retract}`);
 const before=run(config(priorHandoff)),after=run(config(source));
 assert.equal(after.info.alarm,null);assert.equal(after.trace.at(-1).state.parts,13);
 const feeds=r=>r.trace.filter(s=>s.seg&&s.seg.type!==0).map(s=>s.seg);
 const a=feeds(before),b=feeds(after);assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++) for(const key of Object.keys(a[i])) {
  if(typeof a[i][key]==='number') near(a[i][key],b[i][key]);
  else assert.equal(a[i][key],b[i][key]);
 }
 if(group===3&&retract===0){
  const approaches=after.trace.filter(s=>s.seg?.tool===2&&s.seg.type===0&&s.seg.x1===-72.45&&s.seg.z0===s.seg.z1&&after.programLines[s.lineIdx].section==='N320');
  assert.equal(approaches.length,13);
  assert.equal(approaches.filter(s=>Math.abs(s.seg.x1-s.seg.x0)>1e-8).length,5,'Only five group entries need X travel');
  assert.equal(approaches.filter(s=>Math.abs(s.seg.x1-s.seg.x0)<=1e-8).length,8,'Eight repeated chamfer entries have zero X travel');
 }
}
console.log('Early T02 handoff: feed paths, quantities and group/retract modes preserved');
