import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { flushPendingLogs, syncFoods } from "@/lib/sync";

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      try {
        await syncFoods();
      } catch {
        // Offline on first launch; the food search falls back to the local cache.
      }
      try {
        await flushPendingLogs();
      } catch {
        // Pending logs remain queued for the next launch.
      }
    })();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#15803d" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="food/[id]" options={{ title: "Log meal" }} />
      </Stack>
    </>
  );
}
