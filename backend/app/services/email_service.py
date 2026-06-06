"""
services/email_service.py
--------------------------
Outbound email with branded HTML templates.
No emoji — all icons are inline SVG for consistent rendering across email clients.
"""

import httpx
from pathlib import Path
from urllib.parse import quote_plus

from app.core.config import settings

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

# ---------------------------------------------------------------------------
# Reusable inline SVG icons (email-safe, no external resources)
# ---------------------------------------------------------------------------

def _icon(path_d: str, color: str = "#374151", size: int = 16) -> str:
    """Render a single-path SVG icon inline."""
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" '
        f'stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
        f'style="vertical-align:middle;margin-right:6px;">{path_d}</svg>'
    )

ICON_CLOCK    = _icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', "#b45309")
ICON_WARNING  = _icon('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', "#9a3412")
ICON_ALERT    = _icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', "#991b1b")
ICON_LOCK     = _icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', "#92400e")
ICON_CHECK    = _icon('<polyline points="20 6 9 17 4 12"/>', "#15803d")
ICON_DASH     = _icon('<line x1="5" y1="12" x2="19" y2="12"/>', "#9ca3af")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _render_template(content_html: str, subject: str) -> str:
    base = (_TEMPLATE_DIR / "base.html").read_text(encoding="utf-8")
    return base.replace("{{ subject }}", subject).replace("{{ content }}", content_html).replace("{{ frontend_url }}", settings.FRONTEND_URL.rstrip('/'))


def _send(to: str, subject: str, html_body: str) -> None:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    smtp_host = "smtp-relay.brevo.com"
    smtp_port = 2525  # Reverting to 2525 as 587 is blocked/not working
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"CRCY Scan and Help <{settings.EMAIL_FROM}>"
    msg["To"] = to
    
    part = MIMEText(html_body, "html")
    msg.attach(part)
    
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15.0) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.BREVO_SMTP_LOGIN, settings.BREVO_SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email via Brevo SMTP to {to}: {e}")


# ---------------------------------------------------------------------------
# OTP login email
# ---------------------------------------------------------------------------

def send_otp_email(to: str, otp: str, full_name: str) -> None:
    subject = "Your CRCY Scan and Help Login Code"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      We received a sign-in request for your account. Use the code below to complete your login.
    </p>

    <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:12px;
                padding:24px 16px;text-align:center;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.1em;
                text-transform:uppercase;color:#2563eb;">Your One-Time Code</p>
      <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:0.4em;
                color:#1e3a5f;font-family:'Courier New',monospace;line-height:1.2;">
        {otp}
      </p>
    </div>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;
                padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_CLOCK}
        This code expires in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.
        You have up to {settings.OTP_MAX_ATTEMPTS} attempts before it is locked.
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#9ca3af;">
      If you did not attempt to log in, someone may have your credentials.
      Contact your system administrator immediately.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# QR tag created email
# ---------------------------------------------------------------------------

def send_tag_created_email(
    to: str,
    full_name: str,
    student_number: str,
    food_allergy: bool,
    food_allergy_specify: str | None,
    drug_allergy: bool,
    drug_allergy_specify: str | None,
    token_uuid: str,
    qr_payload: str,
    deactivation_signature: str,
    # Extended medical profile fields
    blood_type: str | None = None,
    guardian_name: str | None = None,
    guardian_contact: str | None = None,
    hypertension: bool = False,
    hypertension_medication: str | None = None,
    diabetes: bool = False,
    diabetes_medication: str | None = None,
    health_disease: bool = False,
    health_disease_diagnosis: str | None = None,
    history_of_surgery: bool = False,
    surgery_procedure: str | None = None,
    mental_health: bool = False,
    mental_health_notes: str | None = None,
    covid_vaccinated: bool = False,
    covid_vaccine_brand: str | None = None,
    covid_booster: str | None = None,
) -> None:
    deactivation_url = (
        f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/v1/deactivate-tag/{token_uuid}"
        f"?sig={deactivation_signature}"
    )
    qr_image_url = (
        "https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=" +
        quote_plus(qr_payload)
    )
    subject = "Your EVSU Medical QR Tag Has Been Created"

    _none = "<span style='color:#9ca3af;'>None recorded</span>"

    def _row(label: str, value: str | None) -> str:
        cell = value if value else _none
        return (
            f"<tr>"
            f"<td style='padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;"
            f"font-weight:600;color:#6b7280;width:42%;'>{label}</td>"
            f"<td style='padding:10px 12px;border:1px solid #e5e7eb;color:#374151;'>{cell}</td>"
            f"</tr>"
        )

    # Build condition rows — only show flagged conditions
    food_val  = food_allergy_specify if food_allergy else None
    drug_val  = drug_allergy_specify if drug_allergy else None
    htn_val   = f"Yes — {hypertension_medication}" if hypertension and hypertension_medication else ("Yes" if hypertension else None)
    diab_val  = f"Yes — {diabetes_medication}" if diabetes and diabetes_medication else ("Yes" if diabetes else None)
    hd_val    = f"Yes — {health_disease_diagnosis}" if health_disease and health_disease_diagnosis else ("Yes" if health_disease else None)
    surg_val  = f"Yes — {surgery_procedure}" if history_of_surgery and surgery_procedure else ("Yes" if history_of_surgery else None)
    mh_val    = f"Yes — {mental_health_notes}" if mental_health and mental_health_notes else ("Yes" if mental_health else None)

    covid_parts = []
    if covid_vaccinated:
        if covid_vaccine_brand:
            covid_parts.append(covid_vaccine_brand)
        if covid_booster:
            covid_parts.append(f"Booster: {covid_booster}")
    covid_val = ", ".join(covid_parts) if covid_parts else ("Yes" if covid_vaccinated else None)

    medical_rows = (
        _row("Blood Type", blood_type)
        + _row("Food Allergies", food_val)
        + _row("Drug / Medicine Allergies", drug_val)
        + _row("Hypertension", htn_val)
        + _row("Diabetes", diab_val)
        + _row("Heart / Health Disease", hd_val)
        + _row("History of Surgery", surg_val)
        + _row("Mental Health Condition", mh_val)
        + _row("COVID-19 Vaccination", covid_val)
        + _row("Emergency Guardian", guardian_name)
        + _row("Guardian Contact", guardian_contact)
    )

    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      A medical QR tag has been created for you at the <strong>EVSU Ormoc Campus Clinic</strong>.
      This tag is used by clinic responders to quickly access your medical information in an emergency.
    </p>

    <div style="text-align:center;margin:0 0 20px;">
      <img src="{qr_image_url}" alt="Medical QR tag" style="width:220px;height:220px;border:1px solid #e5e7eb;border-radius:18px;background:#ffffff;display:block;margin:0 auto 16px;" />
      <p style="margin:0;font-size:12px;color:#6b7280;">If the QR image does not load, use the payload below.</p>
    </div>

    <div style="background:#f8fafc;border-radius:12px;padding:12px;margin-bottom:20px;font-size:13px;color:#334155;word-break:break-all;">
      <p style="margin:0 0 8px;font-weight:700;">QR Tag Payload</p>
      <p style="margin:0;font-family:monospace;">{qr_payload}</p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;
                text-transform:uppercase;color:#16a34a;">Tag Issued To</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#14532d;">{full_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;">{student_number}</p>
    </div>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Medical Profile on File</p>
    <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">
      The following information is encoded in your QR tag and will be shown to authorized
      CRCY Responders during a medical emergency.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px;">
      {medical_rows}
    </table>

    <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;
                padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#9a3412;">
        {ICON_WARNING} Did not authorize this?
      </p>
      <p style="margin:0 0 10px;font-size:13px;color:#7c2d12;">
        If you did not request this tag, click the button below to deactivate it immediately.
      </p>
      <a href="{deactivation_url}"
         style="display:inline-block;background:#dc2626;color:#ffffff;font-size:13px;
                font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">
        Deactivate My Medical Tag
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Keep this email for your records. Visit the EVSU Ormoc Clinic if you have any questions
      or need to update your information.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# QR tag deactivated email
# ---------------------------------------------------------------------------

def send_tag_deactivated_email(to: str, full_name: str) -> None:
    subject = "Your EVSU Medical QR Tag Has Been Deactivated"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      Your EVSU Ormoc Campus medical QR tag has been <strong>deactivated</strong>.
      It can no longer be scanned by clinic responders.
    </p>

    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;
                padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#7f1d1d;">
        {ICON_ALERT}
        If you did <strong>not</strong> request this deactivation, please visit the
        <strong>EVSU Ormoc Clinic immediately</strong> to have your tag reissued.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      A new tag can be issued to you by the clinic administrator at any time.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Staff account created email
# ---------------------------------------------------------------------------

def send_staff_created_email(to: str, full_name: str, admin_name: str) -> None:
    subject = "Your CRCY Scan and Help Staff Account Has Been Created"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      A staff account has been created for you on the
      <strong>CRCY Scan and Help — EVSU Ormoc Campus</strong> system by
      <strong>{admin_name}</strong>.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
                padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;
                text-transform:uppercase;color:#1d4ed8;">Account Details</p>
      <p style="margin:4px 0 0;font-size:14px;color:#1e3a5f;">
        <strong>Email:</strong> {to}
      </p>
    </div>

    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
      You can log in using your EVSU email address and the password provided to you by the administrator.
      You will be asked to verify your identity with a one-time code sent to this email on each login.
    </p>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;
                padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_LOCK}
        For security, please update your password from your profile dashboard after your first login.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      If you did not expect this account, please contact the EVSU Ormoc Clinic immediately.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Staff permissions updated email
# ---------------------------------------------------------------------------

def send_staff_permissions_email(
    to: str,
    full_name: str,
    admin_name: str,
    permissions: dict,
) -> None:
    subject = "Your CRCY Scan and Help Access Permissions Have Been Updated"

    MODULE_LABELS = {
        "students":   "Student Profiles",
        "tags":       "QR Tags",
        "responders": "Responders",
        "audit":      "Audit Logs",
    }

    rows = ""
    for module, perms in permissions.items():
        label = MODULE_LABELS.get(module, module.capitalize())
        read_cell  = (
            f'<span style="color:#15803d;font-weight:600;">{ICON_CHECK} Yes</span>'
            if "read" in perms else
            f'<span style="color:#9ca3af;">{ICON_DASH} No</span>'
        )
        write_cell = (
            f'<span style="color:#15803d;font-weight:600;">{ICON_CHECK} Yes</span>'
            if "write" in perms else
            f'<span style="color:#9ca3af;">{ICON_DASH} No</span>'
        )
        rows += f"""
      <tr>
        <td style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;
                   font-weight:600;color:#374151;">{label}</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:center;">{read_cell}</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;text-align:center;">{write_cell}</td>
      </tr>"""

    if not rows:
        rows = """
      <tr>
        <td colspan="3" style="padding:12px;border:1px solid #e5e7eb;text-align:center;
                               color:#9ca3af;font-size:13px;">No module access granted.</td>
      </tr>"""

    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      Your access permissions on the <strong>CRCY Scan and Help</strong> system have been
      updated by <strong>{admin_name}</strong>. Your current module access is shown below.
    </p>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Module Access</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px;">
      <tr>
        <th style="padding:10px 12px;background:#f3f4f6;border:1px solid #e5e7eb;
                   text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;
                   letter-spacing:0.06em;">Module</th>
        <th style="padding:10px 12px;background:#f3f4f6;border:1px solid #e5e7eb;
                   text-align:center;color:#6b7280;font-size:11px;text-transform:uppercase;
                   letter-spacing:0.06em;width:80px;">Read</th>
        <th style="padding:10px 12px;background:#f3f4f6;border:1px solid #e5e7eb;
                   text-align:center;color:#6b7280;font-size:11px;text-transform:uppercase;
                   letter-spacing:0.06em;width:80px;">Write</th>
      </tr>
      {rows}
    </table>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      If you believe this change is incorrect, please contact the clinic administrator.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Password reset email
# ---------------------------------------------------------------------------

def send_password_reset_email(to: str, otp: str, full_name: str) -> None:
    subject = "Your CRCY Scan and Help Password Reset Code"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      We received a request to reset your password. Use the code below to complete the reset.
    </p>

    <div style="background:#eff6ff;border:2px solid #2563eb;border-radius:12px;
                padding:24px 16px;text-align:center;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.1em;
                text-transform:uppercase;color:#2563eb;">Your Password Reset Code</p>
      <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:0.4em;
                color:#1e3a5f;font-family:'Courier New',monospace;line-height:1.2;">
        {otp}
      </p>
    </div>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;
                padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_CLOCK}
        This code expires in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.
        You have up to {settings.OTP_MAX_ATTEMPTS} attempts before it is locked.
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#9ca3af;">
      If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Staff account archived email
# ---------------------------------------------------------------------------

def send_staff_archived_email(to: str, full_name: str, admin_name: str) -> None:
    subject = "Your CRCY Scan and Help Staff Account Has Been Archived"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      Your staff account on the <strong>CRCY Scan and Help — EVSU Ormoc Campus</strong> system has been
      <strong>archived (deactivated)</strong> by <strong>{admin_name}</strong>.
    </p>

    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;
                padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#7f1d1d;">
        {ICON_ALERT}
        You will no longer be able to log in or access the portal. If you believe this is in error,
        please contact the clinic administrator immediately.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      This is an automated security notification.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Responder account created email
# ---------------------------------------------------------------------------

def send_responder_created_email(to: str, full_name: str, admin_name: str) -> None:
    subject = "Your CRCY Scan and Help Responder Account Has Been Created"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      A responder account has been created for you on the
      <strong>CRCY Scan and Help — EVSU Ormoc Campus</strong> system by
      <strong>{admin_name}</strong>.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
                padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;
                text-transform:uppercase;color:#1d4ed8;">Responder Account Details</p>
      <p style="margin:4px 0 0;font-size:14px;color:#1e3a5f;">
        <strong>Email:</strong> {to}
      </p>
    </div>

    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
      You can now log in to the Responder Mobile App using your registered email and the password
      provided by the administrator.
    </p>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;
                padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_LOCK}
        For security, please update your password from the mobile app settings after your first login.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      If you did not expect this account, please contact the EVSU Ormoc Clinic immediately.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Student profile updated email
# ---------------------------------------------------------------------------

def send_student_updated_email(to: str, full_name: str, student_number: str, student) -> None:
    """Notify a student that their medical profile has been updated."""
    subject = "Your EVSU Medical Profile Has Been Updated"

    _none = "<span style='color:#9ca3af;'>None recorded</span>"

    def _row(label: str, value: str | None) -> str:
        cell = value if value else _none
        return (
            f"<tr>"
            f"<td style='padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;"
            f"font-weight:600;color:#6b7280;width:42%;'>{label}</td>"
            f"<td style='padding:10px 12px;border:1px solid #e5e7eb;color:#374151;'>{cell}</td>"
            f"</tr>"
        )

    food_val  = student.food_allergy_specify if student.food_allergy else None
    drug_val  = student.drug_allergy_specify if student.drug_allergy else None
    htn_val   = f"Yes — {student.hypertension_medication}" if student.hypertension and student.hypertension_medication else ("Yes" if student.hypertension else None)
    diab_val  = f"Yes — {student.diabetes_medication}" if student.diabetes and student.diabetes_medication else ("Yes" if student.diabetes else None)
    hd_val    = f"Yes — {student.health_disease_diagnosis}" if student.health_disease and student.health_disease_diagnosis else ("Yes" if student.health_disease else None)
    surg_val  = f"Yes — {student.surgery_procedure}" if student.history_of_surgery and student.surgery_procedure else ("Yes" if student.history_of_surgery else None)
    mh_val    = f"Yes — {student.mental_health_notes}" if student.mental_health and student.mental_health_notes else ("Yes" if student.mental_health else None)

    medical_rows = (
        _row("Blood Type", student.blood_type)
        + _row("Food Allergies", food_val)
        + _row("Drug / Medicine Allergies", drug_val)
        + _row("Hypertension", htn_val)
        + _row("Diabetes", diab_val)
        + _row("Heart / Health Disease", hd_val)
        + _row("History of Surgery", surg_val)
        + _row("Mental Health Condition", mh_val)
        + _row("Emergency Guardian", " ".join(filter(None, [getattr(student, 'guardian_first_name', None), getattr(student, 'guardian_middle_name', None), getattr(student, 'guardian_last_name', None)])) or None)
        + _row("Guardian Contact", student.guardian_contact)
    )

    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      Your medical profile at the <strong>EVSU Ormoc Campus Clinic</strong> has been
      <strong>updated</strong> by a clinic administrator.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
                padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;
                text-transform:uppercase;color:#1d4ed8;">Student Record</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#14532d;">{full_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;">{student_number}</p>
    </div>

    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Updated Medical Profile</p>
    <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">
      The following is your current medical information on file.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px;">
      {medical_rows}
    </table>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;
                padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_WARNING} If any of the above information is incorrect, please visit the
        <strong>EVSU Ormoc Clinic</strong> to request a correction.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      This is an automated notification. Keep this email for your records.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Account Email Verification
# ---------------------------------------------------------------------------

def send_verification_email(to: str, full_name: str, admin_name: str, token: str) -> None:
    subject = "Verify Your CRCY Scan and Help Account"
    verify_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/verify-email?token={token}"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      An account has been created for you on the <strong>CRCY Scan and Help — EVSU Ormoc Campus</strong> system by <strong>{admin_name}</strong>.
      Before you can log in, you must verify your email address.
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a href="{verify_url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
        Verify Email Address
      </a>
    </div>

    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">
      Or, copy and paste this link into your browser:<br>
      <a href="{verify_url}" style="color:#2563eb;word-break:break-all;">{verify_url}</a>
    </p>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_WARNING} <strong>Please ignore this email if this is not you.</strong> Your account will not be fully active until you verify your email address.
      </p>
    </div>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Student Account Created Email
# ---------------------------------------------------------------------------

def send_student_created_email(to: str, full_name: str, student_number: str) -> None:
    subject = "Your Medical Profile Has Been Registered"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      We are writing to inform you that your medical profile has been successfully registered into the <strong>CRCY Scan and Help System</strong> at the EVSU Ormoc Campus Clinic.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;">Student Details</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#14532d;">{full_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;">{student_number}</p>
    </div>

    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
      This registration allows clinic responders to quickly access your chosen emergency medical details during campus medical crises.
    </p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px;">
      If you did not submit a medical consent form or if you wish to withdraw your data from the system, please visit the EVSU clinic.
    </p>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_WARNING} Please ignore this email if you did not expect this notification.
      </p>
    </div>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Login Authorization Email (MFA Step 1)
# ---------------------------------------------------------------------------

def send_login_authorization_email(to: str, full_name: str, auth_token: str, ip_address: str) -> None:
    subject = "Verify Your Login Attempt"
    # This URL points to the backend endpoint that will mark it authorized and send the OTP.
    auth_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/api/v1/auth/authorize-login?token={auth_token}"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      We received a sign-in request for your account from IP address <strong>{ip_address}</strong>.
      To proceed with the login, please confirm that this is you.
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a href="{auth_url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
        Yes, it's me
      </a>
    </div>

    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">
      Once you click the link, a 6-digit verification code will be sent to your email to complete the login on your original device.
    </p>

    <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#713f12;">
        {ICON_WARNING} <strong>If this wasn't you:</strong> do not click the link and contact your administrator immediately.
      </p>
    </div>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Student Portal Invite Email
# ---------------------------------------------------------------------------

def send_student_invite_email(to: str, full_name: str, student_number: str, token: str) -> None:
    """Send an email with a link for the student to fill out their medical profile."""
    portal_url = f"{settings.FRONTEND_URL.rstrip('/')}/pages/student-portal.html?token={token}"
    subject = "Complete Your EVSU Medical Profile"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      You have been registered in the <strong>CRCY Scan and Help System</strong> at the
      EVSU Ormoc Campus Clinic. Please complete your medical profile by clicking the link below.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;">Your Student Details</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#14532d;">{full_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;">{student_number}</p>
    </div>

    <div style="text-align:center;margin:30px 0;">
      <a href="{portal_url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Complete My Profile
      </a>
    </div>

    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">
      Or, copy and paste this link into your browser:<br>
      <a href="{portal_url}" style="color:#2563eb;word-break:break-all;">{portal_url}</a>
    </p>

    <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#14532d;">
        {ICON_CHECK} This link is <strong>private to you</strong>. You can use it anytime to view or update your medical profile.
        Do not share this link with anyone.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      If you did not expect this email, please contact the EVSU Ormoc Clinic.
    </p>
    """
    _send(to, subject, _render_template(content, subject))


# ---------------------------------------------------------------------------
# Semester Continuation Email
# ---------------------------------------------------------------------------

def send_semester_continuation_email(
    to: str, full_name: str, student_number: str, token: str, deadline: str
) -> None:
    """Send an email asking the student to confirm they want to continue the clinic service."""
    portal_url = f"{settings.FRONTEND_URL.rstrip('/')}/pages/student-portal.html?token={token}&action=continue"
    subject = "Continue Your EVSU Clinic Service for the New Semester"
    content = f"""
    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#1f2937;">Hi {full_name},</p>
    <p style="margin:0 0 20px;color:#6b7280;">
      A new semester has started at <strong>EVSU Ormoc Campus</strong>. The clinic is asking
      all registered students to confirm whether they wish to <strong>continue the CRCY Scan and Help service</strong>.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;">Your Student Record</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#14532d;">{full_name}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#166534;font-family:monospace;">{student_number}</p>
    </div>

    <div style="text-align:center;margin:30px 0;">
      <a href="{portal_url}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
        Yes, Continue My Service
      </a>
    </div>

    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">
      Or, copy and paste this link into your browser:<br>
      <a href="{portal_url}" style="color:#2563eb;word-break:break-all;">{portal_url}</a>
    </p>

    <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#7f1d1d;">
        {ICON_WARNING} <strong>Deadline: {deadline}</strong><br>
        If you do not confirm by this date, your record will be archived and your QR tag will be deactivated.
      </p>
    </div>

    <p style="margin:0;font-size:12px;color:#9ca3af;">
      If you have any questions, please visit the EVSU Ormoc Clinic.
    </p>
    """
    _send(to, subject, _render_template(content, subject))
