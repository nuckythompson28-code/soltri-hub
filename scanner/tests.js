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
  eq('preprod_eligible 50/12', core.preprodEligible(50, 12), true);
  eq('preprod_eligible 51/12', core.preprodEligible(51, 12), false);
  eq('preprod_eligible 50/11', core.preprodEligible(50, 11), false);
  eq('preprod_eligible 0/30', core.preprodEligible(0, 30), false);
  eq('preprod_eligible 490/32', core.preprodEligible(490, 32), false);
  eq('recommend 50,6000,12,재고0', core.recommendQty(50, 'HIGH', 6000, 12, 0), 550);
  eq('recommend 30,6000,20,재고100', core.recommendQty(30, 'HIGH', 6000, 20, 100), 230);
  eq('recommend 재고미확인(null)=0취급', core.recommendQty(40, 'HIGH', 6000, 12, null), 540);
  eq('recommend 재고600≥평균→추가0', core.recommendQty(40, 'HIGH', 6000, 12, 600), 40);
  eq('recommend 51개 초과→정수량', core.recommendQty(51, 'HIGH', 6000, 30, 0), 51);
  eq('recommend 대량 490', core.recommendQty(490, 'HIGH', 28362, 32, 209), 490);
  eq('recommend 저빈도 6회→정수량', core.recommendQty(50, 'HIGH', 800, 6, 0), 50);
  eq('recommend 이력없음', core.recommendQty(50, 'NONE', 0, 0, 0), 50);
  eq('recommend 큐에 대량 잡힘→추가0', core.recommendQty(42, 'HIGH', 35316, 32, 0, 6964), 42);
  eq('recommend 큐 100 차감', core.recommendQty(40, 'HIGH', 6000, 12, 0, 100), 440);
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
