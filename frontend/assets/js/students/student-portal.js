/**
 * student-portal.js
 * -----------------
 * Client-side logic for the student self-service portal.
 * Reads ?token= from URL, fetches profile data, allows editing, and handles
 * semester continuation.
 *
 * This page is standalone — no auth session, no sidebar.
 */

var API_BASE = "/api/v1";
var _portalToken = "";
var _studentData = null;

// Medical toggle state
var _medState = {
  hypertension: false,
  disease: false,
  food: false,
  drug: false,
  diabetes: false,
  surgery: false,
  mental: false,
  covid: false,
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

(function init() {
  var params = new URLSearchParams(window.location.search);
  _portalToken = params.get("token") || "";
  var action = params.get("action") || "";

  if (!_portalToken) {
    showPortalError("Missing Access Token", "No token was provided in the URL. Please use the link from your email.");
    return;
  }

  // Populate program dropdown
  var sel = document.getElementById("sp-program");
  if (sel && typeof buildProgramSelectOptions === "function") {
    sel.innerHTML = buildProgramSelectOptions("");
  }

  // Birthdate → auto-calc age
  var bdEl = document.getElementById("sp-birthdate");
  if (bdEl) {
    bdEl.addEventListener("change", function () {
      var ageEl = document.getElementById("sp-age");
      if (!this.value) { ageEl.value = ""; return; }
      var bd = new Date(this.value);
      var today = new Date();
      var age = today.getFullYear() - bd.getFullYear();
      var m = today.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
      ageEl.value = age > 0 ? age : "";
    });
  }

  loadPortalProfile(action);
})();


// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

function portalFetch(method, path, body, onSuccess, onError) {
  var separator = path.indexOf("?") >= 0 ? "&" : "?";
  var url = API_BASE + path + separator + "token=" + encodeURIComponent(_portalToken);

  var opts = {
    method: method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  fetch(url, opts)
    .then(function (r) {
      return r.json().then(function (d) {
        return { ok: r.ok, status: r.status, data: d };
      });
    })
    .then(function (r) {
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
// Load Profile
// ---------------------------------------------------------------------------

function loadPortalProfile(action) {
  portalFetch("GET", "/student-portal", null,
    function (data) {
      _studentData = data;
      populateForm(data);

      document.getElementById("portal-loading").style.display = "none";
      document.getElementById("portal-main").style.display = "block";

      // Handle continuation action from email link
      if (action === "continue" && data.enrollment_status === "pending_continuation") {
        var banner = document.getElementById("continuation-banner");
        banner.classList.add("show");
        if (data.enrollment_deadline) {
          var dl = new Date(data.enrollment_deadline);
          document.getElementById("continuation-deadline").textContent =
            "Deadline: " + dl.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        }
      }

      // Show continuation banner for pending students even without action param
      if (data.enrollment_status === "pending_continuation") {
        var banner2 = document.getElementById("continuation-banner");
        banner2.classList.add("show");
        if (data.enrollment_deadline) {
          var dl2 = new Date(data.enrollment_deadline);
          document.getElementById("continuation-deadline").textContent =
            "Deadline: " + dl2.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        }
      }
    },
    function (err, status) {
      if (status === 403) {
        showPortalError("Invalid or Expired Link", "This access link is no longer valid. Please contact the EVSU Ormoc Clinic for a new one.");
      } else {
        var msg = (err && err.detail) ? err.detail : "Failed to load your profile. Please try again later.";
        showPortalError("Something Went Wrong", msg);
      }
    }
  );
}


// ---------------------------------------------------------------------------
// Populate Form
// ---------------------------------------------------------------------------

function populateForm(d) {
  // Info bar
  var initials = ((d.first_name || "?")[0] + (d.last_name || "?")[0]).toUpperCase();
  document.getElementById("portal-avatar").textContent = initials;
  document.getElementById("portal-name").textContent = d.full_name || "—";
  document.getElementById("portal-sn").textContent = d.student_number || "—";

  // Status badge
  var badge = document.getElementById("portal-status-badge");
  if (d.is_archived) {
    badge.className = "badge badge-archived";
    badge.textContent = "Archived";
  } else if (d.enrollment_status === "pending_continuation") {
    badge.className = "badge badge-pending";
    badge.textContent = "Pending Continuation";
  } else {
    badge.className = "badge badge-active";
    badge.textContent = "Active";
  }

  // Personal
  document.getElementById("sp-sn").value = d.student_number || "";
  document.getElementById("sp-email").value = d.email || "";
  if (typeof buildProgramSelectOptions === "function") {
    document.getElementById("sp-program").innerHTML = buildProgramSelectOptions(d.program || "");
  }
  document.getElementById("sp-last").value = d.last_name || "";
  document.getElementById("sp-first").value = d.first_name || "";
  document.getElementById("sp-middle").value = d.middle_name || "";
  document.getElementById("sp-suffix").value = d.suffix || "";

  // Birthdate — convert mm/dd/yyyy string to date input format
  if (d.birthdate) {
    var parts = d.birthdate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      var yyyy = parts[3];
      var mm = parts[1].padStart(2, "0");
      var dd = parts[2].padStart(2, "0");
      document.getElementById("sp-birthdate").value = yyyy + "-" + mm + "-" + dd;
    } else {
      document.getElementById("sp-birthdate").value = d.birthdate;
    }
  }
  document.getElementById("sp-age").value = d.age || "";
  document.getElementById("sp-gender").value = d.gender || "";
  document.getElementById("sp-pob").value = d.place_of_birth || "";
  document.getElementById("sp-address").value = d.address || "";
  document.getElementById("sp-contact").value = d.contact_number || "";

  // Guardian
  document.getElementById("sp-gfirst").value = d.guardian_first_name || "";
  document.getElementById("sp-gmiddle").value = d.guardian_middle_name || "";
  document.getElementById("sp-glast").value = d.guardian_last_name || "";
  document.getElementById("sp-gcontact").value = d.guardian_contact || "";
  document.getElementById("sp-gaddress").value = d.guardian_address || "";

  // Medical
  document.getElementById("sp-blood").value = d.blood_type || "";
  document.getElementById("sp-hmed").value = d.hypertension_medication || "";
  document.getElementById("sp-diag").value = d.health_disease_diagnosis || "";
  document.getElementById("sp-food").value = d.food_allergy_specify || "";
  document.getElementById("sp-drug").value = d.drug_allergy_specify || "";
  document.getElementById("sp-dmed").value = d.diabetes_medication || "";
  document.getElementById("sp-surgery").value = d.surgery_procedure || "";
  document.getElementById("sp-mental").value = d.mental_health_notes || "";
  document.getElementById("sp-dose1").value = d.covid_dose1 || "";
  document.getElementById("sp-dose2").value = d.covid_dose2 || "";
  document.getElementById("sp-booster").value = d.covid_booster || "";
  document.getElementById("sp-vaccine").value = d.covid_vaccine_brand || "";

  // Set medical toggles
  if (d.hypertension) togglePortalMed("hypertension", true);
  if (d.health_disease) togglePortalMed("disease", true);
  if (d.food_allergy) togglePortalMed("food", true);
  if (d.drug_allergy) togglePortalMed("drug", true);
  if (d.diabetes) togglePortalMed("diabetes", true);
  if (d.history_of_surgery) togglePortalMed("surgery", true);
  if (d.mental_health) togglePortalMed("mental", true);
  if (d.covid_vaccinated) togglePortalMed("covid", true);

  // Disable form if archived
  if (d.is_archived) {
    var inputs = document.querySelectorAll(".p-input");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].disabled = true;
    }
    document.getElementById("btn-save-portal").disabled = true;
    document.getElementById("btn-save-portal").textContent = "Record Archived";
  }
}


// ---------------------------------------------------------------------------
// Tab Switching
// ---------------------------------------------------------------------------

function switchPortalTab(tabName) {
  var btns = document.querySelectorAll(".portal-tab-btn");
  var panels = document.querySelectorAll(".portal-tab-panel");

  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.remove("active");
    if (btns[i].getAttribute("data-tab") === tabName) {
      btns[i].classList.add("active");
    }
  }

  for (var j = 0; j < panels.length; j++) {
    panels[j].classList.remove("active");
    if (panels[j].id === "panel-" + tabName) {
      panels[j].classList.add("active");
    }
  }
}


// ---------------------------------------------------------------------------
// Medical Toggle
// ---------------------------------------------------------------------------

function togglePortalMed(key, isYes) {
  _medState[key] = isYes;

  var cardMap = {
    hypertension: { card: "pc-hypertension", detail: "det-hypertension", noId: "pill-sp-hyp-no", yesId: "pill-sp-hyp-yes" },
    disease:      { card: "pc-disease",      detail: "det-disease",      noId: "pill-sp-hd-no",  yesId: "pill-sp-hd-yes" },
    food:         { card: "pc-food",         detail: "det-food",         noId: "pill-sp-fa-no",  yesId: "pill-sp-fa-yes" },
    drug:         { card: "pc-drug",         detail: "det-drug",         noId: "pill-sp-da-no",  yesId: "pill-sp-da-yes" },
    diabetes:     { card: "pc-diabetes",     detail: "det-diabetes",     noId: "pill-sp-db-no",  yesId: "pill-sp-db-yes" },
    surgery:      { card: "pc-surgery",      detail: "det-surgery",      noId: "pill-sp-sx-no",  yesId: "pill-sp-sx-yes" },
    mental:       { card: "pc-mental",       detail: "det-mental",       noId: "pill-sp-mh-no",  yesId: "pill-sp-mh-yes" },
    covid:        { card: "pc-covid",        detail: "det-covid",        noId: "pill-sp-cv-no",  yesId: "pill-sp-cv-yes" },
  };

  var m = cardMap[key];
  if (!m) return;

  var card = document.getElementById(m.card);
  var detail = document.getElementById(m.detail);
  var noEl = document.getElementById(m.noId);
  var yesEl = document.getElementById(m.yesId);

  if (isYes) {
    card.classList.add("yes-active");
    detail.classList.add("show");
    noEl.classList.remove("no-active");
    yesEl.classList.add("yes-active");
  } else {
    card.classList.remove("yes-active");
    detail.classList.remove("show");
    noEl.classList.add("no-active");
    yesEl.classList.remove("yes-active");
  }
}


// ---------------------------------------------------------------------------
// Save Profile
// ---------------------------------------------------------------------------

function savePortalProfile() {
  var alertEl = document.getElementById("portal-alert");
  alertEl.className = "portal-alert";
  alertEl.style.display = "none";
  alertEl.textContent = "";

  var btn = document.getElementById("btn-save-portal");
  btn.disabled = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite;"><circle cx="12" cy="12" r="10"/></svg> Saving…';

  // Build birthdate in mm/dd/yyyy format from the date input
  var bdVal = document.getElementById("sp-birthdate").value;
  var birthdateStr = "";
  if (bdVal) {
    var parts = bdVal.split("-"); // yyyy-mm-dd
    if (parts.length === 3) {
      birthdateStr = parseInt(parts[1], 10) + "/" + parseInt(parts[2], 10) + "/" + parts[0];
    }
  }

  var body = {
    first_name: document.getElementById("sp-first").value.trim() || undefined,
    last_name: document.getElementById("sp-last").value.trim() || undefined,
    middle_name: document.getElementById("sp-middle").value.trim() || undefined,
    suffix: document.getElementById("sp-suffix").value.trim() || undefined,
    program: document.getElementById("sp-program").value || undefined,
    gender: document.getElementById("sp-gender").value || undefined,
    age: document.getElementById("sp-age").value ? parseInt(document.getElementById("sp-age").value, 10) : undefined,
    address: document.getElementById("sp-address").value.trim() || undefined,
    contact_number: document.getElementById("sp-contact").value.trim() || undefined,
    birthdate: birthdateStr || undefined,
    place_of_birth: document.getElementById("sp-pob").value.trim() || undefined,

    guardian_first_name: document.getElementById("sp-gfirst").value.trim() || undefined,
    guardian_middle_name: document.getElementById("sp-gmiddle").value.trim() || undefined,
    guardian_last_name: document.getElementById("sp-glast").value.trim() || undefined,
    guardian_contact: document.getElementById("sp-gcontact").value.trim() || undefined,
    guardian_address: document.getElementById("sp-gaddress").value.trim() || undefined,

    blood_type: document.getElementById("sp-blood").value || undefined,
    hypertension: _medState.hypertension,
    hypertension_medication: _medState.hypertension ? (document.getElementById("sp-hmed").value.trim() || undefined) : undefined,
    health_disease: _medState.disease,
    health_disease_diagnosis: _medState.disease ? (document.getElementById("sp-diag").value.trim() || undefined) : undefined,
    food_allergy: _medState.food,
    food_allergy_specify: _medState.food ? (document.getElementById("sp-food").value.trim() || undefined) : undefined,
    drug_allergy: _medState.drug,
    drug_allergy_specify: _medState.drug ? (document.getElementById("sp-drug").value.trim() || undefined) : undefined,
    diabetes: _medState.diabetes,
    diabetes_medication: _medState.diabetes ? (document.getElementById("sp-dmed").value.trim() || undefined) : undefined,
    history_of_surgery: _medState.surgery,
    surgery_procedure: _medState.surgery ? (document.getElementById("sp-surgery").value.trim() || undefined) : undefined,
    mental_health: _medState.mental,
    mental_health_notes: _medState.mental ? (document.getElementById("sp-mental").value.trim() || undefined) : undefined,
    covid_vaccinated: _medState.covid,
    covid_dose1: _medState.covid ? (document.getElementById("sp-dose1").value || undefined) : undefined,
    covid_dose2: _medState.covid ? (document.getElementById("sp-dose2").value || undefined) : undefined,
    covid_booster: _medState.covid ? (document.getElementById("sp-booster").value || undefined) : undefined,
    covid_vaccine_brand: _medState.covid ? (document.getElementById("sp-vaccine").value.trim() || undefined) : undefined,
  };

  // Remove undefined keys
  Object.keys(body).forEach(function (k) {
    if (body[k] === undefined) delete body[k];
  });

  portalFetch("PUT", "/student-portal", body,
    function (data) {
      _studentData = data;
      populateForm(data);
      showPortalToast("Profile saved successfully!", "success");
      resetSaveBtn();
    },
    function (err) {
      var msg = (err && err.detail) ? err.detail : "Failed to save. Please check your data.";
      alertEl.className = "portal-alert error";
      alertEl.textContent = msg;
      showPortalToast(msg, "error");
      resetSaveBtn();
    }
  );
}

function resetSaveBtn() {
  var btn = document.getElementById("btn-save-portal");
  btn.disabled = false;
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
    " Save Changes";
}


// ---------------------------------------------------------------------------
// Semester Continuation
// ---------------------------------------------------------------------------

function confirmContinuation() {
  var btn = document.getElementById("btn-confirm-continue");
  btn.disabled = true;
  btn.textContent = "Confirming…";

  portalFetch("POST", "/student-portal/continue", null,
    function (data) {
      showPortalToast(data.message || "Enrollment confirmed!", "success");

      // Hide the banner
      document.getElementById("continuation-banner").classList.remove("show");

      // Update badge
      var badge = document.getElementById("portal-status-badge");
      badge.className = "badge badge-active";
      badge.textContent = "Active";

      btn.textContent = "✓ Confirmed!";
    },
    function (err) {
      var msg = (err && err.detail) ? err.detail : "Failed to confirm. Please try again.";
      showPortalToast(msg, "error");
      btn.disabled = false;
      btn.textContent = "✓ Yes, Continue My Service";
    }
  );
}


// ---------------------------------------------------------------------------
// UI Helpers
// ---------------------------------------------------------------------------

function showPortalError(title, msg) {
  document.getElementById("portal-loading").style.display = "none";
  document.getElementById("portal-error-title").textContent = title;
  document.getElementById("portal-error-msg").textContent = msg;
  document.getElementById("portal-error").style.display = "block";
}

function showPortalToast(msg, type) {
  // Remove existing
  var existing = document.querySelector(".portal-toast");
  if (existing) existing.remove();

  var toast = document.createElement("div");
  toast.className = "portal-toast " + (type || "");
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(function () {
    toast.style.transition = "opacity 0.3s";
    toast.style.opacity = "0";
    setTimeout(function () { toast.remove(); }, 300);
  }, 4000);
}
