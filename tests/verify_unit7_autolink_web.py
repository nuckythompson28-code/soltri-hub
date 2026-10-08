"""Verify the real three-arm AutoLink model and its deterministic NC playback."""
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import math
import re
import tempfile

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(tempfile.gettempdir()) / "unit7-autolink-review"
OUT.mkdir(exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def close(actual, expected, tolerance=1e-4):
    assert math.isfinite(actual) and abs(actual - expected) <= tolerance, (actual, expected)


def vector_close(actual, expected, tolerance=1e-4):
    assert len(actual) == len(expected)
    for value, wanted in zip(actual, expected):
        close(value, wanted, tolerance)


def seek(page, index, fraction=1):
    page.evaluate("""([index,fraction]) => {
      gotoStep(index); animT=fraction; updateAll(); Unit7View.sync();
    }""", [index, fraction])
    page.wait_for_function("i => Unit7View.debug.index===i", arg=index)


def geometry(page):
    """Measure GLB vertices in physical work coordinates, without pose metadata."""
    return page.evaluate("""() => {
      const d=Unit7View.debug,s=SoltriSim3D.snapshot(),m=d.model;
      d.workFrame.updateWorldMatrix(true,true);
      const local=p=>d.workFrame.worldToLocal(p).toArray();
      const world=o=>local(o.getWorldPosition(o.position.clone()));
      const head=m.getObjectByName('AUTOLINK_HEAD');
      const center=world(head);
      const pins=[1,2,3].map(i=>{
        const pin=m.getObjectByName('AUTOLINK_PIN_'+i);
        const jaw=m.getObjectByName('AUTOLINK_JAW_'+i);
        pin.geometry.computeBoundingBox();
        const p=pin.geometry.boundingBox.getCenter(pin.position.clone());
        const c=local(p.applyMatrix4(pin.matrixWorld));
        const a=pin.geometry.attributes.position,points=[];
        for(let k=0;k<a.count;k++)
          points.push(local(p.fromBufferAttribute(a,k).applyMatrix4(pin.matrixWorld)));
        const radial=points.map(v=>Math.hypot(v[1]-center[1],v[2]-center[2]));
        const radius=Math.max(...points.map(v=>Math.hypot(v[1]-c[1],v[2]-c[2])));
        const direction=jaw.position.clone().set(0,1,0).transformDirection(jaw.matrixWorld);
        return {name:pin.name,parent:pin.parent.name,jawParent:jaw.parent.name,
          vertices:a.count,center:c,radius,inner:Math.min(...radial),
          centerRadius:Math.hypot(c[1]-center[1],c[2]-center[2]),
          axial:[Math.min(...points.map(v=>v[0])),Math.max(...points.map(v=>v[0]))],
          pivot:world(jaw),direction:direction.toArray(),quaternion:jaw.quaternion.toArray(),
          localPosition:jaw.position.toArray(),pinScale:pin.scale.toArray(),
          armMeshes:jaw.children.filter(o=>o.isMesh && o!==pin).map(o=>o.name)};
      });
      d.stockMesh.geometry.computeBoundingBox();
      const b=d.stockMesh.geometry.boundingBox;
      return {center,pins,model:m.position.toArray(),modelScale:m.scale.toArray(),
        headScale:head.scale.toArray(),headVisible:head.visible && m.visible,
        anchor:world(m.getObjectByName('ANCHOR_T3')),
        anchors:[1,2,3].map(t=>d.anchors[t].toArray()),
        stock:[b.min.x,b.max.x],rawOD:s.stock.rawO,
        closed:s.autoLink.closed,changing:s.autoLink.changing,
        index:s.index,fraction:s.fraction,time:s.visualTime,playing:s.playing};
    }""")


def nc_signature(page):
    value = page.evaluate("""() => ({
      source:document.getElementById('editor').value,sourceText,
      trace:JSON.stringify(trace),lines:JSON.stringify(programLines),
      parts:trace.at(-1).state.parts,moves:trace.filter(s=>s.seg).length,
      target:stockInfo.target,cuts:JSON.stringify(cutEvents)
    })""")
    for key in ("source", "sourceText", "trace", "lines", "cuts"):
        value[key] = sha256(value[key].encode()).hexdigest()
    return value


def material_signature(page):
    return page.evaluate("""() => {
      const s=SoltriSim3D.snapshot(),d=Unit7View.debug;
      return JSON.stringify({material:s.material,stock:s.stock,
        vertices:Array.from(d.stockMesh.geometry.attributes.position.array),
        chuck:d.chuck.position.toArray()});
    }""")


def assert_contact(state, radius):
    assert state["headVisible"]
    vector_close(state["center"], state["anchor"])
    # All three pins surround the spindle, not one copy offset beside it.
    close(state["center"][1], 0)
    close(state["center"][2], 0)
    for pin in state["pins"]:
        close(pin["radius"], 5)
        close(pin["axial"][1] - pin["axial"][0], 18)
        close(pin["centerRadius"] - pin["radius"], radius)
        # A faceted cylinder can differ from its analytic contact by <0.1 mm.
        assert radius - .001 <= pin["inner"] <= radius + .1, pin
    for i in range(3):
        a, b = state["pins"][i], state["pins"][(i + 1) % 3]
        ay, az = a["center"][1:]
        by, bz = b["center"][1:]
        close((ay * by + az * bz) / (a["centerRadius"] * b["centerRadius"]), -.5)


def assert_translation(before, after, delta):
    vector_close(after["model"], [a + b for a, b in zip(before["model"], delta)])
    vector_close(after["center"], [a + b for a, b in zip(before["center"], delta)])
    for a, b in zip(before["pins"], after["pins"]):
        vector_close(b["center"], [x + y for x, y in zip(a["center"], delta)])
        vector_close(b["pivot"], [x + y for x, y in zip(a["pivot"], delta)])
        vector_close(b["quaternion"], a["quaternion"])
    assert after["anchors"] == before["anchors"]


def compute_source(page, source):
    editor = page.locator("#editor")
    if not editor.is_visible():
        page.locator("#editToggle").click()
    revision = page.evaluate("SoltriSim3D.snapshot().revision")
    editor.fill(source)
    page.locator("#loadBtn").click()
    page.wait_for_function("r=>SoltriSim3D.snapshot().revision>r", arg=revision)
    page.locator("#editToggle").click()


def play_until_progress(page, index, after=0):
    """Pause on a rendered partial frame, independent of software-renderer speed."""
    page.evaluate("""([index,after]) => new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{SoltriSim3D.pause();reject(Error('No partial clamp frame'));},15000);
      document.getElementById('btnPlay').click();
      const observe=()=>{
        const s=SoltriSim3D.snapshot();
        if(s.index!==index || s.fraction>=1){
          clearTimeout(timeout);SoltriSim3D.pause();
          reject(Error('Clamp playback skipped its partial frame: '+JSON.stringify({index:s.index,fraction:s.fraction})));
        }else if(s.fraction>after+.015){
          clearTimeout(timeout);SoltriSim3D.pause();Unit7View.sync();resolve();
        }else requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    })""", [index, after])


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
            page.wait_for_function("Unit7View.debug.autoLink && SoltriSim3D.snapshot().autoLink")
            original = page.locator("#editor").input_value()
            baseline = nc_signature(page)
            assert baseline["parts"] == baseline["target"] == 50
            assert page.evaluate("""() => {
              const r=runProgram(SAMPLES.O0852_UNIT7,Number(document.getElementById('maxMoves').value));
              return sourceText===SAMPLES.O0852_UNIT7 && JSON.stringify(r.trace)===JSON.stringify(trace);
            }""")

            # Verify these are authored GLB nodes, not runtime stand-in boxes.
            asset = page.evaluate("""async () => {
              const bytes=await (await fetch('models/unit7/carriage.glb')).arrayBuffer();
              const view=new DataView(bytes);
              if(view.getUint32(0,true)!==0x46546c67)throw Error('Not a GLB');
              const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))));
              return [1,2,3].map(i=>{
                const pin=json.nodes.find(n=>n.name==='AUTOLINK_PIN_'+i);
                const jaw=json.nodes.find(n=>n.name==='AUTOLINK_JAW_'+i);
                const head=json.nodes.find(n=>n.name==='AUTOLINK_HEAD');
                return {pin:!!pin && pin.mesh!==undefined,
                  geometry:pin?.mesh!==undefined ? json.meshes[pin.mesh].primitives.length:0,
                  jaw:!!jaw,head:!!head,
                  pinInJaw:jaw?.children?.includes(json.nodes.indexOf(pin)),
                  jawInHead:head?.children?.includes(json.nodes.indexOf(jaw))};
              });
            }""")
            assert len(asset) == 3 and all(all(item.values()) for item in asset), asset
            passed.append("GLB contains three pivot assemblies and real contact-pin meshes")

            events = page.evaluate("""() => trace.flatMap((s,i)=>
              i>0 && s.state.alClamp!==trace[i-1].state.alClamp
                ? [{index:i,closed:s.state.alClamp==='closed',motion:!!s.seg,desc:s.desc}]:[])""")
            closing = next(e["index"] for e in events if e["closed"])
            opening = next(e["index"] for e in events if not e["closed"] and e["index"] > closing)
            assert all(not e["motion"] for e in events), events
            assert "M63" in next(e["desc"] for e in events if e["index"] == closing)
            assert "M64" in next(e["desc"] for e in events if e["index"] == opening)
            assert page.evaluate("i=>trace[i].state.toolNo===3 && trace[i].state.X===0", closing)

            seek(page, closing, 0)
            opened = geometry(page)
            frozen_material = material_signature(page)
            close(opened["closed"], 0)
            seek(page, closing, .5)
            halfway = geometry(page)
            close(halfway["closed"], .5)
            assert halfway["changing"]
            seek(page, closing)
            closed = geometry(page)
            close(closed["closed"], 1)
            assert_contact(closed, 35)
            assert material_signature(page) == frozen_material
            for a, mid, b in zip(opened["pins"], halfway["pins"], closed["pins"]):
                close(a["centerRadius"] - b["centerRadius"], 8)
                assert b["centerRadius"] < mid["centerRadius"] < a["centerRadius"]
                assert math.dist(a["direction"], b["direction"]) > .1
                vector_close(a["pivot"], b["pivot"])
                vector_close(a["localPosition"], b["localPosition"])
                assert a["armMeshes"] and a["parent"].startswith("AUTOLINK_JAW_")
                assert a["jawParent"] == "AUTOLINK_HEAD" and a["vertices"] > 30
                overlap = min(b["axial"][1], closed["stock"][1]) - max(b["axial"][0], closed["stock"][0])
                assert overlap > 5, (b["axial"], closed["stock"])
            vector_close(opened["model"], closed["model"])
            page.locator("#autolink3d").click()
            page.locator("#stage3d").screenshot(path=str(OUT / "closed-contact.png"))
            passed.append("X0 centers T3; all three pins contact OD70 behind the face through pivoting arms")

            # Both M63 and M64 have partial, reversible, deterministic poses.
            for index, from_closed, to_closed in ((closing, 0, 1), (opening, 1, 0)):
                seek(page, index, 0)
                start = geometry(page)
                close(start["closed"], from_closed)
                seek(page, index, .5)
                middle = geometry(page)
                close(middle["closed"], .5)
                assert middle["changing"]
                page.wait_for_timeout(160)
                assert geometry(page) == middle
                seek(page, index)
                end = geometry(page)
                close(end["closed"], to_closed)
                vector_close(start["model"], end["model"])
                assert abs(start["pins"][0]["centerRadius"] - end["pins"][0]["centerRadius"]) > 7.9
                if index == opening:
                    page.locator("#autolink3d").click()
                    page.locator("#stage3d").screenshot(path=str(OUT / "open-clearance.png"))
                seek(page, index + 1)
                resting = geometry(page)
                close(resting["closed"], to_closed)
                for a, b in zip(end["pins"], resting["pins"]):
                    vector_close(a["center"], b["center"])
                seek(page, index, .5)
                assert geometry(page) == middle
            page.locator("#stage3d").screenshot(path=str(OUT / "opening-halfway.png"))
            passed.append("M63/M64 seeking reconstructs half-open and resting poses without time drift")

            # Playback must visit each non-motion clamp block instead of skipping it.
            page.locator("#speed").evaluate("""el=>{
              el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));
            }""")
            for index in (closing, opening):
                seek(page, index - 1)
                play_until_progress(page, index)
                paused = geometry(page)
                assert paused["index"] == index and 0 < paused["fraction"] < 1, paused
                assert not paused["playing"] and 0 < paused["closed"] < 1
                expected_source = page.evaluate("i=>programLines[trace[i].lineIdx].raw", index)
                assert expected_source.strip() in page.locator("#runningSource").inner_text()
                page.wait_for_timeout(160)
                assert geometry(page) == paused
                play_until_progress(page, index, paused["fraction"])
                resumed = geometry(page)
                assert resumed["index"] == index and paused["fraction"] < resumed["fraction"] < 1
                assert resumed["time"] > paused["time"]
            passed.append("playback visibly animates non-motion clamp blocks and preserves pause/resume progress")

            pulls = page.evaluate("trace.flatMap((s,i)=>s.pull?[{index:i,distance:s.pull}]:[])")
            assert len(pulls) >= 2
            for pull in pulls:
                index, distance = pull["index"], pull["distance"]
                assert distance > 0
                seek(page, index, 0)
                before = geometry(page)
                assert_contact(before, 35)
                for fraction in (.5, 1):
                    seek(page, index, fraction)
                    moved = geometry(page)
                    assert_translation(before, moved, [distance * fraction, 0, 0])
                    vector_close(moved["stock"], [v + distance * fraction for v in before["stock"]])
                    assert_contact(moved, 35)
                    if pull == pulls[0] and fraction == .5:
                        page.locator("#autolink3d").click()
                        page.locator("#stage3d").screenshot(path=str(OUT / "pull-halfway.png"))
                seek(page, index + 1)
                after = geometry(page)
                assert_translation(before, after, [distance, 0, 0])
                vector_close(after["stock"], [v + distance for v in before["stock"]])
            passed.append("every pull carries all three closed pins and the full stock together along +Z")

            # Existing JOG remains one rigid carriage move, without pulling stock.
            seek(page, closing)
            before = geometry(page)
            frozen_material = material_signature(page)
            page.locator("#jogToggle3d").click()
            page.locator("#jogStep3d").select_option("1")
            page.locator("#jogXPlus3d").click()
            page.locator("#jogZMinus3d").click()
            assert_translation(before, geometry(page), [-1, 1, 0])
            assert material_signature(page) == frozen_material
            page.locator("#jogReturn3d").click()
            assert_translation(before, geometry(page), [0, 0, 0])
            assert nc_signature(page) == baseline
            passed.append("JOG moves the complete gripper while NC, part count and stock stay unchanged")

            # Changing raw OD rotates the real linkage; it must not scale the
            # gripper or shift the measured T1/T2/T3 geometry references.
            changed = re.sub(r"(#109\s*=\s*)70\b", r"\g<1>90", original, count=1)
            assert changed != original
            compute_source(page, changed)
            closing_90 = page.evaluate("trace.findIndex((s,i)=>i>0 && s.state.alClamp==='closed' && trace[i-1].state.alClamp!=='closed')")
            seek(page, closing_90)
            wider = geometry(page)
            assert_contact(wider, 45)
            assert wider["anchors"] == closed["anchors"]
            assert wider["modelScale"] == closed["modelScale"]
            assert wider["headScale"] == closed["headScale"]
            for a, b in zip(closed["pins"], wider["pins"]):
                assert a["pinScale"] == b["pinScale"]
                vector_close(a["localPosition"], b["localPosition"])
                assert math.dist(a["direction"], b["direction"]) > .1
            page.locator("#autolink3d").click()
            page.locator("#stage3d").screenshot(path=str(OUT / "od90-contact.png"))
            passed.append("OD90 changes the grasp by arm rotation while pin dimensions and T anchors remain fixed")

            # Other machines retain their existing interpreter and 2D playback.
            for sample, main in (("O0600", "600"), ("O0852", "852")):
                page.locator("#sampleSel").select_option(sample)
                page.wait_for_function("key=>mainKey===key && !SoltriSim3D.isUnit7()", arg=main)
                expect(page.locator("#stage3d")).to_be_hidden()
                assert not page.evaluate("Unit7View.enabled()")
                assert page.evaluate("""() => {
                  const r=runProgram(sourceText,Number(document.getElementById('maxMoves').value));
                  return JSON.stringify(r.trace)===JSON.stringify(trace);
                }""")
                assert page.evaluate("""() => trace.every((s,i)=>{
                  if(s.seg)return true;
                  return SoltriSim3D.eventTime(i,0)===SoltriSim3D.eventTime(i,1);
                })""")
            page.locator("#sampleSel").select_option("O0852_UNIT7")
            page.wait_for_function("SoltriSim3D.isUnit7() && Unit7View.enabled()")
            assert nc_signature(page) == baseline
            seek(page, closing)
            assert_contact(geometry(page), 35)
            passed.append("unit5 and unit10 remain isolated; reloading restores the unchanged 50-part NC sample")
            assert not errors, errors
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

print(json.dumps({"passed": passed, "screenshots": str(OUT)}, ensure_ascii=False))
