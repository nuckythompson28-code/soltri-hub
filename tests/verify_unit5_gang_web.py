"""Shared carriage, independent pneumatic T2, live NC position and view bounds."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import json,tempfile
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
out=Path(tempfile.gettempdir())/'codex_unit5_gang_review';out.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1360,'height':1100})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'simulator.html');expect(page.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    expect(page.locator('#btnGang')).to_have_attribute('aria-pressed','true')
    expect(page.locator('#gangHelp')).to_contain_text('한 공구대')
    expect(page.locator('#codePanel')).to_be_visible()
    assert page.locator('#codePanel').bounding_box()['x']>=page.locator('.right').bounding_box()['x']+page.locator('.right').bounding_box()['width']
    assert page.evaluate('Object.keys(gangSnapshot().tools).join()')=='1,2,3'
    result=page.evaluate('''()=>{
      let motions=0,transitions=0,unknown=0,actuators=0,extendedCuts=0;
      const near=(a,b)=>{if(Math.abs(a-b)>1e-7)throw Error(a+' != '+b);};
      trace.forEach((s,i)=>{
        const a=gangSnapshot(i,0),b=gangSnapshot(i,1);
        for(const f of [0,.5,1]){
          const g=gangSnapshot(i,f);
          for(const pair of [[1,3]]){
            const [u,v]=pair;
            near(g.tools[u].z-g.tools[v].z,UNIT5_GANG.tips[u].z-UNIT5_GANG.tips[v].z);
            near(g.tools[u].r-g.tools[v].r,UNIT5_GANG.tips[u].r-UNIT5_GANG.tips[v].r);
          }
          const t2Local=UNIT5_GANG.t2RetractedZ+(UNIT5_GANG.tips[2].z-UNIT5_GANG.t2RetractedZ)*g.extension;
          near(g.tools[2].z-g.pose.z,t2Local);near(g.tools[2].r-g.pose.r,UNIT5_GANG.tips[2].r);
          if(g.extension===1)near(g.tools[3].z-g.tools[2].z,2);
          if(s.seg){
            const p=pointAt(plotPts(s.seg),motionFraction(i,f)),tip=UNIT5_GANG.tips[s.state.toolNo];
            near(g.pose.z+tip.z,p[0]);near(g.pose.r+tip.r,p[1]);
            if(s.state.toolNo!==2||g.extension===1){near(g.tools[s.state.toolNo].z,p[0]);near(g.tools[s.state.toolNo].r,p[1]);}
          }
        }
        for(const t of [1,3]){near(b.tools[t].z-a.tools[t].z,b.pose.z-a.pose.z);near(b.tools[t].r-a.tools[t].r,b.pose.r-a.pose.r);}
        near(b.tools[2].z-a.tools[2].z,b.pose.z-a.pose.z+(UNIT5_GANG.tips[2].z-UNIT5_GANG.t2RetractedZ)*(b.extension-a.extension));
        if(isGangActuator(i)){
          actuators++;
          if(s.seg&&b.extension===1){near(motionFraction(i,.2),0);near(gangSnapshot(i,.4).extension,1);}
          if(s.seg&&b.extension===0){near(gangSnapshot(i,.5).extension,1);near(motionFraction(i,.8),1);}
        }
        if(s.seg?.tool===2&&s.seg.type===1){near(a.extension,1);near(b.extension,1);extendedCuts++;}
        if(s.seg)motions++;
        if(isGangTransition(i)){transitions++;if(s.seg)throw Error('Schematic transition entered NC path');}
        if(s.state.X==null||s.state.Z==null){unknown++;if(a.transition)throw Error('Invented reference motion');}
        if(s.act==='offset'&&i&&s.state.X!=null&&s.state.Z!=null){near(gangFrames[i].to.z,gangFrames[i-1].to.z);near(gangFrames[i].to.r,gangFrames[i-1].to.r);}
      });
      return {motions,transitions,unknown,actuators,extendedCuts,parts:cutEvents.length};
    }''')
    assert result['motions']>100 and result['transitions']>20 and result['unknown']>0 and result['parts']==13,result
    assert result['actuators']==26 and result['extendedCuts']==13,result
    # Follow calls, subprogram motion, loops, returns and timeline jumps without page scrolling.
    checks=page.evaluate("[trace.findIndex(s=>s.act==='call'),trace.findIndex(s=>s.prog==='9050'),cutEvents[0].index,cutEvents[1].index,cutEvents.at(-1).index,trace.findLastIndex(s=>s.act==='return'),trace.length-1]")
    for index in checks:
        page.evaluate('(i)=>{$("seek").value=i+1;$("seek").dispatchEvent(new Event("input"));}',index)
        assert page.evaluate('''()=>{
          const s=trace[cur],el=$('lineList').querySelector('.cur'),row=el.getBoundingClientRect(),box=$('lineList').getBoundingClientRect();
          return el.dataset.line===String(s.lineIdx)&&el.getAttribute('aria-current')==='step'&&
            $('runningSource').textContent===programLines[s.lineIdx].raw.trim()&&
            $('codePosition').textContent.includes('O'+s.prog.padStart(4,'0'))&&
            row.top>=box.top&&row.bottom<=box.bottom&&scrollY===0;
        }''')
        assert page.locator('#lineList .cur').count()==1
    page.locator('#btnReset').click();assert page.locator('#lineList .cur').count()==0
    indices=page.evaluate('''()=>[1,2,3].map(t=>trace.findIndex(s=>s.seg&&s.seg.tool===t&&s.seg.type===1&&s.seg.z1<=0))''')
    for tool,index in enumerate(indices,1):
        page.evaluate('(i)=>gotoStep(i)',index)
        assert page.evaluate('''()=>{const g=gangSnapshot();return Object.values(g.tools).every(p=>sx(p.z)>25&&sx(p.z)<CW-15&&sy(p.r)>28&&sy(p.r)<CH-32)}''')
        page.locator('.stage').screenshot(path=str(out/f'desktop-t{tool}.png'))
        expect(page.locator('#tool-'+str(tool))).to_have_class('tool-card active')
    page.screenshot(path=str(out/'desktop-live-program.png'),full_page=True)
    extend=page.evaluate('gangFrames.findIndex(f=>f.actuator&&f.extensionTo===1)')
    page.evaluate('(i)=>{gotoStep(i-1);play();}',extend)
    page.wait_for_function('playing&&isGangActuator(cur)&&gangSnapshot().extension>0&&gangSnapshot().extension<1')
    assert page.evaluate('$("runningSource").textContent===programLines[trace[cur].lineIdx].raw.trim()')
    expect(page.locator('#t2PneumaticStatus')).to_contain_text('전진 중')
    page.evaluate('pause()')
    for label,fraction in [('retracted',0),('extending',.2),('extended',1)]:
        page.evaluate('([i,f])=>{gotoStep(i);playing=true;animT=f;draw();updateReadouts();}',[extend,fraction])
        page.locator('.stage').screenshot(path=str(out/f't2-{label}.png'))
        page.evaluate('pause()')
    transition=page.evaluate('gangFrames.findIndex(f=>f.transition)')
    page.evaluate('(i)=>gotoStep(i-1)',transition)
    page.locator('#btnNextMove').click()
    assert page.evaluate('cur')==transition
    expect(page.locator('#stepTitle')).to_contain_text('공구대 이동')
    # Actual animation includes selection changes; it does not replace one tool with another.
    page.evaluate('(i)=>{gotoStep(i-1);play();}',transition)
    page.wait_for_function('playing&&isGangTransition(cur)&&animT>0&&animT<1')
    assert page.evaluate('Object.keys(gangSnapshot().tools).length')==3
    page.evaluate('pause()')
    page.locator('#btnFit').click();expect(page.locator('#btnFit')).to_have_attribute('aria-pressed','true')
    page.locator('#btnCoord').click();expect(page.locator('#btnCoord')).to_have_attribute('aria-pressed','true')
    page.locator('#btnGang').click();expect(page.locator('#btnGang')).to_have_attribute('aria-pressed','true')
    page.locator('#sampleSel').select_option('O8000');page.wait_for_function("mainKey==='8000'")
    expect(page.locator('#btnGang')).to_be_hidden();expect(page.locator('#gangHelp')).to_be_hidden()
    assert page.evaluate('gangFrames.length')==0
    phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=phone.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.goto(base+'simulator.html');expect(mobile.locator('#btnGang')).to_have_attribute('aria-pressed','true')
    mobile.wait_for_function('gangFrames.length>0')
    for tool,index in enumerate(indices,1):
        mobile.evaluate('(i)=>gotoStep(i)',index)
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert mobile.evaluate('''()=>{const g=gangSnapshot();return Object.values(g.tools).every(p=>sx(p.z)>25&&sx(p.z)<CW-15&&sy(p.r)>28&&sy(p.r)<CH-32)}''')
        mobile.locator('.stage').screenshot(path=str(out/f'mobile-t{tool}.png'))
    mobile.screenshot(path=str(out/'mobile-page.png'),full_page=True)
    expect(mobile.locator('#runningLocation')).to_contain_text('O9050')
    assert mobile.evaluate('$("runningSource").textContent===programLines[trace[cur].lineIdx].raw.trim()')
    mobile.evaluate('navigator.serviceWorker.ready');mobile.wait_for_function('navigator.serviceWorker.controller!==null')
    phone.set_offline(True);mobile.reload();expect(mobile.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    assert mobile.evaluate('Object.keys(gangSnapshot().tools).length')==3
    # Standalone M codes move just the head, not the carriage; T selection and comments do not actuate it.
    page.evaluate("recompute('O0600\\nG00 X-72 Z20 T02\\nM55\\nG00 Z20 (M56 IGNORED)\\nM56\\nG01 Z0 F10\\nT03\\nG00 X-90 Z20\\nM55\\nM30')")
    standalone=page.evaluate('''()=>{
      const i=gangFrames.findIndex(f=>f.actuator),a=gangSnapshot(i,0),b=gangSnapshot(i,1);
      if(trace[i].seg||a.pose.z!==b.pose.z||a.pose.r!==b.pose.r)throw Error('M56 moved carriage');
      if(!(b.tools[2].z<a.tools[2].z)||a.tools[1].z!==b.tools[1].z||a.tools[3].z!==b.tools[3].z)throw Error('Head did not move independently');
      if(trace.find(s=>s.act==='tool').state.chamferExtended!==true)throw Error('T selection retracted head');
      if(gangFrames.filter(f=>f.actuator).length!==2)throw Error('Incorrect M events');
      return i;
    }''')
    page.evaluate('(i)=>gotoStep(i-1)',standalone);page.locator('#btnNextMove').click()
    assert page.evaluate('cur')==standalone
    page.evaluate('(i)=>{gotoStep(i-1);play();}',standalone)
    page.wait_for_function('playing&&isGangActuator(cur)&&animT>0&&animT<1')
    expect(page.locator('#runningSource')).to_have_text('M56')
    page.evaluate('pause()')
    browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':result,'errors':errors,'screenshots':str(out)},ensure_ascii=False))
