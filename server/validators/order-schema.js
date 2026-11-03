const { z } = require('zod');

const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.coerce.number().int().positive('ID de produto inválido.'),
      quantity: z.coerce.number().int().positive('A quantidade deve ser maior que zero.')
    })
  ).min(1, 'O carrinho está vazio.'),
  paymentMethod: z.enum(['pix', 'cartao', 'retirada']).default('retirada')
});

module.exports = {
  createOrderSchema
};
