// Sincronização automática do catálogo no banco de dados.
// Garante que o banco de dados tenha as colunas
// necessárias e todas as peças oficiais cadastradas.

const db = require('./db');
const { INITIAL_PRODUCTS } = require('./catalog-data');

let syncInProgress = false;
let syncCompleted = false;

async function syncCatalog(force = false) {
  if (syncCompleted && !force) return;
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    // 1. Garante colunas no banco se ainda não existirem
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS compatibility TEXT;`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT;`);
    await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;`);
    await db.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;`);

    // Garante tabela de metadados para registrar se a carga inicial já ocorreu
    await db.query(`CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT);`);

    // 2. Verifica se o banco de dados já possui qualquer peça cadastrada ou se já foi inicializado
    const countRes = await db.query(`SELECT count(*)::int AS count FROM products;`);
    const totalCount = (countRes.rows[0] && countRes.rows[0].count) || 0;
    const metaRes = await db.query(`SELECT value FROM app_meta WHERE key = 'catalog_seeded';`);
    const alreadySeeded = metaRes.rows[0]?.value === 'true';

    // Só realiza a inserção inicial uma única vez quando o banco estiver 100% vazio e nunca inicializado,
    // garantindo que peças de teste excluídas pelo usuário NUNCA voltem sozinhas.
    if ((totalCount === 0 && !alreadySeeded) || force) {
      console.log(`[SyncCatalog] Sincronizando catálogo oficial (${INITIAL_PRODUCTS.length} peças)...`);
      for (const p of INITIAL_PRODUCTS) {
        await db.query(
          `INSERT INTO products (name, code, category, description, compatibility, price_cents, stock_qty, photo_url, location, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
           ON CONFLICT (code) DO NOTHING;`,
          [p.name, p.code, p.category, p.description, p.compatibility || '', p.price_cents, p.stock_qty, p.photo_url, p.location || null]
        );
      }
      await db.query(
        `INSERT INTO app_meta (key, value) VALUES ('catalog_seeded', 'true')
         ON CONFLICT (key) DO UPDATE SET value = 'true';`
      );
      console.log(`[SyncCatalog] Catálogo sincronizado com sucesso.`);
    } else if (totalCount > 0 && !alreadySeeded) {
      await db.query(
        `INSERT INTO app_meta (key, value) VALUES ('catalog_seeded', 'true')
         ON CONFLICT (key) DO NOTHING;`
      );
    }

    // Migração única: move itens de Fluido de Freio para a categoria 'Óleos e fluidos'
    const migFluido = await db.query(`SELECT value FROM app_meta WHERE key = 'migrated_fluido_category_v1';`);
    if (migFluido.rows[0]?.value !== 'true') {
      await db.query(
        `UPDATE products SET category = 'Óleos e fluidos'
         WHERE LOWER(TRIM(COALESCE(category, ''))) = 'freios'
           AND name ILIKE '%fluido%';`
      );
      await db.query(
        `INSERT INTO app_meta (key, value) VALUES ('migrated_fluido_category_v1', 'true')
         ON CONFLICT (key) DO UPDATE SET value = 'true';`
      );
    }
    syncCompleted = true;
  } catch (err) {
    console.error('[SyncCatalog] Erro ao sincronizar catálogo:', err.message);
  } finally {
    syncInProgress = false;
  }
}

module.exports = { syncCatalog };
