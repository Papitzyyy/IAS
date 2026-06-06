import { Tabs } from "expo-router";
import { useEffect } from "react";
import { BackHandler } from "react-native";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  // Single back-handler for all tabs — prevents going back to login screen.
  // useEffect (not useFocusEffect) because the layout stays mounted for all tabs.
  useEffect(() => {
    const onBackPress = () => {
      BackHandler.exitApp();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          tabBarLabel: "Scan",
          tabBarIcon: ({ color, size }) => (
            // QR icon using unicode — no icon library needed
            <QrIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search Student",
          tabBarLabel: "Search",
          tabBarIcon: ({ color, size }) => (
            <SearchIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "My Profile",
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <PersonIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

// Minimal inline SVG-style icons via Text (no library dependency)
import { Text } from "react-native";

function QrIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size - 2, color, lineHeight: size }}>⬛</Text>
  );
}

function PersonIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size - 2, color, lineHeight: size }}>👤</Text>
  );
}

function SearchIcon({ color, size }: { color: string; size: number }) {
  return (
    <Text style={{ fontSize: size - 2, color, lineHeight: size }}>🔍</Text>
  );
}
