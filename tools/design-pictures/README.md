# A picture of every design (LT-595)

The site editor shows each design it offers as a picture of itself
(`public/designs/<he|en>/<group>-<value>.webp`, and `.anim.webp` for the designs
that move by themselves). `src/tests/components/designChoices.test.tsx` fails
while any design in `src/utils/editorOptions.ts` has no picture, so a new design
needs its pictures before it can ship.

The pictures are drawn by the real front (a built `lightor-front`), with one
sample business (`demo.cjs`: a ceramics studio, he + en) and one calm look, so
only the design changes from picture to picture.

## Make or remake pictures

1. Build the front that draws the new design: `npm run build` in lightor-front
   (or point `FRONT_DIR` / `FRONT_DIST` at another checkout or worktree).
2. From this folder:

```bash
node shoot.cjs he,en '^gallery-curve$'
python3 make.py '^gallery-curve$'
python3 check.py
```

The filter is a key (`gallery-curve`), a group (`gallery-`) or a regex; no
filter remakes everything (about 40 minutes). `shoot.cjs` writes raw shots to
`RAW_DIR` (default: the system temp folder), `make.py` writes the pictures into
`public/designs` (`OUT_DIR` to put them elsewhere) and `check.py` lists blank
pictures and loops that do not move. `make.py` also leaves a manifest and a
contact sheet per language beside the raw shots: look at them before committing.

Needs: Playwright and esbuild from the front's node_modules, Google Chrome,
Python 3 with Pillow. WebGL backdrops are shot with GPU flags (SwiftShader
draws them faint).
