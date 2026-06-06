/**
 * tags/tags.js
 * ------------
 * QR tag management: issue, view, deactivate.
 *
 * Flow:
 *  1. "Issue Tag" tab — search students, select one, review info, click Generate.
 *  2. Confirm dialog → API call → QR modal with canvas + print.
 *  3. "All Tags" tab — filterable table of all tags with deactivate action.
 */

var _studentsCache = [];
var _selectedStudentId = null;
var _allTagsCache = [];
var _tagFilter = "all";
var _tagsPage = 1;
var TAGS_PAGE_SIZE = 10;
var _tagsCourseFilter = "";
var _tagsSearch = "";

// ---------------------------------------------------------------------------
// Permission checking
// ---------------------------------------------------------------------------

function hasTagsWritePermission() {
  var role = localStorage.getItem('role') || '';
  // Admins always have full access
  if (role === 'admin') return true;

  var permissionsStr = localStorage.getItem('permissions') || '{}';
  var permissions = {};
  try {
    permissions = JSON.parse(permissionsStr);
  } catch (e) {
    permissions = {};
  }
  var modulePerms = permissions['tags'] || [];
  return modulePerms.indexOf('write') >= 0;
}

function updateTagsPageForWriteAccess() {
  var hasWrite = hasTagsWritePermission();
  var genBtn = document.getElementById('btn-wizard-generate');
  if (genBtn && !hasWrite) {
    genBtn.disabled = true;
    genBtn.title = 'You do not have write access to the Tags module.';
    genBtn.style.opacity = '0.6';
    genBtn.style.cursor = 'not-allowed';
  }
}

function switchTab(tab) {
  document.getElementById("panel-generate").style.display = tab === "generate" ? "block" : "none";
  document.getElementById("panel-active").style.display = tab === "active" ? "block" : "none";

  var genBtn = document.getElementById("tab-generate");
  var actBtn = document.getElementById("tab-active");

  genBtn.className = "tab-btn" + (tab === "generate" ? " active" : "");
  actBtn.className = "tab-btn" + (tab === "active" ? " active" : "");

  if (tab === "active") loadActiveTags();
  if (tab === "generate") loadStudentsForTagging();
}

// ---------------------------------------------------------------------------
// Issue Tag — student picker
// ---------------------------------------------------------------------------

function loadStudentsForTagging() {
  apiFetch("GET", "/students", null, function (data) {
    // Only show students who don't have an active tag — no point listing others
    _studentsCache = data.filter(function (s) {
      return !s.is_archived && !s.has_active_tag;
    });
    renderStudentPicker();
  }, function (d) {
    showToast(apiErrorMessage(d, "Failed to load students."), "error");
  });
}

function renderStudentPicker() {
  var q = ((document.getElementById("tag-search") || {}).value || "").toLowerCase().trim();
  var filtered = _studentsCache.filter(function (s) {
    if (!q) return true;
    return (
      (s.full_name || "").toLowerCase().indexOf(q) >= 0 ||
      (s.student_number || "").toLowerCase().indexOf(q) >= 0 ||
      (s.email || "").toLowerCase().indexOf(q) >= 0
    );
  });

  var list = document.getElementById("student-picker-list");
  if (!list) return;

  if (!filtered.length) {
    list.innerHTML =
      '<div class="empty-state"><p>' +
      (q ? "No students match your search." : "All active students already have a QR tag.") +
      '</p></div>';
    return;
  }

  var hasWrite = hasTagsWritePermission();

  list.innerHTML = filtered.map(function (s) {
    var isSelected = s.id === _selectedStudentId;
    var cls = "student-card" + (isSelected ? " selected" : "");

    var badgeText = hasWrite ? "No tag" : "No tag (Read-only)";

    return (
      '<div class="' + cls + '" style="border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;" onclick="selectStudentForTag(\'' + s.id + '\')">' +
      '<div style="min-width:0;margin-right:10px;">' +
        '<p style="font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHTML(s.full_name || "—") + "</p>" +
        '<p style="font-size:0.7rem;color:var(--text-muted);font-family:monospace;margin-top:2px;">' + escapeHTML(s.student_number || "") + "</p>" +
      "</div>" +
      '<span class="badge badge-gray" style="flex-shrink:0;">' + badgeText + '</span>' +
      "</div>"
    );
  }).join("");

  // If a student is selected, refresh the detail panel too
  if (_selectedStudentId) showSelectedStudentPanel();
}

function selectStudentForTag(id) {
  _selectedStudentId = id;
  renderStudentPicker();
  showSelectedStudentPanel();
}

function showSelectedStudentPanel() {
  var s = _studentsCache.find(function (x) { return x.id === _selectedStudentId; });
  var panel = document.getElementById("tag-wizard-panel");
  var empty = document.getElementById("tag-wizard-empty");
  if (!s || !panel) return;

  // Show panel, hide empty
  panel.classList.remove("hidden");
  empty.classList.add("hidden");

  // Populate
  document.getElementById("wizard-name").textContent = s.full_name || "—";
  document.getElementById("wizard-meta").textContent =
    (s.student_number || "") + (s.email ? " · " + s.email : "");
  document.getElementById("wizard-program").textContent = s.program || "—";
  document.getElementById("wizard-blood").textContent = s.blood_type || "—";

  // Allergies
  var allergies = [];
  if (s.food_allergy && s.food_allergy_specify) allergies.push("Food: " + s.food_allergy_specify);
  if (s.drug_allergy && s.drug_allergy_specify) allergies.push("Drug: " + s.drug_allergy_specify);

  var allergyBox = document.getElementById("wizard-allergy-box");
  var noAllergyBox = document.getElementById("wizard-no-allergy");
  if (allergies.length) {
    document.getElementById("wizard-allergies").textContent = allergies.join(" · ");
    allergyBox.classList.remove("hidden");
    noAllergyBox.classList.add("hidden");
  } else {
    allergyBox.classList.add("hidden");
    noAllergyBox.classList.remove("hidden");
  }

  // Button
  var hasTagNotice = document.getElementById("has-tag-notice");
  var btn = document.getElementById("btn-wizard-generate");
  if (hasTagNotice) hasTagNotice.classList.add("hidden");
  if (btn) {
    var hasWrite = hasTagsWritePermission();
    if (hasWrite) {
      btn.disabled = false;
      btn.className = "btn btn-success";
      btn.style.cssText = "width:100%;justify-content:center;padding:11px;";
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Generate QR Medical Tag';
      btn.onclick = function () { generateTagWizard(s.id, s.full_name); };
    } else {
      btn.disabled = true;
      btn.className = "btn btn-success";
      btn.style.cssText = "width:100%;justify-content:center;padding:11px;opacity:0.5;cursor:not-allowed;";
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Read Only';
      btn.onclick = null;
    }
  }
}

function generateTagWizard(studentId, name) {
  showConfirm({
    title: "Generate QR medical tag?",
    message:
      "A QR tag will be created for " + name +
      ". A notification email with the tag details and a self-deactivate link will be sent to their EVSU email.",
    confirmLabel: "Generate Tag",
  }).then(function (ok) {
    if (!ok) return;

    var btn = document.getElementById("btn-wizard-generate");
    btn.disabled = true;
    btn.textContent = "Generating…";

    apiFetch("POST", "/tags", { student_id: studentId },
      function (tag) {
        showToast("QR tag created. Email sent to " + name + ".", "success");

        // Show QR modal
        document.getElementById("qr-name").textContent = name;
        var canvas = document.getElementById("qr-canvas");
        canvas.dataset.student = name;
        canvas.dataset.payload = tag.qr_payload;

        if (typeof QRCode === "undefined") {
          showToast("QR renderer is unavailable. Refresh the page and try again.", "error");
          btn.disabled = false;
          btn.textContent = "Generate QR Medical Tag";
          return;
        }

        // Clear previous QR
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        QRCode.toCanvas(canvas, tag.qr_payload, {
          width: 220,
          margin: 2,
          color: { dark: "#7f1d1d", light: "#ffffff" },
        }, function (err) {
          if (err) showToast("QR rendered but canvas error: " + err.message, "warning");
        });

        document.getElementById("modal-qr").classList.add("open");

        // Refresh data
        _selectedStudentId = null;
        loadStudentsForTagging();
        // Reset panel
        document.getElementById("tag-wizard-panel").classList.add("hidden");
        document.getElementById("tag-wizard-empty").classList.remove("hidden");
      },
      function (d) {
        showToast(apiErrorMessage(d, "Could not generate tag."), "error");
        btn.disabled = false;
        btn.textContent = "Generate QR Medical Tag";
      }
    );
  });
}

// ---------------------------------------------------------------------------
// QR modal
// ---------------------------------------------------------------------------

function closeQR() {
  document.getElementById("modal-qr").classList.remove("open");
  switchTab("active");
}

function printQR() {
  var canvas = document.getElementById("qr-canvas");
  var name = canvas.dataset.student || "Student";
  var dataUrl = canvas.toDataURL("image/png");
  var win = window.open("", "_blank");
  if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
  win.document.write(
    "<!DOCTYPE html><html><head><title>QR Tag — " + name + "</title>" +
    "<style>" +
    "  body { font-family: sans-serif; text-align: center; padding: 48px; background: #fff; }" +
    "  .card { display: inline-block; border: 2px solid #7f1d1d; border-radius: 16px; padding: 24px 32px; }" +
    "  img { width: 220px; height: 220px; display: block; margin: 0 auto 12px; }" +
    "  h2 { color: #7f1d1d; margin: 0 0 4px; font-size: 18px; }" +
    "  p { color: #6b7280; font-size: 13px; margin: 0; }" +
    "  .footer { margin-top: 16px; font-size: 11px; color: #9ca3af; }" +
    "</style></head><body>" +
    '<div class="card">' +
    '<img src="' + dataUrl + '" alt="QR Code" />' +
    "<h2>EVSU Medical Tag</h2>" +
    "<p>" + name + "</p>" +
    "</div>" +
    '<p class="footer">CRCY Scan and Help — EVSU Ormoc Campus</p>' +
    "<script>window.onload = function(){ window.print(); }<\/script>" +
    "</body></html>"
  );
  win.document.close();
}

// ---------------------------------------------------------------------------
// All Tags tab
// ---------------------------------------------------------------------------

function filterTags(mode) {
  _tagFilter = mode;
  _tagsPage = 1;
  ["all", "active", "inactive"].forEach(function (m) {
    var btn = document.getElementById("filter-" + m);
    if (btn) btn.className = "btn btn-sm" + (m === mode ? " btn-primary" : " btn-ghost");
  });
  renderTagsTable();
}

function loadActiveTags() {
  apiFetch("GET", "/tags", null, function (data) {
    _allTagsCache = data;
    populateTagsCourseFilter();
    renderTagsTable();
  }, function (d) {
    showToast(apiErrorMessage(d, "Failed to load tags."), "error");
  });
}

function populateTagsCourseFilter() {
  var sel = document.getElementById("tags-course-filter");
  if (!sel || typeof EVSU_PROGRAMS === "undefined") return;
  // Only rebuild if empty (beyond the default "All Courses" option)
  if (sel.options.length > 1) return;
  EVSU_PROGRAMS.forEach(function (dept) {
    var grp = document.createElement("optgroup");
    grp.label = dept.department;
    dept.programs.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.code;
      opt.textContent = p.code;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

function renderTagsTable() {
  var container = document.getElementById("tags-container");
  var list = _allTagsCache;

  // Status filter
  if (_tagFilter === "active")   list = list.filter(function (t) { return t.is_active; });
  if (_tagFilter === "inactive") list = list.filter(function (t) { return !t.is_active; });

  // Search filter
  if (_tagsSearch) {
    var q = _tagsSearch.toLowerCase();
    list = list.filter(function (t) {
      return (
        (t.student_name   || "").toLowerCase().indexOf(q) >= 0 ||
        (t.student_number || "").toLowerCase().indexOf(q) >= 0
      );
    });
  }

  // Course filter
  if (_tagsCourseFilter) {
    list = list.filter(function (t) {
      return (t.student_program || "").toUpperCase() === _tagsCourseFilter;
    });
  }

  // Count label
  var countEl = document.getElementById("tags-count");
  if (countEl) {
    countEl.textContent = list.length ? list.length + " tag" + (list.length !== 1 ? "s" : "") : "";
  }

  if (!list.length) {
    container.innerHTML = emptyState(
      _tagFilter === "active"   ? "No active tags match your filters." :
      _tagFilter === "inactive" ? "No deactivated tags match your filters." :
      (_tagsSearch || _tagsCourseFilter) ? "No tags match your filters." :
      "No tags generated yet."
    );
    document.getElementById("tags-pagination").innerHTML = "";
    return;
  }

  // Pagination
  var totalPages = Math.ceil(list.length / TAGS_PAGE_SIZE);
  if (_tagsPage > totalPages) _tagsPage = 1;
  var start = (_tagsPage - 1) * TAGS_PAGE_SIZE;
  var pageItems = list.slice(start, start + TAGS_PAGE_SIZE);

  var rows = pageItems.map(function (t) {
    var statusBadge = t.is_active
      ? '<span class="badge badge-green">Active</span>'
      : '<span class="badge badge-red">Deactivated</span>';

    var createdDate = new Date(t.created_at).toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric"
    });
    var deactivatedDate = t.deactivated_at
      ? new Date(t.deactivated_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
      : "—";

    var canWrite = hasTagsWritePermission();
    var action = t.is_active
      ? (canWrite
          ? '<button onclick="deactivateTag(\'' + t.id + '\',\'' +
            (t.student_name || "").replace(/'/g, "&#39;") + '\')" ' +
            'class="btn btn-sm" style="background:var(--amber-light);color:var(--amber);border:1px solid #fde68a;">Deactivate</button>'
          : '<span style="font-size:0.72rem;color:var(--text-muted);">Active (read-only)</span>')
      : '<span style="font-size:0.72rem;color:var(--text-muted);">Deactivated ' + deactivatedDate + "</span>";

    return (
      "<tr>" +
      "<td>" +
        '<p style="font-weight:600;font-size:0.82rem;">' + escapeHTML(t.student_name || "—") + "</p>" +
        '<p style="font-size:0.72rem;font-family:monospace;color:var(--text-muted);margin-top:2px;">' + escapeHTML(t.student_number || "") + "</p>" +
      "</td>" +
      '<td class="muted" style="font-size:0.78rem;">' + escapeHTML(t.student_program || "—") + "</td>" +
      '<td class="muted">' + createdDate + "</td>" +
      "<td>" + statusBadge + "</td>" +
      "<td>" + action + "</td>" +
      "</tr>"
    );
  });

  container.innerHTML = buildTable(
    ["Student", "Course", "Issued On", "Status", "Action"],
    rows
  );

  renderTagsPagination(totalPages, list.length);
}

function renderTagsPagination(totalPages, total) {
  var pag = document.getElementById("tags-pagination");
  if (!pag) return;
  pag.innerHTML = "";
  if (totalPages <= 1) return;

  var start = (_tagsPage - 1) * TAGS_PAGE_SIZE + 1;
  var end = Math.min(_tagsPage * TAGS_PAGE_SIZE, total);

  var info = document.createElement("span");
  info.style.cssText = "font-size:0.75rem;color:var(--text-muted);margin-right:8px;align-self:center;";
  info.textContent = start + "–" + end + " of " + total;
  pag.appendChild(info);

  var prev = document.createElement("button");
  prev.className = "page-btn";
  prev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="15 18 9 12 15 6"/></svg>';
  prev.disabled = _tagsPage === 1;
  prev.setAttribute("aria-label", "Previous page");
  prev.onclick = function () { _tagsPage--; renderTagsTable(); };
  pag.appendChild(prev);

  var delta = 2;
  var range = [];
  for (var i = Math.max(1, _tagsPage - delta); i <= Math.min(totalPages, _tagsPage + delta); i++) range.push(i);

  if (range[0] > 1) {
    addTagPageBtn(pag, 1);
    if (range[0] > 2) { var d1 = document.createElement("span"); d1.textContent = "…"; d1.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(d1); }
  }
  range.forEach(function (pg) { addTagPageBtn(pag, pg); });
  if (range[range.length - 1] < totalPages) {
    if (range[range.length - 1] < totalPages - 1) { var d2 = document.createElement("span"); d2.textContent = "…"; d2.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(d2); }
    addTagPageBtn(pag, totalPages);
  }

  var next = document.createElement("button");
  next.className = "page-btn";
  next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="9 18 15 12 9 6"/></svg>';
  next.disabled = _tagsPage === totalPages;
  next.setAttribute("aria-label", "Next page");
  next.onclick = function () { _tagsPage++; renderTagsTable(); };
  pag.appendChild(next);
}

function addTagPageBtn(container, pg) {
  var btn = document.createElement("button");
  btn.textContent = pg;
  btn.className = "page-btn" + (pg === _tagsPage ? " active" : "");
  btn.setAttribute("aria-label", "Page " + pg);
  btn.setAttribute("aria-current", pg === _tagsPage ? "page" : "false");
  btn.onclick = function () { _tagsPage = pg; renderTagsTable(); };
  container.appendChild(btn);
}

function deactivateTag(tagId, name) {
  showConfirm({
    title: "Deactivate this tag?",
    message:
      "The QR tag for " + name +
      " will be deactivated. Scans will no longer return their data. " +
      "A new tag can be issued to them at any time.",
    confirmLabel: "Deactivate",
    danger: true,
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/tags/" + tagId + "/deactivate", null,
      function () {
        showToast("Tag deactivated for " + name + ".", "success");
        loadActiveTags();
        loadStudentsForTagging();
      },
      function (d) {
        showToast(apiErrorMessage(d, "Could not deactivate tag."), "error");
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  // Update UI based on write permissions
  updateTagsPageForWriteAccess();
  
  // Listen for permission updates
  window.addEventListener('userInfoCached', function() {
    updateTagsPageForWriteAccess();
    loadActiveTags();
  });

  var search = document.getElementById("tag-search");
  if (search) search.addEventListener("input", renderStudentPicker);

  // All Tags — search + course filter
  var tagsSearch = document.getElementById("tags-search");
  if (tagsSearch) {
    tagsSearch.addEventListener("input", function () {
      _tagsSearch = this.value.trim();
      _tagsPage = 1;
      renderTagsTable();
    });
  }

  var tagsCourse = document.getElementById("tags-course-filter");
  if (tagsCourse) {
    tagsCourse.addEventListener("change", function () {
      _tagsCourseFilter = this.value;
      _tagsPage = 1;
      renderTagsTable();
    });
    tagsCourse.addEventListener("focus", function () {
      this.style.borderColor = "var(--brand)";
      this.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.1)";
    });
    tagsCourse.addEventListener("blur", function () {
      this.style.borderColor = "var(--border)";
      this.style.boxShadow = "";
    });
  }

  // Close QR modal on backdrop click
  document.getElementById("modal-qr").addEventListener("click", function (e) {
    if (e.target === this) closeQR();
  });

  loadStudentsForTagging();
});


// Auto-refresh
function refreshData() {
  var actBtn = document.getElementById('tab-active');
  if (actBtn && actBtn.classList.contains('active')) {
    loadActiveTags();
  } else {
    loadStudentsForTagging();
  }
}
