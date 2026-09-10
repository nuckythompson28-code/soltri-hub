/* Photo-based schematic spacing, NOT machine tool offsets or measured dimensions. */
const UNIT5_GANG=Object.freeze({
  tips:Object.freeze({1:Object.freeze({z:0,r:92}),2:Object.freeze({z:40,r:-16}),3:Object.freeze({z:0,r:-42})}),
  extent:Object.freeze({left:-8,right:127,bottom:-83,top:128})
});
let gangFrames=[],gangPreview=null,gangView=false;
function hasUnit5Gang(){return mainKey==='600'&&role(2)==='chamfer'&&role(3)==='part';}
function buildGangFrames(){
  gangFrames=[];gangPreview=null;if(!hasUnit5Gang())return;
  let last={z:30,r:-stockInfo.rawO/2-25-UNIT5_GANG.tips[3].r},lastTool=0,located=false,origin=0;
  gangPreview={from:last,to:last,active:0,located:false,transition:false,origin:0};
  gangFrames=trace.map(s=>{
    const st=s.state,tip=UNIT5_GANG.tips[st.toolNo],known=tip&&st.X!=null&&st.Z!=null;
    if(!known){located=false;return {from:last,to:last,active:st.toolNo,located:false,transition:false,origin};}
    const to={z:zPlot(st.Z,st.zOff)-tip.z,r:st.X/2-tip.r},transition=located&&lastTool!==st.toolNo;
    const frame={from:located?last:to,to,active:st.toolNo,located:true,transition,origin:st.zOff-referenceOffset};
    last=to;lastTool=st.toolNo;located=true;origin=frame.origin;return frame;
  });
}
function gangSnapshot(index=cur,fraction=playing?animT:1){
  if(!hasUnit5Gang())return null;
  const frame=gangFrames[index]||gangPreview;if(!frame)return null;
  const s=trace[index],tip=UNIT5_GANG.tips[frame.active];let pose=frame.to;
  if(s?.seg&&tip){const p=pointAt(plotPts(s.seg),fraction);pose={z:p[0]-tip.z,r:p[1]-tip.r};}
  else if(frame.transition){pose={z:frame.from.z+(frame.to.z-frame.from.z)*fraction,r:frame.from.r+(frame.to.r-frame.from.r)*fraction};}
  return {...frame,pose,tools:Object.fromEntries(Object.entries(UNIT5_GANG.tips).map(([n,p])=>[n,{z:pose.z+p.z,r:pose.r+p.r}]))};
}
function gangBounds(full=false){
  const f=gangSnapshot(),{rawO,finO,finI,chuckFaceZ}=stockInfo,R=rawO/2;
  const nominalR=[finO/2-92,-(finO+finI)/4+16,-(rawO+10)/2+42,-(finI-5)/2+42,f.from.r,f.to.r];
  return {minA:full?Math.min(chuckFaceZ-Math.max(25,R*.65)-12,f.from.z-18,f.to.z-18):Math.min(f.origin-100,f.from.z-18,f.to.z-18),
    maxA:Math.max(f.origin+166,f.from.z+142,f.to.z+142),
    minB:Math.min(-R*1.5,Math.min(...nominalR)-95),maxB:Math.max(R*1.5,Math.max(...nominalR)+145)};
}
function isGangTransition(index){return hasUnit5Gang()&&!!gangFrames[index]?.transition;}
function drawUnit5Gang(){
  const f=gangSnapshot();if(!f)return;
  const x=z=>sx(f.pose.z+z),y=r=>sy(f.pose.r+r),active=n=>f.active===n&&f.located;
  const block=(z,r,w,h,fill,stroke='#7890a3')=>{ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.fillRect(x(z),y(r),w*SC,h*SC);ctx.strokeRect(x(z),y(r),w*SC,h*SC);};
  const diamond=(z,r,n)=>{ctx.fillStyle=color(n);ctx.strokeStyle='#101923';ctx.beginPath();ctx.moveTo(x(z-3),y(r));ctx.lineTo(x(z),y(r+3));ctx.lineTo(x(z+3),y(r));ctx.lineTo(x(z),y(r-3));ctx.closePath();ctx.fill();ctx.stroke();};
  ctx.save();ctx.beginPath();ctx.rect(25,28,CW-40,CH-62);ctx.clip();
  // One plate and one carriage. All holder geometry uses this same translated frame.
  block(110,126,16,207,'#1c2a37','#465d70');
  block(77,124,34,203,'#394b5b','#90a2b2');
  block(82,120,7,195,'#536878','#273747');
  for(const r of [113,67,22,-30,-69]){ctx.fillStyle='#14202c';ctx.beginPath();ctx.arc(x(104),y(r),Math.max(2,2.7*SC),0,Math.PI*2);ctx.fill();}
  for(const r of [66,-32,-66])block(68,r,24,6,'#b77037','#d99c65');
  // T1: upper compound boring head with two inserts.
  ctx.globalAlpha=active(1)?1:.64;
  block(24,115,54,43,'#425667',color(1));block(0,101,39,17,'#738697',color(1));
  diamond(0,92,1);diamond(0,92-(stockInfo.finO-stockInfo.finI)/2,1);
  // T2: shorter chamfer head sits farther right than the long T3 cutter.
  ctx.globalAlpha=active(2)?1:.64;
  block(54,3,24,35,'#425667',color(2));block(40,-6,18,20,'#8193a3',color(2));
  diamond(40,-12,2);diamond(40,-20,2);
  // T3: lower projecting shaft and upright parting insert.
  ctx.globalAlpha=active(3)?1:.64;
  block(7,-47,70,11,'#8396a6',color(3));block(-2,-42,9,20,'#4b6275',color(3));
  block(0,-42,Math.max(1.7,stockInfo.tip),12,color(3),'#eee4ff');
  ctx.globalAlpha=1;
  for(const [n,tip] of Object.entries(UNIT5_GANG.tips)){
    const r=n==='3'?-55:tip.r,z=95;
    ctx.fillStyle=active(Number(n))?color(n):'#1c2a36';ctx.strokeStyle=color(n);ctx.lineWidth=active(Number(n))?2:1;
    ctx.beginPath();ctx.arc(x(z),y(r),11,0,Math.PI*2);ctx.fill();ctx.stroke();
    label('T'+n,x(z),y(r)+4,active(Number(n))?'#10202a':color(n),'center',11);
  }
  if(f.located&&UNIT5_GANG.tips[f.active]){
    const p=f.tools[f.active];ctx.strokeStyle=color(f.active);ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx(p.z),sy(p.r),5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx(p.z),sy(p.r),2,0,Math.PI*2);ctx.fill();
  }
  label('공구대',x(77),y(128),'#bdcddd','left',11);
  ctx.restore();
  label(f.transition?'공구 선택 전환 · 배치 개략도':f.located?'T1 · T2 · T3 공구대 함께 이동':'공구대 배치 미리보기 · 기준점 위치 생략',CW/2,CH-42,'#b9cedd','center',CW<500?10:12);
}
