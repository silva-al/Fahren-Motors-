const { z } = require('zod');

const registerSchema = z.object({
  name: z.string({ required_error: 'Preencha o nome completo.' })
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(100, 'O nome é muito longo.'),
  email: z.string({ required_error: 'Digite um e-mail válido.' })
    .trim()
    .email('Digite um e-mail válido.')
    .toLowerCase(),
  phone: z.string({ required_error: 'Preencha o telefone de contato.' })
    .trim()
    .min(8, 'Telefone inválido.')
    .max(20, 'Telefone muito longo.'),
  password: z.string({ required_error: 'A senha deve ter pelo menos 6 caracteres.' })
    .min(6, 'A senha deve ter pelo menos 6 caracteres.')
    .max(100, 'Senha muito longa.'),
  cpfCnpj: z.string().trim().optional().nullable()
});

const loginSchema = z.object({
  email: z.string({ required_error: 'E-mail ou senha incorretos.' })
    .trim()
    .email('E-mail ou senha incorretos.')
    .toLowerCase(),
  password: z.string({ required_error: 'E-mail ou senha incorretos.' })
    .min(1, 'E-mail ou senha incorretos.')
});

module.exports = {
  registerSchema,
  loginSchema
};
