import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { api, CoachResult, DailySummary } from "@/lib/api";

export default function CoachScreen() {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api<DailySummary>("/api/meals/today")
        .then((data) => {
          setSummary(data);
          setSelectedMealId(data.logs.at(-1)?.id ?? null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load meals"));
    }, []),
  );

  async function analyze() {
    if (!selectedMealId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<CoachResult>("/api/coach/analyze", {
        method: "POST",
        body: JSON.stringify({ mealLogId: selectedMealId }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The Coach is unavailable");
    } finally {
      setLoading(false);
    }
  }

  const statusStyles =
    result?.compliance_status === "SAFE"
      ? { bg: "#dcfce7", fg: "#15803d" }
      : result?.compliance_status === "WARNING"
        ? { bg: "#fef3c7", fg: "#b45309" }
        : { bg: "#fee2e2", fg: "#b91c1c" };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>The Coach</Text>
        <Text style={styles.heroSub}>
          Your Filipino clinical nutrition assistant. Pick a meal and get personalized, culturally
          aware feedback.
        </Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Choose a meal today</Text>
        {!summary || summary.logs.length === 0 ? (
          <Text style={styles.empty}>Log a meal first, then come back for feedback.</Text>
        ) : (
          summary.logs.map((log) => (
            <Pressable
              key={log.id}
              onPress={() => setSelectedMealId(log.id)}
              style={[styles.mealOption, selectedMealId === log.id && styles.mealOptionActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{log.dishName}</Text>
                <Text style={styles.mealMeta}>
                  {log.mealType} · Na {Math.round(log.totals.sodiumMg)} mg · GL{" "}
                  {log.totals.glycemicLoad.toFixed(1)}
                </Text>
              </View>
              {selectedMealId === log.id && <Text style={styles.check}>✓</Text>}
            </Pressable>
          ))
        )}
      </View>

      <Pressable
        style={[styles.button, (!selectedMealId || loading) && styles.buttonDisabled]}
        onPress={analyze}
        disabled={!selectedMealId || loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ask The Coach</Text>}
      </Pressable>

      {result && (
        <View style={styles.card}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyles.bg }]}>
            <Text style={[styles.statusText, { color: statusStyles.fg }]}>
              {result.compliance_status}
            </Text>
          </View>

          <Text style={styles.feedback}>{result.feedback_message}</Text>

          {result.flagged_ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Flagged ingredients</Text>
              <View style={styles.chips}>
                {result.flagged_ingredients.map((item) => (
                  <View key={item} style={styles.flagChip}>
                    <Text style={styles.flagChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {result.suggested_substitutions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Try these swaps</Text>
              {result.suggested_substitutions.map((swap) => (
                <View key={swap.original} style={styles.swap}>
                  <Text style={styles.swapOriginal}>{swap.original}</Text>
                  <Text style={styles.swapArrow}>→</Text>
                  <Text style={styles.swapReplacement}>{swap.replacement}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.adjustment}>
            <Text style={styles.adjustmentLabel}>Next meal adjustment</Text>
            <Text style={styles.adjustmentText}>{result.macro_adjustment_next_meal}</Text>
          </View>

          <Text style={styles.source}>
            {result.source === "ai" ? "AI-assisted, engine-verified" : "Clinical engine (offline fallback)"}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  hero: { backgroundColor: "#15803d", borderRadius: 16, padding: 20 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroSub: { color: "#dcfce7", fontSize: 13, marginTop: 6, lineHeight: 19 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  mealOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
  },
  mealOptionActive: { backgroundColor: "#dcfce7" },
  mealName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  mealMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  check: { color: "#15803d", fontWeight: "800", fontSize: 16 },
  button: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  feedback: { fontSize: 14, color: "#334155", lineHeight: 21 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagChip: { backgroundColor: "#fee2e2", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  flagChipText: { fontSize: 12, color: "#b91c1c", fontWeight: "600" },
  swap: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 10, gap: 2 },
  swapOriginal: { fontSize: 12, color: "#94a3b8", textDecorationLine: "line-through" },
  swapArrow: { fontSize: 12, color: "#94a3b8" },
  swapReplacement: { fontSize: 13, color: "#15803d", fontWeight: "600" },
  adjustment: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12 },
  adjustmentLabel: { fontSize: 11, fontWeight: "700", color: "#15803d", textTransform: "uppercase" },
  adjustmentText: { fontSize: 13, color: "#166534", marginTop: 4 },
  source: { fontSize: 10, color: "#cbd5e1", textAlign: "right" },
  error: { color: "#b91c1c", fontSize: 13 },
  empty: { fontSize: 13, color: "#94a3b8" },
});
