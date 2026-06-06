/**
 * Result screen — displays student medical profile after a successful scan.
 * Includes direct-dial shortcut for the emergency guardian.
 */

import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ScanResult } from "../src/api/scan";
import { MedicalRow } from "../src/components/MedicalRow";
import { Button } from "../src/components/Button";
import { colors, spacing } from "../src/theme";

export default function ResultScreen() {
  const { data } = useLocalSearchParams<{ data: string }>();
  const student: ScanResult = JSON.parse(data ?? "{}");

  const dialGuardian = useCallback(() => {
    const phone = student.emergency_contact_phone;
    if (!phone) {
      Alert.alert("No contact", "No guardian contact number on file.");
      return;
    }
    const url = `tel:${phone.replace(/\s+/g, "")}`;
    Linking.canOpenURL(url).then((can) => {
      if (can) Linking.openURL(url);
      else Alert.alert("Cannot dial", "Dialing is not available on this device.");
    });
  }, [student.emergency_contact_phone]);

  const hasAllergy = student.food_allergy || student.drug_allergy;
  const hasCritical =
    hasAllergy ||
    student.hypertension ||
    student.diabetes ||
    student.health_disease ||
    student.mental_health;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Student identity */}
      <View style={styles.identityCard}>
        <Text style={styles.studentName}>{student.full_name}</Text>
        <Text style={styles.studentNumber}>{student.student_number}</Text>
        {student.program ? (
          <Text style={styles.program}>{student.program}</Text>
        ) : null}
        {student.blood_type ? (
          <View style={styles.bloodBadge}>
            <Text style={styles.bloodText}>Blood Type: {student.blood_type}</Text>
          </View>
        ) : null}
      </View>

      {/* Critical alert banner */}
      {hasCritical && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertTitle}>⚠ Medical Alerts on File</Text>
          {student.allergies ? (
            <Text style={styles.alertDetail}>Allergies: {student.allergies}</Text>
          ) : null}
          {student.medical_notes ? (
            <Text style={styles.alertDetail}>Conditions: {student.medical_notes}</Text>
          ) : null}
        </View>
      )}

      {/* Emergency contact — prominent call button */}
      <View style={styles.guardianCard}>
        <View style={styles.guardianInfo}>
          <Text style={styles.guardianLabel}>Emergency Guardian</Text>
          <Text style={styles.guardianName}>
            {student.emergency_contact_name ?? "Not on file"}
          </Text>
          {student.emergency_contact_phone ? (
            <Text style={styles.guardianPhone}>
              {student.emergency_contact_phone}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.callBtn,
            !student.emergency_contact_phone && styles.callBtnDisabled,
          ]}
          onPress={dialGuardian}
          disabled={!student.emergency_contact_phone}
          accessibilityRole="button"
          accessibilityLabel="Call guardian"
        >
          <Text style={styles.callBtnText}>📞 Call</Text>
        </TouchableOpacity>
      </View>

      {/* Full medical profile */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Medical Profile</Text>

        <MedicalRow label="Blood Type" value={student.blood_type || "Unknown"} />
        
        <Text style={[styles.sectionTitle, { marginTop: spacing.md, fontSize: 13, color: colors.textSecondary }]}>Conditions & Allergies</Text>

        <MedicalRow
          label="Hypertension"
          value={student.hypertension ? `Yes\n↳ ${student.hypertension_medication || "No medication"}` : "No"}
          highlight={student.hypertension}
        />
        <MedicalRow
          label="Health Diseases"
          value={student.health_disease ? `Yes\n↳ ${student.health_disease_diagnosis || "No diagnosis"}` : "No"}
          highlight={student.health_disease}
        />
        <MedicalRow
          label="Food Allergies"
          value={student.food_allergy ? `Yes\n↳ ${student.food_allergy_specify || "No specifics"}` : "No"}
          highlight={student.food_allergy}
        />
        <MedicalRow
          label="Drug Allergies"
          value={student.drug_allergy ? `Yes\n↳ ${student.drug_allergy_specify || "No specifics"}` : "No"}
          highlight={student.drug_allergy}
        />
        <MedicalRow
          label="Diabetes"
          value={student.diabetes ? `Yes\n↳ ${student.diabetes_medication || "No medication"}` : "No"}
          highlight={student.diabetes}
        />
        <MedicalRow
          label="History of Surgery"
          value={student.history_of_surgery ? `Yes\n↳ ${student.surgery_procedure || "No procedure specifics"}` : "No"}
          highlight={student.history_of_surgery}
        />
        <MedicalRow
          label="Mental Health"
          value={student.mental_health ? `Yes\n↳ ${student.mental_health_notes || "No notes"}` : "No"}
          highlight={student.mental_health}
        />
      </View>

      <Button
        label="Scan Another Tag"
        variant="outline"
        onPress={() => router.back()}
        style={styles.scanAgainBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  identityCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  studentName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.white,
    textAlign: "center",
  },
  studentNumber: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "monospace",
  },
  program: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  bloodBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginTop: spacing.xs,
  },
  bloodText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  alertBanner: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.xs,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
  },
  alertDetail: {
    fontSize: 13,
    color: "#7f1d1d",
    lineHeight: 18,
  },
  guardianCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  guardianInfo: {
    flex: 1,
    gap: 2,
  },
  guardianLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  guardianName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  guardianPhone: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  callBtn: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
    minWidth: 80,
    alignItems: "center",
  },
  callBtnDisabled: {
    backgroundColor: colors.border,
  },
  callBtnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  scanAgainBtn: {
    marginTop: spacing.xs,
  },
});
