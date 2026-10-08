"""Run with Blender -b --python to validate the export and render review images."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'models/unit7/carriage-current.blend'))
scene = bpy.context.scene
head = bpy.data.objects['AUTOLINK_HEAD']
assert (head.location - bpy.data.objects['ANCHOR_T3'].location).length < 1e-7
assert not any(o.name.startswith('Auto link') for o in bpy.data.objects)
bpy.context.view_layer.update()
for i in range(1, 4):
    jaw = bpy.data.objects[f'AUTOLINK_JAW_{i}']
    pin = bpy.data.objects[f'AUTOLINK_PIN_{i}']
    assert pin.parent == jaw and jaw.parent == head
    center = head.matrix_world.inverted() @ pin.matrix_world.translation
    assert abs(math.hypot(center.y, center.z) - 40) < 1e-4, center
    points = [head.matrix_world.inverted() @ pin.matrix_world @ v.co for v in pin.data.vertices]
    assert abs(min(p.x for p in points) + 12) < 1e-4
    assert abs(max(p.x for p in points) - 6) < 1e-4
    assert abs(pin['radiusMm'] - 5) < 1e-8
    assert bpy.data.objects[f'AUTOLINK_ARM_{i}'].parent == jaw

points = [o.matrix_world @ v.co for o in scene.objects if o.type == 'MESH' and o.get('role') != 'hose' for v in o.data.vertices]
for axis in [0, 2]:
    assert abs(max(v[axis] for v in points) - min(v[axis] for v in points) - 300) < .05
print('PASS: preserved T3, three rigid-arm external pin contacts, axial overlap, 300x300 envelope')

for o in scene.objects:
    o.hide_render = not o.name.startswith('AUTOLINK_')
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.studiolight_rotate_z = math.radians(25)
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.curvature_ridge_factor = 1.4
scene.display.shading.curvature_valley_factor = 1.2
scene.display.shading.show_specular_highlight = True
scene.display.shading.background_type = 'WORLD'
scene.world.color = (.15, .18, .22)
scene.render.resolution_x = 1200
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
camera_data = bpy.data.cameras.new('Autolink review camera')
camera = bpy.data.objects.new('Autolink review camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 305
target = head.location + Vector((30, -15, -48))
for label, offset in [('front', (-500, 0, 0)), ('iso', (-440, -260, 165))]:
    camera.location = target + Vector(offset)
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(ROOT / f'docs/evidence/unit7-autolink-model-{label}.png')
    bpy.ops.render.render(write_still=True)
