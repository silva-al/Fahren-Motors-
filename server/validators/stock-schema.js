const { z } = require('zod');

const stockOperationSchema = z.object({
  productId: z.coerce.number().int().positive('ID da peça inválido.'),
  type: z.enum(['entrada', 'saida', 'transferencia', 'ajuste', 'inventario'], {
    errorMap: () => ({ message: 'Tipo de operação inválido. Use entrada, saida, transferencia ou ajuste.' })
  }),
  quantity: z.coerce.number().int().positive('A quantidade deve ser maior que zero.').optional(),
  fromLocation: z.string().trim().max(60, 'Endereço de origem muito longo.').optional().nullable(),
  toLocation: z.string().trim().max(60, 'Endereço de destino muito longo.').optional().nullable(),
  reference: z.string().trim().max(100, 'Referência muito longa.').optional().nullable(),
  notes: z.string().trim().max(255, 'Observações muito longas.').optional().nullable(),
  newStockVal: z.coerce.number().int().nonnegative('Estoque não pode ser negativo.').optional()
});

const inventoryCountSchema = z.object({
  productId: z.coerce.number().int().positive('ID da peça inválido.'),
  countedStock: z.coerce.number().int().nonnegative('Quantidade contada não pode ser negativa.'),
  auditorName: z.string().trim().max(100).optional()
});

const inventoryReconcileSchema = z.object({
  productId: z.coerce.number().int().positive('ID da peça inválido.'),
  countedStock: z.coerce.number().int().nonnegative('Quantidade não pode ser negativa.').optional(),
  inventoryId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable()
});

module.exports = {
  stockOperationSchema,
  inventoryCountSchema,
  inventoryReconcileSchema
};
