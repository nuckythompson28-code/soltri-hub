// Tool selection must change displayed tool coordinates, not move the carriage.
// Expectations below use the user's geometry values independently of setup.tips.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
for (const file of ['machine-setups.js', 'simulator-samples.js', 'simulator-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const evaluate = expression => vm.runInContext(expression, context);
function run(source) {
  context.source = source;
  const result = evaluate('runProgram(source, 2000)');
  assert.equal(result.info.alarm, null, result.info.alarm || 'No interpreter alarm');
  assert.equal(result.info.endReason, 'M30');
  return result;
}
const near = (actual, expected, label = '') => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8,
  `${label}: ${actual} != ${expected}`
);
const unit7 = evaluate('SoltriMachineSetups.unit7');
assert.ok(unit7, 'Machine 7 has its own geometry setup');
assert.equal(unit7.xMode, 'diameter');
assert.equal(unit7.xModeConfirmed, true);
assert.equal(unit7.offsetMode, 'coordinate-shift');
for (const [tool, X, Z] of [[1, -518, -488.020], [2, -586.700, -436], [3, -867.500, -452]]) {
  near(unit7.geometry[tool].X, X, `T${tool} geometry X`);
  near(unit7.geometry[tool].Z, Z, `T${tool} geometry Z`);
}

// Radius and axial positions relative to T1, from the supplied values.
const physical = { 1: { r: 0, z: 0 }, 2: { r: 34.350, z: -52.020 }, 3: { r: 174.750, z: -36.020 } };
function carriage(state) {
  const tip = physical[state.toolNo];
  assert.ok(tip, `Known tool ${state.toolNo}`);
  assert.notEqual(state.X, null);
  assert.notEqual(state.Z, null);
  return { r: state.X / 2 - tip.r, z: state.Z + state.zOff - tip.z };
}
function sameCarriage(a, b, label) {
  const from = carriage(a), to = carriage(b);
  near(from.r, to.r, `${label} radial position`);
  near(from.z, to.z, `${label} physical Z including work offset`);
}
const fixture = [
  'O0852', '#130=7',
  'G00 X80 Z10 T01', 'T02', 'T03', 'T01',
  'G00 U4 W2 T02', 'G10 L2 P0 W-20', 'G00 X150',
  'T02', 'T01', 'G00 X90 T02', 'M30'
].join('\n');
const result = run(fixture), trace = result.trace;
const selections = trace.filter(s => s.act === 'tool');
const expectations = [[148.7, -42.02], [429.5, -26.02], [80, 10]];
for (let i = 0; i < expectations.length; i++) {
  near(selections[i].state.X, expectations[i][0], `selection ${i} X diameter`);
  near(selections[i].state.Z, expectations[i][1], `selection ${i} Z`);
}
for (let i = 1; i < trace.length; i++) {
  if (trace[i].act === 'tool' || trace[i].act === 'offset') {
    assert.ok(!trace[i].seg, 'Selection or G10 alone does not create a motion');
    sameCarriage(trace[i - 1].state, trace[i].state, trace[i].act);
  }
}
const motions = trace.filter(s => s.seg);
assert.equal(motions.length, 3, 'Do not drop real moves at T changes or G10');
const uw = motions[0].seg;
near(uw.x0, 148.7); near(uw.x1, 152.7);
near(uw.z0, -42.02); near(uw.z1, -40.02);
sameCarriage(selections[2].state, { ...motions[0].state, X: uw.x0, Z: uw.z0 }, 'T02 with U/W begins at same carriage');
near(carriage(motions[0].state).r - carriage(selections[2].state).r, 2, 'U4 is 2mm radial travel');
near(carriage(motions[0].state).z - carriage(selections[2].state).z, 2, 'W2 is 2mm axial travel');
const offset = trace.find(s => s.act === 'offset');
near(offset.state.Z, -20.02); near(offset.state.zOff, -20);
near(motions[1].seg.z0 + motions[1].seg.zOff, -40.02);
near(motions[1].seg.z1 + motions[1].seg.zOff, -40.02);
const xOnly = motions[2].seg;
near(xOnly.x0, 150); near(xOnly.x1, 90);
near(xOnly.z0, -20.02); near(xOnly.z1, -20.02);
const previousToXOnly = trace[trace.indexOf(motions[2]) - 1];
sameCarriage(previousToXOnly.state, { ...motions[2].state, X: xOnly.x0, Z: xOnly.z0 }, 'X-only T02 handoff');

const reference = run('O0852\n#130=7\nG00 X80 Z10 T01\nG30 U0 W0\nT02\nG00 X90\nG00 Z2\nM30').trace;
const afterReference = reference.find(s => s.act === 'tool');
assert.equal(afterReference.state.X, null, 'T selection does not invent a G30 X coordinate');
assert.equal(afterReference.state.Z, null, 'T selection does not invent a G30 Z coordinate');

// Only the explicit machine7 O0852 variant gets this correction.
const unit10Source = fixture.replace('#130=7', '#130=10');
context.source = unit10Source;
assert.equal(evaluate('machineProfile(source).setup'), undefined);
const unit10Selections = run(unit10Source).trace.filter(s => s.act === 'tool');
near(unit10Selections[0].state.X, 80); near(unit10Selections[0].state.Z, 10);
for (const program of ['O0500', 'O8000']) {
  const untouched = run(`${program}\nG00 X80 Z10 T01\nT02\nM30`).trace.find(s => s.act === 'tool');
  near(untouched.state.X, 80); near(untouched.state.Z, 10);
}

// Machine5 retains its separate geometry; avoid coupling it to the new setup.
assert.notStrictEqual(unit7, evaluate('SoltriMachineSetups.unit5'));
context.source = 'O0600\nG00 X-72 Z10 T02\nT03\nM30';
assert.equal(evaluate('machineProfile(source).setup.machine'), '5');
const unit5Selection = run(context.source).trace.find(s => s.act === 'tool');
near(unit5Selection.state.X, -121); near(unit5Selection.state.Z, 13.86);

const sample7 = evaluate('SAMPLES.O0852_UNIT7');
assert.ok(sample7, 'Machine7 sample exists');
assert.match(evaluate('SAMPLES.O0852'), /#130\s*=\s*10\b/, 'Original machine10 sample remains unchanged');
const production = run(sample7);
assert.equal(production.trace.at(-1).state.parts, 50);
for (const s of production.trace) if (s.seg) {
  for (const key of ['x0', 'x1', 'z0', 'z1', 'zOff']) assert.ok(Number.isFinite(s.seg[key]), key);
}
console.log('Machine7: measured diameter conversion, stationary T selection, U/W and X-only handoffs, G10 continuity, unknown G30, machine10/unit5 isolation and complete O0852 cycle: OK');
