"""Slice existing generated artwork; preserve alpha and align complete silhouettes."""
from PIL import Image, ImageDraw
from pathlib import Path
import numpy as np
import json

root = Path(__file__).resolve().parent.parent
source = root/'public/assets/boar-articulated-v2-source.png'
im = Image.open(source).convert('RGBA')
pixels = np.array(im)
mask = pixels[:,:,3] > 40
height, width = mask.shape
labels = np.zeros(mask.shape, dtype=np.int32)
parts = []
label = 0
for y in range(height):
    for x in range(width):
        if not mask[y,x] or labels[y,x]: continue
        label += 1
        stack = [(x,y)]; labels[y,x] = label
        left=right=x; top=bottom=y; area=0
        while stack:
            px,py=stack.pop(); area+=1
            left=min(left,px);right=max(right,px);top=min(top,py);bottom=max(bottom,py)
            for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                if 0<=nx<width and 0<=ny<height and mask[ny,nx] and labels[ny,nx]==0:
                    labels[ny,nx]=label;stack.append((nx,ny))
        if area>3000:parts.append(dict(left=left,right=right,top=top,bottom=bottom,area=area,label=label))
if len(parts)!=32: raise RuntimeError(f'Expected 32 independent silhouettes, found {len(parts)}')
parts.sort(key=lambda p:(p['top']+p['bottom'])/2)
rows=[sorted(parts[r*8:(r+1)*8],key=lambda p:p['left']) for r in range(4)]
size=256;pad=16;baseline=238
scale=min((size-2*pad)/max(p['right']-p['left']+1 for p in parts),(baseline-pad)/max(p['bottom']-p['top']+1 for p in parts))
sheet=Image.new('RGBA',(size*8,size*4))
for row_index,row in enumerate(rows):
    ground=max(p['bottom'] for p in row)
    for col,p in enumerate(row):
        # Expand the original box slightly to retain fine alpha edges and loose bristles.
        l=max(0,p['left']-2);t=max(0,p['top']-2);r=min(width,p['right']+3);b=min(height,p['bottom']+3)
        cut=im.crop((l,t,r,b))
        target=(round(cut.width*scale),round(cut.height*scale))
        cut=cut.resize(target,Image.Resampling.LANCZOS)
        # Keep flight/weight-transfer height, without a separate per-frame zoom.
        lift=min(ground-p['bottom'],35) if row_index==2 else 0
        dx=col*size+round((size-cut.width)/2)
        dy=row_index*size+baseline-cut.height-round(lift*scale)
        sheet.alpha_composite(cut,(dx,dy))
dest=root/'public/assets/boar-articulated-v2.png';sheet.save(dest)
raw=root/'public/assets/boar-articulated-v2-source.png';im.save(raw)
qa=root/'qa';qa.mkdir(exist_ok=True)
check=Image.new('RGBA',sheet.size,(35,43,48,255));check.alpha_composite(sheet)
draw=ImageDraw.Draw(check)
for x in range(0,sheet.width,size):draw.line((x,0,x,sheet.height),fill=(72,82,89,255))
for y in range(0,sheet.height,size):draw.line((0,y,sheet.width,y),fill=(72,82,89,255))
check.convert('RGB').save(qa/'boar-v2-contact-sheet.jpg')
print(json.dumps({'components':len(parts),'size':sheet.size,'scale':scale,'file':str(dest)}))
