/* Manufacturer documentation describes family capabilities, not installed machine options. */
(()=>{
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const profiles={
    'smart-plus':{
      scope:'현대위아 장비용 표기입니다. 내부 FANUC 세부 모델은 미확인이며 0i-TF Plus 등으로 환산하지 않습니다.',
      features:[
        ['작업 지원','현대위아 Smart Plus 사양표에는 SmartGuide-i 대화형 프로그램 작성과 그래픽 표시 기능이 안내돼 있습니다.'],
        ['파일 전송·보관','CF 카드·USB 메모리·내장 Ethernet과 자동 데이터 백업 기능이 사양표에 포함돼 있습니다.'],
        ['상태 확인','알람·조작 이력, 가동시간·생산수량, 주축·서보 부하를 확인하는 화면을 안내합니다.']
      ],
      sources:[['현대위아 L600/700/800 카탈로그 · 제어기 사양 p.32–33','https://machine.hyundai-wia.com/upload/product/pdf/L800%20Series%28en%29.pdf']]
    },
    '0i-tb':{
      scope:'0i 계열 Model B의 선반용 제어기입니다. 아래 축 수는 시리즈 사양으로, 4호기의 실제 축 수를 뜻하지 않습니다.',
      features:[
        ['기본 구성','FANUC Model B 소개 자료는 최대 제어 4축·주축 2대 구성을 안내합니다.'],
        ['프로그램 작성 보조','MANUAL GUIDE 0i 옵션은 선반 사이클·윤곽 입력과 G/M 코드 도움말을 제공합니다.'],
        ['통신 옵션','Ethernet은 해당 자료에서 옵션으로 구분됩니다. 4호기의 장착 여부는 미확인입니다.']
      ],
      sources:[['FANUC 0i/0i Mate Model B 소개 자료 · 슬라이드 5–9 (공개 사본)','https://www.slideshare.net/slideshow/introduce-series-0-i-b-0ifanuci-0ib/13249303']]
    },
    '0i-tc':{
      scope:'0i 계열 Model C의 선반용 제어기입니다. B·C·D는 모델 구분이며, 이름만으로 면취 전환 시간을 계산할 수는 없습니다.',
      features:[
        ['매크로 가공','0i-TC 매뉴얼은 변수·연산·조건 분기를 사용하는 커스텀 매크로를 설명합니다. 수량과 치수를 계산해 반복 가공하는 프로그램에 쓰입니다.'],
        ['작업·통신 확장','Model C 자료에는 MANUAL GUIDE i와 Ethernet/Data Server 보드 관련 기능이 안내돼 있습니다. 실제 사용 가능 여부는 장착 옵션을 따릅니다.']
      ],
      sources:[['FANUC B-64114EN/01 · §15 커스텀 매크로 (공개 사본)','https://cncmanuals.com/fanuc/743/0i-tc-operators-manual/page/280'],['FANUC B-64120EN/02 · 관련 매뉴얼 p-2 (공개 사본)','https://www.drivesul.com.br/template/imagens/manuais/manuais-fanuc/fanuc-series-0i-model-c/Series%200i-Model%20C%20-%20Parameter%20Manua.pdf']]
    },
    '0i-td':{
      scope:'0i 계열 Model D의 선반용 제어기입니다. 5·6·11호기가 같은 시리즈여도 공구 배치와 M코드는 각 호기 자료를 따릅니다.',
      features:[
        ['경로 제어','FANUC는 내부 계산·보간에 나노미터 분해능을 적용한 Nano CNC로 소개합니다. 완성품의 가공 정밀도가 나노미터라는 뜻은 아닙니다.'],
        ['통신·가공 지원','시리즈 자료에 100Mbps Ethernet, 메모리 카드, 고정 사이클·커스텀 매크로와 대화형 가공 지원이 안내돼 있습니다.'],
        ['정지 상태 진단','0i-D 정비 매뉴얼의 FIN은 보조기능 완료 대기, INPOSITION CHECK는 축 위치 도달 확인을 구분하는 단서입니다. 이것만으로 특정 M코드를 원인으로 확정하지는 않습니다.']
      ],
      sources:[['FANUC 0i-D 카탈로그 · 통신·Nano CNC (공개 사본)','https://www.scribd.com/document/337274990/mba-004-en-07-1308-0id-med'],['FANUC B-64305EN/01 · §1.3–1.4 진단·상태 표시 (공개 사본)','https://www.scribd.com/document/478553866/B-64305EN-01-Maintenance-Manual-0i-D']]
    },
    'i-series':{
      scope:'현대위아 장비용 표기입니다. 이 명칭만으로 0i의 세부 모델이나 Smart Plus와의 처리 속도 차이를 확정할 수 없습니다.',
      features:[
        ['프로그램 입출력','현대위아 L300의 i Series 사양 예에는 RS-232C·CF 카드·USB·내장 Ethernet이 안내돼 있습니다.'],
        ['현대위아 작업 지원','같은 카탈로그는 HW-MCG 운전·정비 안내, HW-eDNC 프로그램 전송, HW-MMS 장비 상태 모니터링을 소개합니다.'],
        ['호기별 구성','카탈로그의 대표 기능이며 7·8·9·10호기에 모두 설치됐다는 뜻은 아닙니다. 세부 모델·옵션은 아직 미확인입니다.']
      ],
      sources:[['현대위아 L300 카탈로그 · Smart System p.14–15 (공개 사본)','https://machinery.venten.ee/wp-content/uploads/2019/01/07.-L300-Serieseng-Ver2.pdf'],['현대위아 L300 카탈로그 · i Series 사양표 (공개 사본)','https://www.wardcnc.com/wp-content/uploads/2024/01/Hyundai-Wia-L300-Series-Machine-Catalogue%5E-2.pdf']]
    },
    '21i-t':{
      scope:'21i 계열의 선반용 표기입니다. 15호기의 A/B 접미사는 미확인입니다. 아래는 21i-TB 매뉴얼의 기능 예이며 15호기 탑재 사양 확정은 아닙니다.',
      features:[
        ['선반 반복 사이클','21i-TB 매뉴얼은 황삭·정삭·나사 가공용 반복 사이클과 주속 일정 제어를 설명합니다.'],
        ['공구 보정','공구 형상·마모 보정을 구분하고 T 코드에 의한 보정 선택을 설명합니다. 실제 호기의 보정 번호 방식은 따로 확인해야 합니다.'],
        ['세부 모델 확인 기준','접미사가 확인되면 해당 모델의 매뉴얼로 기능을 구체화합니다. 21i-T를 0i-T 계열의 한 세대로 분류하지 않습니다.']
      ],
      sources:[['FANUC 21i-TB B-63604EN · §13.2 사이클·§14.1 보정 (공개 사본)','https://manualmachine.com/fanuc/21itb/4715018-operators-manual/']]
    }
  };
  function description(key){
    const p=profiles[key];
    return '<p class="controller-scope">'+esc(p.scope)+'</p><dl class="controller-features">'+p.features.map(([title,body])=>'<div><dt>'+esc(title)+'</dt><dd>'+esc(body)+'</dd></div>').join('')+'</dl><p class="controller-source-label">제조사 자료 · 실제 탑재 기능과 옵션은 호기별로 다릅니다.</p><ul class="controller-sources">'+p.sources.map(([label,url])=>'<li><a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label)+'</a></li>').join('')+'</ul>';
  }
  function render(container,m){
    container.innerHTML='<section class="controller-card" data-controller="'+m.controllerKey+'"><h3>'+esc(m.controller)+'</h3><p class="controller-meta">장비 제조사: '+esc(m.maker||'미확인')+' · '+m.controllerReceived+' 사용자 확인</p><details><summary>이 시리즈의 특징·근거 보기</summary>'+description(m.controllerKey)+'</details></section>';
  }
  function overview(container){
    container.innerHTML='<h2>제어기 시리즈별 특징</h2><p>1–15호기 등록 · 0i의 첫 글자는 숫자 0입니다.</p>'+SoltriPrograms.controllerGroups.map(g=>'<details class="controller-card" data-controller="'+g.key+'"><summary>'+esc(g.label)+'<small>'+g.units.join('·')+'호기</small></summary>'+description(g.key)+'</details>').join('')+'<p class="controller-scope">M코드의 동작·완료 신호는 기계 제작사의 설정을 따릅니다. 제어기 이름만으로 현재 약 0.8초 멈칫의 원인을 확정하거나 시뮬레이터에 대기 시간을 추가하지 않습니다.</p>';
  }
  window.SoltriControllerUI={render,overview};
})();
