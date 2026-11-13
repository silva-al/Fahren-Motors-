import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { Window } from 'happy-dom';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const express = require('express');
const db = require('../server/db');
const productsRouter = require('../server/routes/products');

function createProductsApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/products', productsRouter);
  return app;
}

describe('Categorias, Contagem Real e Remoção Automática de Itens Fictícios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/products/categories conta peças reais com URL Supabase/externa e normaliza Ignição -> Elétrica e ignição', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS app_meta')) return { rows: [] };
      if (sql.includes('ALTER TABLE')) return { rows: [] };
      if (sql.includes('SELECT count(*)::int AS count FROM products')) return { rows: [{ count: 2 }] };
      if (sql.includes("SELECT value FROM app_meta WHERE key = 'catalog_seeded'")) return { rows: [{ value: 'true' }] };
      if (sql.includes('FROM products') && sql.includes('WHERE category IS NOT NULL')) {
        return {
          rows: [
            {
              id: 101,
              name: 'Bobina de Ignição Bosch',
              category: 'Ignição',
              photo_url: 'https://xyz.supabase.co/storage/v1/object/public/produtos/bobina.jpg',
              stock_qty: 5,
            },
            {
              id: 102,
              name: 'Velas NGK Teste',
              category: 'Elétrica e ignição',
              photo_url: 'images/produtos/bobina_2.jpg',
              stock_qty: 10,
            },
            {
              id: 103,
              name: 'Kit Embreagem Luk',
              category: 'Embreagem',
              photo_url: 'https://xyz.supabase.co/storage/v1/object/public/produtos/embreagem.jpg',
              stock_qty: 3,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const app = createProductsApp();
    const res = await request(app).get('/api/products/categories');
    expect(res.status).toBe(200);

    const ignicao = res.body.categories.find((c) => c.name === 'Elétrica e ignição');
    expect(ignicao).toBeDefined();
    expect(ignicao.count).toBe(1);
    expect(ignicao.photo).toBe('https://xyz.supabase.co/storage/v1/object/public/produtos/bobina.jpg');
    expect(ignicao.hasRealPhoto).toBe(true);

    const embreagem = res.body.categories.find((c) => c.name === 'Embreagem');
    expect(embreagem).toBeDefined();
    expect(embreagem.count).toBe(1);
  });

  it('GET /api/products oculta peças fictícias (images/produtos/...) quando existem peças reais no WMS', async () => {
    vi.spyOn(db, 'query').mockImplementation(async (sql) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS app_meta')) return { rows: [] };
      if (sql.includes('ALTER TABLE')) return { rows: [] };
      if (sql.includes('SELECT count(*)::int AS count FROM products')) return { rows: [{ count: 2 }] };
      if (sql.includes("SELECT value FROM app_meta WHERE key = 'catalog_seeded'")) return { rows: [{ value: 'true' }] };
      if (sql.includes('SELECT * FROM products WHERE')) {
        return {
          rows: [
            {
              id: 201,
              name: 'Bobina Real WMS',
              code: 'BOB-REAL',
              category: 'Elétrica e ignição',
              description: 'Bobina cadastrada no WMS',
              compatibility: 'Gol G6',
              price_cents: 19900,
              stock_qty: 4,
              photo_url: 'https://xyz.supabase.co/storage/v1/object/public/produtos/bobina-real.jpg',
              location: 'A-01-01',
              active: true,
              item_type: 'peca',
            },
            {
              id: 202,
              name: 'Bobina Teste Fictícia',
              code: 'MM-BI0048',
              category: 'Elétrica e ignição',
              description: 'Item de teste',
              compatibility: 'Gol',
              price_cents: 27950,
              stock_qty: 10,
              photo_url: 'images/produtos/bobina.jpg',
              location: null,
              active: true,
              item_type: 'peca',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const app = createProductsApp();
    const res = await request(app).get('/api/products?category=El%C3%A9trica%20e%20igni%C3%A7%C3%A3o');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(201);
    expect(res.body.products[0].stockQty).toBe(4);
    expect(res.body.products[0].inStock).toBe(true);
  });

  it('Loja Virtual renderiza categorias customizadas dinamicamente e não ressuscita fallback quando API retorna []', async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'loja', 'index.html'), 'utf8');
    const lojaJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'loja', 'loja.js'), 'utf8');

    const win = new Window({ url: 'http://localhost:3000/' });
    win.document.documentElement.innerHTML = html;
    win.scrollTo = () => {};

    win.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/api/products/categories/featured')) {
        return { ok: true, status: 200, json: async () => ({ products: [], categories: [], featured: [] }) };
      }
      if (u.includes('/api/products/categories')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            categories: [
              { name: 'Embreagem', count: 2, photo: 'https://xyz.supabase.co/storage/v1/object/public/produtos/emb.jpg', hasRealPhoto: true },
            ],
            names: ['Embreagem'],
          }),
        };
      }
      if (u.includes('/api/products')) {
        return { ok: true, status: 200, json: async () => ({ products: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    win.eval(lojaJs);
    await new Promise((r) => setTimeout(r, 80));

    await win.loadCategoryCounts();
    const dynamicCard = win.document.querySelector('.cat-grid-item[data-cat="Embreagem"]');
    expect(dynamicCard).not.toBeNull();
    expect(dynamicCard.textContent).toContain('2 produtos disponíveis');

    const menuChip = win.document.querySelector('#headerCatMenu .clean-chip[data-cat="Embreagem"]');
    expect(menuChip).not.toBeNull();

    // Quando API retorna 200 com products: [], catálogo não deve mostrar itens de fallback
    win.eval("activeCatalogCategory = 'Elétrica e ignição';");
    await win.loadCatalog();
    const renderedProducts = win.document.querySelectorAll('#catalogResults .product');
    expect(renderedProducts.length).toBe(0);
  });

  it('WMS possui seletor de categoria com categorias padrão e opção de adicionar nova categoria', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'index.html'), 'utf8');
    const adminJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'admin.js'), 'utf8');

    const win = new Window({ url: 'http://localhost:3000/admin' });
    win.document.documentElement.innerHTML = adminHtml;
    win.scrollTo = () => {};
    win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ products: [], orders: [] }) });

    win.eval(adminJs);

    win.fillCategoryList([]);
    const select = win.document.getElementById('pCategorySelect');
    expect(select).not.toBeNull();
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('Elétrica e ignição');
    expect(options).toContain('Freios');
    expect(options).toContain('__new__');

    // Selecionar "__new__" exibe o campo de texto para digitar nova categoria
    select.value = '__new__';
    select.dispatchEvent(new win.Event('change'));
    const input = win.document.getElementById('pCategory');
    expect(input.classList.contains('hidden')).toBe(false);
  });
});

