// Interpreter checks use the same programs that the browser loads.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context=vm.createContext({console});
for(const file of ['simulator-samples.js','simulator-engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
function run(source){context.source=source;return vm.runInContext('runProgram(source,2000)',context);}
function sample(key){return vm.runInContext(`SAMPLES[${JSON.stringify(key)}]`,context);}
const source=fs.readFileSync(path.join(root,'programs/o0600-unit5.nc'),'utf8');
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
 const cuts=result.trace.filter(s=>s.seg&&s.seg.tool===2&&s.seg.type===1&&Math.abs(s.seg.x1+65)<1e-8);
 const faces=result.trace.filter(s=>s.seg&&s.seg.tool===3&&s.seg.type===1);assert.equal(faces.length,13);assert.ok(!result.trace.some(s=>s.pull));
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
console.log('T3 chamfer, T2 parting, skip/retract options, machine 5 directions, UP/DOWN, M00, offsets, IF THEN, missing files/labels and invalid quantity: OK');

const legacy=fs.readFileSync(path.join(root,'programs/archive/o0500-o0400-20260910/o0500-unit5.nc'),'utf8');
assert.equal(run(legacy).trace.at(-1).state.parts,13);
context.source=legacy;assert.equal(vm.runInContext('programVariant(source)',context),'500');
context.source=source;assert.equal(vm.runInContext('machineProfile(source).tools[3][2]',context),'chamfer');
