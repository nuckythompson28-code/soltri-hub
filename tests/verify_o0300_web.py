"""Check unit 2 registration, incomplete-photo labeling, and comparison evidence."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import hashlib
import json
import re
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'programs/o0300'
provenance=json.loads((DEST/'provenance.json').read_text(encoding='utf-8'))
assert len(provenance['photos'])==5
for filename,digest in provenance['photos'].items():
    assert hashlib.sha256((DEST/'photos'/filename).read_bytes()).hexdigest()==digest
for filename,digest in provenance['comparison'].items():
    assert hashlib.sha256((ROOT/'programs/o0600'/filename).read_bytes()).hexdigest()==digest
reference=provenance['o8000_reference']
assert reference['reference_machine']=='6'
assert reference['assigned_machines']==['3','6']
assert hashlib.sha256((ROOT/reference['file']).read_bytes()).hexdigest()==reference['sha256']
page8=(ROOT/'o8000.html').read_text(encoding='utf-8')
sub8=re.search(r'<script type="text/plain" id="src-O9010">(.*?)</script>',page8,re.S).group(1)
raw=(DEST/'photo-transcript.txt').read_bytes()
assert raw.startswith(b'\xef\xbb\xbf')
assert b'\n' not in raw.replace(b'\r\n',b'')
assert b'\r' not in raw.replace(b'\r\n',b'')
transcript=raw.decode('utf-8-sig')
assert '선택정지 OFF 확인' in transcript
assert '160 mm/min' in transcript and '144 mm/min' in transcript
assert '0.750초' in transcript and '0.833초' in transcript
assert '[사진 오른쪽 잘림: 줄 끝 미확인]' in transcript
assert 'O8000 (6호기 원문)' in transcript
assert 'N420(T02 CHAMFER TOOL);' in transcript
assert '3호기: M08 / M09' in transcript
assert '약 0.8초' in transcript and 'T2는 이미 들어갔고' in transcript
assert 'M01 삭제 시험 결과: 변화 없음' in transcript
assert '첫 X 줄이 G00 X-[#503] T03;' in transcript
assert '2호기는 현대위아 FANUC i Series Smart Plus' in transcript
assert '5·6호기는 FANUC Series 0i-TD' in transcript
assert 'INPOSITION CHECK' in transcript
assert '현재는 비교시험 전' not in transcript
assert not list(DEST.glob('*.nc')),'Do not expose incomplete transcription as CNC export'

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
out=Path(tempfile.gettempdir())/'codex_o0300_review'
out.mkdir(exist_ok=True)
errors=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={'width':1280,'height':1000})
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'index.html')
        expect(page.locator('[data-machine="2"] .program-id')).to_have_text('O0300')
        expect(page.locator('[data-machine="13"] .program-id')).to_have_text('O0400')
        page.locator('[data-machine="2"]').click()
        expect(page.locator('#linkSlot>.assignment-card')).to_have_attribute('data-program','O0300')
        expect(page.locator('#linkSlot>.assignment-card .assignment-set')).to_contain_text('O0310')
        expect(page.locator('[data-program="O0300"] a[href*="simulator"]')).to_have_count(0)
        expect(page.locator('[data-program="O0400"]')).to_be_hidden()
        page.locator('#archived-programs summary').click()
        expect(page.locator('[data-program="O0400"]')).to_contain_text('보관용')
        page.locator('[data-program="O0400"] a.primary').click()
        expect(page.locator('.program-location strong')).to_have_text('2호기 · O0400 · 보관용')
        page.goto(base+'o0400.html')
        expect(page.locator('.program-location strong')).to_have_text('13호기 · S3 · O0400 · 배정 프로그램')
        page.goto(base+'machines.html#m2')
        page.locator('[data-program="O0300"] a.primary').click()
        expect(page.locator('.program-location strong')).to_have_text('2호기 · O0300 · 배정 프로그램')
        expect(page.locator('pre.source')).to_have_count(5)
        expect(page.locator('.source .uncertain')).to_have_count(1)
        expect(page.locator('.source .uncertain')).to_contain_text('#513=')
        expect(page.locator('#compare .notice')).to_contain_text('선택정지는 OFF')
        expect(page.locator('.metrics')).to_contain_text('160')
        expect(page.locator('.metrics')).to_contain_text('144')
        expected=(ROOT/'programs/o0600/O9050.nc').read_text(encoding='ascii')
        start=expected.index('N320 (T02 CHAMFER UNIT);')
        expected=expected[start:expected.index('G98 G01 X-[#103] F[#516*#116];',start)].strip()
        assert page.locator('.compare pre').nth(1).text_content()==expected
        expect(page.locator('#pause-diagnosis')).to_contain_text('T2는 이미 들어갔고')
        expect(page.locator('#m01-test-result')).to_contain_text('M01 삭제 시험 결과: 변화 없음')
        expect(page.locator('#controller-generation')).to_contain_text('2호기는 현대위아 FANUC i Series Smart Plus')
        expect(page.locator('#controller-generation')).to_contain_text('FANUC Series 0i-TD')
        expect(page.locator('#controller-generation')).to_contain_text('3호기는 현대위아 FANUC Series 0i-TC')
        expect(page.locator('#controller-generation')).to_contain_text('내부 FANUC 세부 모델은 미확인')
        expect(page.locator('#controller-checks')).to_contain_text('FIN만으로 M55와 T03 중 어느 명령인지까지 구분되지는 않습니다')
        expect(page.locator('#controller-checks')).to_contain_text('진단 0')
        expect(page.locator('#controller-basis')).to_contain_text('실제 CNC에 적용됐다고 간주하지 않습니다')
        expect(page.locator('#controller-basis')).to_contain_text('첫 X 줄이 G00 X-[#503] T03;')
        expect(page.locator('#m01-trial-before, #m01-trial-after')).to_have_count(0)
        registered=page.locator('#registered-transition').text_content()
        reported=page.locator('#reported-transition').text_content()
        assert registered in expected
        assert registered.splitlines().count('M01;')==1
        assert reported=='\n'.join(['G00 W10. M55;','#521=#521+#505;',
                                  'N330 (T03 LOWER PARTING);','#516=#114+#513*#523;',
                                  '#522=#522+#505;','G00 X-[#503] T03;'])
        assert 'M01' not in reported and 'M03' not in reported
        assert 'G97 G00 X-[#503] S#516 M03 T03;' in registered
        expect(page.locator('.compare pre')).to_have_count(3)
        expect(page.locator('#compare thead th')).to_have_count(5)
        expect(page.locator('.metrics article').nth(2)).to_contain_text('144')
        expect(page.locator('.metrics article').nth(2)).to_contain_text('0.833초')
        expect(page.locator('#o8000-basis')).to_contain_text('6호기 기준')
        expect(page.locator('#o8000-basis')).to_contain_text('별도로 가져온 코드')
        for start_label,target in [('N320(T02 CHAMFER TOOL);','#o8000-chamfer'),('N420(T02 CHAMFER TOOL);','#o8000-remainder pre')]:
            a=sub8.index(start_label)
            b=sub8.index('G98 G01 X-[#103]F[#516*#116];',a)
            assert page.locator(target).text_content()==sub8[a:b].strip()
        page.locator('#o8000-remainder summary').click()
        expect(page.locator('#o8000-remainder pre')).to_be_visible()
        page.locator('#o8000-remainder summary').click()
        for number in ['3','5','6']:
            page.goto(base+'machines.html#m'+number)
            link=page.locator('#linkSlot>.assignment-card a[href="o0300.html#compare"]')
            expect(link).to_be_visible()
            link.click()
            expect(page.locator('#compare h2').first).to_contain_text('O8000')
        table=page.evaluate("({three:SoltriPrograms.byNo['3'],six:SoltriPrograms.byNo['6']})")
        assert table['three']['airOn']=='M08' and table['three']['ccw']=='M03'
        assert table['six']['airOn']=='M51' and table['six']['cw']=='M03'
        page.goto(base+'o0300.html')
        page.screenshot(path=str(out/'overview-desktop.png'))
        page.locator('.compare').screenshot(path=str(out/'chamfer-code-desktop.png'))
        page.locator('#pause-diagnosis').screenshot(path=str(out/'pause-diagnosis-desktop.png'))
        for photo in provenance['photos']:
            response=context.request.get(base+'programs/o0300/photos/'+photo)
            assert response.ok and response.body()==(DEST/'photos'/photo).read_bytes()
        with page.expect_download() as info:
            page.locator('.actions a[download]').click()
        assert Path(info.value.path()).read_bytes()==raw
        page.evaluate('navigator.serviceWorker.ready')
        page.wait_for_function('navigator.serviceWorker.controller!==null')
        context.set_offline(True)
        page.goto(base+'machines.html#m2')
        page.locator('[data-program="O0300"] a.primary').click()
        expect(page.locator('#compare .notice')).to_contain_text('OFF')
        for filename in ['photo-transcript.txt',*['photos/'+name for name in provenance['photos']]]:
            digest=page.evaluate("async url=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await (await fetch(url)).arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')",'programs/o0300/'+filename)
            assert digest==hashlib.sha256((DEST/filename).read_bytes()).hexdigest(),filename
        context.set_offline(False)
        mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile.on('pageerror',lambda e:errors.append(str(e)))
        for target in ['machines.html#m2','o0300.html?machine=2']:
            mobile.goto(base+target)
            assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),target
        mobile.screenshot(path=str(out/'overview-mobile.png'))
        mobile.locator('#compare tbody tr').nth(2).screenshot(path=str(out/'feed-comparison-mobile.png'))
        mobile.locator('.transition-code').screenshot(path=str(out/'pause-transition-mobile.png'))
        assert mobile.locator('#compare .tablewrap').evaluate('el=>el.scrollWidth<=el.clientWidth')
        mobile.emulate_media(media='print')
        expect(mobile.locator('#print')).to_be_hidden()
        expect(mobile.locator('#O0310')).to_be_visible()
        browser.close()
finally:
    server.shutdown()
assert not errors,errors
print(json.dumps({'passed':['unit2 O0300 assignment','O0400 archived for 2, active for 13','5 source photos','clipped line marked','optional stop OFF','5 NC excerpt exact','O8000 group/remainder excerpts exact','3/6 reference and M-code distinctions','3/5/6 comparison links','TXT CRLF/download','mobile layout','offline photos and TXT','print'],'screenshots':str(out)},ensure_ascii=False))
