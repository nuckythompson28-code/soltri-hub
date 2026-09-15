/* Relative grid positions transcribed from the user's factory plan, 2026-09-11. */
(()=>{
  'use strict';
  const layout={
    columns:11,rows:23,
    source:'docs/evidence/factory-layout-20260911.png',
    aisle:{x:0,y:11,w:11,h:1},
    machines:[
      {no:'1',x:4,y:12,w:1,h:2}, {no:'2',x:4,y:15,w:1,h:2},
      {no:'3',x:4,y:18,w:1,h:2}, {no:'4',x:0,y:12,w:1,h:2},
      {no:'5',x:0,y:15,w:1,h:2}, {no:'6',x:0,y:18,w:1,h:2},
      {no:'7',x:5,y:22,w:2,h:1}, {no:'8',x:8,y:22,w:2,h:1},
      {no:'9',x:10,y:18,w:1,h:2}, {no:'10',x:7,y:17,w:2,h:1},
      {no:'11',x:10,y:9,w:1,h:2}, {no:'12',x:10,y:6,w:1,h:2},
      {no:'13',x:10,y:3,w:1,h:2}, {no:'14',x:7,y:3,w:1,h:2},
      {no:'15',x:10,y:0,w:1,h:2}
    ]
  };
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const position=p=>'left:'+(p.x/layout.columns*100)+'%;top:'+(p.y/layout.rows*100)+'%;width:'+(p.w/layout.columns*100)+'%;height:'+(p.h/layout.rows*100)+'%';
  function render(container){
    container.innerHTML='<section class="factory-layout" aria-labelledby="layout-heading"><div class="floor-heading"><h2 id="layout-heading">우리 공장 배치도</h2><span>1–15호기</span></div><p class="floor-help">호기 번호를 누르면 장비·프로그램 정보를 엽니다.</p><nav class="floor-canvas" aria-label="공장 배치도에서 호기 선택" style="--floor-columns:'+layout.columns+';--floor-rows:'+layout.rows+'"><div class="floor-aisle" style="'+position(layout.aisle)+'">통로</div>'+layout.machines.map(p=>{
      const m=SoltriPrograms.byNo[p.no];
      const label=m.no+'호기 · '+m.controller+' · '+(m.program||'프로그램 미배정');
      return '<a class="floor-machine" data-floor-machine="'+p.no+'" href="#m'+p.no+'" aria-label="'+esc(label)+'" title="'+esc(label)+'" style="'+position(p)+'"><span>'+p.no+'</span></a>';
    }).join('')+'</nav><div class="floor-key"><span><i class="floor-key-machine"></i>기계</span><span><i class="floor-key-aisle"></i>통로</span></div><p class="floor-caption">2026-09-11 제공 배치도 기준 · 위치와 가로·세로 배치를 반영한 약도입니다.</p><a class="floor-source" href="'+layout.source+'" target="_blank" rel="noopener">제공한 원본 배치도 보기</a></section>';
  }
  window.SoltriFactoryLayout={layout,render};
})();
