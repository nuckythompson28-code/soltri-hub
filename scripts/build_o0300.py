"""Build a photo-based reference, not a controller-ready CNC export.

CHUNKS are manually transcribed from the five supplied CNC photos.
Keep the clipped #513 line incomplete; never reconstruct it from another program.
"""
from pathlib import Path
from html import escape
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'programs/o0300'
CHUNKS = [
    ('O0300', '01-main.jpg', '메인 입력', '''O0300 (MAIN PROGRAM);
N1;
#120=14 (HOW MANY);
#101=115 (WORK DIA OD);
#102=103 (WORK DIA ID);
#103=109.90 (CUTTING DIA OD);
#104=105 (CUTTING DIA ID);
#105=14.83 (CUTTING LENGTH);
#106=1.95 (BITE SIZE);
#107=3 (CUTTING COUNTER);
#108=1600 (T01 MIN RPM);
#109=1600 (T01 MAX RPM);
#110=0.11 (T01RPM);
#111=1600 (T02 MIN RPM);
#112=1600 (T02 MAX RPM);
#113=0.10 (T02 RPM);
#114=1600 (T03 MIN RPM);
#115=1600 (T03 MAX RPM);
#116=0.08 (T03 FEED);
#117=0 (WORK LENGTH SETTING);
#118=0 (WORK RETRACT USE=1);
#119=0.47 (BACK CHAMBER VALUE);
#100=254 (MATERIAL LENGTH);
#124=0
(0=NORMAL MODE 1=MANUAL MODE);
M98 P0310;
M30;
%'''),
    ('O0310', '02-setup.jpg', '초기 계산·페이스 진입', '''O0310 (G100 FULL CUTTING);
#500=0 (W.SHIF ORIGIN);
#501=#101+5.;
#502=#102-2.;
#503=#103+1.;
#504=#104-2.;
#505=#105+#106;
#506=[#105+#106]*#107;
IF[#506 LT 60] GOTO 12;
N11 #3000=1
(ERROR: #506 EXCEEDS 60, DOWN #107)
;
N12;
#507=#506+0.5;
#508=[#103+#104]/2.;
#511=[#109-#108]/FIX[#100/#506];
#512=[#112-#111]/[FIX[#100/#505]-1];
#513=[#115-#114]/[FIX[#100/#505]-1 [사진 오른쪽 잘림: 줄 끝 미확인]
#514=#108;
#515=#111;
#516=#114;
#100=#120*#505+0.1;
IF[#124 EQ 1] GOTO 88;
IF[#100 GT 200] GOTO 88;
#3000=2 (UP #120 HOWMANY);
N88;
G10 L2 P0 Z[#100];
G30 U0 W0 M56;
N200 (FACE CUTTING);
G00 W5. M56;
G00 X-[#501] T03;
Z0.;
M00;
N201 (ROUGH CUT);'''),
    ('O0310', '03-boring-chamfer.jpg', '페이스·묶음 보링·면취', '''G00 Z[#105+#106+10] T01;
G97 G00 X[#103+1] S#514;
G98 G01 Z0 F[#514*0.15] M03;
G00 Z[#105+#106+10];
N202 (MARKING);
G00 X-[#501] T03;
Z[[#105+#106]/3];
G97 S#516 M03;
G98 G01 X-[#103];
N203;
G00 X-[#501] T03;
Z0;
G97 S#516 M03;
G98 G01 X-[#502] F[#516*#116] M57;
G00 U[-20.] T03 M58;
G00 W[3.03] T03;
N310 (T01 MULTI TOOL);
#520=0;
#521=0;
#522=0;
G97 G00 X#103 S#514 M03 T01;
Z2. M54;
G98 G01 Z-[#507] F[#514*#110];
M53;
G04 X0.5;
U0.15;
G00 Z20.;
M54;
#514=#514+#511;
N320 (T02 CHAMFER TOOL);
G97 G00 X-[#508] S#515 M03 T02;
Z[2-#521] M55;
G98 G01 Z-[#521] F[#515*#113];
G00 W10. M56;'''),
    ('O0310', '04-parting-remainder.jpg', '면취 후 절단·잔량 계산', '''#515=#515+#512;
#521=#521+#505;
N330 (T03 CUTTING TOOL);
#522=#522+#505;
M56;
N331;
G97 G00 X-[#503] S#516 M03 T03;
Z-[#522-#119];
G98 G01 X-[#103] F[#516*#116];
X-[#103-[#119*2]] Z-[#522];
X-[#504] M57;
G00 X-[#101+10.];
W[#505+20.] M58;
#516=#516+#513;
M12;
N341;
#520=#520+1;
IF[#520 NE #107] GOTO 320;
#500=#500+#506;
G10 L2 P0 W-[#506];
IF[[#500+#506]LT#100] GOTO 310;
N400 (LAST CUTTING);
#530=#100-#500;
#531=FIX[#530/#505];
#532=[#531*#505]+0.5;
IF[#531 LT 1] GOTO 450;
N410 (T01 MULTI TOOL);
#520=0;
#521=0;
#522=0;
G97 G00 X#103 S#514 M03 T01;
Z2. M54;
G98 G01 Z-[#532] F[#514*#110];
M53;'''),
    ('O0310', '05-remainder-exit.jpg', '잔량 면취·절단·종료', '''G04 X0.5;
U0.2;
G00 Z20.;
N420 (T02 CHAMFER TOOL);
G97 G00 X-[#508] S#515 M03 T02;
Z[2.-#521] M55;
G98 G01 Z-[#521] F[#515*#113];
G00 W10. M56;
#515=#515+#512;
#521=#521+#505;
N430 (T03 CUTTING TOOL);
#522=#522+#505;
M56;
N431;
G97 G00 X-[#503] S#516 M03 T03;
Z-[#522-#119];
G98 G01 X-[#103] F[#516*#116];
X-[#103-[#119*2]] Z-[#522];
X-[#504] M57;
G00 X-[#101+10.];
W[#505+20.] M58;
#516=#516+#513;
M12;
N441;
#520=#520+1;
IF[#520 LT #531] GOTO 420;
N450;
G30 U0 W0 M5;
G10 L2 P0 Z0;
M99;
%'''),
]

def value(source, number):
    return float(re.search(r'^#'+str(number)+r'=([0-9.]+)', source, re.M).group(1))

def block(source, start, end):
    return source[source.index(start):source.index(end, source.index(start))].strip()

def embedded(source, program):
    match = re.search(r'<script type="text/plain" id="src-'+program+r'">(.*?)</script>',source,re.S)
    if not match:
        raise ValueError('Missing embedded CNC source: '+program)
    return match.group(1)

def build():
    DEST.mkdir(parents=True, exist_ok=True)
    main2 = CHUNKS[0][3]
    main5 = (ROOT/'programs/o0600/O0600.nc').read_text(encoding='ascii')
    sub5 = (ROOT/'programs/o0600/O9050.nc').read_text(encoding='ascii')
    page8 = (ROOT/'o8000.html').read_text(encoding='utf-8')
    main8, sub8 = embedded(page8,'O8000'), embedded(page8,'O9010')
    rpm2, feed2 = value(main2,111), value(main2,113)
    rpm5, feed5 = value(main5,111), value(main5,113)
    rpm8, feed8 = value(main8,111), value(main8,113)
    speed2, speed5, speed8 = rpm2*feed2, rpm5*feed5, rpm8*feed8
    t2, t5, t8 = 2/speed2*60, 2/speed5*60, 2/speed8*60
    summary = f'면취 이송은 2호기 {speed2:g} mm/min, 5호기 {speed5:g} mm/min, O8000 {speed8:g} mm/min입니다. 현재 5호기와 O8000의 면취 이송·Z 접근·후퇴 방식은 같습니다. 2호기의 이송속도는 두 등록본보다 약 {(speed2/speed5-1)*100:.1f}% 높고, Z 2 mm 이송의 이상적인 시간 차이는 약 {t5-t2:.3f}초입니다.'
    basis8 = 'O8000 비교는 김공장 o8000.html에 등록된 6호기 기준 O8000/O9010 원문입니다. 3호기에도 같은 자료가 연결돼 있지만, 이번에 3호기 CNC에서 별도로 가져온 코드·실제 설정을 확인한 것은 아닙니다.'
    observation = '사용자 관찰: 2호기는 바로 절단으로 넘어가며, 3·5·6호기는 약 0.8초 멈칫한 뒤 절단으로 넘어갑니다. 이때 T2는 이미 들어갔고 공구대가 멈춰 있습니다. 선택정지는 OFF입니다. 추가로 5호기에서 M01을 삭제했지만 지연은 그대로였다고 확인했습니다.'
    hypothesis = '5호기의 M01 삭제 시험 결과: 변화 없음. 따라서 M01 하나가 원인이라는 가설은 이번 시험으로 지지되지 않습니다. 사용자는 G00 W10. M55;까지 부드럽게 동작하고, 그 뒤 #521 증가 → N330 → #516 계산 → #522 증가 → 첫 X/T03 이동 사이에서 멈칫한다고 범위를 좁혔습니다. 어느 명령의 내부 처리가 기다리는지는 아직 확인되지 않았습니다. 3·6호기에서 M01 삭제를 시험한 결과는 아닙니다.'
    exclusions = '앞서 계산한 0.833초는 Z 2 mm를 G01로 이동하는 시간이며, 복귀 후 정지한 채 기다리는 약 0.8초와 별개입니다. T2의 실제 복귀 이동 시간도 이번 정지 구간과 구분합니다. 5호기만의 추가 X 이동·계산 재배치는 3·6호기와 공통으로 생기는 정지의 단독 원인으로 보기 어렵습니다.'
    controller_basis = '지금 전달된 CNC 순서는 9월 10일 계산 위치를 옮기기 전 원문과 대응합니다. 현재 앱·바탕화면의 등록본은 #516/#522를 면취 전에, #521을 W10 전에 계산하므로 실제 CNC에 적용됐다고 간주하지 않습니다. 사용자는 첫 X 줄이 G00 X-[#503] T03;이고 S#516 M03는 그 뒤 Z 이동 다음 X 접근 줄에 있음을 추가 확인했습니다. 아래는 사용자 전달 순서를 이전 원문과 대조해 기호를 정리한 참고자료이며, CNC에서 직접 추출한 파일은 아닙니다.'
    generation = '2026-09-11 사용자 확인: 2호기는 현대위아 FANUC i Series Smart Plus, 3호기는 현대위아 FANUC Series 0i-TC, 5·6호기는 FANUC Series 0i-TD입니다. Smart Plus의 내부 FANUC 세부 모델은 미확인입니다. 제어기의 블록 처리·선행 해석 성능이나 기계 측 완료 처리 차이를 검토하되, 모델명만으로 계산 세 줄에 0.8초가 걸린다고 단정하지 않습니다.'
    controller_manual = 'https://www.scribd.com/document/478553866/B-64305EN-01-Maintenance-Manual-0i-D'
    read_only_checks = [
        '멈칫하는 동안 화면 상태표시의 FIN을 봅니다. 0i-D 매뉴얼에서 FIN은 PMC의 보조기능 완료 신호를 기다리는 상태입니다. 정지 구간에 FIN이 계속 표시되면 M/T 등의 완료 대기를 확인할 근거가 됩니다. FIN만으로 M55와 T03 중 어느 명령인지까지 구분되지는 않습니다.',
        '진단 화면(DGNOS)의 진단 0, CNC internal state 1에서 INPOSITION CHECK를 봅니다. 1이면 축의 위치 도착 확인 중입니다. W10 움직임이 눈으로 끝나 보여도 CNC의 위치 완료 확인이 끝났는지 별도로 확인할 수 있습니다.',
        'FIN이 보이지 않고 INPOSITION CHECK도 0이어도 계산 지연으로 확정하지 않습니다. 블록·매크로 처리와 다른 대기 상태를 이어서 확인합니다. 0.8초가 짧아 읽기 어려우면 정상 운전 중 화면을 촬영해 멈춘 구간과 표시 시간을 대조할 수 있습니다.',
    ]
    read_only_diagnosis = '<div class="panel" id="controller-checks"><h3>5호기 0i-TD에서 코드 변경 없이 볼 항목</h3><ol>'+''.join('<li>'+escape(item)+'</li>' for item in read_only_checks)+'</ol><p>화면을 읽는 확인입니다. 진단값·파라미터·PMC 타이머를 편집하지 않습니다. 근거: <a href="'+controller_manual+'">FANUC B-64305EN/01 공개 사본</a>, 적용 모델 표 및 §1.3 진단 기능·§1.4 CNC 상태표시.</p></div>'
    rows = [
        ('공구·가공 방식','T1 내·외경 → T2 면취기 → T3 절단','T1 내·외경 → T2 면취기 → T3 절단','T1 내·외경 → T2 면취기 → T3 절단','세 프로그램 모두 전용 T2가 Z방향으로 들어가 면취합니다.'),
        ('면취 회전수',f'#111=#112={rpm2:g} rpm',f'#111=#112={rpm5:g} rpm',f'#111=#112={rpm8:g} rpm','사진·등록본의 시작/끝 회전수는 모두 1600입니다.'),
        ('면취 이송값',f'#113={feed2:g}',f'#113={feed5:g}',f'#113={feed8:g}',f'G98 F[S×#113] → {speed2:g} / {speed5:g} / {speed8:g} mm/min. 2호기 사진의 #113 주석은 RPM이지만 F 계산에 쓰는 이송값입니다.'),
        ('절삭 이송 구간','Z[2-#521] → Z-[#521]','Z[2.-#521] → Z-[#521]','N320: Z[2-#521] → Z-[#521] / N420도 동일 거리','모두 명령상 Z 2 mm를 G01로 이동합니다. 실제 날 접촉 구간은 공구 세팅에 따라 다릅니다.'),
        ('Z 2 mm 이송 계산',f'{t2:.3f}초',f'{t5:.3f}초',f'{t8:.3f}초','이송 오버라이드 100%, 가감속·공압·급속·정지 시간 제외입니다. 전체 면취 사이클 시간은 아닙니다.'),
        ('면취기 전진 / 복귀','M55 / M56','M56 / M55','M56 / M55 · 앱의 3·6호기 대조표도 동일','5호기와 O8000은 면취 M코드가 같습니다. 2호기는 전진/복귀 번호가 반대입니다.'),
        ('면취 후 후퇴','G00 W10. M56;','G00 W10. M55;','G00 W10. M55;','모두 Z +10 mm 급속 후퇴와 면취기 복귀를 같은 블록에 지시합니다. 실제 병행 동작/완료 대기는 장비 제어에 따릅니다.'),
        ('면취→절단 사이 M01','없음','등록본에는 있음 · 선택정지 OFF 확인 · 실제 5호기는 삭제해도 지연 동일','#521 증가 뒤 M01; · N320/N420 모두 있음','5호기 M01 삭제 시험은 변화 없음입니다. M01 하나가 원인이라는 가설은 지지되지 않으며 3·6호기의 삭제 시험 결과는 미확인입니다.'),
        ('면취 구간 G04','N320/N420에 없음','N320에 없음','N320/N420에 없음','각 프로그램의 보링 직후 G04는 면취 절삭 블록과 별개입니다.'),
        ('후퇴 뒤 계산·명령','#515 증가 → #521 증가 → N330 → #522 증가 → M56 → T3','등록본: 계산을 앞에 배치 / 사용자 전달 CNC: W10/M55 → #521 증가 → N330 → #516 계산 → #522 증가 → X/T03','#515 증가 → #521 증가/M01 → N330 → #522 증가 → M55/조건문 → N331 → T3','2호기와 O8000도 후퇴 후 계산과 복귀 M코드 재지시가 있습니다. 5호기 실제 CNC의 전달 순서는 등록본과 다릅니다. 줄 개수로 지연 원인을 확정할 수 없습니다.'),
        ('T3 절단 준비 X','#503=#103+1.; → Z 접근 → G01','#503=#103+4.; → Z 접근 → X-[#103+1.] 급속 → G01','#503=#103+1.; → Z 접근 → G01','5호기에만 절단 전 추가 X 급속 접근 블록이 있습니다. 면취 G01 속도 차이와 구분해야 합니다.'),
        ('추가 면취 Z20 후퇴','N320/N420의 W10 뒤에 없음','최신 수정본 N320의 W10 뒤에 없음','N320/N420의 W10 뒤에 없음','이전 5호기 코드에 있었던 G00 Z[-#521+20.];는 현재 비교본에서 삭제된 상태입니다.'),
        ('잔량 면취 경로','N420 → N430','잔량 수량을 계산하고 N320 → N330 재사용','N420 → N430','경로 구성은 다르지만 잔량 면취도 Z 2 mm 이송 후 W10 후퇴입니다.'),
        ('주축 M03 · 앱 대조표','역회전','역회전','6호기: 정회전 / 3호기: 역회전','O8000 원문에는 M03이 있습니다. 같은 O8000 배정이라도 3호기와 6호기의 주축 의미는 다릅니다.'),
        ('에어 ON / OFF · 앱 대조표','M57 / M58','M51 / M52','6호기 원문: M51 / M52 · 3호기: M08 / M09','3호기용 실제 프로그램을 비교하려면 호기별 에어 코드도 대조해야 합니다. 괄호 속 (M57)/(M58)은 주석입니다.'),
        ('CNC 모델 · 사용자 확인','현대위아 FANUC i Series Smart Plus · 내부 세부 모델 미확인','FANUC Series 0i-TD','3호기: FANUC Series 0i-TC / 6호기: FANUC Series 0i-TD','명령 처리 성능·설정 차이를 확인할 단서입니다. 모델명만으로 0.8초의 원인을 계산 처리로 확정하지 않습니다. 호기별 제어기 특징은 김공장 호기 화면에서 확인할 수 있습니다.'),
    ]
    labels = ['비교 항목','2호기','5호기','O8000','해석']
    table = '<div class="tablewrap"><table><thead><tr><th>비교 항목</th><th>2호기 O0300 / O0310</th><th>5호기 O0600 / O9050</th><th>3·6호기 O8000 / O9010<br><small>6호기 원문 기준</small></th><th>해석</th></tr></thead><tbody>'+''.join('<tr>'+''.join('<td data-label="'+label+'">'+escape(c)+'</td>' for label,c in zip(labels,row))+'</tr>' for row in rows)+'</tbody></table></div>'
    chamfer2 = block(CHUNKS[2][3]+'\n'+CHUNKS[3][3], 'N320 (T02 CHAMFER TOOL);', 'Z-[#522-#119];')+'\nZ-[#522-#119];'
    chamfer5 = block(sub5, 'N320 (T02 CHAMFER UNIT);','G98 G01 X-[#103] F[#516*#116];')
    chamfer8 = block(sub8, 'N320(T02 CHAMFER TOOL);','G98 G01 X-[#103]F[#516*#116];')
    remainder8 = block(sub8, 'N420(T02 CHAMFER TOOL);','G98 G01 X-[#103]F[#516*#116];')
    reported_transition = '\n'.join([
        'G00 W10. M55;', '#521=#521+#505;', 'N330 (T03 LOWER PARTING);',
        '#516=#114+#513*#523;', '#522=#522+#505;', 'G00 X-[#503] T03;',
    ])
    registered_transition = block(chamfer5,'G00 W10. M55;','G00 Z[#119-#522];')
    diagnosis_points = [
        '#521 증가: 다음 제품의 면취 Z 위치를 준비합니다. #516 계산: 이번 절단 회전수 값을 준비합니다. #522 증가: 이번 절단 Z 위치를 준비합니다. 이 세 식에는 시간을 지정하는 대기 명령이 없습니다.',
        'N330과 괄호 속 문장은 구간 번호와 설명입니다. 사용자 전달 순서에서 다음 실제 축 이동 명령은 G00 X… T03입니다. 그 앞의 계산 구간에서 멈춰 보인다는 관찰만으로 계산 자체가 0.8초 걸린다고 판단할 수 없습니다.',
        '우선 구분할 대상은 계산 블록 처리, W10/M55 완료 처리, 첫 X/T03 블록 처리입니다. 물리적으로 T2가 들어온 시점과 제어기가 복귀 완료를 확인하는 시점이 같은지는 미확인입니다.',
        'T1·T2·T3가 함께 이동하는 공구대입니다. T03을 회전 공구대의 교환 동작으로 해석하지 않습니다. 이 장비에서 T03이 보정 선택과 어떤 완료 처리를 하는지는 아직 확인되지 않았습니다.',
        '사용자가 첫 X 줄은 G00 X-[#503] T03;라고 확인했습니다. 그 줄에는 S/M03가 없고 #516 대입 자체도 주축 회전수 변경 명령이 아닙니다. 등록본의 결합된 G97/S/M03/T03 줄을 실제 CNC 코드로 대신 읽어 주축 지령 대기라고 판단하지 않습니다.',
        '2호기와 O8000에도 후퇴 후 변수 계산과 T03이 있습니다. 공통으로 존재하는 명령만으로 호기별 지연 차이를 설명할 수는 없습니다. 계산 배치 영향을 비교한다면 좌표·T03·M55까지 동시에 바꾸지 않고 계산 위치 한 요소만 분리해야 합니다. 아직 다음 CNC 수정안을 적용한 것은 아닙니다.',
    ]
    diagnosis = '<section id="pause-diagnosis"><h2>복귀 후 약 0.8초 멈칫 · M01 삭제 결과</h2><p class="lead">'+escape(observation)+'</p><p id="m01-test-result">'+escape(hypothesis)+'</p><p id="controller-generation">'+escape(generation)+'</p>'+read_only_diagnosis+'<p>'+escape(exclusions)+'</p><div class="panel"><h3>지연 구간: W10/M55 다음부터 첫 X/T03 이동까지</h3><p id="controller-basis">'+escape(controller_basis)+'</p><div class="transition-code"><article><h3>사용자 전달 순서 · 이전 원문 대조 표기</h3><pre id="reported-transition">'+escape(reported_transition)+'</pre></article><article><h3>앱 등록본 · 실제 CNC 적용 여부와 구분</h3><pre id="registered-transition">'+escape(registered_transition)+'</pre></article></div><h3>현재 코드로 알 수 있는 점</h3><ul>'+''.join('<li>'+escape(point)+'</li>' for point in diagnosis_points)+'</ul><p>이번 기록은 진단 설명 갱신입니다. 가공 NC·공구 보정·M코드·제어기 설정은 변경하지 않았으며, GitHub Pages 푸시도 하지 않았습니다.</p></div></section>'
    codes, photos = [], []
    transcript = ['2호기 O0300 / O0310 — CNC 화면 사진 전사 참고자료', '사진 수령: 2026-09-11. 공백·화면 줄바꿈은 읽기 좋게 정리했습니다.',
                  'O0310의 #513 계산 줄 끝은 사진 오른쪽에서 잘려 미확인입니다. 표시 부분을 추정해서 채우지 않았습니다.',
                  '이 파일은 사진 대조·분석용이며 CNC에 입력할 실행용 완성본이 아닙니다.', '']
    for i,(program,photo,label,source) in enumerate(CHUNKS,1):
        rendered=[]
        for line in source.splitlines():
            cls=' class="uncertain"' if '사진 오른쪽 잘림' in line else ''
            rendered.append('<span'+cls+'>'+escape(line)+'</span>')
        codes.append(f'<section id="source-{i}" class="panel"><div class="sectionhead"><h3>{program} · {escape(label)}</h3><a href="#photo-{i}">원본 사진 {i} 대조</a></div><pre class="source">{"".join(rendered)}</pre></section>')
        photos.append(f'<figure id="photo-{i}"><a href="programs/o0300/photos/{photo}" target="_blank" rel="noopener"><img src="programs/o0300/photos/{photo}" alt="2호기 CNC 사진 {i}: {escape(label)}" loading="lazy" width="1368" height="1824"></a><figcaption>사진 {i} · {escape(label)} · 클릭하면 원본 크기로 열립니다. <a href="#source-{i}">전사 코드로</a></figcaption></figure>')
        transcript += [f'=== {program} / 사진 {i}: {label} ===',source,'']
    transcript += ['=== 복귀 후 약 0.8초 멈칫: M01 삭제 결과와 남은 진단 구간 ===',
                   observation,'',hypothesis,'',generation,'',
                   '5호기 0i-TD 화면 확인 / 진단값·파라미터 편집 아님',*read_only_checks,
                   '근거: FANUC B-64305EN/01 §1.3·§1.4 (공개 사본)',controller_manual,'',exclusions,'',controller_basis,'',
                   '사용자 전달 순서 / 이전 원문 대조 표기 / CNC 추출 코드 아님',reported_transition,'',
                   '앱 등록본 / 실제 CNC 적용 여부와 구분',registered_transition,'',
                   *diagnosis_points,'이번 진단 기록에서는 가공 NC를 변경하지 않았습니다.','',
                   '=== 2호기 · 5호기 · O8000 면취 비교 ===',summary,'',basis8,'']
    for row in rows:
        transcript += [row[0], '2호기: '+row[1], '5호기: '+row[2], 'O8000 (6호기 원문): '+row[3], '해석: '+row[4],'']
    transcript += ['=== O8000/O9010 묶음 면취 N320 → N330 발췌 ===',chamfer8,'',
                   '=== O8000/O9010 잔량 면취 N420 → N430 발췌 ===',remainder8,'']
    transcript += ['5호기 비교 원문: programs/o0600/O0600.nc + O9050.nc (2026-09-10 수정본)',
                   'O8000 비교 원문: o8000.html 내 src-O8000 / src-O9010 (6호기 기준 등록본)',
                   '실제 장비의 이송/급속 오버라이드, 공압 전후진 시간, M코드 완료 대기는 사진만으로 확인할 수 없습니다.','']
    (DEST/'photo-transcript.txt').write_bytes('\r\n'.join('\n'.join(transcript).split('\n')).encode('utf-8-sig'))
    inputs = [('총 수량 #120','14개'),('소재 외경/내경 #101/#102','115 / 103 mm'),('제품 외경/내경 #103/#104','109.90 / 105 mm'),('제품 길이/날 폭 #105/#106','14.83 / 1.95 mm'),('묶음 수량 #107','3개'),('T1 회전수/이송','1600 rpm / 0.11'),('T2 회전수/이송','1600 rpm / 0.10'),('T3 회전수/이송','1600 rpm / 0.08'),('뒤쪽 면취 #119','0.47 mm'),('사진의 #100 초기값','254 mm → O0310에서 14 × 16.78 + 0.1 = 235.02 mm로 다시 계산')]
    page='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>2호기 O0300 · O0600·O8000 면취 비교 — 김공장</title><link rel="stylesheet" href="machine-programs.css"><link rel="stylesheet" href="o0300.css"></head>
<body><main id="main"><header><a href="machines.html#m2">← 2호기 프로그램</a><h1>O0300 · 2호기 실사용 프로그램</h1>
<p class="subtitle">O0300 메인 + O0310 서브 · T1 내·외경 / T2 면취 / T3 절단 · 사진 수령 2026-09-11</p>
<nav class="actions" aria-label="페이지 목차"><a href="#pause-diagnosis">0.8초 멈칫 · M01 삭제 결과</a><a href="#compare">5호기·O8000 면취 비교</a><a href="#O0300">메인 입력</a><a href="#O0310">전체 전사 코드</a><a href="#photos">원본 사진 5장</a><a href="programs/o0300/photo-transcript.txt" download>↓ 사진 전사·비교 TXT</a><button id="print">인쇄</button></nav>
<p class="notice">CNC 화면 사진을 읽어 등록한 자료입니다. <b>O0310의 #513 계산 줄 끝이 잘려 있습니다.</b> 해당 부분은 전사 코드에 표시했고 임의로 보완하지 않았습니다. TXT는 사진 대조용이며 CNC 입력용 완성본이 아닙니다.</p></header>
''' + diagnosis + '''<section id="compare"><h2>2호기 · 5호기 · O8000 면취 비교</h2><p class="lead">''' + escape(summary) + '''</p>
<p id="o8000-basis">''' + escape(basis8) + ''' <a href="o8000.html?machine=3">3호기 배정 원문</a> · <a href="o8000.html?machine=6">6호기 배정 원문</a></p>
<div class="metrics"><article><small>2호기 · O0300 사진 설정</small><strong>''' + f'{speed2:g}' + ''' <span>mm/min</span></strong><p>''' + f'{rpm2:g} rpm × {feed2:.2f} · Z 2 mm: {t2:.3f}초' + '''</p></article><article><small>5호기 · O0600 현재 등록본</small><strong>''' + f'{speed5:g}' + ''' <span>mm/min</span></strong><p>''' + f'{rpm5:g} rpm × {feed5:.2f} · Z 2 mm: {t5:.3f}초' + '''</p></article><article><small>3·6호기 배정 O8000 · 6호기 원문</small><strong>''' + f'{speed8:g}' + ''' <span>mm/min</span></strong><p>''' + f'{rpm8:g} rpm × {feed8:.2f} · Z 2 mm: {t8:.3f}초' + '''</p></article></div>
<p class="subtitle">Z 2 mm 시간은 이송 오버라이드 100%, 가감속·급속·공압·정지를 제외한 계산값입니다.</p>
<p><b>세 프로그램의 T2 면취 방식은 같습니다.</b> T2를 X 위치에 놓고, 면취기 전진과 Z 2 mm 앞까지의 급속 접근을 같은 블록에 지시한 뒤, G01로 2 mm 들어가고 W10으로 빠집니다. 5호기와 O8000 사이에는 이 면취 이송·거리·M코드의 차이가 없습니다.</p>
<p class="notice"><b>사용자 확인: 선택정지는 OFF이며, 5호기 M01 삭제 후에도 지연은 그대로입니다.</b> 아래 5호기 원문은 앱 등록본입니다. 이번에 전달된 실제 CNC의 계산 위치·첫 T03 줄과 차이가 있어 위 진단 기록에 따로 표시했습니다.</p>''' + table + '''
<div class="compare"><article><h3>2호기 · 사진의 N320 → N330</h3><pre>''' + escape(chamfer2) + '''</pre><a href="#photo-3">사진 3</a> · <a href="#photo-4">사진 4</a></article><article><h3>5호기 · O9050 N320 → N330</h3><pre>''' + escape(chamfer5) + '''</pre><a href="o0600.html#O9050">5호기 설명·원문 보기</a></article><article><h3>O8000 · O9010 N320 → N330</h3><pre id="o8000-chamfer">''' + escape(chamfer8) + '''</pre><a href="o8000.html?machine=6#O9010">6호기 기준 원문 보기</a></article></div>
<details class="panel" id="o8000-remainder"><summary>O8000 잔량 면취 N420 → N430 원문</summary><p>N320과 동일한 Z 2 mm 면취 → W10 복귀 방식입니다. 아래 괄호 속 M57/M58은 주석입니다.</p><pre>''' + escape(remainder8) + '''</pre></details>
<div class="panel"><h3>실제 빠른 구간을 구분해서 보면 원인이 좁혀집니다</h3><ol>
<li><b>날이 소재로 들어가는 G01 구간:</b> 2호기 사진은 160 mm/min, 5호기와 O8000 등록본은 모두 144 mm/min입니다. 실제 장비 #111/#112/#113과 이송 오버라이드가 등록본과 같은지 대조하면 됩니다.</li>
<li><b>T2 복귀 후 약 0.8초 멈춘 구간:</b> 5호기 M01 삭제 시험은 변화 없음입니다. 사용자가 좁혀 준 W10/M55 이후 계산과 첫 X/T03 이동 사이를 진단합니다. 계산 처리·이전 복귀 완료 처리·다음 T03 처리를 구분할 근거는 아직 부족합니다.</li>
<li><b>급속으로 접근·후퇴하는 구간:</b> G00 속도는 #113으로 결정되지 않습니다. 추가 X 이동은 5호기에만 있어, 3·5·6호기의 공통 정지를 설명하는 단독 원인으로 보기 어렵습니다.</li>
</ol><p>이 비교는 2호기 사진, 2026-09-10 수정한 5호기 등록본, 6호기 기준 O8000/O9010 등록본을 대조한 결과입니다. 현재 각 CNC의 코드·보정값·공압 시간까지 실측한 결과는 아닙니다.</p></div></section>
<section id="O0300"><h2>메인 입력 · 사진 그대로</h2><div class="tablewrap"><table><thead><tr><th>항목</th><th>사진 값</th></tr></thead><tbody>''' + ''.join('<tr><td>'+escape(k)+'</td><td>'+escape(v)+'</td></tr>' for k,v in inputs) + '''</tbody></table></div>
<p>피치 16.78 mm, 정상 묶음 3개 × 4회 + 잔량 2개 구성입니다. 사진 속 주석의 T01RPM / T02 RPM은 원문에 유지했으며, #110 / #113은 각각 F 계산에 쓰입니다.</p>''' + codes[0] + '''</section>
<section id="O0310"><h2>O0310 · 사진에서 읽은 전체 코드</h2><p>사진의 왼쪽 열 다음에 오른쪽 열을 이어 읽었습니다. 공백·화면 줄바꿈만 정리했으며, 노란색 줄은 잘려서 끝을 확인하지 못한 부분입니다.</p>''' + ''.join(codes[1:]) + '''</section>
<section id="photos"><h2>원본 사진</h2><div class="photos">''' + ''.join(photos) + '''</div></section>
<footer><p>2호기 기존 O0400 자료는 2호기 화면의 “기존 배정 자료”에 보관합니다. 13호기의 O0400은 기존 배정 자료로 보관합니다.</p></footer>
</main><script>document.getElementById('print').onclick=()=>window.print();</script><script src="machine-programs.js"></script><script src="machine-programs-ui.js"></script></body></html>
'''
    page=page.replace('</head>','<link rel="stylesheet" href="ui.css"><script src="ui.js" defer></script></head>',1).replace('<body>','<body class="kim-ui kim-doc">',1)
    (ROOT/'o0300.html').write_text(page,encoding='utf-8',newline='\n')
    provenance = {'received':'2026-09-11','kind':'manual photo transcription, incomplete #513 ending',
                  'photos':{photo:hashlib.sha256((DEST/'photos'/photo).read_bytes()).hexdigest() for _,photo,_,_ in CHUNKS},
                  'comparison':{name:hashlib.sha256((ROOT/'programs/o0600'/name).read_bytes()).hexdigest() for name in ['O0600.nc','O9050.nc']},
                  'o8000_reference':{'file':'o8000.html','sha256':hashlib.sha256((ROOT/'o8000.html').read_bytes()).hexdigest(),'programs':['O8000','O9010'],'reference_machine':'6','assigned_machines':['3','6']}}
    (DEST/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'built':['o0300.html','programs/o0300/photo-transcript.txt'],'feed_mm_min':[speed2,speed5,speed8],'ideal_seconds':[t2,t5,t8]},ensure_ascii=False))

if __name__=='__main__':
    build()
