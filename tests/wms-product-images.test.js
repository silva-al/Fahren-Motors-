import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { Window } from 'happy-dom';

const request = require('supertest');
const db = require('../server/db');
const app = require('../server/app');
const { signToken, ADMIN_COOKIE_NAME } = require('../server/middleware/auth');

function createInMemoryProductsDb(initialRow) {
  const rows = new Map([[Number(initialRow.id), { ...initialRow }]]);

  return async function fakeQuery(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();

    if (/^ALTER TABLE/i.test(normalized)) {
      return { rows: [] };
    }
    if (/SELECT count\(\*\)::int AS count FROM products/i.test(normalized)) {
      return { rows: [{ count: rows.size }] };
    }
    if (/^SELECT stock_qty, location FROM products WHERE id = \$1$/i.test(normalized)) {
      const r = rows.get(Number(params[0]));
      return { rows: r ? [{ stock_qty: r.stock_qty, location: r.location }] : [] };
    }
    if (/^SELECT \* FROM products WHERE id = \$1$/i.test(normalized)) {
      const r = rows.get(Number(params[0]));
      return { rows: r ? [{ ...r }] : [] };
    }
    if (/^SELECT \* FROM products WHERE/i.test(normalized)) {
      return { rows: [...rows.values()].filter((r) => r.active !== false).map((r) => ({ ...r })) };
    }
    if (/^INSERT INTO stock_movements/i.test(normalized)) {
      return { rows: [] };
    }
    if (/^UPDATE products SET/i.test(normalized)) {
      const id = Number(params[11]);
      const current = rows.get(id);
      if (!current) return { rows: [] };

      const coalesce = (val, fallback) => (val !== null && val !== undefined ? val : fallback);

      // Simula fielmente a semântica SQL usada pela query do backend:
      let nextPhotoUrl;
      if (/CASE WHEN \$13::boolean THEN \$8 ELSE photo_url END/i.test(normalized)) {
        nextPhotoUrl = params[12] ? params[7] : current.photo_url;
      } else {
        // Semântica antiga: COALESCE($8, photo_url)
        nextPhotoUrl = coalesce(params[7], current.photo_url);
      }

      const updated = {
        ...current,
        name: coalesce(params[0], current.name),
        code: coalesce(params[1], current.code),
        category: coalesce(params[2], current.category),
        description: coalesce(params[3], current.description),
        compatibility: coalesce(params[4], current.compatibility),
        price_cents: coalesce(params[5], current.price_cents),
        stock_qty: coalesce(params[6], current.stock_qty),
        photo_url: nextPhotoUrl,
        location: coalesce(params[8], current.location),
        active: coalesce(params[9], current.active),
        item_type: coalesce(params[10], current.item_type),
      };
      rows.set(id, updated);
      return { rows: [{ ...updated }] };
    }
    return { rows: [] };
  };
}

describe('Backend API - Persistência de Imagens de Peças no WMS (PUT /api/products/:id)', () => {
  let originalQuery;
  let adminCookie;

  beforeEach(() => {
    originalQuery = db.query;
    const token = signToken({ sub: 1, role: 'admin', name: 'Everton Admin', email: 'admin@fahren.com' });
    adminCookie = `${ADMIN_COOKIE_NAME}=${token}`;
  });

  afterEach(() => {
    db.query = originalQuery;
  });

  it('deve limpar definitivamente photo_url no banco quando photoUrl=null ou photos=[] for enviado', async () => {
    db.query = createInMemoryProductsDb({
      id: 3299,
      name: 'BARRA AXIAL ESQUERDA/DIREITA GOL/FOX',
      code: '680192',
      category: 'Suspensão',
      description: 'Barra axial',
      compatibility: 'VW Gol/Fox',
      price_cents: 5189,
      stock_qty: 2,
      photo_url: '/api/uploads/img/22.jpg',
      location: 'C-01-01',
      active: true,
      item_type: 'peca',
    });

    const putRes = await request(app)
      .put('/api/products/3299')
      .set('Cookie', [adminCookie])
      .send({ photoUrl: null, photos: [] });

    expect(putRes.status).toBe(200);
    expect(putRes.body.product.photoUrl).toBeNull();
    expect(putRes.body.product.photos).toEqual([]);

    const getRes = await request(app).get('/api/products/3299');
    expect(getRes.status).toBe(200);
    expect(getRes.headers['cache-control']).toContain('no-store');
    expect(getRes.body.product.photoUrl).toBeNull();
    expect(getRes.body.product.photos).toEqual([]);
  });

  it('deve atualizar photo_url quando photos (array) for enviado em PUT /api/products/:id', async () => {
    db.query = createInMemoryProductsDb({
      id: 3298,
      name: 'BARRA AXIAL 175MM',
      code: 'BRD0288',
      category: 'Suspensão',
      description: 'Barra axial',
      compatibility: 'Universal',
      price_cents: 6487,
      stock_qty: 1,
      photo_url: '/api/uploads/img/19.jpg',
      location: 'C-01-02',
      active: true,
      item_type: 'peca',
    });

    const putRes = await request(app)
      .put('/api/products/3298')
      .set('Cookie', [adminCookie])
      .send({ photos: ['/api/uploads/img/19.jpg', '/api/uploads/img/30.jpg'] });

    expect(putRes.status).toBe(200);
    expect(putRes.body.product.photos).toEqual(['/api/uploads/img/19.jpg', '/api/uploads/img/30.jpg']);
    expect(putRes.body.product.photoUrl).toBe('/api/uploads/img/19.jpg, /api/uploads/img/30.jpg');
  });

  it('deve preservar photo_url existente em atualizações parciais de estoque sem campo de foto', async () => {
    db.query = createInMemoryProductsDb({
      id: 3300,
      name: 'BUCHA BARRA ESTABILIZADORA',
      code: '2790',
      category: 'Suspensão',
      description: 'Bucha',
      compatibility: 'Universal',
      price_cents: 4461,
      stock_qty: 2,
      photo_url: '/api/uploads/img/23.jpg',
      location: 'C-01-03',
      active: true,
      item_type: 'peca',
    });

    const putRes = await request(app)
      .put('/api/products/3300')
      .set('Cookie', [adminCookie])
      .send({ stockQty: 7, inStock: true });

    expect(putRes.status).toBe(200);
    expect(putRes.body.product.stockQty).toBe(7);
    expect(putRes.body.product.photoUrl).toBe('/api/uploads/img/23.jpg');
    expect(putRes.body.product.photos).toEqual(['/api/uploads/img/23.jpg']);
  });
});

describe('Frontend WMS (admin.js) - Adição e Exclusão de Imagens sem Reversão', () => {
  function bootWmsEnvironment(initialProducts) {
    const htmlPath = path.join(__dirname, '..', 'public', 'admin', 'index.html');
    const jsPath = path.join(__dirname, '..', 'public', 'admin', 'admin.js');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    const win = new Window({ url: 'http://localhost:3000/admin/#produtos' });
    win.document.write(htmlContent);

    let serverProducts = initialProducts.map((p) => ({
      ...p,
      photos: Array.isArray(p.photos) ? [...p.photos] : (p.photoUrl ? p.photoUrl.split(',').map((s) => s.trim()).filter(Boolean) : []),
    }));
    const putCalls = [];
    const syncCatalogCalls = [];

    const fakeFetch = vi.fn(async (url, opts = {}) => {
      const u = String(url);
      const method = (opts.method || 'GET').toUpperCase();

      if (u.includes('/api/admin/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ admin: { id: 1, name: 'Everton', email: 'admin@fahren.com' } }),
        };
      }
      if (u.includes('/api/products/sync-catalog') && method === 'POST') {
        syncCatalogCalls.push(u);
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (u.includes('/api/uploads') && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            url: '/api/uploads/img/99.jpg',
            urls: ['/api/uploads/img/99.jpg'],
          }),
        };
      }
      const putMatch = u.match(/\/api\/products\/(\d+)/);
      if (putMatch && method === 'PUT') {
        const id = Number(putMatch[1]);
        const body = JSON.parse(opts.body || '{}');
        putCalls.push({ id, body });
        const target = serverProducts.find((item) => Number(item.id) === id);
        if (target) {
          if ('photos' in body || 'photoUrl' in body) {
            const list = Array.isArray(body.photos)
              ? body.photos.filter(Boolean)
              : body.photoUrl
                ? String(body.photoUrl).split(',').map((s) => s.trim()).filter(Boolean)
                : [];
            target.photos = list;
            target.photoUrl = list.length ? list.join(', ') : null;
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ product: { ...target } }),
        };
      }
      if (u.includes('/api/products')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ products: serverProducts.map((p) => ({ ...p, photos: [...(p.photos || [])] })) }),
        };
      }
      if (u.includes('/api/orders')) {
        return { ok: true, status: 200, json: async () => ({ orders: [] }) };
      }
      if (u.includes('/api/stock/alerts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ counts: { criticos: 0, baixos: 0, semLocalizacao: 0, divergencias: 0, total: 0 }, items: {} }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    win.fetch = fakeFetch;
    win.confirm = () => true;
    win.alert = () => {};
    win.scrollTo = () => {};
    win.requestAnimationFrame = (cb) => setTimeout(cb, 0);

    const sandbox = win;
    sandbox.fetch = fakeFetch;
    sandbox.console = console;
    vm.runInNewContext(jsContent, sandbox, { filename: 'admin.js' });

    return { win, putCalls, syncCatalogCalls, getServerProducts: () => serverProducts };
  }

  it('ao excluir uma imagem na edição da peça, salva imediatamente no backend e a imagem NÃO volta ao atualizar', async () => {
    const { win, putCalls, getServerProducts } = bootWmsEnvironment([
      {
        id: 3298,
        name: 'BARRA AXIAL 175MM',
        code: 'BRD0288',
        category: 'Suspensão',
        price: 64.87,
        stockQty: 2,
        inStock: true,
        location: 'C-01-01',
        photoUrl: '/api/uploads/img/19.jpg, /api/uploads/img/20.jpg',
        photos: ['/api/uploads/img/19.jpg', '/api/uploads/img/20.jpg'],
      },
    ]);

    await new Promise((r) => setTimeout(r, 50));

    // Abre edição da peça 3298 e remove a primeira imagem
    win.startEdit(3298);
    await win.removeProductPhoto(0);
    await new Promise((r) => setTimeout(r, 30));

    expect(putCalls.length).toBeGreaterThanOrEqual(1);
    expect(getServerProducts()[0].photos).toEqual(['/api/uploads/img/20.jpg']);

    // Simula atualização global (ex.: polling 15s / foco / troca de aba)
    await win.refreshAllData();
    win.startEdit(3298);
    const thumbs = win.document.querySelectorAll('#pPhotoThumbnails .photo-thumb-card');
    expect(thumbs.length).toBe(1);
    expect(win.document.getElementById('pPhoto').value).toBe('/api/uploads/img/20.jpg');
  });

  it('ao excluir TODAS as imagens da peça, salva photoUrl=null, não restaura do cache antigo e não exibe foto falsa de categoria no WMS', async () => {
    const { win, putCalls, getServerProducts } = bootWmsEnvironment([
      {
        id: 3299,
        name: 'PASTILHA DE FREIO',
        code: 'PF-100',
        category: 'Freios',
        price: 120.0,
        stockQty: 5,
        inStock: true,
        location: 'B-01-01',
        photoUrl: '/images/categorias/filtros.jpg',
        photos: ['/images/categorias/filtros.jpg'],
      },
    ]);

    await new Promise((r) => setTimeout(r, 50));

    // Simula cache antigo sujo no localStorage antes da exclusão
    win.localStorage.setItem(
      'fm_cache_products',
      JSON.stringify([
        {
          id: 3299,
          name: 'PASTILHA DE FREIO',
          code: 'PF-100',
          category: 'Freios',
          price: 120.0,
          stockQty: 5,
          inStock: true,
          photoUrl: '/images/categorias/filtros.jpg',
          photos: ['/images/categorias/filtros.jpg'],
        },
      ])
    );

    win.startEdit(3299);
    win.document.getElementById('btnClearAllPhotos').click();
    await new Promise((r) => setTimeout(r, 40));

    expect(putCalls.length).toBeGreaterThanOrEqual(1);
    expect(getServerProducts()[0].photoUrl).toBeNull();
    expect(getServerProducts()[0].photos).toEqual([]);

    // No WMS, peça sem foto não pode exibir foto de filtro/freio como se a imagem tivesse voltado
    const renderedPhoto = win.getProductPhoto(getServerProducts()[0]);
    expect(renderedPhoto).not.toContain('filtros.jpg');
    expect(renderedPhoto).not.toContain('freios.jpg');
    expect(renderedPhoto).toContain('data:image/svg+xml');
  });

  it('ao anexar nova imagem na edição da peça, persiste imediatamente no backend para não perder nem voltar ao estado anterior', async () => {
    const { win, putCalls, getServerProducts } = bootWmsEnvironment([
      {
        id: 3300,
        name: 'BUCHA SAMPEL',
        code: '2790',
        category: 'Suspensão',
        price: 44.61,
        stockQty: 2,
        inStock: true,
        location: 'C-01-03',
        photoUrl: '/api/uploads/img/23.jpg',
        photos: ['/api/uploads/img/23.jpg'],
      },
    ]);

    await new Promise((r) => setTimeout(r, 50));

    win.startEdit(3300);

    const fileInput = win.document.getElementById('pPhotoFile');
    const fakeFile = new win.File([new Uint8Array([255, 216, 255, 217])], 'nova-peca.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', {
      value: [fakeFile],
      configurable: true,
    });
    fileInput.dispatchEvent(new win.Event('change'));

    await new Promise((r) => setTimeout(r, 80));

    expect(putCalls.length).toBeGreaterThanOrEqual(1);
    expect(getServerProducts()[0].photos).toEqual(['/api/uploads/img/23.jpg', '/api/uploads/img/99.jpg']);

    // Ao recarregar os dados, a nova foto permanece firme
    await win.refreshAllData();
    win.startEdit(3300);
    expect(win.document.getElementById('pPhoto').value).toBe('/api/uploads/img/23.jpg, /api/uploads/img/99.jpg');
  });

  it('refreshAllData NÃO deve sobrescrever allProducts já carregado em memória com cache antigo do localStorage', async () => {
    const { win } = bootWmsEnvironment([
      {
        id: 3277,
        name: 'DISCO FREIO HF750',
        code: 'HF750',
        category: 'Freios',
        price: 322.86,
        stockQty: 1,
        inStock: true,
        location: 'B-02-01',
        photoUrl: '/api/uploads/img/24.jpg',
        photos: ['/api/uploads/img/24.jpg'],
      },
    ]);

    await new Promise((r) => setTimeout(r, 50));

    // Coloca um cache antigo com outra foto no localStorage e simula falha temporária de rede no próximo fetch
    win.localStorage.setItem(
      'fm_cache_products',
      JSON.stringify([
        {
          id: 3277,
          name: 'DISCO FREIO HF750',
          code: 'HF750',
          category: 'Freios',
          price: 322.86,
          stockQty: 1,
          inStock: true,
          photoUrl: '/api/uploads/img/FOTO_ANTIGA_999.jpg',
          photos: ['/api/uploads/img/FOTO_ANTIGA_999.jpg'],
        },
      ])
    );
    win.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: 'Temporariamente indisponível' }) }));

    await win.refreshAllData();

    win.startEdit(3277);
    expect(win.document.getElementById('pPhoto').value).toBe('/api/uploads/img/24.jpg');
  });
});

