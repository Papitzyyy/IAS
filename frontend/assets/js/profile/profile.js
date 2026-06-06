/**
 * profile/profile.js
 * ------------------
 * Responder self-service profile update page.
 * Depends on: app.js, validators.js
 */

// ---------------------------------------------------------------------------
// Load current user info
// ---------------------------------------------------------------------------

function loadMyProfile() {
  var token = localStorage.getItem("access_token");
  fetch(API_BASE + "/responders/me-info", {
    headers: { "Authorization": "Bearer " + token },
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;
      document.getElementById("display-name").textContent  = d.full_name  || "—";
      document.getElementById("display-email").textContent = d.email || "—";
    })
    .catch(function () {});
}

// ---------------------------------------------------------------------------
// Save profile
// ---------------------------------------------------------------------------

function saveProfile() {
  var name     = document.getElementById("f-name").value.trim();
  var email    = document.getElementById("f-email").value.trim();
  var password = document.getElementById("f-password").value;
  var confirm  = document.getElementById("f-confirm").value;

  clearError("form-error");
  hideEl("form-success");

  if (!name && !email && !password) {
    showError("form-error", "No changes to save.");
    showToast("No changes to save.", "warning");
    return;
  }

  // Email validation
  if (email && !isEvsuEmail(email)) {
    showError("form-error", "Email must be a valid @evsu.edu.ph address.");
    return;
  }

  // Password validation
  if (password) {
    if (password !== confirm) {
      showError("form-error", "Passwords do not match.");
      return;
    }
    var pwErrors = validatePasswordStrength(password);
    if (pwErrors.length) {
      showError("form-error", "Password too weak — " + pwErrors[0]);
      return;
    }
  }

  var body = {};
  if (name)     body.full_name = name;
  if (email)    body.email     = email;
  if (password) body.password  = password;

  apiFetch("PUT", "/responders/me", body,
    function (d) {
      document.getElementById("display-name").textContent  = d.full_name  || "—";
      document.getElementById("display-email").textContent = d.email || "—";
      document.getElementById("f-name").value     = "";
      document.getElementById("f-email").value    = "";
      document.getElementById("f-password").value = "";
      document.getElementById("f-confirm").value  = "";
      var ok = document.getElementById("form-success");
      ok.textContent = "Profile updated successfully.";
      ok.style.display = "block";
      showToast("Profile updated successfully.", "success");
    },
    function (d) {
      var msg = apiErrorMessage(d, "Update failed.");
      showError("form-error", msg);
      showToast(msg, "error");
    }
  );
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", loadMyProfile);

