import { apiFetch, saveToken, clearToken } from "./client";

export interface LoginResponse {
  message: string;
  attempt_id?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export interface MeResponse {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password, source: "mobile" },
    authenticated: false,
  });
}

export async function checkAuthStatus(attempt_id: string): Promise<{ is_authorized: boolean }> {
  return apiFetch<{ is_authorized: boolean }>(`/auth/login-status/${attempt_id}`, {
    method: "GET",
    authenticated: false,
  });
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<TokenResponse> {
  const res = await apiFetch<TokenResponse>("/auth/verify-otp", {
    method: "POST",
    body: { email, otp },
    authenticated: false,
  });
  await saveToken(res.access_token, res.role);
  return res;
}

export async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/responders/me-info");
}

export async function logout(): Promise<void> {
  await clearToken();
}
