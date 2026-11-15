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
  /** ms since epoch when `state` last changed (a stream of tool events doesn't reset it) */
  since: number;
  /** Tool the session is running right now, while working */
  tool?: string;
}

/** A "working" session that has been silent this long is probably stuck or gone; shown as idle. */
export const WORKING_STALE_MS = 2 * 60 * 60 * 1000;
/** A finished session shows as done this long, then counts as idle. */
export const DONE_MS = 60 * 1000;
/** An idle session is dropped this long after it went idle. */
export const IDLE_FORGET_MS = 2 * 60 * 1000;
/** Sessions with no event at all for this long are forgotten. */
export const FORGET_MS = 12 * 60 * 60 * 1000;

export type HookResult = { sessionId: string; project: string; state: AgentState | "ended"; tool?: string };

/**
 * Turn a Claude Code hook payload (the JSON a hook receives on stdin) into a
 * session update. Returns null for events that say nothing about the state.
 * `projectName` (the hook's $CLAUDE_PROJECT_DIR folder) wins over the cwd's
 * folder, which follows `cd` into subfolders.
 */
export function parseHookEvent(body: unknown, projectName?: string | null): HookResult | null {
  if (!body || typeof body !== "object") return null;
  const { session_id, cwd, hook_event_name, tool_name } = body as Record<string, unknown>;
  if (typeof session_id !== "string" || !session_id || typeof hook_event_name !== "string") return null;
  const project =
    projectName?.trim() || (typeof cwd === "string" && cwd ? basename(cwd.replace(/[\\/]+$/, "")) || cwd : "session");

  switch (hook_event_name) {
    case "SessionStart":
      return { sessionId: session_id, project, state: "idle" };
    case "UserPromptSubmit":
      return { sessionId: session_id, project, state: "working" };
    case "PostToolUse": // runs again once a permission prompt has been answered
      return { sessionId: session_id, project, state: "working", tool: typeof tool_name === "string" ? tool_name : undefined };
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
    const previous = this.sessions.get(event.sessionId);
    this.sessions.set(event.sessionId, {
      id: event.sessionId,
      project: event.project,
      state: event.state,
      updatedAt: now,
      since: previous && previous.state === event.state ? previous.since : now,
      tool: event.tool,
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
      // Needs-you sessions never go idle: they wait until something happens.
      const idleAfter = s.state === "working" ? WORKING_STALE_MS : s.state === "done" ? DONE_MS : null;
      const session: AgentSession =
        idleAfter !== null && age > idleAfter ? { ...s, state: "idle", since: s.updatedAt + idleAfter, tool: undefined } : s;
      if (session.state === "idle" && now - session.since > IDLE_FORGET_MS) continue;
      out.push(session);
    }
    return out.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.updatedAt - a.updatedAt);
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const agentRegistry = new AgentRegistry();
