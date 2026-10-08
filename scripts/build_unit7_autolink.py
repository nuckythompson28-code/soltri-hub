"""Photo-based external-diameter gripper; all dimensions below are estimates.

Blender X is NC Z. Blender Z is radial height; Blender -Y is Three depth.
The head datum is the unchanged T3 axis/contact plane. Its front faces -X.
The runtime turns each jaw around X, preserving a rigid arm and contact pin.
"""
import math
import bpy


AUTOLINK = {
    'mechanism': 'three rotating arms grip the external diameter of raw material',
    'mechanismConfirmed': True,
    'dimensionsMeasured': False,
    'pivotRadiusMm': 48,
    'armLengthMm': 31,
    'pinRadiusMm': 5,
    'pinLengthMm': 18,
    'pinAxialSpanMm': [-12, 6],
    'pivotAxialMm': 12,
    'pivotAnglesRad': [math.pi / 3, -math.pi / 3, math.pi],
    'openClearanceMm': 8,
    'defaultRawDiameterMm': 70,
    'frontPlateSizeMm': [140, 140],
    'headThicknessMm': 40,
    'cylinderStrokeMeasured': False,
    'internalGearingMeasured': False,
    'animation': 'rigid arms rotate about X; carriage Z translates the entire gripper',
    'dimensionSource': 'photograph proportions only; visual estimates, not machine capacity',
    'headNode': 'AUTOLINK_HEAD',
    'jawNodes': ['AUTOLINK_JAW_1', 'AUTOLINK_JAW_2', 'AUTOLINK_JAW_3'],
    'pinNodes': ['AUTOLINK_PIN_1', 'AUTOLINK_PIN_2', 'AUTOLINK_PIN_3'],
    'photos': [f'docs/evidence/unit7-autolink-20261008-{i:02d}.png' for i in range(1, 6)],
}


def build_autolink(root, datum):
    for old in list(bpy.data.objects):
        if old.name.startswith('Auto link') or old.name.startswith('AUTOLINK_'):
            bpy.data.objects.remove(old, do_unlink=True)

    def material(name, rgb, metallic, roughness):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.diffuse_color = (*rgb, 1)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
        return m

    black = material('Autolink black oxide steel', (.035, .046, .060), .65, .34)
    silver = material('Autolink machined silver', (.56, .61, .65), .82, .27)
    pin_steel = material('Autolink bright pin steel', (.72, .76, .79), .9, .21)
    ivory = material('Autolink pneumatic ivory', (.73, .79, .75), .05, .36)
    dark = material('Autolink dark socket', (.009, .013, .017), .1, .7)

    def empty(name, parent, loc):
        o = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(o)
        o.parent = parent
        o.location = loc
        o['tool'] = 3
        o['role'] = 'machine'
        o['estimated'] = True
        return o

    head = empty('AUTOLINK_HEAD', root, datum)
    head['mechanismConfirmed'] = True
    head['dimensionsMeasured'] = False
    head['gripSurface'] = 'raw-material-external-diameter'
    head['facing'] = '-X / chuck / negative NC Z'

    def finish(o, name, parent, mat, role='machine', bevel=0):
        o.name = name
        o.parent = parent
        o.data.materials.append(mat)
        o['tool'] = 3
        o['role'] = role
        o['estimated'] = True
        if bevel:
            mod = o.modifiers.new('Small machined edge', 'BEVEL')
            mod.width = bevel
            mod.segments = 3
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=mod.name)
        # Smooth curved faces, retain flat plate/pin faces and crisp shoulders.
        for p in o.data.polygons:
            p.use_smooth = len(p.vertices) == 4 and len(o.data.polygons) > 40
        return o

    def box(name, parent, loc, size, mat, role='machine', bevel=1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        return finish(o, name, parent, mat, role, bevel)

    def cylinder(name, parent, loc, radius, length, mat, role='machine', axis='X', vertices=64, bevel=.35):
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=loc)
        o = bpy.context.object
        if axis == 'X':
            o.rotation_euler[1] = math.pi / 2
        elif axis == 'Y':
            o.rotation_euler[0] = math.pi / 2
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        return finish(o, name, parent, mat, role, bevel)

    def bolt(name, parent, loc, radius=3.3, role='machine'):
        cylinder(name, parent, loc, radius, 2, black, role)
        # A dark recessed hexagon communicates the socket without baked textures.
        cylinder(name + '_SOCKET', parent, (loc[0] - 1.02, loc[1], loc[2]), radius * .48,
                 .12, dark, role, vertices=6, bevel=0)

    box('AUTOLINK_FRONT_PLATE', head, (24, 0, 0), (6, 140, 140), black, bevel=3)
    box('AUTOLINK_SILVER_BODY_BAND', head, (41, 0, 0), (28, 137, 137), silver, bevel=3)
    box('AUTOLINK_REAR_PLATE', head, (58, 0, 0), (6, 140, 140), black, bevel=3)

    # Rear clamp and downward mounting foot follow the stepped, slotted photo silhouette.
    box('AUTOLINK_REAR_CLAMP_BLOCK', head, (75, 0, 0), (28, 107, 109), black, bevel=1.6)
    box('AUTOLINK_REAR_CLAMP_SLOT', head, (89.1, 0, 24), (.25, 110, 2.4), dark, bevel=0)
    cylinder('AUTOLINK_REAR_AXLE', head, (92, 0, 25), 19, 7, silver)
    cylinder('AUTOLINK_REAR_AXLE_SOCKET', head, (95.55, 0, 25), 2.9, .12, dark, vertices=6, bevel=0)
    box('AUTOLINK_MOUNT_CROSS_BLOCK', head, (70, 0, -70), (35, 100, 24), black)
    box('AUTOLINK_MOUNT_BACK', head, (78, 0, -108), (18, 94, 84), black)
    # Three solids leave the visible U-shaped slot in the front mounting plate.
    box('AUTOLINK_MOUNT_LEFT', head, (58, -33, -111), (21, 29, 78), black)
    box('AUTOLINK_MOUNT_RIGHT', head, (58, 33, -111), (21, 29, 78), black)
    box('AUTOLINK_MOUNT_LOWER', head, (58, 0, -136), (21, 67, 28), black)
    box('AUTOLINK_MOUNT_FOOT', head, (64, -16, -160), (20, 29, 26), black)
    for j, (py, pz) in enumerate([(33, -90), (-33, -134), (33, -134)], 1):
        cylinder(f'AUTOLINK_MOUNT_BORE_{j}', head, (47.4, py, pz), 8.5, .2, dark, bevel=0)
        cylinder(f'AUTOLINK_MOUNT_BORE_RIM_{j}', head, (48.5, py, pz), 10, 1.8, black)
    for j, (py, pz) in enumerate([(-37, 43), (37, 43), (-35, -39), (35, -39)], 1):
        bolt(f'AUTOLINK_REAR_FASTENER_{j}', head, (89.3, py, pz), 6)

    # Compact side cylinder with extrusion ribs and two ivory pneumatic fittings.
    box('AUTOLINK_PNEUMATIC_CYLINDER', head, (40, -88, 0), (35, 36, 62), silver, bevel=1.5)
    for side in [-1, 1]:
        box(f'AUTOLINK_CYLINDER_END_{side}', head, (40, -88, side * 31), (36, 37, 4), ivory, bevel=1)
    for j, pz in enumerate([-18, -6, 6, 18], 1):
        box(f'AUTOLINK_EXTRUSION_GROOVE_{j}', head, (21.9, -88, pz), (.5, 35, 1.8), ivory, bevel=.3)
    for j, py in enumerate([-77, -98], 1):
        cylinder(f'AUTOLINK_AIR_PORT_{j}', head, (39, py, 37), 5.5, 9, silver, axis='Z')
        cylinder(f'AUTOLINK_AIR_FITTING_{j}', head, (39, py, 43), 6.1, 10, ivory, axis='Y')
        cylinder(f'AUTOLINK_AIR_ADJUSTER_{j}', head, (39, py, 51), 2.8, 9, silver, axis='Z')
        cylinder(f'AUTOLINK_AIR_ADJUSTER_CAP_{j}', head, (39, py, 55.5), 3.4, 2, silver, axis='Z')
    cylinder('AUTOLINK_AIR_ELBOW', head, (39, -109, 43), 7.1, 11, ivory, axis='Y')
    cylinder('AUTOLINK_AIR_TUBE_SOCKET', head, (39, -115, 43), 4.2, .3, dark, axis='Y', bevel=0)

    pivot_radius = AUTOLINK['pivotRadiusMm']
    arm_length = AUTOLINK['armLengthMm']
    pin_radius = AUTOLINK['pinRadiusMm']
    radius = AUTOLINK['defaultRawDiameterMm'] / 2 + pin_radius
    beta = math.acos((radius * radius - pivot_radius ** 2 - arm_length ** 2) / (2 * pivot_radius * arm_length))
    for index, alpha in enumerate(AUTOLINK['pivotAnglesRad'], 1):
        # Blender (Y,Z)=(-Rsin(alpha),Rcos(alpha)) exports to Three (Y,Z)=(Rcos,Rsin).
        py, pz = -pivot_radius * math.sin(alpha), pivot_radius * math.cos(alpha)
        cylinder(f'AUTOLINK_PIVOT_DISC_{index}', head, (19, py, pz), 19, 4, silver)
        cylinder(f'AUTOLINK_PIVOT_WASHER_{index}', head, (16.4, py, pz), 7.6, 1.2, pin_steel)
        jaw = empty(f'AUTOLINK_JAW_{index}', head, (12, py, pz))
        jaw['role'] = 'grip'
        jaw['pivotAngleRad'] = alpha
        jaw['pivotRadiusMm'] = pivot_radius
        jaw['armLengthMm'] = arm_length
        jaw['pinRadiusMm'] = pin_radius
        jaw['openClearanceMm'] = AUTOLINK['openClearanceMm']
        jaw['rotationAxis'] = 'X'
        jaw['pinCenterLocalThree'] = [-15, arm_length, 0]
        jaw['defaultClosedBetaRad'] = beta
        # An elongated black arm, an outboard rounded pivot and two socket screws.
        box(f'AUTOLINK_ARM_{index}', jaw, (0, 0, arm_length / 2 - 3), (6, 12.5, arm_length + 13), black, 'grip', 2.8)
        cylinder(f'AUTOLINK_ARM_HEEL_{index}', jaw, (0, 0, -7), 6.25, 6, black, 'grip')
        bolt(f'AUTOLINK_PIVOT_BOLT_{index}', jaw, (-3.8, 0, 0), 3.7, 'grip')
        bolt(f'AUTOLINK_ARM_BOLT_{index}', jaw, (-3.8, 0, -9), 3.1, 'grip')
        cylinder(f'AUTOLINK_PIN_SHANK_{index}', jaw, (-3, 0, arm_length), 3.2, 6, pin_steel, 'grip')
        pin = cylinder(f'AUTOLINK_PIN_{index}', jaw, (-15, 0, arm_length), pin_radius, 18, pin_steel, 'grip', bevel=.18)
        pin['contactSurface'] = 'external stock diameter'
        pin['radiusMm'] = pin_radius
        pin['axis'] = 'X'
        pin['axialSpanRelativeT3Mm'] = [-12, 6]
        pin['rigidArmLengthMm'] = arm_length
        jaw.rotation_euler[0] = alpha + beta

    return head, dict(AUTOLINK)
