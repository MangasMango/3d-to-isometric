import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IsoCaptureEngine,
  DEFAULT_PITCH,
  type ClipInfo,
  type RenderSettings,
  type ClipRenderConfig,
} from './engine/IsoCaptureEngine';
import { COMPASS } from './engine/compass';
import './App.css';

const DIR_OPTIONS = COMPASS;

function defaultClipConfigs(clips: ClipInfo[], fps: number): ClipRenderConfig[] {
  return clips.map((c) => ({
    clipName: c.name,
    suffix: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    frames: Math.max(1, Math.ceil(c.duration * fps)),
    include: true,
  }));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<IsoCaptureEngine | null>(null);
  const cancelRef = useRef(false);

  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [clipCfgs, setClipCfgs] = useState<ClipRenderConfig[]>([]);
  const [modelName, setModelName] = useState<string>('');
  const [error, setError] = useState<string>('');

  // render settings
  const [size, setSize] = useState(256);
  const [fps, setFps] = useState(8);
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [padding, setPadding] = useState(0.15);
  const [yaw, setYaw] = useState(0);
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState('#1a1f24');
  const [useAtlas, setUseAtlas] = useState(false);
  const [baseName, setBaseName] = useState('character');
  const [rootFolder, setRootFolder] = useState('');

  // direction selection
  const [dirs, setDirs] = useState<string[]>(COMPASS.map((c) => c.dir));

  // preview state
  const [previewClip, setPreviewClip] = useState<string | null>(null);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [previewAzimuth, setPreviewAzimuth] = useState(270);

  // render progress
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');

  const bgResolved = transparent ? null : bgColor;

  const updateClipCfg = (i: number, patch: Partial<ClipRenderConfig>) => {
    setClipCfgs((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new IsoCaptureEngine(canvasRef.current);
    engine.onError = (msg) => setError(msg);
    engineRef.current = engine;
    engine.setPreviewAzimuth(270);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPitch(pitch);
  }, [pitch]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setYawOffset(yaw);
  }, [yaw]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPadding(padding);
  }, [padding]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setPreviewAzimuth(previewAzimuth);
  }, [previewAzimuth]);

  useEffect(() => {
    if (!engineRef.current) return;
    const cfg = clipCfgs.find((c) => c.clipName === previewClip);
    const f = cfg ? Math.max(1, cfg.frames) : 1;
    const idx = Math.min(previewFrame, f - 1);
    engineRef.current.setPose(previewClip, idx / fps);
  }, [previewClip, previewFrame, clipCfgs, fps]);

  const applyClips = useCallback((infos: ClipInfo[], name: string) => {
    setClips(infos);
    setClipCfgs(defaultClipConfigs(infos, 8));
    setModelName(name);
    setError('');
    if (infos.length > 0) {
      setPreviewClip(infos[0].name);
      setPreviewFrame(0);
    } else {
      setPreviewClip(null);
      setPreviewFrame(0);
    }
  }, []);

  const handleFile = async (file: File) => {
    const eng = engineRef.current;
    if (!eng) return;
    const infos = await eng.loadModel(file);
    applyClips(infos, file.name.replace(/\.[^.]+$/, ''));
  };

  const handleDemo = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const infos = eng.loadDemo();
    applyClips(infos, 'demo_character');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) =>
      /\.(glb|gltf)$/i.test(f.name),
    );
    if (file) handleFile(file);
  };

  const handleRender = async () => {
    const eng = engineRef.current;
    if (!eng || !eng.hasModel()) {
      setError('Load a model first.');
      return;
    }
    cancelRef.current = false;
    setRendering(true);
    setResultUrl(null);
    setProgress(0);
    const settings: RenderSettings = {
      size,
      pitch,
      frames: Math.max(1, Math.round(fps)),
      fps,
      background: bgResolved,
      padding,
      yawOffset: yaw,
    };
    try {
      const blob = await eng.renderAll({
        baseName: baseName.trim() || 'character',
        rootFolder: rootFolder.trim(),
        clips: clipCfgs,
        dirs,
        settings,
        useAtlas,
        onProgress: (done, tot) => {
          setProgress(done);
          setTotal(tot);
        },
        isCancelled: () => cancelRef.current,
      });
      if (blob) {
        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setResultName(`${baseName.trim() || 'character'}_sprites.zip`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Render failed: ${msg}`);
    } finally {
      setRendering(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const frameCountFor = (clipName: string | null) =>
    clipCfgs.find((c) => c.clipName === clipName)?.frames ?? 1;

  const previewMax = Math.max(1, frameCountFor(previewClip));

  const allDirs = useMemo(() => new Set(dirs), [dirs]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>3D → Isometric Spritesheet</h1>
        <p className="sub">
          Render a GLB/GLTF model from 16 compass directions and every
          animation frame, exported with the exact naming convention of
          Diablo-style isometric engines.
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          {/* ── model ── */}
          <section className="group">
            <h2>1 · Model</h2>
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".glb,.gltf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <p>Drop a <code>.glb</code> / <code>.gltf</code> here or browse</p>
            </div>
            <button className="btn ghost" onClick={handleDemo}>
              Load demo character (no upload needed)
            </button>
            {modelName && (
              <div className="modelinfo">
                <strong>{modelName}</strong>
                <span>{clips.length} animation{clips.length === 1 ? '' : 's'}</span>
              </div>
            )}
          </section>

          {/* ── animations ── */}
          <section className="group">
            <h2>2 · Animations</h2>
            {clips.length === 0 ? (
              <p className="muted">No animations detected — renders a single static frame per direction.</p>
            ) : (
              <div className="cliplist">
                {clipCfgs.map((c, i) => (
                  <div className="cliprow" key={c.clipName ?? i}>
                    <label className="chk">
                      <input
                        type="checkbox"
                        checked={c.include}
                        onChange={(e) =>
                          updateClipCfg(i, { include: e.target.checked })
                        }
                      />
                      <span>{c.clipName}</span>
                    </label>
                    <input
                      className="suffix"
                      value={c.suffix}
                      placeholder="suffix"
                      onChange={(e) => updateClipCfg(i, { suffix: e.target.value })}
                    />
                    <label className="frames">
                      frames
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={c.frames}
                        onChange={(e) =>
                          updateClipCfg(i, {
                            frames: Math.max(1, parseInt(e.target.value || '1', 10)),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── directions ── */}
          <section className="group">
            <h2>3 · Directions</h2>
            <div className="dirgrid">
              {DIR_OPTIONS.map((c) => (
                <label className="dirchk" key={c.dir}>
                  <input
                    type="checkbox"
                    checked={allDirs.has(c.dir)}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDirs((prev) =>
                        on
                          ? [...prev, c.dir].sort(
                              (a, b) =>
                                COMPASS.find((x) => x.dir === a)!.angle -
                                COMPASS.find((x) => x.dir === b)!.angle,
                            )
                          : prev.filter((d) => d !== c.dir),
                      );
                    }}
                  />
                  <span>{c.dir}</span>
                  <small>{c.angle}°</small>
                </label>
              ))}
            </div>
            <div className="rowbtn">
              <button
                className="btn tiny"
                onClick={() => setDirs(COMPASS.map((x) => x.dir))}
              >
                All 16
              </button>
              <button
                className="btn tiny"
                onClick={() => setDirs(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])}
              >
                8 compass
              </button>
              <button className="btn tiny" onClick={() => setDirs([])}>
                None
              </button>
            </div>
          </section>

          {/* ── output ── */}
          <section className="group">
            <h2>4 · Output</h2>
            <div className="fields">
              <label>
                Base name
                <input
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder="character"
                />
              </label>
              <label>
                Root folder (optional)
                <input
                  value={rootFolder}
                  onChange={(e) => setRootFolder(e.target.value)}
                  placeholder="playable character/warrior"
                />
              </label>
              <label>
                Resolution
                <select value={size} onChange={(e) => setSize(parseInt(e.target.value, 10))}>
                  {[128, 256, 512, 1024].map((s) => (
                    <option key={s} value={s}>
                      {s}×{s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Animation FPS
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={fps}
                  onChange={(e) =>
                    setFps(Math.max(1, Math.min(30, parseInt(e.target.value || '8', 10))))
                  }
                />
              </label>
              <label>
                Camera pitch <em>{pitch.toFixed(1)}°</em>
                <input
                  type="range"
                  min={10}
                  max={75}
                  step={0.5}
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                />
              </label>
              <label>
                Model yaw <em>{yaw}°</em>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={yaw}
                  onChange={(e) => setYaw(parseInt(e.target.value, 10))}
                />
              </label>
              <label>
                Margin
                <input
                  type="range"
                  min={0}
                  max={0.6}
                  step={0.01}
                  value={padding}
                  onChange={(e) => setPadding(parseFloat(e.target.value))}
                />
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                />
                <span>Transparent background</span>
              </label>
              {!transparent && (
                <label>
                  Background color
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                  />
                </label>
              )}
              <label className="chk">
                <input
                  type="checkbox"
                  checked={useAtlas}
                  onChange={(e) => setUseAtlas(e.target.checked)}
                />
                <span>Spritesheet atlas (frames × directions)</span>
              </label>
            </div>
          </section>

          {/* ── render ── */}
          <section className="group">
            {rendering ? (
              <>
                <div className="progresstext">
                  {progress} / {total} frames
                </div>
                <div className="progressbar">
                  <div
                    className="progressfill"
                    style={{
                      width: `${total ? (progress / total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <button className="btn danger" onClick={handleCancel}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn primary" onClick={handleRender}>
                Render &amp; Download ZIP
              </button>
            )}
            {resultUrl && (
              <a className="download" href={resultUrl} download={resultName}>
                ↓ Download {resultName}
              </a>
            )}
            {error && <p className="error">{error}</p>}
          </section>
        </aside>

        <main className="viewer">
          <canvas ref={canvasRef} className="preview" />
          <div className="previewbar">
            <label>
              Animation
              <select
                value={previewClip ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setPreviewClip(v);
                  setPreviewFrame(0);
                }}
              >
                <option value="">Static</option>
                {clips.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Frame
              <input
                type="range"
                min={0}
                max={previewMax - 1}
                value={previewFrame}
                onChange={(e) => setPreviewFrame(parseInt(e.target.value, 10))}
              />
              <em>{previewFrame + 1} / {previewMax}</em>
            </label>
            <label>
              Direction
              <select
                value={previewAzimuth}
                onChange={(e) => setPreviewAzimuth(parseInt(e.target.value, 10))}
              >
                {COMPASS.map((c) => (
                  <option key={c.dir} value={c.angle}>
                    {c.dir} ({c.angle}°)
                  </option>
                ))}
              </select>
            </label>
            <span className="hint">Drag to orbit · scroll to zoom</span>
          </div>
        </main>
      </div>
    </div>
  );
}
