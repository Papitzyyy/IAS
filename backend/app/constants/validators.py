"""Shared validation helpers for API input."""

import re

EVSU_EMAIL_DOMAIN = "@evsu.edu.ph"
PH_MOBILE_RE = re.compile(r"^09\d{9}$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def is_evsu_email(email: str) -> bool:
    e = normalize_email(email)
    return e.endswith(EVSU_EMAIL_DOMAIN) and len(e) > len(EVSU_EMAIL_DOMAIN) + 1


def normalize_ph_phone(raw: str | None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("63") and len(digits) == 12:
        digits = "0" + digits[2:]
    if len(digits) == 10 and digits.startswith("9"):
        digits = "0" + digits
    return digits if PH_MOBILE_RE.match(digits) else None


def build_full_name(
    first_name: str,
    last_name: str,
    middle_name: str | None = None,
    suffix: str | None = None,
) -> str:
    parts = [first_name.strip(), (middle_name or "").strip(), last_name.strip()]
    parts = [p for p in parts if p]
    name = " ".join(parts)
    suf = (suffix or "").strip()
    if suf:
        sep = ", " if re.match(r"^(jr|sr|ii|iii|iv)\.?$", suf, re.I) else " "
        name = f"{name}{sep}{suf}"
    return name.strip()
