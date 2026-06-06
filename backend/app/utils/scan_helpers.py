"""Helpers to build scan API responses and allergy/medical summaries."""

from app.db.models import Student


def format_allergies(student: Student) -> str | None:
    parts = []
    if student.food_allergy and student.food_allergy_specify:
        parts.append(f"Food: {student.food_allergy_specify}")
    if student.drug_allergy and student.drug_allergy_specify:
        parts.append(f"Drug: {student.drug_allergy_specify}")
    return "\n".join(parts) if parts else None


def format_medical_notes(student: Student) -> str | None:
    notes = []
    if student.hypertension and student.hypertension_medication:
        notes.append(f"Hypertension: {student.hypertension_medication}")
    if student.diabetes and student.diabetes_medication:
        notes.append(f"Diabetes: {student.diabetes_medication}")
    if student.health_disease and student.health_disease_diagnosis:
        notes.append(f"Condition: {student.health_disease_diagnosis}")
    if student.history_of_surgery and student.surgery_procedure:
        notes.append(f"Surgery: {student.surgery_procedure}")
    if student.mental_health and student.mental_health_notes:
        notes.append(f"Mental health: {student.mental_health_notes}")
    if student.covid_vaccinated:
        covid = []
        if student.covid_vaccine_brand:
            covid.append(student.covid_vaccine_brand)
        if student.covid_dose1:
            covid.append(f"Dose 1 ({student.covid_dose1})")
        if student.covid_dose2:
            covid.append(f"Dose 2 ({student.covid_dose2})")
        if student.covid_booster:
            covid.append(f"Booster ({student.covid_booster})")
        if covid:
            notes.append("Covid Vaccine: " + ", ".join(covid))
    return "\n".join(notes) if notes else None


def build_scan_response(student: Student) -> dict:
    """Full scan payload for responder app (includes mobile-friendly aliases)."""
    allergies = format_allergies(student)
    medical_notes = format_medical_notes(student)
    return {
        "student_number": student.student_number,
        "full_name": student.full_name,
        "program": student.program,
        "blood_type": student.blood_type,
        "food_allergy": student.food_allergy,
        "food_allergy_specify": student.food_allergy_specify,
        "drug_allergy": student.drug_allergy,
        "drug_allergy_specify": student.drug_allergy_specify,
        "hypertension": student.hypertension,
        "hypertension_medication": student.hypertension_medication,
        "diabetes": student.diabetes,
        "diabetes_medication": student.diabetes_medication,
        "history_of_surgery": student.history_of_surgery,
        "surgery_procedure": student.surgery_procedure,
        "mental_health": student.mental_health,
        "mental_health_notes": student.mental_health_notes,
        "health_disease": student.health_disease,
        "health_disease_diagnosis": student.health_disease_diagnosis,
        "covid_vaccinated": student.covid_vaccinated,
        "covid_vaccine_brand": student.covid_vaccine_brand,
        "covid_dose1": student.covid_dose1,
        "covid_dose2": student.covid_dose2,
        "covid_booster": student.covid_booster,
        "guardian_name": " ".join(filter(None, [getattr(student, 'guardian_first_name', None), getattr(student, 'guardian_middle_name', None), getattr(student, 'guardian_last_name', None)])) or None,
        "guardian_contact": student.guardian_contact,
        "allergies": allergies,
        "medical_notes": medical_notes,
        "emergency_contact_name": (" ".join(filter(None, [getattr(student, 'guardian_first_name', None), getattr(student, 'guardian_middle_name', None), getattr(student, 'guardian_last_name', None)])) or None) or student.full_name,
        "emergency_contact_phone": student.guardian_contact or student.contact_number,
    }
