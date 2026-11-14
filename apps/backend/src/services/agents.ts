import { basename } from "node:path";

/** What a Claude Code session is doing, most urgent first. */
export type AgentState = "attention" | "done" | "working" | "idle";

export const STATE_RANK: Record<AgentState, number> = { attention: 0, done: 1, working: 2, idle: 3 };

export interface AgentSession {
  id: string;
  /** Project folder name */
  project: string;
  state: AgentState;
  /** ms since epoch of the last event */
  updatedAt: number;
}

/** A "working" session that has been silent this long is probably stuck or gone; shown as idle. */
export const WORKING_STALE_MS = 30 * 60 * 1000;
/** Sessions with no event at all for this long are forgotten. */
export const FORGET_MS = 12 * 60 * 60 * 1000;

export type HookResult = { sessionId: string; project: string; state: AgentState | "ended" };

/**
 * Turn a Claude Code hook payload (the JSON a hook receives on stdin) into a
 * session update. Returns null for events that say nothing about the state.
 */
export function parseHookEvent(body: unknown): HookResult | null {
  if (!body || typeof body !== "object") return null;
  const { session_id, cwd, hook_event_name } = body as Record<string, unknown>;
  if (typeof session_id !== "string" || !session_id || typeof hook_event_name !== "string") return null;
  const project = typeof cwd === "string" && cwd ? basename(cwd.replace(/[\\/]+$/, "")) || cwd : "session";

  switch (hook_event_name) {
    case "SessionStart":
      return { sessionId: session_id, project, state: "idle" };
    case "UserPromptSubmit":
    case "PostToolUse": // runs again once a permission prompt has been answered
      return { sessionId: session_id, project, state: "working" };
    case "Notification": // permission prompt, or waiting for input
      return { sessionId: session_id, project, state: "attention" };
    case "Stop":
      return { sessionId: session_id, project, state: "done" };
    case "SessionEnd":
      return { sessionId: session_id, project, state: "ended" };
    default:
      return null;
  }
}

/** Live view of the Claude Code sessions that report in. Kept in memory: a restart just starts empty. */
export class AgentRegistry {
  private sessions = new Map<string, AgentSession>();

  apply(event: HookResult, now = Date.now()): void {
    if (event.state === "ended") {
      this.sessions.delete(event.sessionId);
      return;
    }
    this.sessions.set(event.sessionId, {
      id: event.sessionId,
      project: event.project,
      state: event.state,
      updatedAt: now,
    });
  }

  /** Sessions most urgent first, then most recent; stale ones are downgraded or dropped. */
  list(now = Date.now()): AgentSession[] {
    const out: AgentSession[] = [];
    for (const [id, s] of this.sessions) {
      const age = now - s.updatedAt;
      if (age > FORGET_MS) {
        this.sessions.delete(id);
        continue;
      }
      out.push(s.state === "working" && age > WORKING_STALE_MS ? { ...s, state: "idle" } : s);
    }
    return out.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.updatedAt - a.updatedAt);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const agentRegistry = new AgentRegistry();
