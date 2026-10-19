import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#15803d",
        tabBarInactiveTintColor: "#94a3b8",
        headerStyle: { backgroundColor: "#15803d" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => <TabIcon label="🍽️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Food database",
          tabBarIcon: ({ focused }) => <TabIcon label="🔎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "The Coach",
          tabBarIcon: ({ focused }) => <TabIcon label="🤖" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
