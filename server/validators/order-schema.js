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

const updateOrderStatusSchema = z.object({
  status: z.enum(['novo', 'em_preparacao', 'pronto', 'entregue', 'cancelado'], {
    errorMap: () => ({ message: 'Status inválido. Use: novo, em_preparacao, pronto, entregue ou cancelado.' })
  })
});

const manualOrderSchema = z.object({
  customerName: z.string({ required_error: 'Nome do cliente é obrigatório.' })
    .trim()
    .min(1, 'Nome do cliente é obrigatório.')
    .max(100, 'Nome muito longo.'),
  customerPhone: z.string().trim().max(25, 'Telefone muito longo.').optional().default(''),
  paymentMethod: z.enum(['pix', 'cartao', 'retirada', 'dinheiro', 'boleto']).default('retirada'),
  status: z.enum(['novo', 'em_preparacao', 'pronto', 'entregue', 'cancelado']).default('novo'),
  items: z.array(
    z.object({
      productId: z.coerce.number().int().positive('ID de produto inválido.'),
      quantity: z.coerce.number().int().positive('A quantidade deve ser maior que zero.'),
      unitPrice: z.coerce.number().nonnegative('Preço unitário não pode ser negativo.').optional()
    })
  ).min(1, 'Adicione pelo menos um item ao pedido.')
});

module.exports = {
  createOrderSchema,
  updateOrderStatusSchema,
  manualOrderSchema
};
