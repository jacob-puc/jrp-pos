import React, { useState, useRef, useCallback } from "react";
import { View, StyleSheet, Vibration, Dimensions, ScrollView } from "react-native";
import { Text, Button, ActivityIndicator, Snackbar, Portal, Modal, TextInput, Chip, useTheme, SegmentedButtons, IconButton } from "react-native-paper";
import { CameraView, useCameraPermissions } from "expo-camera";
import { getProductByBarcode, createProduct, addStock } from "../services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SALE_UNITS = [
  { value: "piece", label: "Pieza" },
  { value: "weight", label: "Kilo" },
  { value: "box", label: "Caja" },
];

const UNIT_LABELS = { piece: "pz", weight: "kg", box: "cajas" };

const EMPTY_FORM = {
  name: "", barcode: "", cost_price: "", price: "", sale_unit: "piece", stock: "",
  box_qty: "", box_price: "",
};

const ScannerScreen = () => {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, text: "" });

  const [newProduct, setNewProduct] = useState({ ...EMPTY_FORM });

  const [stockQty, setStockQty] = useState("");
  const [stockCost, setStockCost] = useState("");

  const barcodeRef = useRef(null);

  const showMsg = (text) => setSnackbar({ visible: true, text });

  const handleBarCodeScanned = useCallback(async ({ data }) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    Vibration.vibrate(100);

    try {
      const result = await getProductByBarcode(data);
      setProduct(result.product);
      barcodeRef.current = data;
      setShowDetail(true);
      showMsg(`Producto encontrado: ${result.product.name}`);
    } catch (err) {
      if (err.message.includes("no encontrado")) {
        setNewProduct({ ...EMPTY_FORM, barcode: data });
        setShowNewForm(true);
      } else {
        showMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [scanning, loading]);

  const handleAddStock = async () => {
    const qty = parseInt(stockQty);
    if (!qty || qty <= 0) return showMsg("Cantidad inválida");
    if (!product) return showMsg("Error: producto no disponible");
    const actualQty = product.sale_unit === "box" && product.box_qty > 0 ? qty * product.box_qty : qty;
    try {
      const result = await addStock(product.id, actualQty, stockCost, "");
      setProduct(result.product);
      setShowStockModal(false);
      setStockQty("");
      setStockCost("");
      const p = result.product;
      const isBox = p.sale_unit === "box" && p.box_qty > 0 && p.stock >= p.box_qty;
      showMsg(`Stock actualizado: ${p.stock} ${isBox ? "cajas" : "pz"}`);
    } catch (err) {
      showMsg(err.message);
    }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) return showMsg("El nombre es requerido");
    try {
      const isBox = newProduct.sale_unit === "box";
      const boxQty = parseInt(newProduct.box_qty) || 0;
      const payload = {
        barcode: newProduct.barcode,
        name: newProduct.name.trim(),
        cost_price: parseFloat(newProduct.cost_price) || 0,
        price: parseFloat(newProduct.price) || 0,
        sale_unit: newProduct.sale_unit,
        stock: isBox ? (parseInt(newProduct.stock) || 0) * boxQty : parseInt(newProduct.stock) || 0,
        box_qty: boxQty,
        box_price: parseFloat(newProduct.box_price) || 0,
      };
      await createProduct(payload);
      setShowNewForm(false);
      showMsg(`Producto registrado: ${payload.name}`);
      setProduct(null);
      setScanning(true);
    } catch (err) {
      showMsg(err.message);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setScanning(true);
  };

  const closeNewForm = () => {
    setShowNewForm(false);
    setScanning(true);
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleLarge" style={{ marginBottom: 16, color: theme.colors.onSurface }}>
          Permiso de cámara requerido
        </Text>
        <Button mode="contained" onPress={requestPermission}>
          Conceder permiso
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "qr"] }}
          onBarcodeScanned={handleBarCodeScanned}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>Enfoca el código de barras</Text>
        </View>
      </View>

      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <View style={[styles.center, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 16, color: "#fff" }}>Buscando producto...</Text>
          </View>
        </View>
      )}

      <Portal>
        <Modal visible={showDetail} onDismiss={closeDetail} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <ScrollView>
            {!product ? (
              <Text style={{ color: theme.colors.error, textAlign: "center", marginVertical: 20 }}>Producto no disponible</Text>
            ) : (
            <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text variant="titleLarge" style={{ fontWeight: "700", color: theme.colors.onSurface, flex: 1 }}>
                {product.name}
              </Text>
              <IconButton icon="close" onPress={closeDetail} />
            </View>
            {product.barcode && (
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginBottom: 8 }}>
                Código: {product.barcode}
              </Text>
            )}
            {product.sale_unit === "box" && (product.box_qty || 0) > 0 && (product.stock || 0) >= (product.box_qty || 0) ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Precio venta (caja):</Text>
                  <Text style={{ fontWeight: "600", color: theme.colors.onSurface }}>${(product.box_price || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Precio pieza:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>${(product.price || 0).toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Precio venta:</Text>
                <Text style={{ fontWeight: "600", color: theme.colors.onSurface }}>${(product.price || 0).toFixed(2)}</Text>
              </View>
            )}
            {(product.cost_price || 0) > 0 && (
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Costo:</Text>
                <Text style={{ color: theme.colors.onSurface }}>${(product.cost_price || 0).toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Stock:</Text>
              <Chip compact mode="flat" textStyle={{ fontWeight: "700" }}
                style={{ backgroundColor: (product.stock || 0) > 5 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }}>
                {product.sale_unit === "box" && (product.box_qty || 0) > 0 && (product.stock || 0) >= (product.box_qty || 0)
                  ? `${Math.floor((product.stock || 0) / (product.box_qty || 1))} cajas (${product.stock || 0} pz)`
                  : `${product.stock || 0} ${product.sale_unit === "box" ? "pz" : (UNIT_LABELS[product.sale_unit] || "pz")}`}
              </Chip>
            </View>
            {product.sale_unit && (
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Venta por:</Text>
                <Text style={{ color: theme.colors.onSurface }}>
                  {(SALE_UNITS.find((u) => u.value === product.sale_unit)?.label) || product.sale_unit}
                </Text>
              </View>
            )}
            {product.sale_unit === "box" && (product.box_qty || 0) > 0 && (
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Piezas por caja:</Text>
                <Text style={{ color: theme.colors.onSurface }}>{product.box_qty}</Text>
              </View>
            )}
            {product.category_name && (
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Categoría:</Text>
                <Text style={{ color: theme.colors.onSurface }}>{product.category_name}</Text>
              </View>
            )}
            {product.supplier_name && (
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Proveedor:</Text>
                <Text style={{ color: theme.colors.onSurface }}>{product.supplier_name}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <Button mode="contained" icon="plus" onPress={() => setShowStockModal(true)}
                style={{ flex: 1 }} buttonColor={theme.colors.primary}>+ Stock</Button>
              <Button mode="outlined" onPress={closeDetail} style={{ flex: 1 }}>Escanear otro</Button>
            </View>
            </>
            )}
          </ScrollView>
        </Modal>

        <Modal visible={showNewForm} onDismiss={closeNewForm}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700", color: theme.colors.onSurface }}>Nuevo Producto</Text>
            <IconButton icon="close" onPress={closeNewForm} />
          </View>
          <TextInput label="Código" value={newProduct.barcode} disabled mode="outlined" style={{ marginBottom: 8 }} />
          <TextInput label="Nombre *" value={newProduct.name} onChangeText={(t) => setNewProduct((p) => ({ ...p, name: t }))}
            mode="outlined" autoFocus style={{ marginBottom: 8 }} />
          <TextInput label="Precio compra" value={newProduct.cost_price} onChangeText={(t) => setNewProduct((p) => ({ ...p, cost_price: t }))}
            mode="outlined" keyboardType="decimal-pad" style={{ marginBottom: 8 }} />
          {newProduct.sale_unit === "box" ? (
            <>
              <TextInput label="Precio pieza" value={newProduct.price} onChangeText={(t) => setNewProduct((p) => ({ ...p, price: t }))}
                mode="outlined" keyboardType="decimal-pad" style={{ marginBottom: 8 }} />
              <TextInput label="Precio venta caja" value={newProduct.box_price} onChangeText={(t) => setNewProduct((p) => ({ ...p, box_price: t }))}
                mode="outlined" keyboardType="decimal-pad" style={{ marginBottom: 8 }} />
            </>
          ) : (
            <TextInput label={newProduct.sale_unit === "weight" ? "Precio por kg" : "Precio venta"}
              value={newProduct.price} onChangeText={(t) => setNewProduct((p) => ({ ...p, price: t }))}
              mode="outlined" keyboardType="decimal-pad" style={{ marginBottom: 8 }} />
          )}
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginBottom: 4 }}>Unidad de venta</Text>
          <SegmentedButtons value={newProduct.sale_unit} onValueChange={(v) => setNewProduct((p) => ({ ...p, sale_unit: v }))}
            buttons={SALE_UNITS} style={{ marginBottom: 8 }} />
          {newProduct.sale_unit === "box" && (
            <TextInput label="Piezas por caja" value={newProduct.box_qty} onChangeText={(t) => setNewProduct((p) => ({ ...p, box_qty: t }))}
              mode="outlined" keyboardType="number-pad" style={{ marginBottom: 8 }} />
          )}
          <TextInput label={newProduct.sale_unit === "box" ? "Stock inicial (cajas)" : newProduct.sale_unit === "weight" ? "Stock inicial (kg)" : "Stock inicial"}
            value={newProduct.stock} onChangeText={(t) => setNewProduct((p) => ({ ...p, stock: t }))}
            mode="outlined" keyboardType="number-pad" style={{ marginBottom: 16 }} />
          <Button mode="contained" onPress={handleCreateProduct} buttonColor={theme.colors.primary}>
            Registrar Producto
          </Button>
        </Modal>

        <Modal visible={showStockModal} onDismiss={() => setShowStockModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700", color: theme.colors.onSurface }}>Aumentar Stock</Text>
            <IconButton icon="close" onPress={() => setShowStockModal(false)} />
          </View>
          <Text style={{ color: theme.colors.onSurface, marginBottom: 12, fontWeight: "600" }}>{product?.name}</Text>
          <TextInput label={product?.sale_unit === "box" ? "Cantidad (cajas)" : "Cantidad"} value={stockQty} onChangeText={setStockQty}
            mode="outlined" keyboardType="number-pad" autoFocus style={{ marginBottom: 8 }} />
          <TextInput label="Costo unitario ($)" value={stockCost} onChangeText={setStockCost}
            mode="outlined" keyboardType="decimal-pad" style={{ marginBottom: 16 }} />
          <Button mode="contained" onPress={handleAddStock} buttonColor={theme.colors.primary}>
            Aumentar Stock
          </Button>
        </Modal>
      </Portal>

      <Snackbar visible={snackbar.visible} onDismiss={() => setSnackbar({ visible: false, text: "" })}
        duration={3000} style={{ marginBottom: 60 }}>
        {snackbar.text}
      </Snackbar>
    </View>
  );
};

const FRAME_W = SCREEN_WIDTH * 0.85;
const FRAME_H = SCREEN_WIDTH * 0.45;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  scanFrame: {
    width: FRAME_W,
    height: FRAME_H,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#60a5fa",
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { color: "#f1f5f9", fontSize: 14, marginTop: 24, fontWeight: "500" },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(100,116,139,0.15)",
  },
  modal: { padding: 24, margin: 20, borderRadius: 16, maxHeight: "85%" },
});

export default ScannerScreen;