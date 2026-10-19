import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, Food } from "@/lib/api";
import { searchFoodsOffline } from "@/lib/db";
import { syncFoods } from "@/lib/sync";

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<Food[]>([]);
  const [source, setSource] = useState<"online" | "offline">("online");

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const result = await api<{ items: Food[] }>(
          `/api/foods?q=${encodeURIComponent(query)}&limit=30`,
        );
        if (!cancelled) {
          setFoods(result.items);
          setSource("online");
        }
      } catch {
        const local = await searchFoodsOffline(query);
        if (!cancelled) {
          setFoods(local);
          setSource("offline");
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    syncFoods().catch(() => undefined);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search adobo, sinigang, sayote..."
          autoCorrect={false}
        />
        <Text style={styles.source}>
          {source === "offline" ? "Offline cache" : "Verified Filipino food database"}
        </Text>
      </View>

      <FlatList
        data={foods}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No dishes found. Try "adobo" or "pechay".</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/food/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.dishName}</Text>
              {item.localName && <Text style={styles.local}>{item.localName}</Text>}
              <Text style={styles.meta}>
                {item.servingUnit} · Na {Math.round(item.sodiumMg)} mg · K{" "}
                {Math.round(item.potassiumMg)} mg
              </Text>
            </View>
            <View style={styles.caloriesBox}>
              <Text style={styles.calories}>{Math.round(item.calories)}</Text>
              <Text style={styles.caloriesLabel}>kcal</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  searchBox: { padding: 16, backgroundColor: "#fff", gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  source: { fontSize: 11, color: "#94a3b8" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
  },
  name: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  local: { fontSize: 12, color: "#64748b", fontStyle: "italic" },
  meta: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  caloriesBox: { alignItems: "center", marginLeft: 12 },
  calories: { fontSize: 18, fontWeight: "800", color: "#15803d" },
  caloriesLabel: { fontSize: 10, color: "#94a3b8" },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 32 },
});
