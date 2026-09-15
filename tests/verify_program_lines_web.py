"""Program-local references, automatic following, copy and independent file import."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json, tempfile
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
out = Path(tempfile.gettempdir()) / 'codex_program_lines_review'
out.mkdir(exist_ok=True)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/'
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440, 'height':1100})
    # Capture clipboard writes inside the isolated test browser, not the user's clipboard.
    context.add_init_script("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedReference=text;}}});")
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + 'simulator.html')
    expect(page.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    expect(page.locator('#programTabs button')).to_have_text(['O0600', 'O9050'])
    expect(page.locator('#lineList .gut').first).to_have_text('1')
    expect(page.locator('#lineList .src').first).to_contain_text('O0600')
    assert page.evaluate('cutEvents.length') == 13

    # Explicit source-based expectation; global line 207 is not the subprogram's line 207.
    raw_lines = (root / 'programs/o0600-unit5.nc').read_text(encoding='utf-8-sig').splitlines()
    start = next(i for i, line in enumerate(raw_lines) if line.strip().startswith('O9050'))
    target = next(i for i, line in enumerate(raw_lines) if line.strip() == 'N330 (T03 LOWER PARTING);')
    expected_line = target - start + 1
    page.locator('[data-program="9050"]').click()
    expect(page.locator('#lineList .gut').first).to_have_text('1')
    expect(page.locator('#lineList .src').first).to_contain_text('O9050')
    row = page.locator(f'#lineList [data-program-line="{expected_line}"]')
    row.focus()
    row.press('Enter')
    expect(page.locator('#codePosition')).to_contain_text(f'O9050 · {expected_line}행 · N330 구간')
    page.locator('#copyLine').click()
    expect(page.locator('#copyStatus')).to_contain_text('복사했습니다')
    copied = page.evaluate('window.copiedReference')
    assert copied.startswith(f'O9050 · {expected_line}행 · N330 구간\nN330 (T03 LOWER PARTING);')
    assert 'O번호 줄이 1행' in copied
    page.locator('#codePanel').screenshot(path=str(out/'program-local-lines.png'))

    # Actual execution switches tabs at calls/returns and stays on local lines in loops.
    indices = page.evaluate("[trace.findIndex(s=>s.act==='call'),trace.findIndex(s=>s.prog==='9050'),cutEvents[0].index,cutEvents[1].index,trace.findLastIndex(s=>s.act==='return'),trace.length-1]")
    for index in indices:
        page.evaluate('(i)=>gotoStep(i)', index)
        assert page.evaluate('''()=>{
          const s=trace[cur],pl=programLines[s.lineIdx];
          const start=programLines.findIndex(p=>p.prog===s.prog);
          const local=s.lineIdx-start+1;
          const row=$('lineList').querySelector('.cur');
          return row.dataset.programLine===String(local)&&
            $('programTabs').querySelector('[aria-pressed=true]').dataset.program===s.prog&&
            $('runningLocation').textContent.includes(' · '+local+'행')&&
            $('actLine').textContent.includes(' · '+local+'행')&&
            $('runningSource').textContent===pl.raw.trim();
        }''')
    page.locator('[data-program="9050"]').click()
    page.locator('#followCurrent').click()
    expect(page.locator('[data-program="600"]')).to_have_attribute('aria-pressed', 'true')
    page.evaluate("gotoStep(trace.findIndex(s=>s.prog==='9050'))")
    page.evaluate('scrollTo(0,0)')
    page.screenshot(path=str(out/'desktop-follow.png'), full_page=True)

    # Separately imported files keep exactly the same reference for N330.
    page.locator('#fileIn').set_input_files([str(root/'programs/o0600/O9050.nc'), str(root/'programs/o0600/O0600.nc')])
    page.wait_for_function('cutEvents.length===13&&document.querySelector("#sampleSel").selectedIndex===-1')
    page.locator('[data-program="9050"]').click()
    row = page.locator(f'#lineList [data-program-line="{expected_line}"]')
    expect(row).to_contain_text('N330 (T03 LOWER PARTING);')

    # Browser permission failure leaves the exact reference available for manual copying.
    row.click()
    page.evaluate("()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied')};}")
    page.locator('#copyLine').click()
    expect(page.locator('#copyFallback')).to_be_visible()
    assert page.locator('#copyFallback').input_value() == copied

    # Blank/comment lines count; preambles and earlier programs do not. CRLF supported.
    fixture = '%\r\n(header)\r\nO0600;\r\nN1;\r\n(comment)\r\n\r\nM98 P9050;\r\nM30;\r\n%\r\n\r\nO9050;\r\nN330;\r\nG00 X80 Z0;\r\nG01 X70 F10;\r\nM99;\r\n%'
    page.locator('#editToggle').click()
    page.locator('#editor').fill(fixture)
    page.locator('#loadBtn').click()
    page.locator('#editToggle').click()
    expect(page.locator('#lineList .gut').first).to_have_text('1')
    page.locator('#lineList [data-program-line="4"]').click()
    expect(page.locator('#codePosition')).to_contain_text('O0600 · 4행')
    page.locator('[data-program="9050"]').click()
    expect(page.locator('#lineList [data-program-line="3"]')).to_contain_text('G00 X80 Z0;')
    page.locator('#editToggle').click()
    page.locator('#editor').fill(fixture.replace('N330;\r\n', 'N330;\r\n(new comment)\r\n'))
    page.locator('#loadBtn').click()
    page.locator('#editToggle').click()
    page.locator('[data-program="9050"]').click()
    expect(page.locator('#lineList [data-program-line="4"]')).to_contain_text('G00 X80 Z0;')

    # Reset + offline reload use the new UI and numbering.
    page.locator('#sampleSel').select_option('O0600')
    page.wait_for_function('cutEvents.length===13')
    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('navigator.serviceWorker.controller!==null')
    context.set_offline(True)
    page.reload()
    expect(page.locator('#programTabs button')).to_have_text(['O0600', 'O9050'])
    expect(page.locator('#lineList .gut').first).to_have_text('1')
    context.set_offline(False)

    phone = browser.new_context(viewport={'width':390, 'height':844}, is_mobile=True, has_touch=True)
    mobile = phone.new_page()
    mobile.on('pageerror', lambda e: errors.append(str(e)))
    mobile.goto(base + 'simulator.html')
    expect(mobile.locator('#loadStatus')).to_contain_text('O0600 불러옴')
    mobile.locator('#btnNextCut').click()
    expect(mobile.locator('[data-program="9050"]')).to_have_attribute('aria-pressed', 'true')
    mobile.evaluate('document.querySelector("#codePanel").scrollIntoView({block:"start"})')
    mobile.screenshot(path=str(out/'mobile-program-lines.png'))
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    browser.close()

server.shutdown()
assert not errors, errors
print(json.dumps({'passed':['local O header numbering','N330 reference','keyboard selection','copy and fallback','calls/returns/loops','split files','comments/blanks/CRLF','edited numbering','offline','390px mobile'], 'example':copied, 'errors':errors, 'screenshots':str(out)}, ensure_ascii=False))
