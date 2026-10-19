import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, clearSession } from "@/lib/api";

interface Me {
  id: string;
  fullName: string;
  email: string;
  role: string;
  tier: string;
  profile: {
    age: number;
    sex: string;
    heightCm: number;
    weightKg: number;
    targetWeightKg: number | null;
    bmi: number;
    activityLevel: string;
  } | null;
  clinicalFlags: {
    hasDiabetes: boolean;
    hasHypertension: boolean;
    ckdStage: number;
    targetSodiumMg: number;
    targetPotassiumMg: number;
    targetProteinG: number;
    targetGlycemicLoad: number;
  } | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/api/auth/me").then(setMe).catch(() => undefined);
  }, []);

  async function signOut() {
    await clearSession();
    router.replace("/login");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={styles.card}>
        <Text style={styles.name}>{me?.fullName ?? "..."}</Text>
        <Text style={styles.email}>{me?.email}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{me?.tier ?? "free"}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{me?.role ?? "patient"}</Text>
          </View>
        </View>
      </View>

      {me?.profile && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Body metrics</Text>
          <Row label="Age" value={`${me.profile.age} years`} />
          <Row label="Sex" value={me.profile.sex} />
          <Row label="Height" value={`${me.profile.heightCm} cm`} />
          <Row label="Weight" value={`${me.profile.weightKg} kg`} />
          <Row label="BMI" value={`${me.profile.bmi}`} />
          <Row label="Activity" value={me.profile.activityLevel.replace("_", " ")} />
        </View>
      )}

      {me?.clinicalFlags && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Clinical profile</Text>
          <Row label="Diabetes" value={me.clinicalFlags.hasDiabetes ? "Yes" : "No"} />
          <Row label="Hypertension" value={me.clinicalFlags.hasHypertension ? "Yes" : "No"} />
          <Row
            label="CKD stage"
            value={me.clinicalFlags.ckdStage === 0 ? "None" : `Stage ${me.clinicalFlags.ckdStage}`}
          />
          <Row label="Sodium limit" value={`${me.clinicalFlags.targetSodiumMg} mg`} />
          <Row label="Potassium limit" value={`${me.clinicalFlags.targetPotassiumMg} mg`} />
          <Row label="Protein target" value={`${me.clinicalFlags.targetProteinG} g`} />
          <Row label="Glycemic load" value={`${me.clinicalFlags.targetGlycemicLoad}`} />
        </View>
      )}

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8 },
  name: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  email: { fontSize: 13, color: "#64748b" },
  badges: { flexDirection: "row", gap: 8, marginTop: 6 },
  badge: { backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#15803d", textTransform: "capitalize" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { fontSize: 13, color: "#64748b" },
  rowValue: { fontSize: 13, fontWeight: "600", color: "#0f172a", textTransform: "capitalize" },
  signOut: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  signOutText: { color: "#b91c1c", fontWeight: "700", fontSize: 15 },
});
