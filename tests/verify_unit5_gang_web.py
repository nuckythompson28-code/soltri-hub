"""Rigid shared carriage, schematic tool transitions, unchanged NC paths and view bounds."""
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
    assert page.evaluate('Object.keys(gangSnapshot().tools).join()')=='1,2,3'
    result=page.evaluate('''()=>{
      let motions=0,transitions=0,unknown=0;
      const near=(a,b)=>{if(Math.abs(a-b)>1e-7)throw Error(a+' != '+b);};
      trace.forEach((s,i)=>{
        const a=gangSnapshot(i,0),b=gangSnapshot(i,1);
        for(const f of [0,.5,1]){
          const g=gangSnapshot(i,f);
          for(const pair of [[1,2],[2,3],[1,3]]){
            const [u,v]=pair;
            near(g.tools[u].z-g.tools[v].z,UNIT5_GANG.tips[u].z-UNIT5_GANG.tips[v].z);
            near(g.tools[u].r-g.tools[v].r,UNIT5_GANG.tips[u].r-UNIT5_GANG.tips[v].r);
          }
          if(s.seg){const p=pointAt(plotPts(s.seg),f);near(g.tools[s.state.toolNo].z,p[0]);near(g.tools[s.state.toolNo].r,p[1]);}
        }
        for(const t of [1,2,3]){near(b.tools[t].z-a.tools[t].z,b.pose.z-a.pose.z);near(b.tools[t].r-a.tools[t].r,b.pose.r-a.pose.r);}
        if(s.seg)motions++;
        if(isGangTransition(i)){transitions++;if(s.seg)throw Error('Schematic transition entered NC path');}
        if(s.state.X==null||s.state.Z==null){unknown++;if(a.transition)throw Error('Invented reference motion');}
        if(s.act==='offset'&&i&&s.state.X!=null&&s.state.Z!=null){near(gangFrames[i].to.z,gangFrames[i-1].to.z);near(gangFrames[i].to.r,gangFrames[i-1].to.r);}
      });
      return {motions,transitions,unknown,parts:cutEvents.length};
    }''')
    assert result['motions']>100 and result['transitions']>20 and result['unknown']>0 and result['parts']==13,result
    indices=page.evaluate('''()=>[1,2,3].map(t=>trace.findIndex(s=>s.seg&&s.seg.tool===t&&s.seg.type===1&&s.seg.z1<=0))''')
    for tool,index in enumerate(indices,1):
        page.evaluate('(i)=>gotoStep(i)',index)
        assert page.evaluate('''()=>{const g=gangSnapshot();return Object.values(g.tools).every(p=>sx(p.z)>25&&sx(p.z)<CW-15&&sy(p.r)>28&&sy(p.r)<CH-32)}''')
        page.locator('.stage').screenshot(path=str(out/f'desktop-t{tool}.png'))
        expect(page.locator('#tool-'+str(tool))).to_have_class('tool-card active')
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
    mobile.evaluate('navigator.serviceWorker.ready');mobile.wait_for_function('navigator.serviceWorker.controller!==null')
    phone.set_offline(True);mobile.reload();expect(mobile.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    assert mobile.evaluate('Object.keys(gangSnapshot().tools).length')==3
    browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':result,'errors':errors,'screenshots':str(out)},ensure_ascii=False))
