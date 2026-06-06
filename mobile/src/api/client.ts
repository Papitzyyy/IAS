/**
 * api/client.ts
 * -------------
 * Authenticated API client for the CRCY Scan and Help backend.
 * The server IP is configurable at runtime via the in-app settings button,
 * so you never need to rebuild the APK when changing Wi-Fi networks.
 */

import * as SecureStore from "expo-secure-store";

// ── Storage Keys ─────────────────────────────────────────────────────────────
export const TOKEN_KEY = "access_token";
export const ROLE_KEY = "user_role";
export const SERVER_KEY = "backend_server";

// ── Default server address (used when nothing is saved yet) ──────────────────
const API_BASE = "https://ias-online.onrender.com/api/v1";

/** Build the full API base URL from the stored server IP */
async function getApiBase(): Promise<string> {
  try {
    const savedServer = await SecureStore.getItemAsync(SERVER_KEY);
    if (savedServer) {
      const trimmed = savedServer.trim();
      if (!trimmed) return API_BASE;
      // If it's a raw IP/domain, add protocol and path
      if (!trimmed.startsWith("http")) {
        return `https://${trimmed}/api/v1`;
      }
      return trimmed.endsWith("/") ? `${trimmed}api/v1` : `${trimmed}/api/v1`;
    }
  } catch {
    return API_BASE;
  }
  return API_BASE;
}

export async function saveServer(server: string): Promise<void> {
  await SecureStore.setItemAsync(SERVER_KEY, server);
}

export async function getServer(): Promise<string | null> {
  return SecureStore.getItemAsync(SERVER_KEY);
}

// ── Token helpers ────────────────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string, role: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(ROLE_KEY, role);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROLE_KEY);
}

// ── API fetch ────────────────────────────────────────────────────────────────
interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: object;
  authenticated?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, authenticated = true } = options;
  const apiBase = await getApiBase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authenticated) {
    const token = await getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Safely parse JSON — if the server returns HTML/plain-text (e.g. 500 crash page),
  // we fall back gracefully instead of throwing a confusing parse error.
  let data: any = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    // Server returned non-JSON (HTML error page, etc.) — skip parsing
    data = null;
  }

  if (!response.ok) {
    // If session expired, silently clear the stored token
    if (response.status === 401 && authenticated) {
      await clearToken();
    }

    const message =
      typeof data?.detail === "string"
        ? data.detail
        : response.status === 500
        ? "Server error. Please try again later."
        : response.status === 429
        ? data?.detail ?? "Too many attempts. Please wait before trying again."
        : "Request failed. Check your connection.";
    throw new Error(message);
  }

  return data as T;
}
