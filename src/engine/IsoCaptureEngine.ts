import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import JSZip from 'jszip';
import { COMPASS } from './compass';
import { buildDemoModel } from './demo';

export interface ClipInfo {
  name: string;
  duration: number;
}

export interface RenderSettings {
  size: number;              // output resolution (square), px
  pitch: number;             // camera elevation from horizontal, degrees
  frames: number;            // default frames per clip
  fps: number;               // animation fps
  background: string | null; // hex color or null = transparent
  padding: number;           // 0..0.6 empty margin around model
  yawOffset: number;         // model yaw, degrees
}

export interface ClipRenderConfig {
  clipName: string | null;   // null = static (no animation)
  suffix: string;            // e.g. 'armed_walk'
  frames: number;
  include: boolean;
}

export interface RenderParams {
  baseName: string;
  rootFolder: string;
  clips: ClipRenderConfig[];
  dirs: string[];
  settings: RenderSettings;
  useAtlas: boolean;
  onProgress: (done: number, total: number) => void;
  isCancelled: () => boolean;
}

// Default camera elevation matching the game's diamond ratio 128/174.
export const DEFAULT_PITCH = 47.4;

export class IsoCaptureEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private controls: OrbitControls;
  private host: HTMLCanvasElement;
  private modelGroup = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private clips: THREE.AnimationClip[] = [];
  private target = new THREE.Vector3();
  private half = 2;
  private dist = 10;
  private padding = 0.25;
  private pitch = DEFAULT_PITCH;
  private rafId = 0;
  private running = true;
  private previewAzimuth = 270; // S

  // separate renderer used only during batch capture
  private capRenderer: THREE.WebGLRenderer | null = null;
  private capCanvas: HTMLCanvasElement | null = null;
  private capCamera: THREE.OrthographicCamera | null = null;

  onError: ((msg: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.host = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 6, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-4, 2, -3);
    this.scene.add(fill);

    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(this.target);

    this.scene.add(this.modelGroup);

    this._resize();
    window.addEventListener('resize', this._resize);
    this._loop();
  }

  // ── lifecycle ─────────────────────────────────────────────────────

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._resize);
    if (this.capRenderer) {
      this.capRenderer.dispose();
      this.capRenderer = null;
    }
    this.renderer.dispose();
  }

  startPreview() {
    if (!this.running) {
      this.running = true;
      this._loop();
    }
  }

  stopPreview() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  // ── model loading ─────────────────────────────────────────────────

  hasModel(): boolean {
    return this.modelGroup.children.length > 0;
  }

  getClips(): ClipInfo[] {
    return this.clips.map((c) => ({ name: c.name, duration: c.duration }));
  }

  async loadModel(file: File): Promise<ClipInfo[]> {
    const url = URL.createObjectURL(file);
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      const anims = Array.isArray(gltf.animations) ? gltf.animations : [];
      this._setModel(gltf.scene, anims);
      return this.getClips();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (this.onError) this.onError(`Failed to load model: ${msg}`);
      return [];
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  loadDemo(): ClipInfo[] {
    const { group, clips } = buildDemoModel();
    this._setModel(group, clips);
    return this.getClips();
  }

  private _setModel(root: THREE.Object3D, anims: THREE.AnimationClip[]) {
    while (this.modelGroup.children.length) {
      const c = this.modelGroup.children[0];
      this.modelGroup.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) {
          c.material.forEach((m) => m.dispose());
        } else {
          c.material.dispose();
        }
      }
    }
    this.modelGroup.add(root);
    this.clips = anims;
    this.mixer = this.clips.length ? new THREE.AnimationMixer(this.modelGroup) : null;
    this._refit();
  }

  // ── camera / framing ──────────────────────────────────────────────

  private _refit() {
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    box.getCenter(this.target);
    this.target.y = box.min.y; // feet at origin
    this.modelGroup.position.sub(this.target);
    const size = box.getSize(new THREE.Vector3());
    this.half = Math.max(size.x, size.y, size.z) * (0.5 + this.padding);
    this._resize();
    this._placeCamera(this.previewAzimuth);
  }

  private _resize = () => {
    const w = this.host.clientWidth || 640;
    const h = this.host.clientHeight || 480;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.left = -this.half * aspect;
    this.camera.right = this.half * aspect;
    this.camera.top = this.half;
    this.camera.bottom = -this.half;
    this.camera.updateProjectionMatrix();
  };

  private _placeCamera(azimuthDeg: number) {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const pit = THREE.MathUtils.degToRad(this.pitch);
    const x = Math.sin(az) * Math.cos(pit) * this.dist;
    const y = Math.sin(pit) * this.dist;
    const z = Math.cos(az) * Math.cos(pit) * this.dist;
    this.camera.position.set(x, y, z);
    this.controls.target.copy(this.target);
    this.controls.update();
  }

  setPitch(p: number) {
    this.pitch = p;
    this._placeCamera(this.previewAzimuth);
  }

  setPreviewAzimuth(deg: number) {
    this.previewAzimuth = deg;
    this._placeCamera(deg);
  }

  setYawOffset(deg: number) {
    this.modelGroup.rotation.y = THREE.MathUtils.degToRad(deg);
    this._refit();
  }

  setPadding(p: number) {
    this.padding = p;
    if (this.hasModel()) this._refit();
  }

  // ── pose / animation ──────────────────────────────────────────────

  setPose(clipName: string | null, time: number) {
    if (!this.mixer) {
      this._resetPose();
      return;
    }
    const clip = this.clips.find((c) => c.name === clipName);
    if (!clip) {
      this.mixer.stopAllAction();
      this.mixer.update(0);
      this._resetPose();
      return;
    }
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip);
    action.enabled = true;
    action.setLoop(THREE.LoopRepeat, 1);
    action.reset();
    action.play();
    this.mixer.setTime(Math.min(time, clip.duration - 0.001));
    this.mixer.update(0);
  }

  private _resetPose() {
    // return all animated targets to their bind/rest position by
    // re-rendering a frame with the mixer removed. For the demo we
    // simply stop actions; rest pose is the authored mesh transform.
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.update(0);
    }
  }

  // ── render loop ───────────────────────────────────────────────────

  private _loop = () => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // ── capture ───────────────────────────────────────────────────────

  private _ensureCapture(size: number, background: string | null) {
    if (!this.capRenderer) {
      const canvas = document.createElement('canvas');
      this.capRenderer = new THREE.WebGLRenderer({
        canvas,
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
      });
      this.capCanvas = canvas;
    }
    this.capRenderer.setPixelRatio(1);
    this.capRenderer.setSize(size, size, false);
    this.capRenderer.outputColorSpace = THREE.SRGBColorSpace;
    const bg = background ?? 0x000000;
    this.capRenderer.setClearColor(bg, background ? 1 : 0);
    if (!this.capCamera) {
      this.capCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    }
    this.capCamera.left = -this.half;
    this.capCamera.right = this.half;
    this.capCamera.top = this.half;
    this.capCamera.bottom = -this.half;
    this.capCamera.updateProjectionMatrix();
    return this.capRenderer;
  }

  private _renderCapture(
    azimuthDeg: number,
    pitchDeg: number,
    clipName: string | null,
    time: number,
  ) {
    const r = this.capRenderer!;
    const cam = this.capCamera!;
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const pit = THREE.MathUtils.degToRad(pitchDeg);
    const x = Math.sin(az) * Math.cos(pit) * this.dist;
    const y = Math.sin(pit) * this.dist;
    const z = Math.cos(az) * Math.cos(pit) * this.dist;
    cam.position.set(x, y, z);
    cam.lookAt(this.target);
    cam.up.set(0, 1, 0);
    this.setPose(clipName, time);
    r.render(this.scene, cam);
  }

  private _capToBlob(): Promise<Blob> {
    return new Promise((resolve) => {
      this.capCanvas!.toBlob(
        (b) => resolve(b ?? new Blob()),
        'image/png',
      );
    });
  }

  async renderAll(params: RenderParams): Promise<Blob | null> {
    if (!this.hasModel()) return null;
    this.stopPreview();
    try {
      const zip = new JSZip();
      const { settings, dirs } = params;
      this._ensureCapture(settings.size, settings.background);

      const activeClips = params.clips.filter((c) => c.include);
      let total = 0;
      for (const c of activeClips) total += c.frames * dirs.length;
      let done = 0;
      const report = () =>
        params.onProgress(Math.min(done, total), Math.max(total, 1));

      for (const clipCfg of activeClips) {
        if (params.isCancelled()) return null;
        const renderName =
          params.baseName + (clipCfg.suffix ? '_' + clipCfg.suffix : '');
        const frames = Math.max(1, clipCfg.frames);

        if (params.useAtlas) {
          const sheetW = frames * settings.size;
          const sheetH = dirs.length * settings.size;
          const sheet = document.createElement('canvas');
          sheet.width = sheetW;
          sheet.height = sheetH;
          const ctx = sheet.getContext('2d')!;
          ctx.clearRect(0, 0, sheetW, sheetH);
          if (settings.background) {
            ctx.fillStyle = settings.background;
            ctx.fillRect(0, 0, sheetW, sheetH);
          }

          for (let di = 0; di < dirs.length; di++) {
            const dname = dirs[di];
            const compass = COMPASS.find((c) => c.dir === dname);
            const azimuth = compass ? compass.angle : 0;
            for (let f = 0; f < frames; f++) {
              if (params.isCancelled()) return null;
              this._renderCapture(
                azimuth,
                settings.pitch,
                clipCfg.clipName,
                f / settings.fps,
              );
              ctx.drawImage(
                this.capCanvas!,
                0,
                0,
                settings.size,
                settings.size,
                f * settings.size,
                di * settings.size,
                settings.size,
                settings.size,
              );
              done++;
              report();
            }
          }
          const blob = await new Promise<Blob>((resolve) =>
            sheet.toBlob((b) => resolve(b ?? new Blob()), 'image/png'),
          );
          const folder = [params.rootFolder, renderName]
            .filter(Boolean)
            .join('/');
          zip.file(`${folder}.png`, blob);
        } else {
          for (const { dir, angle } of COMPASS) {
            if (!dirs.includes(dir)) continue;
            const folder = [params.rootFolder, renderName, dir]
              .filter(Boolean)
              .join('/');
            for (let f = 0; f < frames; f++) {
              if (params.isCancelled()) return null;
              this._renderCapture(
                angle,
                settings.pitch,
                clipCfg.clipName,
                f / settings.fps,
              );
              const blob = await this._capToBlob();
              const fname = `${renderName}_${dir}_${angle.toFixed(1)}_${f}.png`;
              zip.file(`${folder}/${fname}`, blob);
              done++;
              report();
            }
          }
        }
      }

      // manifest describing the export
      const manifest = {
        baseName: params.baseName,
        rootFolder: params.rootFolder,
        directions: dirs,
        fps: settings.fps,
        pitch: settings.pitch,
        size: settings.size,
        clips: activeClips.map((c) => ({
          clip: c.clipName,
          suffix: c.suffix,
          frames: c.frames,
        })),
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      return zip.generateAsync({ type: 'blob' });
    } finally {
      this.startPreview();
    }
  }
}
