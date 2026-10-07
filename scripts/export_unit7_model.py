import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'models/unit7/source.blend'))
keep=[]
for obj in list(bpy.data.objects):
    if ((obj.name.startswith('NO__') and obj.get('component_type')=='rigid_machine') or (obj.name.startswith('OK__') and any(k in obj.name for k in ['HOSE_BODY','HOSE_MOUTH','INNER_SLEEVE','DARK_INTERIOR']))) and not any(k in obj.name for k in ['Hollow stock','Chuck']):
        obj.location.x+=246 if obj.name.startswith('NO__') else -246; obj.name=obj.name[4:];keep.append(obj)
    else:bpy.data.objects.remove(obj,do_unlink=True)
root=bpy.data.objects.new('UNIT7_CARRIAGE',None);bpy.context.scene.collection.objects.link(root)
for obj in keep:
    obj.parent=root
    obj['role']='hose' if any(k in obj.name for k in ['HOSE','SLEEVE','INTERIOR']) else 'machine'
    obj['tool']=1 if any(k in obj.name for k in ['boring','BORING','UPPER','LOWER','Boring']) else 2 if 'Parting' in obj.name or 'PARTING' in obj.name else 3 if 'Auto link' in obj.name else 0
    # Use plain materials for glTF; application supplies transparent mode.
    for slot in obj.material_slots:
        if slot.material and slot.material.use_nodes:
            bs=slot.material.node_tree.nodes.get('Principled BSDF')
            if bs:slot.material.node_tree.links.new(bs.outputs[0],slot.material.node_tree.nodes.get('Material Output').inputs[0])
# User-confirmed geometry: X offsets are diametric; physical separation is X/2.
from mathutils import Vector
user=json.loads((ROOT/'models/unit7/user-geometry.json').read_text(encoding='utf-8'))
gap=3.2  # preview only; runtime adjustable, not measured setup
T1=(-12,-41,-22)
g=user['geometry'];base=g['1']
def tip(n):
    return (T1[0]+base['Z']-g[n]['Z'],T1[1],T1[2]+(base['X']-g[n]['X'])/2)
T2=tip('2');T3=tip('3')
for o in keep:
    if o.name.startswith('Parting') or o.name=='PARTING_CARBIDE':
        o.location+=Vector((T2[0]-(-85),T2[1]-(-48),T2[2]-5))
    if o.name.startswith('Auto link'):
        o.location+=Vector((T3[0]-20,T3[1]-(-27),T3[2]-181));o['tool']=3
# Square inserts have 90-degree working corners; upper/lower corners share Z.
gold=bpy.data.materials.get('Carbide')
steel=bpy.data.materials.get('Steel')
def box(name,loc,size,material,tool,role='cutting'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);o.parent=root;o['tool']=tool;o['role']=role;return o
for name in ['UPPER_CARBIDE','LOWER_CARBIDE','PARTING_CARBIDE','Parting holder','Parting clamp']:
    o=bpy.data.objects.get(name)
    if o:bpy.data.objects.remove(o,do_unlink=True)
x,y,z=T1
def diamond(name,tip,cutting_vertex):
    # A square rotated 45 degrees in the front X/Z plane. Bottom vertex is datum.
    import math
    x,y,z=tip;d=8/math.sqrt(2);direction=1 if cutting_vertex=="bottom" else -1
    outline=[(x,z),(x+d,z+direction*d),(x,z+direction*2*d),(x-d,z+direction*d)]
    verts=[(px,py,pz) for py in [y,y+4] for px,pz in outline]
    faces=[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(o);o.parent=root;o.data.materials.append(gold)
    o['role']='cutting';o['tool']=1;o['cornerAngleDeg']=90;o['rotationInPlaneDeg']=45;o['cuttingVertex']=cutting_vertex;return o
upper=diamond('UPPER_CARBIDE',T1,'bottom')
lower=diamond('LOWER_CARBIDE',(x,y,z-gap),'top')
bpy.data.objects['Upper rectangular boring bar'].location.z=z+16
lowerbar=bpy.data.objects['Lower round boring bar'];lowerbar.location.z=z-gap-16
for o in [lower,lowerbar]:o['gapFollower']=True;o['baseGapMm']=gap
# 2mm is axial cutting width (Blender X / NC Z), not depth along the camera.
x,y,z=T2
box('PARTING_CARBIDE',(x+1,y+4,z+1.5),(2,8,3),gold,2)
box('Parting thin blade',(x+1,y+11,z+18),(2,22,30),steel,2)
box('Parting holder',(x+8,y+18,z+43),(18,34,22),steel,2,'machine')
# Holder shapes remain schematic; their overall front-view envelope is user-sized.
# Clamp only background hardware to bounds; measured cutting anchors never scale.
bpy.context.view_layer.update()
from mathutils import Vector
xmin,xmax,zmin,zmax=-80,220,-70,230
for o in list(bpy.data.objects):
    if o.parent!=root or o.get('role')=='hose' or o.name.startswith('Auto link'):continue
    if o.type not in {'MESH','CURVE'}:continue
    pts=[o.matrix_world@Vector(c) for c in o.bound_box]
    for axis,lo,hi in [(0,xmin,xmax),(2,zmin,zmax)]:
        low=min(v[axis] for v in pts);high=max(v[axis] for v in pts)
        if high-low>hi-lo:
            o.scale[axis]*=(hi-lo)/(high-low)
            bpy.context.view_layer.update();pts=[o.matrix_world@Vector(c) for c in o.bound_box];low=min(v[axis] for v in pts);high=max(v[axis] for v in pts)
        o.location[axis]+=max(0,lo-low)-max(0,high-hi)
        bpy.context.view_layer.update();pts=[o.matrix_world@Vector(c) for c in o.bound_box]
box('300mm assembly backing',((xmin+xmax)/2,126,(zmin+zmax)/2),(300,16,300),steel,0,'machine')
for name,loc in [('TOOLS_MIN',(xmin,0,zmin)),('TOOLS_MAX',(xmax,0,zmax))]:
    o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=root;o.location=loc
for name,xyz in [('ANCHOR_T1',T1),('ANCHOR_T2',T2),('ANCHOR_T3',T3),('BORING_UPPER_TIP',T1),('BORING_LOWER_TIP',(T1[0],T1[1],T1[2]-gap))]:
    obj=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(obj);obj.parent=root;obj.location=xyz;obj['estimated']=True
    if name=='BORING_LOWER_TIP':obj['gapFollower']=True;obj['baseGapMm']=gap
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=.001
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'models/unit7/carriage-current.blend'))
root['machine']='7';root['program']='O0852';root['geometryStatus']='user-confirmed anchor separations; schematic holders'
bpy.context.scene.unit_settings.scale_length=1
bpy.ops.export_scene.gltf(filepath=str(ROOT/'models/unit7/carriage.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
meta={'machine':7,'machineModel':'KIT60G','equipmentSpecs':'../kit60g/specs.json','program':'O0852','status':'user-dimensions-with-schematic-holders','physicalOffsetsConfirmed':True,'hosePlacement':'retracted educational example, not measured on machine7','pneumaticStrokeConfirmed':False,'source':'O0852 Blender training model, user supplied photos 2026-10-02','blenderVersion':bpy.app.version_string,'units':'illustrative millimetres','anchors':{'1':{'x':-12,'y':-22,'z':41},'2':{'x':T2[0],'y':T2[2],'z':-T2[1]},'3':{'x':T3[0],'y':T3[2],'z':-T3[1]}},'mCodes':{'boringUp':53,'boringDown':54,'autoLinkOpen':64,'autoLinkClose':63},'userGeometry':user,'baseTipGapMm':gap,'maxTipGapMm':7,'nominalPartingWidthMm':2,'boringIncludedAngleDeg':90,'boringRotationDeg':45,'cuttingVertex':{'upper':'bottom','lower':'top'},'toolEnvelopeMm':[300,300],'notes':['User confirmed X is diameter; radial anchor separation = geometry difference/2.','Holder shapes and front/back depth remain estimates; wear and machine zero unknown.','Stroke not animated until measured.','Program interpreter drives selected anchor; all other objects move together.']}
(ROOT/'models/unit7/setup.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')