import React, { useState, useCallback } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Text, TextInput, Button, Card, Chip, ActivityIndicator, Snackbar, Searchbar, Portal, Modal, SegmentedButtons, useTheme } from "react-native-paper";
import { searchProducts, getProductByBarcode, addStock, createProduct } from "../services/api";

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

const ManualScreen = () => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockQty, setStockQty] = useState("");
  const [stockCost, setStockCost] = useState("");
  const [snackbar, setSnackbar] = useState({ visible: false, text: "" });

  const [newProduct, setNewProduct] = useState({ ...EMPTY_FORM });

  const showMsg = (text) => setSnackbar({ visible: true, text });

  const doSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 1) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await searchProducts(query);
      setResults(data.products || []);
    } catch (err) {
      showMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    doSearch(query);
  };

  const handleBarcodeSearch = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setLoading(true);
    try {
      const data = await getProductByBarcode(code);
      setProduct(data.product);
      setShowDetail(true);
    } catch (err) {
      if (err.message.includes("no encontrado")) {
        setNewProduct({ ...EMPTY_FORM, barcode: code });
        setShowNewForm(true);
      } else {
        showMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProductTap = (p) => {
    setProduct(p);
    setShowDetail(true);
  };

  const handleAddStock = async () => {
    const qty = parseInt(stockQty);
    if (!qty || qty <= 0) return showMsg("Cantidad inválida");
    const actualQty = product?.sale_unit === "box" && product.box_qty > 0 ? qty * product.box_qty : qty;
    try {
      const result = await addStock(product.id, actualQty, stockCost, "");
      setProduct(result.product);
      setShowStockModal(false);
      setStockQty("");
      setStockCost("");
      showMsg(`Stock actualizado: ${result.product.stock} ${result.product.sale_unit === "box" && result.product.box_qty > 0 && result.product.stock >= result.product.box_qty ? "cajas" : "pz"}`);
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
        barcode: newProduct.barcode || null,
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
      setManualCode("");
      doSearch(searchQuery);
    } catch (err) {
      showMsg(err.message);
    }
  };

  const renderProduct = ({ item }) => (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} onPress={() => handleProductTap(item)}>
      <Card.Content style={styles.cardContent}>
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" style={{ fontWeight: "600", color: theme.colors.onSurface }}>{item.name}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 2 }}>
            {item.barcode || "Sin código"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "700", color: theme.colors.onSurface }}>
            ${(item.sale_unit === "box" && item.box_qty > 0 && (item.stock || 0) >= item.box_qty
              ? (item.box_price || 0)
              : (item.price || 0)).toFixed(2)}
          </Text>
          <Chip compact mode="flat" textStyle={{ fontSize: 11 }}
            style={{ marginTop: 4, backgroundColor: (item.stock || 0) > 5 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }}>
            {item.sale_unit === "box" && item.box_qty > 0 && (item.stock || 0) >= item.box_qty
              ? `${Math.floor((item.stock || 0) / item.box_qty)} cajas (${item.stock || 0} pz)`
              : `${item.stock || 0} ${item.sale_unit === "box" ? "pz" : UNIT_LABELS[item.sale_unit] || "pz"}`}
          </Chip>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Buscar productos..."
          value={searchQuery}
          onChangeText={handleSearch}
          style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 12 }}
        />
        <View style={styles.codeRow}>
          <TextInput
            mode="outlined"
            placeholder="Código manual"
            value={manualCode}
            onChangeText={setManualCode}
            style={{ flex: 1 }}
            outlineStyle={{ borderRadius: 12 }}
          />
          <Button mode="contained" onPress={handleBarcodeSearch} loading={loading}
            style={{ borderRadius: 12, marginLeft: 8 }}
            buttonColor={theme.colors.primary}>
            Buscar
          </Button>
        </View>
      </View>

      {loading && !showDetail && (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      )}

      {!loading && results.length > 0 && (
        <FlatList data={results} renderItem={renderProduct} keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16 }} style={{ flex: 1 }} />
      )}

      {!loading && results.length === 0 && searchQuery.trim().length > 0 && (
        <View style={styles.empty}>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>No se encontraron productos</Text>
          <Button mode="outlined" icon="plus" onPress={() => { setNewProduct({ ...EMPTY_FORM, name: searchQuery }); setShowNewForm(true); }}>
            Registrar "{searchQuery}"
          </Button>
        </View>
      )}

      {!loading && results.length === 0 && searchQuery.trim().length === 0 && (
        <View style={styles.empty}>
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            Busca productos por nombre o código{'\n'}o ingresa un código manualmente
          </Text>
        </View>
      )}

      <Portal>
        <Modal visible={showDetail} onDismiss={() => setShowDetail(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {product && (
            <>
              <Text variant="titleLarge" style={{ fontWeight: "700", color: theme.colors.onSurface, marginBottom: 4 }}>
                {product.name}
              </Text>
              {product.barcode && <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginBottom: 12 }}>Código: {product.barcode}</Text>}
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Precio venta:</Text>
                <Text style={{ fontWeight: "600", color: theme.colors.onSurface }}>
                  ${(product.sale_unit === "box" && product.box_qty > 0 && (product.stock || 0) >= product.box_qty
                    ? (product.box_price || 0)
                    : (product.price || 0)).toFixed(2)}
                </Text>
              </View>
              {product.sale_unit === "box" && product.box_qty > 0 && (product.stock || 0) >= product.box_qty && (
                <View style={styles.infoRow}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Precio pieza:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>${(product.price || 0).toFixed(2)}</Text>
                </View>
              )}
              {product.cost_price > 0 && (
                <View style={styles.infoRow}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Costo:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>${(product.cost_price || 0).toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Stock:</Text>
                <Chip compact mode="flat" textStyle={{ fontWeight: "700" }}
                  style={{ backgroundColor: (product.stock || 0) > 5 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" }}>
                  {product.sale_unit === "box" && product.box_qty > 0 && (product.stock || 0) >= product.box_qty
                    ? `${Math.floor((product.stock || 0) / product.box_qty)} cajas (${product.stock || 0} pz)`
                    : `${product.stock || 0} ${product.sale_unit === "box" ? "pz" : UNIT_LABELS[product.sale_unit] || "pz"}`}
                </Chip>
              </View>
              {product.sale_unit && (
                <View style={styles.infoRow}>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Venta por:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>
                    {SALE_UNITS.find((u) => u.value === product.sale_unit)?.label || product.sale_unit}
                  </Text>
                </View>
              )}
              {product.sale_unit === "box" && product.box_qty > 0 && (
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
              <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                <Button mode="contained" icon="plus" onPress={() => setShowStockModal(true)} style={{ flex: 1 }} buttonColor={theme.colors.primary}>+ Stock</Button>
                <Button mode="outlined" onPress={() => setShowDetail(false)} style={{ flex: 1 }}>Cerrar</Button>
              </View>
            </>
          )}
        </Modal>

        <Modal visible={showNewForm} onDismiss={() => setShowNewForm(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={{ fontWeight: "700", marginBottom: 16, color: theme.colors.onSurface }}>
            Nuevo Producto
          </Text>
          <TextInput label="Código" value={newProduct.barcode} onChangeText={(t) => setNewProduct((p) => ({ ...p, barcode: t }))}
            mode="outlined" style={{ marginBottom: 8 }} />
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
          <SegmentedButtons
            value={newProduct.sale_unit}
            onValueChange={(v) => setNewProduct((p) => ({ ...p, sale_unit: v }))}
            buttons={SALE_UNITS}
            style={{ marginBottom: 8 }}
          />
          {newProduct.sale_unit === "box" && (
            <TextInput label="Piezas por caja" value={newProduct.box_qty} onChangeText={(t) => setNewProduct((p) => ({ ...p, box_qty: t }))}
              mode="outlined" keyboardType="number-pad" style={{ marginBottom: 8 }} />
          )}
          <TextInput
            label={newProduct.sale_unit === "box" ? "Stock inicial (cajas)" : newProduct.sale_unit === "weight" ? "Stock inicial (kg)" : "Stock inicial"}
            value={newProduct.stock}
            onChangeText={(t) => setNewProduct((p) => ({ ...p, stock: t }))}
            mode="outlined"
            keyboardType="number-pad"
            style={{ marginBottom: 16 }}
          />
          <Button mode="contained" onPress={handleCreateProduct} buttonColor={theme.colors.primary}>
            Registrar Producto
          </Button>
        </Modal>

        <Modal visible={showStockModal} onDismiss={() => setShowStockModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={{ fontWeight: "700", marginBottom: 16, color: theme.colors.onSurface }}>
            Aumentar Stock
          </Text>
          <Text style={{ color: theme.colors.onSurface, marginBottom: 12, fontWeight: "600" }}>
            {product?.name}
          </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchSection: { padding: 16, gap: 12 },
  codeRow: { flexDirection: "row", alignItems: "center" },
  card: { marginBottom: 8, borderRadius: 12 },
  cardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  modal: { padding: 24, margin: 20, borderRadius: 16 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(100,116,139,0.15)" },
});

export default ManualScreen;
