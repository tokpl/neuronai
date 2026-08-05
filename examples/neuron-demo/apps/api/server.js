import express from 'express';
import { listOrders, createOrder } from './modules/orders.js';
import { startPayment } from './modules/payments.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/orders', async (_req, res) => {
  const data = await listOrders();
  res.json({ data, error: null, meta: {} });
});

app.post('/orders', async (req, res) => {
  const order = await createOrder(req.body);
  res.status(201).json({ data: order, error: null, meta: {} });
});

app.post('/payments/start', async (req, res) => {
  const payment = await startPayment(req.body);
  res.status(202).json({ data: payment, error: null, meta: {} });
});

const port = Number(process.env.PORT ?? 4080);
app.listen(port, () => {
  console.log(`ShopLite API on http://127.0.0.1:${port}`);
});
