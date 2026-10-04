# POS Móvil — Sistema de Ventas

Sistema POS de escritorio con aplicación móvil complementaria para escaneo de códigos de barras.

## Arquitectura

- **Escritorio**: Electron + React + Material UI + SQLite (better-sqlite3)
- **Móvil**: Expo (React Native) con escáner de código de barras
- **Comunicación**: API REST local + descubrimiento UDP (subred LAN)

## Requisitos

- Node.js ≥ 18
- npm ≥ 10
- Windows (para build con Squirrel), Linux o macOS

## Instalación — Escritorio

```bash
# Clonar
git clone https://github.com/Jacob-Jp/jrp-pos.git
cd my-pos-system

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm start
```

### Build para distribución

```bash
# Crear instalador Squirrel (.exe) y paquete ZIP
npm run make
```

Los artefactos se generan en `out/make/`. En Windows, el `Setup.exe` de Squirrel puede ser bloqueado por políticas de Control de aplicaciones cuando intenta iniciar su autoactualizador. Como alternativa, se genera también un ZIP de Windows que no ejecuta Squirrel: extrae su contenido y abre `JRP POS.exe`. Si la política de la computadora bloquea también la aplicación, solicita al administrador de TI que autorice el ejecutable/editor; no desactives la política.

## Instalación — App Móvil

```bash
cd mobile

# Instalar dependencias
npm install

# Iniciar servidor Expo
npx expo start
```

Escanea el código QR con Expo Go (SDK 57 beta) para abrir la app.

## Configuración

### Primera ejecución (escritorio)

1. Al abrir la app por primera vez, aparece el asistente de configuración
2. En la caja principal, selecciona **Caja Principal** y configura el negocio y el primer cajero administrador
3. La app crea automáticamente la base de datos SQLite e inicia el servidor Host en el puerto **3456**

### Conectar una caja adicional

1. En la caja Host, toma la IP y el puerto que aparecen junto a **SERVIDOR** en la barra superior.
2. En la caja Host, inicia sesión como administrador, abre **Configuración** y copia el **Código de activación del Host**. Solo se muestra a administradores. No necesitas abrir DevTools ni usar el modo desarrollo.
3. En la caja adicional, selecciona **Caja Adicional** e ingresa la IP/puerto y el código. La app validará la conexión y cargará el nombre de la tienda y los usuarios activos del Host.
4. Los usuarios del Cliente inician sesión con su PIN del Host; los PIN no se copian a la caja Cliente.

### Conexión móvil ↔ escritorio

1. La app de escritorio inicia automáticamente un servidor API en el puerto **3456** y un discoverer UDP en el puerto **3457**
2. La app móvil descubre el servidor escaneando la subred local
3. Una vez conectada, muestra un indicador verde en el navbar del escritorio

## Uso

### Escritorio

- **Terminal de Venta**: Registrar ventas con búsqueda de productos
- **Caja**: Abrir/cerrar caja, retirar dinero, ver resumen y movimientos del día
- **Productos**: CRUD de productos con soporte para venta por pieza, kilo y caja
- **Categorías / Proveedores**: Gestión de catálogo
- **Movimientos**: Historial de entradas/salidas de stock (solo admin)
- **Reportes**: Ventas y gastos por período (solo admin)
- **Cajeros**: Gestión de perfiles con PIN (solo admin)
- **Respaldo**: Crear y restaurar backups de la base de datos (solo admin)

### Móvil

- **Escáner**: Apunta al código de barras → muestra información del producto → permite aumentar stock o registrar producto nuevo
- **Búsqueda manual**: Busca productos por nombre, ve detalle, aumenta stock
- Autenticación por perfil (seleccionar cajero + ingresar PIN)

## Comandos útiles

```bash
# Escritorio
npm start              # Iniciar en desarrollo
npm run make           # Build para distribución

# Móvil
npx expo start         # Iniciar servidor Expo
npx expo start --android  # Iniciar en dispositivo Android
```
