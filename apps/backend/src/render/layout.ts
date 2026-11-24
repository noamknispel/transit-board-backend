import { Canvas, WHITE } from "./canvas.js";

/** What a widget renderer is given to draw into. */
export interface RenderContext {
  width: number;
  height: number;
}

/** Each text row on the matrix is 16px tall (two rows on a 32px panel). */
export const ROW_HEIGHT = 16;

/** Vertical center of row `row`, matching the firmware's row anchors. */
export const rowCenter = (row: number): number => row * ROW_HEIGHT + ROW_HEIGHT / 2;

/** A single-line message on row 0, used for empty/error states. */
export function statusCanvas(ctx: RenderContext, message: string): Canvas {
  const canvas = new Canvas(ctx.width, ctx.height);
  canvas.text(message, 2, rowCenter(0), WHITE);
  return canvas;
}
