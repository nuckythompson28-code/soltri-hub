'use strict';

const VARS = {
  100:['척 기준 길이','246','총 수량과 G10의 Z 설정에 사용합니다. 실제 척 물림 길이로 단정하지 않습니다.'],
  101:['소재 외경','145','T2의 접근·후퇴 X좌표 기준입니다.'],
  102:['소재 내경','126','첫 단면 절삭 종료값 #502의 기준입니다.'],
  103:['제품 외경','140','T1 선가공 및 홈·모따기, T2 절단 접근의 X 기준입니다.'],
  104:['제품 내경 명목값','127.20','개정 전 명목값. #504를 통해 T2 절단 종료 위치에만 사용됩니다. T1 내경 치수는 바이트 세팅·보정으로 확인합니다.'],
  105:['제품 길이','9.87','도면 허용범위 9.85~9.90 안의 설정값입니다.'],
  106:['T2 절단날 폭','1.97','제품 길이에 더해 1개당 소모 피치를 구합니다. 실제 Z 보정 기준 날끝과 방향을 확인합니다.'],
  107:['오른쪽 내경 모따기','1.20','T1 모따기의 X 상한 계산에 사용합니다. 공구 배치·날끝 형상에 의존합니다.'],
  108:['오른쪽 외경 모따기','0.45','T1 모따기의 X 하한 계산에 사용합니다.'],
  109:['왼쪽 내경 모따기','0','원문에서는 설정만 하고 이후 사용하지 않습니다.'],
  110:['왼쪽 외경 모따기','0.60','T2의 Z 시작 위치와 U1.2 / W−0.6 이동에 사용합니다.'],
  111:['T1 시작 회전수','1200 rpm','초기 #513에 대입합니다.'],
  112:['T1 마지막 회전수 설정','1200 rpm','#111과 같으므로 현재 #511은 0입니다. 회전수 제한 명령 자체는 아닙니다.'],
  113:['T1 선가공·홈 폭 이송','0.12','G98에서 #513을 곱해 분당 이송 F144로 지령합니다.'],
  114:['T1 모따기 이송','0.11','주석은 GROOVING SIZE이지만 실제 사용 구간은 N150 모따기입니다. 현재 F132.'],
  115:['T1 홈 깊이 이송','0.025','X방향 홈 절입 이송. 현재 F30.'],
  116:['T2 시작 회전수','1200 rpm','초기 #514에 대입합니다.'],
  117:['T2 마지막 회전수 설정','1200 rpm','#116과 같으므로 현재 #512는 0입니다.'],
  118:['T2 단면·절단 이송','0.10','G98에서 #514를 곱합니다. 현재 F120.'],
  119:['홈가공 사용','1 (ON)','0이면 N170으로 이동. 홈가공과 함께 T1 Z 후퇴·회전수 갱신도 건너뜁니다. 원문은 정확히 0인지만 검사합니다.'],
  120:['홈 지름 감소량','3.70','X140 → X136.3. 반경 깊이는 1.85로 도면과 일치합니다.'],
  121:['홈 폭 방향 Z 이동','2.0','완성 홈 바닥 폭 2.5와 구분합니다. T1 날끝 유효 폭·Z 기준점을 함께 확인합니다.'],
  500:['안전거리 제외 길이','241','#100 − #530. 총 가공 수량 계산에 사용합니다.'],
  501:['T2 단면 후퇴 기준','149','#101 + 4.0. 실제 지령은 X−149입니다.'],
  502:['T2 단면 종료 기준','122.5','#102 − 3.5. 실제 지령은 X−122.5입니다.'],
  503:['T2 절단 접근 기준','144','#103 + 4.0. 실제 지령은 X−144입니다.'],
  504:['T2 절단 종료 기준','122.2','#104 − 5.0. 실제 지령은 X−122.2입니다.'],
  505:['제품당 소모 피치','11.84','#105 + #106 = 9.87 + 1.97.'],
  506:['보링바 최대 가공 길이 설정','55','#507을 뺀 길이 안에 들어가는 제품 수를 계산합니다.'],
  507:['보링바 최소 여유 설정','1.0','#506 − #507 = 54.0으로 묶음 수량을 계산합니다.'],
  510:['모따기 기준 여유','1.0','T1 모따기 Z 및 X 계산, 선가공 후 W 복귀 계산에 사용합니다.'],
  511:['T1 회전수 증가량','0','(#112 − #111) ÷ (#549 − 1). 홈 OFF이면 갱신 줄도 생략됩니다.'],
  512:['T2 회전수 증가량','0','(#117 − #116) ÷ (#549 − 1). 절단 후 #514에 더합니다.'],
  513:['현재 T1 회전수','1200 rpm','시작값 #111에서 제품마다 증가. 현재 증가량 0.'],
  514:['현재 T2 회전수','1200 rpm','시작값 #116에서 제품마다 증가. 현재 증가량 0.'],
  515:['한 묶음 제품 수','초기 4 → 종료 0','FIX[(55 − 1) ÷ 11.84]. N120/N200에서 총 수량·잔량에 맞게 조정합니다.'],
  516:['한 묶음 선가공 길이','초기 47.36 → 종료 0','#515 × #505. 수량 조정 때 다시 계산합니다.'],
  517:['총 가공 수량','20','FIX[241 ÷ 11.84].'],
  518:['전체 소모 길이','236.80','#517 × #505. 계산 후 이후 사용하지 않습니다.'],
  520:['묶음 내 진행 수량','0 → 4 (묶음마다 초기화)','N130에서 0, N170에서 1 증가. #515 미만이면 N150으로 반복합니다.'],
  521:['전체 진행 수량','0 → 20','N170에서 절단 직전에 1 증가합니다.'],
  522:['누적 피치 위치','0 → 236.80','N170에서 11.84씩 증가합니다. 모따기·홈은 증가 전, 절단은 증가 후 위치를 사용합니다.'],
  530:['척 안전거리 설정','5','길이 계산에서 제외하는 값입니다. 실제 공구·척 간 여유와는 별도로 확인합니다.'],
  549:['회전수 배분용 수량','20','FIX[246 ÷ 11.84]. 안전거리 제외 전 길이를 사용하므로 #517과 다를 수 있습니다.'],
  555:['홈 이동 구간 양쪽 여유','3.935','(#105 − #121) ÷ 2. 완성 홈 폭과 공구 날끝 기준까지 포함한 실물 어깨 폭으로 단정하지 않습니다.']
};

const CODES = {
  G00:['급속 이송','지정 좌표로 급속 이동합니다.'], G01:['직선 절삭 이송','F로 지정한 속도로 직선 이동합니다. 생략된 축은 이전 위치를 유지합니다.'],
  G04:['드웰','P700만큼 대기합니다. 시간 단위는 해당 제어기 설정에 따라 확인합니다.'],
  G10:['좌표 데이터 설정','L2 P0 Z246으로 좌표 오프셋 데이터를 설정합니다. Z246으로 이동하는 명령이 아닙니다.'],
  G30:['두 번째 기준점 복귀','U0 W0은 중간점의 증분 이동 0을 뜻하며, 이어서 설정된 기준점으로 복귀합니다.'],
  G97:['일정 회전수','S를 rpm으로 지령합니다. 현재 1200 rpm.'], G98:['분당 이송','mm 단위 기준 F는 mm/min. 코드에서 회전수 × 이송 설정으로 계산합니다.'],
  M00:['프로그램 정지','첫 단면 절삭 전에 작업자 재시작을 기다립니다.'],
  M03:['주축 역회전 · 5호기','김공장 5호기 M코드 표 기준입니다. 이 프로그램은 T1·T2 모두 M03을 사용합니다.'],
  M05:['주축 정지','주축 회전을 멈춥니다.'], M12:['카운팅','기존 5호기 M코드 표 기준. 각 제품 절단 뒤 1회, 현재 총 20회 실행합니다.'],
  M30:['프로그램 종료','O2026을 종료합니다. T3 소재 인출을 실행하는 명령이 아닙니다.'],
  M51:['에어 ON · 5호기','기존 5호기 M코드 표 기준입니다.'], M52:['에어 OFF · 5호기','기존 5호기 M코드 표 기준입니다.'],
  M53:['보링바 UP · 5호기','기존 5호기 M코드 표 기준입니다.'], M54:['보링바 DOWN · 5호기','기존 5호기 M코드 표 기준입니다.'],
  M55:['면취 후진 · 5호기','기존 5호기 M코드 표 기준. 초기 G30 블록에서 사용합니다.'],
  M98:['서브프로그램 호출','P2027에 해당하는 O2027을 호출합니다. 초록색 P2027을 누르면 해당 프로그램으로 이동합니다.'],
  M99:['호출한 곳으로 복귀','O2026의 M98 다음 줄로 복귀합니다. 이후 M05, M30으로 종료합니다.'],
  T01:['T1 복합 보링바','위·아래 바이트로 내·외경을 동시에 가공합니다. 이 프로그램의 모따기·홈가공에도 사용합니다.'],
  T02:['T2 아래쪽 절단 바이트','아래에서 위로 절입합니다. 음수 X의 절댓값이 줄어드는 방향이 소재 안쪽입니다.'],
  FIX:['정수부 취하기','현재 사용한 양수 계산에서 소수 부분을 버려 수량을 구합니다.'],
  IF:['조건 판단','조건이 참일 때 GOTO 또는 THEN 뒤의 명령을 수행합니다.'], THEN:['조건부 대입','IF 조건이 참일 때 뒤의 변수 대입을 수행합니다.'],
  EQ:['같다','='], LE:['이하','≤'], GE:['이상','≥'], LT:['미만','<'], GT:['초과','>'], GOTO:['라벨로 이동','같은 프로그램 안의 N번호로 이동합니다.']
};

const LINE_NOTES = {
  'IF [#549 EQ 1] THEN #549=2.0;':'회전수 증가량 계산에서 분모가 0이 되지 않도록 수량 1을 2로 바꿉니다. 가공 가능 수량 0에 대한 진입 검사는 아닙니다.',
  'G00 U150;':'현재 위치에서 X방향으로 U+150 증분 급속 이동합니다. 지름 지령이면 반경 방향 실제 이동량은 75입니다. X150 절대 위치 지정이 아닙니다.',
  'G00 X-[#101+5.0] T02;':'T2를 X−150으로 접근시킵니다. 소재 외경 145보다 바깥쪽의 아래쪽 위치입니다.',
  'G00 Z0. T02;':'T2의 Z 기준점을 0으로 이동합니다. 다음 M00에서 정지한 뒤 단면 절삭을 시작합니다.',
  'G98 G01 X-[#502] F[#514*#118];':'Z0에서 X−122.5까지 단면 절삭합니다. 현재 이송은 F120 mm/min.',
  'G00 X-[#501] M52;':'X−149로 후퇴하면서 5호기 에어 OFF(M52)를 지령합니다.',
  'Z20.0;':'직전 G00이 유지되므로 Z+20으로 급속 후퇴합니다.',
  'IF [#515 LE #517] GOTO 130;':'묶음 수량 4가 총 수량 20 이하면 N130으로 이동합니다. 크면 다음 줄에서 #515를 총 수량으로 줄입니다.',
  'G00 X#103 M53 T01;':'T1을 X140으로 이동하고 보링바 UP(M53)을 지령합니다. 복합 바이트 세팅으로 내·외경을 함께 가공합니다.',
  'Z[-#522+20.0];':'현재 묶음 시작면보다 Z+20인 위치로 급속 이동합니다.',
  'G97 G00 Z[-#522+5.0] S#513 M03;':'묶음 시작면 앞 5 mm로 접근합니다. 현재 S1200, 5호기 표 기준 M03 주축 역회전.',
  'G98 G01 Z-[#522+#516] F[#513*#113];':'T1으로 한 묶음 길이 47.36을 선가공합니다. 첫 묶음의 끝은 Z−47.36, 이송 F144.',
  'G01 U0.2;':'선가공 끝에서 X를 지름값 +0.2만큼 이동합니다. 반경 이동량은 0.1이며 직전 절삭 이송이 유지됩니다.',
  'G00 W[#516+#510];':'Z를 묶음 길이 + 기준 여유만큼 증분 후퇴합니다. 첫 묶음은 W48.36으로 Z−47.36 → Z+1.',
  '#520=0;':'새 묶음의 진행 수량만 0으로 초기화합니다. 전체 수량 #521과 누적 위치 #522는 유지합니다.',
  'G00 X#103 T01;':'T1 모따기 기준 X140으로 이동합니다.',
  'G97 G00 Z[-#522+2.0] S#513 M03;':'현재 제품 시작면보다 앞 2 mm로 급속 접근합니다.',
  'G98 G01 Z[-#522+#510] F[#513*#114];':'제품 시작면 앞 #510=1 위치까지 F132로 이동합니다. 첫 제품은 Z+1.',
  'G01 X[#103-[[#510+#108]*2.0]];':'X140 − (1 + 0.45) × 2 = X137.1. T1 오른쪽 외경 모따기 지령입니다.',
  'X[#103+[[#510+#107]*2.0]];':'직전 G01이 유지되어 X140 + (1 + 1.20) × 2 = X144.4로 이동합니다. 복합 바이트의 내경 모따기 동작입니다.',
  'IF [#119 EQ 0] GOTO 170;':'홈 OFF(#119=0)이면 N170으로 이동합니다. 홈가공과 T1의 Z+20 후퇴, #513 갱신까지 함께 건너뜁니다.',
  'G00 X[#103+0.1] T01;':'T1을 외경보다 지름값 0.1 큰 X140.1로 이동한 뒤 홈 위치에 접근합니다.',
  'G00 Z[-#522-#555];':'홈의 Z 이동 시작점으로 접근합니다. 첫 제품은 Z−3.935입니다.',
  'G01 X[#103-#120] F[#513*#115];':'X136.3까지 F30으로 절입합니다. 지름 감소량 3.70 → 반경 깊이 1.85로 도면과 일치합니다.',
  'G01 Z[-#522-#555-#121] F[#513*#113];':'Z를 2.0 이동하며 홈을 넓힙니다. 첫 제품 끝점 Z−5.935, 이송 F144. 완성 바닥 폭에는 날끝 유효 폭도 포함됩니다.',
  'G00 X[#103+0.1];':'홈에서 X140.1로 급속 후퇴합니다.',
  'G00 Z[-#522+20.0];':'현재 제품 시작면 앞 20 mm까지 T1을 후퇴시킵니다. 홈 OFF 분기에서는 이 줄이 실행되지 않습니다.',
  '#513=#513+#511;':'T1 회전수를 증가시킵니다. 현재 증가량은 0이며, 홈 OFF일 때는 이 줄도 생략됩니다.',
  '#520=#520+1;':'이번 묶음의 진행 수량을 1 증가시킵니다. 절단 직전에 갱신합니다.',
  '#521=#521+1;':'전체 진행 수량을 1 증가시킵니다. 절단 직전에 갱신하므로 이 시점만으로 절단 완료를 뜻하지는 않습니다.',
  '#522=#522+#505;':'누적 피치 위치에 11.84를 더합니다. 첫 제품은 0 → 11.84, 다음 절단의 Z 기준이 됩니다.',
  'G00 X-[#503] T02;':'T2를 X−144로 이동합니다. 공구는 소재 아래쪽에 있습니다.',
  'Z[#110-#522];':'왼쪽 외경 모따기를 시작할 Z 위치입니다. 첫 제품은 0.60 − 11.84 = Z−11.24.',
  'G97 G00 X-[#103+1.0] S#514 M03;':'T2를 X−141까지 급속 접근시킵니다. 현재 S1200.',
  'G98 G01 X-[#103] F[#514*#118];':'제품 외경 X−140까지 F120으로 절입합니다.',
  'U[#110*2.0] W-[#110];':'직전 G01 유지. U+1.2, W−0.6으로 왼쪽 외경 모따기. 첫 제품은 X−140/Z−11.24 → X−138.8/Z−11.84.',
  'X-[#504] M51;':'T2가 아래에서 위로 X−122.2까지 절입해 절단합니다. 5호기 에어 ON(M51).',
  'G00 X-[#101+10.0];':'T2를 소재 바깥쪽 X−155로 급속 후퇴시킵니다.',
  'W10.0 M52;':'직전 G00 유지. Z+10 증분 후퇴와 에어 OFF(M52)를 지령합니다.',
  'IF [#520 LT #515] GOTO 150;':'이번 묶음의 수량이 4 미만이면 N150으로 돌아갑니다. 묶음 보링 N130은 다시 하지 않고 다음 제품 모따기부터 시작합니다.',
  'G00 W10.0 T02;':'한 묶음 완료 후 T2를 Z+10만큼 추가 후퇴시킵니다.',
  'IF [[#521+#515] GT #517] GOTO 200;':'현재 진행 수량 + 다음 묶음 수량이 총 수량을 넘으면 N200에서 잔량을 계산합니다.',
  'GOTO 130;':'다음 묶음의 내·외경 선가공으로 돌아갑니다.',
  '#515=FIX[[#500-#522]/#505];':'남은 길이로 묶음 수량을 다시 계산합니다. 현재 20개 후 FIX[(241 − 236.80) ÷ 11.84] = 0.',
  'IF [#515 GE 1] GOTO 130;':'남은 제품이 1개 이상이면 N130으로 돌아갑니다. 0이면 다음 N250으로 진행해 종료합니다.'
};

const STAGES = {10:'회전수 증가량·총 수량 계산',100:'T2 단면가공',120:'묶음 수량 조정',130:'T1 내·외경 묶음 선가공',150:'T1 오른쪽 모따기',160:'T1 홈가공',170:'수량·누적 피치 갱신',180:'T2 왼쪽 외경 모따기·절단',190:'묶음 반복 판단',200:'마지막 잔량 계산',250:'후퇴·종료'};
const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');
const menu = document.getElementById('menuBtn');
const tip = document.getElementById('tip');
const mobile = matchMedia('(max-width:760px)');
let originalSource = '';
let inputs = null;
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value.toFixed(3)).toString();

function setDrawer(open) {
  sidebar.classList.toggle('open', open);
  backdrop.classList.toggle('show', open && mobile.matches);
  menu.setAttribute('aria-expanded', String(open));
  sidebar.inert = mobile.matches && !open;
}
function route() {
  const [requested, label] = location.hash.slice(1).split(':');
  const page = document.getElementById('page-' + requested) ? requested : 'overview';
  document.querySelectorAll('.page').forEach(el => { el.hidden = el.id !== 'page-' + page; });
  document.querySelectorAll('#nav [data-page]').forEach(el => {
    const active = el.dataset.page === page;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  main.scrollTop = 0;
  setDrawer(false);
  tip.hidden = true;
  if (label && /^N\d+$/.test(label)) {
    const target = document.getElementById('label-' + page + '-' + label);
    if (target) {
      target.scrollIntoView({block:'center'});
      target.classList.add('flash');
      setTimeout(() => target.classList.remove('flash'), 1000);
      explain(target);
    }
  }
}
menu.addEventListener('click', () => setDrawer(!sidebar.classList.contains('open')));
backdrop.addEventListener('click', () => {setDrawer(false); menu.focus();});
mobile.addEventListener('change', () => setDrawer(false));
window.addEventListener('hashchange', route);
document.querySelector('#nav').addEventListener('click', e => {
  const link = e.target.closest('a[data-page]');
  if (link && link.getAttribute('href') === location.hash) {e.preventDefault();route();}
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') {setDrawer(false);tip.hidden=true;} });

function tokenize(line, program) {
  const re = /(\([^)]*\))|(#\d+)|(GOTO\s+\d+)|(M98\s+P\d+)|(\bN\d+\b)|(\b(?:G\d+|M\d+|T\d+)\b)|(\b(?:FIX|IF|THEN|EQ|LE|GE|LT|GT)\b)/g;
  let html = '', last = 0;
  for (const match of line.matchAll(re)) {
    html += escapeHTML(line.slice(last, match.index));
    const token = match[0], safe = escapeHTML(token);
    if (match[1]) html += `<span class="cm">${safe}</span>`;
    else if (match[2]) html += `<span class="var" data-var="${token.slice(1)}">${safe}</span>`;
    else if (match[3]) html += `<span class="gc" data-code="GOTO">GOTO</span> <a class="jump" href="#${program}:N${token.match(/\d+/)[0]}">${token.match(/\d+/)[0]}</a>`;
    else if (match[4]) html += '<span class="mc" data-code="M98">M98</span> <a class="jump" href="#O2027">P2027</a>';
    else if (match[5]) html += `<span class="label">${safe}</span>`;
    else html += `<span class="${token.startsWith('M')?'mc':match[7]?'kw':'gc'}" data-code="${token}">${safe}</span>`;
    last = match.index + token.length;
  }
  return html + escapeHTML(line.slice(last));
}

function lineNote(line) {
  const clean = line.trim();
  if (LINE_NOTES[clean]) return LINE_NOTES[clean];
  const label = clean.match(/^N(\d+)/);
  if (label) return 'N' + label[1] + ' · ' + (STAGES[label[1]] || '분기 목적지');
  const assignment = clean.match(/^#(\d+)\s*=([^;(]+)/);
  if (assignment) {
    const v = VARS[assignment[1]];
    return `#${assignment[1]} ${v ? v[0] : ''} ← ${assignment[2].trim()}. ${v ? v[2] : ''}`;
  }
  const tokens = clean.match(/\b(?:G\d+|M\d+|T\d+)\b/g) || [];
  if (tokens.length) return tokens.filter(t=>CODES[t]).map(t=>`${t}: ${CODES[t][0]}. ${CODES[t][1]}`).join(' ');
  if (clean === '%') return '프로그램 파일의 경계 표시입니다.';
  if (!clean || clean === ';') return '가독성을 위한 구분 줄입니다.';
  if (/^O2026/.test(clean)) return 'O2026 메인 프로그램. 입력값을 설정하고 O2027을 호출합니다.';
  if (/^O2027/.test(clean)) return 'O2027 가공 서브프로그램. 원문의 60G는 프로그램 설명 주석입니다.';
  return clean.replace(/[();]/g,'').trim();
}

function renderProgram(program, lines, offset) {
  const heading = program === 'O2026' ? '① O2026 메인 프로그램' : '② O2027 가공 프로그램';
  const summary = program === 'O2026'
    ? '치수·모따기·홈·절삭조건을 설정하고 M98 P2027로 가공을 호출합니다. 도면 개정 전 내경 명목값 #104=127.20을 포함한 제공 원문입니다.'
    : '단면가공 → 4개 분량 내·외경 선가공 → 제품별 모따기·홈·절단 → 잔량 판단. 20개 후 메인으로 복귀하며 T03은 사용하지 않습니다.';
  let stage = '';
  const rows = lines.map((line,index) => {
    const label = line.trim().match(/^N(\d+)/);
    if (label) stage = 'N' + label[1] + ' · ' + (STAGES[label[1]] || '계산');
    return `<div class="ln${label?' block':''}" tabindex="0"${label?` id="label-${program}-N${label[1]}"`:''} data-line="${offset+index+1}" data-stage="${escapeHTML(stage)}" data-note="${escapeHTML(lineNote(line))}"><span class="gut" aria-hidden="true">${offset+index+1}</span><span class="src">${tokenize(line,program) || '&nbsp;'}</span></div>`;
  }).join('');
  document.getElementById('page-'+program).innerHTML = `<h1>${heading}</h1><div class="role">5호기 · 제일연마 · 제공 코드 원문</div><div class="summary">${summary}</div><div class="explain" id="explain-${program}" role="status"><strong>코드를 눌러 설명 보기</strong><span>줄을 선택하면 계산값과 동작을 설명합니다. 초록색 GOTO 목적지와 P2027은 누르면 이동합니다.</span></div><div class="codewrap"><div class="codehead">${program} · 줄 선택 = 설명 · 변수/코드 호버 = 사전 · 초록색 = 이동</div><div class="code" aria-label="${program} 원문 코드">${rows}</div></div><a class="btn" href="programs/o2026-o2027-jeil-unit5.nc" download>전체 원문 받기</a>`;
}

function tokenDescription(target) {
  const token = target.closest('[data-var], [data-code]');
  if (!token) return null;
  if (token.dataset.var) {
    const v = VARS[token.dataset.var];
    return v ? [`#${token.dataset.var} · ${v[0]}`, `${v[1]} · ${v[2]}`] : null;
  }
  const c = CODES[token.dataset.code];
  return c ? [`${token.dataset.code} · ${c[0]}`, c[1]] : null;
}
function explain(target) {
  const row = target.closest('.ln');
  if (!row) return;
  const page = row.closest('.page');
  page.querySelectorAll('.ln.selected').forEach(el=>el.classList.remove('selected'));
  row.classList.add('selected');
  const box = page.querySelector('.explain');
  const token = tokenDescription(target);
  box.querySelector('strong').textContent = token ? token[0] : `원문 ${row.dataset.line}줄${row.dataset.stage?' · '+row.dataset.stage:''}`;
  box.querySelector('span').textContent = token ? token[1] : row.dataset.note;
}
main.addEventListener('click', e => { if (!e.target.closest('a')) explain(e.target); });
main.addEventListener('keydown', e => { if ((e.key==='Enter'||e.key===' ') && e.target.classList.contains('ln')) {e.preventDefault();explain(e.target);} });
main.addEventListener('focusin', e => {if(e.target.classList.contains('ln')) explain(e.target);});
main.addEventListener('mousemove', e => {
  if (mobile.matches) return;
  const description = tokenDescription(e.target);
  if (!description) {tip.hidden=true;return;}
  const title=document.createElement('strong');title.textContent=description[0];
  tip.replaceChildren(title,document.createTextNode(description[1]));tip.hidden=false;
  const rect=tip.getBoundingClientRect();
  tip.style.left=Math.max(12,Math.min(e.clientX+14,innerWidth-rect.width-12))+'px';
  tip.style.top=Math.max(12,Math.min(e.clientY+16,innerHeight-rect.height-12))+'px';
});
main.addEventListener('mouseleave',()=>{tip.hidden=true;});
main.addEventListener('scroll',()=>{tip.hidden=true;},{passive:true});

function renderVariables() {
  const query=document.getElementById('var-search').value.toLowerCase().trim();
  let count=0;
  document.getElementById('variable-rows').innerHTML=Object.entries(VARS).filter(([n,v])=>('#'+n+' '+v.join(' ')).toLowerCase().includes(query)).map(([n,v])=>{
    count++;
    return `<tr><td><code>#${n}</code></td><td>${escapeHTML(v[0])}</td><td>${escapeHTML(v[1])}</td><td>${escapeHTML(v[2])}</td></tr>`;
  }).join('');
  document.getElementById('var-empty').hidden=count!==0;
}
document.getElementById('var-search').addEventListener('input',renderVariables);

function renderCoordinates() {
  if (!inputs) return;
  const n=Number(document.getElementById('part-number').value);
  const pitch=inputs[105]+inputs[106];
  const total=Math.trunc((inputs[100]-5)/pitch);
  const perBatch=Math.min(Math.trunc((55-1)/pitch),total);
  const done=n-1, start=done*pitch, end=n*pitch;
  const batchIndex=Math.trunc(done/perBatch), batchStart=batchIndex*perBatch*pitch;
  const batchCount=Math.min(perBatch,total-batchIndex*perBatch);
  const side=(inputs[105]-inputs[121])/2;
  document.getElementById('part-output').textContent=`${n} / ${total}개`;
  const rows=[
    ['현재 묶음',`${batchIndex+1}번째 묶음 · ${batchIndex*perBatch+1}~${batchIndex*perBatch+batchCount}번 제품`],
    ['N130 · 묶음 선가공 끝',`X${fmt(inputs[103])}, Z${fmt(-(batchStart+batchCount*pitch))}`],
    ['모따기·홈 전 #522',fmt(start)],
    ['N150 · 오른쪽 모따기',`Z${fmt(-start+1)}에서 X${fmt(inputs[103]-2*(1+inputs[108]))} → X${fmt(inputs[103]+2*(1+inputs[107]))}`],
    ['N160 · 홈 시작 / 끝 Z',`Z${fmt(-start-side)} → Z${fmt(-start-side-inputs[121])}`],
    ['N160 · 홈 바닥 X',`X${fmt(inputs[103]-inputs[120])} · 반경 깊이 ${fmt(inputs[120]/2)}`],
    ['N170 · 갱신 후 카운터',`#520 = ${done%perBatch+1}, #521 = ${n}, #522 = ${fmt(end)}`],
    ['N180 · T2 모따기 시작',`X${fmt(-inputs[103])}, Z${fmt(inputs[110]-end)}`],
    ['N180 · U / W 모따기 끝',`X${fmt(-inputs[103]+inputs[110]*2)}, Z${fmt(-end)}`],
    ['N180 · T2 절단 완료 지령',`X${fmt(-(inputs[104]-5))}, Z${fmt(-end)}`]
  ];
  document.getElementById('coordinates').innerHTML=rows.map(([name,value])=>`<tr><td>${escapeHTML(name)}</td><td>${escapeHTML(value)}</td></tr>`).join('');
  document.getElementById('batches').innerHTML=Array.from({length:Math.ceil(total/perBatch)},(_,i)=>`<div class="${i===batchIndex?'active':''}">${i*perBatch+1}~${Math.min((i+1)*perBatch,total)}번<small>선가공 끝 Z${fmt(-Math.min((i+1)*perBatch,total)*pitch)}</small></div>`).join('');
}
document.getElementById('part-number').addEventListener('input',renderCoordinates);
document.getElementById('copy-source').addEventListener('click',async()=>{
  const status=document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(originalSource);
    status.textContent='O2026 + O2027 원문을 복사했습니다.';
  } catch {
    status.textContent='클립보드 접근이 제한되어 있습니다. 원문 받기를 사용해 주세요.';
  }
});

async function loadSource() {
  try {
    const response=await fetch('programs/o2026-o2027-jeil-unit5.nc');
    if (!response.ok) throw new Error('원문 응답 오류');
    originalSource=await response.text();
    const lines=originalSource.replace(/\r\n/g,'\n').trimEnd().split('\n');
    const split=lines.findIndex(line=>/^\s*O2027\b/.test(line));
    if(split<0 || !lines.some(line=>/^\s*O2026\b/.test(line))) throw new Error('프로그램 번호 확인 실패');
    renderProgram('O2026',lines.slice(0,split),0);
    renderProgram('O2027',lines.slice(split),split);
    inputs={};
    lines.slice(0,split).forEach(line=>{const m=line.match(/^\s*#(\d+)\s*=\s*([+-]?\d+(?:\.\d*)?)/);if(m)inputs[m[1]]=Number(m[2]);});
    const total=Math.trunc((inputs[100]-5)/(inputs[105]+inputs[106]));
    document.getElementById('part-number').max=String(total);
    document.getElementById('part-number').disabled=false;
    document.getElementById('copy-source').disabled=false;
    renderCoordinates();
    route();
  } catch (error) {
    ['O2026','O2027'].forEach(program=>{
      document.getElementById('page-'+program).innerHTML=`<h1>${program}</h1><div class="check">원문을 불러오지 못했습니다. 연결 후 새로고침해 주세요. <a href="programs/o2026-o2027-jeil-unit5.nc">원문 직접 열기</a></div>`;
    });
    document.getElementById('copy-status').textContent='원문을 불러오지 못했습니다.';
    document.getElementById('coordinates').innerHTML='<tr><td colspan="2">좌표 계산용 원문을 불러오지 못했습니다. 연결 후 새로고침해 주세요.</td></tr>';
  }
}

renderVariables();
route();
loadSource();
if ('serviceWorker' in navigator) {
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});
}
