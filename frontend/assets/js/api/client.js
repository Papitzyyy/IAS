/**
 * api/client.js
 * -------------
 * Central API client for all backend requests.
 * Automatically attaches the JWT from sessionStorage to every request.
 * Redirects to login on 401 responses.
 */

const BASE_URL = "/api/v1";

/**
 * Make an authenticated request to the backend API.
 * @param {string} path - API path (e.g. "/students")
 * @param {RequestInit} options - fetch options
 * @returns {Promise<any>} parsed JSON response
 */
export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/pages/login.html";
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

