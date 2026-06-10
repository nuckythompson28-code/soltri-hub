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

  // 정규화 spec의 치수 숫자집합 키(정렬, '38.10'→'38.1').
  // 숫자가 아닌 토큰 포함(변형 접미사 60*65*10A 등)이면 null — 변형품 병합 금지.
  function specNumset(spec) {
    const parts = normSpec(spec).split('*').filter(function (p) { return p !== ''; });
    if (!parts.length) return null;
    const nums = [];
    for (let i = 0; i < parts.length; i++) {
      if (!/^\d+(?:\.\d+)?$/.test(parts[i])) return null;
      nums.push(parseFloat(parts[i]));
    }
    nums.sort(function (a, b) { return a - b; });
    return nums.map(function (n) { return String(n); }).join(',');
  }

  // 재고 조회 — 정확 키 → 재질 기본형 키 → '치수 숫자집합+재질' 폴백
  // (치수 표기 순서/트레일링 제로 차이 흡수, 동일 사양 복수 키는 합산).
  // 재고 목록 자체가 비면 null(미확인), 있으면 미등재 사양 = 0.
  function stockLookup(stock, spec, material) {
    if (!stock || !Object.keys(stock).length) return null;
    const mats = [];
    [(material || ''), baseMat(material)].forEach(function (m) {
      if (mats.indexOf(m) < 0) mats.push(m);
    });
    for (let i = 0; i < mats.length; i++) {
      const fk = freqKey(spec, mats[i]);
      if (fk in stock) return stock[fk];
    }
    const ns = specNumset(spec);
    if (ns !== null) {
      for (let i = 0; i < mats.length; i++) {
        let total = 0, found = false;
        for (const k in stock) {
          const bar = k.indexOf('|');
          const sp = bar < 0 ? k : k.slice(0, bar);
          const mat = bar < 0 ? '' : k.slice(bar + 1);
          if (mat !== mats[i]) continue;
          if (specNumset(sp) === ns) { total += Math.trunc(stock[k] || 0); found = true; }
        }
        if (found) return total;
      }
    }
    return 0;
  }

  // Firebase 키 금지 문자(. # $ [ ] /) 치환 — scanned_index 키 읽기/쓰기 공통
  function fbKey(s) {
    return String(s).replace(/[.#$\[\]\/]/g, '_');
  }

  const core = {
    normSpec, fmtNum, baseMat, freqKey, grade,
    EXTRA_CAP, PREPROD_FREQ_MIN, PREPROD_ORDER_MAX,
    preprodEligible, recommendQty, preprodQty, composeStockSpec, fbKey,
    specNumset, stockLookup,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else root.ScannerCore = core;
})(typeof self !== 'undefined' ? self : this);
