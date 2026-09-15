"""Read-only UI checks. External requests are blocked to avoid changing live records."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json, tempfile
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=Path(tempfile.gettempdir())/'codex_kim_light_ui_review'
out.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
pages=sorted(p.name for p in root.glob('*.html'))
errors=[];overflows=[];contrast=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width in [1280,390]:
        context=browser.new_context(viewport={'width':width,'height':900},service_workers='block')
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base) else route.abort())
        page=context.new_page()
        current=['']
        page.on('pageerror',lambda e:errors.append([current[0],str(e)]))
        for name in pages:
            current[0]=name
            page.goto(base+name,wait_until='networkidle')
            if name=='status.html':
                page.evaluate("DATA=Object.fromEntries(SEED.map((m,i)=>[m.no,{...m,status:['run','check','stop','down'][i%4],issues:{},eta:''}]));render()")
            if name=='dorm.html':
                page.evaluate("ROOMS=SEED_ROOMS;RES={};render()")
            expect(page.locator('.kim-header')).to_have_count(1)
            expect(page.locator('.kim-header')).to_be_visible()
            assert page.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(243, 245, 248)',name
            if page.evaluate('document.documentElement.scrollWidth>innerWidth+1'):
                overflows.append([width,name,page.evaluate('document.documentElement.scrollWidth')])
            if width==390:
                page.locator('#kimMenu').click()
                expect(page.locator('#kimNav')).to_be_visible()
                page.keyboard.press('Escape')
                expect(page.locator('#kimMenu')).to_have_attribute('aria-expanded','false')
            if name in ['index.html','machines.html','status.html','cnc-errors.html','dorm.html','cfbackup.html','firststep.html','o0600.html','o0300.html','simulator.html']:
                page.screenshot(path=str(out/(name.replace('.html','')+'-'+str(width)+'.png')),full_page=True)
            findings=page.evaluate(r"""()=>{
              const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
              const lum=c=>c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
              const out=[];
              for(const e of document.querySelectorAll('body *')){
                if(e.closest('svg,canvas,.stage')||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||!Array.from(e.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()))continue;
                const s=getComputedStyle(e),fg=rgb(s.color);let bg=[243,245,248],parent=e;
                if(s.opacity!=='1'||e.disabled)continue;
                while(parent){const c=rgb(getComputedStyle(parent).backgroundColor);if(c.length===3||c[3]===1){bg=c;break;}parent=parent.parentElement;}
                const a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
                const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&parseFloat(s.fontWeight)>=700);
                if(ratio<(large?3:4.5))out.push({tag:e.tagName,cls:e.className,text:e.textContent.trim().slice(0,65),ratio:+ratio.toFixed(2),fg:s.color,bg});
              }return out.slice(0,25);
            }""")
            if findings:contrast.append([width,name,findings])
        page.goto(base+'index.html')
        search=page.get_by_role('searchbox',name='설비 검색어')
        search.fill('1')
        expect(page.locator('.assignment-tile:visible')).to_have_count(1)
        expect(page.locator('.assignment-tile:visible')).to_have_attribute('data-machine','1')
        search.fill('0i-TD')
        expect(page.locator('.assignment-tile:visible')).to_have_count(3)
        page.locator('[data-filter-clear]').click()
        page.get_by_label('프로그램 필터').select_option('unassigned')
        expect(page.locator('.assignment-tile:visible')).to_have_count(4)
        search.fill('없는호기')
        expect(page.locator('.directory-empty')).to_be_visible()
        page.locator('[data-filter-clear]').click()
        expect(page.locator('.assignment-tile:visible')).to_have_count(15)
        page.get_by_label('프로그램 필터').select_option('O0600')
        page.locator('.assignment-tile:visible').click()
        expect(page.locator('#dNo')).to_have_text('5')
        page.goto(base+'machines.html#layout')
        expect(page.locator('#factoryLayout')).to_be_visible()
        page.screenshot(path=str(out/('layout-'+str(width)+'.png')),full_page=True)
        page.goto(base+'status.html')
        page.evaluate("DATA={'5':{no:'5',type:'AL',status:'check',issues:{},eta:''}};render();openSheet('5')")
        expect(page.locator('#mask')).to_have_class('mask open')
        expect(page.locator('#d-text')).to_be_visible()
        page.screenshot(path=str(out/('status-form-'+str(width)+'.png')),full_page=True)
        page.emulate_media(media='print')
        expect(page.locator('.kim-header')).to_be_hidden()
        context.close()
    browser.close()
server.shutdown()
(out/'audit.json').write_text(json.dumps({'errors':errors,'overflows':overflows,'contrast':contrast},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(pages),'viewports':[1280,390],'errors':errors,'overflows':overflows,'contrast_pages':len(contrast),'screenshots':str(out)},ensure_ascii=False))
assert not errors,errors
assert not overflows,overflows
assert not contrast,contrast
