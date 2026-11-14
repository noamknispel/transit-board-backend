import { beforeEach, describe, expect, test } from "bun:test";
import { AgentsWidgetPlugin, blobColor, formatAge } from "./agents.js";
import { AgentRegistry, FORGET_MS, IDLE_FORGET_MS, WORKING_STALE_MS, parseHookEvent } from "../services/agents.js";

const hook = (hook_event_name: string, session_id = "s1", cwd = "/Users/me/Projects/transit-board") => ({ hook_event_name, session_id, cwd });

describe("hook events", () => {
  test("maps hook names to states and the project folder", () => {
    expect(parseHookEvent(hook("UserPromptSubmit"))).toEqual({ sessionId: "s1", project: "transit-board", state: "working" });
    expect(parseHookEvent(hook("Notification"))?.state).toBe("attention");
    expect(parseHookEvent(hook("Stop"))?.state).toBe("done");
    expect(parseHookEvent(hook("SessionEnd"))?.state).toBe("ended");
  });

  test("the project name from the hook beats the cwd's folder", () => {
    const sub = hook("Stop", "s1", "/Users/me/Projects/transit-board/apps/dashboard");
    expect(parseHookEvent(sub)?.project).toBe("dashboard");
    expect(parseHookEvent(sub, "transit-board")?.project).toBe("transit-board");
  });

  test("ignores unknown events and junk", () => {
    expect(parseHookEvent(hook("PreCompact"))).toBeNull();
    expect(parseHookEvent({ hook_event_name: "Stop" })).toBeNull();
    expect(parseHookEvent(null)).toBeNull();
  });
});

describe("agent registry", () => {
  let registry: AgentRegistry;
  beforeEach(() => (registry = new AgentRegistry()));
  const send = (name: string, id: string, at: number) => registry.apply(parseHookEvent(hook(name, id))!, at);

  test("lists the sessions needing attention first", () => {
    send("UserPromptSubmit", "a", 1000);
    send("Notification", "b", 500);
    send("Stop", "c", 2000);
    expect(registry.list(3000).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  test("tracks the running tool and when the state last changed", () => {
    registry.apply(parseHookEvent({ ...hook("PostToolUse", "a"), tool_name: "Edit" })!, 1000);
    registry.apply(parseHookEvent({ ...hook("PostToolUse", "a"), tool_name: "Bash" })!, 5000);
    expect(registry.list(6000)[0]).toMatchObject({ tool: "Bash", since: 1000 });
    send("Stop", "a", 7000);
    expect(registry.list(8000)[0]).toMatchObject({ tool: undefined, since: 7000 });
  });

  test("a finished session is removed", () => {
    send("Stop", "a", 1000);
    send("SessionEnd", "a", 2000);
    expect(registry.list(3000)).toEqual([]);
  });

  test("silent working sessions go idle, and old ones are forgotten", () => {
    send("UserPromptSubmit", "a", 0);
    expect(registry.list(WORKING_STALE_MS + 1)[0]!.state).toBe("idle");
    expect(registry.list(FORGET_MS + 1)).toEqual([]);
  });

  test("an idle session disappears two minutes after going idle", () => {
    send("SessionStart", "a", 0);
    expect(registry.list(IDLE_FORGET_MS - 1)).toHaveLength(1);
    expect(registry.list(IDLE_FORGET_MS + 1)).toEqual([]);

    send("UserPromptSubmit", "b", 0);
    expect(registry.list(WORKING_STALE_MS + IDLE_FORGET_MS - 1)).toHaveLength(1);
    expect(registry.list(WORKING_STALE_MS + IDLE_FORGET_MS + 1)).toEqual([]);
  });
});

describe("agents widget", () => {
  const plugin = new AgentsWidgetPlugin();
  const session = (id: string, state: any) => ({ id, project: id, state, updatedAt: 0, since: 0 });

  test("visibility follows showWhen", () => {
    const idle = [session("a", "idle")];
    const working = [session("a", "working")];
    const attention = [session("a", "attention")];
    expect(plugin.isVisible({ showWhen: "attention", sessions: working })).toBe(false);
    expect(plugin.isVisible({ showWhen: "attention", sessions: attention })).toBe(true);
    expect(plugin.isVisible({ showWhen: "active", sessions: working })).toBe(true);
    expect(plugin.isVisible({ showWhen: "active", sessions: idle })).toBe(false);
    expect(plugin.isVisible({ showWhen: "any", sessions: idle })).toBe(true);
    expect(plugin.isVisible({ showWhen: "any", sessions: [] })).toBe(false);
    expect(plugin.isVisible({ showWhen: "always", sessions: [] })).toBe(true);
  });

  test("grid layout pages through more sessions than fit (4 per page on 128x32)", () => {
    const sessions = Array.from({ length: 5 }, (_, i) => session(`s${i}`, "working"));
    const pages = plugin.render({ showWhen: "always", layout: "grid", sessions }, { width: 128, height: 32 });
    expect(pages).toHaveLength(2);
  });

  test("detail layout is one page per session, capped", () => {
    const some = Array.from({ length: 3 }, (_, i) => session(`s${i}`, "working"));
    expect(plugin.render({ showWhen: "always", layout: "detail", sessions: some, now: 0 }, { width: 128, height: 32 })).toHaveLength(3);
    const many = Array.from({ length: 20 }, (_, i) => session(`s${i}`, "idle"));
    expect(plugin.render({ showWhen: "always", layout: "detail", sessions: many, now: 0 }, { width: 128, height: 32 })).toHaveLength(6);
  });

  test("formats how long a state has lasted", () => {
    expect(formatAge(40_000)).toBe("40s");
    expect(formatAge(5 * 60_000)).toBe("5m");
    expect(formatAge(2 * 3600_000 + 5000)).toBe("2h");
    expect(formatAge(-5)).toBe("0s");
  });

  test("always renders a page, even with no sessions", () => {
    expect(plugin.render({ showWhen: "always", sessions: [] }, { width: 128, height: 32 })).toHaveLength(1);
  });

  test("a session keeps its blob color", () => {
    expect(blobColor("abc")).toEqual(blobColor("abc"));
  });

  test("validates showWhen", () => {
    expect(plugin.validateConfig({})).toBe(true);
    expect(() => plugin.validateConfig({ showWhen: "never" })).toThrow();
    expect(() => plugin.validateConfig({ layout: "wide" })).toThrow();
  });
});
