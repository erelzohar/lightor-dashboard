"""LT-595 checks: blank thumbnails, and moving ones that do not move."""
import json, os, sys
from PIL import Image, ImageChops, ImageStat
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('OUT_DIR') or os.path.join(ROOT, '..', '..', 'public', 'designs')
for lang in ('he', 'en'):
    out = os.path.join(OUT, lang)
    if not os.path.isdir(out):
        continue
    flat, still, anims = [], [], []
    for f in sorted(os.listdir(out)):
        im = Image.open(os.path.join(out, f))
        if f.endswith('.anim.webp'):
            frames = []
            for i in range(im.n_frames):
                im.seek(i)
                frames.append(im.convert('L').copy())
            diffs = [ImageStat.Stat(ImageChops.difference(frames[i], frames[i + 1])).mean[0] for i in range(len(frames) - 1)]
            span = ImageStat.Stat(ImageChops.difference(frames[0], frames[len(frames) // 2])).mean[0]
            anims.append((f, im.n_frames, round(max(diffs), 2), round(span, 2), os.path.getsize(os.path.join(out, f))))
            if im.n_frames < 2 or max(diffs) < 0.5:
                still.append(f)
        else:
            sd = ImageStat.Stat(im.convert('L')).stddev[0]
            if sd < 10:
                flat.append((f, round(sd, 1)))
    print(lang, 'flat:', flat)
    print(lang, 'not moving:', still)
    for a in anims:
        print(lang, 'anim', a)
