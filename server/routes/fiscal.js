// Rotas do Módulo Fiscal & DANFE (Armazenamento Permanente no PostgreSQL)
// Garante persistência e integridade dos documentos fiscais sem depender de localStorage.
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas fiscais exigem autenticação de Administrador
router.use(requireRole('admin'));

/**
 * GET /api/fiscal/notes
 * Retorna todas as notas fiscais emitidas ou filtra por orderId
 */
router.get('/notes', async (req, res) => {
  try {
    const { orderId } = req.query;
    let queryText = `
      SELECT 
        fn.id,
        fn.order_id AS "orderId",
        fn.nf_number AS "nfNumber",
        fn.access_key AS "accessKey",
        fn.status,
        fn.printed,
        fn.printed_at AS "printedAt",
        fn.cce_text AS "cceText",
        fn.issued_at AS "issuedAt",
        fn.created_at AS "createdAt",
        o.customer_id AS "customerId",
        o.total_cents AS "totalCents",
        c.name AS "customerName",
        c.cpf_cnpj AS "customerCpfCnpj"
      FROM fiscal_notes fn
      LEFT JOIN orders o ON o.id = fn.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
    `;
    const params = [];

    if (orderId) {
      queryText += ' WHERE fn.order_id = $1';
      params.push(Number(orderId));
    }

    queryText += ' ORDER BY fn.order_id DESC';

    const result = await db.query(queryText, params);
    
    // Mapeamento indexado por orderId para rápida consulta na interface WMS
    const notesMap = {};
    result.rows.forEach((row) => {
      notesMap[row.orderId] = {
        id: row.id,
        orderId: row.orderId,
        nfNumber: row.nfNumber,
        accessKey: row.accessKey,
        status: row.status,
        printed: row.printed,
        printedAt: row.printedAt,
        cceText: row.cceText,
        issuedAt: row.issuedAt,
        customerName: row.customerName,
        totalCents: row.totalCents,
      };
    });

    res.json({ notes: result.rows, notesMap });
  } catch (err) {
    console.error('[Route:Fiscal:notes]', err.message);
    res.status(500).json({ error: 'Erro ao listar documentos fiscais.' });
  }
});

/**
 * POST /api/fiscal/notes
 * Registra ou atualiza emissão de nota fiscal para um pedido
 */
router.post('/notes', async (req, res) => {
  try {
    const { orderId, nfNumber, accessKey, status = 'AUTORIZADA', issuedAt } = req.body || {};

    if (!orderId || !accessKey) {
      return res.status(400).json({ error: 'orderId e accessKey são obrigatórios.' });
    }

    const calculatedNfNumber = Number(nfNumber) || (1000 + Number(orderId));
    const effectiveIssuedAt = issuedAt ? new Date(issuedAt) : new Date();

    const result = await db.query(
      `INSERT INTO fiscal_notes (order_id, nf_number, access_key, status, issued_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (order_id) DO UPDATE SET
         nf_number = EXCLUDED.nf_number,
         access_key = EXCLUDED.access_key,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING *`,
      [Number(orderId), calculatedNfNumber, String(accessKey).trim(), status, effectiveIssuedAt]
    );

    const saved = result.rows[0];
    res.status(201).json({
      ok: true,
      note: {
        orderId: saved.order_id,
        nfNumber: saved.nf_number,
        accessKey: saved.access_key,
        status: saved.status,
        printed: saved.printed,
        printedAt: saved.printed_at,
        cceText: saved.cce_text,
        issuedAt: saved.issued_at,
      },
    });
  } catch (err) {
    console.error('[Route:Fiscal:create]', err.message);
    res.status(500).json({ error: 'Erro ao registrar nota fiscal no banco de dados.' });
  }
});

/**
 * POST /api/fiscal/notes/mark-printed
 * Marca uma ou mais notas como impressas
 */
router.post('/notes/mark-printed', async (req, res) => {
  try {
    const { orderIds } = req.body || {};
    const ids = (Array.isArray(orderIds) ? orderIds : [orderIds])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um orderId válido.' });
    }

    const nowIso = new Date();
    await db.query(
      `UPDATE fiscal_notes
       SET printed = true, printed_at = $1, updated_at = now()
       WHERE order_id = ANY($2::int[])`,
      [nowIso, ids]
    );

    res.json({ ok: true, count: ids.length, printedAt: nowIso });
  } catch (err) {
    console.error('[Route:Fiscal:mark-printed]', err.message);
    res.status(500).json({ error: 'Erro ao marcar notas como impressas.' });
  }
});

/**
 * POST /api/fiscal/notes/:orderId/cce
 * Registra Carta de Correção Eletrônica (CC-e)
 */
router.post('/notes/:orderId/cce', async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const { cceText } = req.body || {};

    if (!orderId || !cceText || !cceText.trim()) {
      return res.status(400).json({ error: 'orderId e cceText são obrigatórios.' });
    }

    const result = await db.query(
      `UPDATE fiscal_notes
       SET cce_text = $1, updated_at = now()
       WHERE order_id = $2
       RETURNING *`,
      [cceText.trim(), orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nota fiscal não encontrada para este pedido.' });
    }

    res.json({ ok: true, orderId, cceText: result.rows[0].cce_text });
  } catch (err) {
    console.error('[Route:Fiscal:cce]', err.message);
    res.status(500).json({ error: 'Erro ao registrar Carta de Correção.' });
  }
});

module.exports = router;
