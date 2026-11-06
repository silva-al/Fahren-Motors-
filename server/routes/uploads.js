// Upload de imagens para produtos (restrito a admin).
//
// Destinos possíveis:
// 1. Supabase Storage — quando SUPABASE_URL e SUPABASE_SERVICE_KEY estão definidos.
// 2. Disco local (public/uploads/products) — fallback local quando Supabase não estiver configurado.
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Aceita também os nomes criados pela integração oficial Vercel + Supabase
// (SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL) e remove espaços/aspas
// que costumam vir junto ao colar o valor no painel.
function lerEnv(...nomes) {
  for (const nome of nomes) {
    const v = (process.env[nome] || '').trim().replace(/^["']|["']$/g, '');
    if (v) return v;
  }
  return '';
}

// Se a URL do projeto não foi informada, tenta descobrir pelo DATABASE_URL do Supabase
// (formatos db.<ref>.supabase.co ou postgres.<ref>@...pooler.supabase.com).
function urlPeloDatabaseUrl() {
  const db = process.env.DATABASE_URL || '';
  const m = db.match(/db\.([a-z0-9]{15,})\.supabase\.co/i) || db.match(/postgres\.([a-z0-9]{15,})[:@]/i);
  return m ? `https://${m[1]}.supabase.co` : '';
}

const SUPABASE_URL = (
  lerEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_PROJECT_URL') || urlPeloDatabaseUrl()
).replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = lerEnv(
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY'
);
const SUPABASE_BUCKET = lerEnv('SUPABASE_BUCKET') || 'produtos';
const usarSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// Diagnóstico sem expor segredos: diz só o que foi encontrado.
function statusStorage() {
  return {
    storage: usarSupabase ? 'supabase' : 'disco-local',
    supabaseUrl: Boolean(SUPABASE_URL),
    supabaseServiceKey: Boolean(SUPABASE_SERVICE_KEY),
    bucket: SUPABASE_BUCKET,
  };
}

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

function nomeDeArquivo(originalname) {
  const ext = path.extname(originalname || '').toLowerCase() || '.jpg';
  const base = path
    .basename(originalname || '', ext)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 20);
  const sufixo = Date.now() + '-' + Math.round(Math.random() * 1e6);
  return `peca-${base ? base + '-' : ''}${sufixo}${ext}`;
}

const fileFilter = (_req, file, cb) => {
  if (TIPOS_PERMITIDOS.includes((file.mimetype || '').toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagem inválido. Use JPG, PNG ou WEBP.'));
  }
};

// O arquivo sempre passa pela memória. Só depois decidimos onde gravar — assim
// o multer nunca precisa de uma pasta existindo no carregamento do módulo.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: TAMANHO_MAXIMO },
});

async function enviarParaSupabase(file) {
  const nome = nomeDeArquivo(file.originalname);
  const destino = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${nome}`;

  const resposta = await fetch(destino, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': file.mimetype,
      'x-upsert': 'true',
    },
    body: file.buffer,
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(
      `Falha ao enviar a imagem para o Supabase Storage (${resposta.status}). ` +
        `Confira se o bucket "${SUPABASE_BUCKET}" existe e está público. ${detalhe}`.trim()
    );
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${nome}`;
}

// Sem Supabase, as fotos ficam guardadas no próprio banco Postgres (Neon) que o
// sistema já usa — funciona na Vercel sem nenhuma configuração extra.
let tabelaPronta = null;
function garantirTabela() {
  if (!tabelaPronta) {
    tabelaPronta = db
      .query(
        `CREATE TABLE IF NOT EXISTS product_images (
           id         SERIAL PRIMARY KEY,
           mime       TEXT NOT NULL,
           data       BYTEA NOT NULL,
           created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`
      )
      .catch((erro) => {
        tabelaPronta = null; // tenta de novo na próxima vez
        throw erro;
      });
  }
  return tabelaPronta;
}

async function gravarNoBanco(file) {
  await garantirTabela();
  const ext = (path.extname(file.originalname || '').toLowerCase() || '.jpg').replace(/[^.a-z0-9]/g, '');
  const { rows } = await db.query(
    'INSERT INTO product_images (mime, data) VALUES ($1, $2) RETURNING id',
    [file.mimetype, file.buffer]
  );
  return `/api/uploads/img/${rows[0].id}${ext}`;
}

function gravarNoDisco(file) {
  const pasta = path.join(__dirname, '..', '..', 'public', 'uploads', 'products');
  const nome = nomeDeArquivo(file.originalname);
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, nome), file.buffer);
  return `/uploads/products/${nome}`;
}

const isCloudRuntime = Boolean(
  process.env.VERCEL ||
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.RENDER
);

// Ordem: Supabase (se configurado) → banco de dados em ambiente cloud/serverless → disco local (com banco como reserva).
async function salvarImagem(file) {
  if (usarSupabase) return { url: await enviarParaSupabase(file), storage: 'supabase' };
  if (isCloudRuntime) return { url: await gravarNoBanco(file), storage: 'banco' };
  try {
    return { url: gravarNoDisco(file), storage: 'disco-local' };
  } catch (_erro) {
    return { url: await gravarNoBanco(file), storage: 'banco' };
  }
}

router.get('/status', (_req, res) =>
  res.json({ ...statusStorage(), storage: usarSupabase ? 'supabase' : isCloudRuntime ? 'banco' : 'disco-local' })
);

// Entrega a foto guardada no banco. Público (a loja precisa exibir) e com cache longo,
// já que cada foto tem um id único e nunca muda.
router.get('/img/:arquivo', async (req, res) => {
  const id = parseInt(req.params.arquivo, 10);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).end();
  try {
    await garantirTabela();
    const { rows } = await db.query('SELECT mime, data FROM product_images WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(rows[0].data);
  } catch (erro) {
    console.error('[Uploads] erro ao ler imagem', erro.message);
    return res.status(500).end();
  }
});

router.post('/', requireRole('admin'), (req, res) => {
  upload.any()(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Cada imagem deve ter no máximo 5MB.' });
      }
      return res.status(400).json({ error: `Erro no upload: ${err.message}` });
    }
    if (err) return res.status(400).json({ error: err.message });

    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    try {
      const results = [];
      for (const file of files) {
        const { url, storage } = await salvarImagem(file);
        results.push({
          url,
          filename: path.basename(url),
          originalName: file.originalname,
          size: file.size,
          storage,
        });
      }

      const urls = results.map((r) => r.url);
      return res.json({
        ok: true,
        url: urls[0],
        urls,
        files: results,
        count: results.length,
        filename: results[0]?.filename,
        storage: results[0]?.storage,
      });
    } catch (erro) {
      console.error('[Uploads]', erro.message);
      return res.status(502).json({ error: 'Não foi possível salvar a imagem: ' + erro.message });
    }
  });
});

module.exports = router;
