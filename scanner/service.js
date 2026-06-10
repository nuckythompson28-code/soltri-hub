// service.js — scanner_nas/service.py의 scan_result/coverage 포팅.
// DB(sqlite) 부분은 Firebase로 대체되므로 여기 없음 — 순수 판정/집계만.
(function (root) {
  'use strict';
  const core = (typeof module !== 'undefined' && module.exports)
    ? require('./core.js') : root.ScannerCore;

  // '내경*외경*폭/소재/수량' 파싱. 소재에 '/'(M/P 등) 가능.
  function parseSpecBarcode(raw) {
    const segs = raw.split('/').filter(function (s) { return s !== ''; });
    if (segs.length < 2) return null;
    const dims = segs[0];
    const last = segs[segs.length - 1];
    let qty = 0, material;
    if (/^\d+$/.test(last) && segs.length >= 3) {
      qty = parseInt(last, 10);
      material = segs.slice(1, -1).join('/');
    } else if (/^\d+$/.test(last) && segs.length === 2) {
      qty = parseInt(last, 10);
      material = '';
    } else {
      material = segs.slice(1).join('/');
    }
    return [dims, material, qty];
  }

  function scanBySpec(data, raw) {
    const parsed = parseSpecBarcode(raw);
    if (!parsed || !parsed[0]) {
      return { found: false, code: raw, grade: 'unknown',
        order_qty: 0, work_qty: 0, preprod_qty: 0, hist: null, by: 'spec' };
    }
    const spec = parsed[0], material = parsed[1], oq = parsed[2];
    const lh = data.label_history || {};
    const fk = core.freqKey(spec, material);
    const hist = lh[fk] || lh[core.freqKey(spec, core.baseMat(material))] || null;
    const g = hist ? hist.grade : 'NONE';
    const stk = data.stock || {};
    let stock = stk[fk];
    if (stock === undefined) stock = stk[core.freqKey(spec, core.baseMat(material))];
    const stockVal = (stock === undefined) ? null : stock;
    const qtySum = hist ? hist.qty_sum : 0;
    const orders = hist ? hist.orders : 0;
    const specQueue = (data.spec_queue || {})[fk] || 0;
    const specQueueQty = (data.spec_queue_qty || {})[fk] || 0;
    const queuedOthers = Math.max(0, specQueueQty - oq);
    return {
      found: true, code: raw, detail_no: '', company: '(사양 직접조회)',
      spec: spec, material: material, part_no: '', product: '',
      order_qty: oq, grade: g,
      work_qty: core.recommendQty(oq, g, qtySum, orders, stockVal, queuedOthers),
      avg_order: orders ? Math.round(qtySum / orders) : 0,
      preprod_eligible: core.preprodEligible(oq, orders),
      preprod_qty: core.preprodQty(qtySum, stockVal, g),
      stock: stockVal, spec_queue: specQueue, queued_others: queuedOthers,
      by: 'spec', hist: hist,
    };
  }

  function scanResult(data, code) {
    const c = (code || '').trim().toUpperCase();
    if (c.indexOf('/') >= 0) return scanBySpec(data, c);
    const info = (data.detail_index || {})[c];
    if (!info) {
      return { found: false, code: c, grade: 'unknown',
        order_qty: 0, work_qty: 0, preprod_qty: 0, hist: null, by: 'detail' };
    }
    const fk = core.freqKey(info.spec || '', info.material || '');
    const hist = (data.label_history || {})[fk] || null;
    const g = hist ? hist.grade : 'NONE';
    const stock = (data.stock || {})[fk];
    const stockVal = (stock === undefined) ? null : stock;
    const qtySum = hist ? hist.qty_sum : 0;
    const orders = hist ? hist.orders : 0;
    const oq = info.order_qty || 0;
    const specQueue = (data.spec_queue || {})[fk] || 0;
    const specQueueQty = (data.spec_queue_qty || {})[fk] || 0;
    const queuedOthers = Math.max(0, specQueueQty - oq);
    return {
      found: true, code: c, detail_no: info.detail_no,
      company: info.company || '', spec: info.spec || '',
      material: info.material || '', part_no: info.part_no || '',
      product: info.product || '', by: 'detail',
      order_qty: oq, grade: g,
      work_qty: core.recommendQty(oq, g, qtySum, orders, stockVal, queuedOthers),
      avg_order: orders ? Math.round(qtySum / orders) : 0,
      preprod_eligible: core.preprodEligible(oq, orders),
      preprod_qty: core.preprodQty(qtySum, stockVal, g),
      stock: stockVal, spec_queue: specQueue, queued_others: queuedOthers,
      hist: hist,
    };
  }

  // 미스캔 집계 — NAS의 SELECT DISTINCT detail_no WHERE found=1 대응.
  // scannedKeySet: Set<string>, 원소는 core.fbKey(발주상세NO).
  function coverage(data, scannedKeySet) {
    const seen = {};
    const expected = [];
    (data.pending || []).forEach(function (dn) {
      if (!seen[dn]) { seen[dn] = 1; expected.push(dn); }
    });
    const idx = data.detail_index || {};
    const missing = [];
    expected.forEach(function (dn) {
      if (!scannedKeySet.has(core.fbKey(dn))) {
        const info = idx[dn] || {};
        missing.push({ detail_no: dn, company: info.company || '',
          spec: info.spec || '', material: info.material || '',
          order_qty: info.order_qty || 0 });
      }
    });
    return { total: expected.length,
      scanned_count: expected.length - missing.length,
      missing_count: missing.length, missing: missing };
  }

  const svc = { parseSpecBarcode, scanResult, coverage };
  if (typeof module !== 'undefined' && module.exports) module.exports = svc;
  else root.ScannerService = svc;
})(typeof self !== 'undefined' ? self : this);
