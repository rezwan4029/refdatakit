import type { Entity } from "./entity.js";

const brokerUrl = import.meta.env.VITE_AUTH_BROKER_URL?.replace(/\/+$/, "");
const stateStorageKey = "refdatakit.oauth.state";

type OAuthReturn =
  | { status: "authenticated"; session: string; login: string }
  | { status: "error"; message: string }
  | null;

interface ContributionResponse {
  html_url: string;
  branch: string;
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function requiredBrokerUrl(): string {
  if (!brokerUrl) {
    throw new Error("The contribution broker has not been configured");
  }
  return brokerUrl;
}

export function consumeOAuthReturn(): OAuthReturn {
  if (!window.location.hash) {
    return null;
  }

  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const expectedState = sessionStorage.getItem(stateStorageKey);
  const receivedState = parameters.get("state");
  sessionStorage.removeItem(stateStorageKey);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

  if (!expectedState || receivedState !== expectedState) {
    return { status: "error", message: "GitHub sign-in could not be verified. Please try again." };
  }

  const error = parameters.get("oauth_error");
  if (error) {
    return { status: "error", message: "GitHub sign-in was not completed." };
  }

  const session = parameters.get("session");
  const login = parameters.get("login");
  if (!session || !login) {
    return { status: "error", message: "GitHub sign-in did not return a valid session." };
  }
  return { status: "authenticated", session, login };
}

export function startGitHubLogin(): void {
  const state = randomBase64Url(32);
  const verifier = randomBase64Url(32);
  sessionStorage.setItem(stateStorageKey, state);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${requiredBrokerUrl()}/oauth/start`;
  form.hidden = true;
  for (const [name, value] of [["state", state], ["code_verifier", verifier]]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

export async function submitContribution(
  session: string,
  kind: "addition" | "correction",
  entity: Entity,
): Promise<ContributionResponse> {
  const response = await fetch(`${requiredBrokerUrl()}/api/contributions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind, entity }),
  });

  const result: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === "string"
      ? result.error
      : "The contribution could not be submitted.";
    throw new Error(message);
  }
  if (!isRecord(result) || typeof result.html_url !== "string" || typeof result.branch !== "string") {
    throw new Error("The contribution broker returned an invalid response.");
  }
  return { html_url: result.html_url, branch: result.branch };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
