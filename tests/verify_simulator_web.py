"""Browser checks for Soltri presets, file import, controls, mobile and offline use."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json, tempfile
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=Path(tempfile.gettempdir())/'codex_soltri_simulator_review'
out.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1100})
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'simulator.html')
    expect(page.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    expect(page.locator('#codePanel')).to_be_hidden()
    expect(page.locator('#btnNextPull')).to_be_hidden()
    assert page.evaluate('stockInfo.rawO')==80
    assert page.evaluate('stockInfo.rawI')==68
    assert page.evaluate('cutEvents.length')==13
    assert page.evaluate('trace.find(s=>s.kv[121]!=null).kv[121]')==0
    expect(page.locator('#tool-2')).to_contain_text('면취기')
    expect(page.locator('#tool-3')).to_contain_text('절단')
    assert page.evaluate("role(2)")=="chamfer"
    page.screenshot(path=str(out/'desktop-ready.png'),full_page=True)
    page.locator('#btnPlay').click()
    page.wait_for_function("trace[cur]?.act==='stop'&&!playing")
    expect(page.locator('#stepTitle')).to_contain_text('M00')
    page.locator('#btnNextCut').click()
    expect(page.locator('#hStock')).to_have_text('1 / 13')
    expect(page.locator('#stepDetail')).to_contain_text('아래에서 위로')
    assert page.evaluate('trace[cur].seg.tool')==3
    assert page.evaluate('sy(currentToolPlot()[1])>sy(0)')
    assert page.evaluate('computeStockField().freeEnd')<0
    assert page.evaluate('Math.max(...computeStockField().outer)')>30
    page.screenshot(path=str(out/'desktop-cut.png'),full_page=True)
    page.locator('#btnCoord').click()
    expect(page.locator('#btnCoord')).to_have_attribute('aria-pressed','true')
    page.screenshot(path=str(out/'desktop-focus.png'),full_page=True)
    page.locator('#codeToggle').click()
    expect(page.locator('#codePanel')).to_be_visible()
    page.locator('#btnNext').click()
    assert page.locator('#lineList .cur').count()==1
    page.locator('#editToggle').click()
    expect(page.locator('#editor')).to_be_visible()
    page.locator('#editToggle').click()
    page.locator('#codeToggle').click()
    for key,main,raw,count in [('O0500','500',80,13),('O2026','2026',145,20),('O0400','400',80,13),('O8000','8000',80,13),('O0852','852',70,50)]:
        page.locator('#sampleSel').select_option(key)
        page.wait_for_function('(k)=>mainKey===k&&document.querySelector("#loadStatus").textContent.includes("불러옴")',arg=main)
        assert page.evaluate('stockInfo.rawO')==raw,(key,page.evaluate('stockInfo'))
        assert page.evaluate('cutEvents.length')==count,(key,page.evaluate('cutEvents.length'))
        page.locator('#btnNextCut').click()
        if key=='O0500':
            assert page.evaluate('trace.find(s=>s.kv[121]!=null).kv[121]')==3
            assert page.evaluate('profile.tools[3]==null')
        if key=='O8000':
            expect(page.locator('#tool-2')).to_contain_text('면취')
            expect(page.locator('#tool-3')).to_contain_text('절단')
            expect(page.locator('#btnNextPull')).to_be_hidden()
            assert page.evaluate('trace[cur].seg.tool')==3
        if key=='O0852':
            expect(page.locator('#btnNextPull')).to_be_visible()
            page.locator('#btnNextPull').click()
            expect(page.locator('#stepTitle')).to_contain_text('인출')
    # The user can select the two O0600 files in any order.
    files=[str(root/'programs/o0600'/f'{name}.nc') for name in ['O9050','O0600']]
    page.locator('#fileIn').set_input_files(files)
    page.wait_for_function("mainKey==='600'&&cutEvents.length===13")
    page.locator('#fileIn').set_input_files(str(root/'programs/o0600/O0600.nc'))
    expect(page.locator('#loadStatus')).to_contain_text('서브 파일이 없습니다')
    page.locator('#sampleSel').select_option('O0600')
    page.wait_for_function("cutEvents.length===13")
    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('navigator.serviceWorker.controller!==null')
    context.set_offline(True)
    page.reload()
    expect(page.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    context.set_offline(False)
    phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=phone.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.goto(base+'simulator.html')
    expect(mobile.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    expect(mobile.locator('#btnCoord')).to_have_attribute('aria-pressed','true')
    mobile.locator('#btnNextCut').click()
    mobile.screenshot(path=str(out/'mobile-cut.png'),full_page=True)
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert mobile.locator('#cv').bounding_box()['height']>=300
    mobile.locator('#codeToggle').click()
    expect(mobile.locator('#codePanel')).to_be_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.locator('#sampleSel').select_option('O8000')
    mobile.wait_for_function("mainKey==='8000'")
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['6 machine presets','correct stock dimensions','lower parting','M00 pause','code drawer','focus view','two-file O0600 import','missing subprogram','offline reload','390px mobile'], 'errors':errors,'screenshots':str(out)},ensure_ascii=False))
