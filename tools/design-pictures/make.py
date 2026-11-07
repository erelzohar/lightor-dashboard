"""LT-595: raw shots -> 336x210 WebP thumbnails, animated WebPs, a manifest and contact sheets.

    python3 make.py [filter]        (filter: a key, a key prefix or a regex; default all)
"""
import json
import os
import re
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageStat

ROOT = os.path.dirname(os.path.abspath(__file__))
# shoot.js's raw shots (RAW_DIR), and where the pictures go: the dashboard's public/designs (OUT_DIR).
RAW = os.environ.get('RAW_DIR') or os.path.join(tempfile.gettempdir(), 'lightor-design-pictures', 'raw')
OUT = os.environ.get('OUT_DIR') or os.path.join(ROOT, '..', '..', 'public', 'designs')
W, H = 1280, 800
TW, TH = 336, 210
PAGE_TOPS = {'hero', 'navbar', 'herobg', 'productsPage', 'productPage', 'blogPage', 'postPage'}
STATIC_Q = 82


def rgb(css):
    nums = [float(x) for x in re.findall(r'[\d.]+', css or '')][:3]
    return tuple(int(round(n)) for n in nums) if len(nums) == 3 else (255, 255, 255)


def frame_of(img, meta):
    """One shot as the 16:10 picture: the cards' crop, the page's first screen, or the section."""
    img = img.convert('RGB')
    kind = meta.get('kind')
    if kind == 'card' or kind in PAGE_TOPS:
        return img
    h = img.height
    if h <= H:
        # A short section: centred on its own background.
        canvas = Image.new('RGB', (W, H), rgb(meta.get('bg')))
        canvas.paste(img, (0, (H - h) // 2))
        return canvas
    # A taller one (up to SECTION_MAX): all of it, a little smaller. The bands beside it take the
    # section's edge colour where its edges are plain (a contained layout), else a blurred copy of it
    # (a picture running edge to edge).
    s = H / h
    small = img.resize((round(W * s), H), Image.LANCZOS)
    edges = [img.crop((0, 0, 6, h)), img.crop((W - 6, 0, W, h))]
    stats = [ImageStat.Stat(e) for e in edges]
    plain = all(max(st.stddev) < 5 for st in stats)
    if plain:
        colour = tuple(int(round(sum(st.mean[c] for st in stats) / 2)) for c in range(3))
        canvas = Image.new('RGB', (W, H), colour)
    else:
        top = (h - H) // 2
        canvas = img.crop((0, top, W, top + H)).filter(ImageFilter.GaussianBlur(28))
    canvas.paste(small, ((W - small.width) // 2, 0))
    return canvas


def thumb(img):
    return img.resize((TW, TH), Image.LANCZOS)


def save_static(frame, path, q=STATIC_Q):
    t = thumb(frame)
    t.save(path, 'WEBP', quality=q, method=6)
    # Past the target, a little less quality.
    while os.path.getsize(path) > 15000 and q > 45:
        q -= 8
        t.save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path), q


def save_anim(frames, durations, path, q=55):
    thumbs = [thumb(f) for f in frames]
    def write(qq, keep):
        sel = thumbs[::keep]
        durs = [sum(durations[i:i + keep]) for i in range(0, len(durations), keep)][:len(sel)]
        sel[0].save(path, 'WEBP', save_all=True, append_images=sel[1:], duration=durs, loop=0, quality=qq, method=6, minimize_size=True, allow_mixed=False)
        return len(sel)
    n = write(q, 1)
    keep = 1
    while os.path.getsize(path) > 150000 and (q > 35 or keep < 3):
        if q > 35:
            q -= 10
        else:
            keep += 1
        n = write(q, keep)
    return os.path.getsize(path), q, n


def main():
    filt = sys.argv[1] if len(sys.argv) > 1 else None
    match = (lambda k: True) if not filt else (lambda k: k == filt or k.startswith(filt) or re.search(filt, k))
    # The manifest and the contact sheets are for a look before committing: beside the raw shots, not in the repo.
    manifest_path = os.path.join(os.path.dirname(RAW), 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for lang in sorted(os.listdir(RAW)):
        lang_dir = os.path.join(RAW, lang)
        if not os.path.isdir(lang_dir):
            continue
        out = os.path.join(OUT, lang)
        os.makedirs(out, exist_ok=True)
        entry = manifest.setdefault(lang, {'files': {}, 'failures': {}})
        for name in sorted(os.listdir(lang_dir)):
            if not name.endswith('.json'):
                continue
            key = name[:-5]
            if not match(key):
                continue
            meta = json.load(open(os.path.join(lang_dir, name)))
            entry['failures'].pop(key, None)
            if meta.get('failed') or meta.get('missing'):
                entry['failures'][key] = meta.get('failed') or 'section not drawn'
                continue
            frame = frame_of(Image.open(os.path.join(lang_dir, key + '.png')), meta)
            size, q = save_static(frame, os.path.join(out, key + '.webp'))
            entry['files'][key + '.webp'] = size
            anim = meta.get('anim')
            if anim:
                shots = anim['shots']
                frames = [frame_of(Image.open(os.path.join(lang_dir, key, s['file'])), meta) for s in shots]
                # Scroll loops and time-lapses (a slow field, LT-605) play at a fixed pace.
                if anim.get('fixedMs'):
                    durations = [anim.get('fixedMs', 85)] * len(frames)
                else:
                    durations = [max(40, shots[i + 1]['t'] - shots[i]['t']) for i in range(len(shots) - 1)] + [100]
                asize, aq, n = save_anim(frames, durations, os.path.join(out, key + '.anim.webp'))
                entry['files'][key + '.anim.webp'] = asize
                print(lang, key, size, 'anim', asize, 'q', aq, 'frames', n, 'of', len(frames))
            else:
                print(lang, key, size, 'q', q)
    json.dump(manifest, open(manifest_path, 'w'), indent=1, ensure_ascii=False)
    for lang in manifest:
        sheet(lang)


def sheet(lang, cols=8):
    out = os.path.join(OUT, lang)
    files = sorted(f for f in os.listdir(out) if f.endswith('.webp') and not f.endswith('.anim.webp'))
    order = ['hero', 'navbar', 'herobg', 'about', 'intro', 'features', 'gallery', 'products', 'card', 'productsPage', 'productPage', 'blog', 'blogPage', 'postPage', 'quote', 'faq', 'ledger', 'schedule', 'contact', 'footer', 'interlude', 'bookingBand', 'manifesto', 'process', 'hours', 'photoPair']
    files.sort(key=lambda f: (order.index(f.split('-')[0]) if f.split('-')[0] in order else 99, f))
    label_h = 18
    rows = (len(files) + cols - 1) // cols
    img = Image.new('RGB', (cols * (TW + 8) + 8, rows * (TH + label_h + 8) + 8), (40, 40, 46))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
    except OSError:
        font = ImageFont.load_default()
    for i, f in enumerate(files):
        x = 8 + (i % cols) * (TW + 8)
        y = 8 + (i // cols) * (TH + label_h + 8)
        img.paste(Image.open(os.path.join(out, f)).convert('RGB'), (x, y + label_h))
        anim = os.path.exists(os.path.join(out, f[:-5] + '.anim.webp'))
        draw.text((x + 2, y + 2), f[:-5] + ('  [anim]' if anim else ''), fill=(240, 240, 240), font=font)
    img.save(os.path.join(os.path.dirname(RAW), f'sheet-{lang}.jpg'), quality=82)


if __name__ == '__main__':
    main()
