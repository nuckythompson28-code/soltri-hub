"""KIT60G scale/context model: catalog envelope, schematic panels. No OEM CAD implied.
Blender axes: X=NC Z, Y=front/back (front negative), Z=height.
Origin: chuck face/spindle center, installation position estimated.
"""
import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'models/kit60g'
spec=json.loads((OUT/'specs.json').read_text(encoding='utf-8'));s=spec['specs'];a=spec['modelAssumptions']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.48;p.inputs['Metallic'].default_value=.18;return m
white=mat('Warm grey enamel',(.78,.81,.83));navy=mat('Blue grey base',(.12,.20,.27));steel=mat('Guide steel',(.36,.43,.48));dark=mat('Opening',(.07,.105,.13));blue=mat('Blue accent',(.06,.25,.42));screen=mat('Screen',(.15,.30,.35))
def box(name,loc,dim,m,bevel=4):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dim;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);o['estimated']=True
 if bevel:
  mod=o.modifiers.new('Edges','BEVEL');mod.width=bevel;mod.segments=2
 return o
# Verified envelope only; subdivision, door openings and spindle origin are schematic.
L,W,H=s['floorLengthMm'],s['floorWidthMm'],s['heightMm'];x0=-a['spindleFromLeftMm'];y0=-a['spindleFromFrontMm'];z0=-a['spindleHeightMm'];cx=x0+L/2;cy=y0+W/2
box('Base',(cx,cy,z0+250),(L,W,500),navy)
box('Left headstock enclosure',(x0+275,cy,z0+1160),(550,W,1320),white)
box('Right electrical enclosure',(x0+L-260,cy+50,z0+1160),(520,W-100,1320),white)
box('Top beam',(cx,cy,z0+H-25),(L,W,50),white,2)
box('Rear guard',(cx,y0+W-25,z0+1150),(L-1070,50,1250),white)
box('Front sill',(cx,y0+30,z0+575),(L-1070,60,150),white)
# Open access aperture; not a claim that actual doors are open during cutting.
box('Door stowed schematic',(x0+600,y0+20,z0+1200),(100,40,1190),blue)
box('Control panel',(x0+L-290,y0+55,z0+1220),(350,80,660),navy)
box('Control display',(x0+L-290,y0+10,z0+1350),(280,14,220),screen,2)
for row in range(4):
 for col in range(6):box(f'Key {row}-{col}',(x0+L-410+col*47,y0+5,z0+1160-row*40),(22,10,17),white,1)
# Headstock positioned on spindle axis. Its width/depth are visual estimates.
box('Headstock',( -300,120,-70),(360,430,460),steel)
# The guide plane rises towards the back at the confirmed 45-degree bed angle.
bed=box('45 degree slant bed',(480,240,-310),(1350,650,95),steel);bed.rotation_euler.x=math.radians(s['bedSlantDeg'])
for y in (100,340):
 rail=box('Z linear guide '+str(y),(470,y,-310+(y-240)),(1300,32,30),dark);rail.rotation_euler.x=math.radians(s['bedSlantDeg'])
# Editable reference bounds are invisible empties; no claimed travel zero.
root=bpy.data.objects.new('KIT60G_STATIC_CONTEXT',None);bpy.context.collection.objects.link(root);root['geometryStatus']='verified overall envelope; estimated panels and origin';root['bedSlantDeg']=s['bedSlantDeg']
for o in list(bpy.context.scene.objects):
 if o!=root:o.parent=root
for name,loc in [('ENVELOPE_MIN',(x0,y0,z0)),('ENVELOPE_MAX',(x0+L,y0+W,z0+H))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=root;o.location=loc
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kit60g-context.blend'))
scene.unit_settings.scale_length=1
bpy.ops.export_scene.gltf(filepath=str(OUT/'context.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False,export_yup=True)
print('KIT60G envelope',L,W,H,'bed angle',s['bedSlantDeg'])
