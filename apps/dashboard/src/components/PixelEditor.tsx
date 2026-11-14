import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_ART_COLORS, importImage, snapColor } from '../pixelart';

export interface ArtState {
  width: number;
  height: number;
  /** palette[0] doubles as the background */
  palette: string[];
  pixels: Uint8Array;
}

type Tool = 'pencil' | 'eraser' | 'fill' | 'pick';

interface PixelEditorProps {
  value: ArtState;
  onChange: (next: ArtState) => void;
}

const MAX_UNDO = 50;

/** Grid editor: pencil, eraser, fill and eyedropper over a panel-snapped palette, plus image import. */
export function PixelEditor({ value, onChange }: PixelEditorProps) {
  const { width, height, palette, pixels } = value;
  const background = palette[0]!;
  const [tool, setTool] = useState<Tool>('pencil');
  const [current, setCurrent] = useState(Math.min(1, palette.length - 1));
  const [undo, setUndo] = useState<ArtState[]>([]);
  const [redo, setRedo] = useState<ArtState[]>([]);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const working = useRef<Uint8Array | null>(null);
  const before = useRef<ArtState | null>(null);

  const cell = useMemo(() => Math.max(3, Math.min(12, Math.floor(640 / width))), [width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = palette[pixels[y * width + x]!] ?? background;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    if (cell >= 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = 1; x < width; x++) ctx.fillRect(x * cell, 0, 1, height * cell);
      for (let y = 1; y < height; y++) ctx.fillRect(0, y * cell, width * cell, 1);
    }
  }, [value, cell, width, height, palette, pixels, background]);

  const push = (prev: ArtState) => {
    setUndo((u) => [...u.slice(-(MAX_UNDO - 1)), prev]);
    setRedo([]);
  };

  const commit = (next: ArtState) => {
    push(value);
    onChange(next);
  };

  const cellAt = (e: React.PointerEvent): [number, number] | null => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * height);
    return x < 0 || y < 0 || x >= width || y >= height ? null : [x, y];
  };

  const paint = (x: number, y: number, buf: Uint8Array) => {
    buf[y * width + x] = tool === 'eraser' ? 0 : current;
  };

  const floodFill = (x: number, y: number) => {
    const target = pixels[y * width + x]!;
    if (target === current) return;
    const out = pixels.slice();
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx! < 0 || cy! < 0 || cx! >= width || cy! >= height || out[cy! * width + cx!] !== target) continue;
      out[cy! * width + cx!] = current;
      stack.push([cx! + 1, cy!], [cx! - 1, cy!], [cx!, cy! + 1], [cx!, cy! - 1]);
    }
    commit({ ...value, pixels: out });
  };

  const onDown = (e: React.PointerEvent) => {
    const at = cellAt(e);
    if (!at) return;
    const [x, y] = at;
    if (tool === 'pick') {
      setCurrent(pixels[y * width + x]!);
      setTool('pencil');
      return;
    }
    if (tool === 'fill') return floodFill(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    before.current = value;
    working.current = pixels.slice();
    paint(x, y, working.current);
    onChange({ ...value, pixels: working.current.slice() });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !working.current) return;
    const at = cellAt(e);
    if (!at) return;
    paint(at[0], at[1], working.current);
    onChange({ ...value, pixels: working.current.slice() });
  };

  const onUp = () => {
    if (drawing.current && before.current) push(before.current);
    drawing.current = false;
    working.current = null;
    before.current = null;
  };

  const doUndo = () => {
    const prev = undo[undo.length - 1];
    if (!prev) return;
    setUndo((u) => u.slice(0, -1));
    setRedo((r) => [...r, value]);
    onChange(prev);
  };

  const doRedo = () => {
    const next = redo[redo.length - 1];
    if (!next) return;
    setRedo((r) => r.slice(0, -1));
    setUndo((u) => [...u, value]);
    onChange(next);
  };

  const addColor = (hex: string) => {
    const snapped = snapColor(hex);
    const existing = palette.indexOf(snapped);
    if (existing >= 0) return setCurrent(existing);
    if (palette.length >= MAX_ART_COLORS) return setError(`Up to ${MAX_ART_COLORS} colors.`);
    setError('');
    onChange({ ...value, palette: [...palette, snapped] });
    setCurrent(palette.length);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const art = await importImage(file, width, height, background);
      commit({ ...value, palette: art.palette, pixels: art.pixels });
      setCurrent(0);
      setError('');
    } catch {
      setError("Couldn't read that image.");
    }
  };

  const tools: Array<[Tool, string]> = [['pencil', 'Pencil'], ['eraser', 'Eraser'], ['fill', 'Fill'], ['pick', 'Pick']];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {tools.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTool(id)} className={tool === id ? 'tb-btn-primary' : 'tb-btn-secondary'}>
            {label}
          </button>
        ))}
        <button type="button" className="tb-btn-secondary" onClick={doUndo} disabled={undo.length === 0}>Undo</button>
        <button type="button" className="tb-btn-secondary" onClick={doRedo} disabled={redo.length === 0}>Redo</button>
        <button type="button" className="tb-btn-secondary" onClick={() => commit({ ...value, pixels: new Uint8Array(width * height).fill(0) })}>
          Clear
        </button>
        <label className="tb-btn-secondary cursor-pointer">
          Import image
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>

      <div className="mb-3 max-h-[60vh] overflow-auto rounded-lg border border-ops-700 bg-black p-2">
        <canvas
          ref={canvasRef}
          width={width * cell}
          height={height * cell}
          className="block max-w-none cursor-crosshair"
          style={{ imageRendering: 'pixelated', touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((hex, i) => (
          <button
            key={hex + i}
            type="button"
            aria-label={`Color ${hex}`}
            onClick={() => { setCurrent(i); if (tool === 'pick') setTool('pencil'); }}
            className={`h-7 w-7 rounded border-2 ${i === current ? 'border-white' : 'border-ops-600'}`}
            style={{ background: hex }}
          />
        ))}
        <label className="tb-btn-secondary cursor-pointer">
          + Color
          <input type="color" className="sr-only" onChange={(e) => addColor(e.target.value)} />
        </label>
      </div>
      <p className="mt-2 text-xs text-ops-300">
        Colors snap to the 32 levels per channel the panel can show. {palette.length}/{MAX_ART_COLORS} colors used.
      </p>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
