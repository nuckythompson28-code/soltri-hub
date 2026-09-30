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
out=Path(tempfile.gettempdir())/'s3-o2028-review';out.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    context=browser.new_context(viewport={'width':1440,'height':1000})
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'machines.html#m13')
    expect(page.locator('#linkSlot [data-program="O2028"]')).to_be_visible()
    page.goto(base+'o2028.html');expect(page.locator('.program-location')).to_contain_text('13호기')
    expect(page.locator('.notice')).to_contain_text('소재 외경·내경 미확정')
    assert page.locator('details').count()==7
    page.screenshot(path=str(out/'registration.png'),full_page=True)
    page.goto(base+'simulator.html?program=O2028')
    page.wait_for_function("mainKey==='2028' && trace.length>0")
    expect(page.locator('#programNotice')).to_be_visible()
    expect(page.locator('#programNotice')).to_contain_text('가상값')
    assert page.evaluate('stockInfo.target')==22
    assert page.evaluate('cutEvents.length')==22
    assert page.evaluate('profile.up')==54
    assert page.evaluate('profile.partTool')==2
    assert page.evaluate('hasUnit5Gang()') is False
    assert page.locator('#programTabs button').count()==7
    page.evaluate("cur=trace.findIndex(s=>s.prog==='6003'&&s.seg?.type===1);updateAll();draw()")
    expect(page.locator('#lineList')).to_contain_text('O6003')
    page.screenshot(path=str(out/'groove.png'))
    page.locator('#sampleSel').select_option('O2028_ORIGINAL')
    page.wait_for_function('stockInfo.rawO===145')
    expect(page.locator('#programNotice')).to_contain_text('제공 파일')
    page.locator('#sampleSel').select_option('O0600')
    page.wait_for_function("mainKey==='600'")
    expect(page.locator('#programNotice')).to_be_hidden()
    page.goto(base+'simulator.html?program=O2028')
    page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
    context.set_offline(True);page.reload();page.wait_for_function("mainKey==='2028' && trace.length>0")
    page.goto(base+'o2028.html');expect(page.locator('.notice')).to_be_visible();context.set_offline(False)
    for url in ['o2028.html','simulator.html?program=O2028']:
        page.set_viewport_size({'width':390,'height':844});page.goto(base+url)
        if url.startswith('simulator'):page.wait_for_function("mainKey==='2028'&&trace.length>0")
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),url
        page.screenshot(path=str(out/('mobile-sim.png' if url.startswith('simulator') else 'mobile-page.png')))
    browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['S3 registration/archive','7 program tabs','22 cuts','groove source following','virtual-stock warning','original mode','unit5 isolation','offline','390px'],'screenshots':str(out)}))
