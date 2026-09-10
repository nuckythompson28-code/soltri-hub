"""Verify manual instructions against historical NC versions and the browser UI.

Requires git history for 53395d5 and 372dadf, plus Python Playwright/Chromium.
All patch operations below act on strings; no CNC source is written.
"""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from html import unescape
import itertools, json, re, subprocess, tempfile
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
PAGE='o0600-patch.html'
TXT='programs/patches/unit5-o9050-manual-patch-20260910.txt'
source=(ROOT/'programs/o0600/O9050.nc').read_text(encoding='ascii')
html=(ROOT/PAGE).read_text(encoding='utf-8')
ids=['face','boring','transition']
after={key:unescape(re.search(r'<pre class="after" id="after-'+key+r'">(.*?)</pre>',html,re.S).group(1)) for key in ids}
before=dict(zip(ids,map(unescape,re.findall(r'<pre class="before">(.*?)</pre>',html,re.S))))

def span(code,key):
    if key=='face':
        start=code.index('G00 X-[#101+10.];\n',code.index('N203 (FACE CUTTING);'))+len('G00 X-[#101+10.];\n')
        end=code.index('M01;',start)
    elif key=='boring':
        start=code.index('N310 (T01 GROUP BORING);\n')+len('N310 (T01 GROUP BORING);\n')
        end=code.index('G98 G01 Z-[#507] F[#514*#110];',start)
    else:
        start=code.index('N320 (T02 CHAMFER UNIT);')
        end=code.index('G98 G01 X-[#103] F[#516*#116];',start)
    return start,end

def extract(code,key):
    a,b=span(code,key)
    return code[a:b].strip()

def apply(code,keys=ids):
    for key in keys:
        a,b=span(code,key)
        code=code[:a]+after[key]+'\n'+code[b:]
    return code

assert len(before)==3
for key in ids:
    assert after[key]==extract(source,key),key
historical_cases=0
for revision in ['53395d5','372dadf']:
    old=subprocess.check_output(['git','show',revision+':programs/o0600/O9050.nc'],cwd=ROOT).decode('ascii').replace('\r\n','\n')
    for key in ids:
        expected=before[key]
        if revision=='372dadf' and key=='transition':
            expected=expected.replace('G00 Z[-#521+20.];\n','')
        assert extract(old,key)==expected,(revision,key,'before example differs')
    for bits in itertools.product([False,True],repeat=3):
        partial_code=apply(old,[key for key,on in zip(ids,bits) if on])
        assert apply(partial_code)==source,(revision,bits,'manual edits must match the entire current program')
        historical_cases+=1
assert apply(source)==source,'repeat application must be unchanged'
for line in ['#521=#521+#505;','#522=#522+#505;','#516=#114+#513*#523;']:
    assert after['transition'].splitlines().count(line)==1,line
assert 'G01 U0.2;\nG00 Z20.;\nM01;\nM53;\nN320' in source
assert 'G00 W10. M55;\nM01;\nN330' in source
assert 'G00 W[#505+20.] M52;\nM12;' in source
raw=(ROOT/TXT).read_bytes()
assert raw.startswith(b'\xef\xbb\xbf'),'Windows TXT must have UTF-8 BOM'
assert b'\n' not in raw.replace(b'\r\n',b''),'TXT contains bare LF'
assert b'\r' not in raw.replace(b'\r\n',b''),'TXT contains bare CR'
txt=raw.decode('utf-8-sig').replace('\r\n','\n')
for key in ids:
    assert '수정 후 완성 코드\n'+after[key]+'\n' in txt,key

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
out=Path(tempfile.gettempdir())/'codex_unit5_patch_review'
out.mkdir(exist_ok=True)
errors=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={'width':1280,'height':1000},permissions=['clipboard-read','clipboard-write'])
        page=context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(base+'machines.html#m5')
        card=page.locator('#linkSlot>[data-program="O0600"]')
        expect(card.locator('a.primary')).to_have_count(1)
        expect(card.locator('a[href="'+PAGE+'"]').first).to_be_visible()
        expect(card.locator('a[href="'+TXT+'"]')).to_have_attribute('download','')
        card.locator('a[href="'+PAGE+'"]').click()
        expect(page.locator('section.patch')).to_have_count(3)
        for key in ids:
            assert page.locator('#after-'+key).text_content()==after[key]
            page.locator('[data-copy="after-'+key+'"]').click()
            expect(page.locator('#copyStatus')).to_contain_text('완성 코드만 복사')
            page.wait_for_function(r"async expected=>(await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===expected",arg=after[key])
        with page.expect_download() as download_info:
            page.locator('.actions a[download][href="'+TXT+'"]').click()
        download=download_info.value
        assert download.suggested_filename==Path(TXT).name
        assert Path(download.path()).read_bytes()==raw
        page.screenshot(path=str(out/'patch-desktop.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.emulate_media(media='print')
        expect(page.locator('#printPatch')).to_be_hidden()
        expect(page.locator('#after-transition')).to_be_visible()
        page.emulate_media(media='screen')
        page.goto(base+'o0600.html')
        expect(page.locator('a[href="'+PAGE+'"]').first).to_be_visible()
        page.locator('a[href="'+PAGE+'"]').first.click()
        page.evaluate('navigator.serviceWorker.ready')
        page.wait_for_function('navigator.serviceWorker.controller!==null')
        context.set_offline(True)
        page.goto(base+'machines.html#m5')
        page.locator('#linkSlot>[data-program="O0600"] a[href="'+PAGE+'"]').click()
        expect(page.locator('#after-transition')).to_have_text(after['transition'])
        offline=page.evaluate('async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer()))',TXT)
        assert bytes(offline)==raw,'offline TXT differs'
        context.set_offline(False)
        phone=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile=phone.new_page()
        mobile.on('pageerror',lambda error:errors.append(str(error)))
        for target in ['machines.html#m5',PAGE]:
            mobile.goto(base+target)
            assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),target
        assert len(mobile.locator('#transition .compare').evaluate('el=>getComputedStyle(el).gridTemplateColumns').split())==1
        mobile.screenshot(path=str(out/'patch-mobile.png'),full_page=True)
        browser.close()
finally:
    server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['historical and partial edits: '+str(historical_cases),'idempotent current version','entire NC matches','TXT BOM/CRLF','unit5 and O0600 links','exact code clipboard','TXT download bytes','phone 390px','print controls','offline page and TXT'],'screenshots':str(out)},ensure_ascii=False))
