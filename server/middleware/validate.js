// Middleware de validação declarativa com Zod
// Valida dados de entrada antes de chegar nas rotas, protegendo contra inputs malformados

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || 'Dados de requisição inválidos.',
        details: result.error.format()
      });
    }
    req.validatedBody = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || 'Parâmetros de busca inválidos.'
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery
};
