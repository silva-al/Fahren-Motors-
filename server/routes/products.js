// Catálogo de peças: busca pública (com filtros avançados) + CRUD restrito ao admin.
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function toCents(reais) {
  if (reais === null || reais === undefined || reais === '') return 0;
  if (typeof reais === 'string') {
    const clean = reais.replace(/[^\d.,-]/g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val * 100);
  }
  const num = Number(reais);
  return isNaN(num) ? 0 : Math.round(num * 100);
}
function toReais(cents) {
  return Math.round(cents) / 100;
}
function parsePhotoList(rawVal) {
  if (!rawVal) return [];
  if (Array.isArray(rawVal)) {
    return Array.from(new Set(rawVal.map((s) => String(s || '').trim()).filter(Boolean)));
  }
  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.map((s) => String(s || '').trim()).filter(Boolean)));
        }
      } catch {}
    }
    return Array.from(new Set(trimmed.split(',').map((s) => s.trim()).filter(Boolean)));
  }
  return [];
}

function formatPhotoUrlForDb(body) {
  if (!body) return null;
  if ('photos' in body && Array.isArray(body.photos)) {
    const list = parsePhotoList(body.photos);
    return list.length ? list.join(', ') : null;
  }
  const val = body.photoUrl !== undefined ? body.photoUrl : body.photo_url;
  const list = parsePhotoList(val);
  return list.length ? list.join(', ') : null;
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function isFictitiousPhoto(url) {
  if (!url) return false;
  const s = String(url).trim().toLowerCase();
  if (!s) return false;
  return (
    s.startsWith('images/produtos/') ||
    s.startsWith('/images/produtos/') ||
    s.startsWith('images/categorias/') ||
    s.startsWith('/images/categorias/') ||
    s.startsWith('loja/images/') ||
    s.startsWith('/loja/images/')
  );
}

function isRealPhotoUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (!s || s.startsWith('data:image/svg+xml')) return false;
  return !isFictitiousPhoto(s);
}

function isRealWmsProduct(product) {
  if (!product) return false;
  const photos = Array.isArray(product.photos) ? product.photos : parsePhotoList(product.photoUrl || product.photo_url);
  if (!photos.length) return true; // Peça cadastrada/editada no WMS sem foto ainda é real (não é semente fictícia)
  return photos.some(isRealPhotoUrl);
}

function serialize(row) {
  const photos = parsePhotoList(row.photo_url);
  const normalizedPhotoUrl = photos.length ? photos.join(', ') : null;
  const qty = Number(row.stock_qty) || 0;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    category: row.category,
    description: row.description,
    compatibility: row.compatibility,
    price: toReais(row.price_cents),
    stockQty: qty,
    inStock: qty > 0,
    photoUrl: normalizedPhotoUrl,
    photos,
    location: row.location || null,
    active: row.active,
    itemType: row.item_type || 'peca',
  };
}

// GET /api/products?q=&category=&min_price=&max_price=&in_stock=true&type=
// Busca avançada: texto (nome/código), categoria, faixa de preço, disponibilidade, tipo.
const { syncCatalog } = require('../sync-catalog');

const CATEGORY_CANONICAL_MAP = {
  freio: 'Freios',
  freios: 'Freios',
  eletrica: 'Elétrica e ignição',
  'elétrica': 'Elétrica e ignição',
  ignicao: 'Elétrica e ignição',
  'ignição': 'Elétrica e ignição',
  'eletrica e ignicao': 'Elétrica e ignição',
  'elétrica e ignição': 'Elétrica e ignição',
  suspensao: 'Suspensão',
  'suspensão': 'Suspensão',
  sensor: 'Sensores e injeção',
  sensores: 'Sensores e injeção',
  injecao: 'Sensores e injeção',
  'injeção': 'Sensores e injeção',
  'sensores e injeção': 'Sensores e injeção',
  'sensores e injecao': 'Sensores e injeção',
  filtro: 'Filtros',
  filtros: 'Filtros',
  correia: 'Correias',
  correias: 'Correias',
  oleo: 'Óleos e fluidos',
  'óleo': 'Óleos e fluidos',
  oleos: 'Óleos e fluidos',
  'óleos': 'Óleos e fluidos',
  fluido: 'Óleos e fluidos',
  fluidos: 'Óleos e fluidos',
  'fluídos': 'Óleos e fluidos',
  'óleos e fluidos': 'Óleos e fluidos',
  'oleos e fluidos': 'Óleos e fluidos',
  iluminacao: 'Iluminação',
  'iluminação': 'Iluminação',
  lampada: 'Iluminação',
  'lâmpada': 'Iluminação'
};

function normalizeServerCategory(raw) {
  if (!raw) return '';
  const key = String(raw).toLowerCase().trim();
  return CATEGORY_CANONICAL_MAP[key] || raw.trim();
}

function getCategoryMatchValues(raw) {
  const norm = normalizeServerCategory(raw);
  if (!norm) return [];
  const normLower = norm.toLowerCase();
  const matches = new Set([normLower, String(raw).toLowerCase().trim()]);
  for (const [alias, canonical] of Object.entries(CATEGORY_CANONICAL_MAP)) {
    if (canonical.toLowerCase() === normLower) {
      matches.add(alias);
    }
  }
  return Array.from(matches);
}


router.get('/', async (req, res) => {
  try {
    // Garante sincronização inicial do catálogo se o banco estiver vazio ou desatualizado
    await syncCatalog();

    const { q, category, min_price, max_price, in_stock, type } = req.query;
    const clauses = ['active = true'];
    const params = [];

    if (q) {
      params.push(`%${q.trim()}%`);
      clauses.push(`(name ILIKE $` + params.length + ` OR code ILIKE $` + params.length + ` OR description ILIKE $` + params.length + ` OR location ILIKE $` + params.length + ` OR compatibility ILIKE $` + params.length + ` OR category ILIKE $` + params.length + `)`);
    }
    if (category) {
      const catMatches = getCategoryMatchValues(category);
      if (catMatches.length > 0) {
        params.push(catMatches);
        clauses.push(`LOWER(TRIM(COALESCE(category, ''))) = ANY($${params.length}::text[])`);
      }
    }
    if (type) {
      params.push(type);
      clauses.push(`item_type = $${params.length}`);
    }
    if (min_price) {
      params.push(toCents(min_price));
      clauses.push(`price_cents >= $${params.length}`);
    }
    if (max_price) {
      params.push(toCents(max_price));
      clauses.push(`price_cents <= $${params.length}`);
    }
    if (in_stock === 'true') {
      clauses.push('stock_qty > 0');
    } else if (in_stock === 'false') {
      clauses.push('stock_qty = 0');
    }

    const sql = `SELECT * FROM products WHERE ${clauses.join(' AND ')} ORDER BY name ASC, id ASC`;
    const result = await db.query(sql, params);
    const allSerialized = result.rows.map(serialize);
    const realItems = allSerialized.filter(isRealWmsProduct);
    const baseList = realItems.length > 0 ? realItems : allSerialized;
    const finalProducts = baseList.slice().sort((a, b) => {
      const aHasReal = a.photos && a.photos.some(isRealPhotoUrl) ? 0 : 1;
      const bHasReal = b.photos && b.photos.some(isRealPhotoUrl) ? 0 : 1;
      if (aHasReal !== bHasReal) return aHasReal - bHasReal;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
    setNoCacheHeaders(res);
    res.json({ products: finalProducts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar peças.' });
  }
});

router.post('/sync-catalog', requireRole('admin'), async (_req, res) => {
  try {
    await syncCatalog(true);
    res.json({ ok: true, message: 'Catálogo sincronizado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao sincronizar catálogo.' });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    await syncCatalog();
    const result = await db.query(`
      SELECT id, name, category, photo_url, stock_qty
      FROM products
      WHERE category IS NOT NULL AND TRIM(category) <> '' AND active = true
      ORDER BY name ASC, id ASC
    `);

    const byCat = new Map();
    let hasAnyRealGlobal = false;

    for (const row of result.rows) {
      const normCat = normalizeServerCategory(row.category);
      if (!normCat) continue;
      const photos = parsePhotoList(row.photo_url);
      const isRealProd = isRealWmsProduct({ photos });
      const realPhoto = photos.find(isRealPhotoUrl) || null;
      const inStock = (Number(row.stock_qty) || 0) > 0;
      if (isRealProd) hasAnyRealGlobal = true;

      if (!byCat.has(normCat)) {
        byCat.set(normCat, {
          name: normCat,
          realAvailableCount: 0,
          realTotalCount: 0,
          seedAvailableCount: 0,
          seedTotalCount: 0,
          bestRealPhoto: null,
        });
      }
      const entry = byCat.get(normCat);
      if (isRealProd) {
        entry.realTotalCount += 1;
        if (inStock) entry.realAvailableCount += 1;
        if (realPhoto && !entry.bestRealPhoto) {
          entry.bestRealPhoto = realPhoto;
        }
      } else {
        entry.seedTotalCount += 1;
        if (inStock) entry.seedAvailableCount += 1;
      }
    }

    const categories = Array.from(byCat.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((entry) => ({
        name: entry.name,
        count: hasAnyRealGlobal ? entry.realAvailableCount : entry.seedAvailableCount,
        totalCount: hasAnyRealGlobal ? entry.realTotalCount : entry.seedTotalCount,
        photo: entry.bestRealPhoto,
        hasRealPhoto: Boolean(entry.bestRealPhoto),
      }));

    setNoCacheHeaders(res);
    res.json({
      categories,
      names: categories.map((c) => c.name),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar categorias.' });
  }
});

router.get('/categories/featured', async (_req, res) => {
  try {
    await syncCatalog();
    const result = await db.query(`
      SELECT id, name, code, category, description, compatibility, price_cents, stock_qty, photo_url, location, active
      FROM products
      WHERE active = true
      ORDER BY updated_at DESC, id ASC
      LIMIT 80
    `);
    const allList = result.rows.map(serialize);
    const realList = allList.filter(isRealWmsProduct);
    const baseList = realList.length > 0 ? realList : allList;
    const list = baseList
      .slice()
      .sort((a, b) => {
        const aHasReal = a.photos && a.photos.some(isRealPhotoUrl) ? 0 : 1;
        const bHasReal = b.photos && b.photos.some(isRealPhotoUrl) ? 0 : 1;
        return aHasReal - bHasReal;
      })
      .slice(0, 40);
    setNoCacheHeaders(res);
    res.json({
      categories: list,
      products: list,
      featured: list.map((p) => ({
        category: p.category,
        product: p,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar peças em destaque por categoria.' });
  }
});

router.get('/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Peça não encontrada.' });
  setNoCacheHeaders(res);
  res.json({ product: serialize(result.rows[0]) });
});

// ---- Rotas de gestão (somente admin) ----

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, code, category, description, compatibility, price, stockQty, location } = req.body || {};
    const photoUrl = formatPhotoUrlForDb(req.body);
    const itemType = (req.body && (req.body.itemType || req.body.item_type)) || 'peca';
    if (!name) {
      return res.status(400).json({ error: 'O nome da peça/produto é obrigatório.' });
    }
    const finalPrice = price !== undefined && price !== null && price !== '' ? toCents(price) : 0;
    const initialStock = Math.max(0, parseInt(stockQty, 10) || 0);
    const normalizedCat = category ? normalizeServerCategory(category) : null;

    const result = await db.query(
      `INSERT INTO products (name, code, category, description, compatibility, price_cents, stock_qty, photo_url, location, item_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name.trim(), code || null, normalizedCat, description || null, compatibility || null, finalPrice, initialStock, photoUrl || null, location || null, itemType]
    );
    const newProd = result.rows[0];
    if (newProd.stock_qty > 0) {
      await db.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, to_location, user_name, reference, notes)
         VALUES ($1, 'entrada', $2, 0, $2, $3, 'Administrador', 'Cadastro Inicial', 'Entrada de saldo inicial no cadastro')`,
        [newProd.id, newProd.stock_qty, newProd.location || 'Sem localização']
      );
    }
    res.status(201).json({ product: serialize(newProd) });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe uma peça com esse código.' });
    res.status(500).json({ error: 'Erro ao cadastrar peça.' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const body = req.body || {};
    const { name, code, category, description, compatibility, price, stockQty, location, active } = body;
    const hasPhotoField = ('photoUrl' in body) || ('photo_url' in body) || ('photos' in body);
    const nextPhotoUrl = hasPhotoField ? formatPhotoUrlForDb(body) : null;
    const itemType = (body.itemType || body.item_type) ?? null;
    const prevRes = await db.query('SELECT stock_qty, location FROM products WHERE id = $1', [req.params.id]);
    const prevProd = prevRes.rows[0];

    const result = await db.query(
      `UPDATE products SET
         name = COALESCE($1, name),
         code = COALESCE($2, code),
         category = COALESCE($3, category),
         description = COALESCE($4, description),
         compatibility = COALESCE($5, compatibility),
         price_cents = COALESCE($6, price_cents),
         stock_qty = COALESCE($7, stock_qty),
         photo_url = CASE WHEN $13::boolean THEN $8 ELSE photo_url END,
         location = COALESCE($9, location),
         active = COALESCE($10, active),
         item_type = COALESCE($11, item_type),
         updated_at = now()
       WHERE id = $12 RETURNING *`,
      [
        name?.trim() ?? null,
        code ?? null,
        category !== undefined && category !== null && String(category).trim() !== '' ? normalizeServerCategory(category) : null,
        description ?? null,
        compatibility ?? null,
        (price !== undefined && price !== null && price !== '') ? toCents(price) : null,
        stockQty !== undefined ? stockQty : null,
        nextPhotoUrl,
        location ?? null,
        active !== undefined ? active : null,
        itemType,
        req.params.id,
        hasPhotoField,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Peça não encontrada.' });

    const updatedProd = result.rows[0];
    if (prevProd && stockQty !== undefined && Number(stockQty) !== Number(prevProd.stock_qty)) {
      const diff = Number(stockQty) - Number(prevProd.stock_qty);
      await db.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, from_location, to_location, user_name, reference, notes)
         VALUES ($1, 'ajuste', $2, $3, $4, $5, $6, 'Administrador', 'Ajuste de Estoque', 'Alteração de saldo no painel')`,
        [
          req.params.id,
          diff,
          prevProd.stock_qty,
          updatedProd.stock_qty,
          prevProd.location || 'Sem localização',
          updatedProd.location || 'Sem localização'
        ]
      );
    }

    res.json({ product: serialize(updatedProd) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar peça.' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    // Marca a peça como desativada (active = false) para garantir integridade referencial com pedidos
    // e impedir que rotinas de sincronização restaurem a peça pelo código
    let result = await db.query('UPDATE products SET active = false WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length) return res.json({ ok: true, deleted: true, deactivated: true });

    // Fallback: tenta DELETE direto se não foi encontrada pelo update
    const del = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (del.rows.length) return res.json({ ok: true, deleted: true });

    res.status(404).json({ error: 'Peça não encontrada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir peça.' });
  }
});

module.exports = router;
