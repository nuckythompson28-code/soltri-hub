const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const context=vm.createContext({console});
for(const file of ['machine-setups.js','simulator-samples.js','simulator-engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
function run(source){context.source=source;return vm.runInContext('runProgram(source,4000)',context);}
const read=name=>fs.readFileSync('programs/o2028/'+name+'.txt','utf8');
const provenance=JSON.parse(fs.readFileSync('programs/o2028/provenance.json','utf8'));
for(const [name,hash] of Object.entries(provenance.sources))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('programs/o2028/original/'+name+'.txt')).digest('hex'),hash);
const source=read('drawing-simulation'),original=run(read('original-set')),drawing=run(source),draft=run(read('drawing-draft'));
for(const result of [original,drawing]){assert.equal(result.info.alarm,null);assert.equal(result.info.endReason,'M30');assert.equal(result.trace.at(-1).state.parts,22);assert.equal(Object.keys(result.programs).length,7);}
assert.equal(draft.info.moves,0);assert.ok(draft.info.alarm);assert.ok(!draft.trace.some(s=>s.act==='offset'||s.act==='park'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const grooves=drawing.trace.filter(s=>s.prog==='6003'&&s.seg?.type===1);
assert.equal(grooves.length,44);
for(let i=0;i<22;i++){
 const plunge=grooves[i*2],traverse=grooves[i*2+1];
 near(plunge.seg.x1,238.3);near((242-plunge.seg.x1)/2,1.85);
 near(traverse.seg.z0,-i*11.87-3.685);near(traverse.seg.z1,-i*11.87-6.185);near(Math.abs(traverse.seg.z1-traverse.seg.z0),2.5);
}
const bores=drawing.trace.filter(s=>s.prog==='6001'&&s.seg?.type===1&&s.seg.z0!==s.seg.z1);
assert.equal(bores.length,6);bores.forEach((s,i)=>near(s.seg.z1,i<5?-(i+1)*47.48:-261.14));
const cuts=drawing.trace.filter(s=>s.prog==='6004'&&s.seg?.type===1&&Math.abs(s.seg.x1-225.3)<1e-7);
assert.equal(cuts.length,22);cuts.forEach((s,i)=>near(s.seg.z1,-(i+1)*11.87));
const exits=drawing.trace.filter(s=>s.prog==='6004'&&s.seg?.type===0);
for(const exit of exits.filter(s=>Math.abs(s.seg.z1-s.seg.z0)>1e-7&&Math.abs(s.seg.z1-s.seg.z0-10)<1e-7))near(exit.seg.x1,246);
const one=run(source.replace('#124=0','#124=1'));assert.equal(one.info.alarm,null);assert.equal(one.trace.at(-1).state.parts,22);
for(const replacement of [['#101=242','#101=200'],['#102=230.3','#102=240']]){const bad=run(source.replace(...replacement));assert.ok(bad.info.alarm);assert.equal(bad.info.moves,0);}
assert.equal(run(source.replace('#119=1','#119=0')).trace.at(-1).state.parts,22); // Raw program switch is unused, documented.
console.log('S3: original hashes, seven programs, 22 parts, six boring groups, 22 grooves/cuts, depth/travel, X before Z retract, single mode and setup guards OK; geometry/stock feasibility not certified');
