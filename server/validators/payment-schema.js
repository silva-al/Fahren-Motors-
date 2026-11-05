const { z } = require('zod');

const cardPaymentSchema = z.object({
  orderId: z.coerce.number().int().positive('ID de pedido inválido.'),
  token: z.string().optional().nullable(),
  cardToken: z.string().optional().nullable(),
  payment_method_id: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  issuer_id: z.union([z.string(), z.number()]).optional().nullable(),
  issuerId: z.union([z.string(), z.number()]).optional().nullable(),
  installments: z.coerce.number().int().min(1).max(24).default(1),
  cardBrand: z.string().optional().nullable(),
  lastFour: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  payer: z.object({
    email: z.string().email().optional().nullable(),
    identification: z.object({
      type: z.string().optional().nullable(),
      number: z.string().optional().nullable(),
    }).optional().nullable(),
  }).optional().nullable(),
  cardNumber: z.string().optional().nullable(),
});

module.exports = {
  cardPaymentSchema,
};

