"""Check V2 explanations, navigation, downloads and mobile layout."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from threading import Thread
import tempfile,json
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[1]
out=Path(tempfile.gettempdir())/'codex_o0500_v2_review';out.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write'])
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'o0500.html');expect(page.locator('#copy-source')).to_be_enabled()
    expect(page.locator('#page-overview')).to_contain_text('T3 면취기')
    page.locator('#copy-source').click();expect(page.locator('#copy-status')).to_contain_text('2개 프로그램')
    assert page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')==(root/'programs/o0500-unit5.nc').read_text(encoding='ascii')
    page.screenshot(path=str(out/'desktop.png'))
    page.locator('#nav a[href="#O0500"]').click()
    page.locator('#page-O0500 .jump[href="#O9050"]').click()
    expect(page.locator('#page-O9050')).to_be_visible()
    page.locator('#page-O9050 .jump[href="#O9050:N320"]').first.click()
    expect(page.locator('#page-O9050 .explain')).to_contain_text('T03')
    page.locator('#page-O9050 [data-code="T03"]').first.click()
    expect(page.locator('#page-O9050 .explain')).to_contain_text('면취기')
    expect(page.locator('#page-O9050 a[href="programs/o0500/O9050.txt"]')).to_be_visible()
    page.locator('#nav a[href="#vars"]').click();page.locator('#var-search').fill('#121')
    expect(page.locator('#variable-rows')).to_contain_text('짧은 소재')
    page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
    context.set_offline(True);page.goto(base+'o0500.html');expect(page.locator('#copy-source')).to_be_enabled();context.set_offline(False)
    phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=phone.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.goto(base+'o0500.html');expect(mobile.locator('#copy-source')).to_be_enabled()
    for section in ['setup','O0500','O9050','vars','validation','overview']:
        mobile.locator('#menuBtn').click();mobile.locator(f'#nav a[href="#{section}"]').click()
        expect(mobile.locator('#page-'+section)).to_be_visible()
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),section
    mobile.wait_for_function("document.getElementById('sidebar').getBoundingClientRect().right<=0.5")
    mobile.screenshot(path=str(out/'mobile.png'))
    browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['V2 source/copy','2 program pages','T3 explanation','TXT link','variable search','offline','mobile'], 'screenshots':str(out),'errors':errors},ensure_ascii=False))
