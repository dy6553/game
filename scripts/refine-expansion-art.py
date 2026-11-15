"""Live Blender art revision. Keeps the original scenes and edits full copies.

Original, embedded textures; no downloads, paid generators or gameplay changes.
Run the setup and texture functions in small connector calls, then export profiles.
"""
import bpy
import math
import random
import json
from mathutils import Vector

OUT = r'C:\Users\이도건\Documents\ChatGPT\게임 -바이브 코딩 2\game-local\art\expansion'
SURFACES = {
 'snow':((.77,.84,.88),.0,.88,8),
 'packed':((.43,.57,.64),.0,.88,4),
 'arctic-wall':((.56,.73,.76),.22,.56,4),
 'interior':((.16,.25,.28),.18,.62,4),
 'regolith':((.43,.415,.39),.0,.94,8),
 'lunar-wall':((.76,.73,.64),.35,.52,4),
 'operations-wall':((.17,.235,.29),.24,.64,4),
 'landing':((.22,.28,.34),.25,.70,4),
}
PALETTES = {
 'MAP fresh snow':'snow', 'MAP compacted snow':'packed',
 'MAP ice ceramic':'arctic-wall', 'MAP interior flooring':'interior',
 'MAP lunar regolith':'regolith', 'MAP lunar shell':'lunar-wall',
 'MAP landing surface':'landing',
}


def solid(name,color,metal=0,rough=.65,emission=0):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    n=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1)
    n.inputs['Roughness'].default_value=rough
    n.inputs['Metallic'].default_value=metal
    if emission:
        n.inputs['Emission Color'].default_value=(*color,1)
        n.inputs['Emission Strength'].default_value=emission
    return mat


def box(name,location,size,mat,level=0,roof=False):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object
    obj.name='Art '+name
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    obj['detail_level']=level
    obj['art_revision']=2
    if roof:obj['roof']=True
    return obj


def letters(text,location,size,mat,rotation=(0,0,0),level=1):
    data=bpy.data.curves.new('Art sign '+text,'FONT')
    data.body=text
    data.align_x='CENTER'
    data.size=size
    data.extrude=.004
    obj=bpy.data.objects.new('Art '+text,data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=rotation
    data.materials.append(mat)
    obj['detail_level']=level
    return obj


def copy_scene(original,name):
    if bpy.context.object and bpy.context.object.mode!='OBJECT':
        mode=next(i.identifier for i in bpy.ops.object.mode_set.get_rna_type().properties['mode'].enum_items if i.identifier=='OBJECT')
        bpy.ops.object.mode_set(mode=mode)
    bpy.context.window.scene=bpy.data.scenes[original]
    kind=next(i.identifier for i in bpy.ops.scene.new.get_rna_type().properties['type'].enum_items if i.identifier=='FULL_COPY')
    bpy.ops.scene.new(type=kind)
    scene=bpy.context.scene
    scene.name=name
    scene['art_revision']=2
    scene['status']='Detailed visual revision; special gameplay rules still pending.'
    return scene


def uv_project(obj,scale):
    mesh=obj.data
    uv=mesh.uv_layers.active or mesh.uv_layers.new(name='Surface UV')
    for face in mesh.polygons:
        axis=0
        for i in (1,2):
            if abs(face.normal[i])>abs(face.normal[axis]):axis=i
        a,b=(0,1) if axis==2 else (1,2) if axis==0 else (0,2)
        for index in face.loop_indices:
            v=mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv=(v[a]/scale,v[b]/scale)


def surface_texture(kind,size=1024,refresh=False):
    name='Original '+kind+' '+str(size)
    existing=bpy.data.images.get(name)
    if existing and not refresh:return existing
    base=SURFACES[kind][0]
    image=existing or bpy.data.images.new(name,width=size,height=size)
    values=[]
    tau=math.pi*2
    for iy in range(size):
        v=iy/size
        for ix in range(size):
            u=ix/size
            grain=(((ix*374761393)^(iy*668265263))&1023)/1023-.5
            broad=math.sin(u*tau*3+math.sin(v*tau*2))*.025+math.sin(v*tau*5)*.015
            lum=1+broad+grain*.055
            if kind in ('arctic-wall','lunar-wall','operations-wall','interior','landing'):
                tx=(u*2)%1;ty=(v*2)%1
                edge=min(tx,1-tx,ty,1-ty)
                lum*=.57 if edge<.009 else .82 if edge<.017 else 1
                # Subtle brushed metal, wear at panel edges and recessed fasteners.
                lum+=math.sin(v*tau*181)*.009
                dx=min(abs(tx-.055),abs(tx-.945));dy=min(abs(ty-.055),abs(ty-.945))
                if dx*dx+dy*dy<.00016:lum*=.55
            elif kind=='packed':
                lum+=math.sin(u*tau*3+math.sin(v*tau*2))*.012
            elif kind=='snow':
                lum+=math.sin((u+v)*tau*13)*.012
                if grain>.485:lum+=.06
            else:
                # Small repeating dust pits; relief is represented by color at low/medium.
                tx=(u*7)%1-.5;ty=(v*7)%1-.5
                r=math.sqrt(tx*tx+ty*ty)
                lum-=max(0,1-r/.22)*.10
                lum+=max(0,1-abs(r-.24)/.035)*.06
                lum+=grain*.08
            values.extend((max(0,min(1,base[0]*lum)),max(0,min(1,base[1]*lum)),max(0,min(1,base[2]*lum)),1))
    image.pixels.foreach_set(values)
    image.pack()
    return image


def normal_texture(kind,size=512,refresh=False):
    name='Original normal '+kind
    existing=bpy.data.images.get(name)
    if existing and not refresh:return existing
    image=existing or bpy.data.images.new(name,width=size,height=size,is_data=True)
    values=[]
    for iy in range(size):
        v=iy/size
        for ix in range(size):
            u=ix/size
            grain=(((ix*374761393)^(iy*668265263))&1023)/1023-.5
            nx=grain*.055;ny=math.sin(u*math.pi*48)*.035
            if kind in ('snow','packed','regolith'):
                nx=grain*.018;ny=math.sin((u+v)*math.pi*6)*.009
            if kind in ('arctic-wall','lunar-wall','operations-wall','interior','landing'):
                tx=(u*2)%1;ty=(v*2)%1
                if min(tx,1-tx)<.018:nx+=.22 if tx<.5 else -.22
                if min(ty,1-ty)<.018:ny+=.22 if ty<.5 else -.22
            length=math.sqrt(1+nx*nx+ny*ny)
            values.extend((.5+.5*nx/length,.5+.5*ny/length,.5+.5/length,1))
    image.pixels.foreach_set(values)
    image.pack()
    return image


def textured_material(kind,quality):
    name='Art '+kind+' '+quality
    existing=bpy.data.materials.get(name)
    if existing:return existing
    base,metal,rough,_=SURFACES[kind]
    mat=solid(name,(1,1,1),metal if quality!='low' else 0,rough)
    mat['surface_kind']=kind
    n=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    size={'low':256,'medium':512,'high':1024}[quality]
    image=surface_texture(kind)
    if size!=1024:
        image=image.copy()
        image.name='Original '+kind+' '+str(size)
        image.scale(size,size)
        image.pack()
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=image
    mat.node_tree.links.new(tex.outputs['Color'],n.inputs['Base Color'])
    if quality=='high':
        normal=mat.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value=.45
        texture=mat.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image=normal_texture(kind)
        mat.node_tree.links.new(texture.outputs['Color'],normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'],n.inputs['Normal'])
    mat.diffuse_color=(*base,1)
    return mat


def decorate(scene):
    bpy.context.window.scene=scene
    lunar=scene['map_id']=='moon'
    teal=solid('Art deep petrol',(.045,.19,.23),.3)
    pale=solid('Art frost trim',(.70,.85,.86),.2)
    copper=solid('Art warm brass',(.69,.40,.13),.5)
    warm=solid('Art warm interior',(.98,.63,.26),.1,emission=1.1)
    cool=solid('Art glacier indicators',(.10,.68,.78),.1,emission=1)
    dark=solid('Art shadow inset',(.025,.055,.08),.2)
    glazing=solid('Art desaturated glacier glass',(.10,.26,.30),.3,emission=.25)
    accent=copper if lunar else teal
    meta=next(o for o in scene.objects if 'rooms_json' in o)
    rooms=json.loads(meta['rooms_json'])
    # Treat changes in material placement as visual authoring, not new collision shapes.
    for obj in list(scene.objects):
        if obj.type!='MESH':continue
        for slot in obj.material_slots:
            if not slot.material:continue
            family=next((v for k,v in PALETTES.items() if slot.material.name.startswith(k)),None)
            if family:
                obj.data=obj.data.copy()
                slot.material=textured_material(family,'high')
                uv_project(obj,SURFACES[family][3])
            elif 'MAP graphite roof' in slot.material.name or 'MAP arctic blue roof' in slot.material.name:
                slot.material=teal if not lunar else dark
    for index,r in enumerate(rooms):
        x,y,w,d,h=r['x'],-r['z'],r['width'],r['depth'],r['height']
        # Continuous plinth and upper trim keep the architecture readable at low quality.
        for side in (-1,1):
            for part in (-1,1):
                half=(w-6)/2
                box('facade plinth',(x+part*(w+6)/4,y+side*(d/2+.26),.42),(half,.16,.74),accent)
                box('horizontal fascia',(x,y+side*(d/2+.29),h-.3),(w+.4,.20,.45),accent)
                box('side fascia',(x+side*(w/2+.29),y,h-.3),(.20,d+.4,.45),accent)
                for frac in (-.32,.32):
                    wx=x+frac*w
                    box('window recessed surround',(wx,y+side*(d/2+.30),h*.57),(w*.18+.28,.055,1.60),dark,1)
                    box('window glazing',(wx,y+side*(d/2+.34),h*.57),(w*.18,.035,1.32),warm if frac>.0 else glazing,1)
                    box('warm window reflection',(wx,y+side*(d/2+.34),h*.57-.15),(w*.18-.12,.018,.07),warm,1)
                    for mullion in (-1,0,1):
                        box('window mullion',(wx+mullion*w*.043,y+side*(d/2+.35),h*.57),(.045,.035,1.35),pale,2)
            # Frame an existing opening without reducing its 6 m clearance.
            for part in (-1,1):
                box('entry jamb',(x+part*3.18,y+side*(d/2+.31),2.6),(.22,.32,5.2),pale)
            box('entry canopy',(x,y+side*(d/2+1.0),h-1.40),(7.2,2.0,.18),teal,1)
            box('entry warm light',(x,y+side*(d/2+.5),h-1.65),(5.7,.11,.12),warm)
            for step in range(4):
                box('entry ground wayfinding',(x,y+side*(d/2+1.2+step*.75),.032),(1.5,.14,.018),cool if not lunar else warm,1)
            for part in (-1,1):
                box('side base trim',(x+side*(w/2+.27),y+part*(d+6)/4,.42),(.16,(d-6)/2,.74),accent)
            # Gentle interior light panels and workbench silhouettes.
            box('interior ceiling glow',(x+side*w*.26,y,h-.10),(3,5,.06),warm,1,True)
        for side in (-1,1):
            for offset in range(1,max(2,int(w/4))):
                px=x-w/2+offset*4
                if abs(px-x)<3.5:continue
                box('facade vertical joint',(px,y+side*(d/2+.29),h*.48),(.055,.03,h*.78),teal,2)
        for sx in (-1,1):
            for sy in (-1,1):
                box('corner reinforcement',(x+sx*(w/2+.12),y+sy*(d/2-.5),h/2),(.22,1.1,h),accent,1)
        letters(('SELENE / ' if lunar else 'POLAR / ')+str(index+1).zfill(2),(x,y-d/2-.53,h-1.0),.7,pale,(math.pi/2,0,0),1)
        letters('RESEARCH OPERATIONS' if not lunar else 'LUNAR OPERATIONS',(x,y-d/2-.54,.98),.28,warm,(math.pi/2,0,0),2)
        # Rooftop utility groups, high only; no route or collision changes.
        for sx in (-.30,.30):
            box('roof service unit',(x+sx*w,y,h+.82),(3.5,2.8,.8),pale,2,True)
            for vent in range(6):
                box('roof ventilation slit',(x+sx*w-1.2+vent*.48,y,h+1.24),(.16,2.2,.025),teal,2,True)
        # Exterior utility pipe attached to a side wall.
        box('wall utility channel',(x+w/2+.36,y+d*.24,1.6),(.16,d*.22,.20),copper,2)
        for bolt in range(4):
            box('utility mount',(x+w/2+.38,y+d*.15+bolt*.65,1.6),(.12,.08,.32),teal,2)
    if not lunar:
        # Soft wind-sculpted banks near the map edge; decorative, beyond combat paths.
        for i,x in enumerate((-68,-47,47,68)):
            for y in (-52,52):
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,-.35))
                o=bpy.context.object;o.name='Art sculpted snow drift';o.scale=(7,3.5,1.0+(i%2)*.4)
                o.data.materials.append(textured_material('snow','high'));o['detail_level']=1
                uv_project(o,8)
    else:
        # Painted hazard lanes and cable insets on existing surfaces.
        for x in (-20,20):
            for y in (-14,14):
                for stripe in range(8):
                    o=box('landing hazard stripe',(x+stripe*.30,y,.033),(.16,1.1,.016),copper,1)
                    o.rotation_euler.z=-.5
        for x in (-31,31):
            box('surface utility conduit',(x,23,.026),(.35,9,.016),dark,1)
        for y in (-18.0,18.0):
            letters('KEEP CLEAR',(0,y,.17),.85,pale,level=1)
    for obj in list(scene.objects):
        if obj.type=='FONT':
            for other in scene.objects:other.select_set(False)
            obj.select_set(True);bpy.context.view_layer.objects.active=obj
            bpy.ops.object.convert(target=next(i.identifier for i in bpy.ops.object.convert.get_rna_type().properties['target'].enum_items if i.identifier=='MESH'))
    print(scene.name,'decorated; original collision metadata preserved')


def export_profile(source,quality):
    # Temporary copy keeps the fully editable authoring scenes intact.
    scene=copy_scene(source.name,source['map_id']+' export '+quality)
    level={'low':0,'medium':1,'high':2}[quality]
    objects=[o for o in scene.objects if o.type=='MESH' and o.get('detail_level',0)<=level]
    for obj in objects:
        for slot in obj.material_slots:
            if slot.material and slot.material.get('surface_kind'):
                slot.material=textured_material(slot.material['surface_kind'],quality)
    # Consolidate prop colors into vertex colors so a crate needs at most two draws.
    prop_mats={}
    for glow in (False,True):
        mat=solid('Art prop vertex '+str(glow),(1,1,1),.25 if quality!='low' else 0,.65)
        shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        color=mat.node_tree.nodes.new('ShaderNodeVertexColor')
        color.layer_name='Color'
        mat.node_tree.links.new(color.outputs['Color'],shader.inputs['Base Color'])
        if glow:
            mat.node_tree.links.new(color.outputs['Color'],shader.inputs['Emission Color'])
            shader.inputs['Emission Strength'].default_value=.7
        prop_mats[glow]=mat
    for obj in objects:
        if not obj.parent or not obj.parent.get('prototype_art_only'):continue
        colors=[];glow=False
        for polygon in obj.data.polygons:
            material=obj.data.materials[polygon.material_index]
            shader=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if material.use_nodes else None
            color=tuple(shader.inputs['Base Color'].default_value) if shader else tuple(material.diffuse_color)
            glow=glow or bool(shader and shader.inputs['Emission Strength'].default_value>0)
            for index in polygon.loop_indices:colors.extend(color)
        attr=obj.data.color_attributes.get('Color') or obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        attr.data.foreach_set('color',colors)
        obj.data.materials.clear();obj.data.materials.append(prop_mats[glow])
    # Batch immutable structures per material/roof. Preserve each prop as one unit.
    groups={}
    for obj in objects:
        # Most objects have one material; joining retains material slots for the others.
        key=(obj.parent.name if obj.parent else 'static',obj.data.materials[0].name if obj.data.materials else '',bool(obj.get('roof')))
        groups.setdefault(key,[]).append(obj)
    for index,group in enumerate(groups.values()):
        if len(group)<2:continue
        for obj in scene.objects:obj.select_set(False)
        for obj in group:obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        bpy.ops.object.join()
        group[0].name='Batched '+str(index)
    # Select by original groups: excluded details remain in the temp scene but not the export.
    for obj in scene.objects:obj.select_set(False)
    for group in groups.values():
        obj=group[0]
        if obj.name in scene.objects:obj.select_set(True)
    for obj in scene.objects:
        if obj.type=='EMPTY':obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+'/'+source['map_id']+'-'+quality+'.glb',use_selection=True,use_active_scene=True,export_extras=True,export_cameras=False,export_lights=False)
    bpy.context.window.scene=source
    bpy.data.scenes.remove(scene)
    print('Exported',source['map_id'],quality)


def setup_revisions():
    snow=copy_scene('Snow Research | 160 x 120 m','Snow Research | Detailed art v2')
    moon=copy_scene('Lunar Base | 100 x 80 m','Lunar Base | Detailed art v2')
    return snow,moon


def finish_art(scene):
    bpy.context.window.scene=scene
    original_signs=('RESEARCH HUB','WEST LABORATORY','EAST LABORATORY','HABITAT WEST','OPERATIONS EAST')
    for obj in scene.objects:
        if obj.type=='MESH' and any(obj.name.startswith(name) for name in original_signs):
            obj['detail_level']=3
            obj.hide_render=True
            obj.hide_viewport=True
    if scene['map_id']=='moon':
        rng=random.Random(20261116)
        glow=solid('Art distant stars',(.65,.79,1),rough=1,emission=1)
        for i in range(100):
            angle=rng.uniform(.15,math.pi-.15)
            p=Vector((math.cos(angle)*210,math.sin(angle)*210,rng.uniform(28,150)))
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rng.uniform(.08,.30),location=p)
            obj=bpy.context.object;obj.name='Art distant star'
            obj.data.materials.append(glow);obj['detail_level']=0 if i<20 else 1 if i<60 else 2
        image=bpy.data.images.new('Original Earth panorama',width=512,height=256)
        values=[]
        for iy in range(256):
            lat=(iy/255-.5)*math.pi
            for ix in range(512):
                lon=ix/512*math.pi*2
                land=math.sin(lon*2+math.sin(lat*3))+.4*math.sin(lon*5-lat*3)+.2*math.cos(lat*9+lon*2)
                cloud=max(0,math.sin(lon*8+lat*4+math.sin(lat*6))-.78)*1.8
                rgb=(.24,.36,.24) if land>.53 and abs(lat)<1.2 else (.025,.16,.35)
                if abs(lat)>1.28:rgb=(.72,.82,.85)
                values.extend(tuple(min(1,c+cloud*.65) for c in rgb)+(1,))
        image.pixels.foreach_set(values);image.pack()
        material=solid('Art distant Earth',(1,1,1),rough=1)
        shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
        material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
        material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value=.25
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=13,location=(-72,110,68))
        planet=bpy.context.object;planet.name='Art distant Earth'
        planet.data.materials.append(material);planet.rotation_euler.x=math.pi/2
        planet['detail_level']=0
        for polygon in planet.data.polygons:polygon.use_smooth=True
    print(scene.name,'signs cleaned and background finished')

print('Art revision functions ready; setup/textures/decorate/export are separate steps.')
