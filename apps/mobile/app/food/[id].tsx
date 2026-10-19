import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, Food } from "@/lib/api";
import { queueMealLog } from "@/lib/db";
import { flushPendingLogs } from "@/lib/sync";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function FoodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [food, setFood] = useState<Food | null>(null);
  const [portion, setPortion] = useState(1);
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("lunch");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Food>(`/api/foods/${id}`)
      .then(setFood)
      .catch((err) => setError(err instanceof Error ? err.message : "Food not found"));
  }, [id]);

  async function logMeal() {
    if (!food) return;
    setSaving(true);
    const clientUuid = await queueMealLog({
      foodId: food.id,
      portionMultiplier: portion,
      mealType,
      loggedAt: new Date().toISOString(),
    });

    try {
      const result = await flushPendingLogs();
      if (result.failed > 0) {
        Alert.alert(
          "Saved offline",
          "Your meal is saved on this device and will sync when you're back online.",
        );
      }
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Saved offline", "We'll sync your meal once you're online.");
      router.replace("/(tabs)");
    } finally {
      setSaving(false);
      void clientUuid;
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!food) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  const multiplier = portion;
  const sodium = food.sodiumMg * multiplier;
  const potassium = food.potassiumMg * multiplier;
  const gl =
    food.glycemicLoad != null
      ? food.glycemicLoad * multiplier
      : food.glycemicIndex != null
        ? ((food.glycemicIndex * food.carbsG * multiplier) / 100)
        : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{food.dishName}</Text>
        {food.localName && <Text style={styles.local}>{food.localName}</Text>}
        <Text style={styles.serving}>{food.servingUnit}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nutrition per serving</Text>
        <View style={styles.grid}>
          <Nutrient label="Calories" value={`${Math.round(food.calories)} kcal`} />
          <Nutrient label="Protein" value={`${food.proteinG.toFixed(1)} g`} />
          <Nutrient label="Carbs" value={`${food.carbsG.toFixed(1)} g`} />
          <Nutrient label="Fat" value={`${food.fatG.toFixed(1)} g`} />
          <Nutrient label="Sodium" value={`${Math.round(food.sodiumMg)} mg`} danger={food.sodiumMg > 600} />
          <Nutrient label="Potassium" value={`${Math.round(food.potassiumMg)} mg`} />
          <Nutrient label="Phosphorus" value={`${Math.round(food.phosphorusMg)} mg`} />
          <Nutrient label="Glycemic load" value={gl.toFixed(1)} danger={gl > 20} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Portion</Text>
        <View style={styles.portionRow}>
          <Pressable style={styles.stepButton} onPress={() => setPortion((p) => Math.max(0.25, p - 0.25))}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.portionValue}>{portion.toFixed(2)}x</Text>
          <Pressable style={styles.stepButton} onPress={() => setPortion((p) => Math.min(5, p + 0.25))}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.portionHint}>
          This serving: {Math.round(food.calories * multiplier)} kcal · Na {Math.round(sodium)} mg · K{" "}
          {Math.round(potassium)} mg
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Meal</Text>
        <View style={styles.mealTypes}>
          {MEAL_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setMealType(type)}
              style={[styles.chip, mealType === type && styles.chipActive]}
            >
              <Text style={[styles.chipText, mealType === type && styles.chipTextActive]}>
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {food.commonIngredients.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Common ingredients</Text>
          <Text style={styles.ingredients}>{food.commonIngredients.join(" · ")}</Text>
        </View>
      )}

      <Pressable style={styles.logButton} onPress={logMeal} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.logButtonText}>Log this meal</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Nutrient({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.nutrient}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={[styles.nutrientValue, danger && { color: "#dc2626" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#b91c1c" },
  header: { paddingVertical: 8 },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  local: { fontSize: 14, color: "#64748b", fontStyle: "italic" },
  serving: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  nutrient: { width: "47%", backgroundColor: "#f8fafc", borderRadius: 10, padding: 10 },
  nutrientLabel: { fontSize: 11, color: "#94a3b8" },
  nutrientValue: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  portionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 20, fontWeight: "700", color: "#15803d" },
  portionValue: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  portionHint: { fontSize: 12, color: "#64748b", textAlign: "center" },
  mealTypes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  chipActive: { backgroundColor: "#15803d" },
  chipText: { fontSize: 12, color: "#475569", textTransform: "capitalize" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  ingredients: { fontSize: 13, color: "#475569", lineHeight: 20 },
  logButton: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  logButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
