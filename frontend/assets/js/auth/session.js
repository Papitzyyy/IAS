/**
 * auth/session.js
 * ---------------
 * Included on every protected page.
 * - Redirects to login if no token is present.
 * - Fetches current user info and caches permissions in localStorage.
 * - Logout is handled by sidebar.js (btn-logout rendered inside the sidebar).
 */

var token = localStorage.getItem("access_token");
if (!token) {
  window.location.href = "login.html";
}

// Responders are mobile-only — block web portal access entirely
var _cachedRole = localStorage.getItem("role");
if (_cachedRole === "responder") {
  localStorage.clear();
  window.location.href = "login.html?error=responder_web_blocked";
}

// Fetch current user info and cache role + permissions
function fetchAndCacheUserInfo() {
  apiFetch("GET", "/responders/me-info", null, function (res) {
    if (res) {
      localStorage.setItem("role", res.role || "");
      localStorage.setItem("email", res.email || "");
      localStorage.setItem("name", res.full_name || "");
      var perms = JSON.stringify(res.permissions || {});
      localStorage.setItem("permissions", perms);

      // Trigger custom event so other scripts can update UI based on new perms
      window.dispatchEvent(new CustomEvent("userInfoCached", { detail: res }));
    }
  }, function (err) {
    console.error("Failed to fetch user info:", err);
  });
}

// Fetch user info on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", fetchAndCacheUserInfo);
} else {
  fetchAndCacheUserInfo();
}

