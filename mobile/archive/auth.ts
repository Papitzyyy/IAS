/**
 * utils/auth.ts
 * -------------
 * Authentication helper functions for the mobile app.
 */

import { apiRequest } from '../api/client';

export async function initiateLogin(email: string, password: string): Promise<void> {
  await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyOtp(
  email: string,
  otp: string,
): Promise<{ access_token: string; token_type: string; role: string }> {
  return apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}
