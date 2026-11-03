import { describe, it, expect } from 'vitest';
const request = require('supertest');
const app = require('../server/app');

describe('Segurança de Cabeçalhos e Rotas da API', () => {
  it('deve incluir cabeçalhos de proteção (nosniff, DENY, Referrer-Policy)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('deve bloquear criação de pedidos sem token de autenticação (401)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: 1, quantity: 1 }],
        paymentMethod: 'pix'
      });
    expect(res.status).toBe(401);
  });

  it('deve retornar 400 com mensagem clara ao tentar cadastro com dados inválidos', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'A',
        email: 'invalido',
        password: '12'
      });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('deve bloquear acesso a listagem de pedidos admin sem permissão (401/403)', async () => {
    const res = await request(app).get('/api/orders');
    expect([401, 403]).toContain(res.status);
  });

  it('deve bloquear alteração de status de pedido sem token de admin (401/403)', async () => {
    const res = await request(app).put('/api/orders/1/status').send({ status: 'pronto' });
    expect([401, 403]).toContain(res.status);
  });

  it('deve bloquear operações de estoque/armazém sem token de admin (401/403)', async () => {
    const res = await request(app).post('/api/stock/operations').send({
      productId: 1,
      type: 'entrada',
      quantity: 5
    });
    expect([401, 403]).toContain(res.status);
  });

});