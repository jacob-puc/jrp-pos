import React, { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Box,
  Typography,
  Grid,
  InputAdornment,
  Alert,
  Stack,
  useTheme,
  MenuItem,
  CircularProgress,
  Fade,
  IconButton,
  FormControlLabel,
  Switch,
} from "@mui/material";
import {
  ScanBarcode, Boxes, DollarSign, Plus, Truck, ChevronRight, ChevronLeft,
  CheckCircle2, Shapes, Percent, Hash, ChevronUp, ChevronDown, TrendingUp, Tag, Package, Trash2,
} from "lucide-react";
import StepIndicator from "./StepIndicator";
import { isContainerUnit, unitLabels } from "../utils/unitLabels";

const inputSx = {
  "& .MuiOutlinedInput-root.MuiOutlinedInput-root": {
    borderRadius: "6px",
    "& fieldset": { borderRadius: "6px" },
  },
  "& .MuiInputBase-input::placeholder": { fontSize: "0.85rem" },
};

const FieldLabel = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      display: "block",
      mb: 0.5,
      fontWeight: 600,
      color: "text.secondary",
    }}
  >
    {children}
  </Typography>
);

const productSchema = z.object({
  barcode: z.string().min(1, "El código de barras es requerido"),
  name: z.string().min(1, "El nombre del producto es requerido"),
  brand: z.string().optional(),
  price: z
    .string()
    .min(1, "El precio es requerido")
    .refine((v) => parseFloat(v) > 0, "El precio debe ser mayor a 0"),
  stock: z.string().optional(),
  supplier_id: z.string().optional(),
  category_id: z.string().optional(),
  cost_price: z.string().optional(),
  min_stock: z.string().optional(),
  discount_percent: z.string().optional(),
  has_discount: z.boolean().optional(),
  sale_unit: z.string().optional(),
  box_qty: z.string().optional(),
  box_price: z.string().optional(),
  pack_qty: z.string().optional(),
  pack_price: z.string().optional(),
  packs_per_box: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.sale_unit === "boxpack") {
    if (!(parseInt(data.packs_per_box, 10) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["packs_per_box"],
        message: "Indica cuántos paquetes trae la caja",
      });
    }
    if (!(parseInt(data.pack_qty, 10) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pack_qty"],
        message: "Indica cuántas piezas trae cada paquete",
      });
    }
    if (!(parseFloat(data.pack_price) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pack_price"],
        message: "Indica el precio del paquete",
      });
    }
  }
});

const steps = ["Información", "Precios e Inventario"];

const AddProductModal = ({
  open,
  onClose,
  onProductAdded,
  editProduct = null,
  initialBarcode = "",
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState({ type: null, name: "" });
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [priceTiers, setPriceTiers] = useState([]);

  const addPriceTier = () =>
    setPriceTiers((prev) => [
      ...prev,
      { type: "combo", qty: "", price: "" },
    ]);
  const updatePriceTier = (index, field, value) =>
    setPriceTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  const removePriceTier = (index) =>
    setPriceTiers((prev) => prev.filter((_, i) => i !== index));

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    trigger,
    setValue,
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      barcode: "",
      name: "",
      brand: "",
      price: "",
      stock: "",
      supplier_id: "",
      category_id: "",
      cost_price: "",
      min_stock: "",
      discount_percent: "",
      sale_unit: "piece",
      box_qty: "",
      box_price: "",
      pack_qty: "",
      pack_price: "",
      packs_per_box: "",
    },
  });

  const watchedValues = watch();

  const watchedStockPieces = (() => {
    const su = watchedValues.sale_unit;
    const boxQty =
      su === "boxpack"
        ? (parseInt(watchedValues.packs_per_box, 10) || 0) *
          (parseInt(watchedValues.pack_qty, 10) || 0)
        : parseInt(watchedValues.box_qty, 10) || 0;
    return isContainerUnit(su)
      ? (parseInt(watchedValues.stock, 10) || 0) * boxQty
      : parseFloat(watchedValues.stock) || 0;
  })();
  const watchedAutoMin = Math.max(1, Math.floor(watchedStockPieces * 0.4));

  useEffect(() => {
    const code = (watchedValues.barcode || "").trim();
    if (!code) {
      setBarcodeStatus({ type: null, name: "" });
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await window.api.invoke("check-barcode-exists", code);
        if (!res.exists) {
          setBarcodeStatus({ type: null, name: "" });
        } else if (editProduct && res.id === editProduct.id) {
          setBarcodeStatus({ type: null, name: "" });
        } else if (res.active) {
          setBarcodeStatus({ type: "active", name: res.name });
        } else {
          setBarcodeStatus({ type: "inactive", name: res.name });
        }
      } catch {
        setBarcodeStatus({ type: null, name: "" });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [watchedValues.barcode, editProduct]);

  useEffect(() => {
    if (open) {
      Promise.all([
        window.api.invoke("get-suppliers"),
        window.api.invoke("get-categories"),
      ]).then(([s, c]) => {
        setSuppliers(s);
        setCategories(c);
      });
      if (editProduct) {
        const isBox = isContainerUnit(editProduct.sale_unit);
        const boxQty = editProduct.box_qty || 0;
        reset({
          barcode: editProduct.barcode || "",
          name: editProduct.name || "",
          brand: editProduct.brand || "",
          price: editProduct.price?.toString() || "",
          stock:
            isBox && boxQty > 0
              ? Math.floor(editProduct.stock / boxQty).toString()
              : editProduct.stock?.toString() || "0",
          supplier_id: editProduct.supplier_id?.toString() || "",
          category_id: editProduct.category_id?.toString() || "",
          cost_price: editProduct.cost_price?.toString() || "",
          min_stock: editProduct.min_stock?.toString() || "",
          discount_percent: editProduct.discount_percent?.toString() || "0",
          has_discount: !!editProduct.has_discount,
          sale_unit: editProduct.sale_unit || "piece",
          box_qty: boxQty.toString(),
          box_price: editProduct.box_price?.toString() || "",
          pack_qty: (editProduct.pack_qty || 0).toString(),
          pack_price: editProduct.pack_price?.toString() || "",
          packs_per_box:
            editProduct.sale_unit === "boxpack" && boxQty > 0
              ? Math.round(
                  boxQty / (parseInt(editProduct.pack_qty, 10) || 1),
                ).toString()
              : "0",
        });
        setPriceTiers(
          (editProduct.prices || []).map((p) => ({
            type: p.type,
            qty: String(p.qty),
            price: String(p.price),
          })),
        );
      } else {
        reset({
          barcode: initialBarcode || "",
          name: "",
          brand: "",
          price: "",
          stock: "",
          supplier_id: "",
          category_id: "",
          cost_price: "",
          min_stock: "",
          discount_percent: "",
          has_discount: false,
          sale_unit: "piece",
          box_qty: "",
          box_price: "",
          pack_qty: "",
          pack_price: "",
          packs_per_box: "",
        });
        setPriceTiers([]);
      }
      setActiveStep(0);
      setSubmitError("");
      setIsSubmitting(false);
      setBarcodeStatus({ type: null, name: "" });
    }
  }, [open, editProduct, initialBarcode, reset]);

  const calcFinalPrice = () => {
    const price = parseFloat(watchedValues.price) || 0;
    const disc = parseFloat(watchedValues.discount_percent) || 0;
    return price * (1 - disc / 100);
  };

  const effectiveBoxQty = () => {
    if (watchedValues.sale_unit === "boxpack") {
      const packsPerBox = parseInt(watchedValues.packs_per_box, 10) || 0;
      const packQty = parseInt(watchedValues.pack_qty, 10) || 0;
      return packsPerBox * packQty;
    }
    return parseInt(watchedValues.box_qty, 10) || 0;
  };

  const calcMargin = () => {
    const cost = parseFloat(watchedValues.cost_price) || 0;
    if (cost <= 0) return null;
    if (isContainerUnit(watchedValues.sale_unit)) {
      const boxPrice = parseFloat(watchedValues.box_price) || 0;
      if (boxPrice > 0) return ((boxPrice - cost) / cost) * 100;
      const boxQty = effectiveBoxQty();
      const costPerPiece = boxQty > 0 ? cost / boxQty : 0;
      const price = parseFloat(watchedValues.price) || 0;
      if (costPerPiece > 0 && price > 0)
        return ((price - costPerPiece) / costPerPiece) * 100;
      return null;
    }
    const price = parseFloat(watchedValues.price) || 0;
    if (price > 0) return ((price - cost) / cost) * 100;
    return null;
  };

  const calcPackMargin = () => {
    const cost = parseFloat(watchedValues.cost_price) || 0;
    const packQty = parseInt(watchedValues.pack_qty, 10) || 0;
    const packPrice =
      watchedValues.sale_unit === "boxpack"
        ? parseFloat(watchedValues.price) || 0
        : parseFloat(watchedValues.pack_price) || 0;
    if (cost <= 0 || packQty <= 0 || packPrice <= 0) return null;
    let pieceCost;
    if (isContainerUnit(watchedValues.sale_unit)) {
      const boxQty = effectiveBoxQty();
      if (boxQty <= 0) return null;
      pieceCost = cost / boxQty;
    } else {
      pieceCost = cost;
    }
    const packCost = pieceCost * packQty;
    return ((packPrice - packCost) / packCost) * 100;
  };

  const handleNext = async () => {
    if (activeStep === 0 && !editProduct && !watchedValues.barcode?.trim()) {
      try {
        const code = await window.api.invoke("get-next-barcode");
        setValue("barcode", code);
      } catch {
        setValue("barcode", `2${Date.now()}`);
      }
    }
    let fieldsToValidate = [];
    if (activeStep === 0)
      fieldsToValidate = ["barcode", "name", "brand", "supplier_id"];
    else {
      fieldsToValidate = [
        "price",
        "stock",
        "cost_price",
        "min_stock",
        "discount_percent",
      ];
      if (isContainerUnit(watchedValues.sale_unit)) {
        if (watchedValues.sale_unit === "boxpack")
          fieldsToValidate.push("packs_per_box", "pack_qty", "pack_price");
        else fieldsToValidate.push("box_qty", "box_price");
      }
    }
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const boxQty =
        data.sale_unit === "boxpack"
          ? (parseInt(data.packs_per_box, 10) || 0) *
            (parseInt(data.pack_qty, 10) || 0)
          : parseInt(data.box_qty, 10) || 0;
      const productData = {
        barcode: data.barcode.trim(),
        name: data.name.trim(),
        brand: data.brand.trim() || "Sin marca",
        price: parseFloat(data.price),
        stock:
          isContainerUnit(data.sale_unit)
            ? (parseInt(data.stock, 10) || 0) * boxQty
            : parseFloat(data.stock) || 0,
        supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
        category_id: data.category_id ? parseInt(data.category_id) : null,
        cost_price: parseFloat(data.cost_price) || 0,
        min_stock: parseInt(data.min_stock) > 0 ? parseInt(data.min_stock) : 0,
        discount_percent: data.has_discount
          ? parseFloat(data.discount_percent) || 0
          : 0,
        has_discount: data.has_discount ? 1 : 0,
        sale_unit: data.sale_unit || "piece",
        box_qty: boxQty,
        box_price: parseFloat(data.box_price) || 0,
        pack_qty:
          data.sale_unit === "boxpack" ? parseInt(data.pack_qty) || 0 : 0,
        pack_price:
          data.sale_unit === "boxpack"
            ? parseFloat(data.pack_price) || 0
            : 0,
        prices: data.has_discount
          ? priceTiers
              .map((t) => ({
                type: t.type === "mayoreo" ? "mayoreo" : "combo",
                qty: parseInt(t.qty) || 0,
                price: parseFloat(t.price) || 0,
              }))
              .filter((t) => t.qty > 0 && t.price > 0)
          : [],
      };

      let result;
      if (editProduct) {
        result = await window.api.invoke(
          "update-product",
          editProduct.id,
          productData,
        );
      } else {
        result = await window.api.invoke("add-product", productData);
      }

      if (result.success) {
        onProductAdded();
        handleClose();
      } else {
        setSubmitError(result.error || "Error desconocido");
      }
    } catch (error) {
      setSubmitError(error.message || "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setActiveStep(0);
    setSubmitError("");
    setIsSubmitting(false);
    onClose();
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Fade in={activeStep === 0} timeout={300}>
            <Box>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="barcode"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Código de barras</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        size="small"
                        error={barcodeStatus.type === "active" || !!errors.barcode}
                        helperText={
                          barcodeStatus.type === "active"
                            ? `Ya existe un producto con este código: ${barcodeStatus.name}`
                            : barcodeStatus.type === "inactive"
                              ? "Existe un producto inactivo con este código; se reactivará al guardar"
                              : errors.barcode?.message
                        }
                        placeholder="780123456789"
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <ScanBarcode size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Nombre del producto</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        size="small"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        placeholder="Ej: Coca Cola 600ml"
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <Boxes size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="brand"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Marca</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        size="small"
                        placeholder="Ej: Coca Cola (opcional)"
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <Tag size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="supplier_id"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Proveedor</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        select
                        size="small"
                        SelectProps={{ displayEmpty: true }}
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <Truck size={20} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      >
                        <MenuItem value="" disabled>
                          Seleccionar proveedor
                        </MenuItem>
                        {suppliers.map((s) => (
                          <MenuItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Categoría</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        select
                        size="small"
                        SelectProps={{ displayEmpty: true }}
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <Shapes size={20} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      >
                        <MenuItem value="" disabled>
                          Seleccionar categoría
                        </MenuItem>
                        {categories.map((c) => (
                          <MenuItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      </>
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );
      case 1:
        const su = watchedValues.sale_unit;
        const stockStep = su === "weight" ? 0.1 : 1;
        const unitInfo = unitLabels(su) || {};
        const stockLabel =
          su === "weight"
            ? "Stock en kg"
            : isContainerUnit(su)
              ? unitInfo.stockContainer
              : "Stock";
        const priceLabel =
          su === "weight"
            ? "Precio por Kilo"
            : isContainerUnit(su)
              ? su === "boxpack"
                ? "Precio por paquete"
                : "Precio por Pieza"
              : "Precio Venta";
        return (
          <Fade in={activeStep === 1} timeout={300}>
            <Box>
              <Box sx={{ mb: 2 }}>
                <Controller
                  name="sale_unit"
                  control={control}
                  render={({ field }) => (
                    <>
                      <FieldLabel>Unidad de venta</FieldLabel>
                      <TextField
                      {...field}
                      fullWidth
                      select
                      size="small"
                      sx={inputSx}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                              <Package size={18} color="#64748b" style={{ display: "block" }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    >
                      <MenuItem value="piece">Pieza</MenuItem>
                      <MenuItem value="weight">Kilo (precio por kg)</MenuItem>
                      <MenuItem value="box">Caja / Pieza</MenuItem>
                      <MenuItem value="package">Paquete / Pieza</MenuItem>
                      <MenuItem value="boxpack">Caja / Paquete / Pieza</MenuItem>
                    </TextField>
                    </>
                  )}
                />
                {su === "weight" && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5, ml: 1 }}
                  >
                    El precio se cobrará por kilogramo. En la venta se pedirá el
                    peso.
                  </Typography>
                )}
                {isContainerUnit(su) && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5, ml: 1 }}
                  >
                    {su === "boxpack"
                      ? "Vende por caja, por paquete o por pieza suelta. Configura los tres precios."
                      : `Vende por ${unitInfo.singular} o por pieza suelta. Configura ambos precios.`}
                  </Typography>
                )}
              </Box>

              <Grid container spacing={2.5}>
                {isContainerUnit(su) && (
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Controller
                      name="box_price"
                      control={control}
                      render={({ field }) => (
                        <>
                          <FieldLabel>{unitInfo.priceContainer}</FieldLabel>
                          <TextField
                          {...field}
                          fullWidth
                          type="number"
                          size="small"
                          sx={inputSx}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                  <DollarSign size={18} color="#64748b" style={{ display: "block" }} />
                                </InputAdornment>
                              ),
                            },
                          }}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                        </>
                      )}
                    />
                  </Grid>
                )}
                <Grid
                  size={{ xs: 6, sm: isContainerUnit(su) ? 3 : 4 }}
                >
                  <Controller
                    name="price"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>{priceLabel}</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        type="number"
                        size="small"
                        error={!!errors.price}
                        helperText={errors.price?.message}
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <DollarSign size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: isContainerUnit(su) ? 3 : 4 }}>
                  <Controller
                    name="cost_price"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Precio costo</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        type="number"
                        size="small"
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <DollarSign size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: isDark
                        ? "rgba(255,255,255,0.03)"
                        : "#fafaf9",
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Controller
                          name="has_discount"
                          control={control}
                          render={({ field }) => (
                            <Switch
                              checked={!!field.value}
                              onChange={(e) => {
                                field.onChange(e.target.checked);
                                if (!e.target.checked) setPriceTiers([]);
                              }}
                            />
                          )}
                        />
                      }
                      label={
                        <Box>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600 }}
                          >
                            Descuento/Promoción
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {watchedValues.has_discount
                              ? "Activo. Define el % o deja en 0 para descontar manual en caja."
                              : "Sin descuento/promoción para este producto."}
                          </Typography>
                        </Box>
                      }
                    />
                    {watchedValues.has_discount && (
                      <Box sx={{ mt: 1.5 }}>
                        <Controller
                          name="discount_percent"
                          control={control}
                          render={({ field }) => (
                            <>
                              <FieldLabel>Descuento (%)</FieldLabel>
                              <TextField
                              {...field}
                              fullWidth
                              type="number"
                              size="small"
                              sx={inputSx}
                              slotProps={{
                                input: {
                                  startAdornment: (
                                    <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                      <Percent size={18} color="#64748b" style={{ display: "block" }} />
                                    </InputAdornment>
                                  ),
                                },
                              }}
                              inputProps={{ min: 0, max: 100, step: 1 }}
                              helperText={
                                parseFloat(
                                  watchedValues.discount_percent || "0",
                                ) === 0
                                  ? "Con 0%, el botón de descuento aparecerá en el carrito."
                                  : "Este % se aplicará automáticamente en cada venta."
                              }
                            />
                            </>
                          )}
                        />
                      </Box>
                    )}
                    {watchedValues.has_discount && (
                      <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          Mayoreo / Promociones por cantidad
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mb: 1.5 }}
                        >
                          Combos: "10 por $25" (solo al comprar exactamente 10; si piden 11,
                          todo va a precio normal). Mayoreo: "a partir de 15
                          piezas, $30 por las 15" ($2 por pieza a partir de
                          ahí).
                        </Typography>
                        {priceTiers.map((tier, i) => (
                          <Stack
                            key={i}
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mb: 1 }}
                          >
                            <TextField
                              select
                              size="small"
                              value={tier.type}
                              onChange={(e) =>
                                updatePriceTier(i, "type", e.target.value)
                              }
                              sx={{ minWidth: 170, ...inputSx }}
                            >
                              <MenuItem value="combo">Combo X por $Y</MenuItem>
                              <MenuItem value="mayoreo">Mayoreo desde X</MenuItem>
                            </TextField>
                            <TextField
                              size="small"
                              type="number"
                              label={tier.type === "combo" ? "Cantidad (X)" : "Desde (X)"}
                              value={tier.qty}
                              onChange={(e) => updatePriceTier(i, "qty", e.target.value)}
                              sx={{ width: 110, ...inputSx }}
                              inputProps={{ min: 1 }}
                            />
                            <TextField
                              size="small"
                              type="number"
                              label={tier.type === "mayoreo" ? "Precio por pieza ($)" : "Precio ($)"}
                              value={tier.price}
                              onChange={(e) =>
                                updatePriceTier(i, "price", e.target.value)
                              }
                              sx={{ width: 120, ...inputSx }}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => removePriceTier(i)}
                              sx={{ color: "error.main" }}
                            >
                              <Trash2 size={18} />
                            </IconButton>
                          </Stack>
                        ))}
                        <Button
                          size="small"
                          startIcon={<Plus size={16} />}
                          onClick={addPriceTier}
                          sx={{ mt: 0.5 }}
                        >
                          Agregar promoción
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Grid>
              </Grid>

              <Grid container spacing={2.5} sx={{ mt: 2.5 }}>
{isContainerUnit(su) &&
                  (su === "boxpack" ? (
                    <Grid size={{ xs: 4 }}>
                      <FieldLabel>Piezas/caja</FieldLabel>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          height: 40,
                          px: 1.5,
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: isDark
                            ? "rgba(255,255,255,0.03)"
                            : "#fafaf9",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                        }}
                      >
                        {effectiveBoxQty() > 0
                          ? effectiveBoxQty()
                          : "—"}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          (calculado)
                        </Typography>
                      </Box>
                    </Grid>
                  ) : (
                    <Grid size={{ xs: 4 }}>
                      <Controller
                        name="box_qty"
                        control={control}
                        render={({ field }) => (
                          <>
                            <FieldLabel>{unitInfo.pzasPer}</FieldLabel>
                            <TextField
                            {...field}
                            fullWidth
                            type="number"
                            size="small"
                            helperText="Ej: 10 pz"
                            sx={inputSx}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                    <Hash size={18} color="#64748b" style={{ display: "block" }} />
                                  </InputAdornment>
                                ),
                              },
                            }}
                            inputProps={{ min: 1 }}
                          />
                          </>
                        )}
                      />
                    </Grid>
                  ))}
                <Grid size={{ xs: isContainerUnit(su) ? 4 : 6 }}>
                  <Controller
                    name="stock"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>{stockLabel}</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        type="number"
                        size="small"
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <Hash size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <Stack spacing={0.25} sx={{ m: -0.5 }}>
                                  <IconButton
                                    size="small"
                                    sx={{
                                      width: 26,
                                      height: 20,
                                      minHeight: 0,
                                      borderRadius: "2px",
                                    }}
                                    onClick={() =>
                                      field.onChange(
                                        String(
                                          Math.round(
                                            ((parseFloat(field.value) || 0) +
                                              stockStep) *
                                              100,
                                          ) / 100,
                                        ),
                                      )
                                    }
                                  >
                                    <ChevronUp size={16} color="#64748b" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    sx={{
                                      width: 26,
                                      height: 20,
                                      minHeight: 0,
                                      borderRadius: "2px",
                                    }}
                                    onClick={() =>
                                      field.onChange(
                                        String(
                                          Math.max(
                                            0,
                                            Math.round(
                                              ((parseFloat(field.value) || 0) -
                                                stockStep) *
                                                100,
                                            ) / 100,
                                          ),
                                        ),
                                      )
                                    }
                                  >
                                    <ChevronDown size={16} color="#64748b" />
                                  </IconButton>
                                </Stack>
                              </InputAdornment>
                            ),
                          },
                        }}
                        inputProps={{ min: 0, step: stockStep }}
                      />
                      </>
                    )}
                  />
                </Grid>
                <Grid size={{ xs: isContainerUnit(su) ? 4 : 6 }}>
                  <Controller
                    name="min_stock"
                    control={control}
                    render={({ field }) => (
                      <>
                        <FieldLabel>Stock mínimo</FieldLabel>
                        <TextField
                        {...field}
                        fullWidth
                        type="number"
                        size="small"
                        sx={inputSx}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                <Hash size={18} color="#64748b" style={{ display: "block" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        inputProps={{ min: 0 }}
                        helperText={
                          watchedStockPieces > 0 &&
                          !(parseInt(watchedValues.min_stock, 10) > 0)
                            ? `Mínimo automático: ${watchedAutoMin}`
                            : "Alerta de stock bajo"
                        }
                      />
                      </>
                    )}
                  />
                </Grid>
              </Grid>

              {su === "boxpack" && (
                <Box
                  sx={{
                    mt: 2.5,
                    p: 1.5,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#fafaf9",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, mb: 1 }}
                  >
                    Paquete (unidad media)
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 1.5 }}
                  >
                    La caja se vende completa, por paquetes o por pieza suelta.
                    Ej: caja con 12 paquetes de 10 piezas → 120 piezas por caja.
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Controller
                        name="packs_per_box"
                        control={control}
                        render={({ field }) => (
                          <>
                            <FieldLabel>Paquetes por caja</FieldLabel>
                            <TextField
                              {...field}
                              fullWidth
                              type="number"
                              size="small"
                              placeholder="Ej: 12"
                              sx={inputSx}
                              slotProps={{
                                input: {
                                  startAdornment: (
                                    <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                      <Hash size={18} color="#64748b" style={{ display: "block" }} />
                                    </InputAdornment>
                                  ),
                                },
                              }}
                              inputProps={{ min: 1 }}
                            />
                          </>
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Controller
                        name="pack_qty"
                        control={control}
                        render={({ field }) => (
                          <>
                            <FieldLabel>Piezas/paquete</FieldLabel>
                            <TextField
                              {...field}
                              fullWidth
                              type="number"
                              size="small"
                              placeholder="Ej: 10"
                              sx={inputSx}
                              slotProps={{
                                input: {
                                  startAdornment: (
                                    <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                      <Hash size={18} color="#64748b" style={{ display: "block" }} />
                                    </InputAdornment>
                                  ),
                                },
                              }}
                              inputProps={{ min: 1 }}
                            />
                          </>
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <Controller
                        name="pack_price"
                        control={control}
                        render={({ field }) => (
                          <>
                            <FieldLabel>Precio por pieza</FieldLabel>
                            <TextField
                              {...field}
                              fullWidth
                              type="number"
                              size="small"
                              placeholder="Ej: 15"
                              sx={inputSx}
                              slotProps={{
                                input: {
                                  startAdornment: (
                                    <InputAdornment position="start" sx={{ display: "flex", alignItems: "center" }}>
                                      <DollarSign size={18} color="#64748b" style={{ display: "block" }} />
                                    </InputAdornment>
                                  ),
                                },
                              }}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                          </>
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 2 }}
                      >
                        Piezas por caja:{" "}
                        {effectiveBoxQty() > 0 ? effectiveBoxQty() : "—"}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}

              <Box
                sx={{
                  mt: 2.5,
                  p: 1.75,
                  borderRadius: "8px",
                  bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#f5f5f4",
                  border: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "6px",
                    bgcolor: "rgba(16,185,129,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TrendingUp size={20} color="#059669" />
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, fontSize: "0.8rem" }}
                  >
                    Margen Calculado
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.7rem" }}
                  >
                    Basado en costo y venta:{" "}
                    <Typography
                      component="span"
                      sx={{
                        color: "success.main",
                        fontWeight: 800,
                        fontSize: "0.7rem",
                      }}
                    >
                      {calcMargin() !== null
                        ? `${calcMargin().toFixed(1)}%`
                        : "—"}
                    </Typography>
                    {calcPackMargin() !== null && (
                      <span style={{ display: "block", marginTop: 2 }}>
                        Margen paquete:{" "}
                        <Typography
                          component="span"
                          sx={{
                            color: "success.main",
                            fontWeight: 800,
                            fontSize: "0.7rem",
                          }}
                        >
                          {calcPackMargin().toFixed(1)}%
                        </Typography>
                      </span>
                    )}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Fade>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (activeStep < steps.length - 1) {
            handleNext();
          } else {
            handleSubmit(onSubmit)();
          }
        }
      }}
      PaperProps={{
        sx: {
          borderRadius: "8px",
          background: isDark
            ? "rgba(17, 24, 39, 0.98)"
            : "rgba(255, 255, 255, 0.98)",
          border: `1px solid ${isDark ? "rgba(59, 130, 246, 0.12)" : "rgba(37, 99, 235, 0.1)"}`,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: "8px",
              background: "linear-gradient(135deg, #234e8c 0%, #1a3b6e 100%)",
              display: "flex",
            }}
          >
            <Plus size={28} color="white" />
          </Box>
          <Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, fontSize: "1.3rem" }}
            >
              {editProduct ? "Editar Producto" : "Agregar Nuevo Producto"}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {editProduct
                ? "Modifique la información del producto"
                : "Complete la información del producto"}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <StepIndicator steps={steps} activeStep={activeStep} />

      <DialogContent sx={{ px: 3, pb: 2, flex: 1, overflowY: "auto" }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}
        {renderStepContent(activeStep)}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: "space-between" }}>
        <Box>
          {activeStep > 0 && (
            <Button
              onClick={handleBack}
              startIcon={<ChevronLeft size={18} />}
              variant="outlined"
            >
              Anterior
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{
              borderColor: "rgba(100,116,139,0.5)",
              color: "#64748b",
              "&:hover": {
                backgroundColor: "rgba(100,116,139,0.08)",
                borderColor: "#64748b",
              },
            }}
          >
            Cancelar
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              variant="contained"
              endIcon={<ChevronRight size={18} />}
              sx={{ backgroundColor: "#234e8c", "&:hover": { backgroundColor: "#1a3b6e" } }}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleSubmit(onSubmit)}
              variant="contained"
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <CheckCircle2 size={18} />
                )
              }
              sx={{ backgroundColor: "#234e8c", "&:hover": { backgroundColor: "#1a3b6e" } }}
            >
              {isSubmitting
                ? editProduct
                  ? "Actualizando..."
                  : "Agregando..."
                : editProduct
                  ? "Actualizar Producto"
                  : "Agregar Producto"}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AddProductModal;
