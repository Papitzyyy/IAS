/**
 * Client-side validation helpers (server still enforces all rules).
 */
var EVSU_EMAIL_DOMAIN = "@evsu.edu.ph";

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isEvsuEmail(email) {
  var e = normalizeEmail(email);
  if (!e || e.indexOf("@") < 0) return false;
  return e.endsWith(EVSU_EMAIL_DOMAIN) && e.length > EVSU_EMAIL_DOMAIN.length + 1;
}

function normalizePhilippinePhone(raw) {
  var digits = (raw || "").replace(/\D/g, "");
  if (digits.indexOf("63") === 0 && digits.length === 12) digits = "0" + digits.slice(2);
  if (digits.length === 10 && digits.charAt(0) === "9") digits = "0" + digits;
  return digits;
}

function isPhilippineMobile(raw) {
  var n = normalizePhilippinePhone(raw);
  return /^09\d{9}$/.test(n);
}

function formatDisplayPhone(raw) {
  var n = normalizePhilippinePhone(raw);
  if (!/^09\d{9}$/.test(n)) return raw || "";
  return n.slice(0, 4) + " " + n.slice(4, 7) + " " + n.slice(7);
}

function buildFullName(first, middle, last, suffix) {
  var parts = [(first || "").trim(), (middle || "").trim(), (last || "").trim()]
    .filter(Boolean);
  var name = parts.join(" ");
  var suf = (suffix || "").trim();
  if (suf) name += (suf.match(/^(jr|sr|ii|iii|iv)/i) ? ", " : " ") + suf;
  return name.trim();
}

function parseBirthdateInput(value) {
  if (!value) return null;
  var d = new Date(value + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  var yyyy = d.getFullYear();
  return mm + "/" + dd + "/" + yyyy;
}

function birthdateToInputValue(mmddyyyy) {
  if (!mmddyyyy) return "";
  var m = mmddyyyy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return m[3] + "-" + m[1].padStart(2, "0") + "-" + m[2].padStart(2, "0");
}

function calcAgeFromBirthdate(mmddyyyy) {
  var m = (mmddyyyy || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  var birth = new Date(parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10));
  var today = new Date();
  var age = today.getFullYear() - birth.getFullYear();
  var md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

/**
 * Validate password strength.
 * Returns an array of error strings. Empty array = password is acceptable.
 *
 * Requirements:
 *   - At least 12 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 *   - At least one special character
 */
function validatePasswordStrength(password) {
  var errors = [];
  if (!password || password.length < 12) {
    errors.push("At least 12 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("At least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("At least one lowercase letter");
  }
  if (!/\d/.test(password)) {
    errors.push("At least one number");
  }
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(password)) {
    errors.push("At least one special character (!@#$%^&*...)");
  }
  return errors;
}

/**
 * Returns a strength label and color for a password.
 * { label: "Weak" | "Fair" | "Strong" | "Very Strong", color: "#..." }
 */
function passwordStrengthInfo(password) {
  var errors = validatePasswordStrength(password);
  var score = 5 - errors.length;
  if (score <= 1) return { label: "Very Weak", color: "#dc2626" };
  if (score === 2) return { label: "Weak", color: "#f97316" };
  if (score === 3) return { label: "Fair", color: "#eab308" };
  if (score === 4) return { label: "Strong", color: "#22c55e" };
  return { label: "Very Strong", color: "#16a34a" };
}
