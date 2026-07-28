import React, { useState, useEffect } from "react";
import { View, FlatList, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Text, TextInput, Button, ActivityIndicator, useTheme, Avatar } from "react-native-paper";
import { authenticate, getCashiers } from "../services/api";

const { width } = Dimensions.get("window");

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const CARD_SIZE = Math.min((width - 64) / 3, 110);

const LoginScreen = ({ onLogin }) => {
  const theme = useTheme();
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [pin, setPin] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getCashiers();
        setCashiers(data.cashiers || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelect = (id) => {
    setSelectedId(id);
    setPin("");
    setError("");
  };

  const handleLogin = async () => {
    if (!selectedId) { setError("Selecciona un usuario"); return; }
    if (!pin.trim()) { setError("Ingresa tu PIN"); return; }
    setAuthLoading(true);
    setError("");
    try {
      const result = await authenticate(selectedId, pin.trim());
      if (result.success) {
        onLogin(result.cashier);
      } else {
        setError(result.error || "PIN inválido");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setAuthLoading(false);
    }
  };

  const selected = cashiers.find((c) => c.id === selectedId);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.card}>
        <Text variant="headlineSmall" style={{ fontWeight: "800", color: theme.colors.onSurface, textAlign: "center" }}>
          POS Móvil
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginTop: 4, marginBottom: 24 }}>
          {selectedId ? "Ingresa tu PIN para acceder" : "Selecciona un usuario"}
        </Text>

        {!selectedId ? (
          loading ? (
            <ActivityIndicator size="large" style={{ padding: 40 }} />
          ) : (
            <FlatList
              data={cashiers}
              keyExtractor={(item) => String(item.id)}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={{ justifyContent: "center", gap: 12 }}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item, index }) => {
                const initial = item.name.charAt(0).toUpperCase();
                const bgColor = COLORS[index % COLORS.length];
                return (
                  <TouchableOpacity
                    onPress={() => handleSelect(item.id)}
                    style={[styles.avatarCard, { borderColor: theme.colors.outlineVariant }]}
                    activeOpacity={0.7}
                  >
                    <Avatar.Text
                      size={48}
                      label={initial}
                      color="white"
                      style={{ backgroundColor: bgColor, alignSelf: "center" }}
                    />
                    <Text
                      variant="labelSmall"
                      numberOfLines={1}
                      style={{ textAlign: "center", marginTop: 6, fontWeight: "600", color: theme.colors.onSurface }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{ textAlign: "center", fontSize: 10, color: theme.colors.onSurfaceVariant }}
                    >
                      {item.role === "admin" ? "Propietario" : "Cajero"}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )
        ) : (
          <View style={{ width: "100%" }}>
            <TouchableOpacity onPress={() => { setSelectedId(null); setError(""); }} style={{ alignSelf: "center", marginBottom: 16 }}>
              <Avatar.Text
                size={64}
                label={selected.name.charAt(0).toUpperCase()}
                color="white"
                style={{ backgroundColor: COLORS[selected.id % COLORS.length], alignSelf: "center" }}
              />
              <Text variant="titleMedium" style={{ textAlign: "center", fontWeight: "700", marginTop: 4, color: theme.colors.onSurface }}>
                {selected.name}
              </Text>
              <Text variant="labelSmall" style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}>
                {selected.role === "admin" ? "Propietario" : "Cajero"} — tocar para cambiar
              </Text>
            </TouchableOpacity>

            <TextInput
              label="PIN de acceso"
              value={pin}
              onChangeText={(t) => { setPin(t.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              mode="outlined"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              error={!!error}
              style={{ marginBottom: 8 }}
              outlineStyle={{ borderRadius: 12 }}
            />
            {error ? (
              <Text style={{ color: theme.colors.error, fontSize: 13, marginBottom: 8 }}>{error}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={authLoading}
              disabled={authLoading || pin.length < 3}
              style={{ borderRadius: 12, marginTop: 8 }}
              buttonColor={theme.colors.primary}
              contentStyle={{ height: 48 }}
            >
              {authLoading ? "Conectando..." : "Acceder"}
            </Button>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, padding: 24, alignItems: "center" },
  avatarCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default LoginScreen;