'use strict';
const $=id=>document.getElementById(id), cv=$('cv'), ctx=cv.getContext('2d');
const COLORS={1:'#66e0d1',2:'#ffc16c',3:'#c7a5ff',5:'#80baff'};
const SOURCE_URLS={O0500:'programs/o0500-unit5.nc',O2026:'programs/o2026-o2027-jeil-unit5.nc'};
let profile=MACHINE_PROFILES['500'], mainKey='500', trace=[],programLines=[],cur=-1,playing=false,animT=1,rafId=null;
let stockInfo=null,cutEvents=[],referenceOffset=0,CW=0,CH=0,SC=1,OAX=0,OBY=0,view={minA:-100,maxA:30,minB:-50,maxB:50};
let focusView=matchMedia('(max-width:650px)').matches,loadSerial=0,sourceText='',fieldCache=null;
const sx=z=>OAX+z*SC,sy=r=>OBY-r*SC;
const esc=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const color=t=>COLORS[t]||'#9de4ae';
const role=t=>profile.tools[t]?.[2]||'od';
const zPlot=(z,offset)=>z+(offset??referenceOffset)-referenceOffset;
function segPlotPts(seg){
  const a0=seg.z0,b0=seg.x0/2,a1=seg.z1,b1=seg.x1/2;
  if(seg.type!==2&&seg.type!==3)return [[a0,b0],[a1,b1]];
  let ca,cb;
  if(seg.I!=null||seg.K!=null){ca=a0+(seg.K||0);cb=b0+(seg.I||0);}
  else if(seg.R!=null){const r=Math.abs(seg.R),dx=a1-a0,dy=b1-b0,d=Math.hypot(dx,dy);if(d<1e-9||d>2*r)return [[a0,b0],[a1,b1]];const h=Math.sqrt(Math.max(0,r*r-d*d/4)),sign=(seg.type===2?-1:1)*(seg.R<0?-1:1);ca=(a0+a1)/2-sign*dy*h/d;cb=(b0+b1)/2+sign*dx*h/d;}
  else return [[a0,b0],[a1,b1]];
  const r=Math.hypot(a0-ca,b0-cb);let a=Math.atan2(b0-cb,a0-ca),e=Math.atan2(b1-cb,a1-ca);
  if(seg.type===2&&e>a)e-=2*Math.PI;if(seg.type===3&&e<a)e+=2*Math.PI;
  const n=Math.max(8,Math.ceil(Math.abs(e-a)/.1));return Array.from({length:n+1},(_,k)=>[ca+r*Math.cos(a+(e-a)*k/n),cb+r*Math.sin(a+(e-a)*k/n)]);
}
function plotPts(seg){return segPlotPts(seg).map(([z,r])=>[zPlot(z,seg.zOff),r]);}
function pointAt(points,fraction){let length=0;const lengths=[];for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lengths.push(d);length+=d;}let remaining=length*fraction;for(let i=1;i<points.length;i++){if(remaining<=lengths[i-1]&&lengths[i-1]>0){const t=remaining/lengths[i-1];return [points[i-1][0]+(points[i][0]-points[i-1][0])*t,points[i-1][1]+(points[i][1]-points[i-1][1])*t];}remaining-=lengths[i-1];}return points.at(-1);}
function currentToolPlot(){const s=trace[cur];if(!s)return null;if(s.seg)return pointAt(plotPts(s.seg),playing?animT:1);if(s.state.X==null||s.state.Z==null)return null;return [zPlot(s.state.Z,s.state.zOff),s.state.X/2];}
function completed(){return cutEvents.filter(c=>c.index<cur||(c.index===cur&&(!playing||animT>=1))).length;}

function buildStockInfo(){
  referenceOffset=trace.find(s=>s.act==='offset'&&s.state.zOff>0)?.state.zOff||0;
  const ids=mainKey==='852'?[109,110,111,112,113,114]:[101,102,103,104,105,106];
  const input=trace.find(s=>ids.every(n=>s.kv[n]!=null&&s.kv[n]>=0)&&s.kv[ids[0]]>s.kv[ids[1]]&&s.kv[ids[4]]>0&&s.kv[ids[5]]>0)?.kv;
  let rawO,rawI,finO,finI,finLen,tip;
  if(input)[rawO,rawI,finO,finI,finLen,tip]=ids.map(n=>input[n]);
  const feeds=trace.filter(s=>s.seg&&s.seg.type!==0&&role(s.seg.tool)!=='pull');
  if(!input){rawO=Math.max(20,...feeds.flatMap(s=>[Math.abs(s.seg.x0),Math.abs(s.seg.x1)]));rawI=0;finO=rawO;finI=0;finLen=10;tip=2;}
  const minCut=Math.min(0,...feeds.flatMap(s=>plotPts(s.seg).map(p=>p[0])));
  const chuckFaceZ=referenceOffset>0?-referenceOffset:minCut-8;
  const target=mainKey==='500'||mainKey==='400'||mainKey==='8000'?trace.find(s=>s.kv[120]>0)?.kv[120]:mainKey==='2026'?trace.find(s=>s.kv[517]>0)?.kv[517]:null;
  stockInfo={rawO,rawI,finO,finI,finLen,tip,unitLen:finLen+tip,chuckFaceZ,z0:chuckFaceZ,z1:0,target};
  cutEvents=[];let lastCount=0,lastIndex=-1;
  for(let i=0;i<trace.length;i++){
    if(trace[i].state.parts<=lastCount)continue;lastCount=trace[i].state.parts;
    for(let k=i;k>lastIndex;k--){const seg=trace[k].seg;if(!seg||seg.type===0||seg.tool!==profile.partTool)continue;
      if(Math.abs(seg.x1)<(finI||rawI)&&Math.abs(seg.x0)>=Math.abs(seg.x1)&&zPlot(seg.z1,seg.zOff)<-.01){cutEvents.push({index:k,countIndex:i,z:zPlot(seg.z1,seg.zOff)});break;}}
    lastIndex=i;
  }
  if(mainKey==='852')stockInfo.target=cutEvents.length;
  fieldCache=null;
}
function computeBounds(){
  if(!stockInfo)return;
  const {rawO,chuckFaceZ,finLen}=stockInfo,R=rawO/2;
  let minA=chuckFaceZ-Math.max(25,R*.65)-8,maxA=35;
  if(focusView){const p=currentToolPlot();const center=Math.max(chuckFaceZ+10,Math.min(0,p?.[0]??0));const width=Math.max(65,Math.min(125,finLen*5));minA=center-width*.72;maxA=center+width*.28;}
  view={minA,maxA,minB:-R*1.7-8,maxB:R*1.7+8};
}
function resize(){
  const rect=cv.parentElement.getBoundingClientRect(),dpr=window.devicePixelRatio||1;CW=rect.width;CH=rect.height;
  cv.width=Math.round(CW*dpr);cv.height=Math.round(CH*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const padL=CW<500?34:50,padR=25,padT=35,padB=40,aw=CW-padL-padR,ah=CH-padT-padB;
  SC=Math.max(.01,Math.min(aw/(view.maxA-view.minA),ah/(view.maxB-view.minB)));
  OAX=padL+(aw-(view.maxA-view.minA)*SC)/2-view.minA*SC;OBY=padT+(ah-(view.maxB-view.minB)*SC)/2+view.maxB*SC;
  draw();
}
function niceStep(span){const v=span/6,p=10**Math.floor(Math.log10(v)),n=v/p;return (n<1.5?1:n<3?2:n<7?5:10)*p;}
function label(text,x,y,col='#a6b5c5',align='left',size=11){ctx.fillStyle=col;ctx.font=`${size}px "Segoe UI",sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);ctx.textAlign='left';}
function drawGrid(){
  const step=niceStep(view.maxA-view.minA);ctx.lineWidth=1;
  for(let z=Math.ceil(view.minA/step)*step;z<=view.maxA;z+=step){const x=sx(z);ctx.strokeStyle='#22303f';ctx.beginPath();ctx.moveTo(x,30);ctx.lineTo(x,CH-35);ctx.stroke();label(fmt(z),x,CH-15,'#8a9db2','center',10);}
  ctx.setLineDash([6,5]);ctx.strokeStyle='#70879e';ctx.beginPath();ctx.moveTo(25,sy(0));ctx.lineTo(CW-15,sy(0));ctx.stroke();ctx.setLineDash([]);
  label('X0 · 중심선',32,sy(0)-8,'#c3d0df');label('+X ↑',12,20,'#ffc16c');label('−X ↓',12,CH-16,'#ffc16c');label('+Z →',CW-12,20,'#70c7ff','right');
  if(sx(0)>=30&&sx(0)<CW-30){ctx.strokeStyle='#70c7ff';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(sx(0),32);ctx.lineTo(sx(0),CH-34);ctx.stroke();ctx.setLineDash([]);label('Z0 · 시작면',sx(0)-5,43,'#70c7ff','right',10);}
}
function computeStockField(){
  if(!stockInfo)return null;
  const frac=playing?Math.round(animT*60)/60:1,key=`${cur}:${frac}`;if(fieldCache?.key===key)return fieldCache.field;
  const {rawO,rawI,finI,finO,tip,z0}=stockInfo,nz=Math.max(80,Math.min(650,Math.ceil(-z0/.4))),dz=-z0/nz;
  const outer=new Float64Array(nz+1).fill(rawO/2),inner=new Float64Array(nz+1).fill(rawI/2);let freeEnd=0,start=0;
  for(let k=0;k<cur;k++)if(trace[k].pull){start=k+1;}
  for(let k=start;k<=cur;k++){
    const s=trace[k],seg=s.seg;if(!seg||seg.type===0||role(seg.tool)==='pull')continue;
    const pts=plotPts(seg),a=pts[0],b=pointAt(pts,k===cur?frac:1),rA=Math.abs(a[1]),rB=Math.abs(b[1]),kind=role(seg.tool);
    if(kind==='part'){
      if(rB<(finI||rawI)/2&&b[0]<0)freeEnd=Math.min(freeEnd,b[0]);
      const i0=Math.max(0,Math.floor((Math.min(a[0],b[0])-z0)/dz)),i1=Math.min(nz,Math.ceil((Math.max(a[0],b[0])+tip-z0)/dz));
      for(let j=i0;j<=i1;j++)outer[j]=Math.max(inner[j],Math.min(outer[j],rB));
      continue;
    }
    const lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);
    for(let j=Math.max(0,Math.floor((lo-z0)/dz));j<=Math.min(nz,Math.ceil((hi-z0)/dz));j++){
      const t=Math.abs(b[0]-a[0])<1e-8?1:Math.max(0,Math.min(1,(z0+j*dz-a[0])/(b[0]-a[0]))),r=rA+(rB-rA)*t;
      if(kind==='compound'){outer[j]=Math.min(outer[j],Math.max(finI/2,r));if(s.state.brakeUp)inner[j]=Math.min(outer[j],Math.max(inner[j],finI/2));}
      else if(kind==='id')inner[j]=Math.min(outer[j],Math.max(inner[j],r));
      else if(kind==='od')outer[j]=Math.max(inner[j],Math.min(outer[j],r));
    }
  }
  const field={nz,dz,z0,outer,inner,freeEnd};fieldCache={key,field};return field;
}
function drawStock(){
  const f=computeStockField();if(!f)return;
  const {rawO,rawI,chuckFaceZ}=stockInfo,R=rawO/2,body=Math.max(25,R*.65),chuckOpen=trace[cur]?.state.mainChuck==='open';
  const pullDx=(trace[cur]?.pull||0)*(playing?animT:1),freeEnd=f.freeEnd+pullDx;
  ctx.save();ctx.beginPath();ctx.rect(25,28,CW-40,CH-62);ctx.clip();
  ctx.fillStyle='#273747';ctx.fillRect(sx(chuckFaceZ),sy(R),sx(0)-sx(chuckFaceZ),2*R*SC);
  ctx.fillStyle='#0e1721';ctx.fillRect(sx(chuckFaceZ),sy(rawI/2),sx(0)-sx(chuckFaceZ),rawI*SC);
  ctx.fillStyle='#14202d';if(freeEnd<0)ctx.fillRect(sx(freeEnd),sy(R),sx(0)-sx(freeEnd),2*R*SC);
  ctx.fillStyle='#8c9cac';ctx.beginPath();
  for(let j=0;j<f.nz;j++){const z=f.z0+j*f.dz;if(z>=f.freeEnd)continue;const w=Math.max(.7,f.dz*SC),o=f.outer[j],i=f.inner[j];ctx.rect(sx(z+pullDx),sy(o),w,(o-i)*SC);ctx.rect(sx(z+pullDx),sy(-i),w,(o-i)*SC);}ctx.fill();
  if(pullDx>0){ctx.fillRect(sx(chuckFaceZ),sy(R),pullDx*SC,(R-rawI/2)*SC);ctx.fillRect(sx(chuckFaceZ),sy(-rawI/2),pullDx*SC,(R-rawI/2)*SC);}
  ctx.strokeStyle='#657b91';ctx.lineWidth=1;ctx.strokeRect(sx(chuckFaceZ),sy(R),sx(freeEnd)-sx(chuckFaceZ),2*R*SC);
  ctx.fillStyle='#354555';ctx.strokeStyle='#647b91';ctx.fillRect(sx(chuckFaceZ-body),sy(R*1.48),body*SC,R*2.96*SC);ctx.strokeRect(sx(chuckFaceZ-body),sy(R*1.48),body*SC,R*2.96*SC);
  const grip=chuckOpen?R*1.2:R;ctx.fillStyle=chuckOpen?'#795c52':'#6a7e92';for(const sign of [1,-1])ctx.fillRect(sx(chuckFaceZ-body*.35),Math.min(sy(sign*R*1.48),sy(sign*grip)),body*.35*SC,(R*1.48-grip)*SC);
  if(!focusView)label('척',sx(chuckFaceZ-body*.5),sy(R*1.48)-8,'#c7d3e0','center');
  if(cur<0&&sx(-stockInfo.finLen)>45)label('소재',Math.max(70,Math.min(CW-100,(sx(chuckFaceZ)+sx(0))/2)),sy(R)-12,'#d6e2ec','center',12);
  ctx.restore();
}
function drawSegments(){
  const showRapid=$('showRapid').checked,history=$('showHistory').checked;
  let start=0;if(!history){const previous=cutEvents.filter(c=>c.index<cur).at(-1);start=previous?previous.countIndex+1:0;}
  ctx.save();ctx.beginPath();ctx.rect(25,28,CW-40,CH-62);ctx.clip();
  for(let k=start;k<=cur;k++){const s=trace[k],seg=s.seg;if(!seg||(!showRapid&&seg.type===0))continue;
    const pts=plotPts(seg),end=pointAt(pts,k===cur&&playing?animT:1);ctx.strokeStyle=seg.type===0?'#c88482':color(seg.tool);ctx.globalAlpha=k===cur?1:.45;ctx.lineWidth=k===cur?3:1.5;ctx.setLineDash(seg.type===0?[5,5]:[]);
    ctx.beginPath();ctx.moveTo(sx(pts[0][0]),sy(pts[0][1]));if(seg.type<2)ctx.lineTo(sx(end[0]),sy(end[1]));else {const n=Math.max(1,Math.ceil((pts.length-1)*(k===cur&&playing?animT:1)));for(let j=1;j<n;j++)ctx.lineTo(sx(pts[j][0]),sy(pts[j][1]));ctx.lineTo(sx(end[0]),sy(end[1]));}ctx.stroke();
  }ctx.restore();ctx.setLineDash([]);
}
function drawInsert(x,y,up,col){const d=up?-1:1;ctx.fillStyle=col;ctx.strokeStyle='#0b151f';ctx.lineWidth=1.5;ctx.fillRect(x-3,y+d*34,6,-d*22);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+d*10);ctx.lineTo(x,y+d*18);ctx.lineTo(x+7,y+d*10);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}
function drawTool(){
  const p=currentToolPlot(),s=trace[cur];if(!p||!s)return;const x=sx(p[0]),y=sy(p[1]),t=s.state.toolNo,col=color(t),kind=role(t);
  if(x<25||x>CW-15||y<28||y>CH-32){label('공구가 표시 범위 밖에 있습니다',CW/2,CH-42,col,'center');return;}
  ctx.save();ctx.lineWidth=1.5;ctx.strokeStyle=col;
  ctx.setLineDash([2,5]);ctx.beginPath();ctx.moveTo(x,sy(0));ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
  if(kind==='part'){
    const d=p[1]<0?1:-1,w=Math.max(5,Math.min(12,stockInfo.tip*SC));ctx.fillStyle=col;ctx.fillRect(x,y,w,d*38);ctx.strokeStyle='#0b151f';ctx.strokeRect(x,y,w,d*38);ctx.fillStyle='#fff';ctx.fillRect(x,y-1,w,3);
    label(`T${t} ${d>0?'↑ 아래쪽 절단':'↓ 위쪽 절단'}`,Math.min(CW-8,x+16),y+d*52,col,x+140>CW?'right':'left',12);
  }else if(kind==='compound'){
    drawInsert(x,y,true,col);const wall=(stockInfo.finO-stockInfo.finI)/2;drawInsert(x,sy(p[1]-wall),false,s.state.brakeUp?col:'#516776');
    label('T1 내·외경 '+(s.state.brakeUp?'UP':'DOWN'),Math.min(CW-10,x+12),Math.max(55,y-42),col,x+140>CW?'right':'left',12);
  }else if(kind==='pull'){
    const grip=stockInfo.rawO/2*SC;ctx.fillStyle=col;ctx.fillRect(x+22,sy(0)-grip-8,10,2*grip+16);ctx.fillRect(x-7,sy(0)-grip-8,30,8);ctx.fillRect(x-7,sy(0)+grip,30,8);label('T3 오토링크 →',Math.min(x+10,CW-10),sy(0)-grip-17,col,x+130>CW?'right':'left',12);
  }else{drawInsert(x,y,p[1]>=0,col);label(`T${t} ${profile.tools[t]?.[0]||'공구'}`,Math.min(x+10,CW-10),Math.max(55,y-40),col,x+130>CW?'right':'left',12);}
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,CW,CH);drawGrid();drawStock();drawSegments();
  ctx.setLineDash([6,5]);ctx.strokeStyle='#70879e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(25,sy(0));ctx.lineTo(CW-15,sy(0));ctx.stroke();ctx.setLineDash([]);label('X0 · 중심선',32,sy(0)-8,'#c3d0df');
  drawTool();
}

function renderLineList(){const fragment=document.createDocumentFragment();for(const pl of programLines){const el=document.createElement('div');el.className='ln'+(/^\s*[%(]/.test(pl.raw)?' cmt':'');el.dataset.line=pl.idx;el.innerHTML=`<span class="gut">${pl.idx+1}</span><span class="src">${esc(pl.raw)||' '}</span>`;el.onclick=()=>{const next=trace.findIndex((s,k)=>k>cur&&s.lineIdx===pl.idx),first=trace.findIndex(s=>s.lineIdx===pl.idx);if(next>=0||first>=0)gotoStep(next>=0?next:first);};fragment.append(el);}$('lineList').replaceChildren(fragment);}
function renderMachine(){
  $('machineName').textContent=profile.name;$('machineNote').textContent=profile.note;$('analysisLink').hidden=!profile.link;if(profile.link)$('analysisLink').href=profile.link;
  if(mainKey==='852'){const no=trace.find(s=>s.kv[130]>0)?.kv[130];if(no)$('machineName').textContent=`${no}호기 · O0852 설정`;}
  $('toolStrip').innerHTML=Object.entries(profile.tools).map(([n,t])=>`<div class="tool-card" id="tool-${n}" style="--tool-color:${color(n)}"><span class="tool-state">대기</span><b>T${n} ${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('');
  $('legend').innerHTML=Object.entries(profile.tools).map(([n])=>`<span class="legend-key"><i style="border-color:${color(n)}"></i>T${n}</span>`).join('')+'<span>점선 = 급속</span>';
  $('btnNextPull').hidden=!profile.pullTool;$('btnNextPull').disabled=!trace.some(s=>s.pull);
  $('btnNextCut').hidden=!profile.partTool;$('btnNextCut').disabled=!cutEvents.length;
  $('stockDimensions').textContent=`소재 Ø${fmt(stockInfo.rawO)} / Ø${fmt(stockInfo.rawI)} · 제품 ${fmt(stockInfo.finLen)} mm · 단면 개략도`;
}
function describeStep(s){
  if(!s)return ['가공 준비',`${profile.name}. 재생 또는 다음 이동을 누르면 공구가 움직입니다.`];
  if(s.act==='alarm'||s.act==='cap')return ['계산 정지',s.desc];
  if(s.act==='stop')return ['M00 · 일시정지',s.desc];
  if(s.act==='end')return ['프로그램 종료',`${completed()}개 절단 확인 · ${s.desc}`];
  if(s.pull)return ['오토링크 소재 인출',`T3가 소재를 잡고 +Z로 ${fmt(s.pull)} mm 끌어당깁니다.`];
  const kind=role(s.state.toolNo),seg=s.seg;
  if(seg&&seg.type===0)return ['공구 접근 · 후퇴',`${s.state.tool} 급속 이동 · X ${fmt(s.state.X)} / Z ${fmt(s.state.Z)}`];
  if(seg&&kind==='part'){
    if(cutEvents.some(c=>c.index===cur))return [`${cutEvents.findIndex(c=>c.index===cur)+1}번째 제품 절단`,`${s.state.tool} ${seg.x1<0?'아래에서 위로':'위에서 아래로'} 절입 · ${fmt(seg.x0)} → ${fmt(seg.x1)} · Z ${fmt(seg.z1)}`];
    if(Math.abs(seg.z1)<.001)return ['소재 끝면 가공',`${s.state.tool}으로 Z0 끝면을 정리합니다.`];
    if(Math.abs(seg.z1-seg.z0)>.001&&Math.abs(seg.x1-seg.x0)>.001)return ['왼쪽 외경 면취',`${s.state.tool}이 X와 Z를 함께 이동하며 모따기합니다.`];
    return [seg.z1>0?'초기 마킹':'절단 바이트 절입',`${s.state.tool} · X ${fmt(seg.x0)} → ${fmt(seg.x1)} / Z ${fmt(seg.z1)}`];
  }
  if(seg&&kind==='compound'){
    if(Math.abs(seg.z1-seg.z0)>.01)return [s.state.brakeUp?'내·외경 동시 가공':'황삭 · 축방향 이동',`T1 ${s.state.brakeUp?'UP':'DOWN'} · Z ${fmt(seg.z0)} → ${fmt(seg.z1)} · F ${fmt(s.state.feed)} ${s.state.fmode}`];
    return ['T1 면취 · 직경 방향 가공',`X ${fmt(seg.x0)} → ${fmt(seg.x1)} · Z ${fmt(seg.z1)} · 보링바 ${s.state.brakeUp?'UP':'DOWN'}`];
  }
  if(seg&&kind==='chamfer')return ['T2 면취 가공',`면취 바이트 Z ${fmt(seg.z0)} → ${fmt(seg.z1)}`];
  if(s.act==='park')return ['공구 위치 설정',s.desc];
  if(s.act==='offset')return ['가공 원점 설정',s.desc];
  if(s.act==='assign')return ['치수 · 가공값 계산',s.desc];
  if(s.act==='if'||s.act==='goto')return ['가공 조건 확인',s.desc];
  if(s.act==='call'||s.act==='return')return ['서브 프로그램 이동',s.desc];
  return [s.act==='mcode'?'장비 동작':s.act==='dwell'?'잠시 정지':'지령 확인',s.desc];
}
function updateReadouts(){
  const s=trace[cur],st=s?.state||{};let x=st.X,z=st.Z;
  if(playing&&s?.seg){const p=pointAt(segPlotPts(s.seg),animT);x=p[1]*2;z=p[0];}
  $('hX').textContent=fmt(x);$('hZ').textContent=fmt(z);$('hStock').textContent=`${completed()} / ${stockInfo?.target??'—'}`;
  $('hT').textContent=st.tool?`${st.tool} · ${profile.tools[st.toolNo]?.[0]||'공구'}`:'공구 대기';
  $('hMove').textContent=s?.seg?(s.seg.type===0?'급속 이동':s.seg.type===1?'절삭 이송':'원호 가공'):st.toolNo===1?(st.brakeUp?'보링바 UP':'보링바 DOWN'):s?.act==='end'?'종료':'준비 · 전환';
  $('hS').textContent=(st.spin||'정지')+(st.rpm?` · S${fmt(st.rpm)}`:'');$('hF').textContent=st.feed?`F ${fmt(st.feed)} ${st.fmode}`:'';
}
function updateAll(){
  const s=trace[cur];$('seek').max=trace.length;$('seek').value=cur+1;$('prog').textContent=`${cur+1} / ${trace.length}`;
  document.querySelector('.ln.cur')?.classList.remove('cur');
  if(s&&!$('codePanel').hidden){const el=document.querySelector(`.ln[data-line="${s.lineIdx}"]`);if(el){el.classList.add('cur');const box=$('lineList');if(el.offsetTop<box.scrollTop||el.offsetTop>box.scrollTop+box.clientHeight-28)box.scrollTop=el.offsetTop-box.clientHeight/2;}}
  for(const n of Object.keys(profile.tools)){const el=$(`tool-${n}`),active=Number(n)===s?.state.toolNo;el.classList.toggle('active',active);el.querySelector('.tool-state').textContent=active?(n==='1'?(s.state.brakeUp?'UP':'DOWN'):'선택됨'):'대기';}
  updateReadouts();const [title,detail]=describeStep(s);$('stepTitle').textContent=title;$('stepDetail').textContent=detail;
  $('actLine').textContent=s?`O${s.prog} · ${s.lineIdx+1}행  ${programLines[s.lineIdx].raw}`:'아직 실행 전입니다.';
  $('vchips').innerHTML=s?KEYVARS.filter(n=>s.kv[n]!=null&&s.kv[n]!==-9999).map(n=>`<span class="vchip${s.changed?.n===n?' hot':''}"><span class="vk">#${n} ${esc(VARLBL[n]||'')}</span><span class="vv">${fmt(s.kv[n])}</span></span>`).join(''):'';
  fieldCache=null;if(focusView){computeBounds();resize();}else draw();
}
function pause(){playing=false;if(rafId)cancelAnimationFrame(rafId);rafId=null;$('btnPlay').textContent='▶ 재생';}
function gotoStep(i){pause();cur=Math.max(-1,Math.min(trace.length-1,i));animT=1;updateAll();}
function nextMove(){let i=cur+1;while(i<trace.length-1&&!trace[i].seg&&trace[i].act!=='alarm'&&trace[i].act!=='cap')i++;gotoStep(i);}
function play(){if(playing||!trace.length)return;if(cur>=trace.length-1)cur=-1;playing=true;$('btnPlay').textContent='Ⅱ 일시정지';advance();}
function advance(){
  if(!playing)return;if(cur>=trace.length-1){pause();return;}cur++;
  while(cur<trace.length-1&&!trace[cur].seg&&!['end','alarm','cap','stop'].includes(trace[cur].act))cur++;
  const s=trace[cur];animT=0;updateAll();if(['end','alarm','cap','stop'].includes(s.act)){animT=1;pause();updateAll();return;}
  const speed=+$('speed').value,duration=s.pull?1800:(s.seg?.type===0?450:1000)*4/speed,start=performance.now();
  function frame(now){if(!playing)return;animT=Math.min(1,(now-start)/duration);draw();updateReadouts();if(animT<1)rafId=requestAnimationFrame(frame);else{updateAll();rafId=requestAnimationFrame(advance);}}
  rafId=requestAnimationFrame(frame);
}
function setStatus(message,error=false){$('loadStatus').textContent=message;$('loadStatus').classList.toggle('error',error);}
function recompute(text){
  pause();sourceText=text;mainKey=parsePrograms(text).mainKey;profile=machineProfile(text);
  const max=Math.max(10,Math.min(50000,+$('maxMoves').value||2000)),r=runProgram(text,max);trace=r.trace;programLines=r.programLines;cur=-1;animT=1;
  buildStockInfo();renderMachine();renderLineList();computeBounds();resize();updateAll();
  $('cntInfo').textContent=`${Object.keys(r.programs).length}개 프로그램 · ${programLines.length}줄 · ${r.info.moves}회 이동`;
  const error=!!r.info.alarm||!['M30','M99(최상위)','종료(끝)'].includes(r.info.endReason);
  setStatus(error?`확인 필요: ${r.info.alarm||r.info.endReason}`:`${mainKey?'O'+mainKey.padStart(4,'0'):''} 불러옴 · ${cutEvents.length}개 절단 경로 · ${r.info.moves}회 이동 · ${mainKey==='500'?(trace.find(s=>s.kv[121]>0)?.kv[121]+'면취 · '):''}화면 재생 준비`,error);
  for(const id of ['btnPlay','btnNextMove','btnReset','btnPrev','btnNext'])$(id).disabled=!trace.length;
  syncViewButton();return r;
}
function syncViewButton(){$('btnCoord').setAttribute('aria-pressed',String(focusView));}
async function loadSample(key){
  const serial=++loadSerial;pause();setStatus('프로그램을 불러오는 중입니다.');
  try{let text=SAMPLES[key];if(SOURCE_URLS[key]){const response=await fetch(SOURCE_URLS[key]);if(!response.ok)throw new Error('파일을 불러오지 못했습니다 ('+response.status+')');text=await response.text();}
    if(serial!==loadSerial)return;if(!text)throw new Error('프로그램이 없습니다.');$('editor').value=text;recompute(text);
  }catch(error){if(serial===loadSerial)setStatus(error.message,true);}
}
$('sampleSel').onchange=e=>loadSample(e.target.value);
$('fileIn').onchange=async e=>{
  const files=Array.from(e.target.files);if(!files.length)return;const serial=++loadSerial;pause();
  try{const chunks=await Promise.all(files.map(f=>f.text()));if(serial!==loadSerial)return;
    const headers=chunks.flatMap(t=>[...t.matchAll(/^\s*O\s*(\d+)/gmi)].map(m=>String(Number(m[1]))));if(new Set(headers).size!==headers.length)throw new Error('같은 프로그램 번호가 중복됩니다. 통합 파일 또는 개별 파일 한 세트만 선택하세요.');
    const mains=['500','2026','400','8000','852'];chunks.sort((a,b)=>Number(!mains.includes(parsePrograms(a).mainKey))-Number(!mains.includes(parsePrograms(b).mainKey)));
    const text=chunks.join('\n\n');$('editor').value=text;$('sampleSel').selectedIndex=-1;recompute(text);
  }catch(error){setStatus(error.message,true);}e.target.value='';
};
$('codeToggle').onclick=()=>{const open=$('codePanel').hidden;$('codePanel').hidden=!open;$('codeToggle').textContent=open?'코드 닫기':'코드 보기';$('codeToggle').setAttribute('aria-expanded',String(open));document.querySelector('.app').classList.toggle('with-code',open);resize();updateAll();};
$('editToggle').onclick=()=>{const editing=$('editor').hidden;$('editor').hidden=!editing;$('lineList').hidden=editing;$('editToggle').textContent=editing?'코드 보기':'편집';};
$('loadBtn').onclick=()=>recompute($('editor').value);$('maxMoves').onchange=()=>recompute($('editor').value);
$('btnReset').onclick=()=>gotoStep(-1);$('btnPrev').onclick=()=>gotoStep(cur-1);$('btnNext').onclick=()=>gotoStep(cur+1);$('btnNextMove').onclick=nextMove;$('btnPlay').onclick=()=>playing?pause():play();
$('btnNextCut').onclick=()=>{const c=cutEvents.find(c=>c.index>cur);if(c)gotoStep(c.index);else gotoStep(trace.length-1);};
$('btnNextPull').onclick=()=>{const i=trace.findIndex((s,k)=>k>cur&&s.pull);if(i>=0)gotoStep(i);};
$('seek').oninput=e=>gotoStep(Number(e.target.value)-1);
$('btnCoord').onclick=()=>{focusView=!focusView;syncViewButton();computeBounds();resize();};$('btnFit').onclick=()=>{focusView=false;syncViewButton();computeBounds();resize();};
$('showRapid').onchange=draw;$('showHistory').onchange=draw;
document.addEventListener('keydown',e=>{if(/TEXTAREA|INPUT|SELECT|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();playing?pause():play();}else if(e.key==='ArrowRight'){e.preventDefault();nextMove();}else if(e.key==='ArrowLeft'){e.preventDefault();gotoStep(cur-1);}else if(e.key==='Home')gotoStep(-1);});
window.addEventListener('resize',()=>{computeBounds();resize();});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
const initial=new URLSearchParams(location.search).get('program')||'O0500';$('sampleSel').value=initial;loadSample(SOURCE_URLS[initial]||SAMPLES[initial]?initial:'O0500');
