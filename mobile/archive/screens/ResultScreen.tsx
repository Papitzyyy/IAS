/**
 * screens/ResultScreen.tsx
 * Displays medical data after a successful QR scan.
 * Emergency call + SMS to guardian/contact on file.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { data } = route.params;
  const phone = data.emergency_contact_phone;

  const callContact = () => {
    if (!phone) {
      Alert.alert('No contact', 'No emergency contact number on file.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const messageContact = () => {
    if (!phone) {
      Alert.alert('No contact', 'No emergency contact number on file.');
      return;
    }
    const body = encodeURIComponent(
      `Medical emergency involving ${data.full_name} (${data.student_number}). Please respond. — CRCY Scan and Help`
    );
    Linking.openURL(`sms:${phone}?body=${body}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Medical Information</Text>

      <View style={styles.card}>
        <Row label="Student No." value={data.student_number} />
        <Row label="Name" value={data.full_name} />
        <Row
          label="Allergies"
          value={data.allergies || 'None recorded'}
          highlight={!!data.allergies}
        />
        <Row label="Medical Notes" value={data.medical_notes || 'None recorded'} />
        <Row label="Emergency Contact" value={data.emergency_contact_name || '—'} />
        <Row label="Contact Phone" value={data.emergency_contact_phone || '—'} />
      </View>

      {phone ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.callButton} onPress={callContact}>
            <Text style={styles.callButtonText}>
              Call {data.emergency_contact_name || 'Emergency Contact'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smsButton} onPress={messageContact}>
            <Text style={styles.smsButtonText}>Send SMS Alert</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.replace('Scanner')}
      >
        <Text style={styles.backButtonText}>Scan Another</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 24, paddingBottom: 40 },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: { fontSize: 13, color: '#6b7280', flex: 1 },
  value: { fontSize: 14, fontWeight: '500', flex: 2, textAlign: 'right' },
  highlight: { color: '#dc2626', fontWeight: 'bold' },
  actions: { gap: 10, marginBottom: 12 },
  callButton: {
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  callButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  smsButton: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  smsButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backButton: {
    backgroundColor: '#e5e7eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: { color: '#374151', fontWeight: '600', fontSize: 15 },
});
