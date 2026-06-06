/**
 * Scanner screen — camera QR scan → calls /api/v1/scan-tag/{payload}
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { scanTag } from "../../src/api/scan";
import { colors, spacing } from "../../src/theme";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cooldown = useRef(false);

  // Re-enable scanning every time the scanner tab gains focus
  useFocusEffect(
    useCallback(() => {
      setScanning(true);
      setError("");
      setLoading(false);
      cooldown.current = false;
    }, [])
  );

  async function handleBarCodeScanned({ data }: { data: string }) {
    if (!scanning || cooldown.current || loading) return;

    // Basic format check — valid payload is <uuid>.<64-char hex>
    if (!data.includes(".")) {
      setError("Not a valid CRCY QR tag.");
      return;
    }

    cooldown.current = true;
    setScanning(false);
    setLoading(true);
    setError("");

    try {
      const result = await scanTag(data);
      router.push({
        pathname: "/result",
        params: { data: JSON.stringify(result) },
      });
    } catch (e: any) {
      setError(e.message || "Failed to load student profile.");
      // Allow retry after 2 seconds
      setTimeout(() => {
        setScanning(true);
        cooldown.current = false;
      }, 2000);
    } finally {
      setLoading(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is required to scan QR tags.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.instruction}>
          Point the camera at a student's QR tag
        </Text>

        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>

        {loading && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={colors.white} />
            <Text style={styles.statusText}>Verifying tag…</Text>
          </View>
        )}

        {error ? (
          <View style={[styles.statusBox, styles.errorBox]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const CORNER = 24;
const BORDER = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  permText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  permBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: 10,
  },
  permBtnText: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  instruction: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    overflow: "hidden",
  },
  viewfinder: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: colors.white,
  },
  tl: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  tr: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  bl: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  br: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
  },
  statusText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: "rgba(220,38,38,0.85)",
  },
  errorText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
