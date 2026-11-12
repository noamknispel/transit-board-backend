/**
 * Which visible widgets get the board. Always-on widgets and scheduled ones
 * inside their window (out-of-window ones are already gone) rotate together;
 * show-only widgets take over while any of them is visible. A show-only
 * widget ignores its own schedule, so it's visible whenever it's enabled.
 *
 * Kept free of database imports so it can be unit-tested on its own.
 */
export function pickDisplayed<T extends { showOnly: boolean }>(visible: T[]): T[] {
  const showOnly = visible.filter((w) => w.showOnly);
  return showOnly.length > 0 ? showOnly : visible;
}
