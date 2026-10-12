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
 * clips idle / wave / cast / cheer. He waves once when he arrives, then
 * idles; casts while he is thinking; cheers once when an answer lands.
 * Reduced motion gets one still pose; without WebGL, or if the model fails
 * to load, he never fades in (the page around him works the same).
 *
 * Loaded lazily (three.js and the 1.8 MB model only reach the pages that
 * show him).
 */

type Clip = 'idle' | 'wave' | 'cast' | 'cheer';

interface Lighty3DProps {
  /** True while Lighty is working on an answer: he casts instead of idling. */
  thinking: boolean;
  /** Bumped when an answer lands — he cheers once. */
  cheerKey: number;
  className?: string;
}

// Framing: the model is 1 unit tall with its feet at y=0; the view spans
// 1.45 units so raised arms stay in frame.
const VIEW_H = 1.45;
const FOV = 30;
const LOOK_Y = VIEW_H / 2 - 0.065;

export default function Lighty3D({ thinking, cheerKey, className = '' }: Lighty3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const ctlRef = useRef<{ setThinking: (on: boolean) => void; cheer: () => void } | null>(null);
  const thinkingRef = useRef(thinking);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
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
    host.appendChild(canvas);

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();

    const camera = new PerspectiveCamera(FOV, 1, 0.1, 20);
    camera.position.set(0, LOOK_Y, VIEW_H / 2 / Math.tan((FOV / 2) * Math.PI / 180));
    camera.lookAt(0, LOOK_Y, 0);

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
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
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
    const base = (): Clip => (thinkingRef.current ? 'cast' : 'idle');

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
        if (['idle', 'wave', 'cast', 'cheer'].includes(clip.name)) actions[clip.name as Clip] = mixer.clipAction(clip);
      }
      // A one-off ends: back to whatever he should be doing now.
      mixer.addEventListener('finished', (e) => {
        if (e.action === current) play(base());
      });
      ctlRef.current = {
        setThinking: (on) => { if (on || !oneShot) play(on ? 'cast' : 'idle'); },
        cheer: () => { if (!thinkingRef.current) play('cheer', true); },
      };
      if (still) {
        play('idle');
        mixer.update(0);
        draw();
      } else if (thinkingRef.current) {
        play('cast');
      } else {
        play('wave', true);
      }
      setReady(true);
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
    />
  );
}
