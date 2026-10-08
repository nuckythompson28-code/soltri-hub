"""Verify full stock, exact kerf and falling parts without changing NC files."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import math
import re
import tempfile

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(tempfile.gettempdir()) / "unit7-stock-review"
OUT.mkdir(exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def close(actual, expected, tolerance=1e-4):
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected)


def stock_bounds(page):
    """Read actual mesh vertices, independently of the material metadata."""
    return page.evaluate("""() => {
      const mesh=Unit7View.debug.stockMesh;
      mesh.geometry.computeBoundingBox();
      const b=mesh.geometry.boundingBox;
      return {min:b.min.x, max:b.max.x, length:b.max.x-b.min.x,
        visible:mesh.visible, count:mesh.geometry.attributes.position.count};
    }""")


def falling_parts(page):
    return page.evaluate("""() => Unit7View.debug.fallingParts.map(p => {
      p.mesh.updateWorldMatrix(true,false);
      p.mesh.geometry.computeBoundingBox();
      const b=p.mesh.geometry.boundingBox;
      const center=p.mesh.position.clone().set(
        (b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2
      ).applyMatrix4(p.mesh.matrixWorld);
      return {id:p.id,age:p.age,width:b.max.x-b.min.x,
        center:center.toArray(),world:p.mesh.getWorldPosition(p.mesh.position.clone()).toArray(),
        visible:p.mesh.visible};
    })""")


def seek(page, index, fraction=1):
    page.evaluate("""([index,fraction]) => {
      gotoStep(index); animT=fraction; updateAll(); Unit7View.sync();
    }""", [index, fraction])
    page.wait_for_function("i => Unit7View.debug.index===i", arg=index)


def seek_visual_time(page, time):
    """Find a motion by the public deterministic display clock, not wall time."""
    point = page.evaluate("""time => {
      for(let index=0;index<trace.length;index++) {
        const start=SoltriSim3D.eventTime(index,0),end=SoltriSim3D.eventTime(index,1);
        if(end>start && time>=start && time<=end)
          return {index,fraction:(time-start)/(end-start)};
      }
      throw new Error('No motion contains display time '+time);
    }""", time)
    seek(page, point["index"], point["fraction"])


def compute_source(page, text):
    editor = page.locator("#editor")
    if not editor.is_visible():
        page.locator("#editToggle").click()
    revision = page.evaluate("SoltriSim3D.snapshot().revision")
    editor.fill(text)
    page.locator("#loadBtn").click()
    page.wait_for_function("r => SoltriSim3D.snapshot().revision>r", arg=revision)
    page.wait_for_function("Unit7View.debug.stockMesh && Unit7View.debug.materialState")
    page.locator("#editToggle").click()


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}/"
errors = []
passed = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-webgl"])
        try:
            context = browser.new_context(viewport={"width": 1440, "height": 1100})
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base + "simulator.html?program=O0852_UNIT7&view=3d")
            page.wait_for_function(
                "document.getElementById('stage3d').dataset.ready==='true'"
                "||document.getElementById('stage3d').dataset.error", timeout=90000
            )
            assert not page.locator("#stage3d").get_attribute("data-error")
            page.wait_for_function("Unit7View.debug.stockMesh && Unit7View.debug.materialState")
            original = page.locator("#editor").input_value()
            assert re.search(r"#101\s*=\s*43\b", original)
            assert re.search(r"#102\s*=\s*500\b", original)
            close(stock_bounds(page)["length"], 543)
            assert falling_parts(page) == []
            passed.append("original sample remains 543 mm")

            # 520 mm is a deliberate editor scenario; shipped source stays 543 mm.
            source_520 = re.sub(r"(#101\s*=\s*)43\b", r"\g<1>20", original, count=1)
            assert source_520 != original
            compute_source(page, source_520)
            close(stock_bounds(page)["length"], 520)
            assert stock_bounds(page)["visible"] and stock_bounds(page)["count"] > 0
            close(page.evaluate("stockInfo.tip"), 2.02)
            page.locator("#detail3d").click()
            page.locator("#front3d").click()
            page.locator("#stage3d").screenshot(path=str(OUT / "stock-520.png"))
            assert page.locator("#editor").input_value() == source_520
            passed.append("actual stock mesh spans 520 mm")

            # A stopped partial radial cut has not yet separated a product.
            first_cut = page.evaluate("cutEvents[0].index")
            seek(page, first_cut - 1)
            before = falling_parts(page)
            seek(page, first_cut, .01)
            assert [x["id"] for x in falling_parts(page)] == [x["id"] for x in before]
            seek(page, first_cut, 1)
            after = falling_parts(page)
            products = [x for x in after if abs(x["width"] - 7.823) < 1e-4]
            assert products, after
            assert len({x["id"] for x in after}) == len(after)
            page.locator("#stage3d").screenshot(path=str(OUT / "first-separated-part.png"))
            page.evaluate("Unit7View.sync(); Unit7View.sync();")
            assert [x["id"] for x in falling_parts(page)] == [x["id"] for x in after]
            passed.append("partial cut stays attached; exact 7.823 mm product separates once")

            # Pieces leave the 45-degree bed frame and fall down the world Y
            # axis. A deterministic clock makes scrubbing and pause repeatable.
            product_id = products[0]["id"]
            detach_time = page.evaluate("""id => {
              const part=SoltriSim3D.snapshot().material.parts.find(p=>p.id===id);
              return SoltriSim3D.eventTime(part.index,part.fraction);
            }""", product_id)
            seek_visual_time(page, detach_time + .05)
            early = next(x for x in falling_parts(page) if x["id"] == product_id)
            seek_visual_time(page, detach_time + .25)
            later = next(x for x in falling_parts(page) if x["id"] == product_id)
            assert early["visible"] and later["visible"]
            close(early["age"], .05)
            close(later["age"], .25)
            assert later["world"][1] < early["world"][1] - 1, (early, later)
            close(later["world"][0], early["world"][0])
            close(later["world"][2], early["world"][2])
            page.wait_for_timeout(250)
            paused_later = next(x for x in falling_parts(page) if x["id"] == product_id)
            assert paused_later == later, (later, paused_later)
            seek_visual_time(page, detach_time + .05)
            repeated = next(x for x in falling_parts(page) if x["id"] == product_id)
            assert repeated == early, (early, repeated)
            seek_visual_time(page, detach_time + 1.21)
            assert not any(x["id"] == product_id and x["visible"] for x in falling_parts(page))
            assert page.evaluate(
                "id=>SoltriSim3D.snapshot().material.parts.some(p=>p.id===id)", product_id
            )
            passed.append("parts fall in world Y, freeze while paused and replay deterministically")

            # Pause retains the current fractional motion; resume continues it.
            seek_visual_time(page, detach_time + .05)
            page.locator("#speed").evaluate("""el => {
              el.value='1'; el.dispatchEvent(new Event('input',{bubbles:true}));
            }""")
            page.locator("#btnPlay").click()
            page.wait_for_timeout(140)
            page.locator("#btnPlay").click()
            paused = page.evaluate("""() => {
              Unit7View.sync(); const s=SoltriSim3D.snapshot();
              return {index:s.index,fraction:s.fraction,time:s.visualTime,playing:s.playing};
            }""")
            paused_parts = falling_parts(page)
            paused_bounds = stock_bounds(page)
            assert not paused["playing"] and 0 < paused["fraction"] < 1, paused
            page.wait_for_timeout(250)
            assert page.evaluate("SoltriSim3D.snapshot().visualTime") == paused["time"]
            assert falling_parts(page) == paused_parts
            assert stock_bounds(page) == paused_bounds
            page.locator("#btnPlay").click()
            page.wait_for_timeout(100)
            page.locator("#btnPlay").click()
            resumed = page.evaluate("SoltriSim3D.snapshot().visualTime")
            assert paused["time"] < resumed < paused["time"] + .5, (paused, resumed)
            passed.append("pause preserves a fractional cut and resume continues without jumping")

            # Seeking must reconstruct state rather than append duplicate products.
            seek(page, first_cut - 1)
            assert [x["id"] for x in falling_parts(page)] == [x["id"] for x in before]
            seek(page, first_cut)
            assert [x["id"] for x in falling_parts(page)] == [x["id"] for x in after]
            page.locator("#btnReset").click()
            assert falling_parts(page) == []
            close(stock_bounds(page)["length"], 520)
            passed.append("seek and reset reconstruct stock and parts")

            # Full bar movement is cumulative. It is not the short material
            # segment ahead of the chuck, nor just the current frame's pull.
            pulls = page.evaluate("trace.flatMap((s,i)=>s.pull?[{index:i,distance:s.pull}]:[])")
            assert len(pulls) >= 2, pulls
            initial_rear = stock_bounds(page)["min"]
            initial_chuck = page.evaluate("stockInfo.chuckFaceZ")
            cumulative = 0
            for pull in pulls:
                index, distance = pull["index"], pull["distance"]
                seek(page, index, 0)
                close(stock_bounds(page)["min"], initial_rear + cumulative)
                seek(page, index, .5)
                close(stock_bounds(page)["min"], initial_rear + cumulative + distance / 2)
                close(page.evaluate("SoltriSim3D.snapshot().material.totalPull"), cumulative + distance / 2)
                seek(page, index, 1)
                cumulative += distance
                close(stock_bounds(page)["min"], initial_rear + cumulative)
                seek(page, index + 1)
                close(stock_bounds(page)["min"], initial_rear + cumulative)
                close(page.evaluate("stockInfo.chuckFaceZ"), initial_chuck)
            passed.append("every pull moves full bar cumulatively without next-frame snapback")

            # The last subprogram changes the work origin. Its G10 alone must
            # not move physical stock or generate another detached product.
            # The original 543 mm setup reaches this branch; the 520 mm edit
            # can consume its usable stock without entering that subprogram.
            compute_source(page, original)
            offsets = page.evaluate("trace.flatMap((s,i)=>s.act==='offset'?[i]:[])")
            assert len(offsets) >= 2, offsets
            last_offset = offsets[-1]
            seek(page, last_offset - 1)
            bounds_before_offset = stock_bounds(page)
            parts_before_offset = [x["id"] for x in falling_parts(page)]
            seek(page, last_offset)
            close(stock_bounds(page)["min"], bounds_before_offset["min"])
            close(stock_bounds(page)["max"], bounds_before_offset["max"])
            assert [x["id"] for x in falling_parts(page)] == parts_before_offset
            passed.append("last G10 changes coordinates without moving physical stock")

            # A rapid positioning move and a cut stopping outside the inner wall
            # must not create a detached product, even if an M12 follows.
            unfinished = "\n".join([
                "O0852", "#130=7", "#101=20", "#102=500", "#103=75",
                "#109=70", "#110=56", "#111=64.9", "#112=58.3",
                "#113=7.823", "#114=2.02", "G10 L2 P0 Z75",
                "G00 X70 Z0 T02", "G00 Z-9.843", "G01 X60 F80", "M12", "M30",
            ])
            compute_source(page, unfinished)
            seek(page, page.evaluate("trace.length-1"))
            assert falling_parts(page) == []
            passed.append("unfinished cut does not detach on M12")

            # Restoring the shipped sample resets all transient stock state.
            page.locator("#sampleSel").select_option("O0600")
            page.wait_for_function("mainKey==='600'")
            expect(page.locator("#stage3d")).to_be_hidden()
            page.locator("#sampleSel").select_option("O0852_UNIT7")
            page.wait_for_function("SoltriSim3D.isUnit7() && Unit7View.enabled()")
            assert page.locator("#editor").input_value() == original
            close(stock_bounds(page)["length"], 543)
            assert falling_parts(page) == []
            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_timeout(250)
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            page.locator("#stage3d").screenshot(path=str(OUT / "stock-mobile.png"))
            passed.append("sample reload and mobile layout")
            assert not errors, errors
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

print(json.dumps({"passed": passed, "screenshots": str(OUT)}, ensure_ascii=False))
