// Cadastro e login de CLIENTES. Senhas nunca são salvas em texto puro (bcrypt).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { setAuthCookie, clearAuthCookie, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/auth-schema');

const router = express.Router();

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Trava de força bruta: 8 tentativas de login erradas a cada 15 min por IP.
// Login certo não gasta tentativa, então quem sabe a própria senha nunca esbarra.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  countOnlyFailures: true,
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

// Cadastro é mais folgado, mas ainda limitado para não virar máquina de criar contas.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Muitos cadastros a partir desta conexão. Tente novamente mais tarde.',
});

router.post('/register', registerLimiter, validateBody(registerSchema), async (req, res) => {
  try {
    const { name, phone, email, password, cpfCnpj } = req.body || {};
    if (!name || !phone || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos do cadastro.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Digite um e-mail válido.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const existing = await db.query('SELECT id FROM customers WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO customers (name, email, phone, cpf_cnpj, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, phone, cpf_cnpj`,
      [name.trim(), email.toLowerCase(), phone.trim(), cpfCnpj?.trim() || null, passwordHash]
    );
    const customer = result.rows[0];
    setAuthCookie(res, { sub: customer.id, role: 'customer', name: customer.name, email: customer.email });
    res.status(201).json({ customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, cpfCnpj: customer.cpf_cnpj } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar cadastro.' });
  }
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }
    const result = await db.query('SELECT * FROM customers WHERE email = $1', [email.toLowerCase()]);
    const customer = result.rows[0];
    if (!customer) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    const ok = await bcrypt.compare(password, customer.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    setAuthCookie(res, { sub: customer.id, role: 'customer', name: customer.name, email: customer.email });
    res.json({ customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, cpfCnpj: customer.cpf_cnpj } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao entrar na conta.' });
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireRole('customer'), async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, phone, cpf_cnpj FROM customers WHERE id = $1', [req.user.sub]);
    const c = result.rows[0];
    res.json({ customer: c ? { id: c.id, name: c.name, email: c.email, phone: c.phone, cpfCnpj: c.cpf_cnpj } : null });
  } catch (err) {
    console.error('[Auth:me]', err);
    res.status(500).json({ error: 'Erro ao carregar dados do cliente.' });
  }
});

router.put('/me', requireRole('customer'), async (req, res) => {
  try {
    const { name, email, cpfCnpj } = req.body || {};

    // O e-mail é a identidade de login do cliente. Antes dava para gravar
    // qualquer texto aqui (inclusive um e-mail já usado por outra conta, o que
    // estourava erro 500 e deixava o cliente sem conseguir entrar).
    let novoEmail = null;
    if (email !== undefined && email !== null && String(email).trim() !== '') {
      novoEmail = String(email).trim().toLowerCase();
      if (!EMAIL_RE.test(novoEmail)) {
        return res.status(400).json({ error: 'Digite um e-mail válido.' });
      }
      const emUso = await db.query('SELECT id FROM customers WHERE email = $1 AND id <> $2', [
        novoEmail,
        req.user.sub,
      ]);
      if (emUso.rows.length) {
        return res.status(409).json({ error: 'Este e-mail já está em uso por outra conta.' });
      }
    }

    const result = await db.query(
      `UPDATE customers SET
         name = COALESCE($1, name),
         email = COALESCE($2, email),
         cpf_cnpj = COALESCE($3, cpf_cnpj)
       WHERE id = $4 RETURNING id, name, email, phone, cpf_cnpj`,
      [name?.trim() || null, novoEmail, cpfCnpj?.trim() || null, req.user.sub]
    );
    const c = result.rows[0];
    if (!c) return res.status(404).json({ error: 'Cadastro não encontrado.' });

    // O nome e o e-mail também ficam gravados dentro do cookie de sessão;
    // sem renovar, o cliente continuaria a sessão com os dados antigos.
    setAuthCookie(res, { sub: c.id, role: 'customer', name: c.name, email: c.email });

    res.json({ customer: { id: c.id, name: c.name, email: c.email, phone: c.phone, cpfCnpj: c.cpf_cnpj } });
  } catch (err) {
    console.error('[Auth:updateMe]', err);
    res.status(500).json({ error: 'Erro ao atualizar dados.' });
  }
});


// ---- Sincronização em Nuvem do Carrinho do Cliente (Desktop <-> Celular) ----
let cartColumnReady = false;
async function ensureCustomerCartColumn() {
  if (cartColumnReady) return;
  try {
    await db.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS cart_json TEXT DEFAULT '[]'");
    cartColumnReady = true;
  } catch (err) {
    console.warn('[Cart:ensureCustomerCartColumn]', err.message);
  }
}

router.get('/cart', requireRole('customer'), async (req, res) => {
  try {
    await ensureCustomerCartColumn();
    const result = await db.query('SELECT cart_json FROM customers WHERE id = $1', [req.user.sub]);
    const raw = result.rows[0]?.cart_json;
    let items = [];
    if (raw) {
      try { items = JSON.parse(raw); } catch {}
    }
    res.json({ cart: Array.isArray(items) ? items : [] });
  } catch (err) {
    console.error('[Auth:getCart]', err);
    res.status(500).json({ error: 'Erro ao carregar carrinho.' });
  }
});

router.put('/cart', requireRole('customer'), async (req, res) => {
  try {
    await ensureCustomerCartColumn();
    const { cart } = req.body || {};
    const safeCart = Array.isArray(cart) ? cart : [];
    await db.query('UPDATE customers SET cart_json = $1 WHERE id = $2', [JSON.stringify(safeCart), req.user.sub]);
    res.json({ ok: true, cart: safeCart });
  } catch (err) {
    console.error('[Auth:putCart]', err);
    res.status(500).json({ error: 'Erro ao salvar carrinho.' });
  }
});

module.exports = router;

