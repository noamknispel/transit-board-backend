import { WidgetPlugin } from "./base.js";
import { Canvas, hexToRgb, type RGB } from "../render/canvas.js";
import { CHAR_WIDTH } from "../render/font.js";
import { ROW_HEIGHT, type RenderContext } from "../render/layout.js";
import { agentRegistry, type AgentSession, type AgentState } from "../services/agents.js";
import { toDisplayText } from "./spotify.js";

export const SHOW_WHEN_CHOICES = ["attention", "active", "always"] as const;
type ShowWhen = (typeof SHOW_WHEN_CHOICES)[number];

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

/** Draw one blob with its top-left at (x, y). The face shows the state; attention adds an amber "!". */
export function drawBlob(canvas: Canvas, x: number, y: number, base: RGB, state: AgentState): void {
  const body = state === "idle" ? dim(base, 0.4) : base;
  BODY.forEach((row, dy) => {
    for (let dx = 0; dx < SPRITE; dx++) if (row[dx] === "X") canvas.setPixel(x + dx, y + dy, body);
  });
  const px = (dx: number, dy: number, c: RGB) => canvas.setPixel(x + dx, y + dy, c);
  const rect = (dx: number, dy: number, w: number, h: number, c: RGB) => canvas.fillRect(x + dx, y + dy, w, h, c);

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
  defaultConfig: { showWhen: ShowWhen } = { showWhen: "attention" };

  validateConfig(config: any): boolean {
    if (!config || typeof config !== "object") {
      throw new Error("Config must be an object");
    }
    if (config.showWhen !== undefined && !SHOW_WHEN_CHOICES.includes(config.showWhen)) {
      throw new Error(`showWhen must be one of ${SHOW_WHEN_CHOICES.join(", ")}`);
    }
    return true;
  }

  async getData(config: any): Promise<any> {
    this.validateConfig(config);
    const showWhen: ShowWhen = config.showWhen ?? this.defaultConfig.showWhen;
    const sessions: AgentSession[] = agentRegistry.list();
    return { showWhen, sessions };
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
