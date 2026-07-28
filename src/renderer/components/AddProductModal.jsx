import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  QrCode,
  Inventory,
  AttachMoney,
  Add,
  LocalShipping,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Category,
  QrCodeScanner,
  Percent,
} from '@mui/icons-material';

const productSchema = z.object({
  barcode: z.string().min(1, 'El código de barras es requerido'),
  name: z.string().min(1, 'El nombre del producto es requerido'),
  brand: z.string().optional(),
  price: z
    .string()
    .min(1, 'El precio es requerido')
    .refine((v) => parseFloat(v) > 0, 'El precio debe ser mayor a 0'),
  stock: z.string().optional(),
  supplier_id: z.string().optional(),
  category_id: z.string().optional(),
  cost_price: z.string().optional(),
  min_stock: z.string().optional(),
  discount_percent: z.string().optional(),
  sale_unit: z.string().optional(),
  box_qty: z.string().optional(),
  box_price: z.string().optional(),
});

const steps = ['Información', 'Precios e Inventario'];

const AddProductModal = ({
  open,
  onClose,
  onProductAdded,
  editProduct = null,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    trigger,
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      barcode: '',
      name: '',
      brand: '',
      price: '',
      stock: '0',
      supplier_id: '',
      category_id: '',
      cost_price: '',
      min_stock: '5',
      discount_percent: '0',
      sale_unit: 'piece',
      box_qty: '0',
      box_price: '',
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    if (open) {
      Promise.all([
        window.api.invoke('get-suppliers'),
        window.api.invoke('get-categories'),
      ]).then(([s, c]) => {
        setSuppliers(s);
        setCategories(c);
      });
      if (editProduct) {
        const isBox = editProduct.sale_unit === 'box';
        const boxQty = editProduct.box_qty || 0;
        reset({
          barcode: editProduct.barcode || '',
          name: editProduct.name || '',
          brand: editProduct.brand || '',
          price: editProduct.price?.toString() || '',
          stock:
            isBox && boxQty > 0
              ? Math.floor(editProduct.stock / boxQty).toString()
              : editProduct.stock?.toString() || '0',
          supplier_id: editProduct.supplier_id?.toString() || '',
          category_id: editProduct.category_id?.toString() || '',
          cost_price: editProduct.cost_price?.toString() || '',
          min_stock: editProduct.min_stock?.toString() || '5',
          discount_percent: editProduct.discount_percent?.toString() || '0',
          sale_unit: editProduct.sale_unit || 'piece',
          box_qty: boxQty.toString(),
          box_price: editProduct.box_price?.toString() || '',
        });
      } else {
        reset({
          barcode: '',
          name: '',
          brand: '',
          price: '',
          stock: '0',
          supplier_id: '',
          category_id: '',
          cost_price: '',
          min_stock: '5',
          discount_percent: '0',
          sale_unit: 'piece',
          box_qty: '0',
          box_price: '',
        });
      }
      setActiveStep(0);
      setSubmitError('');
      setIsSubmitting(false);
    }
  }, [open, editProduct, reset]);

  const calcFinalPrice = () => {
    const price = parseFloat(watchedValues.price) || 0;
    const disc = parseFloat(watchedValues.discount_percent) || 0;
    return price * (1 - disc / 100);
  };

  const handleNext = async () => {
    let fieldsToValidate = [];
    if (activeStep === 0)
      fieldsToValidate = ['barcode', 'name', 'brand', 'supplier_id'];
    else {
      fieldsToValidate = [
        'price',
        'stock',
        'cost_price',
        'min_stock',
        'discount_percent',
      ];
      if (watchedValues.sale_unit === 'box')
        fieldsToValidate.push('box_qty', 'box_price');
    }
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const boxQty = parseInt(data.box_qty) || 0;
      const productData = {
        barcode: data.barcode.trim(),
        name: data.name.trim(),
        brand: data.brand.trim() || 'Sin marca',
        price: parseFloat(data.price),
        stock:
          data.sale_unit === 'box'
            ? (parseInt(data.stock, 10) || 0) * boxQty
            : parseInt(data.stock, 10) || 0,
        supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
        category_id: data.category_id ? parseInt(data.category_id) : null,
        cost_price: parseFloat(data.cost_price) || 0,
        min_stock: parseInt(data.min_stock) || 5,
        discount_percent: parseFloat(data.discount_percent) || 0,
        sale_unit: data.sale_unit || 'piece',
        box_qty: boxQty,
        box_price: parseFloat(data.box_price) || 0,
      };

      let result;
      if (editProduct) {
        result = await window.api.invoke(
          'update-product',
          editProduct.id,
          productData,
        );
      } else {
        result = await window.api.invoke('add-product', productData);
      }

      if (result.success) {
        onProductAdded();
        handleClose();
      } else {
        setSubmitError(result.error || 'Error desconocido');
      }
    } catch (error) {
      setSubmitError(error.message || 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setActiveStep(0);
    setSubmitError('');
    setIsSubmitting(false);
    onClose();
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Fade in={activeStep === 0} timeout={300}>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <QrCodeScanner
                  sx={{ fontSize: 20, color: "#234e8c" }}
                />
                Información del Producto
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="barcode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Código de Barras"
                        size="small"
                        error={!!errors.barcode}
                        helperText={errors.barcode?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <QrCode sx={{ fontSize: 18 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Nombre del Producto"
                        size="small"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        placeholder="Ej: Coca Cola 600ml"
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="brand"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Marca"
                        size="small"
                        placeholder="Ej: Coca Cola (opcional)"
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="supplier_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Proveedor"
                        select
                        SelectProps={{ displayEmpty: true }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <LocalShipping sx={{ fontSize: 20 }} />
                            </InputAdornment>
                          ),
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
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="category_id"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Categoría"
                        select
                        SelectProps={{ displayEmpty: true }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Category sx={{ fontSize: 20 }} />
                            </InputAdornment>
                          ),
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
                    )}
                  />
                </Grid>
              </Grid>
            </Box>
          </Fade>
        );
      case 1:
        const su = watchedValues.sale_unit;
        const stockLabel =
          su === 'weight'
            ? 'Stock en kg'
            : su === 'box'
              ? 'Stock en cajas'
              : 'Stock';
        const priceLabel =
          su === 'weight'
            ? 'Precio por Kilo'
            : su === 'box'
              ? 'Precio por Pieza'
              : 'Precio Venta';
        return (
          <Fade in={activeStep === 1} timeout={300}>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  mb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <AttachMoney
                  sx={{ fontSize: 20, color: "#234e8c" }}
                />
                Precios e Inventario
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Controller
                  name="sale_unit"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Unidad de venta"
                      select
                      size="small"
                    >
                      <MenuItem value="piece">Pieza</MenuItem>
                      <MenuItem value="weight">Kilo (precio por kg)</MenuItem>
                      <MenuItem value="box">Caja / Pieza</MenuItem>
                    </TextField>
                  )}
                />
                {su === 'weight' && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, ml: 1 }}
                  >
                    El precio se cobrará por kilogramo. En la venta se pedirá el
                    peso.
                  </Typography>
                )}
                {su === 'box' && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, ml: 1 }}
                  >
                    Vende por caja completa o por pieza suelta. Configura ambos
                    precios.
                  </Typography>
                )}
              </Box>

              <Grid container spacing={1.5}>
                {su === 'box' && (
                  <Grid item xs={6} sm={3}>
                    <Controller
                      name="box_price"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Precio Caja"
                          type="number"
                          size="small"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                $
                              </InputAdornment>
                            ),
                          }}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      )}
                    />
                  </Grid>
                )}
                <Grid item xs={su === 'box' ? 6 : 6} sm={su === 'box' ? 3 : 4}>
                  <Controller
                    name="price"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={priceLabel}
                        type="number"
                        size="small"
                        error={!!errors.price}
                        helperText={errors.price?.message}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">$</InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={su === 'box' ? 3 : 4}>
                  <Controller
                    name="cost_price"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Precio Costo"
                        type="number"
                        size="small"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">$</InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6} sm={su === 'box' ? 3 : 4}>
                  <Controller
                    name="discount_percent"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Descuento"
                        type="number"
                        size="small"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Percent sx={{ fontSize: 16 }} />
                            </InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0, max: 100, step: 1 }}
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={1.5} sx={{ mt: 1.5 }}>
                {su === 'box' && (
                  <Grid item xs={4}>
                    <Controller
                      name="box_qty"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Pzas/caja"
                          type="number"
                          size="small"
                          helperText="Ej: 10 pz"
                          inputProps={{ min: 1 }}
                        />
                      )}
                    />
                  </Grid>
                )}
                <Grid item xs={su === 'box' ? 4 : 6}>
                  <Controller
                    name="stock"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={stockLabel}
                        type="number"
                        size="small"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Inventory sx={{ fontSize: 18 }} />
                            </InputAdornment>
                          ),
                        }}
                        inputProps={{ min: 0 }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={su === 'box' ? 4 : 6}>
                  <Controller
                    name="min_stock"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Stock Mínimo"
                        type="number"
                        size="small"
                        inputProps={{ min: 0 }}
                        helperText="Alerta de stock bajo"
                      />
                    )}
                  />
                </Grid>
              </Grid>
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
      PaperProps={{
        sx: {
          borderRadius: '20px',
          background: isDark
            ? 'rgba(17, 24, 39, 0.98)'
            : 'rgba(255, 255, 255, 0.98)',
          border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.1)'}`,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #234e8c 0%, #1a3b6e 100%)',
              display: 'flex',
            }}
          >
            <Add sx={{ color: 'white', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, fontSize: '1.3rem' }}
            >
              {editProduct ? 'Editar Producto' : 'Agregar Nuevo Producto'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {editProduct
                ? 'Modifique la información del producto'
                : 'Complete la información del producto'}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <Stepper activeStep={activeStep} sx={{ px: 3, py: 1 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <DialogContent sx={{ px: 3, pb: 2 }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}
        {renderStepContent(activeStep)}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Box>
          {activeStep > 0 && (
            <Button
              onClick={handleBack}
              startIcon={<ChevronLeft />}
              variant="outlined"
            >
              Anterior
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            onClick={handleClose}
            variant="outlined"
            sx={{
              borderColor: 'error.main',
              color: 'error.main',
              backgroundColor: 'rgba(239,68,68,0.06)',
              '&:hover': {
                backgroundColor: 'rgba(239,68,68,0.12)',
                borderColor: 'error.main',
              },
            }}
          >
            Cancelar
          </Button>
          {activeStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              variant="contained"
              endIcon={<ChevronRight />}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleSubmit(onSubmit)}
              variant="outlined"
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <CheckCircle />
                )
              }
              sx={{
                borderColor: 'success.main',
                color: 'success.main',
                backgroundColor: 'rgba(16,185,129,0.06)',
                '&:hover': {
                  backgroundColor: 'rgba(16,185,129,0.12)',
                  borderColor: 'success.main',
                },
              }}
            >
              {isSubmitting
                ? editProduct
                  ? 'Actualizando...'
                  : 'Agregando...'
                : editProduct
                  ? 'Actualizar Producto'
                  : 'Agregar Producto'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AddProductModal;
