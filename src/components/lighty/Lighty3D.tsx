import { useEffect, useRef, useState } from 'react';
import {
  AdditiveBlending,
  AnimationMixer,
  CanvasTexture,
  Color,
  Group,
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { AnimationAction, Material, MeshStandardMaterial, Object3D, SkinnedMesh } from 'three';
import type { Mood } from '../../utils/momentum';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import lightyUrl from '../../assets/lighty.glb?url';

/**
 * LT-253: the 3D Lighty, as the register wizard shows him (lightor-register
 * components/ui/lighty-3d.tsx, LT-241) — the rigged Meshy mascot with the
 * clips idle / wave / run / cheer. He waves once when he arrives, then
 * idles; runs (in place, facing you) while he is thinking — Erel's pick over
 * casting (LT-258); cheers once when an answer lands. LT-292: while the
 * floating Lighty is dragged he throws a tantrum in the air — the sitting
 * part of Meshy's Angry_To_Tantrum_Sit, held up at standing height (clip
 * `drag`), played back and forth since it has no seamless loop point.
 * LT-385: his `mood` (utils/momentum - how this week is going against last
 * week): from 1 his bolt glows and sparks crackle around it, stronger at each
 * step, and he sways happily instead of standing still; from 2 he cheers now
 * and then; at 3 he dances (Meshy's Happy_Sway_Standing and
 * Joyful_Dance_with_Hand_Sway as `sway` and `dance`). The glow is the yellow
 * of his own texture (the bolt), lit as emissive; the sparks are drawn on a
 * small canvas that rides his body bone over the bolt.
 * Reduced motion gets one still pose (the glow steady, no sparks); without
 * WebGL, or if the model fails to load, he never fades in (the page around
 * him works the same).
 *
 * Loaded lazily (three.js and the 1.8 MB model only reach the pages that
 * show him).
 */

type Clip = 'idle' | 'wave' | 'run' | 'cheer' | 'drag' | 'sway' | 'dance';
const CLIPS: Clip[] = ['idle', 'wave', 'run', 'cheer', 'drag', 'sway', 'dance'];

// LT-385: by mood 0..3 - the bolt's glow, the sparks' strength, and how long
// between his cheers / dances (seconds; 0 = never).
const GLOW = [0, 0.8, 1.5, 2.3];
const SPARKS = [0, 0.6, 0.9, 1];
const HALO = [0, 0.22, 0.38, 0.55];
const JOY_EVERY = [0, 0, 16, 11];
const BOLT_COLOR = '#ffc93c';
// The bolt lit up: hotter than its own yellow, so the flashes read on a bright bolt.
const BOLT_LIT = '#fff1b8';
const MASK_SIZE = 512;

/** The bolt: the yellow-orange of his texture (red high, green mid-high, blue low). */
const isBolt = (r: number, g: number, b: number) => r > 170 && g > 110 && b < 120 && r - b > 110;

/** Jagged arcs of electricity from the middle outwards, on a transparent square. */
function drawSparks(ctx: CanvasRenderingContext2D, mood: Mood) {
  const S = ctx.canvas.width;
  ctx.clearRect(0, 0, S, S);
  const arcs = mood === 1 ? (Math.random() < 0.4 ? 1 : 0) : mood === 2 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let a = 0; a < arcs; a++) {
    const ang = Math.random() * Math.PI * 2;
    const r0 = S * (0.12 + Math.random() * 0.12);
    const r1 = S * (0.34 + Math.random() * 0.13);
    const steps = 6;
    const pts: [number, number][] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const r = r0 + (r1 - r0) * t;
      const jitter = (Math.random() - 0.5) * 0.5 * (k && k < steps ? 1 : 0);
      pts.push([S / 2 + Math.cos(ang + jitter) * r, S / 2 + Math.sin(ang + jitter) * r]);
    }
    for (const [width, color, blur] of [[7, 'rgba(255,201,60,0.55)', 14], [2.5, '#fffbe8', 4]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.shadowColor = BOLT_COLOR;
      ctx.shadowBlur = blur;
      ctx.beginPath();
      pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // a spark at the tip
    const [tx, ty] = pts[pts.length - 1];
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(tx, ty, 3 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The bolt, lit: an emissive mask made from his own texture's yellow, and a
 * sparks sprite on his body bone at the bolt's middle. Null if the model has
 * no texture to read (the rest of him works the same).
 */
function wireBolt(model: Object3D) {
  let mesh: SkinnedMesh | null = null;
  model.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as SkinnedMesh; });
  const skinned = mesh as SkinnedMesh | null;
  const spine = model.getObjectByName('Spine01');
  if (!skinned || !spine) return null;
  const mat = skinned.material as MeshStandardMaterial;
  const map = mat.map;
  const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!map || !img?.width) return null;
  const c = document.createElement('canvas');
  c.width = c.height = MASK_SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, MASK_SIZE, MASK_SIZE);
  const px = ctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
  const d = px.data;
  const lit = new Uint8Array(MASK_SIZE * MASK_SIZE);
  for (let i = 0, k = 0; i < d.length; i += 4, k++) {
    const on = isBolt(d[i], d[i + 1], d[i + 2]);
    lit[k] = on ? 1 : 0;
    const v = on ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(px, 0, 0);
  const mask = new CanvasTexture(c);
  mask.flipY = map.flipY;
  mask.colorSpace = SRGBColorSpace;
  mask.channel = map.channel;
  mask.wrapS = map.wrapS;
  mask.wrapT = map.wrapT;
  mat.emissiveMap = mask;
  mat.emissive = new Color(BOLT_LIT);
  mat.emissiveIntensity = 0;
  mat.needsUpdate = true;

  // Where the bolt is on him: the middle of the vertices its yellow covers.
  const uv = skinned.geometry.getAttribute('uv');
  const count = skinned.geometry.getAttribute('position').count;
  model.updateMatrixWorld(true);
  skinned.skeleton.update();
  const p = new Vector3();
  const sum = new Vector3();
  const lo = new Vector3(Infinity, Infinity, Infinity);
  const hi = new Vector3(-Infinity, -Infinity, -Infinity);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    const x = Math.min(MASK_SIZE - 1, Math.max(0, Math.floor((u - Math.floor(u)) * MASK_SIZE)));
    const vy = map.flipY ? 1 - v : v;
    const y = Math.min(MASK_SIZE - 1, Math.max(0, Math.floor((vy - Math.floor(vy)) * MASK_SIZE)));
    if (!lit[y * MASK_SIZE + x]) continue;
    skinned.getVertexPosition(i, p);
    p.applyMatrix4(skinned.matrixWorld);
    sum.add(p);
    lo.min(p);
    hi.max(p);
    n++;
  }
  if (!n) return { mat, sprite: null, halo: null, sparks: null };

  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sctx = sc.getContext('2d');
  if (!sctx) return { mat, sprite: null, halo: null, sparks: null };
  const sparkTex = new CanvasTexture(sc);
  sparkTex.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending }));
  sprite.visible = false;
  const centre = sum.divideScalar(n);
  // Over his front, a little toward the viewer; big enough to reach past the bolt.
  const at = spine.worldToLocal(centre.clone().add(new Vector3(0, 0, 0.08)));
  const ws = new Vector3();
  spine.getWorldScale(ws);
  const size = Math.max(hi.x - lo.x, hi.y - lo.y) * 1.7;
  sprite.position.copy(at);
  sprite.scale.set(size / ws.x, size / ws.y, 1);
  // A soft glow behind the sparks, over the bolt.
  const hc = document.createElement('canvas');
  hc.width = hc.height = 64;
  const hctx = hc.getContext('2d');
  let halo: Sprite | null = null;
  if (hctx) {
    const grad = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,236,150,0.95)');
    grad.addColorStop(0.45, 'rgba(255,201,60,0.45)');
    grad.addColorStop(1, 'rgba(255,201,60,0)');
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 64, 64);
    const haloTex = new CanvasTexture(hc);
    haloTex.colorSpace = SRGBColorSpace;
    halo = new Sprite(new SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending }));
    halo.visible = false;
    halo.position.copy(at);
    halo.scale.set((size * 0.8) / ws.x, (size * 0.8) / ws.y, 1);
    spine.add(halo);
  }
  spine.add(sprite);
  return { mat, sprite, halo, sparks: { ctx: sctx, tex: sparkTex } };
}

interface Lighty3DProps {
  /** LT-385: how the week is going (0 calm .. 3 thrilled) - his bolt and his joy. */
  mood?: Mood;
  /** True while Lighty is working on an answer: he runs instead of idling. */
  thinking: boolean;
  /** Bumped when an answer lands — he cheers once. */
  cheerKey: number;
  className?: string;
  /** Called once the model is on screen — the floating Lighty swaps his 2D face out then (LT-269). */
  onReady?: () => void;
  /** LT-292: he is being dragged — the tantrum plays while this is true. */
  dragging?: boolean;
}

// Framing: the model is 1 unit tall with its feet at y=0; the box he is
// given spans 1.45 units so raised arms stay in frame.
const VIEW_H = 1.45;
const FOV = 30;
const LOOK_Y = VIEW_H / 2 - 0.065;
// LT-270: his clips travel further than the box. Measured over every frame of
// idle / wave / run / cheer: x −0.67…+0.82, y −0.15…+1.02, and up to 0.38
// toward the camera (×1.16 in perspective) — the wave's lean ran him off the
// side of a box narrower than it is tall, feet off the bottom. So the
// transparent canvas reaches past the box by these margins (in model units)
// while he keeps exactly the size and place the box gives him. Re-measure
// when the model or its clips change (lighty-3d-mascot pipeline).
const BLEED_X = 0.32;
const BLEED_BOTTOM = 0.15;
const STAGE_H = VIEW_H + BLEED_BOTTOM;
const STAGE_Y = LOOK_Y - BLEED_BOTTOM / 2;

export default function Lighty3D({ thinking, cheerKey, className = '', onReady, dragging = false, mood = 0 }: Lighty3DProps) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const ctlRef = useRef<{ setThinking: (on: boolean) => void; cheer: () => void; setDragging: (on: boolean) => void; setMood: () => void } | null>(null);
  const thinkingRef = useRef(thinking);
  const draggingRef = useRef(dragging);
  const moodRef = useRef<Mood>(mood);

  useEffect(() => {
    const host = hostRef.current;
    const stage = stageRef.current;
    if (!host || !stage) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return;
    }
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = NeutralToneMapping;
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    stage.appendChild(canvas);

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();

    const camera = new PerspectiveCamera(FOV, 1, 0.1, 20);
    camera.position.set(0, STAGE_Y, STAGE_H / 2 / Math.tan((FOV / 2) * Math.PI / 180));
    camera.lookAt(0, STAGE_Y, 0);

    const rig = new Group();
    scene.add(rig);

    let disposed = false;
    let raf = 0;
    let running = false;
    let visible = true;
    let mixer: AnimationMixer | null = null;
    const actions: Partial<Record<Clip, AnimationAction>> = {};
    let current: AnimationAction | null = null;
    let oneShot = false;

    const draw = () => renderer.render(scene, camera);
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      // The stage is the box plus the bleed, at the box's own scale.
      const unit = h / VIEW_H;
      const bx = Math.round(BLEED_X * unit), bb = Math.round(BLEED_BOTTOM * unit);
      stage.style.left = `${-bx}px`;
      stage.style.right = `${-bx}px`;
      stage.style.bottom = `${-bb}px`;
      renderer.setSize(w + 2 * bx, h + bb, false);
      camera.aspect = (w + 2 * bx) / (h + bb);
      camera.updateProjectionMatrix();
      if (!running) draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const play = (name: Clip, once = false, fade = 0.35) => {
      const next = actions[name];
      if (!next || !mixer) return;
      oneShot = once;
      if (next === current) return;
      next.reset();
      next.setLoop(once ? LoopOnce : name === 'drag' ? LoopPingPong : LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      if (current) next.crossFadeFrom(current, fade, false);
      next.play();
      current = next;
    };
    const base = (): Clip =>
      draggingRef.current ? 'drag' : thinkingRef.current ? 'run' : moodRef.current >= 1 && actions.sway ? 'sway' : 'idle';

    // LT-385: the lit bolt, and his joy's timing.
    let bolt: ReturnType<typeof wireBolt> = null;
    let clock = 0;
    let flick = 1;
    let nextFlick = 0;
    let nextArc = 0;
    let nextJoy = 0;
    let joys = 0;
    const lightBolt = () => {
      if (!bolt) return;
      const m = moodRef.current;
      if (still) {
        bolt.mat.emissiveIntensity = GLOW[m] * 0.6;
        if (bolt.sprite) bolt.sprite.visible = false;
        if (bolt.halo) {
          bolt.halo.visible = m > 0;
          (bolt.halo.material as SpriteMaterial).opacity = HALO[m];
        }
        return;
      }
      if (clock >= nextFlick) {
        flick = 0.55 + Math.random() * 0.7;
        nextFlick = clock + 0.05 + Math.random() * 0.12;
      }
      bolt.mat.emissiveIntensity = GLOW[m] * flick;
      if (bolt.halo) {
        bolt.halo.visible = m > 0;
        (bolt.halo.material as SpriteMaterial).opacity = HALO[m] * (0.6 + 0.4 * flick);
      }
      if (bolt.sprite && bolt.sparks) {
        bolt.sprite.visible = m > 0;
        (bolt.sprite.material as SpriteMaterial).opacity = SPARKS[m] * Math.min(1, flick);
        if (m > 0 && clock >= nextArc) {
          drawSparks(bolt.sparks.ctx, m);
          bolt.sparks.tex.needsUpdate = true;
          nextArc = clock + 0.07 + Math.random() * 0.06;
        }
      }
    };
    const joy = () => {
      const every = JOY_EVERY[moodRef.current];
      if (!every || oneShot || thinkingRef.current || draggingRef.current) return;
      if (!nextJoy) { nextJoy = clock + 2 + Math.random() * 3; return; }
      if (clock < nextJoy) return;
      const dance = moodRef.current === 3 && actions.dance && joys % 2 === 0;
      play(dance ? 'dance' : 'cheer', true);
      joys++;
      nextJoy = clock + every + Math.random() * 5;
    };

    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt;
      mixer?.update(dt);
      joy();
      lightBolt();
      draw();
    };
    const start = () => {
      if (running || still || disposed || !mixer || !visible) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    io.observe(host);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(lightyUrl, (gltf) => {
      if (disposed) return;
      rig.add(gltf.scene);
      mixer = new AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) {
        if (CLIPS.includes(clip.name as Clip)) actions[clip.name as Clip] = mixer.clipAction(clip);
      }
      try {
        bolt = wireBolt(gltf.scene);
      } catch {
        bolt = null; // no glow, the rest of him is the same
      }
      // A one-off ends: back to whatever he should be doing now.
      mixer.addEventListener('finished', (e) => {
        if (e.action === current) play(base());
      });
      ctlRef.current = {
        setThinking: (on) => { if (!draggingRef.current && (on || !oneShot)) play(on ? 'run' : 'idle'); },
        cheer: () => { if (!thinkingRef.current && !draggingRef.current) play('cheer', true); },
        // Picked up: straight into the tantrum. Put down: back to what he was doing.
        setDragging: (on) => play(on ? 'drag' : base(), false, on ? 0.15 : 0.35),
        // A new mood: sway or stand, and the glow follows on the next frame (or now, held still).
        setMood: () => {
          nextJoy = 0;
          if (!oneShot) play(base());
          if (still) { lightBolt(); mixer?.update(0); draw(); }
        },
      };
      if (still) {
        play('idle');
        lightBolt();
        mixer.update(0);
        draw();
      } else if (thinkingRef.current) {
        play('run');
      } else {
        play('wave', true);
      }
      setReady(true);
      onReadyRef.current?.();
      start();
    });

    return () => {
      disposed = true;
      ctlRef.current = null;
      stop();
      ro.disconnect();
      io.disconnect();
      mixer?.stopAllAction();
      for (const sp of [bolt?.sprite, bolt?.halo]) {
        if (!sp) continue;
        sp.material.map?.dispose();
        sp.material.dispose();
      }
      scene.traverse((obj) => {
        if (!(obj instanceof Mesh)) return;
        obj.geometry.dispose();
        const mats: Material[] = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
          m.dispose();
        }
      });
      envMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    thinkingRef.current = thinking;
    ctlRef.current?.setThinking(thinking);
  }, [thinking]);
  useEffect(() => { if (cheerKey > 0) ctlRef.current?.cheer(); }, [cheerKey]);
  useEffect(() => {
    draggingRef.current = dragging;
    ctlRef.current?.setDragging(dragging);
  }, [dragging]);
  useEffect(() => {
    moodRef.current = mood;
    ctlRef.current?.setMood();
  }, [mood]);

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden="true"
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.5s ease' }}
    >
      {/* The caller positions the box (the floating button makes it absolute),
          so the stage's anchor is this inner box. The stage bleeds past it
          (LT-270) and never takes a click from what is around him. */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={stageRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}
