import React, { useState, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, useTheme } from "react-native-paper";
import { NavigationContainer, DefaultTheme, DarkTheme as NavDarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { DarkTheme, LightTheme } from "./src/theme";
import ScannerScreen from "./src/screens/ScannerScreen";
import ManualScreen from "./src/screens/ManualScreen";
import LoginScreen from "./src/screens/LoginScreen";
import ConnectingScreen from "./src/screens/ConnectingScreen";

const Tab = createBottomTabNavigator();

const AppIcon = ({ name, size, color }) => (
  <MaterialCommunityIcons name={name} size={size} color={color} />
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: "#1E293B" },
      headerTintColor: "#f1f5f9",
      headerTitleStyle: { fontWeight: "700" },
      tabBarStyle: {
        backgroundColor: "#1E293B",
        borderTopColor: "rgba(100, 116, 139, 0.25)",
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 8,
        paddingTop: 4,
      },
      tabBarActiveTintColor: "#234e8c",
      tabBarInactiveTintColor: "#64748b",
    }}
  >
    <Tab.Screen
      name="Scanner"
      component={ScannerScreen}
      options={{
        title: "Escanear",
        tabBarIcon: ({ color, size }) => <AppIcon name="qrcode-scan" size={size} color={color} />,
      }}
    />
    <Tab.Screen
      name="Manual"
      component={ManualScreen}
      options={{
        title: "Manual",
        tabBarIcon: ({ color, size }) => <AppIcon name="magnify" size={size} color={color} />,
      }}
    />
  </Tab.Navigator>
);

const AppTheme = {
  dark: DarkTheme,
  light: LightTheme,
};

export default function App() {
  const [isDark] = useState(true);
  const [screen, setScreen] = useState("connecting");
  const [cashier, setCashier] = useState(null);

  const paperTheme = useMemo(() => (isDark ? DarkTheme : LightTheme), [isDark]);
  const navTheme = useMemo(() => ({
    ...(isDark ? NavDarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? NavDarkTheme.colors : DefaultTheme.colors),
      background: isDark ? "#0a0e1a" : "#f8f9ff",
      card: isDark ? "#111827" : "#ffffff",
      text: isDark ? "#f1f5f9" : "#0f172a",
      border: "rgba(100, 116, 139, 0.2)",
      primary: "#234e8c",
    },
  }), [isDark]);

  const renderScreen = () => {
    switch (screen) {
      case "connecting":
        return <ConnectingScreen onConnected={() => setScreen("login")} />;
      case "login":
        return <LoginScreen onLogin={(c) => { setCashier(c); setScreen("main"); }} />;
      case "main":
        return <MainTabs />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style={isDark ? "light" : "dark"} />
          {renderScreen()}
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
