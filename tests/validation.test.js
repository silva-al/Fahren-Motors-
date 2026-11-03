import { describe, it, expect } from 'vitest';
const { registerSchema, loginSchema } = require('../server/validators/auth-schema');
const { createOrderSchema } = require('../server/validators/order-schema');

describe('Zod Schemas - Auth Validation', () => {
  it('deve aceitar um cadastro válido de cliente', () => {
    const validData = {
      name: 'Everton Santos',
      email: 'everton@fahrenmotors.com.br',
      phone: '11999998888',
      password: 'senhaSegura123',
      cpfCnpj: '123.456.789-00'
    };
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('everton@fahrenmotors.com.br');
    }
  });

  it('deve rejeitar e-mail inválido no cadastro', () => {
    const invalidEmail = {
      name: 'Everton',
      email: 'email_invalido_sem_arroba',
      phone: '11999998888',
      password: 'senhaSegura123'
    };
    const result = registerSchema.safeParse(invalidEmail);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('e-mail válido');
    }
  });

  it('deve rejeitar senha com menos de 6 caracteres', () => {
    const shortPassword = {
      name: 'Everton',
      email: 'everton@teste.com',
      phone: '11999998888',
      password: '123'
    };
    const result = registerSchema.safeParse(shortPassword);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('6 caracteres');
    }
  });

  it('deve validar login com sucesso', () => {
    const loginData = {
      email: 'CLIENTE@teste.com',
      password: 'minhasenha'
    };
    const result = loginSchema.safeParse(loginData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('cliente@teste.com');
    }
  });
});

describe('Zod Schemas - Order Validation', () => {
  it('deve aceitar criação de pedido válida com itens e forma de pagamento', () => {
    const validOrder = {
      items: [
        { productId: 1, quantity: 2 },
        { productId: 5, quantity: 1 }
      ],
      paymentMethod: 'pix'
    };
    const result = createOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar carrinho vazio', () => {
    const emptyCart = {
      items: [],
      paymentMethod: 'pix'
    };
    const result = createOrderSchema.safeParse(emptyCart);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('carrinho está vazio');
    }
  });

  it('deve rejeitar item com quantidade zero ou negativa', () => {
    const invalidQty = {
      items: [{ productId: 1, quantity: 0 }]
    };
    const result = createOrderSchema.safeParse(invalidQty);
    expect(result.success).toBe(false);
  });
});
