// Módulo WMS: 01-state-and-api.js
// Fahren Motors - Painel de Gestão WMS

// Estado global de categoria ativa no catálogo e mapa de normalização canônica
let activeCatalogCategory = '';
const LOJA_CATEGORY_MAP = {
  freio: 'Freios',
  freios: 'Freios',
  eletrica: 'Elétrica e ignição',
  'elétrica': 'Elétrica e ignição',
  ignicao: 'Elétrica e ignição',
  'ignição': 'Elétrica e ignição',
  'eletrica e ignicao': 'Elétrica e ignição',
  'elétrica e ignição': 'Elétrica e ignição',
  suspensao: 'Suspensão',
  'suspensão': 'Suspensão',
  sensor: 'Sensores e injeção',
  sensores: 'Sensores e injeção',
  injecao: 'Sensores e injeção',
  'injeção': 'Sensores e injeção',
  'sensores e injeção': 'Sensores e injeção',
  'sensores e injecao': 'Sensores e injeção',
  filtro: 'Filtros',
  filtros: 'Filtros',
  correia: 'Correias',
  correias: 'Correias',
  oleo: 'Óleos e fluidos',
  'óleo': 'Óleos e fluidos',
  oleos: 'Óleos e fluidos',
  'óleos': 'Óleos e fluidos',
  fluido: 'Óleos e fluidos',
  fluidos: 'Óleos e fluidos',
  'fluídos': 'Óleos e fluidos',
  'óleos e fluidos': 'Óleos e fluidos',
  'oleos e fluidos': 'Óleos e fluidos',
  iluminacao: 'Iluminação',
  'iluminação': 'Iluminação',
  lampada: 'Iluminação',
  'lâmpada': 'Iluminação'
};

function normalizeCatalogCategory(cat) {
  if (!cat) return '';
  const key = String(cat).toLowerCase().trim();
  return LOJA_CATEGORY_MAP[key] || cat.trim();
}

// Fahren Motors — loja do cliente
// Agora conectada a uma API real (Node + PostgreSQL) em vez de localStorage.
// Mantém a mesma estrutura visual (telas, cores, cards) do protótipo original.

const screens = [...document.querySelectorAll('.screen')];
const nav = [...document.querySelectorAll('.nav button')];

let authenticated = false;
let currentUser = null;
const CART_STORAGE_KEY = 'fahren_cart_v2';
const CART_LEGACY_KEY = 'fahren_cart';

let cart = []; // [{ productId, name, price, quantity, image, category }]

function loadCartFromStorage() {
  // 1. Verificar sincronização via URL (?cart=... ou ?carrinho=...)
  try {
    const params = new URLSearchParams(window.location.search);
    const sharedParam = params.get('cart') || params.get('carrinho');
    if (sharedParam) {
      let rawJson = '';
      try {
        rawJson = decodeURIComponent(atob(sharedParam));
      } catch (e1) {
        try {
          rawJson = decodeURIComponent(sharedParam);
        } catch (e2) {
          rawJson = sharedParam;
        }
      }
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cart = parsed;
        saveCart();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('cart');
        cleanUrl.searchParams.delete('carrinho');
        window.history.replaceState({}, '', cleanUrl.pathname + (cleanUrl.search || '') + (cleanUrl.hash || ''));
        setTimeout(() => {
          showToast('✨ Carrinho sincronizado do seu computador com sucesso!');
          updateCartBadge();
        }, 500);
        return;
      }
    }
  } catch (err) {
    console.warn('Falha ao processar carrinho compartilhado:', err);
  }

  // 2. Carregar do localStorage persistente com fallback ao sessionStorage
  try {
    const fromLocal = localStorage.getItem(CART_STORAGE_KEY) || localStorage.getItem(CART_LEGACY_KEY);
    if (fromLocal) {
      cart = JSON.parse(fromLocal) || [];
      return;
    }
    const fromSession = sessionStorage.getItem(CART_LEGACY_KEY);
    if (fromSession) {
      cart = JSON.parse(fromSession) || [];
      return;
    }
  } catch (err) {
    cart = [];
  }
}


// ==========================================================================
// SINCRONIZAÇÃO EM NUVEM DO CARRINHO POR VERSÃO MONOTÔNICA (SERVER-AUTHORITATIVE)
// ==========================================================================
let localCartVersion = 0;
try {
  localCartVersion = Number(localStorage.getItem('fahren-cart-version')) || 0;
} catch {}

function setLocalCartVersion(v) {
  localCartVersion = Number(v) || 0;
  try {
    localStorage.setItem('fahren-cart-version', String(localCartVersion));
  } catch {}
}

let isSyncingCart = false;
let isPushingCart = false;
let pushDebounce = null;

function pushCartToServer(immediate = false) {
  if (!currentUser) return;
  isPushingCart = true;
  clearTimeout(pushDebounce);

  const doPush = () => {
    api('/api/auth/cart', {
      method: 'PUT',
      body: JSON.stringify({ cart })
    })
    .then(res => {
      if (res && typeof res.version === 'number') {
        setLocalCartVersion(res.version);
      }
    })
    .catch(err => console.warn('Erro ao salvar carrinho na nuvem:', err))
    .finally(() => {
      setTimeout(() => { isPushingCart = false; }, 800);
    });
  };

  if (immediate) {
    doPush();
  } else {
    pushDebounce = setTimeout(doPush, 150);
  }
}

async function syncCartWithServer() {
  // Se está enviando alterações no momento, não faz polling para evitar race condition
  if (!currentUser || isSyncingCart || isPushingCart) return;
  isSyncingCart = true;
  try {
    const res = await api('/api/auth/cart');
    if (res && Array.isArray(res.cart)) {
      const serverVersion = Number(res.version) || 0;

      // 1. O servidor tem versão estritamente mais recente que este dispositivo
      if (serverVersion > localCartVersion) {
        cart = res.cart;
        setLocalCartVersion(serverVersion);
        saveCart(true); // salva no localStorage sem re-enviar
        updateCartBadge();
        const cartScreen = document.getElementById('carrinho');
        if (cartScreen && cartScreen.classList.contains('active')) {
          renderCart();
        }
      }
      // 2. Primeira conexão do dispositivo com itens do visitante
      else if (localCartVersion === 0 && serverVersion === 0 && cart.length > 0) {
        pushCartToServer(true);
      }
    }
  } catch (err) {
    // Silencioso se offline
  } finally {
    isSyncingCart = false;
  }
}

function saveCart(skipServerSync = false, immediatePush = false) {
  try {
    const serialized = JSON.stringify(cart);
    localStorage.setItem(CART_STORAGE_KEY, serialized);
    localStorage.setItem(CART_LEGACY_KEY, serialized);
    sessionStorage.setItem(CART_LEGACY_KEY, serialized);
  } catch (e) {
    console.warn('Falha ao gravar carrinho no storage:', e);
  }
  updateCartBadge();
  if (!skipServerSync && currentUser) {
    pushCartToServer(immediatePush);
  }
}

loadCartFromStorage();

// ---------- API helper ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) {
    throw new Error((data && data.error) || 'Ocorreu um erro. Tente novamente.');
  }
  return data;
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const headerCount = document.getElementById('cartHeaderCount');
  const totalCount = cart.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  if (badge) {
    badge.textContent = totalCount > 99 ? '99+' : String(totalCount);
    badge.classList.toggle('has-items', totalCount > 0);
    badge.style.display = 'inline-flex';
  }

  if (headerCount) {
    headerCount.textContent = totalCount > 0 ? `(${totalCount} ${totalCount === 1 ? 'peça' : 'peças'})` : '(0 peças)';
  }
}

function showToast(message, onAction) {
  const container = document.getElementById('toastContainer') || document.body;
  const toast = document.createElement('div');
  toast.className = 'fp-toast';
  toast.innerHTML = `
    <span class="fp-toast-msg">${message}</span>
    ${onAction ? '<button type="button" class="fp-toast-btn">VER CARRINHO ›</button>' : ''}
    <button type="button" class="fp-toast-close" aria-label="Fechar">✕</button>
  `;
  if (onAction) {
    toast.querySelector('.fp-toast-btn')?.addEventListener('click', () => {
      toast.remove();
      onAction();
    });
  }
  toast.querySelector('.fp-toast-close')?.addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.transition = 'opacity .3s, transform .3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// saveCart implementado no topo com persistência unificada (localStorage + sessionStorage)
