// Validador e Blindagem de Variáveis de Ambiente em Produção (Fahren Motors)
// Impede o servidor de iniciar com configurações inseguras ou variáveis ausentes.

function validateEnv(env = process.env) {
  const isProduction = env.NODE_ENV === 'production' || Boolean(env.VERCEL) || Boolean(env.NETLIFY);
  const isTest = env.NODE_ENV === 'test';
  const errors = [];
  const warnings = [];

  // Em modo de testes automatizados com mocks de DB, não bloqueia
  if (isTest) {
    return { isValid: true, errors: [], warnings: [], isProduction: false };
  }

  // 1. Verificação do DATABASE_URL
  const dbUrl = (env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    errors.push('DATABASE_URL não configurada.');
  } else if (dbUrl.includes('usuario:senha@host:5432/postgres')) {
    errors.push('DATABASE_URL está usando a URL de exemplo (.env.example). Configure sua URL real do PostgreSQL (Supabase/Neon).');
  }

  // 2. Verificação do JWT_SECRET
  const jwtSecret = (env.JWT_SECRET || '').trim();
  if (!jwtSecret) {
    if (isProduction) {
      errors.push('JWT_SECRET não configurado. Em produção é obrigatório fornecer uma chave com no mínimo 32 caracteres.');
    } else {
      warnings.push('JWT_SECRET não configurado localmente. Uma chave efêmera de 256 bits está sendo usada em memória.');
    }
  } else if (jwtSecret.length < 32) {
    if (isProduction) {
      errors.push(`JWT_SECRET possui apenas ${jwtSecret.length} caracteres (mínimo exigido: 32 caracteres para blindagem criptográfica).`);
    } else {
      warnings.push(`JWT_SECRET curto (${jwtSecret.length} caracteres). Recomenda-se gerar uma chave de 32+ caracteres.`);
    }
  }

  // 3. Verificação do CORS_ORIGINS
  const corsOrigins = (env.CORS_ORIGINS || '').trim();
  if (corsOrigins && corsOrigins.includes('*') && isProduction) {
    errors.push('CORS_ORIGINS não pode ser wildcard "*" em produção quando cookies httpOnly com credenciais são permitidos.');
  }

  // 4. Diagnóstico de Storage em Produção
  const isNetlifyOrVercel = Boolean(env.VERCEL) || Boolean(env.NETLIFY);
  if (isNetlifyOrVercel && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY)) {
    warnings.push('SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados em ambiente serverless. Uploads locais não persistem em disco efêmero.');
  }

  // 5. Diagnóstico de Redis
  if (env.REDIS_URL) {
    // Redis configurado
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    isProduction,
  };
}

function enforceEnvGuard(env = process.env) {
  const result = validateEnv(env);

  if (result.warnings.length > 0) {
    result.warnings.forEach((w) => console.warn(`[Config Guard:Aviso] ${w}`));
  }

  if (!result.isValid) {
    console.error('====================================================================');
    console.error(' [FALHA DE INICIALIZAÇÃO: SEGURANÇA E AMBIENTE]');
    console.error(' O servidor não pôde iniciar devido às seguintes pendências críticas:');
    result.errors.forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    console.error('====================================================================');

    if (result.isProduction) {
      process.exit(1);
    }
  }

  return result;
}

module.exports = {
  validateEnv,
  enforceEnvGuard,
};
