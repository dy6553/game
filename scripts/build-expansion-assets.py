"""Run inside Blender. Original modular models for the snow and moon maps.

This file creates a separate scene and never deletes objects in existing scenes.
Dimensions are art blockout values, not final collision or combat parameters.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'art', 'expansion')
os.makedirs(OUT, exist_ok=True)


def material(name, color, metallic=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = .65
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    return mat


def box(name, pos, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cylinder(name, pos, radius, depth, mat, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def make_asset(kind, x, y):
    before = set(bpy.context.scene.objects)
    def b(name, pos, size, mat, bevel=0):
        return box(name, (x+pos[0], y+pos[1], pos[2]), size, mat, bevel)
    if kind in ('snow-supply', 'moon-cargo', 'metal-debris-crate'):
        shell = white if kind == 'snow-supply' else sand if kind == 'moon-cargo' else steel
        b('case-shell', (0,0,.65), (1.8,1.1,1.3), shell, .10)
        b('lid', (0,0,1.33), (1.9,1.18,.16), dark, .045)
        for sx in (-.68,.68):
            b('reinforced-band', (sx,0,.68), (.12,1.15,1.32), steel, .025)
        b('front-identification', (0,-.562,.77), (.75,.025,.23), cyan if kind=='snow-supply' else amber)
        for side in (-1,1):
            b('handle', (side*.92,0,.86), (.10,.45,.12), dark, .025)
    elif kind == 'research-console':
        b('cabinet', (0,0,.75), (1.6,.85,1.5), white, .08)
        b('screen-frame', (0,-.45,1.18), (1.37,.09,.60), dark, .035)
        b('screen', (0,-.50,1.2), (1.15,.02,.40), cyan)
        b('keyboard-shelf', (0,-.65,.79), (1.45,.5,.12), steel, .03)
        for sx in (-.4,-.15,.10,.35):
            b('vent', (sx,-.437,.38), (.11,.025,.28), dark)
    elif kind == 'lunar-probe':
        b('probe-body', (0,0,.8), (1.4,1.2,.9), sand, .12)
        for sx in (-.7,.7):
            for sy in (-.42,.42):
                wheel = cylinder('probe-wheel', (x+sx,y+sy,.32), .32,.22,dark)
                wheel.rotation_euler[1] = math.pi/2
        cylinder('mast', (x,y,1.8), .055,1.2,steel)
        b('sensor', (0,0,2.4), (.5,.4,.3), white,.05)
        b('sensor-eye', (0,-.21,2.4), (.30,.02,.13), cyan)
        for sx in (-1.3,1.3):
            b('solar-array', (sx,0,1.42), (1.1,1.7,.08), solar)
            for sy in (-.55,0,.55):
                b('solar-grid', (sx,sy,1.465), (1.1,.025,.012), steel)
    elif kind == 'fixed-generator':
        b('generator-base', (0,0,.15), (2.5,1.7,.3), dark,.07)
        b('generator-housing', (0,0,1), (2.3,1.5,1.5), steel,.1)
        for sx in (-.8,-.4,0,.4,.8):
            b('cooling-fin', (sx,-.78,1.05), (.13,.12,1.1), dark,.025)
        b('status-strip', (0,-.85,1.65), (1.8,.025,.09), cyan)
        for sx in (-.7,.7):
            cylinder('exhaust', (x+sx,y+.3,1.96), .20,.65,dark)
    parts = [o for o in bpy.context.scene.objects if o not in before]
    root = bpy.data.objects.new(kind, None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (x,y,0)
    bpy.context.view_layer.update()
    root['asset_role'] = 'fixed' if kind=='fixed-generator' else 'debris' if kind=='metal-debris-crate' else 'breakable'
    root['prototype_art_only'] = True
    for obj in parts:
        world = obj.matrix_world.copy()
        obj.parent = root
        obj.matrix_world = world
    return root


scene = bpy.data.scenes.new('Expansion asset workshop')
bpy.context.window.scene = scene
white = material('EXP ceramic frost', (.67,.81,.86), .15)
steel = material('EXP brushed alloy', (.22,.32,.39), .65)
dark = material('EXP graphite', (.028,.046,.065), .25)
sand = material('EXP lunar titanium', (.66,.61,.48), .5)
cyan = material('EXP cyan indicators', (.035,.65,.9), .1, 2)
amber = material('EXP amber identification', (1,.43,.055), .1, .7)
solar = material('EXP solar cells', (.025,.07,.21), .65)
floor = material('EXP workshop floor', (.075,.11,.16))

roots = [make_asset(kind, (i%3)*4-4, (i//3)*4-2) for i,kind in enumerate([
    'snow-supply','research-console','metal-debris-crate',
    'moon-cargo','lunar-probe','fixed-generator'])]
box('workshop-floor', (0,0,-.10), (15,11,.15), floor)
world = bpy.data.worlds.new('Expansion workshop lighting')
world.use_nodes = True
background = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs[0].default_value = (.20,.27,.38,1)
background.inputs[1].default_value = .4
scene.world = world
for name,location,power,size in [('Key', (0,-5,12),2200,9),('Fill',(5,4,8),1500,7)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy=power
    light.shape='DISK'
    light.size=size
    obj=bpy.data.objects.new(name,light)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Expansion asset camera',bpy.data.cameras.new('Expansion asset camera'))
scene.collection.objects.link(camera)
camera.location=(12,-18,15)
camera.rotation_euler=(Vector((0,0,.5))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=17
scene.camera=camera
scene.render.resolution_x=1200
scene.render.resolution_y=850
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(OUT,'asset-workshop.png')
scene['status']='Original art prototypes; not connected to game or final collision.'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'expansion-assets.blend'))
print('Created six original modular assets in a new scene. Saved:', OUT)
