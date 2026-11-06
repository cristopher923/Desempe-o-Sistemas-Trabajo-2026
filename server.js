// Backend de DEMOSTRACIÓN para Webpay Plus (ambiente de integración de Transbank).
// Usa solo las credenciales públicas de integración del SDK. No hay cobros reales.
const express = require('express');
const cors = require('cors');
const { WebpayPlus, Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment } = require('transbank-sdk');

const PORT = process.env.PORT || 3001;
const FRONT = process.env.FRONT_URL || 'http://localhost:8080/pixelnova.html'; // sin #hash
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;

const tx = new WebpayPlus.Transaction(
  new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration)
);

const orders = new Map(); // buyOrder -> { status, amount } (en memoria, solo demo)
const app = express();
app.use(cors({ origin: new URL(FRONT).origin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1) El frontend pide crear la transacción
app.post('/webpay/create', async (req, res) => {
  const amount = Math.round(Number(req.body.amount));
  if (!(amount >= 1 && amount <= 5000000)) return res.status(400).json({ error: 'Monto inválido' });
  const buyOrder = 'PN' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const sessionId = 's' + Math.random().toString(36).slice(2, 12);
  try {
    const r = await tx.create(buyOrder, sessionId, amount, BASE + '/webpay/return');
    orders.set(buyOrder, { status: 'PENDING', amount });
    res.json({ url: r.url, token: r.token, buyOrder });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'No se pudo iniciar Webpay' });
  }
});

// 2) Webpay devuelve al usuario aquí (POST con token_ws, o con TBK_TOKEN si abortó)
app.all('/webpay/return', async (req, res) => {
  const p = { ...req.query, ...req.body };
  if (!p.token_ws) {
    const o = orders.get(p.TBK_ORDEN_COMPRA);
    if (o) o.status = 'ABORTED';
    return res.redirect(FRONT + '#webpay-fail');
  }
  try {
    const r = await tx.commit(p.token_ws);
    const o = orders.get(r.buy_order);
    if (o) o.status = r.response_code === 0 && r.status === 'AUTHORIZED' && r.amount === o.amount ? 'AUTHORIZED' : 'REJECTED';
    res.redirect(FRONT + (o && o.status === 'AUTHORIZED' ? '#webpay-ok' : '#webpay-fail'));
  } catch (e) {
    console.error(e);
    res.redirect(FRONT + '#webpay-fail');
  }
});

// 3) El frontend consulta el resultado antes de registrar la compra
app.get('/webpay/status/:bo', (req, res) => {
  const o = orders.get(req.params.bo);
  res.json({ status: o ? o.status : 'UNKNOWN' });
});

app.listen(PORT, () => console.log(`Backend Webpay (sandbox) en ${BASE}`));
