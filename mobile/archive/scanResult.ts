/**
 * Normalizes API scan response for ResultScreen.
 */
import { ScanResult } from '../navigation/AppNavigator';

export type ApiScanResponse = {
  student_number: string;
  full_name: string;
  allergies?: string | null;
  medical_notes?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  guardian_name?: string | null;
  guardian_contact?: string | null;
  food_allergy?: boolean;
  food_allergy_specify?: string | null;
  drug_allergy?: boolean;
  drug_allergy_specify?: string | null;
};

export function normalizeScanResult(raw: ApiScanResponse): ScanResult {
  let allergies = raw.allergies ?? null;
  if (!allergies) {
    const parts: string[] = [];
    if (raw.food_allergy && raw.food_allergy_specify) {
      parts.push(`Food: ${raw.food_allergy_specify}`);
    }
    if (raw.drug_allergy && raw.drug_allergy_specify) {
      parts.push(`Drug: ${raw.drug_allergy_specify}`);
    }
    allergies = parts.length ? parts.join('; ') : null;
  }

  return {
    student_number: raw.student_number,
    full_name: raw.full_name,
    allergies,
    medical_notes: raw.medical_notes ?? null,
    emergency_contact_name:
      raw.emergency_contact_name ?? raw.guardian_name ?? null,
    emergency_contact_phone:
      raw.emergency_contact_phone ??
      raw.guardian_contact ??
      (raw as { contact_number?: string }).contact_number ??
      null,
  };
}
