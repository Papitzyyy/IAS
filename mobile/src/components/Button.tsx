import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
} from "react-native";
import { colors, radius, spacing } from "../theme";

interface Props extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
  variant?: "primary" | "danger" | "outline";
}

export function Button({
  label,
  loading = false,
  variant = "primary",
  style,
  disabled,
  ...rest
}: Props) {
  const bg =
    variant === "danger"
      ? colors.danger
      : variant === "outline"
      ? "transparent"
      : colors.primary;

  const textColor =
    variant === "outline" ? colors.primary : colors.white;

  const borderColor =
    variant === "outline" ? colors.primary : "transparent";

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor, borderWidth: variant === "outline" ? 1.5 : 0 },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.55,
  },
});
