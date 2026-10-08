/* 7호기 3D: NC 해석 결과만 소비하며 CNC 코드를 변경하지 않는다. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  let THREE,OrbitControls,GLTFLoader,renderer,scene,camera,controls,model,stockMesh,chuck,marker,pathLine;
  let enabled=false,ready=false,loading=null,revision=-1,lastField='',cameraReady=false,contextLost=false;
  let anchors={},setup=null,lastSnapshot=null,resizeObserver;
  let workFrame,machineBody,capacity,dimensions,chuckBody,jaws=[],wholeMachine=false;
  let stockMeasure,stockMeasureLine,stockMeasureLabel,measureText='',materialState=null;
  let viewportWidth=0,viewportHeight=0;
  const dropped=new Map();
  const equipment=window.SoltriMachineModels.KIT60G, catalog=equipment.specs, assumptions=equipment.modelAssumptions, actual=equipment.unitOverrides[7];
  const meshes=[],materialOriginal=new Map(),gapFollowers=[];let gapManual=false,displayGap=3.2;
  const stage=$('stage3d'),status=$('status3d'),button=$('btn3d');
  function say(message){status.textContent=message;}
  function eligible(){return window.SoltriSim3D?.isUnit7()===true;}
  function ui(){
    button.hidden=!eligible();
    $('unit7Controls').hidden=!eligible();
    $('kit60gDetails').hidden=!eligible();
    if(!eligible()&&enabled)toggle(false);
    button.setAttribute('aria-pressed',String(enabled));
    button.textContent=enabled?'2D 단면으로':'7호기 3D 보기';
  }
  function toggle(on){
    enabled=!!on&&eligible();ui();
    $('cv').hidden=enabled;stage.hidden=!enabled;$('unit7Details').hidden=!enabled;$('unit7ToolControls').hidden=!enabled;
    $('stockSummary3d').hidden=!enabled;
    $('btnCoord').disabled=enabled;$('btnGang').disabled=enabled;
    if(!enabled)return;
    if(contextLost){say('3D 그래픽 연결이 끊겼습니다. 2D 단면으로 확인하거나 새로고침하세요.');return;}
    if(!ready){say('Blender 모델을 불러오는 중입니다.');init().then(()=>{if(enabled){size();sync();if(new URLSearchParams(location.search).get('machineView')!=='detail')setWhole(true);else fit('front');}}).catch(error=>{say('3D를 불러오지 못했습니다. 2D는 계속 사용할 수 있습니다. '+error.message);stage.dataset.error=error.message;loading=null;});}
    else{size();sync();}
  }
  async function init(){
    if(loading)return loading;
    loading=(async()=>{
      [THREE,{OrbitControls},{GLTFLoader}]=await Promise.all([import('./vendor/three/build/three.module.js'),import('./vendor/three/examples/jsm/controls/OrbitControls.js'),import('./vendor/three/examples/jsm/loaders/GLTFLoader.js')]);
      const response=await fetch('models/unit7/setup.json');if(!response.ok)throw Error('장비 설정 파일 누락');setup=await response.json();
      geometryInfo();
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
      renderer.setClearColor(0xf1f4f7);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-label','7호기 3D 가공 화면. 드래그하여 회전, 휠로 확대');
      stage.insertBefore(renderer.domElement,status);
      renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;stage.dataset.error='WebGL context lost';say('3D 그래픽 연결이 끊겼습니다. 2D 단면으로 확인하세요.');});
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.5,12000);camera.position.set(120,180,900);
      scene.add(new THREE.HemisphereLight(0xffffff,0x7d8b9b,2.4));
      const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(-100,450,500);scene.add(sun);
      controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=35;controls.maxDistance=14000;
      controls.addEventListener('change',render);
      const loader=new GLTFLoader();
      const [asset,body]=await Promise.all([loader.loadAsync('models/unit7/carriage.glb'),loader.loadAsync('models/kit60g/context.glb')]);
      workFrame=new THREE.Group();scene.add(workFrame);
      model=asset.scene;workFrame.add(model);
      machineBody=body.scene;machineBody.visible=true;scene.add(machineBody);
      machineBody.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.userData.baseOpacity=1;}});
      model.traverse(o=>{
        if(o.userData.gapFollower)gapFollowers.push({node:o,baseY:o.position.y,baseGap:o.userData.baseGapMm});
        if(o.isMesh){o.material=o.material.clone();materialOriginal.set(o,o.material.clone());meshes.push(o);}
      });
      model.updateMatrixWorld(true);
      for(let t=1;t<=3;t++){
        const node=model.getObjectByName('ANCHOR_T'+t);if(!node)throw Error('공구 기준점 누락 T'+t);
        anchors[t]=node.getWorldPosition(new THREE.Vector3());
        const expected=setup.anchors[t];if(anchors[t].distanceTo(new THREE.Vector3(expected.x,expected.y,expected.z))>.05)throw Error('모델 단위 또는 기준점 불일치');
      }
      for(const [t,title] of [[1,'T1 · 90° 보링'],[2,'T2 · 2mm 절단날'],[3,'T3 · 오토링크']]){const a=anchors[t];const label=textSprite(title,[a.x+(t===2?-55:30),a.y+(t===1?-55:45),a.z+20],100);label.userData.toolLabel=true;model.add(label);}
      stockMesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0xdca44c,roughness:.55,metalness:.08,side:THREE.DoubleSide}));workFrame.add(stockMesh);
      stockMesh.name='Remaining full-length material';
      stockMeasure=new THREE.Group();workFrame.add(stockMeasure);
      stockMeasureLine=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x8d570b,depthTest:false}));stockMeasureLine.renderOrder=90;stockMeasure.add(stockMeasureLine);
      chuck=new THREE.Group();chuck.name='Unit7 chuck diameter300 bodywidth130';workFrame.add(chuck);
      const cr=actual.chuckDiameterMm/2, cd=actual.chuckBodyWidthMm, bore=33;
      chuckBody=new THREE.Mesh(new THREE.LatheGeometry([[bore,-cd],[cr,-cd],[cr,0],[bore,0],[bore,-cd]].map(p=>new THREE.Vector2(...p)),64),new THREE.MeshStandardMaterial({color:0x68798b,roughness:.4,metalness:.65}));
      chuckBody.rotation.z=-Math.PI/2;chuckBody.position.x=-32;chuck.add(chuckBody);
      for(let i=0;i<3;i++){const jaw=new THREE.Mesh(new THREE.BoxGeometry(32,28,36),new THREE.MeshStandardMaterial({color:0xaeb9c3,roughness:.4,metalness:.7}));chuck.add(jaw);jaws.push(jaw);}
      workFrame.rotation.x=-THREE.MathUtils.degToRad(catalog.bedSlantDeg);
      capacity=makeCapacity();scene.add(capacity);capacity.visible=false;
      dimensions=makeDimensions();scene.add(dimensions);dimensions.visible=false;
      marker=new THREE.Mesh(new THREE.SphereGeometry(1.5,16,12),new THREE.MeshBasicMaterial({color:0xea4840,depthTest:false}));marker.renderOrder=99;workFrame.add(marker);
      pathLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x1c69bc}));workFrame.add(pathLine);
      const axis=new THREE.AxesHelper(30);axis.name='Axes';scene.add(axis);axis.visible=false;
      resizeObserver=new ResizeObserver(size);resizeObserver.observe(stage);
      ready=true;stage.dataset.ready='true';appearance();size();
    })();return loading;
  }
  function appearance(){
    if(!model)return;
    for(const o of meshes){
      const original=materialOriginal.get(o);const isHose=o.userData.role==='hose'||/HOSE|SLEEVE|INTERIOR/.test(o.name);
      o.visible=!isHose||$('showHose3d').checked;
      o.material.opacity=$('ghost3d').checked && !isHose && o.userData.role!=='cutting' ? .24 : 1;
      o.material.transparent=o.material.opacity<1;o.material.depthWrite=!o.material.transparent;
      o.material.color.copy(original.color);o.material.needsUpdate=true;
    }
    machineBody?.traverse(o=>{if(o.isMesh){o.material.opacity=$('ghost3d').checked ? .32 : 1;o.material.transparent=o.material.opacity<1;o.material.depthWrite=!o.material.transparent;}});
    // Show the complete bar through the chuck in the existing transparent view.
    for(const o of [chuckBody,...jaws])if(o){o.material.opacity=$('ghost3d').checked?.22:1;o.material.transparent=o.material.opacity<1;o.material.depthWrite=!o.material.transparent;}
    render();
  }
  function size(){
    if(!renderer||!enabled)return;
    const w=stage.clientWidth,h=stage.clientHeight;if(w<1||h<1)return;
    const changed=viewportWidth>0&&(Math.abs(w-viewportWidth)>2||Math.abs(h-viewportHeight)>2);
    viewportWidth=w;viewportHeight=h;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    if(changed&&cameraReady&&lastSnapshot)fit(wholeMachine?'iso':'front');else render();
  }
  function tubeGeometry(xs,outer,inner,origin=0){
    const pos=[],idx=[],N=48,L=xs.length;
    for(let i=0;i<L;i++)for(let side=0;side<2;side++)for(let k=0;k<N;k++){
      const a=2*Math.PI*k/N,r=(side?inner:outer)[i];pos.push(xs[i]-origin,r*Math.cos(a),r*Math.sin(a));
    }
    for(let i=0;i<L-1;i++)for(let side=0;side<2;side++)for(let k=0;k<N;k++){
      const a=i*N*2+side*N+k,b=i*N*2+side*N+(k+1)%N,c=a+N*2,d=b+N*2;
      if(!side)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);
    }
    for(const i of [0,L-1])for(let k=0;k<N;k++){
      const a=i*N*2+k,b=i*N*2+(k+1)%N,c=a+N,d=b+N;idx.push(a,c,b,b,c,d);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  function surface(s){
    const f=s.material;if(!f)return;materialState=f;
    const key=`${s.revision}:${s.index}:${Math.round(s.fraction*90)}:${f.parts.length}`;if(lastField===key)return;lastField=key;
    const xs=[],outer=[],inner=[];
    const end=Math.min(f.nz,Math.max(0,Math.floor((f.freeEnd-f.z0)/f.dz)));
    const same=(a,b)=>Math.abs(f.outer[a]-f.outer[b])<1e-6&&Math.abs(f.inner[a]-f.inner[b])<1e-6;
    const add=(x,j)=>{xs.push(x);outer.push(f.outer[j]);inner.push(f.inner[j]);};
    // Preserve every profile change, including the 2 mm kerf; only omit the
    // interior of perfectly straight sections. Endpoints retain exact length.
    for(let j=0;j<=end;j++)if(j===0||j===end||!same(j,j-1)||!same(j,Math.min(j+1,end)))add(f.z0+j*f.dz,j);
    if(xs.length&&Math.abs(xs.at(-1)-f.freeEnd)>1e-7)add(f.freeEnd,end);
    stockMesh.visible=xs.length>=2&&f.remainingLength>1e-6;
    if(stockMesh.visible){stockMesh.geometry.dispose();stockMesh.geometry=tubeGeometry(xs,outer,inner);}
    chuck.position.set(s.stock.chuckFaceZ,0,0);
    const open=s.frame?.state.mainChuck==='open';
    chuckBody.material.color.set(open?0xb98869:0x68798b);
    jaws.forEach((jaw,i)=>{const angle=i*2*Math.PI/3,r=s.stock.rawO/2+14+(open?8:0);jaw.position.set(-16,r*Math.cos(angle),r*Math.sin(angle));jaw.rotation.x=angle;});
    machineBody.position.x=s.stock.chuckFaceZ;capacity.position.x=s.stock.chuckFaceZ;dimensions.position.x=s.stock.chuckFaceZ;
    showStockMeasure(s,f);
  }
  function disposeLabel(label){if(!label)return;label.material.map?.dispose();label.material.dispose();label.removeFromParent();}
  function showStockMeasure(s,f){
    const y=s.stock.rawO/2+38,z=s.stock.rawO/2+8,front=f.freeEnd,back=f.z0;
    stockMeasure.visible=stockMesh.visible;
    const points=[[back,y,z],[front,y,z],[back,y-6,z],[back,y+6,z],[front,y-6,z],[front,y+6,z]].map(p=>new THREE.Vector3(...p));
    stockMeasureLine.geometry.dispose();stockMeasureLine.geometry=new THREE.BufferGeometry().setFromPoints(points);
    const label=`${f.remainingLength.toFixed(2).replace(/\.?0+$/,'')} mm`;
    if(label!==measureText){measureText=label;disposeLabel(stockMeasureLabel);stockMeasureLabel=textSprite(label,[0,0,0],120);stockMeasure.add(stockMeasureLabel);}
    stockMeasureLabel.position.set((back+front)/2,y+16,z);
    const count=f.parts.filter(p=>p.kind!=='scrap').length,scraps=f.parts.length-count;
    $('stockSummary3d').innerHTML=`<span>입력 전장 <strong>${s.stock.totalLength.toFixed(2).replace(/\.?0+$/,'')} mm</strong></span><span>남은 소재 <strong>${f.remainingLength.toFixed(2)} mm</strong></span><span>누적 인출 ${f.totalPull.toFixed(2)} mm</span><span>분리 제품 <strong>${count}개</strong>${scraps?` · 자투리 ${scraps}개`:''}</span><small>척 뒤 소재까지 포함 · 전장 = #101 + #102 · 낙하는 이해를 위한 표현이며 충돌·실제 가공시간 검증은 아닙니다.</small>`;
  }
  function clearDrops(){for(const item of dropped.values()){item.mesh.removeFromParent();item.mesh.geometry.dispose();item.mesh.material.dispose();}dropped.clear();}
  function fallingParts(s){
    const keep=new Set();
    for(const part of s.material?.parts||[]){
      const age=Math.max(0,s.visualTime-window.SoltriSim3D.eventTime(part.index,part.fraction));
      // Once below the machine the piece is outside this view. Its record stays
      // in the deterministic material timeline, so seeking restores it exactly.
      if(age>1.2)continue;
      keep.add(part.id);let item=dropped.get(part.id);
      if(!item){
        const center=(part.zStart+part.zEnd)/2;
        const mesh=new THREE.Mesh(tubeGeometry(part.zs,part.outer,part.inner,center),stockMesh.material.clone());
        mesh.name=part.kind==='scrap'?'Detached facing scrap':'Detached product';
        mesh.material.color.set(part.kind==='scrap'?0xbc9556:0xeeb557);scene.add(mesh);
        item={id:part.id,mesh,center,age:0,kind:part.kind,width:part.zEnd-part.zStart};dropped.set(part.id,item);
      }
      item.age=age;
      // Scene Y is vertical; workFrame Y is tilted by the 45-degree bed.
      // Deliberately slow the illustrative fall so a thin ring remains visible
      // while the tool retracts. This is presentation time, not measured motion.
      item.mesh.position.set(item.center,-.5*2400*age*age,0);
      item.mesh.rotation.set(workFrame.rotation.x,Math.min(.85,age*2.5),Math.min(.45,age*.9));
    }
    for(const [id,item] of dropped)if(!keep.has(id)){item.mesh.removeFromParent();item.mesh.geometry.dispose();item.mesh.material.dispose();dropped.delete(id);}
  }
  function activePath(s){
    const p=s.segmentPoints||[];const points=p.map(([x,y])=>new THREE.Vector3(x,y,1));
    pathLine.visible=points.length>1;if(points.length>1){pathLine.geometry.dispose();pathLine.geometry=new THREE.BufferGeometry().setFromPoints(points);}
  }
  function sync(){
    if(!enabled||!ready||contextLost)return;
    const s=window.SoltriSim3D.snapshot();if(!s.unit7)return;
    lastSnapshot=s;if(revision!==s.revision){revision=s.revision;lastField='';cameraReady=false;clearDrops();}
    adjustGap(s);surface(s);fallingParts(s);activePath(s);
    const state=s.frame?.state||{},tool=state.toolNo||1,anchor=anchors[tool]||anchors[1];
    const known=!!s.point;let p=s.point;
    if(s.index<0)p=[25,s.stock.rawO/2+22]; // explicit layout preview before NC positioning
    model.visible=!!p;
    marker.visible=known;
    if(p){
      model.position.set(p[0]-anchor.x,p[1]-anchor.y,-anchor.z);
      if(known)marker.position.set(p[0],p[1],0);
    }
    const pstate=state.brakeUp?'상승 M53':'하강 M54';
    say(s.index<0?'배치 미리보기 · 재생하면 NC 좌표와 연결됩니다.':!known?'기계 복귀/좌표 설정 중 · 실제 복귀 위치가 없어 공구대 위치를 생략합니다.':`T${tool} 기준점 추종 · 보링바 ${pstate} · 오토링크 ${state.alClamp==='closed'?'잡음':'열림'} · M코드 상태만 표시`);
    stage.dataset.tool=String(tool);stage.dataset.located=String(known);stage.dataset.index=String(s.index);
    // Debug interface supports automated invariants, not hidden CNC corrections.
    window.Unit7View.debug={position:model.position.toArray(),anchor:anchor.toArray(),target:p,located:known,revision,index:s.index,brakeUp:state.brakeUp,clamp:state.alClamp,anchors,model,chuckRadius:actual.chuckDiameterMm/2,chuckBodyWidth:actual.chuckBodyWidthMm,bedAngle:catalog.bedSlantDeg,wholeMachine,machineBody,workFrame,displayGap,setup,stockMesh,materialState,fallingParts:[...dropped.values()],visualTime:s.visualTime,chuck};
    if(!cameraReady){fit('front');cameraReady=true;}
    render();
  }
  function render(){if(renderer&&enabled&&ready&&!contextLost){
    scene.updateMatrixWorld(true);
    scene.traverse(o=>{if(o.isSprite&&o.userData.labelAspect){const distance=camera.position.distanceTo(o.getWorldPosition(new THREE.Vector3()));const h=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*24/Math.max(stage.clientHeight,1);o.scale.set(h*o.userData.labelAspect,h,1);}});
    renderer.render(scene,camera);
  }}
  function fit(view='front'){
    if(!ready)return;
    const s=lastSnapshot||window.SoltriSim3D.snapshot();if(!s.stock)return;
    scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(chuck);box.union(new THREE.Box3().setFromObject(stockMesh));
    box.union(new THREE.Box3().setFromObject(stockMeasure));
    // Keep a little vertical room for the detached ring in the machining view.
    if(!wholeMachine)box.expandByPoint(new THREE.Vector3(s.stock.chuckFaceZ/2,-190,0));
    if(wholeMachine&&machineBody.visible){box.union(new THREE.Box3().setFromObject(machineBody));box.expandByScalar(140);}
    if($('capacity3d').checked)box.union(new THREE.Box3().setFromObject(capacity));
    if(model.visible)box.union(new THREE.Box3().setFromObject(model));
    const center=box.getCenter(new THREE.Vector3()),span=box.getSize(new THREE.Vector3());
    const distance=Math.max(140,span.y,span.x/Math.max(camera.aspect,.2))*.5/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.25+span.z*.55;
    const direction=view==='top'?new THREE.Vector3(0,1,.001):view==='iso'?new THREE.Vector3(.48,.3,1).normalize():wholeMachine?new THREE.Vector3(0,0,1):new THREE.Vector3(0,Math.SQRT1_2,Math.SQRT1_2);
    controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);camera.up.set(0,1,0);camera.near=.5;camera.far=Math.max(12000,distance*4);camera.updateProjectionMatrix();controls.update();render();
  }
  function adjustGap(s){
    const wall=(s.stock.finO-s.stock.finI)/2;
    if(!gapManual){displayGap=Math.max(.1,Math.min(7,wall));$('boringGap3d').value=Number(displayGap.toFixed(3));}
    for(const f of gapFollowers)f.node.position.y=f.baseY+f.baseGap-displayGap;
    $('gapExplain3d').textContent=gapManual?'수동 표시값 · 실측/NC 변경 아님':wall>7?'벽두께 '+wall.toFixed(2)+'mm: 최대 7mm 초과 · 표시만 7mm 제한':'벽두께 '+wall.toFixed(2)+'mm로 가정 · 실제 날끝 간격 미확인';
  }
  function geometryInfo(){
    const u=setup.userGeometry;if(!u)return;
    $('unit7GeometryInfo').innerHTML='<section class="model-card"><h3>7호기 공구 정보 · 사용자 제공</h3><p>O0852: T1 정사각형 45° 회전 · 상부 아래 / 하부 위 꼭짓점 절삭 / T2 평균 폭 2mm 절단날 / T3 사진 빨간 원의 오토링크</p><table style="width:100%;text-align:right"><thead><tr><th>공구</th><th>형상 X</th><th>형상 Z</th></tr></thead><tbody>'+Object.entries(u.geometry).map(([n,g])=>'<tr><th>T0'+n+'</th><td>'+g.X.toFixed(3)+'</td><td>'+g.Z.toFixed(3)+'</td></tr>').join('')+'</tbody></table><p>보링 날끝 간격: 제품별 조절, 최대 7mm. 현재 표시값은 실측값이 아닙니다. 절단날 모델 폭 2mm는 NC 절단폭 설정과 별개입니다.</p><p><b>7호기 실측 척 Ø300 × 폭130mm · 공구 전체 가로/세로 300 × 300mm</b></p><p>X 형상값은 지름 기준으로 확인되었습니다. T1 기준 T2: 왼쪽52.020 / 위34.350mm, T3: 왼쪽36.020 / 위174.750mm. Z는 절반으로 나누지 않습니다.</p><p>T 선택 시 같은 공구대 위치를 유지하도록 좌표를 다시 표현합니다. 공구 홀더의 세부 형상·깊이·마모·공압 스트로크는 미확인입니다.</p><a href="'+u.photo+'" target="_blank" rel="noopener">제공 공구 사진 보기</a></section>';
  }
  function textSprite(text,position,width=300){
    const c=document.createElement('canvas');let ctx=c.getContext('2d');ctx.font='bold 48px sans-serif';c.width=Math.ceil(ctx.measureText(text).width)+40;c.height=80;ctx=c.getContext('2d');
    ctx.fillStyle='rgba(248,250,252,.94)';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#244762';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,40);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));sprite.position.set(...position);sprite.scale.set(width,width/8,1);sprite.renderOrder=100;sprite.userData.labelAspect=c.width/c.height;return sprite;
  }
  function makeDimensions(){
    const g=new THREE.Group(),a=assumptions;
    const x=-a.spindleFromLeftMm,y=-a.spindleHeightMm,z=a.spindleFromFrontMm;
    const line=(start,end)=>{g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start),new THREE.Vector3(...end)]),new THREE.LineBasicMaterial({color:0x567d99})));};
    line([x,y-75,z],[x+catalog.floorLengthMm,y-75,z]);g.add(textSprite('2,900 mm',[x+catalog.floorLengthMm/2,y+45,z],420));
    line([x-100,y,z],[x-100,y+catalog.heightMm,z]);g.add(textSprite('1,870 mm',[x-160,y+catalog.heightMm/2,z],380));
    line([x+catalog.floorLengthMm+75,y,z],[x+catalog.floorLengthMm+75,y,z-catalog.floorWidthMm]);g.add(textSprite('1,650 mm',[x+catalog.floorLengthMm+100,y+40,z-catalog.floorWidthMm/2],380));
    g.add(textSprite('KIT60G',[x+catalog.floorLengthMm/2,y+catalog.heightMm+85,z],470));return g;
  }
  function makeCapacity(){
    const g=new THREE.Group(),points=[],r=catalog.maxTurningDiameterMm/2,L=catalog.maxTurningLengthMm;
    for(const x of [0,L])for(let k=0;k<64;k++){const a=k*2*Math.PI/64,b=(k+1)*2*Math.PI/64;points.push(new THREE.Vector3(x,r*Math.cos(a),r*Math.sin(a)),new THREE.Vector3(x,r*Math.cos(b),r*Math.sin(b)));}
    for(let k=0;k<4;k++){const a=k*Math.PI/2;points.push(new THREE.Vector3(0,r*Math.cos(a),r*Math.sin(a)),new THREE.Vector3(L,r*Math.cos(a),r*Math.sin(a)));}
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x378b9b,transparent:true,opacity:.7})));
    g.add(textSprite('Ø254 × 530 mm · catalog',[L/2,r+40,0],280));return g;
  }
  function setWhole(value){
    if(!ready)return;wholeMachine=value;machineBody.visible=$('body3d').checked;dimensions.visible=value&&machineBody.visible;model.traverse(o=>{if(o.userData.toolLabel)o.visible=!value;});
    $('machine3d').setAttribute('aria-pressed',String(value));$('detail3d').setAttribute('aria-pressed',String(!value));
    sync();fit(value?'iso':'front');
  }
  window.Unit7View={sync,fit,enabled:()=>enabled,onProgram(){ui();if(!eligible())return;if($('sampleSel').value==='O0852_UNIT7'||new URLSearchParams(location.search).get('view')==='3d')toggle(true);else sync();}};
  button.onclick=()=>toggle(!enabled);
  $('boringGap3d').onchange=()=>{const value=Number($('boringGap3d').value);if(!Number.isFinite(value)||value<.1||value>7){$('boringGap3d').setCustomValidity('표시 간격은 0.1~7mm입니다.');$('boringGap3d').reportValidity();return;}$('boringGap3d').setCustomValidity('');gapManual=true;displayGap=value;sync();};
  $('gapAuto3d').onclick=()=>{gapManual=false;$('boringGap3d').setCustomValidity('');sync();};
  $('body3d').onchange=()=>{if(machineBody){machineBody.visible=$('body3d').checked;dimensions.visible=wholeMachine&&machineBody.visible;render();}};
  $('tips3d').onclick=()=>{
    if(!ready||!model.visible)return;wholeMachine=false;dimensions.visible=false;
    scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model.getObjectByName('UPPER_CARBIDE'));box.union(new THREE.Box3().setFromObject(model.getObjectByName('LOWER_CARBIDE')));
    const center=box.getCenter(new THREE.Vector3());controls.target.copy(center);camera.position.copy(center).addScaledVector(new THREE.Vector3(0,Math.SQRT1_2,Math.SQRT1_2),90);camera.updateProjectionMatrix();controls.update();
    $('machine3d').setAttribute('aria-pressed','false');$('detail3d').setAttribute('aria-pressed','false');render();
  };
  $('machine3d').onclick=()=>setWhole(true);$('detail3d').onclick=()=>setWhole(false);
  $('capacity3d').onchange=()=>{if(capacity){capacity.visible=$('capacity3d').checked;fit(wholeMachine?'iso':'front');}};
  SoltriMachineModelUI.render($('kit60gSpecs'),'KIT60G','7');
  $('front3d').onclick=()=>fit('front');$('iso3d').onclick=()=>fit('iso');$('top3d').onclick=()=>fit('top');
  $('ghost3d').onchange=appearance;$('showHose3d').onchange=appearance;
  ui();window.Unit7View.onProgram();
})();
