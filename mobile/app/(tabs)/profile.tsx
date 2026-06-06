/**
 * Profile screen — view info, update name, logout
 */

import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,

  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getMe, logout } from "../../src/api/auth";
import { updateMyProfile } from "../../src/api/responder";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { colors, spacing } from "../../src/theme";

interface Me {
  id: string;
  email: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  full_name: string;
  role: string;
}

export default function ProfileScreen() {
  const [me, setMe] = useState<Me | null>(null);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    getMe()
      .then((data) => {
        setMe(data);
        setFirstName(data.first_name);
        setMiddleName(data.middle_name || "");
        setLastName(data.last_name);
      })
      .catch(() => setLoadError("Failed to load profile."));
  }, []);



  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setSaveMsg("First and last name are required.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      await updateMyProfile({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
      });
      setSaveMsg("Profile updated.");
      if (me) {
        const fn = firstName.trim();
        const mn = middleName.trim();
        const ln = lastName.trim();
        const computed = mn ? `${fn} ${mn} ${ln}` : `${fn} ${ln}`;
        setMe({ ...me, first_name: fn, middle_name: mn || null, last_name: ln, full_name: computed });
      }
    } catch (e: any) {
      setSaveMsg(e.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/");
        },
      },
    ]);
  }

  if (!me && !loadError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Button label="Sign Out" variant="outline" onPress={handleLogout} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Avatar / identity */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {me!.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{me!.full_name}</Text>
          <Text style={styles.email}>{me!.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>CRCY Responder</Text>
          </View>
        </View>

        {/* Edit name */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Update Personal Details</Text>
          <Input
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <Input
            label="Middle Name"
            value={middleName}
            onChangeText={setMiddleName}
            autoCapitalize="words"
          />
          <Input
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
          {saveMsg ? (
            <Text style={[styles.saveMsg, saveMsg.includes("failed") || saveMsg.includes("Failed") || saveMsg.includes("required") ? styles.saveMsgError : null]}>
              {saveMsg}
            </Text>
          ) : null}
          <Button
            label="Save Changes"
            onPress={handleSave}
            loading={saving}
            disabled={firstName.trim() === me!.first_name && middleName.trim() === (me!.middle_name || "") && lastName.trim() === me!.last_name}
          />
        </View>

        {/* Sign out */}
        <Button
          label="Sign Out"
          variant="danger"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center",
  },
  avatarCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.white,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.white,
  },
  email: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginTop: spacing.xs,
  },
  roleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  saveMsg: {
    fontSize: 13,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  saveMsgError: {
    color: colors.danger,
  },
  logoutBtn: {
    marginTop: spacing.sm,
  },
});
