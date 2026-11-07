import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { Window } from 'happy-dom';

const request = require('supertest');
const db = require('../server/db');
const app = require('../server/app');
const { signToken, ADMIN_COOKIE_NAME } = require('../server/middleware/auth');

function createMockDb(initialRows = []) {
  const rows = new Map(initialRows.map((r) => [Number(r.id), { ...r }]));

  return async function fakeQuery(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (/^ALTER TABLE/i.test(normalized) || /^INSERT INTO stock_movements/i.test(normalized)) {
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
    if (/^SELECT id, name, code, category/i.test(normalized) || /^SELECT \* FROM products WHERE/i.test(normalized)) {
      return { rows: [...rows.values()].filter((r) => r.active !== false).map((r) => ({ ...r })) };
    }
    if (/^UPDATE products SET/i.test(normalized)) {
      const id = Number(params[11]);
      const current = rows.get(id);
      if (!current) return { rows: [] };
      const coalesce = (val, fallback) => (val !== null && val !== undefined ? val : fallback);
      const nextPhotoUrl = params[12] ? params[7] : current.photo_url;
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
    if (/^UPDATE products SET active = false WHERE id = \$1/i.test(normalized)) {
      const id = Number(params[0]);
      const cur = rows.get(id);
      if (!cur) return { rows: [] };
      cur.active = false;
      return { rows: [{ id }] };
    }
    return { rows: [] };
  };
}

function bootAdminDom(initialProducts = []) {
  const htmlPath = path.join(__dirname, '..', 'public', 'admin', 'index.html');
  const jsPath = path.join(__dirname, '..', 'public', 'admin', 'admin.js');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  const win = new Window({ url: 'http://localhost:3000/admin/#estoque' });
  win.document.write(htmlContent);

  let serverProducts = initialProducts.map((p) => ({
    ...p,
    photos: Array.isArray(p.photos)
      ? [...p.photos]
      : p.photoUrl
        ? String(p.photoUrl).split(',').map((s) => s.trim()).filter(Boolean)
        : [],
  }));
  let uploadSeq = 100;
  const syncCatalogCalls = [];
  const putCalls = [];
  const deleteCalls = [];

  const fakeFetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();

    if (u.includes('/api/admin/auth/me')) {
      return { ok: true, status: 200, json: async () => ({ admin: { id: 1, name: 'Everton', email: 'admin@fahren.com' } }) };
    }
    if (u.includes('/api/products/sync-catalog') && method === 'POST') {
      syncCatalogCalls.push(u);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (u.includes('/api/uploads') && method === 'POST') {
      uploadSeq += 1;
      const nextUrl = `/api/uploads/img/${uploadSeq}.jpg`;
      return { ok: true, status: 200, json: async () => ({ ok: true, url: nextUrl, urls: [nextUrl] }) };
    }
    const prodIdMatch = u.match(/\/api\/products\/(\d+)/);
    if (prodIdMatch && method === 'PUT') {
      const id = Number(prodIdMatch[1]);
      const body = JSON.parse(opts.body || '{}');
      putCalls.push({ id, body });
      const target = serverProducts.find((item) => Number(item.id) === id);
      if (target && ('photos' in body || 'photoUrl' in body)) {
        const list = Array.isArray(body.photos)
          ? body.photos.filter(Boolean)
          : body.photoUrl
            ? String(body.photoUrl).split(',').map((s) => s.trim()).filter(Boolean)
            : [];
        target.photos = list;
        target.photoUrl = list.length ? list.join(', ') : null;
      }
      return { ok: true, status: 200, json: async () => ({ product: { ...target } }) };
    }
    if (prodIdMatch && method === 'DELETE') {
      const id = Number(prodIdMatch[1]);
      deleteCalls.push(id);
      serverProducts = serverProducts.filter((item) => Number(item.id) !== id);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
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
      return { ok: true, status: 200, json: async () => ({ counts: { criticos: 0, baixos: 0, semLocalizacao: 0, divergencias: 0, total: 0 }, items: {} }) };
    }
    if (u.includes('/api/stock/movements')) {
      return { ok: true, status: 200, json: async () => ({ movements: [] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  win.fetch = fakeFetch;
  win.confirm = () => true;
  win.alert = () => {};
  win.scrollTo = () => {};
  win.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  // Simula compressão real de navegador (createImageBitmap + canvas.toBlob reduzindo arquivo de 7MB para ~120KB)
  win.createImageBitmap = async () => ({ width: 3000, height: 2000 });
  const origCreateElement = win.document.createElement.bind(win.document);
  win.document.createElement = (tagName, ...rest) => {
    const el = origCreateElement(tagName, ...rest);
    if (String(tagName).toLowerCase() === 'canvas') {
      el.getContext = () => ({
        fillStyle: '#fff',
        fillRect: () => {},
        drawImage: () => {},
        imageSmoothingEnabled: false,
      });
      el.toBlob = (cb) => cb(new win.Blob([new Uint8Array(1024)], { type: 'image/jpeg' }));
      el.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    }
    return el;
  };

  const sandbox = win;
  sandbox.fetch = fakeFetch;
  sandbox.createImageBitmap = win.createImageBitmap;
  sandbox.console = console;
  vm.runInNewContext(jsContent, sandbox, { filename: 'admin.js' });
  win.allProducts = serverProducts;

  return { win, putCalls, deleteCalls, syncCatalogCalls, getServerProducts: () => serverProducts };
}

function bootLojaDom(getProductsState) {
  const htmlPath = path.join(__dirname, '..', 'public', 'loja', 'index.html');
  const jsPath = path.join(__dirname, '..', 'public', 'loja', 'loja.js');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  const win = new Window({ url: 'http://localhost:3000/#pecas' });
  win.document.write(htmlContent);

  const fakeFetch = vi.fn(async (url) => {
    const u = String(url);
    const list = getProductsState();
    const idMatch = u.match(/\/api\/products\/(\d+)/);
    if (idMatch) {
      const found = list.find((p) => Number(p.id) === Number(idMatch[1]));
      if (!found) return { ok: false, status: 404, json: async () => ({ error: 'Não encontrada' }) };
      return { ok: true, status: 200, json: async () => ({ product: { ...found, photos: [...(found.photos || [])] } }) };
    }
    if (u.includes('/api/products/categories/featured')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          categories: list,
          products: list,
          featured: list.map((p) => ({ category: p.category, product: p })),
        }),
      };
    }
    if (u.includes('/api/products/categories')) {
      const cats = [...new Set(list.map((p) => p.category).filter(Boolean))].map((name) => ({ name, count: 1 }));
      return { ok: true, status: 200, json: async () => ({ categories: cats, names: cats.map((c) => c.name) }) };
    }
    if (u.includes('/api/products')) {
      return { ok: true, status: 200, json: async () => ({ products: list.map((p) => ({ ...p, photos: [...(p.photos || [])] })) }) };
    }
    if (u.includes('/api/auth/me')) {
      return { ok: false, status: 401, json: async () => ({ error: 'Não autenticado' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });

  win.fetch = fakeFetch;
  win.alert = () => {};
  win.confirm = () => true;
  win.scrollTo = () => {};
  win.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  const sandbox = win;
  sandbox.fetch = fakeFetch;
  sandbox.console = console;
  vm.runInNewContext(jsContent, sandbox, { filename: 'loja.js' });

  return { win, fakeFetch };
}

describe('1. Código de Barras (Code128) nas Etiquetas WMS e Modais', () => {
  it('generateCode128Svg separa claramente <rect class="barcode-bg"> (#ffffff) de <rect class="barcode-bar"> (#000000) e admin.css não pinta o fundo de preto', () => {
    const { win } = bootAdminDom([
      {
        id: 10,
        name: 'Aditivo de Radiador Concentrado Orgânico Tirreno Long Life 1L',
        code: 'TIRR-LL-ORG1',
        category: 'Óleos e fluidos',
        price: 39.9,
        stockQty: 12,
        inStock: true,
        location: 'H-03-01',
      },
    ]);

    const svg = win.generateCode128Svg('TIRR-LL-ORG1', 28, 'label-barcode-svg');
    expect(svg).toContain('class="barcode-bg"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('class="barcode-bar"');
    expect(svg).toContain('fill="#000000"');

    // Verifica que existem dezenas de barras individuais e apenas 1 fundo branco
    const bgMatches = svg.match(/class="barcode-bg"/g) || [];
    const barMatches = svg.match(/class="barcode-bar"/g) || [];
    expect(bgMatches.length).toBe(1);
    expect(barMatches.length).toBeGreaterThan(25);

    const adminCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'admin.css'), 'utf8');
    // Garante que NÃO existe seletor genérico .stock-label-card svg rect { fill: #000000 !important } pintando o retângulo de fundo de preto
    expect(adminCss).not.toMatch(/\.stock-label-card\s+svg\s+rect\s*(?:,|\{)/);
    expect(adminCss).toMatch(/\.barcode-bg[\s\S]*?fill:\s*#ffffff\s*!important/i);
    expect(adminCss).toMatch(/\.barcode-bar[\s\S]*?fill:\s*#000000\s*!important/i);
  });
});

describe('2. Layout Sem Cortes e Botões Ver / Editar / Excluir Empilhados Verticalmente', () => {
  it('admin.css mantém .prod-actions-stack empilhado um em cima do outro (flex-direction: column) e garante min-width: 0 / max-width: 100% nos containers', () => {
    const adminCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'admin.css'), 'utf8');

    // Captura todos os blocos .prod-actions-stack { ... } e garante que o último usa flex-direction: column
    const stackBlocks = [...adminCss.matchAll(/\.prod-actions-stack\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(stackBlocks.length).toBeGreaterThan(0);
    const lastStackBlock = stackBlocks[stackBlocks.length - 1];
    expect(lastStackBlock).toMatch(/flex-direction:\s*column\s*!important/i);
    expect(lastStackBlock).not.toMatch(/flex-direction:\s*row/i);

    // Garante contenção responsiva sem estourar a tela
    expect(adminCss).toMatch(/\.estoque-left-col[\s\S]*?min-width:\s*0\s*!important/i);
  });

  it('renderProductsTable também empilha ações em .prod-actions-stack e vincula o botão Excluir ([data-remove])', async () => {
    const { win, deleteCalls } = bootAdminDom([
      {
        id: 501,
        name: 'Kit Embreagem Luk',
        code: 'LUK-501',
        category: 'Transmissão',
        price: 599.9,
        stockQty: 4,
        inStock: true,
        active: true,
        itemType: 'produto',
      },
    ]);

    await win.refreshAllData();
    win.renderProductsTable(win.allProducts || []);

    const stack = win.document.querySelector('#productsTableBody .prod-actions-stack');
    expect(stack).not.toBeNull();

    const delBtn = win.document.querySelector('#productsTableBody [data-remove="501"]');
    expect(delBtn).not.toBeNull();
    delBtn.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(deleteCalls).toContain(501);
  });
});

describe('3. Fluxo Completo de Imagens Ilimitadas (15+ fotos), Exclusão Real e Sincronização WMS <-> Loja (Desktop & Mobile)', () => {
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

  it('POST /api/products/sync-catalog exige autenticação de administrador e PUT /api/products/:id aceita 20+ fotos sem limite artificial', async () => {
    const twentyFivePhotos = Array.from({ length: 25 }, (_, i) => `/api/uploads/img/${1000 + i}.jpg`);
    db.query = createMockDb([
      {
        id: 800,
        name: 'Amortecedor Dianteiro Cofap Turbogás',
        code: 'GP32900',
        category: 'Suspensão',
        description: 'Amortecedor',
        compatibility: 'Onix / Prisma',
        price_cents: 38990,
        stock_qty: 8,
        photo_url: '/api/uploads/img/1.jpg',
        location: 'A-01-01',
        active: true,
        item_type: 'peca',
      },
    ]);

    const unauthSync = await request(app).post('/api/products/sync-catalog');
    expect(unauthSync.status).toBe(401);

    const putRes = await request(app)
      .put('/api/products/800')
      .set('Cookie', [adminCookie])
      .send({ photos: twentyFivePhotos });

    expect(putRes.status).toBe(200);
    expect(putRes.body.product.photos).toHaveLength(25);
    expect(putRes.body.product.photos).toEqual(twentyFivePhotos);
  });

  it('WMS comprime fotos >5MB de celular ANTES de validar limite, permite anexar 15+ fotos seguidas e o botão Atualizar não chama sync-catalog', async () => {
    const { win, putCalls, syncCatalogCalls, getServerProducts } = bootAdminDom([
      {
        id: 901,
        name: 'Farol Principal Full LED',
        code: 'FAR-901',
        category: 'Elétrica',
        price: 890,
        stockQty: 3,
        inStock: true,
        location: 'D-02-01',
        photoUrl: null,
        photos: [],
      },
    ]);

    await new Promise((r) => setTimeout(r, 40));

    // Clicar em Atualizar (#refreshBtn) NÃO pode chamar /products/sync-catalog para não ressuscitar peças excluídas
    win.document.getElementById('refreshBtn')?.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(syncCatalogCalls).toHaveLength(0);

    // Edita peça e anexa 15 fotos de uma vez, incluindo foto bruta de 7MB do celular (que após comprimirImagem cai para ~1KB)
    win.startEdit(901);
    const fileInput = win.document.getElementById('pPhotoFile');
    const fifteenFiles = Array.from({ length: 15 }, (_, idx) => {
      const bytes = idx === 0 ? new Uint8Array(7 * 1024 * 1024) : new Uint8Array([255, 216, 255, 217]);
      return new win.File([bytes], `foto-celular-${idx + 1}.jpg`, { type: 'image/jpeg' });
    });

    Object.defineProperty(fileInput, 'files', {
      value: fifteenFiles,
      configurable: true,
    });
    fileInput.dispatchEvent(new win.Event('change'));

    await new Promise((r) => setTimeout(r, 150));

    expect(putCalls.length).toBeGreaterThanOrEqual(1);
    expect(getServerProducts()[0].photos).toHaveLength(15);

    // Modal "Ver Peça" no WMS exibe todas as 15 miniaturas clicáveis
    await win.openProductViewModal(901);
    const pvThumbs = win.document.querySelectorAll('#pvPhotoThumbs img');
    expect(pvThumbs.length).toBe(15);
  });

  it('Loja Virtual exibe 15+ fotos no catálogo e na tela de detalhes, atualiza ao vivo sem cache velho e remove a imagem de verdade quando excluída (sem foto falsa de filtro)', async () => {
    const fifteenUrls = Array.from({ length: 15 }, (_, i) => `/api/uploads/img/${500 + i}.jpg`);
    let state = [
      {
        id: 777,
        name: 'Disco de Freio Ventilado Hipper Freios',
        code: 'HF-777',
        category: 'Freios',
        description: 'Disco ventilado',
        compatibility: 'VW Golf / Audi A3',
        price: 349.9,
        stockQty: 6,
        inStock: true,
        photoUrl: fifteenUrls.join(', '),
        photos: [...fifteenUrls],
      },
    ];

    const { win } = bootLojaDom(() => state);
    await new Promise((r) => setTimeout(r, 80));

    // 1. Catálogo renderiza slider com todas as 15 fotos
    await win.loadCatalog();
    const cardCounter = win.document.querySelector('#catalogResults .product[data-product-id="777"] .card-photo-counter');
    expect(cardCounter?.textContent).toBe('1/15');

    // 2. Abrir detalhes busca sempre dados frescos da API mesmo se passar cachedProduct desatualizado
    const staleCached = { ...state[0], photoUrl: '/api/uploads/img/500.jpg', photos: ['/api/uploads/img/500.jpg'] };
    await win.openProductDetails(777, staleCached);

    const slides = win.document.querySelectorAll('#gallerySlidesTrack .gallery-slide');
    const thumbs = win.document.querySelectorAll('#galleryThumbsRow .gallery-thumb');
    const dots = win.document.querySelectorAll('#galleryDotsRow .g-dot');
    const detailCounter = win.document.getElementById('detailSlideCounter');

    expect(slides.length).toBe(15);
    expect(thumbs.length).toBe(15);
    expect(dots.length).toBe(15);
    expect(detailCounter?.textContent).toBe('1 / 15');

    // 3. Simula exclusão de TODAS as fotos no WMS e disparo de refreshLojaStockData() (mesmo sem busca/filtro preenchido)
    state = [
      {
        ...state[0],
        photoUrl: null,
        photos: [],
      },
    ];

    win.refreshLojaStockData();
    await new Promise((r) => setTimeout(r, 80));

    // Tanto a tela de detalhes aberta quanto o card do catálogo passam a mostrar placeholder neutro "Sem foto" (NUNCA filtros.jpg / freios.jpg)
    const detailImgSrc = win.document.querySelector('#gallerySlidesTrack .gallery-slide img')?.getAttribute('src') || '';
    expect(detailImgSrc).toContain('data:image/svg+xml');
    expect(detailImgSrc).not.toContain('filtros.jpg');
    expect(detailImgSrc).not.toContain('freios.jpg');

    const catalogImgSrc = win.document.querySelector('#catalogResults .product[data-product-id="777"] img')?.getAttribute('src') || '';
    expect(catalogImgSrc).toContain('data:image/svg+xml');
    expect(catalogImgSrc).not.toContain('filtros.jpg');
    expect(catalogImgSrc).not.toContain('freios.jpg');

    // 4. Verifica CSS da galeria na Loja para garantir que 2ª..Nª fotos têm object-fit: contain e miniaturas não cortam na esquerda
    const lojaCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'loja', 'styles.css'), 'utf8');
    expect(lojaCss).toMatch(/\.gallery-slide\s+\.slide-img-wrap\s+img[\s\S]*?object-fit:\s*contain\s*!important/i);
    const thumbRowBlocks = [...lojaCss.matchAll(/\.gallery-thumbs-row\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const lastThumbRowBlock = thumbRowBlocks[thumbRowBlocks.length - 1];
    expect(lastThumbRowBlock).toMatch(/justify-content:\s*flex-start\s*!important/i);
  });
});

describe('4. Rolagem estável (sem "subir pra cima do nada")', () => {
  it('sincronização de estoque em segundo plano NÃO rola a tela para o topo na peça, no catálogo nem no carrinho', async () => {
    let state = [
      { id: 901, name: 'Pastilha de Freio', code: 'PF-901', category: 'Freios', description: 'x', compatibility: 'Gol', price: 120, stockQty: 5, inStock: true, photoUrl: '/api/uploads/img/1.jpg', photos: ['/api/uploads/img/1.jpg'] },
    ];
    const { win } = bootLojaDom(() => state);
    await new Promise((r) => setTimeout(r, 80));

    // Cliente abre a peça (aqui é esperado ir para o topo)
    await win.openProductDetails(901, state[0]);
    await new Promise((r) => setTimeout(r, 30));

    const scrollSpy = vi.fn();
    win.scrollTo = scrollSpy;

    // Sincronização periódica sem mudança nenhuma
    await win.refreshLojaStockData();
    await new Promise((r) => setTimeout(r, 60));
    const toTop = scrollSpy.mock.calls.filter(([arg]) => arg && typeof arg === 'object' && arg.top === 0);
    expect(toTop.length).toBe(0);

    // Mudança só de estoque/preço: atualiza no lugar, sem rolar e sem redesenhar a galeria
    const slideBefore = win.document.querySelector('#gallerySlidesTrack .gallery-slide');
    state = [{ ...state[0], price: 99, stockQty: 2 }];
    await win.refreshLojaStockData();
    await new Promise((r) => setTimeout(r, 60));
    expect(scrollSpy.mock.calls.filter(([arg]) => arg && arg.top === 0).length).toBe(0);
    expect(win.document.querySelector('#gallerySlidesTrack .gallery-slide')).toBe(slideBefore);
    expect(win.document.getElementById('detailPrice')?.textContent).toContain('99');
  });
});

