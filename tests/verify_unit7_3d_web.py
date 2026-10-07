from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright,expect
import tempfile,json
ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
out=Path(tempfile.gettempdir())/'unit7-3d-review';out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--use-angle=swiftshader','--enable-webgl'])
 context=browser.new_context(viewport={'width':1440,'height':1100})
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'simulator.html?program=O0852_UNIT7&view=3d')
 page.wait_for_function("mainKey==='852' && trace.length>0")
 assert page.evaluate('trace.find(s=>s.kv[130]>0).kv[130]')==7
 assert page.evaluate('profile.up===53 && profile.down===54')
 page.wait_for_function("document.getElementById('stage3d').dataset.ready==='true'||document.getElementById('stage3d').dataset.error",timeout=90000)
 assert not page.locator('#stage3d').get_attribute('data-error'),page.locator('#status3d').inner_text()
 expect(page.locator('#stage3d')).to_be_visible()
 assert page.evaluate('SoltriSim3D.isUnit7()')
 page.wait_for_function('Unit7View.debug.wholeMachine===true')
 page.locator('#detail3d').click()
 indices=page.evaluate("[1,2,3].map(t=>trace.findIndex(s=>s.seg?.tool===t))")
 for tool,index in enumerate(indices,1):
  assert index>=0, (tool,indices)
  page.evaluate('(i)=>gotoStep(i)',index)
  page.wait_for_function('(i)=>Unit7View.debug.index===i',arg=index)
  info=page.evaluate('({target:Unit7View.debug.target,position:Unit7View.debug.position,anchor:Unit7View.debug.anchor})')
  assert abs(info['position'][0]+info['anchor'][0]-info['target'][0])<1e-6
  assert abs(info['position'][1]+info['anchor'][1]-info['target'][1])<1e-6
  assert page.locator('#stage3d').get_attribute('data-tool')==str(tool)
  assert page.locator('#runningSource').inner_text().strip()
  page.screenshot(path=str(out/f'tool-{tool}.png'))
 # User-described cutting geometry and adjustable gap change the mesh, not NC.
 assert page.evaluate('Math.abs(Unit7View.debug.anchors[2].x-Unit7View.debug.anchors[1].x+52.02)<1e-5')
 assert page.evaluate('Math.abs(Unit7View.debug.anchors[3].x-Unit7View.debug.anchors[1].x+36.02)<1e-5')
 assert page.evaluate('Unit7View.debug.model.getObjectByName("UPPER_CARBIDE").userData.cornerAngleDeg')==90
 assert page.evaluate('Unit7View.debug.model.getObjectByName("LOWER_CARBIDE").userData.cornerAngleDeg')==90
 assert page.evaluate('Unit7View.debug.setup.userGeometry.geometry["2"].X')==-586.7
 assert page.evaluate('Math.abs(Unit7View.debug.anchors[2].y-Unit7View.debug.anchors[1].y-34.35)<1e-5')
 assert page.evaluate('Math.abs(Unit7View.debug.anchors[3].y-Unit7View.debug.anchors[1].y-174.75)<1e-5')
 # Check actual diamond vertices, not metadata alone. The bottom corner is the tip.
 diamonds=page.evaluate('''()=>{const m=Unit7View.debug.model;m.updateMatrixWorld(true);return ['UPPER_CARBIDE','LOWER_CARBIDE'].map(name=>{const o=m.getObjectByName(name),arr=o.geometry.attributes.position,v=o.position.clone();const pts=[];for(let i=0;i<arr.count;i++){v.fromBufferAttribute(arr,i).applyMatrix4(o.matrixWorld);m.worldToLocal(v);pts.push(v.toArray());}const front=Math.max(...pts.map(p=>p[2]));const corners=[...new Map(pts.filter(p=>Math.abs(p[2]-front)<1e-5).map(p=>[p.map(v=>v.toFixed(5)).join(','),p])).values()];return corners;});}''')
 for index,corners in enumerate(diamonds):
  assert len(corners)==4,corners
  low=min(p[1] for p in corners);high=max(p[1] for p in corners)
  left=min(p[0] for p in corners);right=max(p[0] for p in corners)
  bottom=[p for p in corners if abs(p[1]-(low if index==0 else high))<1e-5]
  assert len(bottom)==1 and abs(bottom[0][0]+12)<1e-5,corners
  assert abs((high-low)-(right-left))<1e-5,corners
  assert abs((high-low)-8*2**.5)<1e-5,corners
 envelope=page.evaluate('''()=>{const m=Unit7View.debug.model,a=m.getObjectByName('TOOLS_MIN').position,b=m.getObjectByName('TOOLS_MAX').position;return [b.x-a.x,b.y-a.y]}''')
 assert envelope==[300,300],envelope
 actual_bounds=page.evaluate('''()=>{const m=Unit7View.debug.model;m.updateMatrixWorld(true);const points=[];m.traverse(o=>{if(o.isMesh&&o.userData.role!=='hose'&&!/HOSE|SLEEVE|INTERIOR/.test(o.name)){const a=o.geometry.attributes.position,v=o.position.clone();for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);m.worldToLocal(v);points.push(v.toArray());}}});return [0,1].map(i=>Math.max(...points.map(p=>p[i]))-Math.min(...points.map(p=>p[i])))}''')
 assert all(abs(v-300)<.05 for v in actual_bounds),actual_bounds
 assert page.evaluate('Unit7View.debug.machineBody.visible'), 'enclosure must stay visible in close-up'
 # The square insert has its cutting width in axial Z, not depth toward camera.
 width=page.evaluate('''()=>{const o=Unit7View.debug.model.getObjectByName('PARTING_CARBIDE');o.geometry.computeBoundingBox();return o.geometry.boundingBox.max.x-o.geometry.boundingBox.min.x;}''')
 assert abs(width-2)<1e-6,width
 source_before=page.locator('#editor').input_value()
 count_before=page.evaluate('trace.length')
 page.locator('#boringGap3d').fill('7');page.locator('#boringGap3d').dispatch_event('change')
 gap=page.evaluate('''()=>{const m=Unit7View.debug.model;return m.getObjectByName('BORING_UPPER_TIP').position.y-m.getObjectByName('BORING_LOWER_TIP').position.y}''')
 assert abs(gap-7)<1e-6,gap
 assert page.locator('#editor').input_value()==source_before
 assert page.evaluate('trace.length')==count_before
 page.locator('#gapAuto3d').click()
 assert abs(page.evaluate('Unit7View.debug.displayGap')-3.3)<1e-6
 page.evaluate('(i)=>gotoStep(i)',indices[0]);page.locator('#front3d').click();page.locator('#showHose3d').uncheck();page.locator('#stage3d').screenshot(path=str(out/'updated-tools.png'));page.locator('#tips3d').click();page.locator('#stage3d').screenshot(path=str(out/'diamond-tips.png'));page.locator('#detail3d').click();page.locator('#showHose3d').check()
 # Catalog constraints, physical slope and preserved NC coordinates.
 assert page.evaluate('Unit7View.debug.chuckRadius')==150
 assert page.evaluate('Unit7View.debug.chuckBodyWidth')==130
 assert page.evaluate('Unit7View.debug.bedAngle')==45
 assert page.evaluate('Math.abs(Unit7View.debug.workFrame.rotation.x+Math.PI/4)<1e-9')
 page.locator('#machine3d').click()
 assert page.evaluate('Unit7View.debug.wholeMachine')
 bounds=page.evaluate('''()=>{const m=Unit7View.debug.machineBody;const lo=m.getObjectByName('ENVELOPE_MIN').position,hi=m.getObjectByName('ENVELOPE_MAX').position;return [hi.x-lo.x,hi.y-lo.y,lo.z-hi.z]}''')
 assert bounds==[2900,1870,1650],bounds
 page.locator('#capacity3d').check()
 page.locator('#stage3d').screenshot(path=str(out/'kit60g-whole.png'))
 page.locator('#front3d').click();page.locator('#stage3d').screenshot(path=str(out/'kit60g-front.png'))
 page.locator('#ghost3d').uncheck();page.locator('#iso3d').click();page.locator('#stage3d').screenshot(path=str(out/'kit60g-solid.png'))
 page.locator('#capacity3d').uncheck();page.locator('#detail3d').click()
 assert not page.evaluate('Unit7View.debug.wholeMachine')
 # Nominal chuck stays fixed when material OD changes in the same sample.
 page.locator('#editToggle').click()
 original=page.locator('#editor').input_value()
 import re
 changed=re.sub(r'(#109\s*=\s*)[0-9.]+',r'\g<1>145.',original,count=1)
 assert changed!=original
 page.locator('#editor').fill(changed);page.locator('#loadBtn').click()
 page.wait_for_function('stockInfo.rawO===145')
 assert page.evaluate('Unit7View.debug.chuckRadius')==150
 assert page.evaluate('Unit7View.debug.chuckBodyWidth')==130
 page.locator('#editor').fill(original);page.locator('#loadBtn').click();page.locator('#editToggle').click()
 # Reset during playback, seek, program re-load and camera controls.
 page.locator('#btnReset').click();page.locator('#iso3d').click();page.screenshot(path=str(out/'overview.png'))
 page.evaluate('(i)=>gotoStep(i)',indices[0]);page.locator('#btnPlay').click();page.wait_for_timeout(200)
 if page.evaluate('playing'):page.locator('#btnPlay').click()
 assert page.evaluate('!playing')
 page.locator('#btn3d').click();expect(page.locator('#cv')).to_be_visible();expect(page.locator('#stage3d')).to_be_hidden()
 page.locator('#btn3d').click();expect(page.locator('#stage3d')).to_be_visible()
 page.locator('#sampleSel').select_option('O0600');page.wait_for_function("mainKey==='600'")
 expect(page.locator('#btn3d')).to_be_hidden();expect(page.locator('#cv')).to_be_visible()
 page.locator('#sampleSel').select_option('O0852_UNIT7');page.wait_for_function('SoltriSim3D.isUnit7()&&Unit7View.enabled()')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 page.screenshot(path=str(out/'mobile.png'),full_page=True)
 # Installed offline resources include model, renderer, control and parser.
 page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
 context.set_offline(True);page.reload()
 page.wait_for_function("document.getElementById('stage3d').dataset.ready==='true'||document.getElementById('stage3d').dataset.error",timeout=90000)
 assert not page.locator('#stage3d').get_attribute('data-error'),page.locator('#status3d').inner_text()
 context.set_offline(False)
 browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['KIT60G 2900/1650/1870 envelope','45 degree view transform','actual 300x130 chuck across stock diameters','whole/detail views','machine7 M53/M54','GLB anchor units','T1/T2/T3 coordinate following','source sync','2D switch','unit5 isolation','390px','offline'],'screenshots':str(out)}))