import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Text, ActivityIndicator, useTheme, Button } from "react-native-paper";
import { initialize } from "../services/api";

const ConnectingScreen = ({ onConnected }) => {
  const theme = useTheme();
  const [status, setStatus] = useState("Buscando servidor...");
  const [failed, setFailed] = useState(false);

  const connect = async () => {
    setStatus("Buscando servidor...");
    setFailed(false);
    try {
      const result = await initialize();
      if (result.connected) {
        onConnected();
      } else {
        setStatus("No se encontró el servidor");
        setFailed(true);
      }
    } catch (err) {
      setStatus("Error de conexión");
      setFailed(true);
    }
  };

  useEffect(() => { connect(); }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!failed ? (
        <>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="titleMedium" style={{ marginTop: 24, color: theme.colors.onSurface, fontWeight: "600" }}>
            {status}
          </Text>
          <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            Conectando al sistema de ventas{"\n"}vía WiFi local
          </Text>
        </>
      ) : (
        <>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: "600", marginBottom: 8 }}>
            {status}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center", marginBottom: 24 }}>
            Asegúrate de estar en la misma red WiFi{"\n"}y que el sistema de ventas esté abierto
          </Text>
          <Button mode="contained" onPress={connect} buttonColor={theme.colors.primary}>
            Reintentar
          </Button>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
});

export default ConnectingScreen;
