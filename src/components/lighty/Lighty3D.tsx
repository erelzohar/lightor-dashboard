import { useEffect, useRef, useState } from 'react';
import {
  AnimationMixer,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from 'three';
import type { AnimationAction, Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import lightyUrl from '../../assets/lighty.glb?url';

/**
 * LT-253: the 3D Lighty, as the register wizard shows him (lightor-register
 * components/ui/lighty-3d.tsx, LT-241) — the rigged Meshy mascot with the
 * clips idle / wave / run / cheer. He waves once when he arrives, then
 * idles; runs (in place, facing you) while he is thinking — Erel's pick over
 * casting (LT-258); cheers once when an answer lands.
 * Reduced motion gets one still pose; without WebGL, or if the model fails
 * to load, he never fades in (the page around him works the same).
 *
 * Loaded lazily (three.js and the 1.8 MB model only reach the pages that
 * show him).
 */

type Clip = 'idle' | 'wave' | 'run' | 'cheer';

interface Lighty3DProps {
  /** True while Lighty is working on an answer: he runs instead of idling. */
  thinking: boolean;
  /** Bumped when an answer lands — he cheers once. */
  cheerKey: number;
  className?: string;
  /** Called once the model is on screen — the floating Lighty swaps his 2D face out then (LT-269). */
  onReady?: () => void;
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

export default function Lighty3D({ thinking, cheerKey, className = '', onReady }: Lighty3DProps) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const ctlRef = useRef<{ setThinking: (on: boolean) => void; cheer: () => void } | null>(null);
  const thinkingRef = useRef(thinking);

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

    const play = (name: Clip, once = false) => {
      const next = actions[name];
      if (!next || !mixer) return;
      oneShot = once;
      if (next === current) return;
      next.reset();
      next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      if (current) next.crossFadeFrom(current, 0.35, false);
      next.play();
      current = next;
    };
    const base = (): Clip => (thinkingRef.current ? 'run' : 'idle');

    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      mixer?.update(dt);
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
        if (['idle', 'wave', 'run', 'cheer'].includes(clip.name)) actions[clip.name as Clip] = mixer.clipAction(clip);
      }
      // A one-off ends: back to whatever he should be doing now.
      mixer.addEventListener('finished', (e) => {
        if (e.action === current) play(base());
      });
      ctlRef.current = {
        setThinking: (on) => { if (on || !oneShot) play(on ? 'run' : 'idle'); },
        cheer: () => { if (!thinkingRef.current) play('cheer', true); },
      };
      if (still) {
        play('idle');
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
