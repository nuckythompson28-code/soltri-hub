/* Tool datums use the supplied geometry offsets. Holder outlines, pneumatic
   return travel and timing remain illustrative; they are not collision geometry. */
const UNIT5_SETUP=globalThis.SoltriMachineSetups.unit5;
const UNIT5_GANG=Object.freeze({
  tips:UNIT5_SETUP.tips,
  t2RetractedZ:UNIT5_SETUP.tips[2].z+UNIT5_SETUP.t2ReturnTravel,
  extent:Object.freeze({left:Math.min(...Object.values(UNIT5_SETUP.tips).map(t=>t.z))-8,
    right:127,bottom:-40,top:UNIT5_SETUP.tips[1].r+36})
});
let gangFrames=[],gangPreview=null,gangView=false;
function hasUnit5Gang(){return mainKey==='600'&&role(2)==='chamfer'&&role(3)==='part';}
function buildGangFrames(){
  gangFrames=[];gangPreview=null;if(!hasUnit5Gang())return;
  let last={z:30,r:-stockInfo.rawO/2-25-UNIT5_GANG.tips[3].r},lastTool=0,located=false,origin=0,extension=0;
  gangPreview={from:last,to:last,active:0,located:false,transition:false,origin:0,extensionFrom:0,extensionTo:0,actuator:false,airKnown:false};
  gangFrames=trace.map(s=>{
    const st=s.state,tip=UNIT5_GANG.tips[st.toolNo],known=tip&&st.X!=null&&st.Z!=null;
    const extensionTo=st.chamferExtended===true?1:0;
    const pneumatic={extensionFrom:extension,extensionTo,actuator:extension!==extensionTo,airKnown:st.chamferExtended!=null};extension=extensionTo;
    if(!known){located=false;return {from:last,to:last,active:st.toolNo,located:false,transition:false,origin,...pneumatic};}
    const to={z:zPlot(st.Z,st.zOff)-tip.z,r:st.X/2-tip.r},transition=located&&lastTool!==st.toolNo;
    const frame={from:located?last:to,to,active:st.toolNo,located:true,transition,origin:st.zOff-referenceOffset,...pneumatic};
    last=to;lastTool=st.toolNo;located=true;origin=frame.origin;return frame;
  });
}
// A same-block M/axis sequence is explanatory, not a measured PLC timeline.
function motionFraction(index=cur,fraction=playing?animT:1){
  const f=hasUnit5Gang()?gangFrames[index]:null;
  if(!f?.actuator||!trace[index]?.seg)return fraction;
  return f.extensionTo===1?Math.max(0,(fraction-.35)/.65):Math.min(1,fraction/.65);
}
function gangSnapshot(index=cur,fraction=playing?animT:1){
  if(!hasUnit5Gang())return null;
  const frame=gangFrames[index]||gangPreview;if(!frame)return null;
  const s=trace[index],tip=UNIT5_GANG.tips[frame.active];let pose=frame.to;
  if(s?.seg&&tip){const p=pointAt(plotPts(s.seg),motionFraction(index,fraction));pose={z:p[0]-tip.z,r:p[1]-tip.r};}
  // A standalone T word changes work coordinates, not the carriage position.
  const airFraction=frame.actuator&&s?.seg?(frame.extensionTo===1?Math.min(1,fraction/.35):Math.max(0,(fraction-.65)/.35)):fraction;
  const extension=frame.extensionFrom+(frame.extensionTo-frame.extensionFrom)*airFraction;
  const tools=Object.fromEntries(Object.entries(UNIT5_GANG.tips).map(([n,p])=>[n,{z:pose.z+p.z,r:pose.r+p.r}]));
  tools[2].z=pose.z+UNIT5_GANG.t2RetractedZ+(UNIT5_GANG.tips[2].z-UNIT5_GANG.t2RetractedZ)*extension;
  return {...frame,pose,extension,tools};
}
function gangBounds(full=false){
  const f=gangSnapshot(),{rawO,finO,finI,chuckFaceZ}=stockInfo,R=rawO/2;
  const e=UNIT5_GANG.extent;
  return {minA:full?Math.min(chuckFaceZ-Math.max(25,R*.65)-12,f.from.z+e.left-12,f.to.z+e.left-12):Math.min(f.origin-100,f.from.z+e.left-12,f.to.z+e.left-12),
    maxA:Math.max(f.origin+150,f.from.z+e.right+18,f.to.z+e.right+18),
    minB:Math.min(-R*1.4,f.from.r+e.bottom-16,f.to.r+e.bottom-16),
    maxB:Math.max(R*1.4,f.from.r+e.top+20,f.to.r+e.top+20)};
}
function isGangTransition(index){return hasUnit5Gang()&&!!gangFrames[index]?.transition;}
function isGangActuator(index){return hasUnit5Gang()&&!!gangFrames[index]?.actuator;}
function gangAirLabel(f=gangSnapshot()){
  if(!f?.airKnown)return 'T2 공압 · 지령 대기';
  if(f.extension>0&&f.extension<1)return f.extensionTo===1?'T2 공압 전진 중 · M56':'T2 공압 복귀 중 · M55';
  return f.extension===1?'T2 전진 · T3보다 Z '+(-UNIT5_GANG.tips[2].z).toFixed(3)+'mm 앞':'T2 후진 · M55';
}
function drawUnit5Gang(){
  const f=gangSnapshot();if(!f)return;
  const x=z=>sx(f.pose.z+z),y=r=>sy(f.pose.r+r),active=n=>f.active===n&&f.located;
  const t1=UNIT5_GANG.tips[1],t2=UNIT5_GANG.tips[2],t3=UNIT5_GANG.tips[3],e=UNIT5_GANG.extent;
  const block=(z,r,w,h,fill,stroke='#7890a3')=>{ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.fillRect(x(z),y(r),w*SC,h*SC);ctx.strokeRect(x(z),y(r),w*SC,h*SC);};
  const diamond=(z,r,n)=>{ctx.fillStyle=color(n);ctx.strokeStyle='#101923';ctx.beginPath();ctx.moveTo(x(z-3),y(r));ctx.lineTo(x(z),y(r+3));ctx.lineTo(x(z+3),y(r));ctx.lineTo(x(z),y(r-3));ctx.closePath();ctx.fill();ctx.stroke();};
  ctx.save();ctx.beginPath();ctx.rect(25,28,CW-40,CH-62);ctx.clip();
  // One plate and one carriage. All holder geometry uses this same translated frame.
  block(110,e.top-2,16,e.top-e.bottom-4,'#1c2a37','#465d70');
  block(77,e.top-4,34,e.top-e.bottom-8,'#394b5b','#90a2b2');
  block(82,e.top-8,7,e.top-e.bottom-16,'#536878','#273747');
  for(let r=e.bottom+12;r<e.top-10;r+=52){ctx.fillStyle='#14202c';ctx.beginPath();ctx.arc(x(104),y(r),Math.max(2,2.7*SC),0,Math.PI*2);ctx.fill();}
  for(const r of [t1.r-26,t2.r-16,t3.r-24])block(68,r,24,6,'#b77037','#d99c65');
  // T1: upper compound boring head with two inserts.
  ctx.globalAlpha=active(1)?1:.64;
  block(t1.z+24,t1.r+23,54-t1.z,43,'#425667',color(1));block(t1.z,t1.r+9,39,17,'#738697',color(1));
  diamond(t1.z,t1.r,1);diamond(t1.z,t1.r-(stockInfo.finO-stockInfo.finI)/2,1);
  // T2: fixed cylinder base; piston and insert head extend toward the stock.
  const t2z=f.tools[2].z-f.pose.z;
  ctx.globalAlpha=active(2)||f.actuator?1:.64;
  block(54,t2.r+16,24,30,'#425667',color(2));
  block(t2z+18,t2.r+5,Math.max(0,54-t2z-18),10,'#c1cdd5','#71889a');
  block(t2z+3,t2.r+10,18,20,'#8193a3',color(2));
  diamond(t2z,t2.r+4,2);diamond(t2z,t2.r-4,2);
  // T3: lower projecting shaft and upright parting insert.
  ctx.globalAlpha=active(3)?1:.64;
  block(t3.z+7,t3.r-5,70,11,'#8396a6',color(3));block(t3.z-2,t3.r,9,20,'#4b6275',color(3));
  block(t3.z,t3.r,Math.max(1.7,stockInfo.tip),12,color(3),'#eee4ff');
  ctx.globalAlpha=1;
  for(const [n,tip] of Object.entries(UNIT5_GANG.tips)){
    const r=n==='3'?tip.r-14:tip.r,z=95;
    ctx.fillStyle=active(Number(n))?color(n):'#1c2a36';ctx.strokeStyle=color(n);ctx.lineWidth=active(Number(n))?2:1;
    ctx.beginPath();ctx.arc(x(z),y(r),11,0,Math.PI*2);ctx.fill();ctx.stroke();
    label('T'+n,x(z),y(r)+4,active(Number(n))?'#10202a':color(n),'center',11);
  }
  if(f.located&&UNIT5_GANG.tips[f.active]){
    const p=f.tools[f.active];ctx.strokeStyle=color(f.active);ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx(p.z),sy(p.r),5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx(p.z),sy(p.r),2,0,Math.PI*2);ctx.fill();
  }
  label('공구대 · 형상 보정 반영',x(77),y(e.top+3),'#d9e5ef','left',11);
  ctx.restore();
  label(!f.located?'공구대 배치 미리보기 · 기준점 위치 생략':f.transition?(trace[cur]?.seg?'공구 선택 · 지령에 따른 공구대 이동':'공구 선택 · 형상 보정 기준 전환'):gangAirLabel(f),CW/2,CH-42,'#d9e5ef','center',CW<500?10:12);
}
