import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

interface Props {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}

export function MedicalRow({ label, value, highlight = false }: Props) {
  const hasValue = value && value.trim().length > 0;
  return (
    <View style={[styles.row, highlight && hasValue ? styles.highlighted : null]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, !hasValue && styles.none]}>
        {hasValue ? value : "None recorded"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  highlighted: {
    backgroundColor: "#fef2f2",
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    borderBottomColor: "#fecaca",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1.5,
    textAlign: "right",
  },
  none: {
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
