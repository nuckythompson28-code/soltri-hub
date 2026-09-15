/* Shared navigation and read-only equipment filtering. No machine controls or writes. */
(()=>{
  'use strict';
  const icons={
    factory:'M3 21V9l6 4V9l6 4V3h5v18H3Z M7 17h1 M12 17h1 M17 17h1',
    home:'m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7',
    machine:'M4 5h16v14H4z M7 9h6v6H7z M16 9h1 M16 13h1 M7 22v-3 M17 22v-3',
    layout:'M3 3h18v18H3z M3 11h18 M9 3v8 M15 11v10 M6 15h3 M6 18h3',
    play:'m9 6 10 6-10 6V6Z M4 4v16',
    chart:'M3 3v18h18 M7 16v-5 M12 16V7 M17 16v-9',
    tools:'m14 6 4 4 M12 8l4-4 4 4-4 4 M13 11l-9 9-2-2 9-9',
    arrow:'M4 12h16 m-6-6 6 6-6 6',
    search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 5 6 6',
    file:'M6 3h8l4 4v14H6V3Z M14 3v5h4 M9 12h6 M9 16h6'
  };
  const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(icons[name]||icons.file)+'"/></svg>';
  const links=[
    ['index.html','작업 홈','home'],
    ['machines.html','설비·프로그램','machine'],
    ['machines.html#layout','공장 배치도','layout'],
    ['simulator.html','가공 보기','play'],
    ['status.html','설비 현황','chart'],
    ['index.html#tools','현장 도구','tools']
  ];
  const header=document.createElement('header');
  header.className='kim-header';
  header.innerHTML='<a class="kim-brand" href="index.html" aria-label="김공장 작업 홈"><span class="kim-mark">'+icon('factory')+'</span><span>김공장<small>쏠트리 현장 도구</small></span></a><button class="kim-menu" id="kimMenu" type="button" aria-expanded="false" aria-controls="kimNav">메뉴</button><nav class="kim-nav" id="kimNav" aria-label="김공장 주 메뉴">'+links.map(([url,label,name])=>'<a href="'+url+'">'+icon(name)+'<span>'+label+'</span></a>').join('')+'</nav>';
  document.body.prepend(header);
  const menu=header.querySelector('#kimMenu');
  const setOpen=value=>{menu.setAttribute('aria-expanded',String(value));header.classList.toggle('kim-menu-open',value);};
  menu.addEventListener('click',()=>setOpen(menu.getAttribute('aria-expanded')!=='true'));
  header.querySelectorAll('.kim-nav a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){setOpen(false);menu.focus();}});
  function activeLink(){
    const file=location.pathname.split('/').pop()||'index.html';
    const current=(file==='machines.html'&&location.hash==='#layout')?'machines.html#layout':file==='index.html'&&location.hash==='#tools'?'index.html#tools':/^o\d/.test(file)?'machines.html':file;
    header.querySelectorAll('.kim-nav a').forEach(a=>{if(a.getAttribute('href')===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }
  activeLink();window.addEventListener('hashchange',activeLink);
  document.querySelectorAll('[data-ui-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.uiIcon);});
  const data=window.SoltriPrograms;
  if(data){
    const counts={machines:data.machines.length,assigned:data.machines.filter(m=>m.program).length,unassigned:data.machines.filter(m=>!m.program).length};
    document.querySelectorAll('[data-inventory-count]').forEach(el=>{el.textContent=counts[el.dataset.inventoryCount];});
    for(const form of document.querySelectorAll('[data-directory-tools]')){
      const grid=document.getElementById(form.dataset.directoryTools);
      const search=form.querySelector('input[type="search"]');
      const select=form.querySelector('select');
      const status=form.querySelector('[role="status"]');
      const empty=form.querySelector('.directory-empty');
      const ids=[...new Set(data.machines.map(m=>m.program).filter(Boolean))].sort();
      select.innerHTML='<option value="">모든 프로그램</option>'+ids.map(id=>'<option value="'+id+'">'+id+'</option>').join('')+'<option value="unassigned">프로그램 미배정</option>';
      function filter(){
        const query=search.value.toLocaleLowerCase().replace(/\s/g,'');
        let count=0;
        for(const tile of grid.querySelectorAll('[data-machine]')){
          const m=data.byNo[tile.dataset.machine];
          const label=(m.no+'호기 '+(m.sub||'')+' '+(m.program||'미배정')+' '+m.controller+' '+(m.maker||'')).toLocaleLowerCase().replace(/\s/g,'');
          const numberOnly=/^\d+(호기)?$/.test(query);
          const found=(!query||(numberOnly?m.no===query.replace('호기',''):label.includes(query)))&&(!select.value||(select.value==='unassigned'?!m.program:m.program===select.value));
          tile.hidden=!found;if(found)count++;
        }
        status.textContent=count+'대 표시 / 전체 '+data.machines.length+'대';
        empty.hidden=count!==0;
      }
      search.addEventListener('input',filter);select.addEventListener('change',filter);
      form.addEventListener('submit',e=>e.preventDefault());
      form.querySelector('[data-filter-clear]').addEventListener('click',()=>{search.value='';select.value='';filter();search.focus();});
      filter();
    }
  }
  window.SoltriUI={icon};
})();
