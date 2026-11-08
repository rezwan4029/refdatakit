import Ajv2020, { type AnySchema, type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import entitySchema from "../../../schemas/entity.schema.json";
import { canonicalJson } from "../../../packages/js/src/canonical-json.js";

interface Environment {
  GITHUB_BASE_BRANCH: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_OWNER: string;
  GITHUB_REPOSITORY: string;
  GITHUB_REPOSITORY_ID: string;
  PORTAL_URL: string;
  SESSION_ENCRYPTION_KEY: string;
}

interface OAuthFlow {
  state: string;
  code_verifier: string;
  expires_at: number;
}

interface BrokerSession {
  access_token: string;
  login: string;
  expires_at: number;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const cookieName = "__Host-refdatakit_oauth";
const textEncoder = new TextEncoder();
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateEntity = ajv.compile(entitySchema as AnySchema);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string, context: string): string {
  if (!isRecord(value) || typeof value[key] !== "string") {
    throw new HttpError(502, `${context} did not contain ${key}`);
  }
  return value[key];
}

function integerField(value: unknown, key: string, context: string): number {
  if (!isRecord(value) || typeof value[key] !== "number" || !Number.isInteger(value[key])) {
    throw new HttpError(502, `${context} did not contain a valid ${key}`);
  }
  return value[key];
}

function requireEnvironment(env: Environment): URL {
  const requiredValues = [
    env.GITHUB_BASE_BRANCH,
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    env.GITHUB_OWNER,
    env.GITHUB_REPOSITORY,
    env.GITHUB_REPOSITORY_ID,
    env.PORTAL_URL,
    env.SESSION_ENCRYPTION_KEY,
  ];
  if (requiredValues.some((value) => !value)) {
    throw new HttpError(500, "The contribution broker is not fully configured");
  }
  if (!/^[1-9]\d*$/.test(env.GITHUB_REPOSITORY_ID)) {
    throw new HttpError(500, "GITHUB_REPOSITORY_ID must be a positive numeric ID");
  }
  if (!/^[a-f0-9]{64}$/i.test(env.SESSION_ENCRYPTION_KEY)) {
    throw new HttpError(500, "SESSION_ENCRYPTION_KEY must be 32 bytes encoded as hexadecimal");
  }

  const portalUrl = new URL(env.PORTAL_URL);
  if (portalUrl.protocol !== "https:" && portalUrl.hostname !== "localhost") {
    throw new HttpError(500, "PORTAL_URL must use HTTPS");
  }
  return portalUrl;
}

function hexToBytes(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(secret),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(value: unknown, secret: string): Promise<string> {
  const key = await encryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(value)),
  );
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64Url(result);
}

async function unseal(value: string, secret: string): Promise<unknown> {
  try {
    const bytes = base64UrlToBytes(value);
    if (bytes.length <= 12) {
      throw new Error("Invalid encrypted value");
    }
    const key = await encryptionKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      bytes.slice(12),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    throw new HttpError(400, "The sign-in session is invalid or has expired");
  }
}

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1);
    }
  }
  return undefined;
}

function cookieHeader(value: string, maxAge: number): string {
  return `${cookieName}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookieHeader(): string {
  return `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function portalOrigin(portalUrl: URL): string {
  return portalUrl.origin;
}

function assertPortalOrigin(request: Request, portalUrl: URL): void {
  if (request.headers.get("Origin") !== portalOrigin(portalUrl)) {
    throw new HttpError(403, "Request origin is not allowed");
  }
}

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  });
}

function jsonResponse(
  body: unknown,
  status = 200,
  headers = new Headers(),
): Response {
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

async function githubRequest(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`https://api.github.com${path}`, { ...init, headers });
  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    throw new HttpError(502, `GitHub returned an invalid response (${response.status})`);
  }
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.message === "string"
      ? payload.message
      : "request failed";
    throw new HttpError(
      response.status === 401 || response.status === 403 ? 403 : 502,
      `GitHub API error (${response.status}): ${message}`,
    );
  }
  return payload;
}

function entityValidationErrors(): string[] {
  const errors = (validateEntity.errors ?? []).map((error: ErrorObject) => {
    const path = error.instancePath || "entity";
    return `${path} ${error.message ?? "is invalid"}`;
  });
  return errors;
}

function validateSubmission(entity: unknown): void {
  if (!validateEntity(entity)) {
    throw new HttpError(422, entityValidationErrors().join("; "));
  }
  if (!isRecord(entity) || entity.country_code !== "BD") {
    throw new HttpError(422, "The contribution portal currently accepts Bangladesh entities only");
  }
}

async function startOAuth(request: Request, env: Environment): Promise<Response> {
  const portalUrl = requireEnvironment(env);
  assertPortalOrigin(request, portalUrl);
  const form = await request.formData();
  const state = form.get("state");
  const verifier = form.get("code_verifier");
  if (
    typeof state !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    typeof verifier !== "string" ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
  ) {
    throw new HttpError(400, "Invalid OAuth state or PKCE verifier");
  }

  const challenge = bytesToBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(verifier))),
  );
  const callbackUrl = new URL("/oauth/callback", new URL(request.url).origin);
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("allow_signup", "true");

  const encryptedFlow = await seal({
    state,
    code_verifier: verifier,
    expires_at: Date.now() + 10 * 60 * 1000,
  } satisfies OAuthFlow, env.SESSION_ENCRYPTION_KEY);
  return new Response(null, {
    status: 303,
    headers: {
      "Location": authorizeUrl.toString(),
      "Set-Cookie": cookieHeader(encryptedFlow, 600),
      "Cache-Control": "no-store",
    },
  });
}

function portalRedirect(portalUrl: URL, values: Record<string, string>, clearCookie = true): Response {
  const destination = new URL(portalUrl);
  destination.hash = new URLSearchParams(values).toString();
  const headers = new Headers({ Location: destination.toString(), "Cache-Control": "no-store" });
  if (clearCookie) {
    headers.set("Set-Cookie", clearCookieHeader());
  }
  return new Response(null, { status: 303, headers });
}

async function finishOAuth(request: Request, env: Environment): Promise<Response> {
  const portalUrl = requireEnvironment(env);
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state") ?? "";
  if (requestUrl.searchParams.has("error")) {
    return portalRedirect(portalUrl, {
      oauth_error: "authorization_cancelled",
      state,
    });
  }

  const code = requestUrl.searchParams.get("code");
  const encryptedFlow = getCookie(request, cookieName);
  if (!code || !encryptedFlow) {
    return portalRedirect(portalUrl, { oauth_error: "invalid_callback", state });
  }

  const flow = await unseal(encryptedFlow, env.SESSION_ENCRYPTION_KEY);
  if (
    !isRecord(flow) ||
    typeof flow.state !== "string" ||
    typeof flow.code_verifier !== "string" ||
    typeof flow.expires_at !== "number" ||
    flow.state !== state ||
    flow.expires_at <= Date.now()
  ) {
    return portalRedirect(portalUrl, { oauth_error: "invalid_state", state });
  }

  const callbackUrl = new URL("/oauth/callback", requestUrl.origin);
  const tokenParameters = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: callbackUrl.toString(),
    code_verifier: flow.code_verifier,
    repository_id: env.GITHUB_REPOSITORY_ID,
  });
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParameters,
  });
  const tokenPayload: unknown = await tokenResponse.json();
  if (!tokenResponse.ok || !isRecord(tokenPayload) || typeof tokenPayload.access_token !== "string") {
    throw new HttpError(502, "GitHub token exchange failed");
  }

  const accessToken = tokenPayload.access_token;
  const user = await githubRequest("/user", accessToken);
  const login = stringField(user, "login", "GitHub user response");
  const repositoryPath = `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPOSITORY)}`;
  const repository = await githubRequest(repositoryPath, accessToken);
  if (integerField(repository, "id", "GitHub repository response") !== Number(env.GITHUB_REPOSITORY_ID)) {
    throw new HttpError(403, "The authorized GitHub App cannot access the configured repository");
  }

  const expiresIn = typeof tokenPayload.expires_in === "number" &&
      Number.isFinite(tokenPayload.expires_in) && tokenPayload.expires_in > 0
    ? Math.min(tokenPayload.expires_in, 60 * 60)
    : 60 * 60;
  const session = await seal({
    access_token: accessToken,
    login,
    expires_at: Date.now() + expiresIn * 1000,
  } satisfies BrokerSession, env.SESSION_ENCRYPTION_KEY);
  return portalRedirect(portalUrl, { session, state, login });
}

async function sessionForRequest(request: Request, env: Environment): Promise<BrokerSession> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Sign in with GitHub to submit a contribution");
  }
  const session = await unseal(authorization.slice("Bearer ".length), env.SESSION_ENCRYPTION_KEY);
  if (
    !isRecord(session) ||
    typeof session.access_token !== "string" ||
    typeof session.login !== "string" ||
    typeof session.expires_at !== "number" ||
    session.expires_at <= Date.now()
  ) {
    throw new HttpError(401, "Your GitHub session has expired; sign in again");
  }
  return {
    access_token: session.access_token,
    login: session.login,
    expires_at: session.expires_at,
  };
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function createContribution(request: Request, env: Environment): Promise<Response> {
  const portalUrl = requireEnvironment(env);
  assertPortalOrigin(request, portalUrl);
  const headers = corsHeaders(portalOrigin(portalUrl));
  const session = await sessionForRequest(request, env);
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > 64 * 1024) {
    throw new HttpError(413, "Contribution must be smaller than 64 KiB");
  }
  const requestText = await request.text();
  if (new TextEncoder().encode(requestText).length > 64 * 1024) {
    throw new HttpError(413, "Contribution must be smaller than 64 KiB");
  }

  let body: unknown;
  try {
    body = JSON.parse(requestText) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  if (!isRecord(body) || (body.kind !== "addition" && body.kind !== "correction")) {
    throw new HttpError(400, "Contribution must specify addition or correction");
  }
  const entity = body.entity;
  if (!("entity" in body)) {
    throw new HttpError(400, "Contribution entity is required");
  }
  validateSubmission(entity);

  const repositoryPath = `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPOSITORY)}`;
  const baseReference = await githubRequest(
    `${repositoryPath}/git/ref/heads/${encodeURIComponent(env.GITHUB_BASE_BRANCH)}`,
    session.access_token,
  );
  const baseSha = stringField(
    isRecord(baseReference) ? baseReference.object : undefined,
    "sha",
    "GitHub base reference",
  );
  const branchName = `contributions/${body.kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await githubRequest(`${repositoryPath}/git/refs`, session.access_token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
  });

  const filename = `${body.kind}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.json`;
  const contributionPath = `datasets/contributions/BD/${filename}`;
  const content = base64Encode(textEncoder.encode(canonicalJson(entity)));
  const encodedPath = contributionPath.split("/").map(encodeURIComponent).join("/");
  await githubRequest(`${repositoryPath}/contents/${encodedPath}`, session.access_token, {
    method: "PUT",
    body: JSON.stringify({
      message: `Add ${body.kind} contribution`,
      content,
      branch: branchName,
    }),
  });

  const titlePrefix = body.kind === "addition" ? "Add" : "Correct";
  const pullRequest = await githubRequest(`${repositoryPath}/pulls`, session.access_token, {
    method: "POST",
    body: JSON.stringify({
      title: `${titlePrefix} Bangladesh directory entry`,
      body: "Automated community submission. This record remains quarantined for maintainer review.",
      head: `${env.GITHUB_OWNER}:${branchName}`,
      base: env.GITHUB_BASE_BRANCH,
      maintainer_can_modify: true,
    }),
  });

  return jsonResponse({
    html_url: stringField(pullRequest, "html_url", "GitHub pull request response"),
    branch: branchName,
  }, 201, headers);
}

function errorResponse(error: unknown, origin?: string): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError && error.status < 500
    ? error.message
    : "The request could not be completed";
  const headers = origin ? corsHeaders(origin) : new Headers();
  return jsonResponse({ error: message }, status, headers);
}

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const requestUrl = new URL(request.url);
    const requestOrigin = request.headers.get("Origin");
    let allowedOrigin: string | undefined;
    try {
      allowedOrigin = new URL(env.PORTAL_URL).origin;
    } catch {
      allowedOrigin = undefined;
    }
    try {
      const portalUrl = requireEnvironment(env);

      if (requestUrl.pathname === "/health" && request.method === "GET") {
        return jsonResponse({ ok: true });
      }

      if (requestUrl.pathname === "/oauth/start" && request.method === "POST") {
        return await startOAuth(request, env);
      }
      if (requestUrl.pathname === "/oauth/callback" && request.method === "GET") {
        try {
          return await finishOAuth(request, env);
        } catch (error) {
          return portalRedirect(portalUrl, {
            oauth_error: "token_exchange_failed",
            state: requestUrl.searchParams.get("state") ?? "",
          });
        }
      }

      if (requestUrl.pathname === "/api/contributions") {
        if (request.method === "OPTIONS") {
          assertPortalOrigin(request, portalUrl);
          return new Response(null, {
            status: 204,
            headers: corsHeaders(portalOrigin(portalUrl)),
          });
        }
        if (request.method !== "POST") {
          throw new HttpError(405, "Method not allowed");
        }
        return await createContribution(request, env);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      const origin = requestUrl.pathname.startsWith("/api/") && requestOrigin === allowedOrigin
        ? requestOrigin
        : undefined;
      return errorResponse(error, origin);
    }
  },
};
