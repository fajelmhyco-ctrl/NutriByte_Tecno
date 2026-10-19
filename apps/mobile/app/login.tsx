import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { api, setSession } from "@/lib/api";
import { syncFoods } from "@/lib/sync";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("patient@nutribyte.ph");
  const [password, setPassword] = useState("NutriByte123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      await setSession(result.accessToken, result.refreshToken);
      syncFoods().catch(() => undefined);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>NutriByte</Text>
        <Text style={styles.tagline}>Filipino nutrition, clinically guided.</Text>
      </View>

      <View style={styles.form}>
        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Your password"
        />

        <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

        <Text style={styles.hint}>Demo: patient@nutribyte.ph / NutriByte123!</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", padding: 24 },
  header: { marginBottom: 32, alignItems: "center" },
  logo: { fontSize: 34, fontWeight: "800", color: "#15803d" },
  tagline: { marginTop: 6, fontSize: 14, color: "#64748b" },
  form: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 18,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#b91c1c", fontSize: 13 },
  hint: { marginTop: 12, textAlign: "center", fontSize: 12, color: "#94a3b8" },
});
