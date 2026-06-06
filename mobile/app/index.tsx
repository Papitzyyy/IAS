/**
 * Login screen — Step 1: email + password
 * Includes a ⚙️ Settings button to configure the backend server IP.
 */

import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { login } from "../src/api/auth";
import { getToken, SERVER_KEY, saveServer, getServer } from "../src/api/client";
import { Button } from "../src/components/Button";
import { Input } from "../src/components/Input";
import { colors, spacing } from "../src/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // ── Settings Modal State ──
  const [showSettings, setShowSettings] = useState(false);
  const [serverAddress, setServerAddress] = useState("");
  const [currentBackend, setCurrentBackend] = useState("");

  useEffect(() => {
    // Check if user is already logged in
    getToken().then((token: string | null) => {
      if (token) {
        router.replace("/(tabs)/scanner");
      } else {
        setChecking(false);
      }
    }).catch(() => {
      setChecking(false);
    });

    // Load current server set in store
    getServer().then((val: string | null) => {
      if (val) {
        setCurrentBackend(val);
        setServerAddress(val);
      } else {
        setCurrentBackend("ias-online.onrender.com");
      }
    }).catch(() => {
      setCurrentBackend("ias-online.onrender.com");
    });
  }, []);

  async function handleSaveServer() {
    await saveServer(serverAddress.trim());
    setCurrentBackend(serverAddress.trim() || "ias-online.onrender.com");
    setShowSettings(false);
  }

  // Show a loading screen while checking for existing session
  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  async function handleLogin() {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      // Pass email, password, and attempt_id to OTP screen for resending
      router.push({ pathname: "/otp", params: { email: email.trim().toLowerCase(), password, attempt_id: res.attempt_id } });
    } catch (e: any) {
      setError(e.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>CRCY</Text>
          </View>
          <Text style={styles.title}>Scan and Help</Text>
          <Text style={styles.subtitle}>EVSU Ormoc Campus — Responder App</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSub}>
            Use your EVSU institutional email and password.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@evsu.edu.ph"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••••••"
          />

          <Button
            label="Continue"
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {/* Server Config Switcher */}
        <TouchableOpacity 
          style={styles.settingsRow} 
          onPress={() => setShowSettings(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
          <Text style={styles.settingsText}>{currentBackend}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Authorized CRCY Responders only.{"\n"}
          Contact your clinic admin if you need access.
        </Text>

        {/* Settings Modal */}
        <Modal
          visible={showSettings}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Backend Settings</Text>
              <Text style={styles.modalSub}>
                Configure the API server address. For Render, enter the full domain.
              </Text>

              <View style={styles.modalHint}>
                <Text style={styles.hintTitle}>Examples:</Text>
                <Text style={styles.hintText}>• ias-fw7q.onrender.com</Text>
                <Text style={styles.hintText}>• 192.168.1.5:8000 (Local)</Text>
              </View>

              <Input
                label="Server Address"
                value={serverAddress}
                onChangeText={setServerAddress}
                placeholder="ias-xxx.onrender.com"
                autoCapitalize="none"
              />

              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: spacing.md, alignItems: "center" }}
                  onPress={() => setShowSettings(false)}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <Button
                  label="Save"
                  onPress={handleSaveServer}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginBottom: spacing.sm,
  },
  badgeText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
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
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  settingsIcon: {
    fontSize: 16,
  },
  settingsText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "monospace",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    lineHeight: 18,
  },
  // ── Modal styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalHint: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  hintText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
