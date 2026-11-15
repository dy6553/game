"""Blender background, one-thread art pass based on the approved feasible concept.

Preserves v2 scenes, creates v3 authoring scenes and three batched exports per map.
No renders or external assets. Uses existing collision metadata unchanged.
"""
import bpy
import math
import json
import runpy
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art'/'expansion'
h=runpy.run_path(str(ROOT/'scripts'/'refine-expansion-art.py'))
solid=h['solid'];box=h['box'];export_profile=h['export_profile'];copy_scene=h['copy_scene']

teal=solid('Concept deep teal',(.035,.18,.205),.25,.6)
glass=solid('Concept faceted observatory glass',(.08,.32,.37),.3,.43,emission=.08)
ivory=solid('Concept soft ivory framing',(.72,.80,.78),.22,.65)
warm=solid('Concept amber entry lights',(1,.58,.18),.1,.55,emission=.9)
orange=solid('Concept muted orange navigation',(.8,.29,.065),.1,.8)
brass=solid('Concept soft brass',(.61,.39,.14),.5,.55)
dishmat=solid('Concept dish ceramic',(.67,.71,.70),.3,.6)


def beam(name,a,b,radius,mat,parent=None,level=0):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=radius,depth=(b-a).length,location=(a+b)/2)
    obj=bpy.context.object;obj.name=name
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    obj.data.materials.append(mat);obj['detail_level']=level
    if parent:
        obj.parent=parent
        # Points above are local to the parent, so preserve the computed local transform.
    return obj


def landmark(name,kind,location):
    root=bpy.data.objects.new(name,None)
    bpy.context.scene.collection.objects.link(root)
    root.location=location;root['landmark_kind']=kind
    root['art_only']=True
    return root


def mesh_object(name,vertices,faces,material,parent=None):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces);data.materials.append(material)
    obj=bpy.data.objects.new(name,data)
    bpy.context.scene.collection.objects.link(obj)
    obj['detail_level']=0
    if parent:obj.parent=parent
    return obj


def dome(name,location,radius,height,kind):
    root=landmark(name,kind,location)
    segments=16
    angles=(0,.38,.76,1.15)
    vertices=[]
    for theta in angles:
        for i in range(segments):
            phi=2*math.pi*i/segments
            vertices.append((radius*math.cos(theta)*math.cos(phi),radius*math.cos(theta)*math.sin(phi),height*math.sin(theta)))
    top=len(vertices);vertices.append((0,0,height))
    faces=[]
    for ring in range(len(angles)-1):
        for i in range(segments):
            a=ring*segments+i;b=ring*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    for i in range(segments):faces.append(((len(angles)-1)*segments+i,(len(angles)-1)*segments+(i+1)%segments,top))
    mesh_object(name+' glass facets',vertices,faces,glass,root)
    for i in range(segments):
        phi=2*math.pi*i/segments
        points=[(radius*math.cos(t)*math.cos(phi),radius*math.cos(t)*math.sin(phi),height*math.sin(t)) for t in angles]+[(0,0,height)]
        for k in range(len(points)-1):beam(name+' frame',points[k],points[k+1],.08,ivory,root)
    for theta in (0,.76):
        points=[(radius*math.cos(theta)*math.cos(i*math.pi*2/segments),radius*math.cos(theta)*math.sin(i*math.pi*2/segments),height*math.sin(theta)) for i in range(segments)]
        for i in range(segments):beam(name+' ring',points[i],points[(i+1)%segments],.10,teal,root)
    return root


def roof_dish(location):
    root=landmark('Concept rooftop communications dish','lunar_dish',location)
    root.rotation_euler.x=math.radians(48)
    segments=16;rings=5;radius=3.8
    vertices=[(0,0,0)]
    for j in range(1,rings+1):
        r=radius*j/rings
        for i in range(segments):
            angle=i*2*math.pi/segments
            vertices.append((r*math.cos(angle),r*math.sin(angle),1.15*(r/radius)**2))
    faces=[(0,1+i,1+(i+1)%segments) for i in range(segments)]
    for j in range(rings-1):
        for i in range(segments):
            a=1+j*segments+i;b=1+j*segments+(i+1)%segments
            faces.append((a,a+segments,b+segments,b))
    mesh_object('Concept faceted dish reflector',vertices,faces,dishmat,root)
    for i in range(segments):
        phi=i*math.pi*2/segments;nextphi=(i+1)*math.pi*2/segments
        beam('Concept dish rim',(radius*math.cos(phi),radius*math.sin(phi),1.15),(radius*math.cos(nextphi),radius*math.sin(nextphi),1.15),.075,brass,root)
    for i in range(3):
        phi=i*math.pi*2/3
        beam('Concept dish receiver support',(radius*.85*math.cos(phi),radius*.85*math.sin(phi),.84),(0,0,2.6),.055,teal,root)
    beam('Concept dish receiver',(0,0,2.25),(0,0,2.75),.22,brass,root)
    return root


def chevrons(x,y,z,mat):
    # Flat facade decals, no new movement or damage rule.
    for i in range(2):
        a=x+i*.85
        vertices=[(a,y,z),(a+.45,y,z),(a+1.0,y,z+.5),(a+.45,y,z+1),(a,y,z+1),(a+.55,y,z+.5)]
        mesh_object('Concept painted navigation chevron',vertices,[(0,1,2,3,4,5)],mat)


def entry_frame(x,y,height,mat):
    for side in (-1,1):
        beam('Concept portal jamb',(x+side*3.30,y,.08),(x+side*3.30,y,height-.65),.13,mat)
        beam('Concept chamfered portal',(x+side*3.30,y,height-.65),(x+side*2.65,y,height),.13,mat)
    beam('Concept portal header',(x-2.65,y,height),(x+2.65,y,height),.13,mat)
    box('concept entrance lamp',(x,y-.06,height-.18),(3.9,.08,.10),warm)


snow=copy_scene('Snow Research | Detailed art v2','Snow Research | Approved concept v3')
snow['concept_revision']=3
dome('Concept arctic observatory',(0,-5,7.65),8.5,5.5,'arctic_observatory')
entry_frame(0,-14.6,5.0,teal)
chevrons(-7.4,-14.52,2.0,orange)
for x in (-33,33):
    entry_frame(x,-26.6,3.7,teal)
    chevrons(x-5,-26.52,1.8,orange)
# The identity silhouettes exist in all quality profiles. Extra fasteners remain high only.
for x in (-12,12):
    for i in range(3):
        box('concept roof snow lip',(x+i*1.4,-14.5,7.64),(1.5,.7,.18),bpy.data.materials['MAP fresh snow'],1)
meta=next(o for o in snow.objects if 'collision_blockout_json' in o)
meta['concept_revision']=3;meta['approved_reference']='concept-feasible.png'
meta['landmarks_json']=json.dumps(['arctic_observatory'])

moon=copy_scene('Lunar Base | Detailed art v2','Lunar Base | Approved concept v3')
moon['concept_revision']=3
operations=h['textured_material']('operations-wall','high')
for obj in list(moon.objects):
    if obj.type!='MESH':continue
    # Put a clear ivory-vs-graphite contrast on the two existing main buildings.
    if obj.name.startswith('Operations east wall') or obj.name.startswith('Operations east lintel'):
        for slot in obj.material_slots:slot.material=operations
        h['uv_project'](obj,4)
    if obj.name.startswith('communications reflector') or obj.name.startswith('communications mast'):
        obj['detail_level']=3;obj.hide_render=True;obj.hide_viewport=True
    if ('roof vent' in obj.name or 'roof service' in obj.name) and obj.location.x<0 and abs(obj.location.x+31)<9 and abs(obj.location.y)<8:
        obj['detail_level']=3;obj.hide_render=True;obj.hide_viewport=True
dome('Concept faceted habitat roof',(-31,0,6.55),6,2.5,'lunar_habitat_dome')
roof_dish((31,0,8.5))
beam('Concept dish mount',(31,0,6.5),(31,0,8.5),.32,brass)
entry_frame(-31,-15.6,4.2,ivory);entry_frame(31,-15.6,4.2,brass)
chevrons(-37,-15.52,1.8,brass);chevrons(24,-15.52,1.8,brass)
for x in (36.8,38.0):
    beam('Concept brass service pipe',(x,-15.5,.5),(x,-15.5,4.2),.19,brass)
    beam('Concept brass pipe elbow',(x,-15.5,4.2),(x-1.1,-15.5,4.8),.19,brass)
meta=next(o for o in moon.objects if 'collision_blockout_json' in o)
meta['concept_revision']=3;meta['approved_reference']='concept-feasible.png'
meta['landmarks_json']=json.dumps(['lunar_habitat_dome','lunar_dish'])

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'expansion-maps-v3.blend'))
for scene in (snow,moon):
    for quality in ('low','medium','high'):export_profile(scene,quality)
    print('CONCEPT COMPLETE',scene['map_id'],flush=True)
bpy.context.window.scene=snow
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'expansion-maps-v3.blend'))
print('Saved v3 and six optimized GLB models. No render was performed.',flush=True)
