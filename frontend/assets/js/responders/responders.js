/**
 * responders/responders.js
 * ------------------------
 * Full CRUD: list, create, edit, revoke, restore.
 * Search + status filter + pagination (10 per page).
 */

var _allResponders = [];
var _editingId = null;
var _responderPage = 1;
var RESP_PAGE_SIZE = 10;
var _respSearch = "";
var _respStatusFilter = "";

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

function hasResponderWrite() {
  var role = localStorage.getItem("role") || "";
  if (role === "admin") return true;
  try {
    var p = JSON.parse(localStorage.getItem("permissions") || "{}");
    return (p["responders"] || []).indexOf("write") >= 0;
  } catch (e) { return false; }
}

function updateResponderPageAccess() {
  var canWrite = hasResponderWrite();
  var addBtn = document.getElementById("btn-add");
  if (!addBtn) return;
  if (!canWrite) {
    addBtn.disabled = true;
    addBtn.title = "You do not have write access to the Responders module.";
    addBtn.style.opacity = "0.6";
    addBtn.style.cursor = "not-allowed";
  } else {
    addBtn.disabled = false;
    addBtn.title = "";
    addBtn.style.opacity = "";
    addBtn.style.cursor = "";
  }
}

// ---------------------------------------------------------------------------
// Load & render
// ---------------------------------------------------------------------------

function loadResponders() {
  apiFetch("GET", "/responders", null, function (data) {
    _allResponders = data || [];
    _responderPage = 1;
    renderResponders();
  }, function (d) {
    showToast(apiErrorMessage(d, "Failed to load responders."), "error");
  });
}

function renderResponders() {
  var container = document.getElementById("table-container");
  var list = _allResponders;

  // Search
  if (_respSearch) {
    var q = _respSearch.toLowerCase();
    list = list.filter(function (r) {
      return (r.full_name || "").toLowerCase().indexOf(q) >= 0 ||
             (r.email    || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  // Status filter
  if (_respStatusFilter === "active")  list = list.filter(function (r) { return r.is_active; });
  if (_respStatusFilter === "revoked") list = list.filter(function (r) { return !r.is_active; });

  // Count
  var countEl = document.getElementById("responder-count");
  if (countEl) countEl.textContent = list.length ? list.length + " responder" + (list.length !== 1 ? "s" : "") : "";

  if (!list.length) {
    container.innerHTML = emptyState(
      (_respSearch || _respStatusFilter) ? "No responders match your filters." : "No responder accounts yet."
    );
    document.getElementById("responder-pagination").innerHTML = "";
    return;
  }

  // Pagination
  var totalPages = Math.ceil(list.length / RESP_PAGE_SIZE);
  if (_responderPage > totalPages) _responderPage = 1;
  var start = (_responderPage - 1) * RESP_PAGE_SIZE;
  var pageItems = list.slice(start, start + RESP_PAGE_SIZE);

  var canWrite = hasResponderWrite();

  var rows = pageItems.map(function (r) {
    var statusBadge = !r.is_verified
      ? '<span class="badge badge-amber">Pending Verification</span>'
      : (r.is_active
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-red">Revoked</span>');

    var created = new Date(r.created_at).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric"
    });

    var safeName = escapeHTML(r.full_name || "");
    var safeId   = escapeHTML(r.id);

    var actions = "";
    var role = localStorage.getItem("role") || "";
    var isAdmin = role === "admin";

    if (canWrite) {
      actions +=
        '<button onclick="openEditResponder(\'' + safeId + '\')" ' +
        'class="btn btn-ghost btn-sm" style="margin-right:6px;" title="Edit">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        ' Edit</button>';

      if (isAdmin) {
        if (r.is_active) {
          actions +=
            '<button onclick="revokeResponder(\'' + safeId + '\',\'' + safeName + '\')" ' +
            'class="btn btn-danger btn-sm" title="Kill Switch">Kill Switch</button>';
        } else {
          actions +=
            '<button onclick="restoreResponder(\'' + safeId + '\',\'' + safeName + '\')" ' +
            'class="btn btn-success btn-sm" title="Restore">Restore</button>';
        }
      }
    } else {
      actions = '<span style="font-size:0.72rem;color:var(--text-muted);">Read-only</span>';
    }

    return (
      "<tr>" +
      "<td>" +
        '<p style="font-weight:600;font-size:0.82rem;">' + safeName + "</p>" +
        '<p style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + escapeHTML(r.email || "") + "</p>" +
      "</td>" +
      '<td class="muted" style="font-size:0.78rem;">' + created + "</td>" +
      "<td>" + statusBadge + "</td>" +
      '<td style="white-space:nowrap;">' + actions + "</td>" +
      "</tr>"
    );
  });

  container.innerHTML = buildTable(["Name / Email", "Created", "Status", "Actions"], rows);
  // Constrain column widths so Actions doesn't stretch
  var table = container.querySelector(".data-table");
  if (table) {
    var ths = table.querySelectorAll("thead th");
    var widths = ["", "130px", "100px", "1px"];
    widths.forEach(function (w, i) { if (ths[i] && w) ths[i].style.width = w; });
  }
  renderResponderPagination(totalPages, list.length);
}

function renderResponderPagination(totalPages, total) {
  var pag = document.getElementById("responder-pagination");
  if (!pag) return;
  pag.innerHTML = "";
  if (totalPages <= 1) return;

  var start = (_responderPage - 1) * RESP_PAGE_SIZE + 1;
  var end   = Math.min(_responderPage * RESP_PAGE_SIZE, total);

  var info = document.createElement("span");
  info.style.cssText = "font-size:0.75rem;color:var(--text-muted);margin-right:8px;align-self:center;";
  info.textContent = start + "–" + end + " of " + total;
  pag.appendChild(info);

  function addBtn(pg, label, disabled) {
    var btn = document.createElement("button");
    btn.className = "page-btn" + (pg === _responderPage && !label ? " active" : "");
    btn.innerHTML = label || String(pg);
    btn.disabled = !!disabled;
    if (label) btn.setAttribute("aria-label", label === "&#8249;" ? "Previous page" : "Next page");
    else { btn.setAttribute("aria-label", "Page " + pg); btn.setAttribute("aria-current", pg === _responderPage ? "page" : "false"); }
    btn.onclick = function () { _responderPage = pg; renderResponders(); };
    pag.appendChild(btn);
  }

  addBtn(_responderPage - 1,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="15 18 9 12 15 6"/></svg>',
    _responderPage === 1);

  var delta = 2;
  var range = [];
  for (var i = Math.max(1, _responderPage - delta); i <= Math.min(totalPages, _responderPage + delta); i++) range.push(i);

  if (range[0] > 1) {
    addBtn(1);
    if (range[0] > 2) { var d1 = document.createElement("span"); d1.textContent = "…"; d1.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(d1); }
  }
  range.forEach(function (pg) { addBtn(pg); });
  if (range[range.length - 1] < totalPages) {
    if (range[range.length - 1] < totalPages - 1) { var d2 = document.createElement("span"); d2.textContent = "…"; d2.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(d2); }
    addBtn(totalPages);
  }

  addBtn(_responderPage + 1,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="9 18 15 12 9 6"/></svg>',
    _responderPage === totalPages);
}

// ---------------------------------------------------------------------------
// Revoke / Restore
// ---------------------------------------------------------------------------

function revokeResponder(id, name) {
  showConfirm({
    title: "Revoke responder?",
    message: name + " will be logged out immediately. Use this if their device is lost or stolen.",
    confirmLabel: "Revoke",
    danger: true,
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/responders/" + id + "/revoke", null,
      function () { showToast(name + " has been revoked.", "success"); loadResponders(); },
      function (d) { showToast(apiErrorMessage(d, "Failed to revoke."), "error"); }
    );
  });
}

function restoreResponder(id, name) {
  showConfirm({
    title: "Restore responder?",
    message: "Restore " + name + "'s account? They will be able to log in again.",
    confirmLabel: "Restore",
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/responders/" + id + "/restore", null,
      function () { showToast(name + " has been restored.", "success"); loadResponders(); },
      function (d) { showToast(apiErrorMessage(d, "Failed to restore."), "error"); }
    );
  });
}

// ---------------------------------------------------------------------------
// Modal — Add & Edit
// ---------------------------------------------------------------------------

function openAddResponder() {
  _editingId = null;
  document.getElementById("r-modal-title").textContent = "Add Responder Account";
  document.getElementById("btn-save-responder").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Create Account';
  document.getElementById("f-first").value     = "";
  document.getElementById("f-middle").value    = "";
  document.getElementById("f-last").value      = "";
  document.getElementById("f-email").value    = "";
  document.getElementById("f-password").value = "";
  document.getElementById("pw-req").style.display = "";
  document.getElementById("pw-hint").style.display = "";
  document.getElementById("pw-edit-hint").style.display = "none";
  document.getElementById("modal-error").style.display = "none";
  document.getElementById("btn-save-responder").disabled = false;
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(function () { document.getElementById("f-first").focus(); }, 100);
}

function openEditResponder(id) {
  var r = _allResponders.find(function (x) { return x.id === id; });
  if (!r) return;
  _editingId = id;
  document.getElementById("r-modal-title").textContent = "Edit Responder";
  document.getElementById("btn-save-responder").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Changes';
  document.getElementById("f-first").value     = r.first_name || "";
  document.getElementById("f-middle").value    = r.middle_name || "";
  document.getElementById("f-last").value      = r.last_name || "";
  document.getElementById("f-email").value    = r.email || "";
  document.getElementById("f-password").value = "";
  document.getElementById("pw-req").style.display = "none";
  document.getElementById("pw-hint").style.display = "none";
  document.getElementById("pw-edit-hint").style.display = "";
  document.getElementById("modal-error").style.display = "none";
  document.getElementById("btn-save-responder").disabled = false;
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(function () { document.getElementById("f-first").focus(); }, 100);
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  _editingId = null;
}

function saveResponder() {
  var first_name = document.getElementById("f-first").value.trim();
  var middle_name = document.getElementById("f-middle").value.trim();
  var last_name = document.getElementById("f-last").value.trim();
  var email    = document.getElementById("f-email").value.trim();
  var password = document.getElementById("f-password").value;
  var errEl    = document.getElementById("modal-error");

  errEl.style.display = "none";

  if (!first_name || !last_name || !email) {
    errEl.textContent = "First name, last name, and email are required.";
    errEl.style.display = "block"; return;
  }
  if (!isEvsuEmail(email)) {
    errEl.textContent = "Email must be a valid @evsu.edu.ph address.";
    errEl.style.display = "block"; return;
  }

  // Password required on create, optional on edit
  if (!_editingId && !password) {
    errEl.textContent = "Password is required.";
    errEl.style.display = "block"; return;
  }
  if (password) {
    var pwErrors = validatePasswordStrength(password);
    if (pwErrors.length) {
      errEl.textContent = "Password too weak: " + pwErrors[0];
      errEl.style.display = "block"; return;
    }
  }

  var saveBtn = document.getElementById("btn-save-responder");
  saveBtn.disabled = true;

  if (_editingId) {
    // Edit — only send changed fields
    var body = { first_name: first_name, middle_name: middle_name, last_name: last_name, email: email };
    if (password) body.password = password;

    apiFetch("PUT", "/responders/" + _editingId, body,
      function () {
        closeModal();
        showToast("Responder updated.", "success");
        loadResponders();
      },
      function (d) {
        errEl.textContent = apiErrorMessage(d, "Update failed.");
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    );
  } else {
    // Create
    apiFetch("POST", "/responders", { first_name: first_name, middle_name: middle_name, last_name: last_name, email: email, password: password },
      function () {
        closeModal();
        showToast("Responder account created.", "success");
        loadResponders();
      },
      function (d) {
        errEl.textContent = apiErrorMessage(d, "Failed to create account.");
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("btn-add").onclick = openAddResponder;

  // Close on backdrop click
  document.getElementById("modal-overlay").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
  });

  // Password visibility toggle
  document.getElementById("pw-toggle").addEventListener("click", function () {
    var inp = document.getElementById("f-password");
    var isText = inp.type === "text";
    inp.type = isText ? "password" : "text";
    document.getElementById("pw-eye").innerHTML = isText
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  });

  // Search
  document.getElementById("responder-search").addEventListener("input", function () {
    _respSearch = this.value.trim();
    _responderPage = 1;
    renderResponders();
  });

  // Status filter
  var statusSel = document.getElementById("responder-status-filter");
  statusSel.addEventListener("change", function () {
    _respStatusFilter = this.value;
    _responderPage = 1;
    renderResponders();
  });
  statusSel.addEventListener("focus", function () {
    this.style.borderColor = "var(--brand)";
    this.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.1)";
  });
  statusSel.addEventListener("blur", function () {
    this.style.borderColor = "var(--border)";
    this.style.boxShadow = "";
  });

  // Enter key submits modal
  ["f-first", "f-middle", "f-last", "f-email", "f-password"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("keydown", function (e) { if (e.key === "Enter") saveResponder(); });
  });

  // Listen for permission updates
  window.addEventListener("userInfoCached", function () {
    updateResponderPageAccess();
    renderResponders();
  });

  updateResponderPageAccess();
  loadResponders();
});


// Auto-refresh
function refreshData() {
  var m = document.getElementById('modal-overlay');
  if (m && m.classList.contains('open')) return;
  loadResponders();
}
