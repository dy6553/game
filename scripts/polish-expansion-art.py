"""Arctic visual polish: original procedural assets, unchanged collision/layout."""
import bpy,runpy,math
from pathlib import Path
import numpy as np
base=Path(bpy.data.filepath).parent.parent.parent
h=runpy.run_path(str(base/'scripts/refine-expansion-art.py'))
snow=h['copy_scene']('Snow Research | Approved concept v3','Snow Research | Arctic polish v4')
moon=h['copy_scene']('Lunar Base | Approved concept v3','Lunar Base | Soft polish v4')
# Retain the established material family/UV layout but lower harsh panel contrast.
for image in bpy.data.images:
    if image.name.startswith('Original arctic-wall '):
        a=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(a);a=a.reshape((-1,4))
        a[:,:3]=np.clip(a[:,:3]*np.array([.43,.41,.40])+np.array([.45,.48,.47]),0,1)
        image.pixels.foreach_set(a.ravel());image.pack()
for scene in (snow,moon):
    bpy.context.window.scene=scene
    scene['art_revision']=4
    for obj in list(scene.objects):
        if obj.type!='MESH' or obj.get('detail_level',0)>2:continue
        name=obj.name.lower()
        if scene==snow and ('snow bank' in name or 'snow drift' in name):
            # Refine existing distant snow forms; no new objects in combat paths.
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Wind softened snow','SUBSURF');mod.levels=2;mod.render_levels=2
            bpy.ops.object.modifier_apply(modifier=mod.name)
            for v in obj.data.vertices:
                v.co.z+=.025*math.sin(v.co.x*5+v.co.y*3)
            for poly in obj.data.polygons:poly.use_smooth=True
            obj['detail_level']=0
        elif any(token in name for token in ('wall-','lintel-',' roof','snow lip','portal','service unit','supply','crate')) and len(obj.data.polygons)<=40:
            bpy.context.view_layer.objects.active=obj
            bevel=obj.modifiers.new('Soft manufactured edges','BEVEL')
            bevel.width=.12 if scene==snow else .065;bevel.segments=2
            bevel.affect='EDGES'
            bpy.ops.object.modifier_apply(modifier=bevel.name)
            normals=obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
            bpy.ops.object.modifier_apply(modifier=normals.name)
        elif 'basalt' in name or 'reflector' in name:
            for poly in obj.data.polygons:poly.use_smooth=True
    # Structural silhouette and palette are shared by all quality variants.
    print('POLISHED',scene.name,flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(base/'art/expansion/expansion-maps-v4.blend'))
for scene in (snow,moon):
    for quality in ('low','medium','high'):h['export_profile'](scene,quality)
bpy.context.window.scene=snow
bpy.ops.wm.save_as_mainfile(filepath=str(base/'art/expansion/expansion-maps-v4.blend'))
print('FINISHED: six profiles, no render; collision metadata unchanged',flush=True)
