"""Build the operator's manual edit sheet. This script does not modify NC files."""
from pathlib import Path
from html import escape

ROOT=Path(__file__).resolve().parents[1]
TXT_PATH='programs/patches/unit5-o9050-manual-patch-20260910.txt'
PAGE_PATH='o0600-patch.html'
SOURCE=(ROOT/'programs/o0600/O9050.nc').read_text(encoding='ascii')

def between(start,end):
    return SOURCE.split(start,1)[1].split(end,1)[0].strip()

PATCHES=[
    dict(id='face',title='페이스 가공 후 Z20을 Z5로 변경',
         location='N203 (FACE CUTTING) 끝부분. G00 X-[#101+10.]; 다음, M01; 바로 앞.',
         action='이 위치의 G00 Z20. M52; 한 줄을 G00 Z5. M52;로 바꿉니다.',
         before='G00 Z20. M52;',after='G00 Z5. M52;',
         note='N300/N301의 수량·묶음 계산과 #521=0;, #522=0; 초기화는 그대로 둡니다.'),
    dict(id='boring',title='N310 진입부 3줄을 2줄로 교체',
         location='N310 (T01 GROUP BORING); 바로 아래부터 G98 G01 Z-[#507] F[#514*#110]; 바로 앞까지.',
         action='기존 진입 3줄을 아래 완성 코드 2줄로 교체합니다. T1을 선택한 뒤 Z2로 직접 접근합니다.',
         before='G00 X#103 M53 T01;\nG00 Z20.;\nG97 G00 Z2. S#514 M03;',
         after=between('N310 (T01 GROUP BORING);','G98 G01 Z-[#507] F[#514*#110];'),
         note='삭제하는 Z20은 N310 시작 직후의 진입 줄입니다. 보링이 끝난 뒤 G01 U0.2; 다음에 있는 G00 Z20.;는 남깁니다. M54;, G04 P700;도 남깁니다.'),
    dict(id='transition',title='N320~N330 연결 구간을 완성 코드로 교체',
         location='N320 (T02 CHAMFER UNIT); 줄부터, N330 안의 첫 G98 G01 X-[#103] F[#516*#116]; 바로 앞까지. N320/N330 라벨도 교체 구간에 포함합니다.',
         action='기존 구간을 아래 완성 코드로 맞춥니다. #516과 #522 계산을 N320 시작 부분의 #515 계산 바로 뒤로 옮기고, #521 갱신은 W10 후퇴 전에 둡니다. T3 회전수는 첫 X 이동에서 지정합니다.',
         before='''N320 (T02 CHAMFER UNIT);
#515=#111+#512*#523;
G97 G00 X-[#508] S#515 M03 T02;
G00 Z[2.-#521] M56;
G98 G01 Z-[#521] F[#515*#113];
G00 W10. M55;
G00 Z[-#521+20.];
#521=#521+#505;
M01;
N330 (T03 LOWER PARTING);
#516=#114+#513*#523;
#522=#522+#505;
G00 X-[#503] T03;
G00 Z[#119-#522];
G97 G00 X-[#103+1.] S#516 M03;''',
         after='N320 (T02 CHAMFER UNIT);\n'+between('N320 (T02 CHAMFER UNIT);','G98 G01 X-[#103] F[#516*#116];'),
         note='G00 Z[-#521+20.];를 이미 지웠다면 삭제가 끝난 상태입니다. 이 구간의 #521=#521+#505;, #522=#522+#505;, #516=#114+#513*#523;는 각각 정확히 한 번만 둡니다. 아래의 G98 G01 X-[#103] F[#516*#116];부터 실제 절단·M12 구간은 그대로 둡니다.'),
]

TITLE='5호기 패치파일 · O9050 수동 수정표'
INTRO='대상: O0600이 호출하는 O9050 / T1 보링 · T2 면취 · T3 절단 / 2026-09-10 수정본 기준'
RULES=[
    '이 TXT는 CNC 앞에서 읽는 수동 수정 설명서입니다. 파일 전체를 CNC 프로그램으로 입력하지 않습니다.',
    '가공을 정지하고 현재 CNC의 O9050을 백업한 뒤, 아래 3구간을 편집합니다. O0600의 품목 치수·회전수·수량 입력값은 수정 대상이 아닙니다.',
    '줄 번호는 삭제할 때 바뀌므로 N번호와 앞뒤 코드로 찾습니다. 이미 완성 코드와 같으면 해당 구간은 건너뜁니다.',
    '설명은 T02 면취 / T03 절단 배치 기준입니다. 실제 코드가 기존 예시나 완성 코드와 다르면 임의로 다른 구간을 삭제하지 말고 차이를 확인합니다.',
]
FINAL_CHECKS=[
    'N203 끝: G00 X-[#101+10.]; → G00 Z5. M52; → M01;',
    'N310 시작: T1 X 위치·회전수 지정 → G00 Z2. M53; → 기존 보링 절삭 줄',
    'N320~N330 안: #521 증가 1회 / #522 증가 1회 / #516 계산 1회. N301의 =0 초기화는 별개입니다.',
    '면취 후: G00 W10. M55; → M01; → N330 → G97 G00 X-[#503] S#516 M03 T03;',
    '보링 완료 후 G00 Z20.;, M54;, G04 P700;, M01;, M55/M56 및 절단 후 W[#505+20.]는 유지합니다.',
]
LIMIT='이 문서는 현재 게시된 O9050과 대조한 편집 안내입니다. M55 공압 복귀 완료 대기는 유지하며, 실제 장비에서 멈칫이 해소됐는지는 실기 확인이 필요합니다.'
PROVENANCE='첫 보링 진입과 면취 후퇴는 O8000 원문을 대조했습니다. #516/#522 계산을 미리 하고 #521 갱신을 옮긴 부분은 최근 요청하신 연결 동작 정리 사항입니다.'

def build():
    text=[TITLE,INTRO,'','읽는 방법',*RULES,'','수정은 3구간입니다.']
    cards=[]
    for number,p in enumerate(PATCHES,1):
        text += ['',f"[{number}] {p['title']}",'찾을 위치: '+p['location'],'작업: '+p['action'],
                 '','수정 전 예시',p['before'],'','수정 후 완성 코드',p['after'],'','확인: '+p['note']]
        cards.append(f'''<section class="patch" id="{p['id']}">
<h2><span>{number}</span> {escape(p['title'])}</h2>
<p class="where"><b>찾을 위치</b> {escape(p['location'])}</p><p>{escape(p['action'])}</p>
<div class="compare"><div><h3>수정 전 예시</h3><pre class="before">{escape(p['before'])}</pre></div>
<div><h3>수정 후 완성 코드 <button class="copy" data-copy="after-{p['id']}">완성 코드 복사</button></h3><pre class="after" id="after-{p['id']}">{escape(p['after'])}</pre></div></div>
<p class="note">{escape(p['note'])}</p></section>''')
    text += ['','마지막 대조',*FINAL_CHECKS,'',PROVENANCE,'',LIMIT,'',
             '최종 O9050 전체 코드: https://nuckythompson28-code.github.io/soltri-hub/programs/o0600/O9050.txt',
             '김공장 패치 화면: https://nuckythompson28-code.github.io/soltri-hub/o0600-patch.html','']
    destination=ROOT/TXT_PATH;destination.parent.mkdir(exist_ok=True)
    destination.write_bytes(('\n'.join(text).replace('\r\n','\n').replace('\n','\r\n')).encode('utf-8-sig'))
    page='''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>5호기 패치파일 · O9050 수동 수정표 — 김공장</title>
<style>
:root{color-scheme:dark;--bg:#10151b;--panel:#1a222d;--line:#354554;--text:#edf3fa;--dim:#bdc9d6;--accent:#ffbe7b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 "Segoe UI","맑은 고딕",sans-serif}main{max-width:1120px;margin:auto;padding:24px}a{color:#85d4ff}header nav,.actions,.steps{display:flex;flex-wrap:wrap;gap:10px}h1{font-size:28px;margin:18px 0 4px}h2{font-size:21px;margin:0 0 12px}h2 span{display:inline-grid;place-items:center;width:30px;height:30px;margin-right:5px;border-radius:50%;background:var(--accent);color:#15202b}h3{display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:14px;margin:0 0 7px}.subtitle{color:var(--dim);margin-top:0}.actions{margin:20px 0}.actions a,button,.steps a{border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:var(--panel);color:var(--text);text-decoration:none;font:inherit;cursor:pointer}.actions .primary{background:#ad6128;border-color:var(--accent);font-weight:bold}.copy{font-size:12px;padding:4px 8px;white-space:nowrap}.panel,.patch{padding:20px;margin:18px 0;background:var(--panel);border:1px solid var(--line);border-radius:12px}.patch{scroll-margin-top:15px}.panel ul{padding-left:22px;margin:0}.panel li{margin:8px 0}.where{color:#b6ddf3}.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px;min-width:0}.compare>div{min-width:0}pre{margin:0;padding:14px;border-radius:8px;font:14px/1.85 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}.before{background:#2c2526;color:#e7c9c5;border-left:3px solid #b78079}.after{background:#132c25;color:#d8ffeb;border-left:3px solid #77d8aa}.note{border-left:3px solid var(--accent);padding-left:12px;color:#ffe0b9}.checks p{padding:8px 0;border-bottom:1px solid var(--line)}footer{color:var(--dim);font-size:13px}#copyStatus{min-height:24px;color:#93e8bb}a:focus-visible,button:focus-visible{outline:3px solid #85d4ff;outline-offset:3px}
@media(max-width:700px){main{padding:14px 10px}h1{font-size:23px}h2{font-size:18px}.panel,.patch{padding:14px 12px}.compare{grid-template-columns:1fr}pre{padding:10px;font-size:13px}.actions a,button,.steps a{font-size:14px}.subtitle{font-size:13px}}
@media print{:root{color-scheme:light}body{background:#fff;color:#000;font-size:11px}main{padding:0}header nav,.actions,.steps,.copy,#copyStatus{display:none}.panel,.patch{background:#fff;border-color:#aaa;padding:10px;margin:10px 0}.where,.subtitle,.note,footer{color:#222}h1{font-size:22px}h2{font-size:15px}pre{font-size:10px;line-height:1.55;color:#000!important;background:#fff!important;border-color:#555!important;break-inside:avoid}.compare{gap:10px}.checks p{padding:3px 0}a{color:#000}}
</style></head><body><main><header><nav><a href="machines.html#m5">← 5호기 프로그램</a><a href="o0600.html">O0600 설명·코드</a></nav>
<h1>5호기 패치파일</h1><p class="subtitle">O9050 수동 수정표 · T1 보링 / T2 면취 / T3 절단 · 2026-09-10</p>
<div class="actions"><a class="primary" href="''' + TXT_PATH + '''" download>↓ 5호기 패치 TXT</a><button id="printPatch">인쇄</button><a href="programs/o0600/O9050.txt" download>완성본 O9050.txt</a></div>
<div class="panel"><b>수정 대상은 O9050의 아래 3구간입니다.</b><ul>''' + ''.join('<li>'+escape(rule)+'</li>' for rule in RULES) + '''</ul></div>
<nav class="steps" aria-label="수정 위치">''' + ''.join(f'<a href="#{p["id"]}">{i}. '+label+'</a>' for i,(p,label) in enumerate(zip(PATCHES,['페이스 후퇴','첫 보링 진입','면취→절단']),1)) + '''</nav></header>
<p id="copyStatus" role="status" aria-live="polite"></p>''' + ''.join(cards) + '''
<section class="panel checks"><h2>마지막 대조</h2>''' + ''.join('<p>'+escape(item)+'</p>' for item in FINAL_CHECKS) + '''</section>
<footer><p>''' + escape(PROVENANCE) + '''</p><p>''' + escape(LIMIT) + '''</p></footer></main>
<script>
document.querySelectorAll('[data-copy]').forEach(button=>button.onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent);document.getElementById('copyStatus').textContent='선택한 구간의 완성 코드만 복사했습니다.';}catch{document.getElementById('copyStatus').textContent='코드를 직접 선택하거나 패치 TXT를 내려받아 주세요.';}});
document.getElementById('printPatch').onclick=()=>window.print();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
</script></body></html>
'''
    (ROOT/PAGE_PATH).write_text(page,encoding='utf-8',newline='\n')
    print('Built',TXT_PATH,'and',PAGE_PATH)

if __name__=='__main__':build()
