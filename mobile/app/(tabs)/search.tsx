import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getStudentProfile, searchStudents, SearchResult } from "../../src/api/scan";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { colors, spacing } from "../../src/theme";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setHasSearched(true);
    
    try {
      const data = await searchStudents(query.trim());
      setResults(data);
    } catch (e: any) {
      setError(e.message || "Search failed.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(studentNumber: string) {
    if (loadingProfile) return;
    setLoadingProfile(true);
    setError("");
    
    try {
      const profile = await getStudentProfile(studentNumber);
      router.push({
        pathname: "/result",
        params: { data: JSON.stringify(profile) },
      });
    } catch (e: any) {
      setError(e.message || "Failed to load student profile.");
    } finally {
      setLoadingProfile(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchHeader}>
          <Text style={styles.title}>Manual Lookup</Text>
          <Text style={styles.subtitle}>
            Search by Student ID or Name if QR scan is unavailable.
          </Text>
          
          <View style={styles.searchRow}>
            <View style={{ flex: 1 }}>
              <Input
                label=""
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. 2023-12345 or Juan"
                autoCapitalize="none"
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <Button
              label="Search"
              onPress={handleSearch}
              loading={searching}
              style={styles.searchBtn}
            />
          </View>
          
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Results */}
        {loadingProfile && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            hasSearched && !searching ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No students found matching '{query}'</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultCard}
              onPress={() => handleSelect(item.student_number)}
              activeOpacity={0.7}
            >
              <View style={styles.resultLeft}>
                <Text style={styles.resultName}>{item.full_name}</Text>
                <Text style={styles.resultId}>{item.student_number}</Text>
              </View>
              <View style={styles.resultRight}>
                <Text style={styles.resultProgram}>{item.program || "No Program"}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchHeader: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  searchBtn: {
    marginTop: 0,
    height: 48,
    paddingHorizontal: spacing.md,
  },
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: 6,
    padding: spacing.sm + 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultLeft: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 2,
  },
  resultId: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  resultRight: {
    paddingLeft: spacing.md,
    alignItems: "flex-end",
  },
  resultProgram: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: spacing.md,
    fontWeight: "600",
    color: colors.primary,
  },
});
