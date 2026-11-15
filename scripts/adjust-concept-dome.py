"""Small, non-rendering correction after checking the ground-level preview."""
import bpy
import runpy
from pathlib import Path
root=Path(__file__).resolve().parent.parent
helpers=runpy.run_path(str(root/'scripts'/'refine-expansion-art.py'))
scene=bpy.data.scenes['Snow Research | Approved concept v3']
bpy.context.window.scene=scene
dome=next(o for o in scene.objects if o.get('landmark_kind')=='arctic_observatory')
dome.location.y=-5
dome.scale=(8.5/7.7,8.5/7.7,5.5/4.1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art'/'expansion'/'expansion-maps-v3.blend'))
for quality in ('low','medium','high'):helpers['export_profile'](scene,quality)
print('Adjusted dome silhouette; no render performed.',flush=True)
