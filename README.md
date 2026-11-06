# PixelNova: guía de ejecución y GA4

## 1. Ejecutar el proyecto

Estructura:

```
pixelnova.html        <- tienda (frontend)
backend/server.js     <- backend de prueba Webpay Plus
backend/package.json
```

**Solo frontend (pago simulado):** sirve la carpeta con cualquier servidor estático.

```bash
npx serve . -p 8080
# abre http://localhost:8080/pixelnova.html
```

**Con Webpay Plus real en integración (sin cobros):**

```bash
cd backend
npm install
npm start            # http://localhost:3001
```

Luego, en `pixelnova.html`, cambia la configuración:

```js
const CFG={GA_ID:'G-XXXXXXXXXX',WEBPAY_API:'http://localhost:3001',TEST:true,CURRENCY:'CLP'};
```

Variables opcionales del backend: `PORT`, `FRONT_URL` (URL del HTML, sin `#`) y `BASE_URL`.

**Datos de prueba de Webpay (integración):** tarjeta Visa `4051 8856 0044 6623`, CVV `123`, cualquier fecha futura. En el simulador bancario: RUT `11.111.111-1`, clave `123`.

**Flujo:** el frontend llama a `POST /webpay/create`, redirige a Webpay, Webpay vuelve a `/webpay/return`, el servidor confirma el pago y redirige al frontend. Este consulta `/webpay/status/:buyOrder` y recién entonces registra la compra y dispara `purchase`.

**Limitaciones de la demo:**
- El servidor no recalcula precios: confía en el monto enviado. En producción debe recalcularlos con su propio catálogo.
- Los pedidos y la sesión viven en memoria y en localStorage.
- La autenticación es solo de demostración: no reemplaza un backend real con sesiones seguras.
- Para producción se necesitan credenciales propias de Transbank y HTTPS.

**Usuario de prueba:** `demo@pixelnova.cl` / `Demo1234`. Cupón: `NOVA10`.

## 2. Configurar GA4

### 2.0 Modo Google Tag Manager (el que está activo)

El HTML usa el contenedor **GTM-WPNZ7M77** (`CFG.GTM_ID`). Con un `GTM_ID` definido, la app envía los eventos al `dataLayer` en el formato recomendado para GTM, y `GA_ID` y `gtag.js` quedan sin uso. Si dejas `GTM_ID` vacío, vuelve el modo `gtag.js` directo con `GA_ID`.

Eventos que la app envía al `dataLayer`:
- `virtual_page_view` (con `page_title` y `page_location`)
- `view_item`, `add_to_cart`, `begin_checkout` y `purchase`, con el objeto `ecommerce` (más `transaction_type` en el nivel superior)
- `sign_up` y `login`, con `method`

El contenedor aún no envía nada a GA4: hay que crear las etiquetas en GTM.

1. **Etiqueta de Google (configuración de GA4):** crea una etiqueta "Etiqueta de Google" con tu ID de medición `G-...`. Actívala con el activador "Initialization - All Pages". En "Configuración" agrega el parámetro `send_page_view` = `false`.
2. **Variables:** crea variables de capa de datos (Data Layer Variable) para `page_title`, `page_location`, `transaction_type` y `method`.
3. **Activadores:** crea un activador de tipo "Evento personalizado" para cada nombre de evento: `virtual_page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`, `sign_up` y `login`.
4. **Etiquetas de evento GA4:**
   - `page_view`: activador `virtual_page_view`. Parámetros `page_title` y `page_location`.
   - `view_item`, `add_to_cart`, `begin_checkout` y `purchase`: cada una con su activador. En cada una marca "Enviar datos de comercio electrónico" con origen "Capa de datos".
   - En `purchase` agrega además el parámetro de evento `transaction_type` = variable `transaction_type`.
   - `sign_up` y `login` (opcionales): parámetro `method`.
5. **Prueba:** usa "Vista previa" en GTM y revisa DebugView en GA4 antes de publicar el contenedor.

Los pasos siguientes (marcar `purchase` como evento clave, la dimensión `transaction_type`, el embudo y las métricas) se aplican igual.

### 2.1 Modo gtag.js directo (solo si `GTM_ID` está vacío)

1. Crea una propiedad GA4 y un flujo de datos Web. Copia el ID de medición (`G-...`).
2. Pégalo en `CFG.GA_ID`. Con el ID real, el script carga `gtag.js` automáticamente (hospeda el HTML en tu dominio).
3. **Desactiva el page_view automático duplicado:** en Admin → Flujos de datos → tu flujo → Medición mejorada → engranaje, apaga "Cambios de página basados en eventos del historial del navegador". La app ya envía `page_view` manualmente en cada cambio de vista.
4. **Marca `purchase` como evento clave** (Admin → Eventos).
5. **Registra la dimensión personalizada** para separar pruebas de ventas reales: Admin → Definiciones personalizadas → Dimensión personalizada → ámbito Evento, nombre `Tipo de transacción`, parámetro `transaction_type`. Todas las compras de la demo llevan `transaction_type = test`.
6. **Prueba en vivo:** con `TEST:true` los eventos aparecen en Admin → DebugView. En producción pon `TEST:false`.
7. **Excluye tráfico interno** (opcional): Admin → Flujos de datos → Configurar → Definir tráfico interno, y activa el filtro de datos de tráfico interno.

### Eventos implementados

| Evento | Cuándo | Parámetros |
|---|---|---|
| `page_view` | Cada cambio de vista (una vez) | `page_title`, `page_location` |
| `view_item` | Entrar al detalle de producto | `currency`, `value`, `items` |
| `add_to_cart` | Agregar al carrito | `currency`, `value`, `items` |
| `begin_checkout` | Entrar al checkout | `currency`, `value`, `coupon`, `items` |
| `purchase` | Pago aprobado (una vez por `transaction_id`) | `transaction_id`, `currency`, `value`, `shipping`, `coupon`, `transaction_type`, `items` |
| `sign_up` / `login` | Registro e ingreso | `method` |

Cada ítem lleva `item_id`, `item_name`, `item_category`, `item_variant`, `price` y `quantity`.

## 3. Reportes y métricas

**Métricas nativas (Informes → Participación y Monetización):**
- **Usuarios activos:** Informes → Resumen.
- **Vistas por página:** Participación → Páginas y pantallas.
- **Sesiones con interacción:** Participación → Resumen.
- **Tiempo de interacción promedio:** Participación → Resumen. GA4 mide solo el tiempo en que la pestaña está activa, no el tiempo con la pestaña abierta.
- **Tasa de rebote:** es el complemento de la tasa de interacción. En Informes → Adquisición de tráfico, agrégala desde el lápiz de personalización de métricas.
- **Páginas por sesión:** Vistas ÷ Sesiones. Créala como métrica calculada en Explorar o en Looker Studio.
- **Tasa de conversión:** Informes → Monetización, o la columna "Tasa de conversión de sesión" al marcar `purchase` como evento clave.

**Embudo de compra (Explorar → Exploración de embudo):**
1. `view_item`
2. `add_to_cart`
3. `begin_checkout`
4. `purchase`

Usa "Embudo abierto" si quieres incluir usuarios que entran por cualquier paso. Para analizar solo ventas reales, aplica el filtro `Tipo de transacción` distinto de `test`.

**Abandono (se calcula con el embudo):**
- Abandono del carrito = 1 − (usuarios con `begin_checkout` ÷ usuarios con `add_to_cart`)
- Abandono del checkout = 1 − (usuarios con `purchase` ÷ usuarios con `begin_checkout`)
