/* Shared navigation only. Program source and controller settings are not edited here. */
(()=>{
  'use strict';
  const directory=window.SoltriPrograms;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const machineLabel=m=>m.no+'호기'+(m.sub?' · '+m.sub:'');
  const sourceNote=(m,p)=>{
    if(p.id==='O0600')return '최신 공구 배치: T02 면취기 · T03 절단바이트. 계산 검사 완료 · 실기 검증 전.';
    if(p.id==='O0500')return '보관본입니다. 공구 교환 전 T02 절단 배치와 3면취 기본 원문을 유지합니다.';
    if(p.id==='O2026')return '제일연마 품목용 원문입니다. T02 절단 배치이며 T03은 사용하지 않습니다.';
    if(p.id==='O0852')return '호기 선택 변수 #130='+m.no+'. 연결된 공통 원문의 기본값은 #130=10이며, 호기별 M코드 표와 대조합니다.';
    if(p.id==='O8000'&&m.no==='3')return '연결 원문은 6호기 기준입니다. 3호기 에어는 M08/M09, M03은 역회전으로 원문 기준과 다릅니다.';
    if(p.id==='O0400'&&m.no==='13')return '2·13호기에 배정된 O0400 공통 분석 자료입니다. 연결 원문과 13호기 M코드 표를 함께 확인합니다.';
    return p.reference+'호기 기준 원문과 연결된 분석 자료입니다.';
  };
  function tiles(container){
    container.innerHTML=directory.machines.map(m=>{
      const p=directory.programs[m.program];
      return '<a class="assignment-tile" data-machine="'+m.no+'" href="machines.html#m'+m.no+'" style="--program-color:'+(p?p.color:'#a8b3bf')+'"><span class="unit">'+machineLabel(m)+'</span><span class="program-id">'+(p?p.id:'미배정')+'</span><span class="assignment-kind">'+(p?p.short:'M코드 보기')+'</span></a>';
    }).join('');
  }
  function programCard(m,id,status){
    const p=directory.programs[id];
    const buttons=[['설명·코드 보기',p.file+'?machine='+m.no,'primary']];
    if(p.package)buttons.push(['등록 파일 ZIP',p.package,'download']);
    for(const file of p.txt||[])buttons.push([file.split('/').pop(),file,'download']);
    buttons.push([(p.reference===m.no?'가공 보기':p.reference+'호기 원문 가공 보기'),'simulator.html?program='+p.id,'']);
    return '<article class="assignment-card" data-program="'+id+'" style="--program-color:'+p.color+'"><span class="assignment-status'+(status==='보관용'?' archive':'')+'">'+esc(status)+'</span><h2>'+id+'</h2><p>'+esc(p.description)+'</p><p class="assignment-tools">'+esc(p.tools)+'</p><div class="assignment-set">메인 '+id+'<br>서브 '+p.subs.join(' · ')+'<br>총 '+(p.subs.length+1)+'개 프로그램 한 세트</div><p class="assignment-note">'+esc(sourceNote(m,p))+'</p><div class="assignment-actions">'+buttons.map(([label,url,kind])=>'<a href="'+url+'"'+(kind==='download'?' download':' class="'+kind+'"')+'>'+esc(label)+'</a>').join('')+'</div></article>';
  }
  function renderPrograms(m,container){
    container.innerHTML=m.program?programCard(m,m.program,'배정 프로그램'):'<div class="assignment-empty">4호기는 아직 배정된 프로그램이 없습니다.<br>등록된 M코드는 아래에서 볼 수 있습니다.</div>';
    if(m.no==='5'){
      container.innerHTML+='<details class="assignment-group" id="item-programs"><summary>품목 전용 · O2026 / O2027 제일연마</summary>'+programCard(m,'O2026','품목 전용')+'</details>';
      container.innerHTML+='<details class="assignment-group" id="archived-programs"><summary>보관용 · O0500 (기존 공구 배치)</summary>'+programCard(m,'O0500','보관용')+'</details>';
    }
  }
  function contextBanner(){
    const filename=location.pathname.split('/').pop();
    const p=Object.values(directory.programs).find(p=>p.file===filename);
    if(!p)return;
    const owners=directory.machines.filter(m=>m.program===p.id||(m.no==='5'&&['O0500','O2026'].includes(p.id)));
    const requested=new URLSearchParams(location.search).get('machine');
    const selected=owners.find(m=>m.no===requested)||(owners.length===1?owners[0]:null);
    const role=p.id==='O0500'?'보관용':p.id==='O2026'?'품목 전용':'배정 프로그램';
    const banner=document.createElement('aside');banner.className='program-location';banner.setAttribute('aria-label','프로그램 호기 배정');
    banner.innerHTML='<strong>'+(selected?machineLabel(selected):owners.map(m=>m.no).join('·')+'호기')+' · '+p.id+' · '+role+'</strong><p>'+esc(p.tools)+'</p>'+(selected?'<p>'+esc(sourceNote(selected,p))+'</p>':'<p>호기를 선택하면 해당 배정 화면으로 이동합니다. 공통 원문에 호기별 설정을 자동 적용하지 않습니다.</p>')+'<div class="location-links">'+owners.map(m=>'<a href="machines.html#m'+m.no+'"'+(selected===m?' aria-current="true"':'')+'>'+machineLabel(m)+' 프로그램</a>').join('')+'<a href="machines.html">전체 호기</a></div>';
    document.getElementById('main').prepend(banner);
  }
  window.SoltriProgramUI={tiles,renderPrograms};
  document.querySelectorAll('[data-machine-directory]').forEach(tiles);
  contextBanner();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
