/**
 * screens/ScannerScreen.tsx
 * -------------------------
 * QR code scanner screen for CRCY Responders.
 * Uses react-native-vision-camera + vision-camera-code-scanner.
 * On a valid scan, calls the backend and navigates to ResultScreen.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { scanTag } from '../utils/scanner';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation }: Props) {
  const devices = useCameraDevices();
  const device = devices.back;
  const [hasPermission, setHasPermission] = useState(false);
  const [scanning, setScanning] = useState(true);

  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  });

  useEffect(() => {
    Camera.requestCameraPermission().then((status) => {
      setHasPermission(status === 'authorized');
    });
  }, []);

  useEffect(() => {
    if (!scanning || !barcodes.length) return;

    const payload = barcodes[0]?.displayValue;
    if (!payload) return;

    setScanning(false); // prevent duplicate scans

    scanTag(payload)
      .then((data) => {
        navigation.navigate('Result', { data });
      })
      .catch((err) => {
        Alert.alert('Scan Failed', err.message, [
          { text: 'Try Again', onPress: () => setScanning(true) },
        ]);
      });
  }, [barcodes]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Camera permission is required to scan QR codes.</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={scanning}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>Point camera at student QR tag</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: {
    position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center',
  },
  hint: {
    color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, fontSize: 14,
  },
});
