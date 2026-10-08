"""Verify manual Unit7 carriage motion and NC/material isolation in a browser."""
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import math
import tempfile

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(tempfile.gettempdir()) / "unit7-jog-review"
OUT.mkdir(exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def close(actual, expected, tolerance=1e-6):
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected)


def vector_close(actual, expected):
    assert len(actual) == len(expected)
    for value, wanted in zip(actual, expected):
        close(value, wanted)


def seek(page, index, fraction=1):
    page.evaluate("""([index,fraction]) => {
      gotoStep(index); animT=fraction; updateAll(); Unit7View.sync();
    }""", [index, fraction])
    page.wait_for_function("i => Unit7View.debug.index===i", arg=index)


def carriage(page):
    """Measure actual scene nodes, not just reported manual offsets."""
    return page.evaluate("""() => {
      const d=Unit7View.debug;
      d.workFrame.updateWorldMatrix(true,true);
      const tips=[1,2,3].map(t => {
        const node=d.model.getObjectByName('ANCHOR_T'+t);
        return d.workFrame.worldToLocal(node.getWorldPosition(node.position.clone())).toArray();
      });
      return {position:d.model.position.toArray(),debugPosition:d.position,
        marker:d.marker.position.toArray(),markerVisible:d.marker.visible,
        tips,anchors:[1,2,3].map(t=>d.anchors[t].toArray()),jog:d.jog};
    }""")


def frozen_state(page):
    """Capture NC and actual material; jog readouts deliberately are not NC."""
    state = page.evaluate("""() => {
      const s=SoltriSim3D.snapshot(), d=Unit7View.debug;
      return {index:s.index,fraction:s.fraction,revision:s.revision,
        playing:s.playing,time:s.visualTime,point:s.point,
        source:document.getElementById('editor').value,
        sourceText,trace:JSON.stringify(trace),frame:JSON.stringify(s.frame),
        material:JSON.stringify(s.material),stock:JSON.stringify(s.stock),
        mesh:JSON.stringify(Array.from(d.stockMesh.geometry.attributes.position.array)),
        stockPosition:d.stockMesh.position.toArray(),stockVisible:d.stockMesh.visible,
        chuck:d.chuck.position.toArray(),
        falling:d.fallingParts.map(p=>({id:p.id,age:p.age,
          position:p.mesh.position.toArray(),rotation:p.mesh.rotation.toArray()})),
        location:document.getElementById('runningLocation').textContent,
        code:document.getElementById('runningSource').textContent};
    }""")
    for key in ("source", "sourceText", "trace", "frame", "material", "stock", "mesh"):
        state[key] = sha256((state[key] or "").encode()).hexdigest()
    return state


def assert_frozen(page, before):
    after = frozen_state(page)
    for key, expected in before.items():
        assert after[key] == expected, ("JOG changed " + key, after[key], expected)


def assert_translation(before, after, x=0, z=0):
    delta = [z, x, 0]  # Scene local X is physical Z; local Y is physical X.
    vector_close(after["position"], [v + d for v, d in zip(before["position"], delta)])
    vector_close(after["debugPosition"], after["position"])
    assert after["anchors"] == before["anchors"]
    for original, moved in zip(before["tips"], after["tips"]):
        vector_close(moved, [v + d for v, d in zip(original, delta)])
    if before["markerVisible"]:
        vector_close(after["marker"], [v + d for v, d in zip(before["marker"], delta)])


def enter(page):
    page.locator("#jogToggle3d").click()
    expect(page.locator("#jogToggle3d")).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#jogPanel3d")).to_be_visible()
    assert page.evaluate("Unit7View.debug.jog.active && !SoltriSim3D.snapshot().playing")


def assert_cleared(page):
    expect(page.locator("#jogToggle3d")).to_have_attribute("aria-pressed", "false")
    expect(page.locator("#jogPanel3d")).to_be_hidden()
    jog = page.evaluate("Unit7View.debug.jog")
    assert not jog["active"], jog
    close(jog["x"], 0)
    close(jog["z"], 0)


def set_step(page, step):
    value = page.locator("#jogStep3d option").evaluate_all(
        "(options,step) => options.find(o=>Number(o.value)===step)?.value", step
    )
    assert value is not None, step
    page.locator("#jogStep3d").select_option(value)


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
            page.wait_for_function("Unit7View.debug.stockMesh && Unit7View.debug.jog")
            original = page.locator("#editor").input_value()
            assert_cleared(page)
            assert float(page.locator("#jogStep3d").input_value()) == 1
            assert page.locator("#jogStep3d option").evaluate_all(
                "options => options.map(o=>Number(o.value))"
            ) == [.1, 1, 10]

            # The deliberate layout preview also permits carriage inspection.
            assert page.evaluate("SoltriSim3D.snapshot().index") == -1
            preview = carriage(page)
            frozen = frozen_state(page)
            enter(page)
            page.locator("#jogXPlus3d").click()
            assert_translation(preview, carriage(page), x=1)
            assert_frozen(page, frozen)
            page.locator("#jogReturn3d").click()
            assert_cleared(page)
            assert_translation(preview, carriage(page))
            assert_frozen(page, frozen)
            passed.append("initial layout preview can jog and return exactly")

            # All physical tips move as one body at each requested increment.
            motion = page.evaluate("trace.findIndex(s=>s.seg)")
            assert motion >= 0
            seek(page, motion, .37)
            baseline = carriage(page)
            readouts = [page.locator("#hX").inner_text(), page.locator("#hZ").inner_text()]
            frozen = frozen_state(page)
            enter(page)
            x = z = 0
            for step in (.1, 1, 10):
                set_step(page, step)
                for control, dx, dz in (("XPlus", step, 0), ("ZPlus", 0, step),
                                        ("XMinus", -step, 0), ("ZMinus", 0, -step)):
                    page.locator(f"#jog{control}3d").click()
                    x += dx
                    z += dz
                    actual = carriage(page)
                    assert_translation(baseline, actual, x=x, z=z)
                    close(actual["jog"]["x"], x)
                    close(actual["jog"]["z"], z)
                    close(float(page.locator("#hX").inner_text()), float(readouts[0]) + 2*x, .0011)
                    close(float(page.locator("#hZ").inner_text()), float(readouts[1]) + z, .0011)
                    assert_frozen(page, frozen)
            set_step(page, 1)
            page.locator("#jogXPlus3d").click()
            page.locator("#jogZMinus3d").click()
            assert_translation(baseline, carriage(page), x=1, z=-1)
            expect(page.locator("#jogOffset3d")).to_be_visible()
            expect(page.locator("#jogPosition3d")).to_be_visible()
            page.locator("#detail3d").click()
            page.locator("#front3d").click()
            page.locator("#stage3d").screenshot(path=str(OUT / "jog-carriage.png"))
            page.locator("#jogReturn3d").click()
            assert_cleared(page)
            assert_translation(baseline, carriage(page))
            assert_frozen(page, frozen)
            assert [page.locator("#hX").inner_text(), page.locator("#hZ").inner_text()] == readouts
            passed.append("0.1/1/10 mm buttons move all tips together; X display uses diameter")

            # Entering from playback freezes the actual interpolated position.
            seek(page, motion, .2)
            page.locator("#speed").evaluate("""el => {
              el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));
            }""")
            # Dispatch both controls in-page so Playwright scrolling between
            # them cannot consume the whole motion under software rendering.
            page.evaluate("""() => new Promise(resolve => {
              document.getElementById('btnPlay').click();
              setTimeout(() => {document.getElementById('jogToggle3d').click();resolve();},100);
            })""")
            expect(page.locator("#jogPanel3d")).to_be_visible()
            frozen = frozen_state(page)
            paused = carriage(page)
            assert frozen["index"] == motion and .2 <= frozen["fraction"] < 1, (
                motion, frozen["index"], frozen["fraction"]
            )
            page.locator("#jogXMinus3d").click()
            page.wait_for_timeout(180)
            assert_frozen(page, frozen)
            page.locator("#jogReturn3d").click()
            assert_translation(paused, carriage(page))
            assert_frozen(page, frozen)
            passed.append("entering during playback freezes a partial motion without jumping")

            # Real cut geometry and already detached pieces cannot change in JOG.
            first_cut = page.evaluate("cutEvents[0].index")
            seek(page, first_cut, 1)
            frozen = frozen_state(page)
            enter(page)
            page.locator("#jogXMinus3d").click()
            page.locator("#jogZPlus3d").click()
            page.wait_for_timeout(180)
            assert_frozen(page, frozen)
            page.locator("#jogReturn3d").click()
            assert_frozen(page, frozen)
            passed.append("JOG leaves NC, stock mesh, detached parts and material clock unchanged")

            # After material pulls and a new G10 origin, displayed NC Z remains
            # the same reference even though the scene uses physical stock Z.
            shifted_motion = page.evaluate("""() => {
              const offset=trace.findLastIndex(s=>s.act==='offset');
              return trace.findIndex((s,i)=>i>offset && s.seg);
            }""")
            assert shifted_motion >= 0
            seek(page, shifted_motion, .37)
            shifted = carriage(page)
            shifted_z = float(page.locator("#hZ").inner_text())
            frozen = frozen_state(page)
            enter(page)
            close(float(page.locator("#hZ").inner_text()), shifted_z, .0011)
            page.locator("#jogZPlus3d").click()
            close(float(page.locator("#hZ").inner_text()), shifted_z + 1, .0011)
            assert_translation(shifted, carriage(page), z=1)
            assert_frozen(page, frozen)
            page.locator("#jogReturn3d").click()
            assert_translation(shifted, carriage(page))
            passed.append("manual Z preserves the NC coordinate reference after pulls and G10")

            # Arrow keys operate one increment, never browser key-repeat.
            seek(page, motion, .37)
            enter(page)
            baseline = carriage(page)
            frozen = frozen_state(page)
            page.locator("#jogXPlus3d").focus()
            page.keyboard.press("ArrowUp")
            assert_translation(baseline, carriage(page), x=1)
            page.evaluate("""() => document.activeElement.dispatchEvent(new KeyboardEvent(
              'keydown',{key:'ArrowUp',code:'ArrowUp',repeat:true,bubbles:true,cancelable:true}))""")
            assert_translation(baseline, carriage(page), x=1)
            page.keyboard.press("ArrowDown")
            page.keyboard.press("ArrowRight")
            assert_translation(baseline, carriage(page), z=1)
            page.keyboard.press("ArrowLeft")
            assert_translation(baseline, carriage(page))
            assert_frozen(page, frozen)

            # Text editing and form navigation must never jog or seek the NC.
            page.locator("#editToggle").click()
            page.locator("#editor").focus()
            for key in ("ArrowRight", "ArrowUp", "Home", "Space"):
                page.keyboard.press(key)
            assert_translation(baseline, carriage(page))
            page.locator("#editor").fill(original)
            page.locator("#editToggle").click()
            page.locator("#boringGap3d").focus()
            page.keyboard.press("ArrowRight")
            page.locator("#jogStep3d").focus()
            page.keyboard.press("ArrowRight")
            assert_translation(baseline, carriage(page))
            assert_frozen(page, frozen)
            passed.append("arrow keys jog once, ignore repeats and preserve editor/input navigation")

            # Every route back into NC playback or navigation clears manual data.
            page.locator("#jogZPlus3d").click()
            page.locator("#btnPlay").click()
            assert_cleared(page)
            assert page.evaluate("SoltriSim3D.snapshot().playing")
            page.locator("#btnPlay").click()
            page.wait_for_function("!SoltriSim3D.snapshot().playing")
            for action in ("seek", "reset", "2d", "recompute"):
                seek(page, motion, .37)
                enter(page)
                page.locator("#jogZPlus3d").click()
                if action == "seek":
                    page.locator("#seek").evaluate("""(el,index) => {
                      el.value=String(index+1);el.dispatchEvent(new Event('input',{bubbles:true}));
                    }""", motion)
                elif action == "reset":
                    page.locator("#btnReset").click()
                elif action == "2d":
                    page.locator("#btn3d").click()
                    expect(page.locator("#cv")).to_be_visible()
                else:
                    revision = page.evaluate("SoltriSim3D.snapshot().revision")
                    page.locator("#loadBtn").click()
                    page.wait_for_function("r => SoltriSim3D.snapshot().revision>r", arg=revision)
                assert_cleared(page)
                if action == "2d":
                    page.locator("#btn3d").click()
                    expect(page.locator("#stage3d")).to_be_visible()
                    assert_cleared(page)
            passed.append("play, seek, reset, 2D switch and recalculation clear manual offsets")

            # Unknown G30 machine coordinates cannot be invented by manual mode.
            park = page.evaluate("trace.findIndex(s=>s.act==='park')")
            assert park >= 0
            seek(page, park)
            assert not page.evaluate("Unit7View.debug.located")
            expect(page.locator("#jogToggle3d")).to_be_disabled()
            assert_cleared(page)
            passed.append("G30 unknown machine position disables JOG")

            seek(page, motion)
            enter(page)
            page.locator("#jogXPlus3d").click()
            page.locator("#sampleSel").select_option("O0600")
            page.wait_for_function("mainKey==='600'")
            expect(page.locator("#stage3d")).to_be_hidden()
            assert_cleared(page)
            page.locator("#sampleSel").select_option("O0852_UNIT7")
            page.wait_for_function("SoltriSim3D.isUnit7() && Unit7View.enabled()")
            assert_cleared(page)
            assert page.locator("#editor").input_value() == original
            page.set_viewport_size({"width": 390, "height": 844})
            enter(page)
            page.locator("#jogXPlus3d").click()
            page.wait_for_timeout(150)
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            panel = page.locator("#jogPanel3d").bounding_box()
            assert panel and panel["x"] >= 0 and panel["x"] + panel["width"] <= 391, panel
            for control in ("XPlus", "XMinus", "ZPlus", "ZMinus"):
                expect(page.locator(f"#jog{control}3d")).to_be_visible()
            page.locator("#jogPanel3d").screenshot(path=str(OUT / "jog-mobile-controls.png"))
            page.screenshot(path=str(OUT / "jog-mobile.png"), full_page=True)
            passed.append("sample changes clear JOG; controls fit and operate at 390 px")
            assert not errors, errors
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

print(json.dumps({"passed": passed, "screenshots": str(OUT)}, ensure_ascii=False))
