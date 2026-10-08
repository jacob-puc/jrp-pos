import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, ActivityIndicator, useTheme, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { initialize, pairWithHost, setHost } from "../services/api";
import RaisedButton from "../components/RaisedButton";

const ConnectingScreen = ({ onConnected }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState("Buscando servidor...");
  const [failed, setFailed] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [host, setHostInput] = useState("");
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState("");

  const connect = async (manualHost = null) => {
    setStatus("Buscando servidor...");
    setFailed(false);
    setError("");
    setManualMode(false);
    try {
      const result = await initialize(manualHost);
      if (result.connected) {
        onConnected();
      } else {
        setStatus("No se encontró el servidor");
        setFailed(true);
        setManualMode(true);
      }
    } catch (err) {
      setStatus("Error de conexión");
      setFailed(true);
      setManualMode(true);
      setError(err.message || "Error de conexión");
    }
  };

  const handlePair = async () => {
    if (!host.trim() || !code.trim()) {
      setError("Ingresa IP/Host y código de activación");
      return;
    }
    setPairing(true);
    setError("");
    try {
      await setHost(host.trim());
      await pairWithHost(code.trim().toUpperCase());
      onConnected();
    } catch (err) {
      setError(err.message || "No se pudo vincular con el Host");
    } finally {
      setPairing(false);
    }
  };

  useEffect(() => {
    connect();
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {!failed && !manualMode ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text
              variant="titleMedium"
              style={{
                marginTop: 24,
                color: theme.colors.onSurface,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {status}
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              Conectando al sistema de ventas{"\n"}vía WiFi local
            </Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text
              variant="titleMedium"
              style={{
                color: theme.colors.onSurface,
                fontWeight: "600",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              {manualMode ? "Configurar conexión" : status}
            </Text>
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: 16,
              }}
            >
              Asegúrate de estar en la misma red WiFi{"\n"}y que el sistema de
              ventas esté abierto
            </Text>
            <TextInput
              label="IP o Host (ej. 192.168.1.100)"
              value={host}
              onChangeText={setHostInput}
              mode="outlined"
              style={{ width: "100%", marginBottom: 8 }}
              autoCapitalize="none"
            />
            <TextInput
              label="Código de activación"
              value={code}
              onChangeText={setCode}
              mode="outlined"
              autoCapitalize="characters"
              style={{ width: "100%", marginBottom: 8 }}
            />
            {error ? (
              <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
                {error}
              </Text>
            ) : null}
            <RaisedButton
              onPress={handlePair}
              loading={pairing}
              disabled={pairing}
              style={{ borderRadius: 12, width: "100%", marginBottom: 8 }}
            >
              Vincular con Host
            </RaisedButton>
            <RaisedButton
              onPress={() => connect(host || null)}
              style={{ borderRadius: 12, width: "100%" }}
            >
              Buscar en red
            </RaisedButton>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  scroll: { flexGrow: 1, justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  form: { width: "100%", maxWidth: 420, alignSelf: "center" },
});

export default ConnectingScreen;
