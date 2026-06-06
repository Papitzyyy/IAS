/**
 * staff/staff.js
 * --------------
 * Clinic staff management: list, create, archive, restore, permissions.
 * Search + status filter + pagination (10 per page).
 * Uses apiFetch() from app.js — consistent with the rest of the system.
 */

var _staffList = [];
var _staffPage = 1;
var STAFF_PAGE_SIZE = 10;
var _staffSearch = "";
var _staffStatusFilter = "";

// ---------------------------------------------------------------------------
// Load & render
// ---------------------------------------------------------------------------

function loadStaff() {
  apiFetch("GET", "/staff", null, function (data) {
    _staffList = data || [];
    _staffPage = 1;
    renderStaff();
  }, function (d) {
    var msg = apiErrorMessage(d, "Failed to load staff accounts.");
    document.getElementById("table-container").innerHTML =
      '<div class="table-wrap"><div class="empty-state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      "<p>" + escapeHTML(msg) + "</p></div></div>";
  });
}

function renderStaff() {
  var container = document.getElementById("table-container");
  var list = _staffList;

  // Search
  if (_staffSearch) {
    var q = _staffSearch.toLowerCase();
    list = list.filter(function (s) {
      return (s.full_name || "").toLowerCase().indexOf(q) >= 0 ||
             (s.email    || "").toLowerCase().indexOf(q) >= 0;
    });
  }

  // Status filter
  if (_staffStatusFilter === "active")   list = list.filter(function (s) { return s.is_active; });
  if (_staffStatusFilter === "archived") list = list.filter(function (s) { return !s.is_active; });

  // Count label
  var countEl = document.getElementById("staff-count");
  if (countEl) countEl.textContent = list.length ? list.length + " staff member" + (list.length !== 1 ? "s" : "") : "";

  if (!list.length) {
    container.innerHTML = emptyState(
      (_staffSearch || _staffStatusFilter) ? "No staff accounts match your filters." : "No staff accounts yet."
    );
    document.getElementById("staff-pagination").innerHTML = "";
    return;
  }

  // Pagination
  var totalPages = Math.ceil(list.length / STAFF_PAGE_SIZE);
  if (_staffPage > totalPages) _staffPage = 1;
  var start = (_staffPage - 1) * STAFF_PAGE_SIZE;
  var pageItems = list.slice(start, start + STAFF_PAGE_SIZE);

  var rows = pageItems.map(function (s) {
    var isArchived = !s.is_active;
    var statusBadge = !s.is_verified
      ? '<span class="badge badge-amber">Pending Verification</span>'
      : (isArchived ? '<span class="badge badge-gray">Archived</span>' : '<span class="badge badge-green">Active</span>');

    var created = new Date(s.created_at).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric"
    });

    var safeId   = escapeHTML(s.id);
    var safeName = escapeHTML(s.full_name || "");

    var actions =
      '<button onclick="openEditStaff(\'' + safeId + '\')" class="btn btn-ghost btn-sm" style="margin-right:6px;" title="Edit">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      ' Edit</button>' +
      '<button onclick="openPermModal(\'' + safeId + '\')" class="btn btn-ghost btn-sm" style="margin-right:6px;" title="Access Control">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      ' Access</button>';

    if (isArchived) {
      actions +=
        '<button onclick="restoreStaff(\'' + safeId + '\',\'' + safeName + '\')" class="btn btn-success btn-sm">Restore</button>';
    } else {
      actions +=
        '<button onclick="archiveStaff(\'' + safeId + '\',\'' + safeName + '\')" ' +
        'class="btn btn-sm" style="background:var(--amber-light);color:var(--amber);border:1px solid #fde68a;">Archive</button>';
    }

    return (
      "<tr" + (isArchived ? ' style="opacity:0.6;"' : "") + ">" +
      "<td>" +
        '<p style="font-weight:600;font-size:0.82rem;">' + safeName + "</p>" +
        '<p style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + escapeHTML(s.email || "") + "</p>" +
      "</td>" +
      '<td class="muted" style="font-size:0.78rem;">' + created + "</td>" +
      "<td>" + statusBadge + "</td>" +
      '<td style="white-space:nowrap;">' + actions + "</td>" +
      "</tr>"
    );
  });

  container.innerHTML = buildTable(["Name / Email", "Created", "Status", "Actions"], rows);

  // Shrink-wrap Actions column
  var table = container.querySelector(".data-table");
  if (table) {
    var ths = table.querySelectorAll("thead th");
    ["", "130px", "100px", "1px"].forEach(function (w, i) {
      if (ths[i] && w) ths[i].style.width = w;
    });
  }

  renderStaffPagination(totalPages, list.length);
}

function renderStaffPagination(totalPages, total) {
  var pag = document.getElementById("staff-pagination");
  if (!pag) return;
  pag.innerHTML = "";
  if (totalPages <= 1) return;

  var start = (_staffPage - 1) * STAFF_PAGE_SIZE + 1;
  var end   = Math.min(_staffPage * STAFF_PAGE_SIZE, total);

  var info = document.createElement("span");
  info.style.cssText = "font-size:0.75rem;color:var(--text-muted);margin-right:8px;align-self:center;";
  info.textContent = start + "–" + end + " of " + total;
  pag.appendChild(info);

  function addBtn(pg, html, disabled) {
    var btn = document.createElement("button");
    btn.className = "page-btn" + (!html && pg === _staffPage ? " active" : "");
    btn.innerHTML = html || String(pg);
    btn.disabled = !!disabled;
    if (!html) { btn.setAttribute("aria-label", "Page " + pg); btn.setAttribute("aria-current", pg === _staffPage ? "page" : "false"); }
    btn.onclick = function () { _staffPage = pg; renderStaff(); };
    pag.appendChild(btn);
  }

  addBtn(_staffPage - 1,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="15 18 9 12 15 6"/></svg>',
    _staffPage === 1);

  var delta = 2, range = [];
  for (var i = Math.max(1, _staffPage - delta); i <= Math.min(totalPages, _staffPage + delta); i++) range.push(i);

  if (range[0] > 1) {
    addBtn(1);
    if (range[0] > 2) { var d1 = document.createElement("span"); d1.textContent = "…"; d1.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(d1); }
  }
  range.forEach(function (pg) { addBtn(pg); });
  if (range[range.length - 1] < totalPages) {
    if (range[range.length - 1] < totalPages - 1) { var d2 = document.createElement("span"); d2.textContent = "…"; d2.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(d2); }
    addBtn(totalPages);
  }

  addBtn(_staffPage + 1,
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="9 18 15 12 9 6"/></svg>',
    _staffPage === totalPages);
}

// ---------------------------------------------------------------------------
// Archive / Restore
// ---------------------------------------------------------------------------

function archiveStaff(id, name) {
  showConfirm({
    title: "Archive staff member?",
    message: name + " will be deactivated. They can be restored later.",
    confirmLabel: "Archive",
    danger: true,
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/staff/" + id + "/archive", null,
      function () { showToast(name + " has been archived.", "success"); loadStaff(); },
      function (d) { showToast(apiErrorMessage(d, "Failed to archive."), "error"); }
    );
  });
}

function restoreStaff(id, name) {
  showConfirm({
    title: "Restore staff member?",
    message: "Restore " + name + "'s account? They will regain system access.",
    confirmLabel: "Restore",
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/staff/" + id + "/restore", null,
      function () { showToast(name + " has been restored.", "success"); loadStaff(); },
      function (d) { showToast(apiErrorMessage(d, "Failed to restore."), "error"); }
    );
  });
}

// ---------------------------------------------------------------------------
// Add / Edit Staff Modal
// ---------------------------------------------------------------------------

var _editingStaffId = null;

function openModal() {
  _editingStaffId = null;
  document.getElementById("s-modal-title").textContent = "Add Staff Account";
  document.getElementById("btn-save-staff").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Create Account';
  // Show all fields
  document.getElementById("field-name").style.display     = "";
  document.getElementById("field-password").style.display = "";
  document.getElementById("f-first").value    = "";
  document.getElementById("f-first").disabled = false;
  document.getElementById("f-middle").value   = "";
  document.getElementById("f-middle").disabled = false;
  document.getElementById("f-last").value     = "";
  document.getElementById("f-last").disabled  = false;
  document.getElementById("f-email").value    = "";
  document.getElementById("f-email").disabled = false;
  document.getElementById("f-password").value    = "";
  document.getElementById("f-password").disabled = false;
  var pwHint = document.querySelector('#field-password .field-hint');
  if (pwHint) pwHint.textContent = "Min. 12 chars with uppercase, lowercase, number & special character.";
  document.getElementById("modal-error").style.display = "none";
  document.getElementById("btn-save-staff").disabled = false;
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(function () { document.getElementById("f-first").focus(); }, 100);
}

function openEditStaff(id) {
  var s = _staffList.find(function (x) { return x.id === id; });
  if (!s) return;
  _editingStaffId = id;
  document.getElementById("s-modal-title").textContent = "Update Staff Email";
  document.getElementById("btn-save-staff").innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Email';
  // Hide name and password — admin can only update email
  document.getElementById("field-name").style.display     = "none";
  document.getElementById("field-password").style.display = "none";
  document.getElementById("f-email").value    = s.email || "";
  document.getElementById("f-email").disabled = false;
  document.getElementById("modal-error").style.display = "none";
  document.getElementById("btn-save-staff").disabled = false;
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(function () { document.getElementById("f-email").focus(); }, 100);
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  _editingStaffId = null;
}

function saveStaff() {
  var first_name = document.getElementById("f-first").value.trim();
  var middle_name = document.getElementById("f-middle").value.trim();
  var last_name = document.getElementById("f-last").value.trim();
  var email    = document.getElementById("f-email").value.trim();
  var password = document.getElementById("f-password").value;
  var errEl    = document.getElementById("modal-error");
  errEl.style.display = "none";

  if (!_editingStaffId && (!first_name || !last_name || !email)) {
    errEl.textContent = "First name, last name, and email are required.";
    errEl.style.display = "block"; return;
  }
  if (!isEvsuEmail(email)) {
    errEl.textContent = "Email must be a valid @evsu.edu.ph address.";
    errEl.style.display = "block"; return;
  }
  // Password required on create only
  if (!_editingStaffId && !password) {
    errEl.textContent = "Password is required.";
    errEl.style.display = "block"; return;
  }
  if (!_editingStaffId && password) {
    var pwErrors = validatePasswordStrength(password);
    if (pwErrors.length) {
      errEl.textContent = pwErrors[0];
      errEl.style.display = "block"; return;
    }
  }

  var saveBtn = document.getElementById("btn-save-staff");
  saveBtn.disabled = true;

  if (_editingStaffId) {
    // Admin can only update the email — name and password are self-managed
    if (!email) {
      errEl.textContent = "Email is required.";
      errEl.style.display = "block";
      saveBtn.disabled = false; return;
    }
    apiFetch("PUT", "/staff/" + _editingStaffId, { email: email },
      function () {
        closeModal();
        showToast("Staff email updated.", "success");
        loadStaff();
      },
      function (d) {
        errEl.textContent = apiErrorMessage(d, "Failed to update email.");
        errEl.style.display = "block";
        saveBtn.disabled = false;
      }
    );
  } else {
    apiFetch("POST", "/staff", { first_name: first_name, middle_name: middle_name, last_name: last_name, email: email, password: password, permissions: {} },
      function () {
        closeModal();
        showToast("Staff account created. A welcome email has been sent.", "success");
        loadStaff();
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
// Access Control Modal
// ---------------------------------------------------------------------------

function openPermModal(id) {
  var staff = _staffList.find(function (s) { return s.id === id; });
  if (!staff) return;

  document.getElementById("perm-staff-id").value = id;
  document.getElementById("perm-staff-name").textContent =
    "Configuring access for: " + staff.full_name + " (" + staff.email + ")";
  document.getElementById("perm-error").style.display = "none";

  var p = staff.permissions || {};
  var modules = ["students", "tags", "responders", "audit"];
  modules.forEach(function (mod) {
    var perms = p[mod] || [];
    var readEl  = document.getElementById("perm-" + mod + "-read");
    var writeEl = document.getElementById("perm-" + mod + "-write");
    if (readEl)  readEl.checked  = perms.indexOf("read")  >= 0;
    if (writeEl && !writeEl.disabled) writeEl.checked = perms.indexOf("write") >= 0;
  });

  document.getElementById("perm-modal-overlay").classList.add("open");
}

function closePermModal() {
  document.getElementById("perm-modal-overlay").classList.remove("open");
}

function savePermissions() {
  var id = document.getElementById("perm-staff-id").value;
  var errEl = document.getElementById("perm-error");
  errEl.style.display = "none";

  var permissions = {};
  ["students", "tags", "responders", "audit"].forEach(function (mod) {
    var perms = [];
    var readEl  = document.getElementById("perm-" + mod + "-read");
    var writeEl = document.getElementById("perm-" + mod + "-write");
    if (readEl  && readEl.checked)  perms.push("read");
    if (writeEl && !writeEl.disabled && writeEl.checked) perms.push("write");
    if (perms.length) permissions[mod] = perms;
  });

  apiFetch("PUT", "/staff/" + id + "/permissions", { permissions: permissions },
    function () {
      closePermModal();
      showToast("Access control updated. Staff has been notified by email.", "success");
      loadStaff();
    },
    function (d) {
      errEl.textContent = apiErrorMessage(d, "Failed to update permissions.");
      errEl.style.display = "block";
    }
  );
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("btn-add").onclick = openModal;

  // Close modals on backdrop click
  document.getElementById("modal-overlay").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
  });
  document.getElementById("perm-modal-overlay").addEventListener("click", function (e) {
    if (e.target === this) closePermModal();
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
  document.getElementById("staff-search").addEventListener("input", function () {
    _staffSearch = this.value.trim();
    _staffPage = 1;
    renderStaff();
  });

  // Status filter
  var statusSel = document.getElementById("staff-status-filter");
  statusSel.addEventListener("change", function () {
    _staffStatusFilter = this.value;
    _staffPage = 1;
    renderStaff();
  });
  statusSel.addEventListener("focus", function () {
    this.style.borderColor = "var(--brand)";
    this.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.1)";
  });
  statusSel.addEventListener("blur", function () {
    this.style.borderColor = "var(--border)";
    this.style.boxShadow = "";
  });

  // Enter key submits add modal
  ["f-first", "f-middle", "f-last", "f-email", "f-password"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("keydown", function (e) { if (e.key === "Enter") saveStaff(); });
  });

  // Listen for permission updates
  window.addEventListener("userInfoCached", function () { renderStaff(); });

  loadStaff();
});

// Auto-refresh
function refreshData() {
  var m1 = document.getElementById('modal-overlay');
  var m2 = document.getElementById('perm-modal-overlay');
  if ((m1 && m1.classList.contains('open')) || (m2 && m2.classList.contains('open'))) return;
  loadStaff();
}
