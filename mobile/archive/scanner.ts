/**
 * utils/scanner.ts
 * ----------------
 * Sends a scanned QR payload to the backend and returns the student's medical data.
 */

import { apiRequest } from '../api/client';
import { ScanResult } from '../navigation/AppNavigator';
import { ApiScanResponse, normalizeScanResult } from './scanResult';

export async function scanTag(qrPayload: string): Promise<ScanResult> {
  const encoded = encodeURIComponent(qrPayload);
  const raw = await apiRequest<ApiScanResponse>(`/scan-tag/${encoded}`);
  return normalizeScanResult(raw);
}
