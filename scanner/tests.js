// tests.js — pytest(test_core.py, test_service_scan.py) JS 포팅.
// 실행: node tests.js  (브라우저: test.html이 로드)
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const core = isNode ? require('./core.js') : root.ScannerCore;
  const results = [];
  function eq(name, got, want) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    results.push({ name, ok, got, want });
  }

  // ===== test_core.py 포팅 =====
  eq('norm_spec: 공백 제거', core.normSpec(' 60 * 65 '), '60*65');
  eq('norm_spec: x→*', core.normSpec('16.9x20x4'), '16.9*20*4');
  eq('norm_spec: ×→*', core.normSpec('123×139.9×14'), '123*139.9*14');
  eq('fmt_num: 10.0→10', core.fmtNum(10.0), '10');
  eq('fmt_num: 9.7', core.fmtNum(9.7), '9.7');
  eq('fmt_num: 0', core.fmtNum(0), '0');
  eq('fmt_num: "65"', core.fmtNum('65'), '65');
  eq('freq_key 기본', core.freqKey('60*65', 'CN10'), '60*65|CN10');
  eq('freq_key 정규화', core.freqKey(' 60 X 65 ', 'CN10'), '60*65|CN10');
  eq('grade 0', core.grade(0), 'NONE');
  eq('grade 1', core.grade(1), 'LOW');
  eq('grade 2', core.grade(2), 'MID');
  eq('grade 4', core.grade(4), 'MID');
  eq('grade 5', core.grade(5), 'HIGH');
  eq('grade 99', core.grade(99), 'HIGH');
  eq('preprod_eligible 지정거래처 50/12', core.preprodEligible(50, 12, '디와이파워'), true);
  eq('preprod_eligible 대량도 허용(상한폐지)', core.preprodEligible(490, 32, '디와이파워'), true);
  eq('preprod_eligible 50/11', core.preprodEligible(50, 11, '디와이파워'), false);
  eq('preprod_eligible 0/30', core.preprodEligible(0, 30, '디와이파워'), false);
  eq('preprod_eligible 비대상 거래처', core.preprodEligible(50, 12, '유창하이텍'), false);
  eq('preprod_eligible 거래처 미상', core.preprodEligible(50, 12, null), false);
  eq('preprod_eligible 정규화 매칭', core.preprodEligible(50, 12, ' wipro(brasil) '), true);
  eq('preprod_eligible WIPRO(USA) 제외', core.preprodEligible(50, 12, 'WIPRO(USA)'), false);
  // 분기가중 추세: 목표 = (3·Q1+2·Q2+Q3)/6, 추가 = 목표 − 재고
  // (생산큐 물량 차감은 2026-06-11 제거 — 큐는 출하분이라 버퍼가 안 됨)
  eq('recommend 추세 45/64/67 재고4', core.recommendQty(34, 'HIGH', 176, 17, 4, 45, 64, 67, '디와이파워'), 85);
  eq('recommend 추세 Q1=0 가드', core.recommendQty(34, 'HIGH', 176, 17, 4, 0, 64, 67, '디와이파워'), 34);
  eq('recommend 추세 상한500', core.recommendQty(10, 'HIGH', 9999, 20, 0, 2000, 0, 0, 'HIMC'), 510);
  eq('recommend 추세 51개도 허용(상한폐지)', core.recommendQty(51, 'HIGH', 176, 17, 4, 45, 64, 67, '디와이파워'), 102);
  eq('recommend 추세 비대상 거래처→정수량', core.recommendQty(34, 'HIGH', 176, 17, 4, 45, 64, 67, '유창하이텍'), 34);
  // Q 데이터 없으면(구 캐시) 평균발주량 방식 폴백
  eq('recommend 50,6000,12,재고0', core.recommendQty(50, 'HIGH', 6000, 12, 0, null, 0, 0, '디와이파워'), 550);
  eq('recommend 30,6000,20,재고100', core.recommendQty(30, 'HIGH', 6000, 20, 100, null, 0, 0, '디와이파워'), 230);
  eq('recommend 재고미확인(null)=0취급', core.recommendQty(40, 'HIGH', 6000, 12, null, null, 0, 0, '디와이파워'), 540);
  eq('recommend 재고600≥평균→추가0', core.recommendQty(40, 'HIGH', 6000, 12, 600, null, 0, 0, '디와이파워'), 40);
  eq('recommend 51개 지정거래처→추가200', core.recommendQty(51, 'HIGH', 6000, 30, 0, null, 0, 0, '디와이파워'), 251);
  eq('recommend 비대상 거래처 490→정수량', core.recommendQty(490, 'HIGH', 28362, 32, 209, null, 0, 0, '파카코리아'), 490);
  eq('recommend 거래처 미지정→정수량', core.recommendQty(50, 'HIGH', 6000, 12, 0), 50);
  eq('recommend 저빈도 6회→정수량', core.recommendQty(50, 'HIGH', 800, 6, 0, null, 0, 0, '디와이파워'), 50);
  eq('recommend 이력없음', core.recommendQty(50, 'NONE', 0, 0, 0, null, 0, 0, '디와이파워'), 50);
  eq('recommend 대량 큐 무관 — 평균1104→상한500', core.recommendQty(42, 'HIGH', 35316, 32, 0, null, 0, 0, '디와이파워'), 542);
  eq('preprod_qty NONE→0', core.preprodQty(500, 100, 'NONE'), 0);
  eq('preprod_qty LOW→0', core.preprodQty(500, 100, 'LOW'), 0);
  eq('preprod_qty MID 500-100', core.preprodQty(500, 100, 'MID'), 400);
  eq('preprod_qty HIGH 95-30→70(올림10)', core.preprodQty(95, 30, 'HIGH'), 70);
  eq('preprod_qty 재고초과→0', core.preprodQty(50, 80, 'HIGH'), 0);
  eq('preprod_qty 상한500', core.preprodQty(2000, 0, 'HIGH'), 500);
  eq('preprod_qty 재고미확인→null', core.preprodQty(500, null, 'HIGH'), null);
  eq('compose_stock 60*65*10|CN10', core.composeStockSpec(60, 65, 0, 10.0, 'CN10'), '60*65*10|CN10');
  eq('compose_stock 16.9*20*4|RS40', core.composeStockSpec(16.9, 20, 0, 4, 'RS40'), '16.9*20*4|RS40');
  eq('fbKey: 금지문자 치환', core.fbKey('A.B#C$D[E]F/G'), 'A_B_C_D_E_F_G');
  eq('fbKey: 영숫자 그대로', core.fbKey('B1KA58001400'), 'B1KA58001400');

  // ===== specNumset / stockLookup =====
  eq('specNumset 정렬+제로', core.specNumset('34.93*38.10*25.40'), '25.4,34.93,38.1');
  eq('specNumset 변형접미사→null', core.specNumset('60*65*10A'), null);
  const STK = { '12.7*15.88*19.05|M/NW': 7, '34.93*38.1*25.4|M/NW': 3,
    '60*65*10A|CN10': 99, '55*60*10|CN10': 585 };
  eq('stockLookup 정확키', core.stockLookup(STK, '55*60*10', 'CN10'), 585);
  eq('stockLookup 치수 순서무관', core.stockLookup(STK, '15.88*19.05*12.7', 'M/NW'), 7);
  eq('stockLookup 트레일링 제로', core.stockLookup(STK, '34.93*38.10*25.40', 'M/NW'), 3);
  eq('stockLookup 변형품 병합금지', core.stockLookup(STK, '60*65*10', 'CN10'), 0);
  eq('stockLookup 미등재 사양=0', core.stockLookup(STK, '9*9*9', 'RS40'), 0);
  eq('stockLookup 재질 다르면 0', core.stockLookup(STK, '55*60*10', 'CN20'), 0);
  eq('stockLookup 재고목록 자체가 없음=null', core.stockLookup({}, '9*9*9', 'RS40'), null);

  // ===== test_service_scan.py 포팅 =====
  const svc = isNode ? require('./service.js') : root.ScannerService;
  const DATA = {
    label_days: 100,
    detail_index: {
      'B1KA58001400': { detail_no: 'B1KA58001400', company: '유창',
        po_num: '유창 260508', part_no: '', spec: '182*190*20',
        material: 'CN10', product: 'W/R', order_qty: 50 },
      'ONCE0000': { detail_no: 'ONCE0000', company: 'A', po_num: '',
        part_no: '', spec: '9*9*9', material: 'RS40', order_qty: 30 },
    },
    label_history: {
      '182*190*20|CN10': { orders: 6, companies: 2, qty_sum: 800,
        last: '2026-05-30', grade: 'HIGH', rows: [] },
    },
    stock: { '182*190*20|CN10': 100 },
    pending: ['B1KA58001400'],
  };

  let r = svc.scanResult(DATA, 'b1ka58001400');
  eq('scan HIGH: found', r.found, true);
  eq('scan HIGH: grade', r.grade, 'HIGH');
  eq('scan HIGH: order_qty', r.order_qty, 50);
  eq('scan HIGH: work_qty=정수량(6회<12)', r.work_qty, 50);
  eq('scan HIGH: preprod_eligible', r.preprod_eligible, false);
  eq('scan HIGH: preprod_qty', r.preprod_qty, 500);
  eq('scan HIGH: stock_covers(재고100≥발주50)', r.stock_covers, true);

  r = svc.scanResult(DATA, 'ONCE0000');
  eq('scan 이력없음: grade NONE', r.grade, 'NONE');
  eq('scan 이력없음: work_qty', r.work_qty, 30);
  eq('scan 이력없음: preprod 0', r.preprod_qty, 0);
  eq('scan 이력없음: 미등재 재고=0', r.stock, 0);
  eq('scan 이력없음: stock_covers false', r.stock_covers, false);

  r = svc.scanResult(DATA, 'ZZZZ9999');
  eq('scan 미발견: found', r.found, false);
  eq('scan 미발견: grade unknown', r.grade, 'unknown');

  r = svc.scanResult(DATA, '182*190*20/CN10/30');
  eq('사양바코드: found', r.found, true);
  eq('사양바코드: by spec', r.by, 'spec');
  eq('사양바코드: spec', r.spec, '182*190*20');
  eq('사양바코드: material', r.material, 'CN10');
  eq('사양바코드: order_qty', r.order_qty, 30);
  eq('사양바코드: grade HIGH(이력적중)', r.grade, 'HIGH');

  r = svc.scanResult({ label_history: {}, stock: {}, detail_index: {} }, '10*20*30/M/P/5');
  eq('사양바코드 M/P: found+spec', r.found === true && r.by === 'spec', true);
  eq('사양바코드 M/P: material', r.material, 'M/P');
  eq('사양바코드 M/P: qty', r.order_qty, 5);
  eq('사양바코드 M/P: spec', r.spec, '10*20*30');

  r = svc.scanResult(Object.assign({}, DATA, { stock: {} }), 'B1KA58001400');
  eq('재고미확인: grade 유지', r.grade, 'HIGH');
  eq('재고미확인: preprod null', r.preprod_qty, null);
  eq('재고미확인: stock null', r.stock, null);
  eq('재고미확인: stock_covers false', r.stock_covers, false);

  // 재고 폴백 — 치수 순서 다른 재고키 매칭
  r = svc.scanResult(Object.assign({}, DATA, {
    stock: { '20*182*190|CN10': 60 } }), 'B1KA58001400');
  eq('재고 순서폴백: stock 60', r.stock, 60);
  eq('재고 순서폴백: stock_covers(60≥50)', r.stock_covers, true);

  // ===== 같은 사양 추가분 배정 — 이른 발주 1건에만 =====
  const DATA2 = {
    label_days: 100,
    detail_index: {
      'B1KA10000100': { detail_no: 'B1KA10000100', company: '디와이파워', po_num: '',
        part_no: '', spec: '10*20*5', material: 'CN10', order_qty: 20 },
      'B1KA20000200': { detail_no: 'B1KA20000200', company: '한림테크', po_num: '',
        part_no: '', spec: '10*20*5', material: 'CN10', order_qty: 30 },
    },
    label_history: {
      '10*20*5|CN10': { orders: 15, companies: 2, qty_sum: 600,
        last: '2026-06-01', grade: 'HIGH', q1: 200, q2: 200, q3: 200, rows: [] },
    },
    stock: { '10*20*5|CN10': 0 },
    spec_queue: { '10*20*5|CN10': 2 },
    spec_queue_qty: { '10*20*5|CN10': 50 },
    pending: ['B1KA10000100', 'B1KA20000200'],
  };
  r = svc.scanResult(DATA2, 'B1KA10000100');
  eq('배정: 이른 발주 추가 200(큐 차감 없음)', r.work_qty, 220);
  eq('배정: 이른 발주 deferred false', r.extra_deferred, false);
  r = svc.scanResult(DATA2, 'B1KA20000200');
  eq('배정: 늦은 발주 정수량', r.work_qty, 30);
  eq('배정: 늦은 발주 deferred true', r.extra_deferred, true);

  // ===== 거래처 게이트 — 비대상은 정수량, 지정 거래처는 대량도 추가생산 =====
  const DATA3 = {
    label_days: 100,
    detail_index: {
      'V1': { detail_no: 'V1', company: '파카코리아', po_num: '',
        part_no: '', spec: '10*20*5', material: 'CN10', order_qty: 20 },
      'V2': { detail_no: 'V2', company: 'WIPRO(BRASIL)', po_num: '',
        part_no: '', spec: '30*40*5', material: 'CN10', order_qty: 120 },
    },
    label_history: {
      '10*20*5|CN10': { orders: 15, companies: 2, qty_sum: 600,
        last: '2026-06-01', grade: 'HIGH', q1: 200, q2: 200, q3: 200, rows: [] },
      '30*40*5|CN10': { orders: 15, companies: 2, qty_sum: 600,
        last: '2026-06-01', grade: 'HIGH', q1: 200, q2: 200, q3: 200, rows: [] },
    },
    stock: { '10*20*5|CN10': 0, '30*40*5|CN10': 0 },
    pending: ['V1', 'V2'],
  };
  r = svc.scanResult(DATA3, 'V1');
  eq('게이트: 비대상 거래처 eligible false', r.preprod_eligible, false);
  eq('게이트: 비대상 거래처 정수량', r.work_qty, 20);
  r = svc.scanResult(DATA3, 'V2');
  eq('게이트: 지정 거래처 120개 eligible', r.preprod_eligible, true);
  eq('게이트: 지정 거래처 추가200', r.work_qty, 320);

  // 사양 직접조회 = 거래처 미상 → 12회 이상이어도 추가생산 불허
  r = svc.scanResult({ label_days: 100, detail_index: {}, pending: [],
    label_history: { '10*20*5|CN10': { orders: 15, companies: 2, qty_sum: 600,
      last: '2026-06-01', grade: 'HIGH', q1: 200, q2: 200, q3: 200, rows: [] } },
    stock: { '10*20*5|CN10': 0 } }, '10*20*5/CN10/20');
  eq('직접조회: 거래처 미상 eligible false', r.preprod_eligible, false);
  eq('직접조회: 정수량', r.work_qty, 20);

  // ===== 창고프로그램 수치 병기 — 판정은 ERP 기준 =====
  r = svc.scanResult(Object.assign({}, DATA, { stock_wh: { '182*190*20|CN10': 1962 } }), 'B1KA58001400');
  eq('stock_wh: ERP 기준 유지', r.stock, 100);
  eq('stock_wh: 창고 수치 병기', r.stock_wh, 1962);
  eq('stock_wh: 판정 ERP(100≥50)', r.stock_covers, true);
  r = svc.scanResult(DATA, 'B1KA58001400');
  eq('stock_wh: 데이터 없으면 null', r.stock_wh, null);

  // ===== coverage (NAS service.coverage 동치) =====
  let cov = svc.coverage(DATA, new Set());
  eq('coverage 미스캔1', [cov.total, cov.scanned_count, cov.missing_count], [1, 0, 1]);
  eq('coverage 미스캔 상세', cov.missing[0].detail_no, 'B1KA58001400');
  cov = svc.coverage(DATA, new Set([core.fbKey('B1KA58001400')]));
  eq('coverage 전부스캔', [cov.total, cov.scanned_count, cov.missing_count], [1, 1, 0]);

  // parseSpecBarcode 엣지 + fbKey 적용 coverage
  eq('parse: 세그먼트 1개→null', svc.parseSpecBarcode('ABC'), null);
  eq('parse: 2세그먼트 숫자→material 빈값', svc.parseSpecBarcode('60*65/30'), ['60*65', '', 30]);
  eq('parse: 수량 없음→qty 0', svc.parseSpecBarcode('60*65/CN10'), ['60*65', 'CN10', 0]);
  cov = svc.coverage(
    { pending: ['A/B.100'], detail_index: { 'A/B.100': { company: 'X', spec: '1*2*3', material: 'M', order_qty: 1 } } },
    new Set([core.fbKey('A/B.100')]));
  eq('coverage fbKey 치환 매칭', [cov.total, cov.missing_count], [1, 0]);

  // ===== 보고 =====
  const fails = results.filter(r => !r.ok);
  if (isNode) {
    results.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' ' + r.name
      + (r.ok ? '' : '  got=' + JSON.stringify(r.got) + ' want=' + JSON.stringify(r.want))));
    console.log((results.length - fails.length) + '/' + results.length + ' passed');
    if (fails.length) process.exit(1);
  } else {
    root.ScannerTestResults = results;
  }
})(typeof self !== 'undefined' ? self : this);
