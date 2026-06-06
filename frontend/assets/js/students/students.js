/**
 * students/students.js
 * --------------------
 * Student profiles: list, search, add, edit, archive.
 *
 * Key behaviours:
 *  - Name stored as separate fields (last, first, middle, suffix)
 *  - Program dropdown uses <optgroup> by department
 *  - Birthdate uses native date picker (popup calendar)
 *  - EVSU email validated client-side; duplicate email shown as inline error
 *  - PH mobile format enforced with inline hint
 *  - Yes/No conditionals: detail field only appears when Yes is selected
 *  - Archive (soft-delete) instead of hard delete
 *  - Toast on every meaningful action
 *  - Confirm dialog before every destructive action
 *  - Client-side search filter
 */

var _editingStudentId = null;
var _showArchived = false;
var _allStudents = [];   // full cache from API
var _currentPage = 1;
var PAGE_SIZE = 10;
var _courseFilter = ""; // selected program code, "" = all

var _pobSelector = null;
var _homeSelector = null;
var _guardianSelector = null;

// ---------------------------------------------------------------------------
// Permission checking
// ---------------------------------------------------------------------------

function hasWritePermission(module) {
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
  var modulePerms = permissions[module] || [];
  return modulePerms.indexOf('write') >= 0;
}

function hasReadPermission(module) {
  var role = localStorage.getItem('role') || '';
  if (role === 'admin') return true;

  var permissionsStr = localStorage.getItem('permissions') || '{}';
  var permissions = {};
  try {
    permissions = JSON.parse(permissionsStr);
  } catch (e) {
    permissions = {};
  }
  var modulePerms = permissions[module] || [];
  return modulePerms.indexOf('read') >= 0;
}

function updatePageForWriteAccess() {
  var hasWrite = hasWritePermission('students');
  var addBtn = document.getElementById('btn-add');
  if (!addBtn) return;

  if (!hasWrite) {
    addBtn.disabled = true;
    addBtn.title = 'You do not have write access to the Students module.';
    addBtn.style.opacity = '0.6';
    addBtn.style.cursor = 'not-allowed';
  } else if (_showArchived) {
    addBtn.disabled = true;
    addBtn.title = 'Switch to active view to add a new student.';
    addBtn.style.opacity = '0.6';
    addBtn.style.cursor = 'not-allowed';
  } else {
    addBtn.disabled = false;
    addBtn.title = '';
    addBtn.style.opacity = '';
    addBtn.style.cursor = '';
  }
}

function loadStudents() {
  // Always fetch all students when showing archived so we have the full set.
  // When showing active only, skip the query param (backend default is active-only).
  var q = _showArchived ? "?include_archived=true" : "";
  apiFetch("GET", "/students" + q, null, function (data) {
    // When in archived view, show ONLY archived records (not the mix)
    _allStudents = _showArchived
      ? (data || []).filter(function (s) { return s.is_archived; })
      : (data || []);
    renderStudents(_allStudents);
  }, function (d) {
    showToast(apiErrorMessage(d, "Failed to load students."), "error");
  });
}

function renderStudents(list) {
  var container = document.getElementById("table-container");
  var searchVal = (document.getElementById("student-search") || {}).value || "";
  var filtered = list;

  // Apply search filter
  if (searchVal.trim()) {
    var q = searchVal.trim().toLowerCase();
    filtered = filtered.filter(function (s) {
      return (
        (s.full_name || "").toLowerCase().indexOf(q) >= 0 ||
        (s.student_number || "").toLowerCase().indexOf(q) >= 0 ||
        (s.program || "").toLowerCase().indexOf(q) >= 0 ||
        (s.email || "").toLowerCase().indexOf(q) >= 0
      );
    });
  }

  // Apply course filter
  if (_courseFilter) {
    filtered = filtered.filter(function (s) {
      return (s.program || "").toUpperCase() === _courseFilter;
    });
  }

  // Update count label
  var countEl = document.getElementById("student-count");
  if (countEl) {
    countEl.textContent = filtered.length === 0 ? "" :
      filtered.length + " student" + (filtered.length !== 1 ? "s" : "");
  }

  if (!filtered.length) {
    container.innerHTML = emptyState(
      _showArchived
        ? "No archived students found."
        : (searchVal || _courseFilter)
          ? "No students match your filters."
          : 'No students yet. Click "Add Student" to create the first profile.'
    );
    document.getElementById("student-pagination").innerHTML = "";
    return;
  }

  // Pagination
  var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (_currentPage > totalPages) _currentPage = 1;
  var start = (_currentPage - 1) * PAGE_SIZE;
  var pageItems = filtered.slice(start, start + PAGE_SIZE);

  var rows = pageItems.map(function (s) {
    var allergies = [];
    if (s.food_allergy && s.food_allergy_specify) allergies.push("Food: " + s.food_allergy_specify);
    if (s.drug_allergy && s.drug_allergy_specify) allergies.push("Drug: " + s.drug_allergy_specify);
    var allergyCell = allergies.length
      ? '<span class="badge badge-red">' + escapeHTML(allergies.join(", ")) + "</span>"
      : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';

    var bloodCell = s.blood_type
      ? '<span class="badge badge-blue" style="font-weight:800;">' + escapeHTML(s.blood_type) + "</span>"
      : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';

    var enrollBadge = '';
    if (!s.is_archived && s.enrollment_status === 'pending_continuation') {
      enrollBadge = ' <span class="badge badge-amber" style="font-size:0.6rem;">Pending</span>';
    }

    var statusCell = s.is_archived
      ? '<span class="badge badge-gray">Archived</span>'
      : s.has_active_tag
        ? '<span class="badge badge-green">Tag active</span>' + enrollBadge
        : '<span class="badge badge-amber">No tag</span>' + enrollBadge;

    var safeName = (s.full_name || "").replace(/'/g, "&#39;");
    var canWrite = hasWritePermission('students');
    var role = localStorage.getItem('role') || '';
    var isAdmin = role === 'admin';

    var inviteBtn = canWrite && !s.is_archived
      ? '<button onclick="sendInvite(\'' + s.id + '\',\'' + safeName + '\')" ' +
        'class="btn btn-sm" style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;margin-right:6px;" title="Send/re-send portal invite">Invite</button>'
      : '';

    var actions = s.is_archived
      ? (canWrite && isAdmin ? '<button onclick="restoreStudent(\'' + s.id + '\',\'' + safeName + '\')" ' +
        'class="btn btn-success btn-sm">Restore</button>' : '')
      : (canWrite ? inviteBtn + '<button onclick="openEditStudent(\'' + s.id + '\')" ' +
        'class="btn btn-ghost btn-sm" style="margin-right:6px;">Edit</button>' +
        (isAdmin ? '<button onclick="archiveStudent(\'' + s.id + '\',\'' + safeName + '\')" ' +
        'class="btn btn-sm" style="background:var(--amber-light);color:var(--amber);border:1px solid #fde68a;">Archive</button>' : '') :
        '<span style="color:var(--text-muted);font-size:0.75rem;">Read-only</span>');

    return (
      '<tr' + (s.is_archived ? ' style="opacity:0.55;"' : "") + '>' +
      '<td class="muted" style="font-family:monospace;font-size:0.75rem;">' + escapeHTML(s.student_number || "—") + "</td>" +
      "<td>" +
        '<p style="font-weight:600;font-size:0.82rem;">' + escapeHTML(s.full_name || "—") + "</p>" +
        '<p style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">' + escapeHTML(s.email || "") + "</p>" +
      "</td>" +
      '<td class="muted">' + escapeHTML(s.program || "—") + "</td>" +
      "<td>" + statusCell + "</td>" +
      "<td>" + bloodCell + "</td>" +
      "<td>" + allergyCell + "</td>" +
      '<td style="white-space:nowrap;">' + actions + "</td>" +
      "</tr>"
    );
  });

  container.innerHTML = buildTable(
    ["Student No.", "Name / Email", "Program", "Status", "Blood", "Allergies", "Actions"],
    rows
  );

  // Render pagination
  renderStudentPagination(totalPages, filtered.length);
}

function renderStudentPagination(totalPages, total) {
  var pag = document.getElementById("student-pagination");
  if (!pag) return;
  pag.innerHTML = "";
  if (totalPages <= 1) return;

  var start = (_currentPage - 1) * PAGE_SIZE + 1;
  var end = Math.min(_currentPage * PAGE_SIZE, total);

  // Info label
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
  prev.onclick = function () { _currentPage--; renderStudents(_allStudents); };
  pag.appendChild(prev);

  // Page number buttons — show at most 5 around current
  var range = [];
  var delta = 2;
  for (var i = Math.max(1, _currentPage - delta); i <= Math.min(totalPages, _currentPage + delta); i++) {
    range.push(i);
  }
  // Always show first and last with ellipsis
  if (range[0] > 1) {
    addPageBtn(pag, 1);
    if (range[0] > 2) { var dots = document.createElement("span"); dots.textContent = "…"; dots.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(dots); }
  }
  range.forEach(function (pg) { addPageBtn(pag, pg); });
  if (range[range.length - 1] < totalPages) {
    if (range[range.length - 1] < totalPages - 1) { var dots2 = document.createElement("span"); dots2.textContent = "…"; dots2.style.cssText = "padding:0 4px;color:var(--text-muted);font-size:0.8rem;align-self:center;"; pag.appendChild(dots2); }
    addPageBtn(pag, totalPages);
  }

  // Next button
  var next = document.createElement("button");
  next.className = "page-btn";
  next.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="9 18 15 12 9 6"/></svg>';
  next.disabled = _currentPage === totalPages;
  next.setAttribute("aria-label", "Next page");
  next.onclick = function () { _currentPage++; renderStudents(_allStudents); };
  pag.appendChild(next);
}

function addPageBtn(container, pg) {
  var btn = document.createElement("button");
  btn.textContent = pg;
  btn.className = "page-btn" + (pg === _currentPage ? " active" : "");
  btn.setAttribute("aria-label", "Page " + pg);
  btn.setAttribute("aria-current", pg === _currentPage ? "page" : "false");
  btn.onclick = function () { _currentPage = pg; renderStudents(_allStudents); };
  container.appendChild(btn);
}

// Populate the course filter dropdown from EVSU_PROGRAMS
function populateCourseFilter() {
  var sel = document.getElementById("course-filter");
  if (!sel || typeof EVSU_PROGRAMS === "undefined") return;
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

// ---------------------------------------------------------------------------
// Toggle archived view
// ---------------------------------------------------------------------------

function toggleArchivedView() {
  _showArchived = !_showArchived;
  var btn = document.getElementById("btn-toggle-archived");
  if (btn) {
    if (_showArchived) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> Show Active Only';
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-ghost");
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> Show Archived';
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-ghost");
    }
    btn.setAttribute("aria-pressed", String(_showArchived));
  }
  updatePageForWriteAccess();
  _currentPage = 1;
  loadStudents();
}

// ---------------------------------------------------------------------------
// Modal open / close
// ---------------------------------------------------------------------------

function openAddStudent() {
  _editingStudentId = null;
  document.getElementById("modal-title").textContent = "New Clinic Record";
  clearStudentForm();
  clearError("modal-error");
  document.getElementById("f-generate-tag-wrap").style.display = "block";
  document.getElementById("f-sn").disabled = false;
  switchModalTab('personal');
  document.getElementById("modal-overlay").classList.add("open");
}

function openEditStudent(id) {
  apiFetch("GET", "/students/" + id, null, function (s) {
    _editingStudentId = s.id;
    document.getElementById("modal-title").textContent = "Edit Clinic Record";
    populateStudentForm(s);
    clearError("modal-error");
    document.getElementById("f-generate-tag-wrap").style.display = "none";
    switchModalTab('personal');
    document.getElementById("modal-overlay").classList.add("open");
  }, function (d) {
    showToast(apiErrorMessage(d, "Could not load student record."), "error");
  });
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
  _editingStudentId = null;
}

// ---------------------------------------------------------------------------
// Archive / Restore
// ---------------------------------------------------------------------------

function archiveStudent(id, name) {
  showConfirm({
    title: "Archive this student?",
    message: name + "'s record will be archived and their active QR tags deactivated. You can restore it later.",
    confirmLabel: "Archive",
    danger: true,
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/students/" + id + "/archive", null,
      function () {
        showToast(name + " has been archived.", "success");
        loadStudents();
      },
      function (d) {
        showToast(apiErrorMessage(d, "Could not archive student."), "error");
      }
    );
  });
}

function restoreStudent(id, name) {
  showConfirm({
    title: "Restore this student?",
    message: "Restore " + name + "'s record to active status?",
    confirmLabel: "Restore",
  }).then(function (ok) {
    if (!ok) return;
    apiFetch("POST", "/students/" + id + "/restore", null,
      function () {
        showToast(name + " has been restored.", "success");
        loadStudents();
      },
      function (d) {
        showToast(apiErrorMessage(d, "Could not restore student."), "error");
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function fv(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function fsv(id, val) {
  var el = document.getElementById(id);
  if (el) el.value = val != null ? val : "";
}

function radioVal(name) {
  var r = document.querySelector('input[name="' + name + '"]:checked');
  return r ? r.value === "true" : false;
}

function setRadio(name, val) {
  var r = document.querySelector(
    'input[name="' + name + '"][value="' + (val ? "true" : "false") + '"]'
  );
  if (r) {
    r.checked = true;
    r.dispatchEvent(new Event("change"));
  }
  // Update pill styles for the new card UI
  var pillMap = {
    hypertension: ['pill-hyp-no', 'pill-hyp-yes', 'hypertension-med', 'card-hypertension'],
    health_disease: ['pill-hd-no', 'pill-hd-yes', 'disease-diag', 'card-health-disease'],
    food_allergy: ['pill-fa-no', 'pill-fa-yes', 'food-specify', 'card-food-allergy'],
    drug_allergy: ['pill-da-no', 'pill-da-yes', 'drug-specify', 'card-drug-allergy'],
    diabetes: ['pill-db-no', 'pill-db-yes', 'diabetes-med', 'card-diabetes'],
    surgery: ['pill-sx-no', 'pill-sx-yes', 'surgery-proc', 'card-surgery'],
    mental: ['pill-mh-no', 'pill-mh-yes', 'mental-notes', 'card-mental'],
    covid: ['pill-cv-no', 'pill-cv-yes', 'covid-details', 'card-covid'],
  };
  var m = pillMap[name];
  if (!m) return;
  var noEl = document.getElementById(m[0]);
  var yesEl = document.getElementById(m[1]);
  if (noEl) { noEl.classList.toggle('no-active', !val); noEl.classList.remove('yes-active'); }
  if (yesEl) { yesEl.classList.toggle('yes-active', val); yesEl.classList.remove('no-active'); }
  toggleMedCard(m[2], m[3], val);
}

// ---------------------------------------------------------------------------
// Modal tab switching
// ---------------------------------------------------------------------------

var _currentModalTab = 'personal';
var _modalTabs = ['personal', 'guardian', 'medical'];

function switchModalTab(tab) {
  _currentModalTab = tab;
  _modalTabs.forEach(function(t) {
    var btn = document.getElementById('tab-' + t);
    var panel = document.getElementById('panel-' + t);
    if (btn) {
      btn.classList.toggle('active', t === tab);
      btn.setAttribute('aria-selected', String(t === tab));
    }
    if (panel) panel.classList.toggle('active', t === tab);
  });
  var idx = _modalTabs.indexOf(tab);
  var prevBtn = document.getElementById('btn-prev-tab');
  var nextBtn = document.getElementById('btn-next-tab');
  var saveBtn = document.getElementById('btn-save-student');
  if (prevBtn) prevBtn.style.display = idx > 0 ? '' : 'none';
  if (nextBtn) nextBtn.style.display = idx < _modalTabs.length - 1 ? '' : 'none';
  if (saveBtn) saveBtn.style.display = idx === _modalTabs.length - 1 ? '' : 'none';
}

function nextModalTab() {
  var idx = _modalTabs.indexOf(_currentModalTab);
  if (idx < _modalTabs.length - 1) switchModalTab(_modalTabs[idx + 1]);
}

function prevModalTab() {
  var idx = _modalTabs.indexOf(_currentModalTab);
  if (idx > 0) switchModalTab(_modalTabs[idx - 1]);
}

// ---------------------------------------------------------------------------
// Medical card toggle (new card-based UI)
// ---------------------------------------------------------------------------

function toggleMedCard(detailId, cardId, isYes) {
  var detail = document.getElementById(detailId);
  var card = document.getElementById(cardId);
  if (detail) detail.classList.toggle('show', isYes);
  if (card) card.classList.toggle('active', isYes);
}

// Keep legacy toggle() for backward compat with setRadio dispatching change events
function toggle(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  if (val === 'true') el.classList.add('show');
  else el.classList.remove('show');
}

function setFieldError(errId, show) {
  var el = document.getElementById(errId);
  if (!el) return;
  if (show) el.classList.add("show");
  else el.classList.remove("show");
}

function clearStudentForm() {
  var textFields = [
    "f-sn", "f-last", "f-first", "f-middle", "f-suffix",
    "f-pob", "f-address", "f-contact", "f-email",
    "f-gname", "f-gcontact", "f-gaddress",
    "f-hmed", "f-diag",
    "f-vaccine",
    "f-food", "f-drug", "f-dmed", "f-surgery", "f-mental",
  ];
  textFields.forEach(function (id) { fsv(id, ""); });

  // Date fields
  fsv("f-birthdate", "");
  fsv("f-dose1", "");
  fsv("f-dose2", "");
  fsv("f-booster", "");
  fsv("f-age", "");

  // Selects
  var prog = document.getElementById("f-program");
  if (prog) prog.innerHTML = buildProgramSelectOptions("");
  fsv("f-blood", "");

  // Radios — all default to No, reset pill styles
  ["hypertension", "health_disease", "covid", "food_allergy", "drug_allergy", "diabetes", "surgery", "mental"]
    .forEach(function (name) { setRadio(name, false); });

  // Clear inline errors
  ["err-contact", "err-email", "err-gcontact"].forEach(function (id) { setFieldError(id, false); });

  // Clear address selectors
  if (_pobSelector) _pobSelector.setValue("");
  if (_homeSelector) _homeSelector.setValue("");
  if (_guardianSelector) _guardianSelector.setValue("");

  // Generate tag checkbox
  var gen = document.getElementById("f-generate-tag");
  if (gen) gen.checked = true;
}

function populateStudentForm(s) {
  fsv("f-sn", s.student_number);
  document.getElementById("f-sn").disabled = true;

  fsv("f-last", s.last_name || "");
  fsv("f-first", s.first_name || "");
  fsv("f-middle", s.middle_name || "");
  fsv("f-suffix", s.suffix || "");

  var prog = document.getElementById("f-program");
  if (prog) prog.innerHTML = buildProgramSelectOptions(s.program || "");

  fsv("f-birthdate", birthdateToInputValue(s.birthdate));
  fsv("f-age", s.age != null ? String(s.age) : "");
  fsv("f-pob", s.place_of_birth || "");
  if (_pobSelector) _pobSelector.setValue(s.place_of_birth || "");
  fsv("f-address", s.address || "");
  if (_homeSelector) _homeSelector.setValue(s.address || "");
  fsv("f-contact", s.contact_number || "");
  fsv("f-email", s.email || "");
  fsv("f-gfirst", s.guardian_first_name || "");
  fsv("f-gmiddle", s.guardian_middle_name || "");
  fsv("f-glast", s.guardian_last_name || "");
  fsv("f-gcontact", s.guardian_contact || "");
  fsv("f-gaddress", s.guardian_address || "");
  if (_guardianSelector) _guardianSelector.setValue(s.guardian_address || "");
  fsv("f-blood", s.blood_type || "");
  fsv("f-gender", s.gender || "");

  setRadio("hypertension", s.hypertension);
  fsv("f-hmed", s.hypertension_medication || "");

  setRadio("health_disease", s.health_disease);
  fsv("f-diag", s.health_disease_diagnosis || "");

  setRadio("covid", s.covid_vaccinated);
  // COVID dates stored as mm/dd/yyyy — convert to input value
  fsv("f-dose1", birthdateToInputValue(s.covid_dose1));
  fsv("f-dose2", birthdateToInputValue(s.covid_dose2));
  fsv("f-booster", birthdateToInputValue(s.covid_booster));
  fsv("f-vaccine", s.covid_vaccine_brand || "");

  setRadio("food_allergy", s.food_allergy);
  fsv("f-food", s.food_allergy_specify || "");

  setRadio("drug_allergy", s.drug_allergy);
  fsv("f-drug", s.drug_allergy_specify || "");

  setRadio("diabetes", s.diabetes);
  fsv("f-dmed", s.diabetes_medication || "");

  setRadio("surgery", s.history_of_surgery);
  fsv("f-surgery", s.surgery_procedure || "");

  setRadio("mental", s.mental_health);
  fsv("f-mental", s.mental_health_notes || "");

  // Clear inline errors
  ["err-contact", "err-email", "err-gcontact"].forEach(function (id) { setFieldError(id, false); });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateStudentForm() {
  var errors = [];
  var hasInline = false;

  if (!fv("f-sn")) errors.push("Student number is required.");
  if (!fv("f-last")) errors.push("Last name is required.");
  if (!fv("f-first")) errors.push("First name is required.");
  if (!fv("f-program")) errors.push("Please select a program.");
  if (!fv("f-birthdate")) errors.push("Birthdate is required.");

  // Email
  var email = fv("f-email");
  if (!email) {
    errors.push("EVSU email is required.");
  } else if (!isEvsuEmail(email)) {
    setFieldError("err-email", true);
    hasInline = true;
  } else {
    setFieldError("err-email", false);
  }

  // Contact
  var contact = fv("f-contact");
  if (contact && !isPhilippineMobile(contact)) {
    setFieldError("err-contact", true);
    hasInline = true;
  } else {
    setFieldError("err-contact", false);
  }

  // Guardian contact
  var gcontact = fv("f-gcontact");
  if (gcontact && !isPhilippineMobile(gcontact)) {
    setFieldError("err-gcontact", true);
    hasInline = true;
  } else {
    setFieldError("err-gcontact", false);
  }

  if (hasInline && !errors.length) {
    return "Please fix the highlighted fields.";
  }
  return errors.length ? errors[0] : null;
}

// ---------------------------------------------------------------------------
// Build payload
// ---------------------------------------------------------------------------

function buildStudentPayload() {
  var bd = parseBirthdateInput(fv("f-birthdate"));
  var dose1 = parseBirthdateInput(fv("f-dose1"));
  var dose2 = parseBirthdateInput(fv("f-dose2"));
  var booster = parseBirthdateInput(fv("f-booster"));

  return {
    student_number: fv("f-sn"),
    last_name: fv("f-last"),
    first_name: fv("f-first"),
    middle_name: fv("f-middle") || null,
    suffix: fv("f-suffix") || null,
    email: normalizeEmail(fv("f-email")),
    program: fv("f-program") || null,
    birthdate: bd,
    age: bd ? calcAgeFromBirthdate(bd) : (fv("f-age") ? parseInt(fv("f-age"), 10) : null),
    place_of_birth: fv("f-pob") || null,
    address: fv("f-address") || null,
    contact_number: fv("f-contact") ? normalizePhilippinePhone(fv("f-contact")) : null,
    gender: fv("f-gender") || null,
    guardian_first_name: fv("f-gfirst") || null,
    guardian_middle_name: fv("f-gmiddle") || null,
    guardian_last_name: fv("f-glast") || null,
    guardian_contact: fv("f-gcontact") ? normalizePhilippinePhone(fv("f-gcontact")) : null,
    guardian_address: fv("f-gaddress") || null,
    blood_type: fv("f-blood") || null,
    hypertension: radioVal("hypertension"),
    hypertension_medication: fv("f-hmed") || null,
    health_disease: radioVal("health_disease"),
    health_disease_diagnosis: fv("f-diag") || null,
    covid_vaccinated: radioVal("covid"),
    covid_dose1: dose1,
    covid_dose2: dose2,
    covid_booster: booster,
    covid_vaccine_brand: fv("f-vaccine") || null,
    food_allergy: radioVal("food_allergy"),
    food_allergy_specify: fv("f-food") || null,
    drug_allergy: radioVal("drug_allergy"),
    drug_allergy_specify: fv("f-drug") || null,
    diabetes: radioVal("diabetes"),
    diabetes_medication: fv("f-dmed") || null,
    history_of_surgery: radioVal("surgery"),
    surgery_procedure: fv("f-surgery") || null,
    mental_health: radioVal("mental"),
    mental_health_notes: fv("f-mental") || null,
    generate_tag: !_editingStudentId &&
      !!(document.getElementById("f-generate-tag") || {}).checked,
  };
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

function saveStudent() {
  var err = validateStudentForm();
  if (err) {
    showError("modal-error", err);
    return;
  }
  clearError("modal-error");

  var payload = buildStudentPayload();
  var method = _editingStudentId ? "PUT" : "POST";
  var path = _editingStudentId ? "/students/" + _editingStudentId : "/students";

    apiFetch(method, path, payload,
      function (data) {
        closeModal();
        loadStudents();
        if (_editingStudentId) {
          showToast("Student record updated successfully.", "success");
        } else {
          var msg = "Student " + payload.student_number + " added.";
          if (data.tag_error) {
            showToast(msg + " However, " + data.tag_error, "error");
          } else if (data.tag) {
            showToast(msg + " QR tag generated — email sent to student.", "success");
          } else {
            showToast(msg, "success");
          }
        }
      },
    function (d) {
      var msg = apiErrorMessage(d, "Save failed.");
      showError("modal-error", msg);
      // Also show as toast so it's visible even if modal scrolled
      showToast(msg, "error");
    }
  );
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", function () {
  // Update UI based on write permissions
  updatePageForWriteAccess();
  
  // Initialize Address Selectors
  if (typeof PhAddressSelector !== 'undefined') {
    _pobSelector = new PhAddressSelector({
      containerId: 'pob-address-container',
      targetInputId: 'f-pob',
      includeBarangay: false,
      streetPlaceholder: 'City/Municipality, Province (or type custom text)'
    });
    _homeSelector = new PhAddressSelector({
      containerId: 'home-address-container',
      targetInputId: 'f-address',
      includeBarangay: true
    });
    _guardianSelector = new PhAddressSelector({
      containerId: 'guardian-address-container',
      targetInputId: 'f-gaddress',
      includeBarangay: true
    });
  }

  // Listen for permission updates
  window.addEventListener('userInfoCached', function() {
    updatePageForWriteAccess();
    // Optionally reload students if permissions changed
    loadStudents();
  });

  // Wire pill label clicks to update visual state
  var pillPairs = [
    { name: 'hypertension', noId: 'pill-hyp-no', yesId: 'pill-hyp-yes', detailId: 'hypertension-med', cardId: 'card-hypertension' },
    { name: 'health_disease', noId: 'pill-hd-no', yesId: 'pill-hd-yes', detailId: 'disease-diag', cardId: 'card-health-disease' },
    { name: 'food_allergy', noId: 'pill-fa-no', yesId: 'pill-fa-yes', detailId: 'food-specify', cardId: 'card-food-allergy' },
    { name: 'drug_allergy', noId: 'pill-da-no', yesId: 'pill-da-yes', detailId: 'drug-specify', cardId: 'card-drug-allergy' },
    { name: 'diabetes', noId: 'pill-db-no', yesId: 'pill-db-yes', detailId: 'diabetes-med', cardId: 'card-diabetes' },
    { name: 'surgery', noId: 'pill-sx-no', yesId: 'pill-sx-yes', detailId: 'surgery-proc', cardId: 'card-surgery' },
    { name: 'mental', noId: 'pill-mh-no', yesId: 'pill-mh-yes', detailId: 'mental-notes', cardId: 'card-mental' },
    { name: 'covid', noId: 'pill-cv-no', yesId: 'pill-cv-yes', detailId: 'covid-details', cardId: 'card-covid' },
  ];
  pillPairs.forEach(function(p) {
    var noEl = document.getElementById(p.noId);
    var yesEl = document.getElementById(p.yesId);
    function updatePills(isYes) {
      if (noEl)  { noEl.classList.toggle('no-active', !isYes);  noEl.classList.remove('yes-active'); }
      if (yesEl) { yesEl.classList.toggle('yes-active', isYes); yesEl.classList.remove('no-active'); }
      toggleMedCard(p.detailId, p.cardId, isYes);
    }
    document.querySelectorAll('input[name="' + p.name + '"]').forEach(function(radio) {
      radio.addEventListener('change', function() { updatePills(this.value === 'true'); });
    });
  });

  // Buttons
  document.getElementById("btn-add").onclick = openAddStudent;
  document.getElementById("btn-toggle-archived").onclick = toggleArchivedView;

  // Close modal on backdrop click
  document.getElementById("modal-overlay").onclick = function (e) {
    if (e.target === this) closeModal();
  };

  // Auto-calculate age from birthdate
  var bd = document.getElementById("f-birthdate");
  if (bd) {
    bd.addEventListener("change", function () {
      var parsed = parseBirthdateInput(bd.value);
      if (parsed) {
        var age = calcAgeFromBirthdate(parsed);
        if (age != null) fsv("f-age", String(age));
      }
    });
  }

  // Live email validation
  var emailEl = document.getElementById("f-email");
  if (emailEl) {
    emailEl.addEventListener("blur", function () {
      var v = this.value.trim();
      if (v) setFieldError("err-email", !isEvsuEmail(v));
    });
    emailEl.addEventListener("input", function () {
      setFieldError("err-email", false);
    });
  }

  // Live phone validation
  function wirePhone(inputId, errId) {
    var el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener("blur", function () {
      var v = this.value.trim();
      if (v) setFieldError(errId, !isPhilippineMobile(v));
    });
    el.addEventListener("input", function () {
      setFieldError(errId, false);
    });
  }
  wirePhone("f-contact", "err-contact");
  wirePhone("f-gcontact", "err-gcontact");

  // Client-side search — reset to page 1 on new search
  var searchEl = document.getElementById("student-search");
  if (searchEl) {
    searchEl.addEventListener("input", function () {
      _currentPage = 1;
      renderStudents(_allStudents);
    });
  }

  // Course filter
  populateCourseFilter();
  var courseEl = document.getElementById("course-filter");
  if (courseEl) {
    courseEl.addEventListener("change", function () {
      _courseFilter = this.value;
      _currentPage = 1;
      renderStudents(_allStudents);
    });
    // Focus style
    courseEl.addEventListener("focus", function () {
      this.style.borderColor = "var(--brand)";
      this.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.1)";
    });
    courseEl.addEventListener("blur", function () {
      this.style.borderColor = "var(--border)";
      this.style.boxShadow = "";
    });
  }

  loadStudents();

  // Show 'New Semester' button for admins
  var role = localStorage.getItem('role') || '';
  if (role === 'admin') {
    var semBtn = document.getElementById('btn-new-semester');
    if (semBtn) semBtn.style.display = '';
  }
});


// ---------------------------------------------------------------------------
// Send Invite
// ---------------------------------------------------------------------------

function sendInvite(studentId, studentName) {
  showConfirm({
    title: 'Send Invite Link',
    message: 'Send a portal invite email to ' + studentName + '? This will generate a new access link and email it to the student.',
    confirmLabel: 'Send Invite'
  }).then(function (ok) {
    if (ok) {
      apiFetch('POST', '/students/' + studentId + '/send-invite', null,
        function (data) {
          showToast(data.message || 'Invite sent!', 'success');
        },
        function (err) {
          showToast(apiErrorMessage(err, 'Failed to send invite.'), 'error');
        }
      );
    }
  });
}


// ---------------------------------------------------------------------------
// New Semester
// ---------------------------------------------------------------------------

function startNewSemester() {
  showConfirm({
    title: 'Start New Semester',
    message: 'This will set all active students to "pending continuation" and send them an email to confirm they want to continue the service. Students who do not confirm within 14 days can be archived. Are you sure you want to proceed?',
    danger: true,
    confirmLabel: 'Start New Semester'
  }).then(function (ok) {
    if (ok) {
      apiFetch('POST', '/students/new-semester', null,
        function (data) {
          showToast(data.message || 'New semester started!', 'success');
          loadStudents();
        },
        function (err) {
          showToast(apiErrorMessage(err, 'Failed to start new semester.'), 'error');
        }
      );
    }
  });
}


// Auto-refresh
function refreshData() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay && overlay.classList.contains('open')) return;
  loadStudents();
}
