/**
 * app.js — shared utilities for all protected pages.
 *
 * Provides:
 *  - API_BASE constant
 *  - apiFetch() — authenticated fetch wrapper
 *  - apiErrorMessage() — extract readable error from API response
 *  - showEl / hideEl / showError / clearError — DOM helpers
 *  - buildTable / emptyState — table rendering helpers
 *
 * Auth guard and logout are handled by auth/session.js (loaded separately).
 */

var API_BASE = "/api/v1";

document.addEventListener("DOMContentLoaded", function () {
  // Show "logged out" toast when redirected back from logout
  var params = new URLSearchParams(window.location.search);
  if (params.get("logged_out") === "1" && typeof showToast === "function") {
    showToast("You have been logged out.", "info");
    window.history.replaceState({}, "", window.location.pathname);
  }
});

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function apiErrorMessage(data, fallback) {
  if (!data) return fallback || "Request failed.";
  if (data instanceof Error) return data.message || fallback || "Request failed.";
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map(function (e) {
        return e.msg || (e.loc ? e.loc.join(".") + ": " + e.msg : String(e));
      })
      .join(" ");
  }
  if (typeof data === "object") {
    return JSON.stringify(data);
  }
  return fallback || "Request failed.";
}

function apiFetch(method, path, body, onSuccess, onError) {
  var token = localStorage.getItem("access_token");
  var opts = {
    method: method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  fetch(API_BASE + path, opts)
    .then(function (r) {
      if (r.status === 401) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
      }

      var contentType = r.headers.get("Content-Type") || "";
      if (contentType.indexOf("application/json") >= 0) {
        return r.json().then(function (d) {
          return { ok: r.ok, status: r.status, data: d };
        });
      }

      return r.text().then(function (text) {
        var data = text;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (err) {
          data = text || null;
        }
        return { ok: r.ok, status: r.status, data: data };
      });
    })
    .then(function (r) {
      if (!r) return;
      if (r.ok) {
        if (onSuccess) onSuccess(r.data);
      } else {
        if (onError) onError(r.data, r.status);
      }
    })
    .catch(function (e) {
      if (onError) onError(e);
    });
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function showEl(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = "block";
}

function hideEl(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function showError(id, msg) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}

function clearError(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = "";
  el.style.display = "none";
}

// ---------------------------------------------------------------------------
// Table / empty state builders
// ---------------------------------------------------------------------------

function buildTable(headers, rows) {
  var ths = headers
    .map(function (h) { return "<th>" + h + "</th>"; })
    .join("");
  return (
    '<div class="table-wrap">' +
    '<table class="data-table">' +
    "<thead><tr>" + ths + "</tr></thead>" +
    "<tbody>" + rows.join("") + "</tbody>" +
    "</table></div>"
  );
}

function emptyState(message, linkHref, linkText) {
  var link = linkHref
    ? '<a href="' + linkHref + '" style="color:var(--blue);font-size:0.78rem;margin-top:6px;display:inline-block;">' + linkText + "</a>"
    : "";
  return (
    '<div class="table-wrap"><div class="empty-state">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
    "<p>" + message + "</p>" + link +
    "</div></div>"
  );
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function escapeHTML(str) {
  if (!str) return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var date = new Date(dateStr);
  return date.toLocaleDateString();
}



// Global Auto-Refresh Mechanism
setInterval(function() {
  if (typeof refreshData === 'function') {
    refreshData();
  }
}, 10000);
