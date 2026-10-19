import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api, DailySummary } from "@/lib/api";
import { cacheSummary, getCachedSummary } from "@/lib/db";
import { flushPendingLogs } from "@/lib/sync";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function NutrientBar({
  label,
  current,
  target,
  unit,
  danger,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  danger: boolean;
}) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, danger && styles.barDanger]}>
          {Math.round(current)} / {Math.round(target)} {unit}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%` },
            danger ? styles.barFillDanger : styles.barFillGood,
          ]}
        />
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      await flushPendingLogs().catch(() => undefined);
      const data = await api<DailySummary>("/api/meals/today");
      setSummary(data);
      setOffline(false);
      await cacheSummary(data);
    } catch {
      const cached = await getCachedSummary(todayKey());
      if (cached) {
        setSummary(cached);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptyText}>Log your first Filipino dish to see your daily targets.</Text>
      </View>
    );
  }

  const { totals, targets } = summary;
  const sodiumDanger = totals.sodiumMg >= targets.sodiumMg;
  const potassiumDanger = totals.potassiumMg >= targets.potassiumMg;
  const glDanger = totals.glycemicLoad > targets.glycemicLoad;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />}
    >
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline mode — showing your last synced data.</Text>
        </View>
      )}

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Today's calories</Text>
        <Text style={styles.heroValue}>{Math.round(totals.calories)}</Text>
        <Text style={styles.heroTarget}>of {targets.calories} kcal</Text>
        <Text style={styles.heroRemaining}>
          {summary.remaining.calories} kcal remaining
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Clinical limits</Text>
        <NutrientBar
          label="Sodium"
          current={totals.sodiumMg}
          target={targets.sodiumMg}
          unit="mg"
          danger={sodiumDanger}
        />
        <NutrientBar
          label="Potassium"
          current={totals.potassiumMg}
          target={targets.potassiumMg}
          unit="mg"
          danger={potassiumDanger}
        />
        <NutrientBar
          label="Protein"
          current={totals.proteinG}
          target={targets.proteinG}
          unit="g"
          danger={totals.proteinG > targets.proteinG}
        />
        <NutrientBar
          label="Glycemic load"
          current={totals.glycemicLoad}
          target={targets.glycemicLoad}
          unit=""
          danger={glDanger}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Meals today</Text>
        {summary.logs.length === 0 ? (
          <Text style={styles.emptyText}>Nothing logged yet. Tap "Food database" to start.</Text>
        ) : (
          summary.logs.map((log) => (
            <View key={log.id} style={styles.mealRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{log.dishName}</Text>
                <Text style={styles.mealMeta}>
                  {log.mealType} · {log.portionMultiplier}x {log.servingUnit}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.mealCalories}>{Math.round(log.totals.calories)} kcal</Text>
                <Text style={styles.mealMeta}>Na {Math.round(log.totals.sodiumMg)} mg</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  offlineBanner: { backgroundColor: "#fef3c7", borderRadius: 10, padding: 10 },
  offlineText: { color: "#92400e", fontSize: 12, textAlign: "center" },
  hero: { backgroundColor: "#15803d", borderRadius: 16, padding: 20, alignItems: "center" },
  heroLabel: { color: "#bbf7d0", fontSize: 13, fontWeight: "600" },
  heroValue: { color: "#fff", fontSize: 44, fontWeight: "800", marginTop: 4 },
  heroTarget: { color: "#dcfce7", fontSize: 14 },
  heroRemaining: { color: "#bbf7d0", fontSize: 12, marginTop: 8 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  barRow: { gap: 6 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 13, color: "#475569", fontWeight: "600" },
  barValue: { fontSize: 12, color: "#64748b" },
  barDanger: { color: "#dc2626", fontWeight: "700" },
  barTrack: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 999 },
  barFillGood: { backgroundColor: "#22c55e" },
  barFillDanger: { backgroundColor: "#ef4444" },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  mealName: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  mealMeta: { fontSize: 11, color: "#94a3b8", textTransform: "capitalize" },
  mealCalories: { fontSize: 14, fontWeight: "700", color: "#15803d" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 4 },
});
