#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { SpotifyAuthModel } from "../models/spotify-auth";

// PKCE authorization-code flow: only the client ID is needed, no client secret.
// The redirect URI just has to match the one registered in the Spotify app; the
// page it lands on doesn't need to load. If this runs on another machine than
// your browser, paste the address-bar URL back in when asked.
const SCOPE = "user-read-currently-playing";
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

const base64url = (bytes: Buffer) => bytes.toString("base64url");

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

/** Wait for Spotify to redirect to our loopback address, or resolve null on timeout. */
function listenForRedirect(redirectUri: URL, timeoutMs: number): Promise<URL | null> {
  return new Promise((resolve) => {
    let server: ReturnType<typeof Bun.serve> | undefined;
    const done = (value: URL | null) => {
      clearTimeout(timer);
      server?.stop();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    try {
      server = Bun.serve({
        hostname: redirectUri.hostname,
        port: Number(redirectUri.port) || 80,
        fetch(req) {
          const url = new URL(req.url);
          if (url.pathname !== redirectUri.pathname) return new Response("Not found", { status: 404 });
          setTimeout(() => done(url), 50);
          return new Response("Spotify connected. You can close this tab and return to the terminal.");
        },
      });
    } catch {
      done(null); // port busy or not bindable here: fall back to pasting
    }
  });
}

async function main() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirect = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:8888/callback";
  if (!clientId) fail("SPOTIFY_CLIENT_ID is not set. Add it to apps/backend/.env first.");
  let redirectUri: URL;
  try {
    redirectUri = new URL(redirect);
  } catch {
    fail(`SPOTIFY_REDIRECT_URI is not a valid URL: ${redirect}`);
  }

  const verifier = base64url(randomBytes(64));
  const state = base64url(randomBytes(16));
  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirect,
    scope: SCOPE,
    state,
    code_challenge_method: "S256",
    code_challenge: base64url(createHash("sha256").update(verifier).digest()),
  }).toString();

  console.log("🎵 Connect Spotify\n");
  console.log("Open this URL in a browser and approve access:\n");
  console.log(`  ${authorizeUrl}\n`);
  console.log(`Waiting for the redirect to ${redirect} ...`);
  console.log("(If this machine isn't the one with your browser, the page will fail to load: copy the full URL from the address bar and paste it here.)\n");

  // Race the local listener against a pasted URL.
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = rl.question("Paste redirect URL (or just wait): ").then((answer) => {
    try {
      return new URL(answer.trim());
    } catch {
      return null;
    }
  });
  const received = await Promise.race([listenForRedirect(redirectUri, 5 * 60_000), pasted]);
  rl.close();

  if (!received) fail("Didn't get a redirect URL.");
  if (received.searchParams.get("state") !== state) fail("State mismatch: use the URL printed by this run.");
  const error = received.searchParams.get("error");
  if (error) fail(`Spotify said: ${error}`);
  const code = received.searchParams.get("code");
  if (!code) fail("The URL has no authorization code.");

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!tokenResponse.ok) fail(`Token exchange failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
  const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token?: string };
  if (!tokens.refresh_token) fail("Spotify didn't return a refresh token.");

  // Best effort: the display name is only shown as "Connected as ..." in the dashboard.
  let displayName: string | null = null;
  try {
    const me = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (me.ok) displayName = ((await me.json()) as { display_name?: string }).display_name ?? null;
  } catch {
    // /me needs user-read-private for some fields; the name is optional
  }

  SpotifyAuthModel.save(tokens.refresh_token, displayName);
  console.log(`\n✅ Connected${displayName ? ` as ${displayName}` : ""}. Add a "Now Playing" widget in the dashboard.`);
  process.exit(0);
}

main().catch((error) => fail(String(error)));
