import { agentRegistry, parseHookEvent } from "../services/agents.js";

/** Hooks include this token (?token= or x-agents-token) when AGENTS_TOKEN is set; otherwise anyone on the network may post. */
const authorized = (req: Request): boolean => {
  const expected = process.env.AGENTS_TOKEN;
  if (!expected) return true;
  const given = new URL(req.url).searchParams.get("token") ?? req.headers.get("x-agents-token");
  return given === expected;
};

/**
 * POST /agents/events - Body is the JSON a Claude Code hook receives on stdin
 * (session_id, cwd, hook_event_name), so a hook can pipe it straight here. An
 * optional x-project header names the project (see parseHookEvent).
 */
export const postEvent = async (req: Request) => {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const event = parseHookEvent(body, req.headers.get("x-project"));
  if (event) agentRegistry.apply(event);
  return Response.json({ ok: true, recorded: event !== null });
};

/** GET /agents - Current sessions, for debugging. */
export const listAgents = (req: Request) => {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(agentRegistry.list());
};
