const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), context = vm.createContext({ console });
for (const file of ['machine-setups.js', 'simulator-samples.js', 'simulator-engine.js', 'simulator-stock-3d.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const stock = { totalLength: 520, rawO: 70, rawI: 56, finO: 64.9, finI: 58.3, tip: 2 };
const role = tool => tool === 1 ? 'compound' : tool === 2 ? 'part' : 'pull';
const near = (a, b, label = '') => assert.ok(Number.isFinite(a) && Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
const move = (tool, x0, x1, z0, z1, extra = {}) => ({ seg: { tool, type: 1, x0, x1, z0, z1, zOff: 0 }, state: { brakeUp: true, parts: 0 }, ...extra });
const plotPts = s => [[s.z0 + (s.zOff || 0), s.x0 / 2], [s.z1 + (s.zOff || 0), s.x1 / 2]];
const create = (trace, overrides = {}) => context.SoltriStock3D.create({ trace, stock: { ...stock, ...overrides }, plotPts, role });
const initial = create([]).at(-1);
near(initial.z0, -520); near(initial.freeEnd, 0); near(initial.remainingLength, 520); near(initial.totalPull, 0);
assert.equal(initial.outer.length, initial.nz + 1); assert.equal(initial.inner.length, initial.nz + 1);
near(initial.z0 + initial.nz * initial.dz, 0, 'Full input length reaches the original front');

// No fake internal boring in the air. Rapid traversal also never removes stock.
const air = create([move(1, 100, 100, -10, -20), move(1, 64.9, 64.9, -20, -40, { seg: { tool: 1, type: 0, x0: 64.9, x1: 64.9, z0: -20, z1: -40, zOff: 0 } })]).at(1);
assert.ok(Array.from(air.outer).every(r => r === 35));
assert.ok(Array.from(air.inner).every(r => r === 28));
const boring = create([move(1, 64.9, 64.9, -10, -20)]).at(0);
const j = Math.round((-15 - boring.z0) / boring.dz);
near(boring.outer[j], 32.45); near(boring.inner[j], 29.15, 'Lower actual tip follows upper minus gap');

// Target ID and M12 do not prove a severed cross-section.
const incomplete = create([move(2, 72, 60, -10, -10), { state: { parts: 1 } }], { finI: 64 }).at(1);
assert.equal(incomplete.parts.length, 0);
near(incomplete.freeEnd, 0); near(incomplete.remainingLength, 520);

// A current-bore crossing is reached at 80% of this radial stroke.
const cut = move(2, 72, 52, -10, -10);
const crossing = create([cut, { state: { parts: 1 } }]);
assert.equal(crossing.at(0, .799).parts.length, 0);
const detached = crossing.at(0, .8);
assert.equal(detached.parts.length, 1);
const first = detached.parts[0];
near(first.fraction, .8); assert.equal(first.index, 0); assert.equal(first.kind, 'product'); assert.equal(first.number, 1);
near(first.zStart, -8); near(first.zEnd, 0); near(first.zEnd - first.zStart, 8, 'Blade kerf is excluded');
near(detached.freeEnd, -10); near(detached.remainingLength, 510);
assert.equal(first.zs.length, first.outer.length); assert.equal(first.zs.length, first.inner.length);
near(first.zs[0], first.zStart); near(first.zs.at(-1), first.zEnd);
near(first.outer[0], 35); near(first.outer.at(-1), 35, 'The detached ring retains solid end faces');
assert.equal(crossing.at(0, 1).parts.length, 1, 'Overtravel through the bore does not detach twice');

// No imaginary products outside the bar, on its zero-length face, or on retract.
for (const z of [-530, 1, 0, -1]) {
  assert.equal(create([move(2, 72, 52, z, z)]).at(0).parts.length, 0, `No part at invalid cut plane ${z}`);
}
assert.equal(create([move(2, 52, 72, -10, -10)]).at(0).parts.length, 0, 'Outward retract is not a new part');
const consumed = create([move(2, 72, 52, -520, -520)]).at(0);
near(consumed.remainingLength, 0); near(consumed.freeEnd, consumed.z0);
assert.equal(consumed.parts.length, 1); near(consumed.parts[0].zEnd - consumed.parts[0].zStart, 518);

// Pull persists into all later commands. Already detached parts stay fixed.
const trace = [cut, { state: { parts: 1 } }, { pull: 20, state: { parts: 1 } },
  { act: 'mcode', state: { parts: 1 } }, move(2, 72, 52, 0, 0, { state: { parts: 1 } }),
  { state: { parts: 2 } }, { act: 'offset', state: { parts: 2, zOff: 100 } }];
const pulled = create(trace);
const half = pulled.at(2, .5); near(half.totalPull, 10); near(half.z0, -510); near(half.freeEnd, 0); near(half.remainingLength, 510);
const full = pulled.at(2, 1), after = pulled.at(3);
near(full.totalPull, 20); near(after.totalPull, 20); near(full.z0, -500); near(after.z0, -500); near(after.freeEnd, 10);
near(after.parts[0].zStart, -8); near(after.parts[0].zEnd, 0, 'Detached piece does not ride along with bar');
const twice = pulled.at(5);
assert.equal(twice.parts.length, 2); near(twice.parts[1].zStart, 2); near(twice.parts[1].zEnd, 10);
near(twice.remainingLength, 500); near(twice.freeEnd, 0);
const rebase = pulled.at(6); near(rebase.z0, twice.z0); near(rebase.freeEnd, twice.freeEnd);
assert.deepEqual(JSON.stringify(rebase.parts), JSON.stringify(twice.parts), 'G10 without physical movement cannot alter detached pieces');

// Seeking backwards and replaying gives identical geometry and detach identity.
const encode = f => JSON.stringify({ z0: f.z0, freeEnd: f.freeEnd, pull: f.totalPull, remaining: f.remainingLength, parts: f.parts, outer: Array.from(f.outer), inner: Array.from(f.inner) });
const expected = encode(pulled.at(5));
pulled.at(0, .2); pulled.at(-1); pulled.at(2, .6);
assert.equal(encode(pulled.at(5)), expected);
assert.equal(encode(create(trace).at(5)), expected, 'Cold seek equals sequential/repeated seek');

// Full O0852 includes multiple pulls, facing scraps and O9003 origin rebasing.
function originalCycle(totalLength) {
  context.text = vm.runInContext('SAMPLES.O0852_UNIT7', context).replace('#101=43', `#101=${totalLength - 500}`);
  const execution = vm.runInContext('runProgram(text, 2000)', context);
  assert.equal(execution.info.endReason, 'M30'); assert.equal(execution.info.alarm, null);
  const origin = execution.trace.find(s => s.act === 'offset').state.zOff;
  const api = context.SoltriStock3D.create({ trace: execution.trace, stock: { ...stock, totalLength, tip: 2.02 }, role,
    plotPts: s => [[s.z0 + s.zOff - origin, s.x0 / 2], [s.z1 + s.zOff - origin, s.x1 / 2]] });
  const start = performance.now(), final = api.at(execution.trace.length - 1), elapsed = performance.now() - start;
  const products = final.parts.filter(p => p.kind === 'product');
  assert.equal(products.length, execution.trace.at(-1).state.parts);
  assert.equal(products.length, totalLength === 520 ? 48 : 50);
  for (const part of products) near(part.zEnd - part.zStart, 7.823, 'Cut product width');
  const pullSum = execution.trace.reduce((n, s) => n + (s.pull || 0), 0);
  near(final.totalPull, pullSum); near(final.z0, -totalLength + pullSum);
  near(final.remainingLength, final.freeEnd - final.z0);
  assert.ok(final.remainingLength > 0 && final.remainingLength < totalLength);
  near(final.remainingLength + final.parts.reduce((sum, p) => sum + p.zEnd - p.zStart + 2.02, 0), totalLength,
    'Remaining stock + detached pieces + kerfs conserve initial total length');
  for (let k = 0; k <= final.nz; k++) {
    assert.ok(Number.isFinite(final.outer[k]) && Number.isFinite(final.inner[k]));
    assert.ok(final.outer[k] >= final.inner[k] - 1e-8 && final.inner[k] >= 0);
  }
  const firstPullIndex = execution.trace.findIndex(s => s.pull);
  const beforePull = api.at(firstPullIndex, 0), halfPull = api.at(firstPullIndex, .5), endPull = api.at(firstPullIndex, 1), next = api.at(firstPullIndex + 1);
  near(halfPull.z0 - beforePull.z0, execution.trace[firstPullIndex].pull / 2);
  near(endPull.z0, next.z0); near(endPull.freeEnd, next.freeEnd);
  const backSeek = api.at(products[0].index, products[0].fraction / 2);
  assert.equal(backSeek.parts.filter(p => p.kind === 'product').length, 0);
  assert.equal(encode(api.at(execution.trace.length - 1)), encode(final));
  console.log(`O0852 ${totalLength}mm: ${products.length} products, ${final.parts.length - products.length} scraps, ${final.remainingLength.toFixed(3)}mm remaining, initial replay ${elapsed.toFixed(1)}ms`);
}
originalCycle(520); originalCycle(543);
console.log('Full stock length, actual-bore parting, partial detach, kerf width, air-cut rejection, cumulative pull, fixed detached parts and deterministic seek: OK');
