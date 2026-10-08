/* Axisymmetric material model for the 3D viewer. Never edits NC input.
   Internally Z is fixed to the original bar; snapshots expose world Z. */
(() => {
  'use strict';
  const EPS = 1e-8;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function create({ trace, stock, plotPts, role }) {
    const length = Number(stock.totalLength);
    if (!(length > 0) || !Number.isFinite(length)) throw Error('A finite positive totalLength is required');
    const rawO = Number(stock.rawO) / 2, rawI = Number(stock.rawI) / 2;
    if (!(rawO > rawI && rawI >= 0)) throw Error('Stock OD must exceed ID');
    const tip = Number(stock.tip);
    if (!(tip > 0) || !Number.isFinite(tip)) throw Error('A finite positive parting width is required');
    const gap = Number.isFinite(stock.boringGap) ? stock.boringGap : (stock.finO - stock.finI) / 2;
    const nz = Math.max(80, Math.min(8192, Math.ceil(length / .2))), dz = length / nz, z0 = -length;
    const initial = { outer: new Float64Array(nz + 1).fill(rawO), inner: new Float64Array(nz + 1).fill(rawI), freeEnd: 0, pull: 0, parts: [] };
    const clone = s => ({ outer: s.outer.slice(), inner: s.inner.slice(), freeEnd: s.freeEnd, pull: s.pull, parts: s.parts.slice() });
    const paths = new Map(), checkpoints = new Map([[0, clone(initial)]]);
    let lastPrefix = { index: 0, state: clone(initial) };
    const countForCut = new Map();
    let previousCount = 0, previousCountIndex = -1, hasCounts = false;
    for (let i = 0; i < trace.length; i++) {
      const count = Number(trace[i].state?.parts || 0);
      if (count <= previousCount) continue;
      hasCounts = true; previousCount = count;
      for (let j = i - 1; j > previousCountIndex; j--) {
        const seg = trace[j].seg;
        if (seg && seg.type !== 0 && role(seg.tool) === 'part') { countForCut.set(j, count); break; }
      }
      previousCountIndex = i;
    }
    function profileAt(array, z) {
      const q = clamp((z - z0) / dz, 0, nz), a = Math.floor(q), b = Math.min(nz, a + 1);
      return array[a] + (array[b] - array[a]) * (q - a);
    }
    function getPath(index) {
      if (paths.has(index)) return paths.get(index);
      const raw = plotPts(trace[index].seg);
      const points = raw.filter(p => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      const pieces = []; let total = 0;
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1], b = points[j], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= EPS) continue;
        pieces.push({ a, b, start: total, length: d }); total += d;
      }
      const path = { pieces, total }; paths.set(index, path); return path;
    }
    function eachColumn(lo, hi, fn) {
      const a = Math.max(0, Math.ceil((lo - z0) / dz - EPS));
      const b = Math.min(nz, Math.floor((hi - z0) / dz + EPS));
      for (let j = a; j <= b; j++) fn(j, z0 + j * dz);
    }
    function removeLine(s, a, b, kind, brakeUp) {
      const low = Math.max(z0, Math.min(a[0], b[0]));
      const high = Math.min(s.freeEnd, Math.max(a[0], b[0]) + (kind === 'part' ? tip : 0));
      if (high < low - EPS) return;
      const dZ = b[0] - a[0], dR = b[1] - a[1];
      const column = (j, z) => {
        // The retained end faces are the boundaries of a radial kerf, not
        // zero-thickness samples to be erased along with its interior.
        if (kind === 'part' && Math.abs(dZ) < EPS && (z <= a[0] + EPS || z >= a[0] + tip - EPS)) return;
        let ta, tb;
        if (Math.abs(dZ) < EPS) { ta = 0; tb = 1; }
        else if (kind === 'part') {
          const p = (z - tip - a[0]) / dZ, q = (z - a[0]) / dZ;
          ta = clamp(Math.min(p, q), 0, 1); tb = clamp(Math.max(p, q), 0, 1);
        } else { ta = tb = clamp((z - a[0]) / dZ, 0, 1); }
        const ra = a[1] + dR * ta, rb = a[1] + dR * tb;
        const minR = ra * rb <= 0 ? 0 : Math.min(Math.abs(ra), Math.abs(rb));
        const maxR = Math.max(Math.abs(ra), Math.abs(rb));
        const oldOuter = s.outer[j], oldInner = s.inner[j];
        if (kind === 'part' || kind === 'compound' || kind === 'od') {
          // Contact is required: traversing a hollow bore cannot remove its wall.
          if (maxR >= oldInner - EPS && minR <= oldOuter + EPS) s.outer[j] = Math.max(oldInner, Math.min(oldOuter, minR));
        }
        if (kind === 'compound' && brakeUp && gap >= 0) {
          const lowerMin = minR - gap, lowerMax = maxR - gap;
          if (lowerMax >= oldInner - EPS && lowerMin <= s.outer[j] + EPS) {
            s.inner[j] = Math.min(s.outer[j], Math.max(oldInner, Math.min(lowerMax, s.outer[j])));
          }
        } else if (kind === 'id') {
          if (maxR >= oldInner - EPS && minR <= oldOuter + EPS) s.inner[j] = Math.min(oldOuter, Math.max(oldInner, maxR));
        }
      };
      eachColumn(low, high, column);
      // A stationary-Z move may lie between samples. Update only its nearest
      // column; exact parting crossings still use the unrounded cut coordinate.
      if (kind !== 'part' && Math.abs(dZ) < EPS && low <= high) {
        const j = clamp(Math.round((a[0] - z0) / dz), 0, nz); column(j, z0 + j * dz);
      }
    }
    function capture(s, cutZ, index, fraction) {
      const end = s.freeEnd, start = cutZ + tip;
      if (cutZ < z0 - EPS || cutZ > end + EPS || start > end + EPS) return false;
      if (end - start > EPS) {
        const zs = [], outer = [], inner = [];
        const add = z => { zs.push(z + s.pull); outer.push(profileAt(s.outer, z)); inner.push(profileAt(s.inner, z)); };
        add(start);
        eachColumn(start + EPS * 10, end - EPS * 10, (_j, z) => add(z));
        add(end);
        const number = countForCut.get(index) || null;
        s.parts.push(Object.freeze({ id: s.parts.length + 1, index, fraction: clamp(fraction, 0, 1),
          kind: hasCounts && !number ? 'scrap' : 'product', number,
          zStart: start + s.pull, zEnd: end + s.pull,
          zs: Object.freeze(zs), outer: Object.freeze(outer), inner: Object.freeze(inner) }));
      }
      s.freeEnd = Math.max(z0, Math.min(end, cutZ));
      return true;
    }
    function partLine(s, a, b, index, f0, f1) {
      // Split where the sampled inner profile changes its interpolation slope.
      const breaks = [0, 1], dZ = b[0] - a[0], dR = b[1] - a[1];
      if (Math.abs(dZ) > EPS) eachColumn(Math.min(a[0], b[0]), Math.max(a[0], b[0]), (_j, z) => {
        const t = (z - a[0]) / dZ; if (t > EPS && t < 1 - EPS) breaks.push(t);
      });
      if (a[1] * b[1] < 0) breaks.push(-a[1] / dR);
      breaks.sort((x, y) => x - y);
      for (let k = 1; k < breaks.length; k++) {
        const ta = breaks[k - 1], tb = breaks[k];
        if (tb - ta <= EPS) continue;
        const p = [a[0] + dZ * ta, a[1] + dR * ta], q = [a[0] + dZ * tb, a[1] + dR * tb];
        const i0 = profileAt(s.inner, p[0]), i1 = profileAt(s.inner, q[0]);
        const v0 = Math.abs(p[1]) - i0, v1 = Math.abs(q[1]) - i1;
        // Only an inward crossing of the CURRENT bore can sever the material.
        // Target finI and M12 alone are never evidence of a completed cut.
        const crossing = v0 >= -EPS && v1 <= EPS && v1 < v0 - EPS;
        if (crossing) {
          const u = clamp(v0 / (v0 - v1), 0, 1);
          const cross = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
          const cutZ = cross[0], oldFront = s.freeEnd;
          const within = cutZ >= z0 - EPS && cutZ <= oldFront - tip + EPS;
          const wall = profileAt(s.outer, cutZ) - profileAt(s.inner, cutZ);
          if (within && wall > EPS) {
            const eventFraction = f0 + (f1 - f0) * (ta + (tb - ta) * u);
            // A constant-Z finishing stroke removes only the kerf, so retain
            // the product profile before cutting away samples beside its face.
            if (Math.abs(q[0] - p[0]) < EPS) {
              capture(s, cutZ, index, eventFraction);
              removeLine(s, p, cross, 'part', false);
            } else {
              removeLine(s, p, cross, 'part', false);
              capture(s, cutZ, index, eventFraction);
            }
            removeLine(s, cross, q, 'part', false);
            continue;
          }
        }
        removeLine(s, p, q, 'part', false);
      }
    }
    function apply(s, index, fraction = 1) {
      const step = trace[index];
      if (!step || fraction <= 0) return;
      if (Number.isFinite(step.pull) && step.pull !== 0) { s.pull += step.pull * fraction; return; }
      const seg = step.seg;
      if (!seg || seg.type === 0) return;
      const kind = role(seg.tool);
      if (kind === 'pull') return;
      const path = getPath(index), limit = path.total * fraction;
      if (!path.total) return;
      for (const piece of path.pieces) {
        if (piece.start >= limit - EPS) break;
        const ratio = clamp((limit - piece.start) / piece.length, 0, 1);
        const a = [piece.a[0] - s.pull, piece.a[1]];
        const b = [piece.a[0] + (piece.b[0] - piece.a[0]) * ratio - s.pull, piece.a[1] + (piece.b[1] - piece.a[1]) * ratio];
        const f0 = piece.start / path.total, f1 = (piece.start + piece.length * ratio) / path.total;
        if (kind === 'part') partLine(s, a, b, index, f0, f1);
        else removeLine(s, a, b, kind, !!step.state?.brakeUp);
      }
    }
    function before(index) {
      if (lastPrefix.index === index) return clone(lastPrefix.state);
      let start = 0, base = checkpoints.get(0);
      for (const [candidate, state] of checkpoints) if (candidate <= index && candidate > start) { start = candidate; base = state; }
      if (lastPrefix.index <= index && lastPrefix.index > start) { start = lastPrefix.index; base = lastPrefix.state; }
      const state = clone(base);
      for (let i = start; i < index; i++) {
        apply(state, i);
        if ((i + 1) % 32 === 0) checkpoints.set(i + 1, clone(state));
      }
      lastPrefix = { index, state: clone(state) };
      return state;
    }
    function at(index, fraction = 1) {
      const current = Math.min(trace.length - 1, Math.max(-1, Number.isFinite(index) ? Math.trunc(index) : -1));
      const progress = Number.isFinite(fraction) ? clamp(fraction, 0, 1) : 1;
      const state = current < 0 ? clone(initial) : before(current);
      if (current >= 0) apply(state, current, progress);
      if (current >= 0 && progress === 1) {
        lastPrefix = { index: current + 1, state: clone(state) };
        if ((current + 1) % 32 === 0) checkpoints.set(current + 1, clone(state));
      }
      return { z0: z0 + state.pull, dz, nz, outer: state.outer, inner: state.inner,
        freeEnd: state.freeEnd + state.pull, totalPull: state.pull,
        remainingLength: Math.max(0, state.freeEnd - z0), parts: state.parts.slice() };
    }
    return Object.freeze({ at });
  }
  globalThis.SoltriStock3D = Object.freeze({ create });
})();
