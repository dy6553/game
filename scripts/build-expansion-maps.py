"""Blender-only original map blockouts. No external assets or game rules.

Requires the six original prototypes from build-expansion-assets.py in the file.
Run in the live Blender connector. Exports are visual prototypes, not collision authority.
"""
import bpy
import math
import random
from mathutils import Vector

OUT = r'C:\Users\이도건\Documents\ChatGPT\게임 -바이브 코딩 2\game-local\art\expansion'
RNG = random.Random(42)
COLLIDERS = []
ROOMS = []
ROOFS = []


def mat(name, rgb, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    n = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value = (*rgb, 1)
    n.inputs['Roughness'].default_value = .78
    n.inputs['Metallic'].default_value = metal
    if emission:
        n.inputs['Emission Color'].default_value = (*rgb, 1)
        n.inputs['Emission Strength'].default_value = emission
    return m


def cube(name, p, size, material, collision=False, role='fixed', detail=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj['detail_level'] = detail
    if collision:
        obj['collision_role'] = role
        COLLIDERS.append(dict(id=obj.name, x=p[0], z=-p[1], width=size[0], depth=size[1],
                              yMin=p[2]-size[2]/2, yMax=p[2]+size[2]/2, role=role))
    return obj


def cyl(name, p, r, h, material, verts=16, detail=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=p)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    o['detail_level'] = detail
    return o


def ring(name, x, y, radius, thickness, height, material, segments=48, detail=0):
    vertices = []
    for r in (radius-thickness, radius):
        vertices.extend((x+r*math.cos(i*2*math.pi/segments), y+r*math.sin(i*2*math.pi/segments), height) for i in range(segments))
    faces = [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    o = bpy.data.objects.new(name,mesh)
    bpy.context.scene.collection.objects.link(o)
    o['detail_level'] = detail
    return o


def label(text, p, size, material, rotation=(0,0,0), detail=1):
    data = bpy.data.curves.new(text, 'FONT')
    data.body = text
    data.align_x = 'CENTER'
    data.size = size
    data.extrude = .004
    o = bpy.data.objects.new(text, data)
    bpy.context.scene.collection.objects.link(o)
    o.location = p
    o.rotation_euler = rotation
    data.materials.append(material)
    o['detail_level'] = detail
    return o


def asset(source, x, y, angle=0):
    original = bpy.data.objects[source]
    root = bpy.data.objects.new(source+' instance', None)
    bpy.context.scene.collection.objects.link(root)
    for child in original.children:
        o = child.copy()
        o.data = child.data
        bpy.context.scene.collection.objects.link(o)
        o.parent = root
        o.matrix_parent_inverse.identity()
        o.matrix_basis = child.matrix_basis.copy()
        o['detail_level'] = 0
    root.location = (x,y,0)
    root.rotation_euler.z = angle
    root['collision_role'] = original.get('asset_role','breakable')
    # Individual movable props stay separate for future gameplay integration.
    root['prototype_art_only'] = True
    return root


def building(name, x, y, w, d, h, moon=False):
    wall = lunar_wall if moon else snow_wall
    accent = amber if moon else cyan
    roofmat = lunar_roof if moon else roof
    opening = 6
    t = .5
    cube(name+' floor', (x,y,.04), (w,d,.08), interior)
    # Four open entrances, each 6 m wide. No invisible full-building collider.
    for sign in (-1,1):
        for part in (-1,1):
            cube(name+' wall-y', (x+part*(w+opening)/4,y+sign*d/2,h/2), ((w-opening)/2,t,h),wall,True)
            cube(name+' wall-x', (x+sign*w/2,y+part*(d+opening)/4,h/2), (t,(d-opening)/2,h),wall,True)
        cube(name+' lintel-y', (x,y+sign*d/2,h-.8), (opening,t,1.6), wall,True)
        cube(name+' lintel-x', (x+sign*w/2,y,h-.8), (t,opening,1.6), wall,True)
        cube(name+' entry light-y', (x,y+sign*(d/2+.28),h-1.7), (opening,.12,.14),accent,detail=1)
        cube(name+' entry light-x', (x+sign*(w/2+.28),y,h-1.7), (.12,opening,.14),accent,detail=1)
        # Windows are solid wall in this art blockout, not pass-through glass.
        for offset in (-.32,.32):
            cube(name+' window-y', (x+offset*w,y+sign*(d/2+.27),h*.57), (w*.18,.045,1.35),glass,detail=1)
            cube(name+' window-x', (x+sign*(w/2+.27),y+offset*d,h*.57), (.045,d*.18,1.35),glass,detail=1)
    r = cube(name+' roof', (x,y,h+.22), (w+1.1,d+1.1,.44),roofmat)
    r['roof'] = True
    ROOFS.append(r)
    if not moon:
        cap=cube(name+' snow cap',(x,y,h+.5),(w+1.25,d+1.25,.16),snow)
        cap['roof']=True
        ROOFS.append(cap)
    for sx in (-.36,.36):
        vent=cube(name+' roof vent',(x+sx*w,y,h+.85),(2.2,2.8,.9),steel,detail=2)
        vent['roof']=True
        ROOFS.append(vent)
    ROOMS.append(dict(id=name,x=x,z=-y,width=w,depth=d,height=h))
    label(name.upper(), (x,y-d/2-.31,h-.9), .65,accent,(math.pi/2,0,0))


def start_scene(name, mapid, width, depth):
    COLLIDERS.clear()
    ROOMS.clear()
    ROOFS.clear()
    scene = bpy.data.scenes.new(name)
    bpy.context.window.scene = scene
    scene['map_id'] = mapid
    scene['width_m'] = width
    scene['depth_m'] = depth
    scene['status'] = 'Visual blockout. Gameplay not integrated.'
    scene['coordinate_mapping'] = 'Blender (x,y,z) => game (x,z,-y)'
    return scene


def lighting(scene, lunar=False):
    world = bpy.data.worlds.new(scene.name+' world')
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
    bg.inputs[0].default_value = (.008,.012,.025,1) if lunar else (.34,.48,.64,1)
    bg.inputs[1].default_value = .10 if lunar else .5
    scene.world = world
    light=bpy.data.lights.new('Lunar sunlight' if lunar else 'Arctic sunlight','SUN')
    light.energy=2.5 if lunar else 2.0
    light.angle=.06 if lunar else .12
    obj=bpy.data.objects.new(light.name,light)
    scene.collection.objects.link(obj)
    obj.rotation_euler=(.45,-.6,-.4)
    # Soft fill is for preview readability; it does not define game lighting rules.
    data=bpy.data.lights.new('Preview fill','AREA')
    data.energy=12000 if lunar else 18000
    data.shape='DISK'
    data.size=80
    obj=bpy.data.objects.new('Preview fill',data)
    scene.collection.objects.link(obj)
    obj.location=(0,-20,65)
    scene.render.resolution_x=1400
    scene.render.resolution_y=1050
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'


def camera(scene, name, location, target, ortho=None):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.clip_end=2000
    if ortho:
        data.type='ORTHO'
        data.ortho_scale=ortho
    else:
        data.lens=24
    scene.camera=obj
    return obj


def store_layout(scene):
    import json
    root=bpy.data.objects.new(scene['map_id']+' layout metadata',None)
    scene.collection.objects.link(root)
    root['map_id']=scene['map_id']
    root['width_m']=scene['width_m']
    root['depth_m']=scene['depth_m']
    root['collision_blockout_json']=json.dumps(COLLIDERS)
    root['rooms_json']=json.dumps(ROOMS)
    root['status']='Draft collision metadata; not connected to game.'
    return root


snow=mat('MAP fresh snow',(.73,.86,.91))
packed=mat('MAP compacted snow',(.42,.61,.7))
snow_wall=mat('MAP ice ceramic',(.52,.69,.77),.2)
roof=mat('MAP arctic blue roof',(.065,.18,.25),.3)
steel=mat('MAP structural steel',(.18,.26,.32),.5)
interior=mat('MAP interior flooring',(.15,.23,.28),.1)
glass=mat('MAP opaque blue glazing',(.04,.24,.32),.35,.25)
cyan=mat('MAP blue wayfinding',(.04,.65,.9),.15,2)
amber=mat('MAP gold wayfinding',(1,.48,.055),.2,1)
regolith=mat('MAP lunar regolith',(.37,.39,.40))
rock=mat('MAP lunar basalt',(.19,.21,.235))
lunar_wall=mat('MAP lunar shell',(.68,.66,.58),.45)
lunar_roof=mat('MAP graphite roof',(.12,.16,.21),.4)
pad=mat('MAP landing surface',(.23,.28,.33),.35)
solar=mat('MAP photovoltaic',(.025,.075,.19),.6)
white=mat('MAP painted ivory',(.82,.86,.85))

# SNOW: large research compound with two indoor flank routes and four exterior links.
s=start_scene('Snow Research | 160 x 120 m','snow',160,120)
cube('snow playable ground',(0,0,-.3),(160,120,.6),snow)
for x in (-55,0,55):
    cube('snow exterior route',(x,0,.005),(8,108,.01),packed)
for y in (-39,0,39):
    cube('snow cross route',(0,y,.012),(146,7,.016),packed)
building('Research hub',0,0,36,28,7)
building('West laboratory',-33,0,12,52,5)
building('East laboratory',33,0,12,52,5)
for x in (-22.5,22.5):
    canopy=cube('covered research link',(x,0,4.5),(9,7,.35),roof)
    canopy['roof']=True
    ROOFS.append(canopy)
    for y in (-3,3):
        for sx in (-3.6,3.6):
            cube('link support',(x+sx,y,2.2),(.25,.25,4.4),steel,True)
for x in (-12,12):
    for y in (-7.5,7.5):
        asset('research-console',x,y,0 if y>0 else math.pi)
for x in (-33,33):
    for y in (-18,-10,10,18):
        asset('snow-supply' if abs(y)==10 else 'research-console',x,y)
for x,y,kind in [(-55,-25,'snow-supply'),(-55,23,'fixed-generator'),(55,-25,'fixed-generator'),(55,23,'snow-supply'),(-18,-38,'metal-debris-crate'),(18,38,'metal-debris-crate'),(4,-43,'snow-supply'),(-4,43,'snow-supply')]:
    asset(kind,x,y)
# Perimeter banks stay outside the approved playable rectangle.
for side in (-1,1):
    for i in range(9):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(-72+i*18,side*65,RNG.uniform(.3,1.5)))
        o=bpy.context.object
        o.name='distant snow bank'
        o.scale=(12,RNG.uniform(5,9),RNG.uniform(3,7))
        o.data.materials.append(snow)
        o['detail_level']=1
for x in (-60,60):
    for y in (-44,44):
        cyl('arctic beacon',(x,y,2),.12,4,steel,8,1)
        cyl('arctic beacon light',(x,y,4.1),.25,.3,cyan,8,1)
label('POLAR RESEARCH // 07',(0,-51,.045),2.2,roof)
lighting(s)
camera(s,'Snow overview',(124,-142,132),(0,0,0),195)
store_layout(s)

# MOON: medium arena, open landing pad and two occupied flanks.
m=start_scene('Lunar Base | 100 x 80 m','moon',100,80)
cube('moon playable ground',(0,0,-.3),(100,80,.6),regolith)
cyl('landing pad',(0,0,.07),17,.14,pad,64)
ring('landing pad outer ring',0,0,16,.35,.15,amber)
ring('landing pad inner ring',0,0,13,.15,.153,white)
cube('landing H left',(-3.3,0,.16),(.8,9,.03),white)
cube('landing H right',(3.3,0,.16),(.8,9,.03),white)
cube('landing H cross',(0,0,.16),(6.6,.8,.03),white)
building('Habitat west',-31,0,18,30,6,True)
building('Operations east',31,0,18,30,6,True)
for x in (-19,19):
    for y in (-11,11):
        asset('metal-debris-crate' if x*y>0 else 'moon-cargo',x,y)
for x in (-31,31):
    for y in (-8,8):
        asset('research-console' if y>0 else 'moon-cargo',x,y)
for x,y in [(-12,-26),(12,26)]:
    asset('lunar-probe',x,y)
for x,y in [(-31,-25),(31,25)]:
    asset('fixed-generator',x,y)
    for sx in (-4,0,4):
        a=cube('solar bank',(x+sx,y+5,1.5),(3.2,5,.15),solar,detail=1)
        a.rotation_euler.x=.25
        cube('solar support',(x+sx,y+5,.7),(.2,.3,1.4),steel,detail=1)
        for off in (-1.5,0,1.5):
            cube('solar cell seam',(x+sx,y+5+off,1.56),(3.2,.045,.025),steel,detail=2)
for x,y,r in [(-43,27,3.5),(43,-27,3.5),(-7,32,3),(7,-32,3)]:
    ring('lunar crater rim',x,y,r,.6,.08,rock,20,1)
    cyl('crater dark floor',(x,y,.015),r-.6,.02,rock,20,1)
for x,y in [(-43,-28),(-43,30),(43,-30),(43,28),(-6,-29),(6,29)]:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,1))
    o=bpy.context.object
    o.name='fixed basalt outcrop'
    o.scale=(2.6,2.2,2.0)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(rock)
    o['collision_role']='fixed'
    o['detail_level']=0
    COLLIDERS.append(dict(id=o.name,x=x,z=-y,width=5.2,depth=4.4,yMin=0,yMax=3,role='fixed'))
# A dish behind the pad leaves side and perimeter routes open.
cyl('communications mast',(0,29,3),.16,6,steel,12,1)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=2,location=(0,29,6.5))
o=bpy.context.object
o.name='communications reflector'
o.scale=(1,.25,1)
o.data.materials.append(white)
o['detail_level']=1
for angle in range(0,360,45):
    a=math.radians(angle)
    cyl('landing guidance',(18.5*math.cos(a),18.5*math.sin(a),.25),.18,.5,amber,8,1)
label('SELENE // LANDING 02',(0,-23,.05),1.4,white)
lighting(m,True)
camera(m,'Moon overview',(86,-100,98),(0,0,0),128)
store_layout(m)
bpy.context.view_layer.update()
print('Created two map scenes at approved dimensions, with open entrances and independent assets.')
print('Save, preview and export are performed separately after model acceptance checks.')
