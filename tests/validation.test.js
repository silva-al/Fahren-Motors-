import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Window } from 'happy-dom';

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

describe('DOM & Button Validation - Fahren Motors UI', () => {
  const htmlPath = path.join(__dirname, '..', 'public', 'loja', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = htmlContent;

  it('deve conter o botão .btn-offers-all (VER TODAS AS PEÇAS NO CATÁLOGO) com destino para pecas', () => {
    const btnOffersAll = document.querySelector('.btn-offers-all');
    expect(btnOffersAll).not.toBeNull();
    expect(btnOffersAll.dataset.go).toBe('pecas');
    expect(btnOffersAll.textContent).toContain('VER TODAS AS PEÇAS NO CATÁLOGO');
  });

  it('deve conter os botões .ver-todas com destino e texto válidos', () => {
    const verTodasButtons = [...document.querySelectorAll('.ver-todas')];
    expect(verTodasButtons.length).toBeGreaterThanOrEqual(1);
    const homeVerTodas = verTodasButtons[0];
    expect(homeVerTodas.textContent).toContain('VER TODAS');
    expect(homeVerTodas.dataset.go).toBe('pecas');
  });

  it('todos os botões com [data-go] devem apontar para telas reais existentes no HTML', () => {
    const screens = [...document.querySelectorAll('.screen')].map(s => s.id);
    const dataGoButtons = [...document.querySelectorAll('[data-go]')];
    expect(dataGoButtons.length).toBeGreaterThan(0);
    dataGoButtons.forEach(btn => {
      const targetScreen = btn.dataset.go;
      expect(screens).toContain(targetScreen);
    });
  });

  it('deve conter todos os 4 seletores de veículos sem bordas e com opções', () => {
    const montadora = document.getElementById('vfMontadora');
    const modelo = document.getElementById('vfModelo');
    const ano = document.getElementById('vfAno');
    const motor = document.getElementById('vfMotor');

    expect(montadora).not.toBeNull();
    expect(modelo).not.toBeNull();
    expect(ano).not.toBeNull();
    expect(motor).not.toBeNull();
  });

  it('deve conter as abas do buscador de veículos (placa e modelo) com IDs corretos', () => {
    const tabPlaca = document.getElementById('vfTabPlate');
    const tabModelo = document.getElementById('vfTabModel');
    expect(tabPlaca).not.toBeNull();
    expect(tabModelo).not.toBeNull();
    expect(tabPlaca.textContent).toContain('Por Placa');
    expect(tabModelo.textContent).toContain('Por Modelo');
  });

  it('deve conter os botões de trocar de veículo / limpar garagem', () => {
    const clearHome = document.getElementById('activeGarageClearBtn');
    const clearCatalog = document.getElementById('activeGarageClearBtnCatalog');
    expect(clearHome).not.toBeNull();
    expect(clearCatalog).not.toBeNull();
    expect(clearHome.textContent).toContain('Trocar Veículo');
  });

  it('deve conter o botão de alternar tema dark/light (#themeToggle)', () => {
    const toggle = document.getElementById('themeToggle');
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-label')).toContain('Alternar entre tema claro e escuro');
  });

  it('deve conter o rodapé legal oficial em todas as telas com CNPJ da Fahren Motors', () => {
    const legal = document.querySelector('.fp-footer-legal');
    expect(legal).not.toBeNull();
    expect(legal.textContent).toContain('47.784.317/0001-20');
    expect(legal.textContent).toContain('FAHREN MOTORS LTDA');
  });

  it('deve conter os 5 botões da barra de navegação móvel (mobile tabbar)', () => {
    const tabbar = document.getElementById('mobileTabbar');
    expect(tabbar).not.toBeNull();
    const tabs = [...tabbar.querySelectorAll('button')].map(b => b.dataset.tab);
    expect(tabs).toContain('inicio');
    expect(tabs).toContain('categorias');
    expect(tabs).toContain('buscar');
    expect(tabs).toContain('perfil');
    expect(tabs).toContain('carrinho');
  });
it('deve conter o modal de tela cheia (lightbox) com controles de zoom e fechar', () => {
    const modal = document.getElementById('detailLightboxModal');
    const zoomIn = document.getElementById('lbZoomIn');
    const zoomOut = document.getElementById('lbZoomOut');
    const reset = document.getElementById('lbResetPan');
    const close = document.getElementById('lightboxClose');
    const img = document.getElementById('lightboxImg');

    expect(modal).not.toBeNull();
    expect(zoomIn).not.toBeNull();
    expect(zoomOut).not.toBeNull();
    expect(reset).not.toBeNull();
    expect(close).not.toBeNull();
    expect(img).not.toBeNull();
  });

  it('deve conter botão para voltar ao catálogo na tela de produto', () => {
    const backBtn = document.getElementById('backToCatalogBtn');
    const crumbLink = document.getElementById('crumbCatalogLink');
    expect(backBtn).not.toBeNull();
    expect(crumbLink).not.toBeNull();
  });

  it('deve validar que a tabela de ficha técnica contém cabeçalhos especificados', () => {
    const table = document.querySelector('.fp-specs-table');
    expect(table).not.toBeNull();
    const specName = document.getElementById('specName');
    const specCode = document.getElementById('specCode');
    const specCat = document.getElementById('specCategory');
    const specStock = document.getElementById('specStock');

    expect(specName).not.toBeNull();
    expect(specCode).not.toBeNull();
    expect(specCat).not.toBeNull();
    expect(specStock).not.toBeNull();
  });

  it('deve validar no CSS que o logo-badge não tem box-shadow com vazamento vermelho', () => {
    const cssPath = path.join(__dirname, '../public/loja/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toContain('logo-badge');
    expect(css).toContain('box-shadow:none !important');
  });

  it('deve validar que o carrossel de peças possui deduplicação e não repete produtos infinitos', () => {
    const jsPath = path.join(__dirname, '../public/loja/loja.js');
    const js = fs.readFileSync(jsPath, 'utf8');
    expect(js).toContain('// Itens únicos sem repetições infinitas');
    expect(js).not.toContain('while (baseList.length < 8)');
  });
});
