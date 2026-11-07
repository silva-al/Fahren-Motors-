// Rotas de pagamentos
const express = require('express');
const db = require('../db');
const crypto = require('crypto');
const { requireRole, readToken } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { cardPaymentSchema } = require('../validators/payment-schema');

// Proteção de Idempotência: impede requisições concorrentes duplicadas para o mesmo pedido
const redisService = require('../services/redis-service');
const activeCardPayments = new Set();
const {
  createPixPayment,
  processCardPayment,
  checkPaymentStatus,
  markPaymentApproved,
  calculateInstallments,
  calculatePixAmount,
} = require('../services/payment-service');

const router = express.Router();

// Carrega o pedido e confere se quem está pedindo pode mexer nele.
async function loadOwnedOrder(req, orderId) {
  const user = readToken(req);
  if (!user) throw Object.assign(new Error('Não autenticado.'), { status: 401 });

  const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  if (!order) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });

  if (user.role === 'customer' && String(order.customer_id) !== String(user.sub)) {
    throw Object.assign(new Error('Acesso negado ao pedido.'), { status: 403 });
  }

  const customerRes = await db.query('SELECT * FROM customers WHERE id = $1', [order.customer_id]);
  const customer = customerRes.rows[0] || { name: 'Cliente', email: user.email };

  return { user, order, customer };
}

// Configuração pública do checkout (a loja usa para montar o formulário de cartão).
// Só devolve a PUBLIC KEY do Mercado Pago — o access token nunca sai do servidor.
router.get('/config', (_req, res) => {
  const publicKey = (process.env.MERCADOPAGO_PUBLIC_KEY || '').trim();
  res.json({
    publicKey: publicKey || null,
    cardEnabled: Boolean(publicKey),
    pixEnabled: Boolean(
      (process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim() || (process.env.PIX_KEY || '').trim()
    ),
  });
});

// Tabela de parcelas e desconto Pix para um valor
router.get('/installments', (req, res) => {
  const amount = Number(req.query.amount) || 0;
  const installments = calculateInstallments(amount);
  const pix = calculatePixAmount(amount);
  res.json({ installments, pix });
});

// Pagamento com cartão de crédito (Mercado Pago Bricks / Mock seguro).
const CARD_STATUS_MAP = { aprovado: 'approved', pendente: 'in_process', recusado: 'rejected' };

router.post('/card', validateBody(cardPaymentSchema), async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = body.orderId;
    if (!orderId) return res.status(400).json({ error: 'Informe o pedido.' });

    const lockKey = `lock:card-payment:${orderId}`;
    const acquiredLock = await redisService.acquireLock(lockKey, 30);
    if (!acquiredLock || activeCardPayments.has(Number(orderId))) {
      return res.status(409).json({ error: 'Processamento de pagamento já em andamento para este pedido. Aguarde.' });
    }
    activeCardPayments.add(Number(orderId));

    const { order, customer } = await loadOwnedOrder(req, orderId);

    if (order.payment_status === 'aprovado') {
      return res.status(409).json({ error: 'Este pedido já está pago.' });
    }

    const cardData = {
      cardToken: body.token || body.cardToken || null,
      paymentMethodId: body.payment_method_id || body.paymentMethodId || null,
      payment_method_id: body.payment_method_id || body.paymentMethodId || null,
      issuerId: body.issuer_id || body.issuerId || null,
      issuer_id: body.issuer_id || body.issuerId || null,
      cardBrand: body.cardBrand || body.payment_method_id || body.paymentMethodId || null,
      lastFour: body.lastFour || null,
      cpf: body.payer?.identification?.number || body.cpf || '',
      payer: body.payer || null,
      cardNumber: body.cardNumber || null,
    };

    const result = await processCardPayment(order, cardData, body.installments, customer);

    res.json({
      // Status em inglês (padrão Mercado Pago) para o front do Brick.
      // O padrão é 'rejected' de propósito: se um dia o serviço devolver um
      // status que não conhecemos, o certo é NÃO dizer ao cliente que o
      // pagamento passou. Falhar fechado, nunca aberto.
      status: CARD_STATUS_MAP[result.status] || 'rejected',
      // status interno gravado no pedido
      statusInterno: result.status,
      orderId: order.id,
      paymentId: result.paymentId,
      installments: result.installments,
      installmentValue: result.installmentValue,
      totalAmount: result.totalAmount,
      cardBrand: result.cardBrand,
      cardLastFour: result.cardLastFour,
      isSandbox: result.isSandbox,
      message: result.message,
      rejectionDetail: result.rejectionDetail,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error('[Route:Payments:card]', err.message);
    res.status(status).json({ error: err.message || 'Erro ao processar o pagamento com cartão.' });
  } finally {
    if (req.body && req.body.orderId) {
      activeCardPayments.delete(Number(req.body.orderId));
      await redisService.releaseLock(`lock:card-payment:${req.body.orderId}`);
    }
  }
});

// Gera Pix para um pedido
router.post('/pix/:orderId', async (req, res) => {
  try {
    const user = readToken(req);
    if (!user) return res.status(401).json({ error: 'Não autenticado.' });

    const orderId = req.params.orderId;
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const order = orderRes.rows[0];

    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (user.role === 'customer' && String(order.customer_id) !== String(user.sub)) {
      return res.status(403).json({ error: 'Acesso negado ao pedido.' });
    }

    const customerRes = await db.query('SELECT * FROM customers WHERE id = $1', [order.customer_id]);
    const customer = customerRes.rows[0] || { name: 'Cliente', email: user.email };

    const payment = await createPixPayment(order, customer);
    res.json({ payment });
  } catch (err) {
    console.error('[Route:Payments:pix]', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar Pix.' });
  }
});

// Checa status do pagamento (usado pelo polling no front-end da loja)
router.get('/:orderId/status', async (req, res) => {
  try {
    const statusData = await checkPaymentStatus(req.params.orderId);
    res.json(statusData);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Simula aprovação de pagamento (SOMENTE para testes em desenvolvimento).
// Fica desligada em produção e exige login de admin — antes qualquer pessoa que
// soubesse a URL conseguia marcar um pedido como pago.
router.post('/:orderId/simulate-approval', requireRole('admin'), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Aprovação simulada desativada em produção.' });
    }
    const order = await markPaymentApproved(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json({ ok: true, status: 'aprovado', orderStatus: order.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook Mercado Pago
router.post('/webhook', async (req, res) => {
  try {
    // Validação de Segurança HMAC Mercado Pago (quando configurado MERCADOPAGO_WEBHOOK_SECRET)
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];

    if (webhookSecret && xSignature) {
      try {
        const parts = xSignature.split(',');
        let ts = null;
        let v1 = null;
        for (const p of parts) {
          const [k, v] = p.split('=');
          if (k && v) {
            if (k.trim() === 'ts') ts = v.trim();
            if (k.trim() === 'v1') v1 = v.trim();
          }
        }
        if (ts && v1) {
          const dataId = req.query['data.id'] || req.body?.data?.id || '';
          const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts};`;
          const hmac = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');
          if (hmac !== v1) {
            console.warn('[Webhook:Security] Assinatura HMAC inválida no webhook.');
            return res.status(401).send('Invalid signature');
          }
        }
      } catch (sigErr) {
        console.warn('[Webhook:Security] Erro ao validar assinatura:', sigErr.message);
      }
    }

    const { action, data } = req.body || {};
    if (data && data.id) {
      const paymentId = String(data.id);
      const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (token) {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.status === 'approved') {
            await db.query(
              `UPDATE orders SET
                 payment_status = 'aprovado',
                 status = CASE WHEN status = 'novo' THEN 'em_preparacao' ELSE status END,
                 updated_at = now()
               WHERE payment_id = $1`,
              [paymentId]
            );
          }
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Payment:Webhook] Erro:', err);
    res.status(200).send('OK');
  }
});

module.exports = router;
