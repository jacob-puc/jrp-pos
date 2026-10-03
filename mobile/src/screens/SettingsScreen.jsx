import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, SegmentedButtons, Card, useTheme, Divider, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import { getScanMode, setScanMode } from "../utils/scanSettings";

const SettingsScreen = ({ cashier, onLogout }) => {
  const theme = useTheme();
  const [scanMode, setModeState] = useState("auto");

  useEffect(() => {
    (async () => {
      const mode = await getScanMode();
      setModeState(mode);
    })();
  }, []);

  const handleModeChange = async (newMode) => {
    setModeState(newMode);
    await setScanMode(newMode);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="Configuración" subtitle="Preferencias del escáner y app" user={cashier} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="barcode-scan" size={24} color={theme.colors.primary} />
              <Text variant="titleMedium" style={{ fontWeight: "700", color: theme.colors.onSurface, marginLeft: 8 }}>
                Modo de lectura del escáner
              </Text>
            </View>

            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginBottom: 16, marginTop: 4 }}>
              Configura cómo interactúa la cámara con los códigos de barras:
            </Text>

            <SegmentedButtons
              value={scanMode}
              onValueChange={handleModeChange}
              buttons={[
                {
                  value: "auto",
                  label: "Automático",
                  icon: "motion-sensor",
                },
                {
                  value: "manual",
                  label: "Manual",
                  icon: "hand-pointing-up",
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            {scanMode === "auto" ? (
              <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="timer-sand" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                  <Text style={{ fontWeight: "700" }}>Modo Automático:</Text> Enfoca el código por ~3 segundos para asegurar una lectura estable antes de buscar el producto automáticamente.
                </Text>
              </View>
            ) : (
              <View style={[styles.infoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons name="check-decagram" size={20} color={theme.colors.primary} />
                <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                  <Text style={{ fontWeight: "700" }}>Modo Manual:</Text> Al detectar un código, te mostrará el texto/número leído y un botón para confirmar antes de procesar el producto.
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={[styles.card, { backgroundColor: theme.colors.surface, marginTop: 16 }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-outline" size={24} color={theme.colors.primary} />
              <Text variant="titleMedium" style={{ fontWeight: "700", color: theme.colors.onSurface, marginLeft: 8 }}>
                Sesión de usuario
              </Text>
            </View>

            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
              Usuario actual: <Text style={{ fontWeight: "700", color: theme.colors.onSurface }}>{cashier?.name || "Cajero"}</Text> ({cashier?.role === "admin" ? "Administrador" : "Cajero"})
            </Text>

            {onLogout && (
              <Button
                mode="outlined"
                textColor={theme.colors.error}
                icon="logout"
                onPress={onLogout}
                style={{ borderColor: theme.colors.error, borderRadius: 12 }}
              >
                Cerrar Sesión
              </Button>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },
  card: { borderRadius: 16, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  infoBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    gap: 10,
  },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
});

export default SettingsScreen;
