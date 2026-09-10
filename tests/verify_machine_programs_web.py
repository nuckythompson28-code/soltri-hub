"""Check machine-first navigation without altering any CNC source."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
import json,tempfile
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
out=Path(tempfile.gettempdir())/'codex_machine_directory_review';out.mkdir(exist_ok=True)
expected={'1':'O0852','2':'O0400','3':'O8000','4':None,'5':'O0600','6':'O8000','7':'O0852','8':'O0852','9':'O0852','10':'O0852','13':'O0400','14':'O0852'}
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1280,'height':1100})
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'index.html')
    expect(page.locator('[data-machine-directory] .assignment-tile')).to_have_count(12)
    assert not page.locator('a.card[href^="o0"],a.card[href="o8000.html"]').count()
    for number,program in expected.items():
        expect(page.locator(f'[data-machine="{number}"] .program-id')).to_have_text(program or '미배정')
    page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
    page.locator('[data-machine="5"]').click()
    expect(page.locator('#dNo')).to_have_text('5')
    expect(page.locator('#linkSlot>.assignment-card')).to_have_count(1)
    expect(page.locator('#linkSlot>.assignment-card')).to_have_attribute('data-program','O0600')
    expect(page.locator('#linkSlot>.assignment-card')).to_contain_text('T2 면취기 → T3')
    expect(page.locator('#linkSlot>.assignment-card .assignment-set')).to_contain_text('O9050')
    expect(page.locator('[data-program="O0500"]')).to_be_hidden()
    expect(page.locator('[data-program="O2026"]')).to_be_hidden()
    expect(page.locator('a[href="programs/o0600/O0600.txt"]')).to_be_visible()
    expect(page.locator('a[href="programs/o0600/O9050.txt"]')).to_be_visible()
    page.screenshot(path=str(out/'unit5-desktop.png'),full_page=True)
    page.locator('#archived-programs summary').click()
    expect(page.locator('[data-program="O0500"]')).to_contain_text('보관본')
    expect(page.locator('[data-program="O0500"]')).to_contain_text('O9034')
    page.locator('#item-programs summary').click()
    expect(page.locator('[data-program="O2026"]')).to_contain_text('O2027')
    page.locator('#machine-codes summary').click()
    expect(page.locator('#mc')).to_contain_text('M171')
    expect(page.locator('#mc')).to_contain_text('프로그램 종료')
    page.locator('[data-program="O0600"] a.primary').click()
    expect(page.locator('.program-location')).to_contain_text('5호기 · O0600')
    expect(page.locator('#copy-source')).to_be_enabled()
    page.locator('.program-location a[href="machines.html#m5"]').click()
    expect(page.locator('#dNo')).to_have_text('5')
    for number,program in expected.items():
        page.goto(base+'machines.html#m'+number)
        expect(page.locator('#dNo')).to_have_text(number)
        if program:
            expect(page.locator('#linkSlot>.assignment-card')).to_have_attribute('data-program',program)
            expect(page.locator('#linkSlot>.assignment-card a.primary')).to_have_attribute('href',program.lower()+'.html?machine='+number)
        else:
            expect(page.locator('#linkSlot')).to_contain_text('배정된 프로그램이 없습니다')
            expect(page.locator('#linkSlot .assignment-card')).to_have_count(0)
    page.goto(base+'o8000.html?machine=3')
    expect(page.locator('.program-location')).to_contain_text('3호기 · O8000')
    expect(page.locator('.program-location')).to_contain_text('6호기 기준')
    expect(page.locator('.program-location')).to_contain_text('M08/M09')
    page.goto(base+'o0852.html?machine=1')
    expect(page.locator('.program-location')).to_contain_text('#130=1.')
    expect(page.locator('.program-location')).to_contain_text('기본값은 #130=10')
    page.goto(base+'o0600.html?machine=6')
    expect(page.locator('.program-location strong')).to_have_text('5호기 · O0600 · 배정 프로그램')
    page.goto(base+'o0500.html')
    expect(page.locator('.program-location')).to_contain_text('보관용')
    page.goto(base+'machines.html')
    page.locator('[data-machine="6"]').focus();page.keyboard.press('Enter')
    expect(page.locator('#dNo')).to_have_text('6')
    page.locator('.back').click();expect(page.locator('#select')).to_be_visible()
    page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
    context.set_offline(True)
    page.goto(base+'index.html');expect(page.locator('[data-machine="5"]')).to_be_visible()
    page.locator('[data-machine="5"]').click();expect(page.locator('[data-program="O0600"]')).to_be_visible()
    page.locator('[data-program="O0600"] a.primary').click()
    expect(page.locator('.program-location')).to_contain_text('5호기')
    expect(page.locator('#copy-source')).to_be_enabled()
    context.set_offline(False)
    phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile=phone.new_page();mobile.on('pageerror',lambda e:errors.append(str(e)))
    for target in ['index.html','machines.html#m5','o0600.html?machine=5','machines.html#m3','o0852.html?machine=1']:
        mobile.goto(base+target)
        assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),target
        if target=='index.html':mobile.screenshot(path=str(out/'home-mobile.png'),full_page=True)
        if target=='machines.html#m5':mobile.screenshot(path=str(out/'unit5-mobile.png'),full_page=True)
    browser.close()
server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['12 assignments','unit 5 active/item/archive groups','program/subprogram sets','tool roles','M codes','query context','reference-machine labels','keyboard','mobile','offline'],'errors':errors,'screenshots':str(out)},ensure_ascii=False))
