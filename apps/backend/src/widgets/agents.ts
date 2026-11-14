import { WidgetPlugin } from "./base.js";
import { Canvas, hexToRgb, type RGB } from "../render/canvas.js";
import { CHAR_WIDTH } from "../render/font.js";
import { ROW_HEIGHT, type RenderContext } from "../render/layout.js";
import { agentRegistry, type AgentSession, type AgentState } from "../services/agents.js";
import { toDisplayText } from "./spotify.js";

export const SHOW_WHEN_CHOICES = ["attention", "active", "always"] as const;
type ShowWhen = (typeof SHOW_WHEN_CHOICES)[number];
export const LAYOUT_CHOICES = ["detail", "grid"] as const;
type Layout = (typeof LAYOUT_CHOICES)[number];

/** Most sessions the detail layout pages through, so a pile of idle ones can't take over the rotation. */
const MAX_DETAIL_PAGES = 6;

const CELL_WIDTH = 64;
const SPRITE = 12;
const NAME_COLOR: Record<AgentState, RGB> = {
  attention: hexToRgb(0xffb000),
  done: hexToRgb(0x40d060),
  working: hexToRgb(0xd0d0d0),
  idle: hexToRgb(0x606060),
};
const INK: RGB = [16, 16, 24];
const WHITE: RGB = [255, 255, 255];
const AMBER = NAME_COLOR.attention;
const GREEN = NAME_COLOR.done;

/** A blob's body color is picked from its session id so it stays the same session to session. */
const BLOB_COLORS = [0x4aa8ff, 0xff6fa5, 0x7be07b, 0xb48cff, 0xffa24a, 0x4ae0d0, 0xf0e050, 0xff7a6a].map(hexToRgb);

const BODY = [
  "....XXXX....",
  "..XXXXXXXX..",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XX.XXXX.XX.X",
];

export function blobColor(sessionId: string): RGB {
  let hash = 0;
  for (const ch of sessionId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return BLOB_COLORS[hash % BLOB_COLORS.length]!;
}

const dim = (c: RGB, f: number): RGB => [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];

/** "40s", "5m", "2h": how long a session has been in its state. */
export function formatAge(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

/** Draw one blob with its top-left at (x, y), each sprite pixel `scale` pixels square. The face shows the state. */
export function drawBlob(canvas: Canvas, x: number, y: number, base: RGB, state: AgentState, scale = 1): void {
  const body = state === "idle" ? dim(base, 0.4) : base;
  const rect = (dx: number, dy: number, w: number, h: number, c: RGB) => canvas.fillRect(x + dx * scale, y + dy * scale, w * scale, h * scale, c);
  const px = (dx: number, dy: number, c: RGB) => rect(dx, dy, 1, 1, c);
  BODY.forEach((row, dy) => {
    for (let dx = 0; dx < SPRITE; dx++) if (row[dx] === "X") px(dx, dy, body);
  });

  switch (state) {
    case "idle": // asleep
      rect(3, 6, 2, 1, INK);
      rect(7, 6, 2, 1, INK);
      break;
    case "working": // focused
      rect(3, 5, 2, 2, INK);
      rect(7, 5, 2, 2, INK);
      rect(5, 8, 2, 1, INK);
      break;
    case "done": // happy
      px(3, 6, INK); px(4, 5, INK); px(5, 6, INK);
      px(6, 6, INK); px(7, 5, INK); px(8, 6, INK);
      rect(4, 8, 4, 1, INK);
      px(3, 7, INK); px(8, 7, INK);
      break;
    case "attention": // wide-eyed, mouth open
      rect(3, 4, 2, 3, WHITE);
      rect(7, 4, 2, 3, WHITE);
      rect(4, 5, 1, 2, INK);
      rect(7, 5, 1, 2, INK);
      rect(5, 8, 2, 2, INK);
      break;
  }
}

function drawBang(canvas: Canvas, x: number, y: number): void {
  canvas.fillRect(x, y, 2, 6, AMBER);
  canvas.fillRect(x, y + 8, 2, 2, AMBER);
}

/**
 * Claude agents widget plugin
 * A blob per Claude Code session, with its project name; fed by hooks posting to /agents/events
 */
export class AgentsWidgetPlugin implements WidgetPlugin {
  type = "agents";
  name = "Claude Agents";
  description = "See which Claude Code sessions are working or need attention";
  defaultConfig: { showWhen: ShowWhen; layout: Layout } = { showWhen: "attention", layout: "detail" };

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }
    if (config.showWhen !== undefined && !SHOW_WHEN_CHOICES.includes(config.showWhen)) {
      throw new Error(`showWhen must be one of ${SHOW_WHEN_CHOICES.join(", ")}`);
    }
    if (config.layout !== undefined && !LAYOUT_CHOICES.includes(config.layout)) {
      throw new Error(`layout must be one of ${LAYOUT_CHOICES.join(", ")}`);
    }
    return true;
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);
    const showWhen: ShowWhen = config.showWhen ?? this.defaultConfig.showWhen;
    const sessions: AgentSession[] = agentRegistry.list();
    const layout: Layout = config.layout ?? this.defaultConfig.layout;
    return { showWhen, layout, sessions, now: Date.now() };
  }

  isVisible(data: any): boolean {
    const sessions: AgentSession[] = data.sessions ?? [];
    switch (data.showWhen) {
      case "always":
        return true;
      case "active":
        return sessions.some((s) => s.state !== "idle");
      default:
        return sessions.some((s) => s.state === "attention" || s.state === "done");
    }
  }

  render(data: any, ctx: RenderContext): Canvas[] {
    const sessions: AgentSession[] = data.sessions ?? [];
    return data.layout === "grid" ? this.renderGrid(sessions, ctx) : this.renderDetail(sessions, data.now ?? Date.now(), ctx);
  }

  /** One page per session: a big blob, the project name, and the state with how long it has lasted. */
  private renderDetail(sessions: AgentSession[], now: number, ctx: RenderContext): Canvas[] {
    if (sessions.length === 0) return this.renderGrid(sessions, ctx);
    const textX = SPRITE * 2 + 8;
    const maxChars = Math.max(0, Math.floor((ctx.width - textX - 2) / CHAR_WIDTH));

    return sessions.slice(0, MAX_DETAIL_PAGES).map((s) => {
      const canvas = new Canvas(ctx.width, ctx.height);
      drawBlob(canvas, 2, Math.floor((ctx.height - SPRITE * 2) / 2), blobColor(s.id), s.state, 2);
      if (s.state === "attention") drawBang(canvas, SPRITE * 2 + 4, 4);

      const age = formatAge(now - s.since);
      const tool = s.tool ? toDisplayText(s.tool) : "";
      const status = {
        attention: `NEEDS YOU ${age}`,
        done: `DONE ${age}`,
        working: tool ? `${tool} ${age}` : `WORKING ${age}`,
        idle: `IDLE ${age}`,
      }[s.state];
      canvas.text(toDisplayText(s.project).slice(0, maxChars), textX, ROW_HEIGHT / 2, s.state === "idle" ? NAME_COLOR.idle : [255, 255, 255]);
      canvas.text(status.slice(0, maxChars), textX, ROW_HEIGHT + ROW_HEIGHT / 2, NAME_COLOR[s.state]);
      return canvas;
    });
  }

  private renderGrid(sessions: AgentSession[], ctx: RenderContext): Canvas[] {
    const cols = Math.max(1, Math.floor(ctx.width / CELL_WIDTH));
    const rows = Math.max(1, Math.floor(ctx.height / ROW_HEIGHT));
    const perPage = cols * rows;
    const pages: Canvas[] = [];

    for (let start = 0; start < Math.max(1, sessions.length); start += perPage) {
      const canvas = new Canvas(ctx.width, ctx.height);
      if (sessions.length === 0) canvas.text("No agents", 2, ROW_HEIGHT / 2, NAME_COLOR.idle);

      sessions.slice(start, start + perPage).forEach((s, i) => {
        const cx = (i % cols) * CELL_WIDTH;
        const cy = Math.floor(i / cols) * ROW_HEIGHT;
        drawBlob(canvas, cx + 1, cy + 2, blobColor(s.id), s.state);
        const nameX = cx + SPRITE + 4;
        const maxChars = Math.floor((CELL_WIDTH - (SPRITE + 4) - 2) / CHAR_WIDTH);
        // Cut without an ellipsis: with so few characters, "..." would eat half the name
        canvas.text(toDisplayText(s.project).slice(0, maxChars), nameX, cy + ROW_HEIGHT / 2, NAME_COLOR[s.state]);
        if (s.state === "attention") drawBang(canvas, cx + SPRITE + 2, cy + 1);
        if (s.state === "done") canvas.setPixel(cx + SPRITE + 2, cy + 2, GREEN);
      });
      pages.push(canvas);
    }
    return pages;
  }
}
