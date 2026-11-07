// Funções auxiliares de autenticação: geração/verificação de token (JWT em cookie httpOnly)
// e middlewares que protegem rotas de cliente e de admin.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'fp_token';
const ADMIN_COOKIE_NAME = 'fp_admin_token';

const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL) || Boolean(process.env.NETLIFY);
const rawSecret = (process.env.JWT_SECRET || '').trim();

let SECRET;
if (rawSecret && rawSecret.length >= 32) {
  SECRET = rawSecret;
} else if (isProduction) {
  console.error('[Segurança Crítica] ERRO FATAL: JWT_SECRET ausente ou com menos de 32 caracteres em ambiente de produção.');
  console.error('[Segurança Crítica] Defina uma chave segura de 32+ caracteres em suas variáveis de ambiente.');
  process.exit(1);
} else {
  // Em ambiente local de desenvolvimento ou teste: gera uma chave criptográfica forte efêmera em memória.
  // NUNCA usa segredos hardcoded públicos do Git.
  if (!global.__FP_DEV_JWT_SECRET__) {
    global.__FP_DEV_JWT_SECRET__ = crypto.randomBytes(32).toString('hex');
    if (!rawSecret) {
      console.warn('[Segurança Dev] AVISO: JWT_SECRET não informado no .env. Gerada chave efêmera de 256 bits para desenvolvimento/testes.');
    }
  }
  SECRET = global.__FP_DEV_JWT_SECRET__;
}

// Mesmas opções usadas para criar o cookie — o navegador só apaga um cookie
// quando os atributos batem, então logout e login precisam combinar.
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

function signToken(payload) {
  // payload: { sub: id, role: 'customer' | 'admin', name, email }
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, payload) {
  const token = signToken(payload);
  const cookieName = payload.role === 'admin' ? ADMIN_COOKIE_NAME : COOKIE_NAME;
  res.cookie(cookieName, token, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  if (payload.role === 'admin') {
    res.cookie(COOKIE_NAME, token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.clearCookie(ADMIN_COOKIE_NAME, COOKIE_OPTIONS);
}

function readToken(req) {
  const token = req.cookies && (req.cookies[ADMIN_COOKIE_NAME] || req.cookies[COOKIE_NAME]);
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireRole(role) {
  return (req, res, next) => {
    let token = null;
    if (role === 'admin') {
      token = req.cookies && (req.cookies[ADMIN_COOKIE_NAME] || req.cookies[COOKIE_NAME]);
    } else {
      token = req.cookies && (req.cookies[COOKIE_NAME] || req.cookies[ADMIN_COOKIE_NAME]);
    }
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    try {
      const decoded = jwt.verify(token, SECRET);
      if (!decoded || (decoded.role !== role && decoded.role !== 'admin')) {
        return res.status(401).json({ error: 'Não autenticado.' });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
  };
}

function attachUser(req, _res, next) {
  req.user = readToken(req);
  next();
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, readToken, requireRole, attachUser, ADMIN_COOKIE_NAME, COOKIE_NAME };
