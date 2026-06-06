import { apiFetch } from "./client";

export interface ScanResult {
  student_number: string;
  full_name: string;
  program: string | null;
  blood_type: string | null;
  food_allergy: boolean;
  food_allergy_specify: string | null;
  drug_allergy: boolean;
  drug_allergy_specify: string | null;
  hypertension: boolean;
  hypertension_medication: string | null;
  health_disease: boolean;
  health_disease_diagnosis: string | null;
  diabetes: boolean;
  diabetes_medication: string | null;
  history_of_surgery: boolean;
  surgery_procedure: string | null;
  mental_health: boolean;
  mental_health_notes: string | null;
  covid_vaccinated: boolean;
  covid_dose1: string | null;
  covid_dose2: string | null;
  covid_booster: string | null;
  covid_vaccine_brand: string | null;
  guardian_name: string | null;
  guardian_contact: string | null;
  allergies: string | null;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export async function scanTag(qrPayload: string): Promise<ScanResult> {
  // Encode the payload so the dot separator doesn't break the URL path
  const encoded = encodeURIComponent(qrPayload);
  return apiFetch<ScanResult>(`/scan-tag/${encoded}`);
}

export interface SearchResult {
  id: string;
  student_number: string;
  full_name: string;
  program: string | null;
}

export async function searchStudents(query: string): Promise<SearchResult[]> {
  const encoded = encodeURIComponent(query);
  return apiFetch<SearchResult[]>(`/search-students?query=${encoded}`);
}

export async function getStudentProfile(studentNumber: string): Promise<ScanResult> {
  const encoded = encodeURIComponent(studentNumber);
  return apiFetch<ScanResult>(`/student-profile/${encoded}`);
}
