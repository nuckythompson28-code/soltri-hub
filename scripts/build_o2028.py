"""Build S3 reference and explicitly non-production drawing simulation."""
from pathlib import Path
from html import escape
import json,re

ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'programs/o2028'
NAMES=['O2028','O2029','O6000','O6001','O6002','O6003','O6004']
cfg=json.loads((D/'settings.json').read_text(encoding='utf-8'))
original={n:(D/'original'/f'{n}.txt').read_text(encoding='ascii') for n in NAMES}
original={n:'\n'.join(line.rstrip() for line in code.splitlines())+'\n' for n,code in original.items()}
main=original['O2028']
values={101:cfg['materialOD'] or 0,102:cfg['materialID'] or 0,103:cfg['workOD'],104:cfg['workID'],105:cfg['workLength'],106:cfg['tipWidth'],120:cfg['grooveDiameterReduction'],121:cfg['grooveZTravel']}
for n,v in values.items():
    main,count=re.subn(rf'(?m)^(#{n}=)[\d.]+',lambda m:m[1]+str(v),main)
    assert count==1,n
guards='''(DRAWING DRAFT - SETUP NOT RELEASED);
IF [#101 LE 0] THEN #3000=28;
IF [#102 LE 0] THEN #3000=28;
IF [#101 LT #103] THEN #3000=29;
IF [#102 GT #104] THEN #3000=29;
'''
main=main.replace('M98 P2029;',guards+'M98 P2029;')
def joined(first):return '\n'.join([first]+[original[n] for n in NAMES[1:]])
draft=joined(main)
(D/'drawing-draft.txt').write_text(draft,encoding='ascii')
(D/'original-set.txt').write_text(joined(original['O2028']),encoding='ascii')
# Explicit virtual stock at finished OD/ID: zero machining allowance.
# These values are ONLY for geometric path rehearsal, never stock recommendations.
virtual=main.replace('#101=0 ',f"#101={cfg['workOD']} ").replace('#102=0 ',f"#102={cfg['workID']} ")
virtual=virtual.replace('(DRAWING DRAFT - SETUP NOT RELEASED);','(SIMULATION ONLY - NOT FOR CNC);\n(VIRTUAL FINISHED SIZE STOCK - ZERO ALLOWANCE);')
(D/'drawing-simulation.txt').write_text(joined(virtual),encoding='ascii')
rows=[('소재 외경','#101','145','미확정 — 실행용 초안 0'),('소재 내경','#102','126','미확정 — 실행용 초안 0'),('완성 외경','#103','140','242'),('완성 내경','#104','127.50','230.30 · 벽 두께 기준 후보'),('제품 폭','#105','9.87','9.87 · 공차 9.85~9.90'),('절단날 폭','#106','1.85','2.00 · 사용자 지정 가정'),('홈 깊이 지령','#120','3.75','3.70 · 반경 깊이 1.85'),('홈 Z 이동량','#121','2.15','2.50 · 실제 홈 폭은 날 형상 확인 필요')]
table=''.join('<tr>'+''.join('<td>'+escape(v)+'</td>' for v in row)+'</tr>' for row in rows)
codes=''
for n in NAMES:
    body=main if n=='O2028' else original[n]
    lines=body.strip().splitlines();start=next(i for i,l in enumerate(lines) if l.startswith(n))
    codes+=f'<details id="{n}"><summary>{n} · '+('도면 설정 초안' if n=='O2028' else '제공 원문 유지')+'</summary><pre>'+ '\n'.join(f'{i+1:3}  {escape(line)}' for i,line in enumerate(lines[start:]))+'</pre></details>'
page='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S3 O2028 · 제일연마 — 김공장</title><link rel="stylesheet" href="ui.css"><link rel="stylesheet" href="machine-programs.css"><script src="ui.js" defer></script><style>
main{max-width:1100px;margin:auto;padding:24px}section,details{background:white;border:1px solid #c9d2df;border-radius:10px;padding:18px;margin:18px 0}h1{font-size:26px}.notice{border-left:5px solid #a55700;background:#fff5e6;color:#543400}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccd3dc;padding:10px;text-align:left}.scroll{overflow:auto}pre{overflow:auto;background:#f3f5f8;padding:12px;font-size:13px;line-height:1.6}summary{font-weight:bold;cursor:pointer}img{max-width:100%;height:auto}a{color:#1557a0}.actions{display:flex;gap:16px;flex-wrap:wrap}.evidence{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}@media(max-width:600px){main{padding:12px}section,details{padding:12px}td,th{padding:7px;font-size:13px}}
</style></head><body class="kim-ui kim-doc"><main id="main"><h1>13호기 S3 · O2028 / O2029</h1><p>제일연마 · 230.2×242×10 W/R · CN10 · 도면 2024-05-30 / 자료 접수 2026-09-30</p>
<section class="notice"><b>등록 상태: 도면 설정 검토 중 · CNC 실행용 확정본 아님</b><p>소재 외경·내경 미확정. T02 날 폭 2mm는 사용자 지정 가정입니다. 실행용 초안은 소재값 0에서 알람으로 정지합니다. 시뮬레이션은 외경 242 / 내경 230.30의 절삭여유 0인 가상 소재를 사용하며 실제 소재를 뜻하지 않습니다.</p><p>실제 원점/척 물림, T01·T02 보정, 공구 형상·간섭, 회전수의 적합성 및 완성 홈 형상은 검증되지 않았습니다.</p></section>
<div class="actions"><a href="simulator.html?program=O2028">도면 경로 시뮬레이션 · 가상 소재</a><a href="simulator.html?program=O2028_ORIGINAL">제공 원본 시뮬레이션 · 145/126 소재</a><a href="programs/o2028/drawing-draft.txt" download>소재 미입력 초안 TXT</a><a href="programs/o2028/original-set.txt" download>제공 원문 7개 · 참고 TXT</a></div>
<section><h2>도면에 맞춘 설정</h2><div class="scroll"><table><thead><tr><th>항목</th><th>변수</th><th>제공 파일</th><th>도면 설정</th></tr></thead><tbody>'''+table+'''</tbody></table></div><p>벽 두께 5.9 −0.03/−0.07 → 5.83~5.87mm. 외경이 242mm일 때 내경 범위는 230.26~230.34mm이며 중간값 230.30을 적용했습니다. 괄호 안 Ø230.2는 참고치수입니다. 외경 실측에 따라 내경 목표도 벽 두께와 함께 관리해야 합니다.</p><p>홈 깊이는 직경 감소값을 쓰므로 #120=3.70입니다. #121=2.50은 공구 기준점의 Z 이동량입니다. 홈 바닥 폭 2.5와 경사면은 보링바 홈날 폭·노즈R·보정 기준에 따라 달라지므로 이 값만으로 도면 완성 형상을 보증하지 않습니다. (3.75)는 폭 10의 참고 어깨 치수로, 완성 폭 9.87일 때 단순 대칭 계산은 3.685입니다.</p></section>
<section><h2>원문과 확인할 차이</h2><ul><li>최신 제공한 CNC_기술자료 7개 파일을 기준으로 했으며 원문 파일을 별도 보존했습니다.</li><li>사진의 #100=254와 달리 제공 파일은 #100=270입니다. 원점 길이는 제공 파일의 270을 유지했습니다.</li><li>사진에는 #122/#123 및 M55가 있지만 최신 메인에는 없습니다. 임의로 추가하지 않았습니다.</li><li>#119는 주석상 홈 ON/OFF이지만 제공 O6003은 이 변수를 검사하지 않아 홈 가공이 항상 실행됩니다.</li><li>사진/파일의 면취 수치가 다릅니다. 제공 파일 #107=0.60, #108=0.40, #109=0, #110=0.60을 유지했습니다. 도면에 명시된 면취 치수로 확인된 값은 아닙니다.</li><li>RPM 1600과 이송은 제공값 유지이며, 외경 242mm 및 CN10에 적합하다고 판정한 값이 아닙니다.</li><li>도면 설정에서 피치 11.87mm, 4개씩 5묶음+잔량 2개=22개. 최대 묶음 보링 47.48mm, 절단 끝 기준 원점까지 8.86mm. 실제 척 간섭 여유와는 다릅니다.</li><li>O6001과 O6002의 G4 X0.5 대기, 공압 M53/M54 및 절단 후 X 먼저 후퇴 → W10 순서를 그대로 유지합니다.</li></ul></section>
<section><h2>도면</h2><img src="programs/o2028/evidence/4.png" alt="제일연마 230.2X242X10 도면"></section>
<section><h2>프로그램별 코드 · O번호가 1행</h2>'''+codes+'''</section><section><h2>사진 원문</h2><div class="evidence">'''+''.join(f'<a href="programs/o2028/evidence/{i}.png"><img src="programs/o2028/evidence/{i}.png" alt="CNC 사진 {i}" loading="lazy"></a>' for i in range(1,4))+'''</div></section></main><script src="machine-programs.js"></script><script src="machine-programs-ui.js"></script></body></html>'''
(ROOT/'o2028.html').write_text(page,encoding='utf-8')
print('Built preserved originals, guarded draft, virtual drawing simulation and S3 page')
