// core.js — scanner_nas/core.py 1:1 포팅. 순수 로직, 의존성 없음.
// 브라우저(window.ScannerCore) + Node(module.exports) 겸용.
(function (root) {
  'use strict';

  function normSpec(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/\s+/g, '').toUpperCase()
      .replace(/X/g, '*').replace(/×/g, '*');
  }

  function fmtNum(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v);  // JS는 10.0 → '10' 자동
    let s = String(v).trim();
    if (s.endsWith('.0')) s = s.slice(0, -2);
    return s;
  }

  function baseMat(m) {
    if (!m) return '';
    return String(m).split(/[(\s]/)[0].trim();
  }

  function freqKey(spec, material) {
    return normSpec(spec) + '|' + (material || '');
  }

  function grade(orders) {
    if (orders >= 5) return 'HIGH';
    if (orders >= 2) return 'MID';
    if (orders >= 1) return 'LOW';
    return 'NONE';
  }

  const EXTRA_CAP = 500;        // 선생산 추가 절대 상한
  const PREPROD_FREQ_MIN = 12;  // 선생산 허용 최소 발주 횟수 (100일)
  const PREPROD_ORDER_MAX = 50; // 선생산 허용 최대 발주 수량

  function preprodEligible(orderQty, orders) {
    const oq = orderQty || 0;
    return (orders || 0) >= PREPROD_FREQ_MIN && oq > 0 && oq <= PREPROD_ORDER_MAX;
  }

  // 주의: Python round()는 은행가 반올림, Math.round는 .5 올림.
  // 평균이 정확히 .5로 떨어지는 드문 경우 1 차이 가능 — 운영상 무시.
  function recommendQty(orderQty, g, qtySum, orders, stock, queuedOthers) {
    queuedOthers = queuedOthers || 0;
    const oq = (orderQty && orderQty > 0) ? orderQty : 0;
    if (!preprodEligible(oq, orders)) return oq;
    const avg = orders ? Math.round(qtySum / orders) : 0;
    const s = (stock !== null && stock !== undefined) ? stock : 0;
    const extra = Math.max(0, Math.min(avg, EXTRA_CAP) - s - Math.max(0, queuedOthers));
    return oq + extra;
  }

  function preprodQty(qtySum, stock, g) {
    if (g !== 'MID' && g !== 'HIGH') return 0;
    if (stock === null || stock === undefined) return null;
    const raw = Math.max(0, Math.trunc(qtySum) - Math.trunc(stock));
    const capped = Math.min(raw, 500);
    return Math.ceil(capped / 10) * 10;
  }

  function composeStockSpec(inner, outer, flange, height, material) {
    const spec = fmtNum(inner) + '*' + fmtNum(outer) + '*' + fmtNum(height);
    return freqKey(spec, material);
  }

  // Firebase 키 금지 문자(. # $ [ ] /) 치환 — scanned_index 키 읽기/쓰기 공통
  function fbKey(s) {
    return String(s).replace(/[.#$\[\]\/]/g, '_');
  }

  const core = {
    normSpec, fmtNum, baseMat, freqKey, grade,
    EXTRA_CAP, PREPROD_FREQ_MIN, PREPROD_ORDER_MAX,
    preprodEligible, recommendQty, preprodQty, composeStockSpec, fbKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.ScannerCore = core;
})(typeof self !== 'undefined' ? self : this);
