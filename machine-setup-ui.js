/* Shared read-only equipment information for the machine page and simulator. */
(()=>{
  'use strict';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(container,key){
    const setup=globalThis.SoltriMachineSetups?.[key];
    if(!setup){container.replaceChildren();container.hidden=true;return;}
    container.hidden=false;
    container.innerHTML='<section class="machine-setup" aria-label="5호기 장비 정보">'+
      '<h3>5호기 장비 정보</h3><p class="setup-controller">'+esc(setup.controller)+'</p>'+
      '<p>공구 형상 보정 · '+setup.received+' 제공한 CNC 화면 기준</p>'+
      '<div class="setup-geometry-cards">'+Object.entries(setup.geometry).map(([n,g])=>
        '<article data-geometry-tool="'+n+'"><b>T0'+n+' · '+g.label+'</b><dl>'+
        ['X','Z'].map(axis=>'<div><dt>'+axis+'</dt><dd>'+g[axis].toFixed(3)+'</dd></div>').join('')+
        '</dl><small>반경 '+g.radius.toFixed(3)+' · TIP '+g.tip+'</small></article>').join('')+'</div>'+
      '<p class="setup-basis">T03 기준 상대 위치: T01은 위 '+setup.tips[1].r.toFixed(3)+'mm · 앞 '+(-setup.tips[1].z).toFixed(3)+'mm, T02는 위 '+setup.tips[2].r.toFixed(3)+'mm · 앞 '+(-setup.tips[2].z).toFixed(3)+'mm입니다. 높이는 X 보정값 차이의 절반으로 표시합니다.</p>'+
      '<p class="setup-basis">시뮬레이터는 X 직경값과 좌표계 이동 방식으로 형상 보정을 적용합니다(제어기의 보정 방식 설정은 미확인). T02의 전진 작업 위치를 기준으로 표시'+
      (setup.t2DatumConfirmed?'합니다.':'합니다(전진 기준 여부 확인 전).')+' 마모 보정은 포함하지 않습니다.</p>'+
      '<p class="setup-basis">공구 간격은 형상 보정값을 사용합니다. 홀더 외형·공압 복귀 거리·재생 시간은 개략 표현입니다.</p>'+
      '<div class="setup-links"><a href="'+setup.photo+'" target="_blank" rel="noopener">형상 보정 원본 사진</a><a href="simulator.html?program=O0600">이 설정으로 가공 보기</a></div></section>';
  }
  globalThis.SoltriMachineSetupUI={render};
})();
