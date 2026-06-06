/**
 * audit/audit.js
 * --------------
 * Audit log viewer with pagination and action filtering.
 * Depends on: app.js (apiFetch, buildTable, emptyState)
 */

var _currentPage = 1;
var PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Badge styling
// ---------------------------------------------------------------------------

function auditBadgeClass(action) {
  if (action.indexOf("failure") >= 0 || action.indexOf("invalid") >= 0 || action === "unauthorized_request")
    return "badge badge-red";
  if (action === "login_success" || action === "qr_scan")
    return "badge badge-green";
  if (action.indexOf("created") >= 0 || action.indexOf("deactivated") >= 0 || action === "session_revoked")
    return "badge badge-blue";
  if (action === "student_deleted" || action === "staff_deleted" || action === "student_archived" || action === "staff_archived")
    return "badge badge-red";
  if (action === "student_restored" || action === "responder_restored" || action === "staff_restored")
    return "badge badge-green";
  if (action.indexOf("updated") >= 0 || action === "student_archived")
    return "badge badge-amber";
  return "badge badge-gray";
}

// ---------------------------------------------------------------------------
// Load logs
// ---------------------------------------------------------------------------

function loadAuditLogs(page) {
  _currentPage = page || 1;
  var action = document.getElementById("filter-action").value;
  var path = "/audit?page=" + _currentPage + "&page_size=" + PAGE_SIZE;
  if (action) path += "&action=" + action;

  apiFetch("GET", path, null, function (data) {
    document.getElementById("log-count").textContent =
      data.total + " event" + (data.total !== 1 ? "s" : "");

    var container = document.getElementById("table-container");
    if (!data.results.length) {
      container.innerHTML = emptyState("No log entries found.");
      document.getElementById("pagination").innerHTML = "";
      return;
    }

    var rows = data.results.map(function (log) {
      return (
        "<tr>" +
        '<td class="muted" style="white-space:nowrap;font-size:0.75rem;">' +
          new Date(log.created_at).toLocaleString() + "</td>" +
        '<td><span class="' + auditBadgeClass(log.action) + '">' +
          log.action.replace(/_/g, " ") + "</span></td>" +
        '<td class="muted" style="font-family:monospace;font-size:0.75rem;">' + (log.ip_address || "—") + "</td>" +
        '<td class="muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
          escapeHTML(log.detail || "") + '">' + escapeHTML(log.detail || "—") + "</td></tr>"
      );
    });
    container.innerHTML = buildTable(["Timestamp", "Action", "IP", "Detail"], rows);

    renderPagination(data.total);
  }, function (d, status) {
    var container = document.getElementById("table-container");
    // d may be an API error body, a JS Error, or undefined
    var msg;
    if (status === 403) {
      msg = "You do not have permission to view audit logs.";
    } else if (d instanceof Error) {
      msg = "Network error: " + d.message;
      console.error("[audit] fetch error:", d);
    } else {
      msg = apiErrorMessage(d, "Failed to load audit logs. Check the browser console for details.");
      console.error("[audit] API error", status, d);
    }
    container.innerHTML =
      '<div class="table-wrap"><div class="empty-state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      "<p>" + escapeHTML(msg) + "</p>" +
      "</div></div>";
    document.getElementById("pagination").innerHTML = "";
    document.getElementById("log-count").textContent = "";
  });
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

function renderPagination(total) {
  var totalPages = Math.ceil(total / PAGE_SIZE);
  var pag = document.getElementById("pagination");
  pag.innerHTML = "";
  if (totalPages <= 1) return;

  var start = (_currentPage - 1) * PAGE_SIZE + 1;
  var end   = Math.min(_currentPage * PAGE_SIZE, total);

  // "1–50 of N" info label
  var info = document.createElement("span");
  info.style.cssText = "font-size:0.75rem;color:var(--text-muted);margin-right:8px;align-self:center;";
  info.textContent = start + "–" + end + " of " + total;
  pag.appendChild(info);

  // Prev button
  var prev = document.createElement("button");
  prev.className = "page-btn";
  prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="15 18 9 12 15 6"/></svg>';
  prev.disabled = _currentPage === 1;
  prev.setAttribute("aria-label", "Previous page");
  prev.onclick = function () { loadAuditLogs(_currentPage - 1); };
  pag.appendChild(prev);

  // Windowed page numbers (±2 from current, with ellipsis)
  var delta = 2;
  var range = [];
  for (var i = Math.max(1, _currentPage - delta); i <= Math.min(totalPages, _currentPage + delta); i++) {
    range.push(i);
  }

  function addPageBtn(pg) {
    var btn = document.createElement("button");
    btn.textContent = pg;
    btn.className = "page-btn" + (pg === _currentPage ? " active" : "");
    btn.setAttribute("aria-label", "Page " + pg);
    btn.setAttribute("aria-current", pg === _currentPage ? "page" : "false");
    btn.onclick = function () { loadAuditLogs(pg); };
    pag.appendChild(btn);
  }

  function addEllipsis() {
    var dots = document.createElement("span");
    dots.textContent = "…";
    dots.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;";
    pag.appendChild(dots);
  }

  if (range[0] > 1) {
    addPageBtn(1);
    if (range[0] > 2) addEllipsis();
  }
  range.forEach(addPageBtn);
  if (range[range.length - 1] < totalPages) {
    if (range[range.length - 1] < totalPages - 1) addEllipsis();
    addPageBtn(totalPages);
  }

  // Next button
  var next = document.createElement("button");
  next.className = "page-btn";
  next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="9 18 15 12 9 6"/></svg>';
  next.disabled = _currentPage === totalPages;
  next.setAttribute("aria-label", "Next page");
  next.onclick = function () { loadAuditLogs(_currentPage + 1); };
  pag.appendChild(next);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("btn-filter").onclick = function () { loadAuditLogs(1); };
  document.getElementById("filter-action").onchange = function () { loadAuditLogs(1); };
  loadAuditLogs(1);
});

// Auto-refresh
function refreshData() {
  loadAuditLogs(_currentPage);
}
