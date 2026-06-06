/**
 * OTP screen — Step 2: verify 6-digit code
 */

import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { verifyOtp, checkAuthStatus } from "../src/api/auth";
import { Button } from "../src/components/Button";
import { colors, spacing } from "../src/theme";

export default function OtpScreen() {
  const { email, password, attempt_id: initialAttemptId } = useLocalSearchParams<{ email: string; password?: string; attempt_id?: string }>();
  const [attemptId, setAttemptId] = useState(initialAttemptId);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(!initialAttemptId);
  const inputs = useRef<(TextInput | null)[]>([]);
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!attemptId || authorized) return;

    // Poll for authorization status every 3 seconds
    pollTimer.current = setInterval(async () => {
      try {
        const res = await checkAuthStatus(attemptId);
        if (res.is_authorized) {
          setAuthorized(true);
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch (e) {
        // Silently ignore network errors during polling
      }
    }, 3000);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [attemptId, authorized]);

  async function handleResend() {
    if (!password) {
      setError("Cannot resend. Please go back and log in again.");
      return;
    }
    setResending(true);
    setError("");
    try {
      const { login } = require("../src/api/auth");
      const res = await login(email, password);
      setAttemptId(res.attempt_id);
      setError("A new link has been sent to your email.");
    } catch (e: any) {
      setError(e.message || "Failed to resend link.");
    } finally {
      setResending(false);
    }
  }

  function handleChange(text: string, index: number) {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter the full 6-digit code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await verifyOtp(email!, code);
      if (res.role !== "responder") {
        setError("This app is for CRCY Responders only.");
        return;
      }
      router.replace("/(tabs)/scanner");
    } catch (e: any) {
      setError(e.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.heading}>Check your email</Text>
        <Text style={styles.sub}>
          We sent a 6-digit code to{"\n"}
          <Text style={styles.email}>{email}</Text>
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!authorized ? (
          <View style={styles.waitingBox}>
            <Text style={styles.waitingText}>
              Please click the secure link we sent to your email to authorize this device.
            </Text>
            <Text style={styles.waitingTextSmall}>
              Waiting for authorization...
            </Text>
            <Button
              label="Resend Link"
              variant="outline"
              onPress={handleResend}
              loading={resending}
              style={{ marginTop: spacing.md, width: "100%" }}
            />
          </View>
        ) : (
          <>
            {/* OTP digit boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={(t) => handleChange(t, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  accessibilityLabel={`OTP digit ${i + 1}`}
                />
              ))}
            </View>

            <Text style={styles.hint}>
              Code expires in 15 minutes. Max 3 attempts.
            </Text>

            <Button
              label="Verify & Sign In"
              onPress={handleVerify}
              loading={loading}
              style={styles.btn}
            />
          </>
        )}

        <Button
          label="Back to Login"
          variant="outline"
          onPress={() => router.back()}
          style={styles.btnBack}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  email: {
    fontWeight: "700",
    color: colors.primary,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 6,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    backgroundColor: colors.card,
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: "#fef2f2",
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  btn: {
    marginBottom: spacing.sm,
  },
  btnBack: {},
  waitingBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  waitingText: {
    fontSize: 14,
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
    fontWeight: "600",
    lineHeight: 22,
  },
  waitingTextSmall: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
