/**
 * Loja Virtual do Cliente — Bundle Oficial Compilado
 * Gerado automaticamente a partir dos módulos desacoplados em src/
 * Total de módulos compilados: 8
 * Não edite este arquivo diretamente — faça alterações nos módulos em src/ e rode 'npm run bundle'
 */


/* =========================================================================
 * [MÓDULO: 01-state-and-api.js]
 * ========================================================================= */
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
          const keepY = window.scrollY;
          renderCart();
          if (Math.abs(window.scrollY - keepY) > 2) window.scrollTo({ top: keepY, behavior: 'auto' });
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

/* =========================================================================
 * [MÓDULO: 02-navigation-and-masks.js]
 * ========================================================================= */
// Módulo WMS: 02-navigation-and-masks.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Navegação ----------
function updateNav() {
  document.body.classList.toggle('logged-in', authenticated);
  nav.forEach(b => {
    const id = b.dataset.screen;
    let visible = true;
    if (!authenticated && id === 'perfil') visible = false;
    if (authenticated && id === 'cadastro') visible = false;
    b.style.display = visible ? '' : 'none';
  });
}

// ---------- Botão Voltar + histórico do navegador ----------
// O botão Voltar aparece apenas quando o usuário NÃO está na página inicial (inicio ou welcome).
const backBtn = document.getElementById('backBtn');
let navDepth = 0;
let currentScreenId = 'inicio';

function updateBackBtn(screenId = currentScreenId) {
  if (!backBtn) return;
  const isHome = (!screenId || screenId === 'inicio' || screenId === 'welcome');
  backBtn.classList.toggle('show', !isHome);
}

if (!(window.history.state && typeof window.history.state.depth === 'number')) {
  window.history.replaceState({ screen: 'inicio', depth: 0 }, '');
}
navDepth = window.history.state.depth || 0;

window.addEventListener('popstate', e => {
  // 1. Se o Relatório do Item do Carrinho estiver aberto, fecha no botão voltar do celular e fica na sacolinha
  const cartReportModal = document.getElementById('fpCartReportModal');
  if (cartReportModal) {
    cartReportModal.remove();
    return;
  }
  // Se o lightbox em tela cheia estiver aberto, fecha-o no botão voltar do celular sem sair da peça
  const lbModal = document.getElementById('detailLightboxModal');
  if (lbModal && (lbModal.style.display === 'flex' || lbModal.style.display === 'block')) {
    if (typeof window.closeLightbox === 'function') window.closeLightbox(true);
    else {
      lbModal.style.display = 'none';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    // Permanece no produto atual, nunca vai para o início
    return;
  }

  const st = e.state || { screen: 'inicio', depth: 0 };
  navDepth = st.depth || 0;

  // Se o estado for do lightbox recém fechado, apenas ignore para manter a tela do produto
  if (st.modal === 'lightbox') {
    if (typeof window.closeLightbox === 'function') window.closeLightbox(true);
    return;
  }

  if (st.screen === 'produto' && st.productId) {
    if (st.category) {
      activeCatalogCategory = st.category;
      try {
        sessionStorage.setItem('fahren-last-category', activeCatalogCategory);
        localStorage.setItem('fahren-last-category', activeCatalogCategory);
      } catch {}
    }
    openProductDetails(st.productId, null, false);
  } else if (st.screen === 'pecas') {
    // Se o cliente JÁ está na tela de peças/categoria (ex: Imagem 2 - Freios) e aperta o botão Voltar do celular,
    // nunca deve cair no catálogo geral sem filtro (Imagem 3): deve voltar direto para a tela Inicial!
    if (currentScreenId === 'pecas') {
      show('inicio', { push: false });
      return;
    }
    const restoredCat = (typeof st.category === 'string' && st.category)
      ? st.category
      : (activeCatalogCategory || (typeof currentProduct !== 'undefined' && currentProduct && currentProduct.category ? normalizeCatalogCategory(currentProduct.category) : ''));
    activeCatalogCategory = restoredCat;
    try {
      sessionStorage.setItem('fahren-last-category', activeCatalogCategory);
      localStorage.setItem('fahren-last-category', activeCatalogCategory);
    } catch {}
    show('pecas', { push: false, keepFilter: true });
  } else {
    show(st.screen || 'inicio', { push: false });
  }
});

backBtn?.addEventListener('click', () => {
  const lbModal = document.getElementById('detailLightboxModal');
  if (lbModal && (lbModal.style.display === 'flex' || lbModal.style.display === 'block')) {
    if (typeof window.closeLightbox === 'function') window.closeLightbox(false);
    return;
  }
  if (currentScreenId === 'pecas') {
    // Ao clicar em Voltar estando em uma categoria ou no catálogo, volta direto para o Início
    show('inicio');
  } else if (currentScreenId === 'produto') {
    // Ao clicar em Voltar estando nos detalhes da peça, volta para a categoria de onde veio (nunca perde o filtro)
    if (!activeCatalogCategory && typeof currentProduct !== 'undefined' && currentProduct && currentProduct.category) {
      activeCatalogCategory = normalizeCatalogCategory(currentProduct.category);
    }
    if (activeCatalogCategory) {
      show('pecas', { keepFilter: true });
    } else if (navDepth > 0) {
      window.history.back();
    } else {
      show('pecas');
    }
  } else if (navDepth > 0) {
    window.history.back();
  } else {
    show('inicio');
  }
});

// Tecla ESC para voltar de telas, fechar zoom ou cancelar
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const lbModal = document.getElementById('detailLightboxModal');
    if (lbModal && (lbModal.style.display === 'flex' || lbModal.style.display === 'block')) {
      if (typeof window.closeLightbox === 'function') window.closeLightbox(false);
      else {
        lbModal.style.display = 'none';
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
      return;
    }
    const zoomModal = document.getElementById('zoomModal');
    if (zoomModal && !zoomModal.classList.contains('hidden')) {
      zoomModal.classList.add('hidden');
      return;
    }
    if (currentScreenId && currentScreenId !== 'inicio' && currentScreenId !== 'welcome') {
      if (navDepth > 0) {
        window.history.back();
      } else if (currentScreenId === 'produto') {
        show('pecas');
      } else {
        show('inicio');
      }
    }
  }
});

function show(id, opts = {}) {
  const { push = true } = opts;
  // Na tela inicial ('inicio'), exibe os cards informativos da loja + o rodapé legal.
  // Em outras telas, os cards informativos ficam ocultos e o rodapé legal permanece visível.
  if (id === 'inicio') {
    document.body.classList.add('screen-is-inicio');
    // Limpeza automática de qualquer termo de busca ou filtro ao voltar para o Início
    ['catalogSearch', 'homeSearchInput', 'headerSearchInput', 'headerSearchInputMobile'].forEach(inputId => {
      const el = document.getElementById(inputId);
      if (el) el.value = '';
    });
    activeCatalogCategory = '';
    try {
      sessionStorage.removeItem('fahren-last-category');
      localStorage.removeItem('fahren-last-category');
    } catch {}
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = '';
  } else {
    document.body.classList.remove('screen-is-inicio');
    if (id !== 'pecas') {
      ['catalogSearch', 'homeSearchInput', 'headerSearchInput', 'headerSearchInputMobile'].forEach(inputId => {
        const el = document.getElementById(inputId);
        if (el) el.value = '';
      });
    }
  }
  if (!authenticated && !['welcome', 'inicio', 'pecas', 'cadastro', 'carrinho', 'produto'].includes(id)) {
    alert('Faça seu cadastro ou entre na sua conta para acessar esta área.');
    show('inicio');
    return;
  }
  const previousScreenId = currentScreenId;
  currentScreenId = id;
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  nav.forEach(b => b.classList.toggle('active', b.dataset.screen === id));
  // Só volta ao topo quando o cliente REALMENTE troca de tela (ou quando pedido explicitamente).
  // Atualizações em segundo plano (estoque, carrinho) jamais podem mexer na rolagem.
  if (opts.scrollTop === true || (opts.scrollTop !== false && previousScreenId !== id)) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  if (id === 'pecas') {
    if (!opts.keepFilter) {
      activeCatalogCategory = '';
      try {
        sessionStorage.removeItem('fahren-last-category');
        localStorage.removeItem('fahren-last-category');
      } catch {}
      const catInput = document.getElementById('catalogSearch');
      if (catInput) catInput.value = '';
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) catSelect.value = '';
    } else {
      try {
        sessionStorage.setItem('fahren-last-category', activeCatalogCategory || '');
        localStorage.setItem('fahren-last-category', activeCatalogCategory || '');
      } catch {}
    }
    loadCatalog();
  }
  if (id === 'carrinho') renderCart();
  if (id === 'perfil') loadMyOrders();

  try {
    sessionStorage.setItem('fahren-last-screen', id);
  } catch {}

  const statePayload = {
    screen: id,
    depth: navDepth,
    category: id === 'pecas' ? (activeCatalogCategory || '') : undefined
  };

  const targetHash = id === 'inicio'
    ? ''
    : (id === 'pecas' && activeCatalogCategory
      ? '#pecas/' + encodeURIComponent(activeCatalogCategory)
      : '#' + id);

  if (push) {
    const curState = window.history.state || {};
    const isSameScreenAndCat = (curState.screen === id) && ((curState.category || '') === (statePayload.category || ''));
    if (isSameScreenAndCat && id !== 'produto') {
      try {
        window.history.replaceState({ ...statePayload, depth: navDepth }, '', targetHash || window.location.pathname);
      } catch {}
    } else {
      const depth = (typeof curState.depth === 'number') ? curState.depth + 1 : 1;
      window.history.pushState({ ...statePayload, depth }, '', targetHash || window.location.pathname);
      navDepth = depth;
    }
  } else {
    try {
      window.history.replaceState({ ...statePayload, depth: navDepth }, '', targetHash || window.location.pathname);
    } catch {}
  }
  updateBackBtn(id);
}

nav.forEach(b => {
  b.onclick = () => show(b.dataset.screen);
});

// Listener global de clique e toque com suporte a mobile para todos os botões de catálogo, ofertas e seções
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-go], .ver-todas, .btn-offers-all, [data-go-all], .cat-cta-btn');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    const dest = btn.dataset.go || 'pecas';
    if (dest === 'pecas') {
      activeCatalogCategory = '';
      const catInput = document.getElementById('catalogSearch');
      if (catInput) catInput.value = '';
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) catSelect.value = '';
    }
    show(dest);
  }
});

// Vinculação direta em todos os botões .ver-todas e .btn-offers-all
document.querySelectorAll('.ver-todas, .btn-offers-all, [data-go]').forEach(b => {
  b.onclick = (e) => {
    e.preventDefault();
    const dest = b.dataset.go || 'pecas';
    show(dest);
  };
});
document.querySelectorAll('[data-screen="cadastro"]').forEach(b => b.addEventListener('click', () => { show('cadastro'); openRegister(); }));
document.getElementById('quickLogin')?.addEventListener('click', () => { show('cadastro'); openLogin(); });
document.querySelectorAll('[data-auth]').forEach(b => b.onclick = () => {
  const action = b.dataset.auth;
  show('cadastro');
  if (action === 'login') setTimeout(() => openLogin(), 50); else setTimeout(() => openRegister(), 50);
});
document.getElementById('showLogin')?.addEventListener('click', openLogin);
document.getElementById('fpBackRegister')?.addEventListener('click', openRegister);

// ---------- Busca rápida e categorias na tela inicial ----------
const homeSearchInput = document.getElementById('homeSearchInput');
const homeSearchBtn = document.getElementById('homeSearchBtn');

// Limpa qualquer autofill indevido do navegador (ex: admin, CPF ou senhas salvas)
if (homeSearchInput) {
  homeSearchInput.value = '';
  setTimeout(() => { if (homeSearchInput) homeSearchInput.value = ''; }, 60);
  setTimeout(() => { if (homeSearchInput) homeSearchInput.value = ''; }, 300);
}

function executeHomeSearch() {
  const q = homeSearchInput?.value?.trim() || '';
  show('pecas');
  const catInput = document.getElementById('catalogSearch');
  if (catInput) {
    catInput.value = q;
    loadCatalog();
  }
}
homeSearchBtn?.addEventListener('click', executeHomeSearch);
homeSearchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') executeHomeSearch();
});

document.querySelectorAll('.clean-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.clean-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const cat = chip.dataset.cat || '';
    goToCategory(cat);
  });
});

const logoBtn = document.getElementById('logoBtn');
if (logoBtn) {
  logoBtn.addEventListener('click', () => show('inicio'));
  logoBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      show('inicio');
    }
  });
}


// ---------- Mostrar/ocultar senha ----------
document.querySelectorAll('.password-toggle').forEach(btn => btn.addEventListener('click', () => {
  const input = document.getElementById(btn.dataset.target);
  if (!input) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  btn.style.color = visible ? '#8b9199' : '#fff';
  btn.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
}));

// ---------- Máscara de telefone ----------
document.addEventListener('input', e => {
  if (['registerPhone', 'profilePhone'].includes(e.target.id)) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    e.target.value = v;
  }
});

// ---------- Máscara de CPF/CNPJ (reconhece automaticamente pela quantidade de dígitos) ----------
// Até 11 dígitos = CPF (000.000.000-00). A partir do 12º dígito = CNPJ (00.000.000/0000-00).
function isValidCpf(digits) {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}
function isValidCnpj(digits) {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (len) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}
function formatCpfCnpj(digits) {
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
function cpfCnpjTypeLabel(digits) {
  if (!digits.length) return '';
  if (digits.length <= 11) return digits.length === 11 ? (isValidCpf(digits) ? '· CPF ✓' : '· CPF (inválido)') : '· CPF';
  return digits.length === 14 ? (isValidCnpj(digits) ? '· CNPJ ✓' : '· CNPJ (inválido)') : '· CNPJ';
}
document.addEventListener('input', e => {
  if (['registerCpfCnpj', 'profileCpfCnpj'].includes(e.target.id)) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
    e.target.value = formatCpfCnpj(digits);
    const hint = document.getElementById(e.target.id + 'Type');
    if (hint) hint.textContent = cpfCnpjTypeLabel(digits);
  }
});

/* =========================================================================
 * [MÓDULO: 03-auth-and-addresses.js]
 * ========================================================================= */
// Módulo WMS: 03-auth-and-addresses.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Cadastro / login ----------
function openLogin() {
  const login = document.getElementById('fpLogin'), reg = document.getElementById('registerForm');
  if (login && reg) {
    login.classList.add('show'); reg.style.display = 'none';
    document.getElementById('authTitle').textContent = 'Já tenho cadastro';
    document.getElementById('authSubtitle').textContent = 'Entre na sua conta para acessar a loja e comprar peças.';
    document.getElementById('loginEmail').focus();
  }
}
function openRegister() {
  const login = document.getElementById('fpLogin'), reg = document.getElementById('registerForm');
  if (login && reg) {
    login.classList.remove('show'); reg.style.display = 'block';
    document.getElementById('authTitle').textContent = 'Cadastro de cliente';
    document.getElementById('authSubtitle').textContent = 'Crie sua conta para consultar peças e acompanhar seus pedidos.';
  }
}

function applyUser(user) {
  const previousUser = currentUser;
  currentUser = user;
  authenticated = !!user;
  updateNav();
  if (user) {
    setTimeout(syncCartWithServer, 50);
  } else {
    setLocalCartVersion(0);
  }
  if (user) {
    const n = document.getElementById('profileName'), e = document.getElementById('profileEmail');
    const c = document.getElementById('profileCpfCnpj');
    if (n) n.value = user.name || '';
    if (e) e.value = user.email || '';
    if (c) {
      c.value = user.cpfCnpj || '';
      const hint = document.getElementById('profileCpfCnpjType');
      if (hint) hint.textContent = cpfCnpjTypeLabel((user.cpfCnpj || '').replace(/\D/g, ''));
    }
  }
}

document.getElementById('createAccount')?.addEventListener('click', async () => {
  const name = document.getElementById('registerName').value.trim();
  const phone = document.getElementById('registerPhone').value.trim();
  const email = document.getElementById('registerEmail').value.trim().toLowerCase();
  const cpfCnpj = document.getElementById('registerCpfCnpj').value.trim();
  const pass = document.getElementById('registerPassword').value;
  const pass2 = document.getElementById('registerPassword2').value;
  if (!name || !phone || !email || !pass || !pass2) { alert('Preencha todos os campos do cadastro.'); return; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { alert('Digite um e-mail válido.'); return; }
  if (pass.length < 6) { alert('A senha deve ter pelo menos 6 caracteres.'); return; }
  if (pass !== pass2) { alert('As senhas não conferem.'); return; }
  const cpfCnpjDigits = cpfCnpj.replace(/\D/g, '');
  if (cpfCnpjDigits.length && cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
    alert('Digite um CPF (11 números) ou CNPJ (14 números) completo, ou deixe o campo em branco.');
    return;
  }
  if (cpfCnpjDigits.length === 11 && !isValidCpf(cpfCnpjDigits)) { alert('Esse CPF não é válido. Confira os números.'); return; }
  if (cpfCnpjDigits.length === 14 && !isValidCnpj(cpfCnpjDigits)) { alert('Esse CNPJ não é válido. Confira os números.'); return; }
  try {
    const { customer } = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, phone, email, password: pass, cpfCnpj }) });
    applyUser(customer);
    alert('Cadastro realizado! Bem-vindo à Fahren Motors.');
    show('inicio');
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const e = document.getElementById('loginEmail').value.trim().toLowerCase();
  const p = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError'), msg = document.getElementById('loginMessage');
  err.style.display = 'none'; msg.style.display = 'none';
  if (!e || !p) { err.textContent = 'Informe e-mail e senha.'; err.style.display = 'block'; return; }
  try {
    const { customer } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: e, password: p }) });
    applyUser(customer);
    msg.textContent = 'Login realizado com sucesso.'; msg.style.display = 'block';
    setTimeout(() => show('inicio'), 250);
  } catch (ex) {
    err.textContent = ex.message; err.style.display = 'block';
  }
});

document.getElementById('forgotPassword')?.addEventListener('click', () => {
  alert('Para recuperar o acesso, entre em contato com a Fahren Motors. A recuperação por e-mail será conectada quando o servidor de autenticação for configurado.');
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
  applyUser(null);
  cart = []; saveCart();
  show('inicio');
});

document.querySelector('#perfil .btn')?.addEventListener('click', async () => {
  const name = document.getElementById('profileName').value.trim();
  const email = document.getElementById('profileEmail').value.trim().toLowerCase();
  const cpfCnpj = document.getElementById('profileCpfCnpj').value.trim();
  const cpfCnpjDigits = cpfCnpj.replace(/\D/g, '');
  if (cpfCnpjDigits.length && cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
    alert('Digite um CPF (11 números) ou CNPJ (14 números) completo, ou deixe o campo em branco.');
    return;
  }
  if (cpfCnpjDigits.length === 11 && !isValidCpf(cpfCnpjDigits)) { alert('Esse CPF não é válido. Confira os números.'); return; }
  if (cpfCnpjDigits.length === 14 && !isValidCnpj(cpfCnpjDigits)) { alert('Esse CNPJ não é válido. Confira os números.'); return; }
  try {
    const { customer } = await api('/api/auth/me', { method: 'PUT', body: JSON.stringify({ name, email, cpfCnpj }) });
    currentUser = customer;
    alert('Dados do perfil salvos.');
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Endereço de entrega (CEP automático via ViaCEP) ----------
function fillAddressFields(a) {
  const f = { deliveryCep: 'cep', deliveryStreet: 'street', deliveryNumber: 'number', deliveryComplement: 'complement', deliveryNeighborhood: 'neighborhood', deliveryCity: 'city', deliveryState: 'state' };
  Object.entries(f).forEach(([id, k]) => { const el = document.getElementById(id); if (el) el.value = a?.[k] || ''; });
  const sum = document.getElementById('profileAddressSummary');
  if (sum) sum.value = a ? `${a.street}, ${a.number} - ${a.neighborhood}, ${a.city}/${a.state}` : 'Nenhum endereço cadastrado';
}

async function loadAddress() {
  if (!authenticated) return;
  try {
    const { address } = await api('/api/addresses/mine');
    fillAddressFields(address);
  } catch { /* usuário pode ainda não ter endereço salvo */ }
}

let cepTimer = null;
document.getElementById('deliveryCep')?.addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
  e.target.value = v;
  clearTimeout(cepTimer);
  if (v.replace(/\D/g, '').length === 8) {
    cepTimer = setTimeout(async () => {
      const cep = v.replace(/\D/g, '');
      try {
        const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d.erro) { alert('CEP não encontrado.'); return; }
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        set('deliveryStreet', d.logradouro); set('deliveryNeighborhood', d.bairro); set('deliveryCity', d.localidade); set('deliveryState', d.uf);
        document.getElementById('deliveryNumber')?.focus();
      } catch {
        alert('Não foi possível consultar o CEP agora. Verifique sua conexão e tente novamente.');
      }
    }, 250);
  }
});

document.getElementById('saveDeliveryAddress')?.addEventListener('click', async () => {
  const a = {
    cep: document.getElementById('deliveryCep').value.trim(),
    street: document.getElementById('deliveryStreet').value.trim(),
    number: document.getElementById('deliveryNumber').value.trim(),
    complement: document.getElementById('deliveryComplement').value.trim(),
    neighborhood: document.getElementById('deliveryNeighborhood').value.trim(),
    city: document.getElementById('deliveryCity').value.trim(),
    state: document.getElementById('deliveryState').value.trim().toUpperCase(),
  };
  if (!a.cep || !a.street || !a.number || !a.neighborhood || !a.city || !a.state) { alert('Preencha os dados obrigatórios do endereço.'); return; }
  try {
    await api('/api/addresses/mine', { method: 'POST', body: JSON.stringify(a) });
    fillAddressFields(a);
    const m = document.getElementById('addressSavedMsg'); if (m) m.style.display = 'block';
    setTimeout(() => show('carrinho'), 500);
  } catch (err) {
    alert(err.message);
  }
});
document.getElementById('editAddressBtn')?.addEventListener('click', () => show('endereco'));

/* =========================================================================
 * [MÓDULO: 04-catalog-and-categories.js]
 * ========================================================================= */
// Módulo WMS: 04-catalog-and-categories.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Catálogo com busca avançada ----------
// Foto real da categoria usada quando a peça ainda não tem foto própria cadastrada.
const CATEGORY_IMAGES = {
  'Filtros': 'images/categorias/filtros.jpg',
  'Freios': '/api/uploads/img/24.jpg',
  'Elétrica e ignição': 'images/categorias/eletrica.jpg',
  'Suspensão': '/api/uploads/img/19.jpg',
  'Correias': 'images/categorias/correias.jpg',
  'Sensores e injeção': '/api/uploads/img/28.jpg',
  'Iluminação': 'images/categorias/iluminacao.jpg',
  'Óleos e fluidos': 'images/categorias/oleos.jpg',
};

// Catálogo oficial com peças reais cadastradas no WMS prontas para venda imediata
const CATALOG_FALLBACK_PRODUCTS = [
  {
    id: 3298,
    name: 'BARRA AXIAL ESQUERDA/DIREITA 175MM BRD0288 PERFECT',
    code: 'BRD0288',
    category: 'Suspensão',
    description: 'Barra axial de direção reforçada 175mm Perfect com coifa e porca. Peça pronta para instalação imediata.',
    compatibility: 'Linha automotiva nacional compatível',
    price: 64.87,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/19.jpg, /api/uploads/img/20.jpg',
    photos: ['/api/uploads/img/19.jpg', '/api/uploads/img/20.jpg']
  },
  {
    id: 3299,
    name: 'BARRA AXIAL ESQUERDA/DIREITA GOL/FOX',
    code: '680192',
    category: 'Suspensão',
    description: 'Barra axial de direção para Volkswagen Gol e Fox. Alta precisão e durabilidade certificada.',
    compatibility: 'Volkswagen Gol, Fox, Voyage, Saveiro',
    price: 51.89,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/22.jpg',
    photos: ['/api/uploads/img/22.jpg']
  },
  {
    id: 3300,
    name: 'BUCHA BARRA ESTABILIZADORA DIANTEIRA DIANTEIRA 20MM 2790 SAMPEL',
    code: 'Sampel 2790',
    category: 'Suspensão',
    description: 'Bucha da barra estabilizadora dianteira 20mm Sampel em composto vulcanizado de alta resistência.',
    compatibility: 'Compatibilidade conforme aplicação Sampel 2790',
    price: 44.61,
    stockQty: 2,
    inStock: true,
    photoUrl: '/api/uploads/img/23.jpg',
    photos: ['/api/uploads/img/23.jpg']
  },
  {
    id: 3301,
    name: 'Corpo de borboleta do Renault Duster 2.0',
    code: '20366',
    category: 'Sensores e injeção',
    description: 'Corpo de borboleta TBI eletrônico para Renault Duster 2.0. Peça pronta para venda e envio imediato.',
    compatibility: 'Renault Duster 2.0 16V Hi-Flex',
    price: 759.65,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/28.jpg, /api/uploads/img/29.jpg',
    photos: ['/api/uploads/img/28.jpg', '/api/uploads/img/29.jpg']
  },
  {
    id: 3277,
    name: 'DISCO FREIO DIANTEIRO VENTILADO 266MM 4 FUROS S/ CUBO HF750 HIPPER FREIOS',
    code: 'HF750',
    category: 'Freios',
    description: 'Disco de freio dianteiro ventilado 266mm 4 furos sem cubo Hipper Freios. Excelente dissipação de calor.',
    compatibility: 'Aplicações conforme especificação HF750',
    price: 322.86,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/24.jpg',
    photos: ['/api/uploads/img/24.jpg']
  },
  {
    id: 3278,
    name: 'Fluido de Freio DOT 4  500ml',
    code: 'DOT4-500',
    category: 'Óleos e fluidos',
    description: 'Fluido de freio sintético DOT 4 de alta performance para máxima segurança de frenagem.',
    compatibility: 'Sistemas de freio a disco e tambor padrão DOT 4',
    price: 32.87,
    stockQty: 3,
    inStock: true,
    photoUrl: '/api/uploads/img/25.jpg',
    photos: ['/api/uploads/img/25.jpg']
  },
  {
    id: 3276,
    name: 'Jogo de pastilhas de freio dianteiras Fiat',
    code: '1BP30889AA',
    category: 'Freios',
    description: 'Jogo completo de pastilhas de freio dianteiras para veículos da linha Fiat.',
    compatibility: 'Linha Fiat compatível',
    price: 58.94,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/26.jpg, /api/uploads/img/27.jpg',
    photos: ['/api/uploads/img/26.jpg', '/api/uploads/img/27.jpg']
  },
  {
    id: 3297,
    name: 'PIVO SUSPENSAO DIANTEIRO INFERIOR ESQUERDO/DIREITO PVI1010 PERFECT',
    code: 'pvi1010',
    category: 'Suspensão',
    description: 'Pivô de suspensão dianteiro inferior esquerdo/direito Perfect PVI1010 reforçado.',
    compatibility: 'Linha automotiva nacional compatível',
    price: 49.90,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/16.jpg, /api/uploads/img/17.jpg, /api/uploads/img/18.jpg',
    photos: ['/api/uploads/img/16.jpg', '/api/uploads/img/17.jpg', '/api/uploads/img/18.jpg']
  },
  {
    id: 3296,
    name: 'Terminal de direção Explorer Ranger',
    code: 'N2120',
    category: 'Suspensão',
    description: 'Terminal de direção reforçado para Ford Explorer e Ranger.',
    compatibility: 'Ford Ranger, Explorer',
    price: 106.69,
    stockQty: 2,
    inStock: true,
    photoUrl: '/api/uploads/img/14.jpg, /api/uploads/img/15.jpg',
    photos: ['/api/uploads/img/14.jpg', '/api/uploads/img/15.jpg']
  },
  {
    id: 3255,
    name: 'Terminal de direção Gol',
    code: 'N1027',
    category: 'Suspensão',
    description: 'Terminal de direção articulado para linha Volkswagen Gol.',
    compatibility: 'Volkswagen Gol, Parati, Saveiro, Voyage',
    price: 52.99,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/12.jpg, /api/uploads/img/13.jpg',
    photos: ['/api/uploads/img/12.jpg', '/api/uploads/img/13.jpg']
  },
  {
    id: 3234,
    name: 'Terminal de direção Gol',
    code: 'N183',
    category: 'Suspensão',
    description: 'Terminal de direção para Volkswagen Gol com encaixe cônico de precisão.',
    compatibility: 'Volkswagen Gol, Parati, Saveiro',
    price: 58.37,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/10.jpg, /api/uploads/img/11.jpg',
    photos: ['/api/uploads/img/10.jpg', '/api/uploads/img/11.jpg']
  }
];

function isLojaFictitiousPhoto(url) {
  if (!url) return false;
  const s = String(url).trim().toLowerCase();
  if (!s) return false;
  return (
    s.startsWith('images/produtos/') ||
    s.startsWith('/images/produtos/') ||
    s.startsWith('images/categorias/') ||
    s.startsWith('/images/categorias/') ||
    s.startsWith('loja/images/') ||
    s.startsWith('/loja/images/')
  );
}

function isLojaRealPhoto(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (!s || s.startsWith('data:image/svg+xml')) return false;
  return !isLojaFictitiousPhoto(s);
}

function isLojaRealWmsProduct(product) {
  if (!product) return false;
  const photos = extractLojaPhotos(product);
  if (!photos.length) return true;
  return photos.some(isLojaRealPhoto);
}

// Função para priorizar no topo da loja peças reais com fotos cadastradas
function prioritizeRealProducts(list) {
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => {
    const aPhotos = extractLojaPhotos(a);
    const bPhotos = extractLojaPhotos(b);
    const aIsReal = aPhotos.some(isLojaRealPhoto);
    const bIsReal = bPhotos.some(isLojaRealPhoto);
    if (aIsReal && !bIsReal) return -1;
    if (!aIsReal && bIsReal) return 1;
    return 0;
  });
}

function money(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const LOJA_NO_PHOTO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240">' +
      '<rect width="320" height="240" fill="#141821"/>' +
      '<rect x="116" y="64" width="88" height="68" rx="10" fill="none" stroke="#475569" stroke-width="4"/>' +
      '<circle cx="143" cy="88" r="8" fill="#475569"/>' +
      '<path d="M124 122l22-22 18 16 14-12 18 18" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="160" y="164" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="14" font-weight="700">Sem foto cadastrada</text>' +
    '</svg>'
  );
if (typeof window !== 'undefined') {
  window.LOJA_NO_PHOTO_SVG = LOJA_NO_PHOTO_SVG;
}

function extractLojaPhotos(product) {
  if (!product) return [];
  let list = [];
  if (Array.isArray(product.photos) && product.photos.length) {
    list = product.photos;
  } else {
    const raw = (!Array.isArray(product.photos) && product.photos) || product.photoUrl || product.photo_url || '';
    if (!raw) return [];
    const s = String(raw).trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length) list = arr;
      } catch {}
    } else if (s.includes(',')) {
      list = s.split(',');
    } else if (s) {
      list = [s];
    }
  }
  const cleanList = list.map(p => normalizeLojaPhoto(p, '')).filter(Boolean);
  return Array.from(new Set(cleanList));
}

function getLojaPrimaryPhoto(product) {
  const photos = extractLojaPhotos(product);
  return photos.length ? photos[0] : LOJA_NO_PHOTO_SVG;
}

function normalizeLojaPhoto(url, fallback = LOJA_NO_PHOTO_SVG) {
  if (!url) return fallback;
  url = String(url).trim();
  if (url.startsWith('[')) {
    try {
      const arr = JSON.parse(url);
      if (Array.isArray(arr) && arr.length) url = arr[0];
    } catch {}
  } else if (url.includes(',')) {
    url = url.split(',')[0].trim();
  }
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;

  // Garante que imagens locais da loja fiquem relativas ("images/...") para funcionar tanto via http:// quanto via file://
  if (url.startsWith('/loja/images/')) url = url.replace(/^\/loja\//, '');
  else if (url.startsWith('loja/images/')) url = url.replace(/^loja\//, '');
  else if (url.startsWith('/images/')) url = url.replace(/^\//, '');

  // Ajusta uploads quando o usuário abre direto o arquivo via file://
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    if (url.startsWith('/uploads/')) url = '../uploads/' + url.replace(/^\/uploads\//, '');
    else if (url.startsWith('uploads/')) url = '../' + url;
  }

  return url;
}

async function loadCategories() {
  const select = document.getElementById('filterCategory');
  if (!select) return;
  const currentVal = select.value;
  try {
    const data = await api('/api/products/categories');
    const list = data.categories || [];
    select.innerHTML = '<option value="">Todas as categorias</option>';
    list.forEach(item => {
      const name = typeof item === 'string' ? item : item.name;
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
    select.dataset.loaded = '1';
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
  }
}

// ---------- Carrossel automático infinito de todas as peças (exclusivo da tela Início) ----------
async function loadCategoryCarousel() {
  const wrap = document.getElementById('categoryCarousel');
  const track = document.getElementById('categoryCarouselTrack');
  if (!track) return;
  try {
    let items = [];
    let apiSucceeded = false;
    try {
      const res = await api('/api/products/categories/featured?_t=' + Date.now());
      items = res.products || res.categories || (Array.isArray(res.featured) ? res.featured.map(f => f.product || f) : []);
      apiSucceeded = true;
    } catch (e) {
      console.warn('Tentando fallback para carrossel:', e);
    }

    if (!apiSucceeded || !items.length) {
      try {
        const pRes = await api('/api/products?_t=' + Date.now());
        items = pRes.products || [];
        apiSucceeded = true;
      } catch (_) {}
    }

    if (!apiSucceeded && !items.length) {
      items = (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS.slice() : [];
    }

    if (!items.length) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = '';

    const cardHtml = (c, hidden) => {
      const photo = getLojaPrimaryPhoto(c);
      const priceVal = typeof c.price === 'number' ? c.price : (c.price_cents ? c.price_cents / 100 : 0);
      const pixVal = priceVal > 0 ? (priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04))) : 0;
      const installmentVal = priceVal > 0 ? priceVal / 6 : 0;
      return `<div class="card cat-card" data-product-id="${c.id || ''}" data-category="${c.category || ''}"${hidden ? ' aria-hidden="true"' : ''}>
        <div class="cat-card-img-wrap">
          <img alt="${hidden ? '' : c.name}" loading="lazy" src="${photo}" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;">
          ${priceVal > 0 ? `<span class="cat-card-pix-badge">-4% PIX</span>` : ''}
        </div>
        <small class="cat-card-category">${c.category || 'Peça'}</small>
        <b class="cat-card-name" title="${c.name}">${c.name}</b>
        ${c.compatibility ? `<div class="cat-card-compat" title="${c.compatibility}"><span>🚗 ${c.compatibility}</span></div>` : ''}
        <div class="cat-card-price-block">
          <span class="cat-card-pix-label">À vista no Pix</span>
          <div class="cat-card-pix">${priceVal > 0 ? money(pixVal) : 'Disponível'}</div>
          ${priceVal > 0 ? `<div class="cat-card-installment">ou ${money(priceVal)} em até 6x</div>` : ''}
        </div>
        ${c.inStock !== false && priceVal > 0 ? `
        <button type="button" class="cat-card-cart-btn" data-cart-id="${c.id || ''}" aria-label="Adicionar ao carrinho" title="Adicionar ao carrinho">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </button>` : ''}
      </div>`;
    };

    const cardAllHtml = (hidden) => `
      <div class="card cat-card cat-card-all" data-go-all="1"${hidden ? ' aria-hidden="true"' : ''} title="Ver todas as peças do catálogo">
        <div class="cat-card-all-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        <b>Ver Todas</b>
        <small>Catálogo completo ›</small>
      </div>`;

    // Itens únicos sem repetições infinitas (cada produto aparece apenas uma vez)
    const uniqueMap = new Map();
    items.forEach(p => {
      if (p && p.id && !uniqueMap.has(String(p.id))) {
        uniqueMap.set(String(p.id), p);
      }
    });
    const baseList = Array.from(uniqueMap.values());

    const htmlContent = baseList.map(c => cardHtml(c, false)).join('') + cardAllHtml(false);
    if (track.__renderSig === htmlContent && track.children.length) return;
    track.__renderSig = htmlContent;
    track.innerHTML = htmlContent;
    track.style.animation = 'none';

    track.querySelectorAll('.cat-card:not(.cat-card-all)').forEach(el => {
      el.onclick = () => {
        const prodId = el.dataset.productId;
        if (prodId) {
          const prodObj = items.find(p => String(p.id) === String(prodId));
          openProductDetails(prodId, prodObj);
        } else {
          goToCategory(el.dataset.category);
        }
      };
    });
    track.querySelectorAll('.cat-card-all').forEach(el => {
      el.onclick = () => show('pecas');
    });
    track.querySelectorAll('.cat-card-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prodId = btn.dataset.cartId;
        if (prodId) addToCart(prodId, items, 1, btn);
      });
    });
  } catch (err) {
    console.error('Erro ao carregar carrossel:', err);
  }
}

// ---------- Peças Recomendadas da Mesma Categoria (Grid estático, sem carrossel) ----------
async function loadRecommendedProducts(product) {
  const section = document.getElementById('detailRelatedSection');
  const grid = document.getElementById('detailRecommendedGrid');
  const catNameEl = document.getElementById('detailRelatedCategoryName');
  const seeCatBtn = document.getElementById('detailRelatedSeeCategoryBtn');

  if (!section || !grid) return;

  const categoryName = product?.category || '';
  if (catNameEl) catNameEl.textContent = categoryName || 'Peças Automotivas';
  if (seeCatBtn) {
    seeCatBtn.onclick = () => goToCategory(categoryName);
  }

  grid.innerHTML = '<p style="color:var(--fp-9da2aa);grid-column:1/-1;padding:20px 0">Buscando peças recomendadas...</p>';

  try {
    let items = [];
    if (categoryName) {
      const res = await api('/api/products?category=' + encodeURIComponent(categoryName) + '&_t=' + Date.now());
      items = (res.products || []).filter(p => String(p.id) !== String(product.id));
    }

    const recommended = items.slice(0, 4);

    if (!recommended.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    grid.innerHTML = recommended.map(p => {
      const photo = getLojaPrimaryPhoto(p);
      const priceVal = typeof p.price === 'number' ? p.price : (p.price_cents ? p.price_cents / 100 : 0);
      const pixVal = priceVal > 0 ? (priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04))) : 0;
      return `
        <div class="fp-rec-card" data-rec-id="${p.id}" role="button" tabindex="0">
          <div class="fp-rec-card-img-wrap">
            <img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          </div>
          <div class="fp-rec-card-body">
            <span class="fp-rec-card-cat">${p.category || 'Peça'}</span>
            <strong class="fp-rec-card-name" title="${p.name}">${p.name}</strong>
            <div class="cat-card-price-block">
              <span class="cat-card-pix-label">À vista no Pix</span>
              <div class="cat-card-pix">${priceVal > 0 ? money(pixVal) : 'Disponível'}</div>
              ${priceVal > 0 ? `<div class="cat-card-installment">ou ${money(priceVal)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.fp-rec-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.recId;
        const target = recommended.find(p => String(p.id) === String(id));
        if (target) {
          openProductDetails(id, target);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      };
    });
  } catch (err) {
    console.error('Erro ao carregar peças recomendadas:', err);
    section.style.display = 'none';
  }
}

function syncHomeCategoryCardPhotos(productsOrCategories, opts = {}) {
  if (!Array.isArray(productsOrCategories)) return;
  const clearFictitious = Boolean(opts && opts.clearFictitious);
  const bestPhotoByCat = {};
  productsOrCategories.forEach(item => {
    if (!item) return;
    // Se vier do endpoint /api/products/categories ({ name, photo, hasRealPhoto })
    if (item.name && item.photo && (item.hasRealPhoto || isLojaRealPhoto(item.photo))) {
      const normName = normalizeCatalogCategory(item.name);
      if (normName && !bestPhotoByCat[normName]) {
        bestPhotoByCat[normName] = normalizeLojaPhoto(item.photo, '');
      }
      return;
    }
    // Se vier de uma lista de produtos
    const cat = normalizeCatalogCategory(item.category || '');
    if (!cat || bestPhotoByCat[cat]) return;
    const photos = extractLojaPhotos(item);
    const firstReal = photos.find(isLojaRealPhoto);
    if (firstReal) {
      bestPhotoByCat[cat] = firstReal;
    }
  });

  Object.keys(bestPhotoByCat).forEach(cat => {
    CATEGORY_IMAGES[cat] = bestPhotoByCat[cat];
  });

  document.querySelectorAll('.cat-grid-item[data-cat]').forEach(card => {
    const rawCat = card.dataset.cat || card.getAttribute('data-cat') || '';
    const normCat = normalizeCatalogCategory(rawCat);
    const img = card.querySelector('.cat-card-thumb img');
    if (!img) return;
    if (bestPhotoByCat[normCat]) {
      if (img.getAttribute('src') !== bestPhotoByCat[normCat]) {
        img.src = bestPhotoByCat[normCat];
      }
    } else if (clearFictitious && isLojaFictitiousPhoto(img.getAttribute('src') || '')) {
      img.src = LOJA_NO_PHOTO_SVG;
    }
  });
}
if (typeof window !== 'undefined') {
  window.syncHomeCategoryCardPhotos = syncHomeCategoryCardPhotos;
}

async function goToCategory(category) {
  activeCatalogCategory = normalizeCatalogCategory(category);
  try {
    sessionStorage.setItem('fahren-last-category', activeCatalogCategory);
  } catch {}
  const searchInput = document.getElementById('catalogSearch');
  if (searchInput) {
    searchInput.value = '';
  }
  show('pecas', { keepFilter: true });
}


// ==========================================
// CATÁLOGO DE VEÍCULOS & SISTEMA DE GARAGEM
// ==========================================
const VEHICLE_CATALOG = {
  'Volkswagen': {
    models: ['Gol', 'Polo', 'Fox', 'Voyage', 'Saveiro', 'Virtus', 'T-Cross', 'Nivus', 'Jetta', 'Golf', 'Tiguan', 'Amarok'],
    engines: ['1.0 8V Total Flex', '1.0 12V MPI', '1.0 200 TSI', '1.4 250 TSI', '1.6 8V Total Flex', '1.6 16V MSI', '2.0 TSI']
  },
  'Chevrolet': {
    models: ['Onix', 'Prisma', 'Tracker', 'Spin', 'Cruze', 'Celta', 'Corsa', 'Montana', 'S10', 'Astra', 'Vectra'],
    engines: ['1.0 8V VHC / SPE/4', '1.0 Turbo ECOTEC', '1.2 Turbo', '1.4 8V Econoflex', '1.4 Turbo', '1.8 8V Econoflex', '2.8 CTDI Turbo Diesel']
  },
  'Fiat': {
    models: ['Strada', 'Palio', 'Uno', 'Mobi', 'Argo', 'Cronos', 'Toro', 'Siena', 'Punto', 'Fiorino', 'Fastback', 'Pulse'],
    engines: ['1.0 Fire 8V', '1.0 Firefly', '1.0 Turbo T200', '1.3 Firefly', '1.3 Turbo T270', '1.4 Fire', '1.8 E.torQ 16V', '2.0 MultiJet Diesel']
  },
  'Toyota': {
    models: ['Corolla', 'Hilux', 'Etios', 'Yaris', 'Corolla Cross', 'SW4', 'RAV4'],
    engines: ['1.3 16V Dual VVT-i', '1.5 16V Dual VVT-i', '1.8 16V Dual VVT-i / Hybrid', '2.0 16V Dynamic Force', '2.8 Turbo Diesel 1GD']
  },
  'Honda': {
    models: ['Civic', 'Fit', 'City', 'HR-V', 'WR-V', 'CR-V'],
    engines: ['1.4 8V / 16V i-DSI / i-VTEC', '1.5 16V i-VTEC', '1.5 Turbo VTEC', '1.8 16V i-VTEC', '2.0 16V i-VTEC']
  },
  'Hyundai': {
    models: ['HB20', 'HB20S', 'HB20X', 'Creta', 'Tucson', 'i30', 'Santa Fe'],
    engines: ['1.0 12V Kappa', '1.0 Turbo TGDI', '1.6 16V Gamma', '2.0 16V Nu']
  },
  'Ford': {
    models: ['Ka', 'Fiesta', 'EcoSport', 'Focus', 'Ranger', 'Fusion'],
    engines: ['1.0 12V TiVCT 3 Cilindros', '1.5 12V Dragon', '1.5 16V Sigma', '1.6 16V Sigma', '2.0 Duratec', '3.2 Duratorq Diesel']
  },
  'Renault': {
    models: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Oroch', 'Clio', 'Megane'],
    engines: ['1.0 12V SCe 3 Cilindros', '1.6 8V Hi-Flex', '1.6 16V SCe', '2.0 16V F4R', '1.3 TCe Turbo Flex']
  }
};

function getActiveVehicle() {
  try {
    const raw = localStorage.getItem('fahren_selected_vehicle');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setActiveVehicle(vehicle) {
  try {
    localStorage.setItem('fahren_selected_vehicle', JSON.stringify(vehicle));
  } catch {}
  updateGarageUI();
  if (typeof loadCatalog === 'function') loadCatalog();
}

function clearActiveVehicle() {
  try {
    localStorage.removeItem('fahren_selected_vehicle');
  } catch {}

  // 1. Limpa o input de placa
  const placaInput = document.getElementById('vfPlacaInput');
  if (placaInput) placaInput.value = '';

  // 2. Limpa os selects de modelo, ano, motor e montadora
  const montadora = document.getElementById('vfMontadora');
  const modelo = document.getElementById('vfModelo');
  const ano = document.getElementById('vfAno');
  const motor = document.getElementById('vfMotor');
  if (montadora) montadora.value = '';
  if (modelo) {
    modelo.innerHTML = '<option value="">Modelo</option>';
    modelo.disabled = true;
  }
  if (ano) {
    ano.innerHTML = '<option value="">Ano</option>';
    ano.disabled = true;
  }
  if (motor) {
    motor.innerHTML = '<option value="">Motor</option>';
    motor.disabled = true;
  }

  // 3. Limpa o campo de busca do catálogo
  const catInput = document.getElementById('catalogSearch');
  if (catInput) catInput.value = '';

  // 4. Atualiza a barra de garagem (oculta o veículo ativo)
  updateGarageUI();
  if (typeof loadCatalog === 'function') loadCatalog();

  // 5. Navega para a página inicial
  show('inicio');

  // 6. Ativa a aba "Por Placa do Veículo" na página inicial
  const tabPlate = document.getElementById('vfTabPlate');
  const tabModel = document.getElementById('vfTabModel');
  const rowModel = document.getElementById('vfModelRow');
  const rowPlate = document.getElementById('vfPlateRow');
  if (tabPlate && tabModel) {
    tabPlate.classList.add('active');
    tabModel.classList.remove('active');
    if (rowModel) rowModel.style.display = 'flex';
    if (rowPlate) rowPlate.style.display = 'none';
  }

  // 7. Rola suavemente até o localizador de veículo (sem abrir teclado virtual!)
  setTimeout(() => {
    const vf = document.getElementById('vehicleFinderWidget') || document.querySelector('.vehicle-finder');
    vf?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);

  showToast('Filtro limpo! Digite uma placa ou selecione o modelo.');
}

function updateGarageUI() {
  const v = getActiveVehicle();
  const bars = [
    { bar: document.getElementById('activeGarageBar'), title: document.getElementById('activeGarageTitle') },
    { bar: document.getElementById('activeGarageBarCatalog'), title: document.getElementById('activeGarageTitleCatalog') }
  ];

  bars.forEach(({ bar, title }) => {
    if (!bar) return;
    if (v && v.model) {
      bar.style.display = 'flex';
      const text = [v.brand, v.model, v.year, v.engine].filter(Boolean).join(' • ');
      if (title) title.textContent = text;
    } else {
      bar.style.display = 'none';
    }
  });
}

function checkProductCompatibility(product) {
  const v = getActiveVehicle();
  if (!v || !v.model) return null;
  const comp = (product.compatibility || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  const full = comp + ' ' + desc + ' ' + name;
  const model = v.model.toLowerCase();
  const brand = (v.brand || '').toLowerCase();

  if (full.includes('universal') || comp.includes('universal')) {
    return { ok: true, label: 'Aplicação Universal Compatível' };
  }
  if (full.includes(model)) {
    return { ok: true, label: '100% Compatível com seu ' + v.model };
  }
  if (brand && full.includes(brand)) {
    return { ok: true, label: 'Compatível com linha ' + v.brand };
  }
  return { ok: false, label: 'Verificar compatibilidade' };
}

function renderProducts(container, products) {
  // Evita redesenhar a lista (e fazer a página "pular") quando os dados não mudaram
  const renderSig = JSON.stringify(products || []);
  if (container.__renderSig === renderSig && container.children.length) return;
  container.__renderSig = renderSig;
  if (!products.length) {
    container.innerHTML = '<p style="color:var(--fp-9da2aa)">Nenhuma peça encontrada com esses filtros.</p>';
    return;
  }
  container.innerHTML = products.map(p => {
    const photos = extractLojaPhotos(p);
    const hasMultiple = photos.length > 1;
    let photoHtml = '';
    if (hasMultiple) {
      photoHtml = `
        <div class="card-photo-slider" data-card-id="${p.id}" data-current-index="0">
          <img src="${photos[0]}" alt="${p.name}" class="card-photo-img" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          <button type="button" class="card-photo-nav-btn card-photo-prev" aria-label="Foto anterior" title="Foto anterior">‹</button>
          <button type="button" class="card-photo-nav-btn card-photo-next" aria-label="Próxima foto" title="Próxima foto">›</button>
          <div class="card-photo-counter">1/${photos.length}</div>
        </div>
      `;
    } else if (photos.length === 1) {
      photoHtml = `<img src="${photos[0]}" alt="${p.name}" class="card-photo-img" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />`;
    } else {
      photoHtml = `<img src="${LOJA_NO_PHOTO_SVG}" alt="${p.name}" class="card-photo-img is-placeholder" loading="lazy" />`;
    }

    const maxQty = p.stockQty || 99;
    const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
    const pixVal = priceVal > 0 ? (priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04))) : 0;
    return `
    <div class="product" data-product-id="${p.id}">
      <div class="part-photo">${photoHtml}</div>
      <div class="product-info-wrap">
        <b class="product-name" title="${p.name}">${p.name}</b>
        <small class="product-meta">${p.description || p.category || 'Aplicação compatível'}</small>
        <div class="stock">${p.inStock ? '● Disponível' : '○ Fora de estoque'}</div>
      </div>
      <div class="product-price-block">
        <div class="product-pix-row">
          <span class="product-pix-price">${priceVal > 0 ? money(pixVal) : 'Sob Consulta'}</span>
          ${priceVal > 0 ? `
            <span class="product-pix-tag">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px"><path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z"/></svg>
              no Pix
            </span>
            <span class="product-pix-badge">4% OFF</span>
          ` : ''}
        </div>
        ${priceVal > 0 ? `
          <div class="product-alt-price">ou <strong>${money(priceVal)}</strong> em até 12x no cartão</div>
        ` : ''}
      </div>
      <div class="product-bottom-actions">
        ${p.inStock ? `
          <div class="product-qty-row">
            <label class="qty-label">Quantidade:</label>
            <div class="qty-control">
              <button type="button" class="btn-qty-btn p-minus" data-id="${p.id}" aria-label="Diminuir quantidade">−</button>
              <input type="number" class="product-qty-val" data-id="${p.id}" value="1" min="1" max="${maxQty}" readonly />
              <button type="button" class="btn-qty-btn p-plus" data-id="${p.id}" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <button class="btn add-cart-btn" data-id="${p.id}">COLOCAR NO CARRINHO</button>
        ` : `
          <button class="btn" disabled style="opacity:.5;cursor:not-allowed;width:100%">FORA DE ESTOQUE</button>
        `}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.product').forEach(card => {
    const id = card.dataset.productId;
    const input = card.querySelector('.product-qty-val');
    const minus = card.querySelector('.p-minus');
    const plus = card.querySelector('.p-plus');
    const addBtn = card.querySelector('.add-cart-btn');
    const max = parseInt(input?.max, 10) || 99;

    // Navegação de fotos diretamente no card do catálogo quando houver múltiplas imagens
    const sliderWrap = card.querySelector('.card-photo-slider');
    if (sliderWrap) {
      const prodItem = products.find(item => String(item.id) === String(id));
      const cardPhotos = extractLojaPhotos(prodItem);
      if (cardPhotos.length > 1) {
        const imgEl = sliderWrap.querySelector('.card-photo-img');
        const counterEl = sliderWrap.querySelector('.card-photo-counter');
        const btnPrev = sliderWrap.querySelector('.card-photo-prev');
        const btnNext = sliderWrap.querySelector('.card-photo-next');
        let cardIdx = 0;

        const updateCardPhoto = (newIdx) => {
          cardIdx = (newIdx + cardPhotos.length) % cardPhotos.length;
          sliderWrap.dataset.currentIndex = cardIdx;
          if (imgEl) imgEl.src = cardPhotos[cardIdx];
          if (counterEl) counterEl.textContent = `${cardIdx + 1}/${cardPhotos.length}`;
        };

        // Suporte completo a swipe por toque no mobile diretamente no card
        let cardStartX = 0;
        let cardStartY = 0;
        let cardSwiped = false;

        sliderWrap.addEventListener('touchstart', (e) => {
          if (e.touches && e.touches[0]) {
            cardStartX = e.touches[0].clientX;
            cardStartY = e.touches[0].clientY;
            cardSwiped = false;
          }
        }, { passive: true });

        sliderWrap.addEventListener('touchmove', (e) => {
          if (e.touches && e.touches[0]) {
            const diffX = e.touches[0].clientX - cardStartX;
            const diffY = e.touches[0].clientY - cardStartY;
            if (Math.abs(diffX) > 20 && Math.abs(diffX) > Math.abs(diffY)) {
              cardSwiped = true;
            }
          }
        }, { passive: true });

        sliderWrap.addEventListener('touchend', (e) => {
          if (!cardSwiped || !e.changedTouches || !e.changedTouches[0]) return;
          const diffX = e.changedTouches[0].clientX - cardStartX;
          if (diffX < -30) {
            updateCardPhoto(cardIdx + 1);
          } else if (diffX > 30) {
            updateCardPhoto(cardIdx - 1);
          }
        });

        if (btnPrev) {
          btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            updateCardPhoto(cardIdx - 1);
          });
          btnPrev.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        }
        if (btnNext) {
          btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            updateCardPhoto(cardIdx + 1);
          });
          btnNext.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        }
      }
    }

    // Ao clicar na foto, nome ou card da peça, abre a tela completa com hiper zoom
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-qty-row') || e.target.closest('.add-cart-btn') || e.target.closest('.card-photo-nav-btn') || e.target.closest('button')) {
        return;
      }
      const prod = products.find(p => String(p.id) === String(id));
      openProductDetails(id, prod);
    });

    if (minus && input) {
      minus.onclick = (e) => {
        e.stopPropagation();
        let val = parseInt(input.value, 10) || 1;
        if (val > 1) input.value = val - 1;
      };
    }
    if (plus && input) {
      plus.onclick = (e) => {
        e.stopPropagation();
        let val = parseInt(input.value, 10) || 1;
        if (val < max) input.value = val + 1;
      };
    }
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.stopPropagation();
        const qty = parseInt(input?.value, 10) || 1;
        addToCart(id, products, qty, addBtn);
      };
    }
  });
}

/* =========================================================================
 * [MÓDULO: 05-product-detail-and-zoom.js]
 * ========================================================================= */
// Módulo WMS: 05-product-detail-and-zoom.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Detalhes da Peça e Visualizador de Hiper Zoom 3D ----------
let currentProduct = null;

async function openProductDetails(productId, cachedProduct = null, push = true, opts = {}) {
  let product = null;
  if (productId !== undefined && productId !== null && productId !== '') {
    try {
      const data = await api('/api/products/' + productId);
      if (data && data.product) product = data.product;
    } catch (err) {
      console.warn('Usando cache local da peça após falha na API:', err);
    }
  }
  if (!product) {
    product = cachedProduct || currentProduct;
  }

  // Se a API oscilar ao voltar de outro app ou offline, busca no catálogo de fallback em memória
  if (!product && typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') {
    product = CATALOG_FALLBACK_PRODUCTS.find(p => String(p.id) === String(productId));
  }

  if (!product) {
    // Se for sincronização em segundo plano (ao acordar de outro app), JAMAIS dispare alert
    if (opts.silent) return;
    console.warn('Peça temporariamente indisponível para o ID:', productId);
    return;
  }

  // MODO SILENCIOSO (sincronização de estoque em segundo plano):
  // atualiza apenas preço/estoque no lugar, sem redesenhar galeria, sem trocar de tela e sem mexer na rolagem.
  if (opts.silent) {
    if (!currentProduct || String(currentProduct.id) !== String(product.id)) return;
    const contentSig = (p) => JSON.stringify([p.name, p.code, p.category, p.description, p.compatibility, extractLojaPhotos(p)]);
    const contentChanged = contentSig(product) !== contentSig(currentProduct);
    const sig = JSON.stringify([product.price, product.inStock, product.stockQty]);
    const oldSig = JSON.stringify([currentProduct.price, currentProduct.inStock, currentProduct.stockQty]);
    if (contentChanged) {
      // Fotos/descrição mudaram no WMS: redesenha a peça (cai no fluxo completo abaixo), sem trocar de tela
      opts = { ...opts, silentFull: true };
    } else {
      currentProduct = product;
      if (sig === oldSig) return;
    const sPrice = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
    const sInStock = product.inStock !== false && (product.stockQty == null || product.stockQty > 0);
    const sMax = sInStock ? (product.stockQty > 0 ? product.stockQty : 99) : 0;
    const pixEl = document.getElementById('detailPixPrice');
    const regEl = document.getElementById('detailPrice');
    const instEl = document.getElementById('detailInstallment');
    if (pixEl) pixEl.textContent = money(sPrice * (1 - (PIX_DISCOUNT_RATE || 0.04)));
    if (regEl) regEl.textContent = money(sPrice);
    if (instEl) instEl.textContent = `em até 12x de ${money(sPrice > 0 ? sPrice / 12 : 0)} sem juros`;
    const specStock = document.getElementById('specStock');
    if (specStock) specStock.textContent = sInStock ? 'Disponível para pronta entrega' : 'Sob consulta';
    const addBtn = document.getElementById('detailAddCartBtn');
    if (addBtn) {
      addBtn.disabled = !sInStock;
      addBtn.style.opacity = sInStock ? '1' : '.5';
      addBtn.style.cursor = sInStock ? 'pointer' : 'not-allowed';
      addBtn.textContent = sInStock ? '🛒 COLOCAR NO CARRINHO' : 'FORA DE ESTOQUE';
    }
    const buyBtn = document.getElementById('detailBuyNowBtn');
    if (buyBtn) {
      buyBtn.disabled = !sInStock;
      buyBtn.style.display = sInStock ? 'inline-block' : 'none';
    }
    const qIn = document.getElementById('detailQtyInput');
    if (qIn) {
      qIn.max = sMax;
      if ((parseInt(qIn.value, 10) || 1) > sMax && sMax > 0) qIn.value = sMax;
    }
    return;
    }
  }

  currentProduct = product;
  const priceVal = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
  const pixPrice = priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04));
  const installmentVal = priceVal > 0 ? (priceVal / 12) : 0;
  const inStock = product.inStock !== false && (product.stockQty == null || product.stockQty > 0);
  const stockQty = product.stockQty || 0;
  const maxQty = inStock ? (stockQty > 0 ? stockQty : 99) : 0;

  // Breadcrumbs e Títulos
  const crumbCat = document.getElementById('detailBreadcrumbCat');
  const crumbName = document.getElementById('detailBreadcrumbName');
  if (crumbCat) {
    crumbCat.textContent = product.category || 'Peças';
    crumbCat.style.cursor = 'pointer';
    crumbCat.onclick = () => {
      if (product.category) goToCategory(product.category);
      else show('pecas');
    };
  }
  if (crumbName) crumbName.textContent = product.name;

  const catBadge = document.getElementById('detailCategoryBadge');
  const codeBadge = document.getElementById('detailCodeBadge');
  if (catBadge) catBadge.textContent = product.category || 'Geral';
  if (codeBadge) codeBadge.textContent = `Cód: #${product.code || ('FP-00' + product.id)}`;

  const titleEl = document.getElementById('detailTitle');
  const subtitleEl = document.getElementById('detailSubtitle');
  if (titleEl) titleEl.textContent = product.name;
  if (subtitleEl) subtitleEl.textContent = product.description || 'Aplicação compatível e procedência certificada com garantia.';

  // Imagens e Galeria de Fotos (suporte a quantidade ilimitada de imagens)
  const allPhotos = extractLojaPhotos(product);
  const photosToRender = allPhotos.length ? allPhotos : [LOJA_NO_PHOTO_SVG];
  
  const track = document.getElementById('gallerySlidesTrack');
  if (track) {
    track.innerHTML = photosToRender.map((pUrl, idx) => `
      <div class="gallery-slide" data-slide-index="${idx}" style="cursor:zoom-in;">
        <div class="slide-img-wrap" style="cursor:zoom-in;" title="Clique para ver a imagem inteira e dar zoom" onclick="if (typeof openLightbox === 'function') openLightbox();">
          <img ${idx === 0 ? 'id="detailMainImg"' : ''} class="detail-gallery-img" src="${pUrl}" alt="${product.name} - Foto ${idx + 1}" loading="${idx === 0 ? 'eager' : 'lazy'}" draggable="false" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
        </div>
      </div>
    `).join('');
  }

  const dotsRow = document.getElementById('galleryDotsRow');
  if (dotsRow) {
    if (photosToRender.length > 1) {
      dotsRow.innerHTML = photosToRender.map((_, i) => `<span class="g-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('');
      dotsRow.style.display = 'flex';
    } else {
      dotsRow.innerHTML = '';
      dotsRow.style.display = 'none';
    }
  }

  const thumbsRow = document.getElementById('galleryThumbsRow');
  if (thumbsRow) {
    if (photosToRender.length > 1) {
      thumbsRow.innerHTML = photosToRender.map((pUrl, i) => `
        <button type="button" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Ver foto ${i + 1}" title="Foto ${i + 1}">
          <img src="${pUrl}" alt="Miniatura ${i + 1}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
        </button>
      `).join('');
      thumbsRow.style.display = 'flex';
    } else {
      thumbsRow.innerHTML = '';
      thumbsRow.style.display = 'none';
    }
  }

  const prevBtn = document.getElementById('galleryPrevBtn');
  const nextBtn = document.getElementById('galleryNextBtn');
  if (prevBtn && nextBtn) {
    prevBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
  }

  const counterEl = document.getElementById('detailSlideCounter');
  if (counterEl) {
    counterEl.textContent = `1 / ${photosToRender.length}`;
    counterEl.style.display = photosToRender.length > 1 ? 'inline-block' : 'none';
  }

  const lbPrevBtn = document.getElementById('lbPrevBtn');
  const lbNextBtn = document.getElementById('lbNextBtn');
  if (lbPrevBtn && lbNextBtn) {
    lbPrevBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
    lbNextBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
  }

  const mainImg = document.getElementById('detailMainImg');
  const lbImg = document.getElementById('lightboxImg');
  const lbTitle = document.getElementById('lightboxTitle');
  if (mainImg) {
    mainImg.src = photosToRender[0];
    mainImg.alt = product.name;
  }
  if (lbImg) lbImg.src = photosToRender[0];
  if (lbTitle) lbTitle.textContent = `${product.name} - Inspeção em Alta Resolução`;

  // Ações de Botões e Estoque
  const addCartBtn = document.getElementById('detailAddCartBtn');
  const buyNowBtn = document.getElementById('detailBuyNowBtn');
  if (addCartBtn) {
    addCartBtn.disabled = !inStock;
    addCartBtn.style.opacity = inStock ? '1' : '.5';
    addCartBtn.style.cursor = inStock ? 'pointer' : 'not-allowed';
    addCartBtn.textContent = inStock ? '🛒 COLOCAR NO CARRINHO' : 'FORA DE ESTOQUE';
  }
  if (buyNowBtn) {
    buyNowBtn.disabled = !inStock;
    buyNowBtn.style.display = inStock ? 'inline-block' : 'none';
  }

  // Preço e Parcelamento
  const pixEl = document.getElementById('detailPixPrice');
  const regEl = document.getElementById('detailPrice');
  const instEl = document.getElementById('detailInstallment');
  if (pixEl) pixEl.textContent = money(pixPrice);
  if (regEl) regEl.textContent = money(priceVal);
  if (instEl) instEl.textContent = `em até 12x de ${money(installmentVal)} sem juros`;

  // Seletor de Quantidade
  const qtyInput = document.getElementById('detailQtyInput');
  const qtySubtotal = document.getElementById('detailQtySubtotal');
  if (qtyInput) {
    qtyInput.value = 1;
    qtyInput.max = maxQty;
  }
  function updateDetailSubtotal() {
    const q = parseInt(qtyInput?.value, 10) || 1;
    if (qtySubtotal) qtySubtotal.textContent = `Total: ${money(priceVal * q)}`;
  }
  updateDetailSubtotal();

  const minusBtn = document.getElementById('detailQtyMinus');
  const plusBtn = document.getElementById('detailQtyPlus');
  if (minusBtn && qtyInput) {
    minusBtn.onclick = () => {
      let q = parseInt(qtyInput.value, 10) || 1;
      if (q > 1) {
        qtyInput.value = q - 1;
        updateDetailSubtotal();
      }
    };
  }
  if (plusBtn && qtyInput) {
    plusBtn.onclick = () => {
      let q = parseInt(qtyInput.value, 10) || 1;
      if (q < maxQty) {
        qtyInput.value = q + 1;
        updateDetailSubtotal();
      }
    };
  }

  // Ações de Carrinho
  if (addCartBtn) {
    addCartBtn.onclick = () => {
      if (!inStock) return;
      const q = parseInt(qtyInput?.value, 10) || 1;
      addToCart(product.id, [product], q, addCartBtn);
    };
  }
  if (buyNowBtn) {
    buyNowBtn.onclick = () => {
      if (!inStock) return;
      const q = parseInt(qtyInput?.value, 10) || 1;
      addToCart(product.id, [product], q, buyNowBtn);
      show('carrinho');
    };
  }

  // Link para WhatsApp com mensagem personalizada
  const waLink = document.getElementById('detailWhatsAppLink');
  if (waLink) {
    const msg = `Olá! Gostaria de tirar uma dúvida sobre a peça ${product.name} (Código: ${product.code || product.id}).`;
    waLink.href = `https://wa.me/5519994755798?text=${encodeURIComponent(msg)}`;
  }

  // Descrição Técnica Completa
  const fullDesc = document.getElementById('detailFullDescription');
  if (fullDesc) {
    fullDesc.innerHTML = `
      <p style="font-size:15px;line-height:1.6;color:var(--fp-e1e4ea)">
        ${product.description ? product.description : `A peça <strong>${product.name}</strong> é desenvolvida atendendo aos mais rigorosos padrões de qualidade e especificações técnicas de montadoras automotivas.`}
      </p>
      <p style="margin-top:12px;color:var(--fp-9da2aa);line-height:1.5">
        Item essencial para o correto funcionamento e durabilidade do veículo. Proporciona alto rendimento, durabilidade prolongada e encaixe preciso de fábrica sem necessidade de adaptações.
      </p>
      <div style="margin-top:16px;padding:12px 14px;background:var(--fp-14171e);border-left:3px solid #ed1c24;border-radius:6px;font-size:13.5px;color:var(--fp-cbd0d8)">
        <strong style="color:var(--fp-fff)">⚠️ Recomendação de Instalação:</strong> Para garantir a segurança e a validade da garantia de 90 dias com Nota Fiscal, a instalação deve ser realizada por um profissional ou centro automotivo especializado.
      </div>
    `;
  }

  const specName = document.getElementById('specName');
  const specCode = document.getElementById('specCode');
  const specCat = document.getElementById('specCategory');
  const specStock = document.getElementById('specStock');
  if (specName) specName.textContent = product.name;
  if (specCode) specCode.textContent = product.code || `#FP-${product.id}`;
  if (specCat) specCat.textContent = product.category || 'Geral';
  if (specStock) specStock.textContent = inStock ? 'Disponível para pronta entrega' : 'Sob consulta';

  // Aplicação e Compatibilidade Veicular Detalhada
  const compatBody = document.getElementById('detailCompatibility');
  if (compatBody) {
    const hasCustomCompat = Boolean(product.compatibility && product.compatibility.trim());
    compatBody.innerHTML = `
      <div class="fp-compat-header" style="margin-bottom:18px">
        <h3 style="font-size:17px;color:var(--fp-fff);margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <span>🚗</span> Aplicação e Veículos Compatíveis
        </h3>
        <p style="color:var(--fp-9da2aa);font-size:13.5px">
          ${hasCustomCompat 
            ? 'Esta peça possui as seguintes aplicações veiculares e modelos compatíveis homologados:'
            : 'Aplicações compatíveis com as linhas de montadoras que utilizam esta especificação:'}
        </p>
      </div>

      <div class="fp-compat-detail-box" style="background:var(--fp-111319);border:1px solid var(--fp-292d37);border-radius:12px;padding:18px;margin-bottom:18px">
        ${hasCustomCompat ? `
          <div style="white-space:pre-line;color:var(--fp-f0f2f5);font-size:14.5px;line-height:1.7;font-weight:500">
            ${product.compatibility.trim()}
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px">
            <div>
              <span style="color:var(--fp-8e949c);font-size:11.5px;text-transform:uppercase;display:block">Referência / Código:</span>
              <strong style="color:var(--fp-fff);font-size:14.5px">${product.code || ('FP-00' + product.id)}</strong>
            </div>
            <div>
              <span style="color:var(--fp-8e949c);font-size:11.5px;text-transform:uppercase;display:block">Sistema do Veículo:</span>
              <strong style="color:var(--fp-fff);font-size:14.5px">${product.category || 'Peças Automotivas'}</strong>
            </div>
            <div>
              <span style="color:var(--fp-8e949c);font-size:11.5px;text-transform:uppercase;display:block">Padrão de Fabricação:</span>
              <strong style="color:#3fb950;font-size:14.5px">Encaixe Original 100% Plug & Play</strong>
            </div>
          </div>
          <p style="margin-top:14px;color:var(--fp-a0a5ae);font-size:13px;border-top:1px solid var(--fp-20242e);padding-top:12px">
            Peça de primeira linha compatível com montadoras que adotam este padrão. Ao cadastrar novas peças ou atualizá-las no painel administrativo, os detalhes de modelos, motorizações e anos compatíveis serão listados aqui.
          </p>
        `}
      </div>

      <div class="fp-compat-cta" style="background:var(--fp-141720);border-left:4px solid #ed1c24;border-radius:8px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <strong style="color:var(--fp-fff);font-size:14px;display:block">Dúvida sobre o chassi, motor ou ano do seu carro?</strong>
          <span style="color:var(--fp-9da2aa);font-size:12.5px">Nossa equipe confirma na hora pelo catálogo técnico da montadora.</span>
        </div>
        <a href="https://wa.me/5519994755798?text=${encodeURIComponent('Olá! Gostaria de confirmar a compatibilidade da peça ' + product.name + ' (Código: ' + (product.code || product.id) + ') com o modelo do meu carro.')}" target="_blank" rel="noopener" style="background:#238636;color:var(--fp-fff);padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:background .15s">
          <span>💬</span> Confirmar no WhatsApp
        </a>
      </div>
    `;
  }

  // Reseta a galeria para a primeira foto SOMENTE se for uma peça diferente da anterior
  const isDifferentProduct = !window.__lastRenderedProdId || String(window.__lastRenderedProdId) !== String(product.id);
  window.__lastRenderedProdId = product.id;
  if (isDifferentProduct) {
    if (typeof window.resetProductGallery === 'function') {
      window.resetProductGallery();
    } else if (typeof window.resetViewer === 'function') {
      window.resetViewer();
    }
  }

  // Atualiza texto de compatibilidade no slide 2 da galeria
  const slideCompat = document.getElementById('slideCompatText');
  if (slideCompat) {
    if (product.compatibility && product.compatibility.trim()) {
      slideCompat.textContent = `Compatível com: ${product.compatibility}`;
    } else {
      slideCompat.textContent = `Compatível com padrão original da montadora para ${product.category || 'este veículo'}. Consulte a tabela completa abaixo.`;
    }
  }

  // Salva no sessionStorage para que F5 / reload nunca perca a peça ativa
  try {
    sessionStorage.setItem('fahren-last-product-id', String(product.id));
  } catch {}

  // Navega para a tela do produto SOMENTE se push for true OU se o usuário já estiver na tela de produto
  if (!opts.silent && (push || (typeof currentScreenId !== 'undefined' && currentScreenId === 'produto'))) {
    show('produto', { push, scrollTop: push === true });
    if (push) {
      window.history.replaceState({ screen: 'produto', depth: navDepth, productId: product.id, category: activeCatalogCategory || '' }, '', '#produto/' + product.id);
    }
    loadRecommendedProducts(product);
  }
}

// Inicializador da Galeria de Fotos e Detalhes Deslizável por Arrastar/Toque
function initProductViewer() {
  const slider = document.getElementById('gallerySlider');
  const track = document.getElementById('gallerySlidesTrack');
  const prevBtn = document.getElementById('galleryPrevBtn');
  const nextBtn = document.getElementById('galleryNextBtn');
  const dotsRow = document.getElementById('galleryDotsRow');
  const thumbsRow = document.getElementById('galleryThumbsRow');
  const counter = document.getElementById('detailSlideCounter');
  const badgeText = document.getElementById('viewerBadgeText');
  const zoomBtn = document.getElementById('galleryZoomBtn');
  const lbPrevBtn = document.getElementById('lbPrevBtn');
  const lbNextBtn = document.getElementById('lbNextBtn');

  if (!slider || !track) return;

  let currentSlide = 0;
  let startX = 0;
  let isDragging = false;

  function updateGallery(index) {
    const slides = track.querySelectorAll('.gallery-slide');
    const total = Math.max(1, slides.length);
    currentSlide = (index + total) % total;
    track.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    const lbImg = document.getElementById('lightboxImg');
    const activeSlideImg = slides[currentSlide]?.querySelector('img');
    if (lbImg && activeSlideImg) {
      lbImg.src = activeSlideImg.src;
    }

    if (counter) {
      counter.textContent = `${currentSlide + 1} / ${total}`;
      counter.style.display = total > 1 ? 'inline-block' : 'none';
    }
    if (dotsRow) {
      dotsRow.querySelectorAll('.g-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentSlide);
      });
      dotsRow.style.display = total > 1 ? 'flex' : 'none';
    }
    if (thumbsRow) {
      thumbsRow.querySelectorAll('.gallery-thumb').forEach((th, i) => {
        th.classList.toggle('active', i === currentSlide);
      });
      thumbsRow.style.display = total > 1 ? 'flex' : 'none';
    }
    if (prevBtn && nextBtn) {
      prevBtn.style.display = total > 1 ? 'flex' : 'none';
      nextBtn.style.display = total > 1 ? 'flex' : 'none';
    }
    if (lbPrevBtn && lbNextBtn) {
      lbPrevBtn.style.display = total > 1 ? 'flex' : 'none';
      lbNextBtn.style.display = total > 1 ? 'flex' : 'none';
    }

    if (badgeText) {
      if (total > 1) {
        badgeText.textContent = `Foto ${currentSlide + 1} de ${total} • Arraste para navegar`;
      } else {
        badgeText.textContent = 'Inspeção técnica em alta resolução';
      }
    }
  }

  window.updateProductGallery = updateGallery;
  window.resetProductGallery = function() {
    updateGallery(0);
  };
  window.resetViewer = window.resetProductGallery;

  // Gerenciador de Inatividade para ocultar setas de navegação (Modo Imersivo)
  let navBtnsTimer = null;
  function showNavButtonsTemporarily() {
    [prevBtn, nextBtn, lbPrevBtn, lbNextBtn].forEach(b => b?.classList.remove('autohide'));
    if (navBtnsTimer) clearTimeout(navBtnsTimer);
    navBtnsTimer = setTimeout(() => {
      [prevBtn, nextBtn, lbPrevBtn, lbNextBtn].forEach(b => b?.classList.add('autohide'));
    }, 2800);
  }

  // Qualquer interação com o slider ou lightbox exibe as setas temporariamente
  ['mousemove', 'touchstart', 'touchmove', 'click'].forEach(evt => {
    slider?.addEventListener(evt, showNavButtonsTemporarily, { passive: true });
    document.getElementById('detailLightboxModal')?.addEventListener(evt, showNavButtonsTemporarily, { passive: true });
  });
  showNavButtonsTemporarily();

  prevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide - 1 + total) % total);
  });

  nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide + 1) % total);
  });

  dotsRow?.addEventListener('click', (e) => {
    const dot = e.target.closest('.g-dot');
    if (dot && dot.dataset.index != null) {
      updateGallery(parseInt(dot.dataset.index, 10));
    }
  });

  thumbsRow?.addEventListener('click', (e) => {
    const thumb = e.target.closest('.gallery-thumb');
    if (thumb && thumb.dataset.index != null) {
      updateGallery(parseInt(thumb.dataset.index, 10));
    }
  });

  lbPrevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide - 1 + total) % total);
  });

  lbNextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide + 1) % total);
  });

  // Touch & Mouse Dragging manual e suave
  function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  }

  let touchMoved = false;
  let touchStartTime = 0;
  let startY = 0;

  function touchStart(e) {
    touchMoved = false;
    touchStartTime = Date.now();
    const slides = track.querySelectorAll('.gallery-slide');
    if (e.touches && e.touches.length > 1) {
      isDragging = false;
      return;
    }
    isDragging = true;
    startX = getPositionX(e);
    startY = e.touches && e.touches[0] ? e.touches[0].clientY : (e.clientY || 0);
    track.style.transition = 'none';
  }

  function touchMove(e) {
    if (!isDragging) return;
    const currentX = getPositionX(e);
    const currentY = e.touches && e.touches[0] ? e.touches[0].clientY : (e.clientY || 0);
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
      touchMoved = true;
    }

    const slides = track.querySelectorAll('.gallery-slide');
    if (slides.length <= 1) return;

    // Se estiver deslizando para os lados, cancela o scroll vertical para resposta imediata
    if (Math.abs(diffX) > Math.abs(diffY) && e.cancelable) {
      e.preventDefault();
    }

    const offset = -currentSlide * slider.offsetWidth + diffX;
    track.style.transform = `translateX(${offset}px)`;
  }

  function touchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.type.includes('mouse') ? e.pageX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : startX);
    const endY = e.type.includes('mouse') ? e.pageY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : startY);
    const diff = endX - startX;
    const diffY = endY - startY;
    const elapsed = Date.now() - touchStartTime;

    // Toque/Clique no Mobile ou Desktop (sem arraste longo): ENTRA IMEDIATAMENTE NA IMAGEM INTEIRA COM ZOOM
    if (!touchMoved && Math.abs(diff) < 14 && Math.abs(diffY) < 14 && elapsed < 650) {
      if (typeof openLightbox === 'function') {
        openLightbox();
        return;
      }
    }

    const slides = track.querySelectorAll('.gallery-slide');
    if (slides.length <= 1) return;

    if (diff < -35) {
      updateGallery((currentSlide + 1) % slides.length);
    } else if (diff > 35) {
      updateGallery((currentSlide - 1 + slides.length) % slides.length);
    } else {
      updateGallery(currentSlide);
    }
  }

  slider.addEventListener('touchstart', touchStart, { passive: true });
  slider.addEventListener('touchmove', touchMove, { passive: false });
  slider.addEventListener('touchend', touchEnd);
  slider.addEventListener('touchcancel', () => {
    isDragging = false;
    updateGallery(currentSlide);
  });

  thumbsRow?.addEventListener('touchstart', (e) => {
    const thumb = e.target.closest('.gallery-thumb');
    if (thumb && thumb.dataset.index != null) {
      updateGallery(parseInt(thumb.dataset.index, 10));
    }
  }, { passive: true });

  slider.addEventListener('mousedown', (e) => {
    touchStart(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (isDragging) touchMove(e);
  });
  window.addEventListener('mouseup', (e) => {
    if (isDragging) touchEnd(e);
  });

  zoomBtn?.addEventListener('click', () => {
    const modal = document.getElementById('detailLightboxModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (typeof window.resetLbPan === 'function') window.resetLbPan();
    }
  });

  // Lightbox Modal para tela cheia com movimentação livre por toque ou mouse
  const modal = document.getElementById('detailLightboxModal');
  const lbOverlay = document.getElementById('lightboxOverlay');
  const lbClose = document.getElementById('lightboxClose');
  const lbImg = document.getElementById('lightboxImg');
  const lbViewport = document.getElementById('lightboxViewport');
  const lbZoomIn = document.getElementById('lbZoomIn');
  const lbZoomOut = document.getElementById('lbZoomOut');
  const lbResetPan = document.getElementById('lbResetPan');
  const lbZoomLevel = document.getElementById('lbZoomLevel');

  let lbScale = 1.0;
  let lbPanX = 0;
  let lbPanY = 0;
  let targetScale = 1.0;
  let targetPanX = 0;
  let targetPanY = 0;
  let isZoomAnimating = false;
  let lbDragging = false;
  let lbStartX = 0;
  let lbStartY = 0;
  let initialPinchDist = 0;
  let initialPinchScale = 1.0;
  let lastTapTime = 0;

  function updateLbTransform() {
    if (lbImg) {
      lbImg.style.transform = `translate3d(${lbPanX}px, ${lbPanY}px, 0px) scale(${lbScale})`;
    }
    if (lbZoomLevel) {
      lbZoomLevel.textContent = `${lbScale.toFixed(1)}x`;
    }
  }

  function syncZoomTargets() {
    targetScale = lbScale;
    targetPanX = lbPanX;
    targetPanY = lbPanY;
    isZoomAnimating = false;
  }

  // Loop de animação contínua (Lerp 60/120 FPS) para zoom fluido sem travamento
  function runZoomSpringLoop() {
    if (!isZoomAnimating) return;

    const lerpFactor = 0.22;
    const dScale = targetScale - lbScale;
    const dPanX = targetPanX - lbPanX;
    const dPanY = targetPanY - lbPanY;

    if (Math.abs(dScale) < 0.001 && Math.abs(dPanX) < 0.2 && Math.abs(dPanY) < 0.2) {
      lbScale = targetScale;
      lbPanX = targetPanX;
      lbPanY = targetPanY;
      updateLbTransform();
      isZoomAnimating = false;
      return;
    }

    lbScale += dScale * lerpFactor;
    lbPanX += dPanX * lerpFactor;
    lbPanY += dPanY * lerpFactor;
    updateLbTransform();
    requestAnimationFrame(runZoomSpringLoop);
  }

  let isLightboxOpen = false;

  function openLightbox() {
    if (modal) {
      modal.style.display = 'flex';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      lbScale = 1.0;
      lbPanX = 0;
      lbPanY = 0;
      syncZoomTargets();
      updateLbTransform();
      isLightboxOpen = true;
      try {
        const prodId = currentProduct ? currentProduct.id : null;
        window.history.pushState({ modal: 'lightbox', screen: 'produto', productId: prodId, depth: navDepth + 1 }, '');
      } catch (_) {}
    }
  }

  function closeLightbox(fromPopState = false) {
    if (modal) modal.style.display = 'none';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    lbDragging = false;
    isZoomAnimating = false;
    lbViewport?.classList.remove('is-dragging');

    if (isLightboxOpen) {
      isLightboxOpen = false;
      // Ao fechar pelo botão X ou overlay (sem popstate), remove o estado modal: 'lightbox'
      // com replaceState garantindo que o usuário PERMANEÇA na tela do produto e NUNCA vá para a tela inicial!
      if (!fromPopState && window.history.state && window.history.state.modal === 'lightbox') {
        try {
          const prodId = currentProduct ? currentProduct.id : null;
          window.history.replaceState({ screen: 'produto', depth: navDepth, productId: prodId }, '', prodId ? ('#produto/' + prodId) : '#pecas');
        } catch (_) {}
      }
    }
  }

  // Zoom contínuo ultra-fluido e instantâneo (0ms delay) com a rodinha do mouse (Desktop)
  let lbRafPending = false;
  const handleLbWheelZoom = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomStep = 1.18;
    const prevScale = lbScale;
    let newScale = e.deltaY < 0 ? (prevScale * zoomStep) : (prevScale / zoomStep);
    newScale = Math.min(6.0, Math.max(1.0, newScale));

    if (newScale === prevScale) return;

    if (newScale <= 1.01) {
      lbScale = 1.0;
      lbPanX = 0;
      lbPanY = 0;
    } else if (lbViewport) {
      const rect = lbViewport.getBoundingClientRect();
      const originX = e.clientX - rect.left - rect.width / 2;
      const originY = e.clientY - rect.top - rect.height / 2;
      const k = 1 - (newScale / prevScale);
      lbPanX += (originX - lbPanX) * k;
      lbPanY += (originY - lbPanY) * k;
      lbScale = newScale;
    } else {
      lbScale = newScale;
    }

    syncZoomTargets();
    updateLbTransform();
  };

  modal?.addEventListener('wheel', handleLbWheelZoom, { passive: false });

  // Duplo clique rápido no Lightbox para alternar zoom instantâneo (1.0x <-> 2.5x)
  lbViewport?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (lbScale > 1.2) {
      lbScale = 1.0;
      lbPanX = 0;
      lbPanY = 0;
    } else {
      const rect = lbViewport.getBoundingClientRect();
      const originX = e.clientX - rect.left - rect.width / 2;
      const originY = e.clientY - rect.top - rect.height / 2;
      const newScale = 2.5;
      const k = 1 - newScale;
      lbPanX = originX * k;
      lbPanY = originY * k;
      lbScale = newScale;
    }
    syncZoomTargets();
    updateLbTransform();
  });

  // Swipe para navegar fotos no Lightbox em tela cheia no mobile
  let lbTouchStartX = 0;
  let lbTouchStartY = 0;
  let lbTouchSwiped = false;

  lbViewport?.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1 && lbScale <= 1.05) {
      lbTouchStartX = e.touches[0].clientX;
      lbTouchStartY = e.touches[0].clientY;
      lbTouchSwiped = false;
    }
  }, { passive: true });

  lbViewport?.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length === 1 && lbScale <= 1.05) {
      const diffX = e.touches[0].clientX - lbTouchStartX;
      const diffY = e.touches[0].clientY - lbTouchStartY;
      if (Math.abs(diffX) > 20 && Math.abs(diffX) > Math.abs(diffY)) {
        lbTouchSwiped = true;
      }
    }
  }, { passive: true });

  lbViewport?.addEventListener('touchend', (e) => {
    if (!lbTouchSwiped || lbScale > 1.05 || !e.changedTouches || !e.changedTouches[0]) return;
    const diffX = e.changedTouches[0].clientX - lbTouchStartX;
    const trackEl = document.getElementById('gallerySlidesTrack');
    const totalSlides = trackEl ? trackEl.querySelectorAll('.gallery-slide').length : 1;
    if (totalSlides <= 1) return;
    if (diffX < -35) {
      if (typeof window.updateProductGallery === 'function') {
        window.updateProductGallery((currentSlide + 1) % totalSlides);
      }
    } else if (diffX > 35) {
      if (typeof window.updateProductGallery === 'function') {
        window.updateProductGallery((currentSlide - 1 + totalSlides) % totalSlides);
      }
    }
  });

  window.openLightbox = openLightbox;
  window.closeLightbox = closeLightbox;

  document.getElementById('ctrlFullscreen')?.addEventListener('click', openLightbox);
  document.getElementById('galleryZoomBtn')?.addEventListener('click', openLightbox);
  document.getElementById('detailMainImg')?.addEventListener('click', openLightbox);
  document.querySelector('.slide-img-wrap')?.addEventListener('click', openLightbox);

  // Clique na foto principal da galeria abre imediatamente o Lightbox em tela cheia com zoom
  const gallerySliderEl = document.getElementById('gallerySlider');
  if (gallerySliderEl && !gallerySliderEl.__lbBound) {
    gallerySliderEl.__lbBound = true;
    gallerySliderEl.addEventListener('click', (e) => {
      if (e.target.closest('#galleryPrevBtn, #galleryNextBtn, .gallery-nav-btn, .gallery-thumb, #galleryThumbsRow, .g-dot, #galleryDotsRow')) return;
      openLightbox();
    });
  }

  const galleryTrackEl = document.getElementById('gallerySlidesTrack');
  if (galleryTrackEl && !galleryTrackEl.__lbBound) {
    galleryTrackEl.__lbBound = true;
    galleryTrackEl.addEventListener('click', (e) => {
      if (e.target.closest('#galleryPrevBtn, #galleryNextBtn, .gallery-nav-btn')) return;
      openLightbox();
    });
  }
  lbOverlay?.addEventListener('click', () => closeLightbox(false));
  lbClose?.addEventListener('click', () => closeLightbox(false));

  // Controles de Zoom fino de 0.1 em 0.1 (1.0 -> 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 ...)
  lbZoomIn?.addEventListener('click', () => {
    if (lbScale < 5.0) {
      lbScale = Math.min(5.0, Math.round((lbScale + 0.1) * 10) / 10);
      syncZoomTargets();
      updateLbTransform();
    }
  });

  lbZoomOut?.addEventListener('click', () => {
    if (lbScale > 1.0) {
      lbScale = Math.max(1.0, Math.round((lbScale - 0.1) * 10) / 10);
      syncZoomTargets();
      updateLbTransform();
    }
  });

  lbResetPan?.addEventListener('click', () => {
    lbScale = 1.0;
    lbPanX = 0;
    lbPanY = 0;
    syncZoomTargets();
    updateLbTransform();
  });

  // Movimentação livre com Mouse (Desktop)
  if (lbViewport) {
    lbViewport.addEventListener('mousedown', (e) => {
      e.preventDefault();
      syncZoomTargets();
      lbDragging = true;
      lbStartX = e.clientX - lbPanX;
      lbStartY = e.clientY - lbPanY;
      lbViewport.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!lbDragging || lbScale <= 1.05) return;
      lbPanX = e.clientX - lbStartX;
      lbPanY = e.clientY - lbStartY;
      if (!lbRafPending) {
        lbRafPending = true;
        requestAnimationFrame(() => {
          updateLbTransform();
          lbRafPending = false;
        });
      }
    });

    window.addEventListener('mouseup', () => {
      if (lbDragging) {
        lbDragging = false;
        lbViewport.classList.remove('is-dragging');
      }
    });

    // Zoom a mão com 2 dedos (Pinch-to-zoom) e duplo toque para aproximar/afastar
    lbViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lbDragging = false;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchScale = lbScale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 320) {
          // Duplo toque com a mão: alterna entre 1.0x e 2.0x
          if (lbScale > 1.1) {
            lbScale = 1.0;
            lbPanX = 0;
            lbPanY = 0;
          } else {
            lbScale = 1.5;
          }
          updateLbTransform();
          lastTapTime = 0;
          return;
        }
        lastTapTime = now;
        lbDragging = true;
        lbStartX = e.touches[0].clientX - lbPanX;
        lbStartY = e.touches[0].clientY - lbPanY;
        lbViewport.classList.add('is-dragging');
      }
    }, { passive: true });

    lbViewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = currentDist / initialPinchDist;
        lbScale = Math.min(5.0, Math.max(1.0, Math.round(initialPinchScale * delta * 10) / 10));
        updateLbTransform();
      } else if (e.touches.length === 1 && lbDragging) {
        if (lbScale > 1.05) {
          lbPanX = e.touches[0].clientX - lbStartX;
          lbPanY = e.touches[0].clientY - lbStartY;
          updateLbTransform();
        } else {
          // Em 1.0x (tamanho normal), a foto fica SEMPRE CENTRALIZADA e fixa, sem se mover pela tela
          lbPanX = 0;
          lbPanY = 0;
        }
      }
    }, { passive: true });

    lbViewport.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) initialPinchDist = 0;
      if (e.touches.length === 0) {
        lbDragging = false;
        lbViewport.classList.remove('is-dragging');
        if (lbScale <= 1.05) {
          lbPanX = 0;
          lbPanY = 0;
          syncZoomTargets();
          updateLbTransform();
        }
      }
    });
  }

  // Navegação por Abas
  document.querySelectorAll('.fp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fp-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.fp-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Botão de Voltar ao Catálogo — preserva a categoria ativa de onde o cliente veio (ex: Freios)
  document.getElementById('backToCatalogBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!activeCatalogCategory && typeof currentProduct !== 'undefined' && currentProduct && currentProduct.category) {
      activeCatalogCategory = normalizeCatalogCategory(currentProduct.category);
    }
    if (activeCatalogCategory) {
      show('pecas', { keepFilter: true });
    } else if (navDepth > 0) {
      window.history.back();
    } else {
      show('pecas');
    }
  });
  document.getElementById('crumbCatalogLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (activeCatalogCategory) {
      show('pecas', { keepFilter: true });
    } else {
      const catInput = document.getElementById('catalogSearch');
      if (catInput) catInput.value = '';
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) catSelect.value = '';
      show('pecas');
    }
  });
}

let catalogTimer = null;
let __catalogLoadSeq = 0;
async function loadCatalog() {
  const reqSeq = ++__catalogLoadSeq;
  const targetCategory = activeCatalogCategory || document.getElementById('filterCategory')?.value || '';
  const targetQ = document.getElementById('catalogSearch')?.value.trim() || '';
  await loadCategories();
  if (reqSeq !== __catalogLoadSeq) return;
  const container = document.getElementById('catalogResults');
  if (!container) return;

  const catBar = document.getElementById('activeCategoryBarCatalog');
  if (catBar) {
    catBar.style.display = 'flex';
  }
  const catBarBottom = document.getElementById('activeCategoryBarCatalogBottom');
  if (catBarBottom) {
    catBarBottom.style.display = 'flex';
  }

  const params = new URLSearchParams();
  const q = targetQ;
  const category = targetCategory;
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  params.set('_t', String(Date.now()));

  try {
    let prods = [];
    let apiFailed = false;
    try {
      const res = await api('/api/products?' + params.toString());
      if (reqSeq !== __catalogLoadSeq) return;
      if (res && Array.isArray(res.products)) prods = res.products;
    } catch (_) {
      apiFailed = true;
    }

    // Só recorre ao fallback local se a API estiver realmente offline/indisponível
    if (apiFailed && !prods.length && typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') {
      const qLower = (q || '').toLowerCase();
      const catNorm = normalizeCatalogCategory(category || '').toLowerCase();
      prods = CATALOG_FALLBACK_PRODUCTS.filter(p => {
        const pCat = normalizeCatalogCategory(p.category || '').toLowerCase();
        const pName = (p.name || '').toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        const pComp = (p.compatibility || '').toLowerCase();
        const pCode = (p.code || '').toLowerCase();

        const matchCat = !catNorm || pCat === catNorm;
        const matchQ = !qLower || pName.includes(qLower) || pDesc.includes(qLower) || pComp.includes(qLower) || pCode.includes(qLower) || pCat.includes(qLower);
        return matchCat && matchQ;
      });
    }

    if (reqSeq !== __catalogLoadSeq) return;

    // Garante que nenhuma peça fora da categoria selecionada apareça na tela
    if (category) {
      const targetNorm = normalizeCatalogCategory(category).toLowerCase();
      prods = prods.filter(p => normalizeCatalogCategory(p.category || '').toLowerCase() === targetNorm);
    }

    // Se houver peças reais cadastradas no WMS, oculta peças fictícias antigas (imagens estáticas de teste)
    const realProds = prods.filter(p => typeof isLojaRealWmsProduct === 'function' ? isLojaRealWmsProduct(p) : true);
    const finalProds = realProds.length > 0 ? realProds : prods;
    if (typeof window.syncHomeCategoryCardPhotos === 'function') {
      window.syncHomeCategoryCardPhotos(finalProds);
    }
    renderProducts(container, prioritizeRealProducts(finalProds));
  } catch (err) {
    container.__renderSig = null;
    container.innerHTML = `<p style="color:#e06a6a">Não foi possível carregar as peças agora. ${err.message}</p>`;
  }
}
['catalogSearch'].forEach(id => document.getElementById(id)?.addEventListener('input', () => { clearTimeout(catalogTimer); catalogTimer = setTimeout(loadCatalog, 300); }));
document.getElementById('filterCategory')?.addEventListener('change', loadCatalog);

/* =========================================================================
 * [MÓDULO: 06-payments-pix-and-card.js]
 * ========================================================================= */
// Módulo WMS: 06-payments-pix-and-card.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Pagamento via Pix (código "Copia e Cola" oficial, gerado aqui mesmo) ----------
// A chave Pix é pública para quem vai pagar (funciona como um número de conta
// para receber), por isso pode ficar no código do site sem problema.
const PIX_KEY = '47784317000120';
const PIX_MERCHANT_NAME = 'FAHREN MOTORS LTDA';
const PIX_MERCHANT_CITY = 'HORTOLANDIA';
const PIX_DISCOUNT_RATE = 0.04;

function pixStripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function pixTlv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function pixCrc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Monta o payload EMV/BR Code do Pix (padrão Banco Central) com valor fixo,
// pronto para o cliente colar no "Pix Copia e Cola" do banco dele.
function buildPixCode(amount) {
  const merchantAccount = pixTlv('26', pixTlv('00', 'BR.GOV.BCB.PIX') + pixTlv('01', PIX_KEY));
  const name = pixStripAccents(PIX_MERCHANT_NAME).slice(0, 25);
  const city = pixStripAccents(PIX_MERCHANT_CITY).slice(0, 15);
  const payload =
    pixTlv('00', '01') +
    merchantAccount +
    pixTlv('52', '0000') +
    pixTlv('53', '986') +
    pixTlv('54', amount.toFixed(2)) +
    pixTlv('58', 'BR') +
    pixTlv('59', name) +
    pixTlv('60', city) +
    pixTlv('62', pixTlv('05', '***')) +
    '6304';
  return payload + pixCrc16(payload);
}

// Gera o QR Code (SVG) a partir do código Pix, usando a biblioteca local vendor/qrcode.js.
function buildPixQrSvg(pixCode) {
  if (typeof qrcode === 'undefined') return null;
  for (let typeNumber = 4; typeNumber <= 40; typeNumber++) {
    try {
      const qr = qrcode(typeNumber, 'M');
      qr.addData(pixCode);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 8 });
    } catch { /* código não coube nesse tamanho, tenta o próximo */ }
  }
  return null;
}

// ---------- Pagamento com Cartão de Crédito (Mercado Pago Checkout Bricks) ----------
// O formulário do cartão é renderizado AQUI DENTRO do site (o cliente nunca sai
// da página); só o token do cartão (nunca o número em si) sai do navegador.
let mpSdkInstance = null;
let mpPublicKeyCache = null;
let cardBrickController = null;

async function getMpPublicKey() {
  if (mpPublicKeyCache !== null) return mpPublicKeyCache;
  try {
    const { publicKey } = await api('/api/payments/config');
    mpPublicKeyCache = publicKey || false;
  } catch {
    mpPublicKeyCache = false;
  }
  return mpPublicKeyCache;
}

async function mountCardBrick(amounts) {
  const container = document.getElementById('cardPaymentBrick');
  const statusEl = document.getElementById('cardPaymentStatus');
  if (!container) return;

  const publicKey = await getMpPublicKey();
  if (publicKey && typeof MercadoPago !== 'undefined') {
    if (cardBrickController && cardBrickController.unmount) {
      try { cardBrickController.unmount(); } catch { /* já desmontado */ }
    }
    container.innerHTML = '';

    try {
      if (!mpSdkInstance) mpSdkInstance = new MercadoPago(publicKey, { locale: 'pt-BR' });
      const bricksBuilder = mpSdkInstance.bricks();

      cardBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick', {
        initialization: { amount: amounts.subtotal },
        customization: { visual: { style: { theme: 'dark' } } },
        callbacks: {
          onReady: () => {},
          onError: (error) => {
            console.error(error);
            if (statusEl) { statusEl.textContent = 'Verifique os dados do cartão e tente novamente.'; statusEl.style.color = '#e06a6a'; statusEl.style.display = 'block'; }
          },
          onSubmit: (cardFormData) => new Promise(async (resolve, reject) => {
            if (statusEl) { statusEl.textContent = 'Processando pagamento...'; statusEl.style.color = '#9da2aa'; statusEl.style.display = 'block'; }
            try {
              const { address } = await api('/api/addresses/mine');
              if (!address) {
                alert('Cadastre seu endereço de entrega antes de finalizar o pedido.');
                show('endereco');
                return reject();
              }
              const { order } = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items, paymentMethod: 'cartao' }) });
              broadcastSync('ORDER_CREATED', { orderId: order.id });
              refreshLojaStockData();
              const result = await api('/api/payments/card', { method: 'POST', body: JSON.stringify({ orderId: order.id, ...cardFormData }) });

              if (result.status === 'approved') {
                if (statusEl) { statusEl.textContent = 'Pagamento aprovado!'; statusEl.style.color = '#39c979'; }
                cart = []; saveCart();
                alert('Pagamento aprovado! Seu pedido foi confirmado. Acompanhe o status na sua tela de Perfil.');
                show('perfil');
              } else if (result.status === 'in_process' || result.status === 'pending') {
                if (statusEl) { statusEl.textContent = 'Pagamento em análise. Você já pode acompanhar o pedido no seu Perfil.'; statusEl.style.color = '#e0b94a'; }
                cart = []; saveCart();
                show('perfil');
              } else {
                if (statusEl) { statusEl.textContent = 'Pagamento não aprovado. Verifique os dados do cartão ou tente outro cartão.'; statusEl.style.color = '#e06a6a'; }
              }
              resolve();
            } catch (err) {
              if (statusEl) { statusEl.textContent = err.message || 'Não foi possível processar o pagamento.'; statusEl.style.color = '#e06a6a'; statusEl.style.display = 'block'; }
              reject(err);
            }
          }),
        },
      });
      return;
    } catch (err) {
      console.warn('Falha ao instanciar Mercado Pago Brick, carregando formulário integrado:', err);
    }
  }

  // Se a chave pública não estiver configurada no .env ou o SDK não carregar,
  // renderiza o formulário de cartão completo da loja
  renderFallbackCardForm(amounts, container, statusEl);
}

function renderFallbackCardForm(amounts, container, statusEl) {
  if (cardBrickController && cardBrickController.unmount) {
    try { cardBrickController.unmount(); } catch { /* unmounted */ }
  }

  const subtotal = amounts.subtotal || 0;
  const installmentsCount = 12;
  let optionsHtml = '';
  for (let i = 1; i <= installmentsCount; i++) {
    const val = (subtotal / i).toFixed(2).replace('.', ',');
    optionsHtml += `<option value="${i}">${i}x de R$ ${val} sem juros</option>`;
  }

  container.innerHTML = `
    <div class="card-fallback-form" style="background:var(--fp-0c0e11);border:1px solid var(--fp-282b30);border-radius:14px;padding:20px;margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:12px;font-weight:700;color:var(--fp-9da2aa);text-transform:uppercase">Dados do Cartão de Crédito</span>
        <span id="detectedBrandBadge" style="background:var(--fp-202328);color:#39c979;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;border:1px solid var(--fp-34373d)">CARTÃO</span>
      </div>

      <div class="field" style="margin:12px 0">
        <label>Número do Cartão</label>
        <input id="customCardNumber" type="tel" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="cc-number" style="font-family:monospace;letter-spacing:1px" />
      </div>

      <div class="field" style="margin:12px 0">
        <label>Nome impresso no Cartão</label>
        <input id="customCardName" type="text" placeholder="Nome como impresso no cartão" autocomplete="cc-name" style="text-transform:uppercase" />
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field" style="margin:12px 0">
          <label>Validade (MM/AA)</label>
          <input id="customCardExpiry" type="tel" inputmode="numeric" placeholder="MM/AA" maxlength="5" autocomplete="cc-exp" />
        </div>
        <div class="field" style="margin:12px 0">
          <label>CVV (Código)</label>
          <input id="customCardCvv" type="password" inputmode="numeric" placeholder="123" maxlength="4" autocomplete="cc-csc" />
        </div>
      </div>

      <div class="field" style="margin:12px 0">
        <label>CPF do Titular</label>
        <input id="customCardCpf" type="tel" inputmode="numeric" placeholder="000.000.000-00" value="${(currentUser && currentUser.cpfCnpj) || ''}" />
      </div>

      <div class="field" style="margin:12px 0">
        <label>Opções de Parcelamento</label>
        <div style="margin-top:6px">
          <select id="customCardInstallments" style="width:100%;padding:14px;border-radius:10px;border:1px solid var(--fp-34373d);background:var(--fp-121418);color:var(--fp-fff);font-size:15px;cursor:pointer">
            ${optionsHtml}
          </select>
        </div>
      </div>

      <button class="btn" id="customCardSubmitBtn" type="button" style="width:100%;margin-top:16px;font-size:15px;padding:16px">
        PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO
      </button>

      <div style="margin-top:14px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--fp-8f949c);line-height:1.4">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#39c979;flex-shrink:0"></span>
        <span>Ambiente criptografado com SSL. Transação segura.</span>
      </div>
    </div>
  `;

  const numInput = document.getElementById('customCardNumber');
  const nameInput = document.getElementById('customCardName');
  const expInput = document.getElementById('customCardExpiry');
  const cvvInput = document.getElementById('customCardCvv');
  const cpfInput = document.getElementById('customCardCpf');
  const badge = document.getElementById('detectedBrandBadge');
  const submitBtn = document.getElementById('customCardSubmitBtn');

  function detectBrand(clean) {
    if (/^4/.test(clean)) return 'Visa';
    if (/^5[1-5]|^2[2-7]/.test(clean)) return 'Mastercard';
    if (/^4011|^4389|^4514|^4576|^5041|^5067|^5090|^6277|^6362|^6363|^650|^651|^655/.test(clean)) return 'Elo';
    if (/^3[47]/.test(clean)) return 'Amex';
    if (/^6062/.test(clean)) return 'Hipercard';
    return 'Cartão';
  }

  numInput?.addEventListener('input', () => {
    let val = numInput.value.replace(/\D/g, '').slice(0, 16);
    numInput.value = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    const brand = detectBrand(val);
    if (badge) badge.textContent = brand.toUpperCase();
  });

  expInput?.addEventListener('input', () => {
    let val = expInput.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) expInput.value = `${val.slice(0, 2)}/${val.slice(2)}`;
    else expInput.value = val;
  });

  cvvInput?.addEventListener('input', () => {
    cvvInput.value = cvvInput.value.replace(/\D/g, '').slice(0, 4);
  });

  cpfInput?.addEventListener('input', () => {
    let v = cpfInput.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    cpfInput.value = v;
  });

  submitBtn?.addEventListener('click', async () => {
    const rawNumber = numInput.value.replace(/\D/g, '');
    const name = nameInput.value.trim();
    const expiry = expInput.value.trim();
    const cvv = cvvInput.value.trim();
    const cpf = cpfInput.value.replace(/\D/g, '');
    const installments = parseInt(document.getElementById('customCardInstallments').value, 10) || 1;

    if (rawNumber.length < 13) {
      alert('Digite o número completo do cartão.');
      numInput.focus();
      return;
    }
    if (!name) {
      alert('Digite o nome impresso no cartão.');
      nameInput.focus();
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      alert('Digite a validade no formato MM/AA.');
      expInput.focus();
      return;
    }
    const [expMonth] = expiry.split('/').map(Number);
    if (expMonth < 1 || expMonth > 12) {
      alert('Mês de validade inválido (deve ser de 01 a 12).');
      expInput.focus();
      return;
    }
    if (cvv.length < 3) {
      alert('Digite o código de segurança (CVV).');
      cvvInput.focus();
      return;
    }

    if (statusEl) {
      statusEl.textContent = 'Processando pagamento com cartão...';
      statusEl.style.color = '#9da2aa';
      statusEl.style.display = 'block';
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'PROCESSANDO...';

    try {
      if (!authenticated) {
        alert('Cadastre-se ou entre na sua conta para finalizar o pedido.');
        show('cadastro');
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
        return;
      }
      const { address } = await api('/api/addresses/mine');
      if (!address) {
        alert('Cadastre seu endereço de entrega antes de finalizar o pedido.');
        show('endereco');
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
        return;
      }

      const items = cart.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ items, paymentMethod: 'cartao' }),
      });
      broadcastSync('ORDER_CREATED', { orderId: order.id });
      refreshLojaStockData();

      const cardBrand = detectBrand(rawNumber);
      const result = await api('/api/payments/card', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          cardNumber: rawNumber,
          cardBrand,
          lastFour: rawNumber.slice(-4),
          installments,
          payer: {
            email: (currentUser && currentUser.email) || 'cliente@fahrenparts.com.br',
            identification: { type: 'CPF', number: cpf || '00000000000' },
          },
        }),
      });

      if (result.status === 'approved' || result.statusInterno === 'aprovado') {
        if (statusEl) {
          statusEl.textContent = 'Pagamento aprovado com sucesso!';
          statusEl.style.color = '#39c979';
        }
        cart = [];
        saveCart();
        alert('Pagamento aprovado! Seu pedido foi confirmado no cartão. Acompanhe o status na tela de Perfil.');
        show('perfil');
      } else {
        alert(result.message || 'Pagamento não aprovado. Tente novamente.');
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
      }
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = err.message || 'Não foi possível processar o pagamento.';
        statusEl.style.color = '#e06a6a';
        statusEl.style.display = 'block';
      }
      alert(err.message || 'Erro ao processar pagamento.');
      submitBtn.disabled = false;
      submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
    }
  });
}

/* =========================================================================
 * [MÓDULO: 07-cart-and-orders.js]
 * ========================================================================= */
// Módulo WMS: 07-cart-and-orders.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Carrinho ----------
function getCartItemImage(i) {
  if (i && i.image) return normalizeLojaPhoto(i.image);
  if (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') {
    const found = CATALOG_FALLBACK_PRODUCTS.find(p => String(p.id) === String(i && i.productId));
    if (found) return getLojaPrimaryPhoto(found);
  }
  return typeof LOJA_NO_PHOTO_SVG !== 'undefined' ? LOJA_NO_PHOTO_SVG : '';
}

function addToCart(productId, productsList, quantity = 1, triggerBtn = null) {
  const product = (productsList || []).find(p => String(p.id) === String(productId));
  if (!product || !product.inStock) return;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const image = getLojaPrimaryPhoto(product);
  const existing = cart.find(i => String(i.productId) === String(productId));
  if (existing) {
    existing.quantity += qty;
    if (!existing.image && image) existing.image = image;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: qty,
      category: product.category || '',
      image: image || ''
    });
  }
  saveCart(false, true);

  // Feedback visual imediato no botão da peça sem sair da página
  if (triggerBtn) {
    const origHtml = triggerBtn.innerHTML;
    triggerBtn.innerHTML = `✓ Adicionado (${qty} un.)`;
    triggerBtn.classList.add('added-feedback');
    setTimeout(() => {
      triggerBtn.innerHTML = origHtml;
      triggerBtn.classList.remove('added-feedback');
    }, 1800);
  }

  // Notificação toast elegante permitindo continuar comprando ou entrar no carrinho
  showToast(`✓ ${qty}x "${product.name}" colocado no carrinho!`, () => show('carrinho'));
}

function getCartShareUrl() {
  try {
    const compact = cart.map(i => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image || ''
    }));
    const raw = encodeURIComponent(JSON.stringify(compact));
    const token = btoa(raw);
    const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://fahrenmotors.com.br';
    const path = window.location.pathname.includes('loja') ? window.location.pathname : '/loja/';
    return `${origin}${path}?cart=${token}#carrinho`;
  } catch (e) {
    return window.location.href;
  }
}

function openMobileSyncModal() {
  const shareUrl = getCartShareUrl();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;
  const modal = document.createElement('div');
  modal.className = 'cart-sync-modal-backdrop';
  modal.innerHTML = `
    <div class="cart-sync-modal">
      <button type="button" class="cart-sync-modal-close" aria-label="Fechar">✕</button>
      <h3 class="cart-sync-modal-title">📱 Carrinho no seu Celular</h3>
      <p class="cart-sync-modal-subtitle">Aponte a câmera do seu celular para o QR Code abaixo para abrir os mesmos produtos instantaneamente.</p>
      <div class="cart-sync-qr-wrap">
        <img src="${qrUrl}" alt="QR Code do Carrinho" width="180" height="180" />
      </div>
      <div class="cart-sync-actions">
        <button type="button" class="btn-sync-copy" id="syncCopyLinkBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copiar Link do Carrinho</span>
        </button>
        <a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Acesse seu carrinho da Fahren Motors: ' + shareUrl)}" target="_blank" rel="noopener noreferrer" class="btn-sync-whatsapp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          <span>Enviar por WhatsApp</span>
        </a>
      </div>
    </div>
  `;
  modal.querySelector('.cart-sync-modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector('#syncCopyLinkBtn').onclick = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('📋 Link do carrinho copiado com sucesso!');
      }).catch(() => {
        showToast('Link: ' + shareUrl);
      });
    } else {
      showToast('Link: ' + shareUrl);
    }
  };
  document.body.appendChild(modal);
}

function renderCart() {
  updateCartBadge();
  const el = document.getElementById('cartContent');
  if (!cart.length) {
    el.innerHTML = `
      <div class="empty-cart-card">
        <div class="empty-cart-icon">🛒</div>
        <h3 class="empty-cart-title">Seu carrinho está vazio</h3>
        <p class="empty-cart-text">Explore nosso catálogo completo com mais de 3.000 peças automotivas com garantia e entrega rápida.</p>
        <button type="button" class="btn btn-empty-cart" data-go="pecas">VER CATÁLOGO DE PEÇAS</button>
      </div>`;
    el.querySelector('[data-go]')?.addEventListener('click', () => show('pecas'));
    return;
  }
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const pixTotal = subtotal * (1 - PIX_DISCOUNT_RATE);
  const pixSavings = subtotal - pixTotal;
  const installment = subtotal / 12;
  const amounts = { subtotal, pixTotal, pixSavings, installment };

  el.innerHTML = `
    

    <div class="cart-items">
      ${cart.map(i => {
        const itemImg = getCartItemImage(i);
        const itemPixPrice = i.price * (1 - PIX_DISCOUNT_RATE);
        const itemTotal = i.price * i.quantity;
        return `
        <div class="cart-row modern-cart-card" data-id="${i.productId}">
          <div class="cart-item-thumb">
            <span class="cart-thumb-badge">-4% PIX</span>
            <img src="${itemImg}" alt="${i.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          </div>
          <div class="cart-item-details">
            <div class="cart-item-head">
              <div class="cart-item-title-block">
                <span class="cart-stock-badge">● Em estoque • Envio Imediato</span>
                <b class="cart-item-title" title="${i.name}">${i.name}</b>
              </div>
              <button type="button" class="cart-btn-remove remove-item" title="Remover item do carrinho" aria-label="Remover item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
            <div class="cart-item-pricing">
              <div class="cart-pix-line">
                <span class="cart-pix-price">${money(itemPixPrice)}</span>
                <span class="cart-pix-pill">no Pix</span>
              </div>
              <div class="cart-unit-subtext">
                ${money(i.price)} un. ou em até 12x
              </div>
            </div>
            <div class="cart-item-footer">
              <div class="cart-qty-pill">
                <button type="button" class="qty-minus" title="Diminuir quantidade">−</button>
                <span class="qty-value">${i.quantity}</span>
                <button type="button" class="qty-plus" title="Aumentar quantidade">+</button>
              </div>
              <div class="cart-item-subtotal">
                <span class="subtotal-label">Subtotal:</span>
                <span class="subtotal-amount">${money(itemTotal)}</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="cart-summary-box">
      <div class="cart-summary-line">
        <span>Subtotal (${totalItems} ${totalItems === 1 ? 'item' : 'itens'})</span>
        <b>${money(subtotal)}</b>
      </div>
      <div class="cart-summary-line pix-discount">
        <span>Desconto no Pix (-4%)</span>
        <b class="text-pix-green">- ${money(pixSavings)}</b>
      </div>
      <div class="cart-summary-line total-line">
        <div class="total-title-wrap">
          <b>Total a pagar</b>
          <small>no Pix com aprovação imediata</small>
        </div>
        <div class="total-val-wrap">
          <b class="pix-highlight-price">${money(pixTotal)}</b>
          <span class="card-alt-text">ou ${money(subtotal)} em até 12x</span>
        </div>
      </div>
    </div>

    <div class="payment-select" style="margin-top:22px">
      <div class="payment-select-header">
        <span class="payment-select-title">Forma de pagamento</span>
        <span class="payment-select-badge">🔒 Pagamento 100% Seguro</span>
      </div>
      <label class="payment-option selected">
        <input checked name="paymentMethod" type="radio" value="pix"/>
        <span class="payment-option-body">
          <span class="payment-option-top">
            <b>Pix (4% de Desconto)</b>
            <span class="payment-badge-discount">-4% PIX</span>
          </span>
          <small>Aprovação imediata via QR Code ou Copia e Cola • Economize ${money(pixSavings)}</small>
        </span>
        <span class="payment-option-price">${money(pixTotal)}</span>
      </label>
      <label class="payment-option">
        <input name="paymentMethod" type="radio" value="cartao"/>
        <span class="payment-option-body">
          <span class="payment-option-top">
            <b>Cartão de Crédito</b>
            <span class="payment-badge-installments">Até 12x</span>
          </span>
          <small>Em até 12x de ${money(installment)} sem juros</small>
        </span>
        <span class="payment-option-price">${money(subtotal)}</span>
      </label>
      <label class="payment-option">
        <input name="paymentMethod" type="radio" value="retirada"/>
        <span class="payment-option-body">
          <span class="payment-option-top">
            <b>Pagar na Retirada ou Entrega</b>
          </span>
          <small>Pague no cartão ou dinheiro quando receber suas peças</small>
        </span>
        <span class="payment-option-price">${money(subtotal)}</span>
      </label>
    </div>

    <div id="paymentInfoPanel"></div>

    <button class="btn" id="checkoutBtn" style="width:100%;margin-top:18px">FINALIZAR PEDIDO</button>
    <div class="fp-error" id="checkoutError" style="display:none;margin-top:10px"></div>
  `;

  

  el.querySelectorAll('.cart-row').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.qty-plus').onclick = () => { changeQty(id, 1); };
    row.querySelector('.qty-minus').onclick = () => { changeQty(id, -1); };
        // Clique na foto do item no carrinho abre o Relatório de Compra Fahren Motors
    row.querySelector('.cart-item-thumb')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCartItemReport(id);
    });

    row.querySelector('.remove-item').onclick = () => { cart = cart.filter(i => String(i.productId) !== String(id)); saveCart(false, true); renderCart(); };
  });
  el.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
    input.addEventListener('change', () => {
      el.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.toggle('selected', opt.querySelector('input').checked);
      });
      renderPaymentInfo(input.value, amounts, true);
    });
  });
  renderPaymentInfo('pix', amounts, false);
  document.getElementById('checkoutBtn').onclick = checkout;
}

function renderPaymentInfo(method, amounts, scroll) {
  const panel = document.getElementById('paymentInfoPanel');
  if (!panel) return;
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn && method !== 'cartao') checkoutBtn.style.display = '';
  if (method === 'pix') {
    const code = buildPixCode(amounts.pixTotal);
    const qrSvg = buildPixQrSvg(code);
    panel.innerHTML = `
      <div class="panel payment-panel pix-panel">
        <div class="kicker">PAGAMENTO VIA PIX (4% DE DESCONTO)</div>
        <p class="pix-total-note">Total no Pix: <b class="pix-total-green">${money(amounts.pixTotal)}</b> <span class="pix-savings-badge">Economia de ${money(amounts.pixSavings)}</span></p>
        ${qrSvg ? `<div class="pix-qr-box">${qrSvg}</div><p class="pix-qr-caption">Escaneie o QR Code com a câmera do app do seu banco</p>` : ''}
        <label class="pix-cpc-label">Ou use o Pix Copia e Cola:</label>
        <textarea id="pixCode" readonly rows="2">${code}</textarea>
        <button class="btn btn-copy-pix" id="copyPixBtn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>COPIAR CÓDIGO PIX</span>
        </button>
        <p class="form-help pix-instructions">
          Copie o código acima e cole na opção "Pix Copia e Cola" do aplicativo do seu banco. Em seguida, clique em <b>Finalizar Pedido</b> abaixo para registrar a compra.
        </p>
      </div>`;
    const copyBtn = document.getElementById('copyPixBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const codeEl = document.getElementById('pixCode');
        if (codeEl) codeEl.select();
        const done = () => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>✓ CÓDIGO COPIADO!</span>`;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>COPIAR CÓDIGO PIX</span>`;
          }, 2500);
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(code).then(done).catch(() => {
            try { document.execCommand('copy'); done(); } catch (_) {}
          });
        } else {
          try { document.execCommand('copy'); done(); } catch (_) {}
        }
      };
    }
  } else if (method === 'cartao') {
    panel.innerHTML = `
      <div class="panel payment-panel">
        <div class="kicker">PAGAMENTO NO CARTÃO DE CRÉDITO</div>
        <p style="margin:8px 0 14px;color:var(--fp-c7c9cd)">Total: <b>${money(amounts.subtotal)}</b> em até 12x de ${money(amounts.installment)} sem juros</p>
        <div id="cardPaymentBrick">
          <p class="form-help">Carregando formulário de pagamento...</p>
        </div>
        <p id="cardPaymentStatus" style="display:none;margin-top:10px;font-size:13px"></p>
        <p class="form-help">Seus dados do cartão são enviados direto e com segurança para o processador de pagamentos — a loja nunca guarda o número do seu cartão.</p>
      </div>`;
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.style.display = 'none';
    mountCardBrick(amounts);
  } else {
    panel.innerHTML = `
      <div class="panel payment-panel">
        <div class="kicker">PAGAR NA RETIRADA / ENTREGA</div>
        <p style="margin:8px 0;color:var(--fp-c7c9cd)">Total: <b>${money(amounts.subtotal)}</b></p>
        <p class="form-help">Pague em dinheiro ou cartão no momento de receber suas peças.</p>
      </div>`;
  }
  if (scroll) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
}

function changeQty(id, delta) {
  const item = cart.find(i => String(i.productId) === String(id));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => String(i.productId) !== String(id));
  saveCart();
  renderCart();
}

async function checkout() {
  const errEl = document.getElementById('checkoutError');
  if (errEl) errEl.style.display = 'none';
  if (!authenticated) {
    alert('Cadastre-se ou entre na sua conta para finalizar o pedido.');
    show('cadastro');
    return;
  }
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'retirada';
  try {
    const { address } = await api('/api/addresses/mine');
    if (!address) {
      alert('Cadastre seu endereço de entrega antes de finalizar o pedido.');
      show('endereco');
      return;
    }
    const items = cart.map(i => ({ productId: i.productId, quantity: i.quantity }));
    const orderRes = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items, paymentMethod }) });
    broadcastSync('ORDER_CREATED', { orderId: orderRes?.order?.id });
    refreshLojaStockData();
    cart = []; saveCart();
    if (paymentMethod === 'pix') {
      alert('Pedido realizado! Finalize o pagamento com o código Pix que você copiou e acompanhe o status na sua tela de Perfil.');
    } else {
      alert('Pedido realizado com sucesso! Acompanhe o status na sua tela de Perfil.');
    }
    show('perfil');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

// ---------- Meus pedidos ----------
const ORDER_STATUS_LABEL = { novo: 'Novo', em_preparacao: 'Em preparação', pronto: 'Pronto para retirada/entrega', entregue: 'Entregue', cancelado: 'Cancelado' };

async function loadMyOrders() {
  const el = document.getElementById('myOrders');
  if (!el) return;
  try {
    const { orders } = await api('/api/orders/mine');
    if (!orders.length) { el.innerHTML = '<p style="color:var(--fp-9da2aa)">Você ainda não fez nenhum pedido.</p>'; return; }
    el.innerHTML = orders.map(o => `
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)">
        <div style="display:flex;justify-content:space-between"><b>Pedido #${o.id}</b><span class="chip">${ORDER_STATUS_LABEL[o.status] || o.status}</span></div>
        <div style="color:var(--fp-9da2aa);font-size:13px;margin-top:4px">${new Date(o.createdAt).toLocaleDateString('pt-BR')} • ${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</div>
        <div style="margin-top:4px"><b>${money(o.total)}</b></div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<p style="color:#e06a6a">${err.message}</p>`;
  }
}


// ==========================================================================
// RELATÓRIO DO ITEM DO PEDIDO (AO CLICAR NA IMAGEM NO CARRINHO)
// Mostra Valores, Nome da Peça, Endereço de Entrega, Destinatário e Garantia
// ==========================================================================
async function openCartItemReport(productId) {
  const item = cart.find(i => String(i.productId) === String(productId));
  if (!item) return;

  const itemImg = getCartItemImage(item);
  const priceVal = Number(item.price) || 0;
  const qty = Number(item.quantity) || 1;
  const totalVal = priceVal * qty;
  const pixVal = totalVal * (1 - PIX_DISCOUNT_RATE);
  const pixDiff = totalVal - pixVal;
  const cardInstVal = totalVal / 12;

  let addressText = 'Endereço ainda não preenchido. Você poderá confirmar antes do pagamento.';
  let clientName = (currentUser && (currentUser.name || currentUser.fullName)) || 'Cliente Fahren Motors';
  let clientContact = (currentUser && (currentUser.phone || currentUser.email)) || 'WhatsApp informado no checkout';

  try {
    const res = await api('/api/addresses/mine');
    if (res && res.address) {
      const a = res.address;
      addressText = `${a.street || ''}, ${a.number || 'S/N'}${a.complement ? ' (' + a.complement + ')' : ''} - ${a.neighborhood || ''}, ${a.city || ''}/${a.state || ''} • CEP: ${a.cep || ''}`;
    }
  } catch (_) {
    const cep = document.getElementById('deliveryCep')?.value;
    const rua = document.getElementById('deliveryStreet')?.value;
    const num = document.getElementById('deliveryNumber')?.value;
    const bai = document.getElementById('deliveryNeighborhood')?.value;
    const cid = document.getElementById('deliveryCity')?.value;
    const uf = document.getElementById('deliveryState')?.value;
    if (rua && num) {
      addressText = `${rua}, ${num} - ${bai || ''}, ${cid || ''}/${uf || ''} • CEP: ${cep || ''}`;
    }
  }

  document.getElementById('fpCartReportModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'fpCartReportModal';
  modal.className = 'fp-cart-report-modal';
  modal.innerHTML = `
    <div class="fp-cart-report-card" role="dialog" aria-modal="true">
      <!-- CABEÇALHO COM LOGO OFICIAL DA LOJA (FM + FAHREN MOTORS) -->
      <div class="fp-cart-report-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="logo-badge" style="width:32px;height:32px;padding:2px;"><div class="logo-badge-inner" style="font-size:11px;font-weight:900;">FM</div></div>
          <div style="display:flex;flex-direction:column;line-height:1.15;">
            <div style="font-size:14px;font-weight:900;letter-spacing:0.3px;"><span class="brand-fahren" style="color:#ed1c24;">FAHREN</span> <span class="brand-parts" style="color:var(--fp-fff, #ffffff);">MOTORS</span></div>
            <span style="font-size:11px;color:#94a3b8;font-weight:600;">Relatório do Item no Carrinho</span>
          </div>
        </div>
        <button type="button" class="fp-cart-report-close" aria-label="Voltar para a sacolinha" title="Voltar para a sacolinha">&times;</button>
      </div>

      <div class="fp-cart-report-body">
        <!-- Peça, Foto e Nome -->
        <div class="fp-cart-report-prod-row">
          <img src="${itemImg}" alt="${item.name}" class="fp-cart-report-thumb" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          <div>
            <div style="font-size:11px;font-weight:800;color:#ed1c24;text-transform:uppercase;margin-bottom:2px">
              CÓD: #${item.code || item.productId} • EM ESTOQUE
            </div>
            <strong style="font-size:15px;line-height:1.4;display:block">${item.name}</strong>
            <span style="font-size:12.5px;color:#94a3b8;display:block;margin-top:4px">
              Quantidade: <strong style="color:var(--fp-fff, #ffffff)">${qty} unidade(s)</strong>
            </span>
          </div>
        </div>

        <!-- Discriminação de Valores com AS MESMAS CORES DA TELA ANTERIOR (VERDE NO PIX) -->
        <div>
          <div class="fp-cart-report-sec-title"><span>💰</span> Valores e Condições de Pagamento</div>
          <div class="fp-cart-report-box">
            <div class="fp-cart-report-val-line">
              <span style="color:#94a3b8;">Valor Unitário da Peça:</span>
              <strong style="color:var(--fp-fff, #ffffff)">${money(priceVal)}</strong>
            </div>
            <div class="fp-cart-report-val-line">
              <span style="color:#94a3b8;">Quantidade Solicitada:</span>
              <span>${qty}x</span>
            </div>
            <div class="fp-cart-report-val-line">
              <span style="color:#94a3b8;">Subtotal:</span>
              <strong style="color:var(--fp-fff, #ffffff)">${money(totalVal)}</strong>
            </div>
            <!-- Desconto no Pix em VERDE como na tela anterior -->
            <div class="fp-cart-report-val-line" style="color:#16a34a !important;font-weight:700;padding-top:4px;">
              <span>Desconto Especial no Pix (-4%):</span>
              <span style="color:#16a34a !important;font-weight:800;">- ${money(pixDiff)}</span>
            </div>
            <!-- Total no Pix destacado -->
            <div class="fp-cart-report-val-line fp-cart-report-val-total">
              <span style="font-weight:800;">Total à Vista no Pix:</span>
              <span style="color:#ed1c24;font-size:18px;font-weight:900;">${money(pixVal)}</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:6px;text-align:right">
              ou em até 12x de ${money(cardInstVal)} sem juros no cartão
            </div>
          </div>
        </div>

        <!-- Endereço de Destino da Entrega -->
        <div>
          <div class="fp-cart-report-sec-title"><span>📍</span> Endereço de Destino da Entrega</div>
          <div class="fp-cart-report-box">
            <div style="font-weight:700;margin-bottom:4px;color:var(--fp-fff, #ffffff)">Destinatário: ${clientName}</div>
            <div style="color:#cbd5e1">${addressText}</div>
            <div style="margin-top:6px;font-size:12px;color:#94a3b8">Contato para Rastreio: ${clientContact}</div>
          </div>
        </div>
      </div>

      <!-- BOTÃO DE RETORNO DIRETO PARA A SACOLINHA -->
      <div class="fp-cart-report-footer">
        <button type="button" class="btn fp-cart-report-btn-close" style="width:100%;background:#ed1c24;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          <span>←</span> VOLTAR PARA A SACOLINHA
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Registra no histórico do navegador para que o botão "Voltar" nativo do celular feche o modal
  try {
    window.history.pushState({ modal: 'cart-report', screen: 'carrinho', depth: navDepth + 1 }, '');
  } catch (_) {}

  // Fecha o modal garantindo que o cliente PERMANEÇA na sacolinha (#carrinho)
  let isClosed = false;
  const closeModal = (e, triggerHistoryBack = true) => {
    if (isClosed) return;
    isClosed = true;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    modal.remove();

    if (triggerHistoryBack && window.history.state && window.history.state.modal === 'cart-report') {
      window.history.back();
    }
  };

  modal.querySelector('.fp-cart-report-close')?.addEventListener('click', closeModal);
  modal.querySelector('.fp-cart-report-btn-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(e);
  });

  // Fecha no ESC sem sair do carrinho
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      window.removeEventListener('keydown', onEsc);
    }
  };
  window.addEventListener('keydown', onEsc);
}
window.openCartItemReport = openCartItemReport;

/* =========================================================================
 * [MÓDULO: 08-init-and-redesign.js]
 * ========================================================================= */
// Módulo WMS: 08-init-and-redesign.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Controle da Tela de Carregamento (Splash Screen) ----------
function hideSplashScreen() {
  const splash = document.getElementById('splashScreen');
  if (!splash || splash.classList.contains('hidden')) return;
  splash.classList.add('hidden');
  setTimeout(() => {
    splash.style.display = 'none';
  }, 450);
}

// ---------- Tecla ESC para sair de modais ou voltar telas ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 1. Fecha lightbox de fotos se aberto
    const lb = document.getElementById('imageLightbox');
    if (lb && !lb.classList.contains('hidden')) {
      const closeBtn = document.getElementById('lightboxCloseBtn');
      if (closeBtn) closeBtn.click();
      else lb.classList.add('hidden');
      return;
    }
    // 2. Fecha qualquer modal ativo
    const openModals = document.querySelectorAll('.modal-overlay:not(.hidden), .modal:not(.hidden)');
    if (openModals.length > 0) {
      openModals.forEach(m => m.classList.add('hidden'));
      return;
    }
    // 3. Se estiver em detalhes do produto ou carrinho, volta ao catálogo
    const detailsView = document.getElementById('view-detalhes');
    if (detailsView && !detailsView.classList.contains('hidden')) {
      show('catalogo');
      return;
    }
    const cartView = document.getElementById('view-carrinho');
    if (cartView && !cartView.classList.contains('hidden')) {
      show('catalogo');
      return;
    }
  }
});

// ---------- Inicialização ----------
async function init() {
  // Timeout de segurança para nunca travar a tela caso a conexão caia
  const safetyTimer = setTimeout(hideSplashScreen, 1800);

  try {
    const { customer } = await api('/api/auth/me');
    applyUser(customer);
  } catch {
    applyUser(null);
  }
    updateNav();
  updateCartBadge();

  // Restaura a tela onde o usuário estava ao atualizar (ex: #carrinho ou última salva)
  let initialScreen = 'inicio';
  const validScreens = ['inicio', 'pecas', 'carrinho', 'perfil', 'produto', 'cadastro'];
  const rawHash = (window.location.hash || '').replace('#', '').trim();

  let targetProdId = null;
  if (rawHash.startsWith('produto')) {
    const parts = rawHash.split('/');
    if (parts.length > 1 && parts[1]) targetProdId = parts[1];
    initialScreen = 'produto';
  } else if (rawHash.startsWith('pecas')) {
    const parts = rawHash.split('/');
    if (parts.length > 1 && parts[1]) {
      try {
        activeCatalogCategory = normalizeCatalogCategory(decodeURIComponent(parts[1]));
      } catch {}
    }
    initialScreen = 'pecas';
  } else if (rawHash && validScreens.includes(rawHash)) {
    initialScreen = rawHash;
  } else {
    try {
      const savedScreen = sessionStorage.getItem('fahren-last-screen');
      if (savedScreen && validScreens.includes(savedScreen)) {
        initialScreen = savedScreen;
      }
    } catch {}
  }

  if (!targetProdId) {
    try {
      targetProdId = sessionStorage.getItem('fahren-last-product-id');
    } catch {}
  }

  // Se a tela inicial for produto mas não temos o ID, volta com segurança para o catálogo (#pecas)
  if (initialScreen === 'produto') {
    try {
      const savedCat = sessionStorage.getItem('fahren-last-category') || localStorage.getItem('fahren-last-category');
      if (savedCat && !activeCatalogCategory) activeCatalogCategory = savedCat;
    } catch {}
    if (targetProdId) {
      show('produto', { push: false });
      setTimeout(() => {
        openProductDetails(targetProdId, null, false);
      }, 50);
    } else {
      initialScreen = 'pecas';
      show('pecas', { push: false, keepFilter: Boolean(activeCatalogCategory) });
    }
  } else if (initialScreen === 'pecas') {
    try {
      const savedCat = sessionStorage.getItem('fahren-last-category') || localStorage.getItem('fahren-last-category');
      if (savedCat && !activeCatalogCategory) activeCatalogCategory = savedCat;
    } catch {}
    show('pecas', { push: false, keepFilter: Boolean(activeCatalogCategory) });
  } else {
    show(initialScreen, { push: false });
  }
  loadAddress();

  if (typeof window.syncHomeCategoryCardPhotos === 'function' && typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') {
    window.syncHomeCategoryCardPhotos(CATALOG_FALLBACK_PRODUCTS);
  }
  
  // Pré-carrega carrossel da home e catálogo de peças em paralelo para velocidade máxima
  try {
    const preloadTasks = [loadCategoryCarousel()];
    if (initialScreen !== 'pecas') {
      preloadTasks.push(loadCatalog());
    }
    await Promise.allSettled(preloadTasks);
  } catch (err) {
    console.error('Erro no pré-carregamento:', err);
  }

  initProductViewer();

  clearTimeout(safetyTimer);
  // Transição suave para revelar a página 100% pronta
  setTimeout(hideSplashScreen, 200);
}
init();

// ================== REDESIGN HOME: cabeçalho, localizador de veículo, categorias e barra inferior mobile ==================
(function () {
  // Categorias — botão do cabeçalho (desktop)
  const catBtn = document.getElementById('headerCatBtn');
  const catMenu = document.getElementById('headerCatMenu');
  if (catBtn && catMenu) {
    catBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = catMenu.classList.toggle('open');
      catBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!catMenu.contains(e.target) && !catBtn.contains(e.target)) {
        catMenu.classList.remove('open');
        catBtn.setAttribute('aria-expanded', 'false');
      }
    });
    catMenu.querySelectorAll('.clean-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        catMenu.classList.remove('open');
        catBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Busca do cabeçalho (desktop e mobile) — reaproveita a busca do catálogo
  function runHeaderSearch(inputEl) {
    const q = inputEl?.value?.trim() || '';
    show('pecas');
    const catInput = document.getElementById('catalogSearch');
    if (catInput) {
      catInput.value = q;
      if (typeof loadCatalog === 'function') loadCatalog();
    }
  }
  const hSearchIn = document.getElementById('headerSearchInput');
  const hSearchBtn = document.getElementById('headerSearchBtn');
  const hSearchInM = document.getElementById('headerSearchInputMobile');
  const hSearchBtnM = document.getElementById('headerSearchBtnMobile');
  hSearchBtn?.addEventListener('click', () => runHeaderSearch(hSearchIn));
  hSearchIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runHeaderSearch(hSearchIn); });
  hSearchBtnM?.addEventListener('click', () => runHeaderSearch(hSearchInM));
  hSearchInM?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runHeaderSearch(hSearchInM); });

  // Grade de categorias na home
  // Limpar filtro de categoria selecionada
  const handleExitAllParts = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    activeCatalogCategory = '';
    const catInput = document.getElementById('catalogSearch');
    if (catInput) catInput.value = '';
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = '';
    show('inicio');
  };

  document.getElementById('activeCategoryClearBtnCatalog')?.addEventListener('click', handleExitAllParts);
  document.getElementById('activeCategoryBarCatalog')?.addEventListener('click', handleExitAllParts);
  document.getElementById('activeCategoryClearBtnCatalogBottom')?.addEventListener('click', handleExitAllParts);
  document.getElementById('activeCategoryBarCatalogBottom')?.addEventListener('click', handleExitAllParts);

  // Grade de categorias na home (clique único no card abre a categoria sem empilhar histórico triplo)
  document.querySelectorAll('.cat-grid-item[data-cat]').forEach((item) => {
    const handleCategorySelect = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const cat = item.dataset.cat || item.getAttribute('data-cat') || '';
      goToCategory(cat);
    };
    item.addEventListener('click', handleCategorySelect);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleCategorySelect(e);
      }
    });
  });

  // Quantidade real de peças, foto real e categorias dinâmicas (inclui novas categorias criadas no WMS)
  async function loadCategoryCounts() {
    const grid = document.querySelector('.cat-grid');
    const els = [...document.querySelectorAll('.cat-grid-count[data-count-for]')];
    if (!els.length && !grid) return;
    try {
      const res = await fetch('/api/products/categories?_t=' + Date.now(), { cache: 'no-store' });
      const data = await res.json();
      const cats = data.categories || [];
      const disabledSet = new Set((data.disabledCategories || []).map((c) => normalizeCatalogCategory(c).toLowerCase()));

      if (grid) {
        grid.querySelectorAll('.cat-grid-item[data-cat]').forEach((card) => {
          const norm = normalizeCatalogCategory(card.dataset.cat || card.getAttribute('data-cat') || '').toLowerCase();
          card.style.display = (norm && disabledSet.has(norm)) ? 'none' : '';
        });
      }
      if (catMenu) {
        catMenu.querySelectorAll('.clean-chip[data-cat]').forEach((chip) => {
          const raw = chip.dataset.cat || '';
          if (!raw) return;
          const norm = normalizeCatalogCategory(raw).toLowerCase();
          chip.style.display = (norm && disabledSet.has(norm)) ? 'none' : '';
        });
      }

      if (grid && cats.length) {
        const existingNorms = new Set(
          [...grid.querySelectorAll('.cat-grid-item[data-cat]')].map((el) =>
            normalizeCatalogCategory(el.dataset.cat || el.getAttribute('data-cat') || '').toLowerCase()
          )
        );
        cats.forEach((c) => {
          const catName = (c && c.name ? String(c.name).trim() : '');
          const norm = normalizeCatalogCategory(catName).toLowerCase();
          if (!catName || !norm || existingNorms.has(norm)) return;
          existingNorms.add(norm);
          const photoSrc = (c.photo && isLojaRealPhoto(c.photo)) ? normalizeLojaPhoto(c.photo) : LOJA_NO_PHOTO_SVG;
          const card = document.createElement('div');
          card.className = 'cat-grid-item cat-grid-item-dynamic';
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.setAttribute('data-cat', catName);
          card.innerHTML = `
            <div class="cat-card-thumb">
              <img src="${photoSrc}" alt="${catName}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;"/>
            </div>
            <div class="cat-card-body">
              <div class="cat-card-head">
                <span class="cat-card-icon-badge">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </span>
                <h3 class="cat-card-title">${catName.toUpperCase()}</h3>
              </div>
              <p class="cat-card-sub">Peças cadastradas no WMS</p>
              <div class="cat-card-line"></div>
              <div class="cat-card-footer">
                <span class="cat-card-count-box">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  <span class="cat-grid-count" data-count-for="${catName}">Carregando...</span>
                </span>
                <span class="cat-card-arrow-btn">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
            </div>`;
          const handleDynamicCat = (e) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            goToCategory(catName);
          };
          card.addEventListener('click', handleDynamicCat);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') handleDynamicCat(e);
          });
          grid.appendChild(card);
        });
      }

      if (catMenu && cats.length) {
        const menuNorms = new Set(
          [...catMenu.querySelectorAll('.clean-chip')].map((el) =>
            normalizeCatalogCategory(el.dataset.cat || '').toLowerCase()
          )
        );
        cats.forEach((c) => {
          const catName = (c && c.name ? String(c.name).trim() : '');
          const norm = normalizeCatalogCategory(catName).toLowerCase();
          if (!catName || !norm || menuNorms.has(norm)) return;
          menuNorms.add(norm);
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'clean-chip';
          chip.dataset.cat = catName;
          chip.textContent = catName;
          chip.addEventListener('click', () => {
            catMenu.classList.remove('open');
            catBtn?.setAttribute('aria-expanded', 'false');
            document.querySelectorAll('.clean-chip').forEach((x) => x.classList.remove('active'));
            chip.classList.add('active');
            goToCategory(catName);
          });
          catMenu.appendChild(chip);
        });
      }

      if (typeof window.syncHomeCategoryCardPhotos === 'function') {
        window.syncHomeCategoryCardPhotos(cats, { clearFictitious: true });
      }
      const counts = {};
      cats.forEach((c) => {
        const key = normalizeCatalogCategory(c.name || '').toLowerCase();
        if (key) counts[key] = (counts[key] || 0) + (Number(c.count) || 0);
      });
      document.querySelectorAll('.cat-grid-count[data-count-for]').forEach((el) => {
        const cat = normalizeCatalogCategory(el.dataset.countFor || '').toLowerCase();
        const n = counts[cat] || 0;
        el.textContent = n === 1 ? '1 produto disponível' : `${n} produtos disponíveis`;
      });
    } catch (e) {
      document.querySelectorAll('.cat-grid-count[data-count-for]').forEach((el) => { el.textContent = ''; });
    }
  }
  window.loadCategoryCounts = loadCategoryCounts;
  loadCategoryCounts();

    // ========================================================
  // WIDGET INTERATIVO DE VEÍCULOS & GARAGEM FAHREN MOTORS
  // ========================================================
  (function setupVehicleFinder() {
    const montadoraSelect = document.getElementById('vfMontadora');
    const modeloSelect = document.getElementById('vfModelo');
    const anoSelect = document.getElementById('vfAno');
    const motorSelect = document.getElementById('vfMotor');
    const buscarBtn = document.getElementById('vfBuscarBtn');

    const tabModel = document.getElementById('vfTabModel');
    const tabPlate = document.getElementById('vfTabPlate');
    const rowModel = document.getElementById('vfModelRow');
    const rowPlate = document.getElementById('vfPlateRow');
    const placaInput = document.getElementById('vfPlacaInput');
    const buscarPlacaBtn = document.getElementById('vfBuscarPlacaBtn');

    // Botões de limpar garagem
    document.getElementById('activeGarageClearBtn')?.addEventListener('click', clearActiveVehicle);
    document.getElementById('activeGarageClearBtnCatalog')?.addEventListener('click', clearActiveVehicle);
    updateGarageUI();

    // 1. ALTERNAR ABAS (Por Modelo vs Por Placa)
    function switchTab(mode) {
      if (mode === 'plate') {
        tabPlate?.classList.add('active');
        tabModel?.classList.remove('active');
        if (rowModel) rowModel.style.display = 'none';
        if (rowPlate) rowPlate.style.display = 'flex';
        // Sem auto-focus para não abrir teclado virtual no mobile
      } else {
        tabModel?.classList.add('active');
        tabPlate?.classList.remove('active');
        if (rowModel) rowModel.style.display = 'flex';
        if (rowPlate) rowPlate.style.display = 'none';
      }
    }

    tabModel?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('model');
    });

    tabPlate?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('plate');
    });

    // 2. POPULAÇÃO DINÂMICA AO SELECIONAR A MONTADORA
    montadoraSelect?.addEventListener('change', () => {
      const brand = montadoraSelect.value;
      const data = (typeof VEHICLE_CATALOG !== 'undefined') ? VEHICLE_CATALOG[brand] : null;

      if (modeloSelect) {
        modeloSelect.innerHTML = '<option value="">Modelo</option>';
        if (data && data.models) {
          data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modeloSelect.appendChild(opt);
          });
          modeloSelect.disabled = false;
        } else {
          modeloSelect.disabled = true;
        }
      }

            if (anoSelect) {
        anoSelect.innerHTML = '<option value="">Ano</option>';
        const currentYear = new Date().getFullYear();
        const maxYear = currentYear + 1; // Inclui modelo do ano seguinte (ex: 2027)
        const minYear = 1990; // Ano inicial solicitado pelo usuário
        for (let y = maxYear; y >= minYear; y--) {
          const opt = document.createElement('option');
          opt.value = String(y);
          opt.textContent = String(y);
          anoSelect.appendChild(opt);
        }
        anoSelect.disabled = !brand;
      }

      if (motorSelect) {
        motorSelect.innerHTML = '<option value="">Motor</option>';
        if (data && data.engines) {
          data.engines.forEach(eng => {
            const opt = document.createElement('option');
            opt.value = eng;
            opt.textContent = eng;
            motorSelect.appendChild(opt);
          });
          motorSelect.disabled = false;
        } else {
          motorSelect.disabled = true;
        }
      }
    });

    // 3. BUSCA POR MODELO / ANO
    buscarBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const brand = montadoraSelect?.value || '';
      const model = modeloSelect?.value || '';
      const year = anoSelect?.value || '';
      const engine = motorSelect?.value || '';

      if (!brand && !model) {
        showToast('Selecione pelo menos a Montadora e o Modelo.');
        return;
      }

      const vehicle = { brand, model, year, engine };
      setActiveVehicle(vehicle);

      show('pecas');
      const catInput = document.getElementById('catalogSearch');
      if (catInput) {
        catInput.value = model || brand;
        if (typeof loadCatalog === 'function') loadCatalog();
      }
      showToast('Veículo salvo! Exibindo peças para seu ' + (model || brand) + '.');
    });

    // 4. CONSULTA POR PLACA (Real / Teste com fallback instantâneo)
    const DEMO_PLATES = {
      'BRA2E19': { brand: 'Volkswagen', model: 'T-Cross', year: '2022', engine: '1.4 TSI' },
      'GOL2021': { brand: 'Volkswagen', model: 'Gol', year: '2021', engine: '1.0 MPI' },
      'CIV2020': { brand: 'Honda', model: 'Civic', year: '2020', engine: '1.5 Turbo' },
      'ONX2023': { brand: 'Chevrolet', model: 'Onix', year: '2023', engine: '1.0 Turbo' },
      'COR2022': { brand: 'Toyota', model: 'Corolla', year: '2022', engine: '2.0 Dynamic Force' },
      'ABC1234': { brand: 'Honda', model: 'Civic', year: '2020', engine: '2.0 16V' },
      'XYZ9876': { brand: 'Toyota', model: 'Corolla', year: '2022', engine: '2.0' },
      'MOT1001': { brand: 'Honda Motos', model: 'CB 500F', year: '2023', engine: '500cc' },
      'MOT2002': { brand: 'Yamaha', model: 'MT-07', year: '2021', engine: '689cc' }
    };

    async function executePlateConsult(plateToSearch) {
      const plate = (plateToSearch || placaInput?.value || '').trim();
      if (!plate) {
        showToast('Digite ou clique em uma placa de teste.');
        return;
      }

      const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (placaInput) placaInput.value = clean;
      if (buscarPlacaBtn) {
        buscarPlacaBtn.disabled = true;
        buscarPlacaBtn.textContent = 'CONSULTANDO...';
      }

      let v = null;
      try {
        const res = await fetch('/api/vehicles/plate/' + encodeURIComponent(clean));
        if (res.ok) {
          const data = await res.json();
          if (data && data.vehicle) v = data.vehicle;
        }
      } catch (_) {}

      // Fallback para placas de demonstração ou placas válidas
      if (!v && DEMO_PLATES[clean]) {
        v = { ...DEMO_PLATES[clean], plate: clean };
      } else if (!v && clean.length >= 7) {
        v = { brand: 'Volkswagen', model: 'Gol', year: '2021', engine: '1.0 MPI', plate: clean };
      }

      if (!v) {
        showToast('Placa inválida ou não encontrada. Digite ex: BRA2E19');
        if (buscarPlacaBtn) {
          buscarPlacaBtn.disabled = false;
          buscarPlacaBtn.textContent = 'BUSCAR PELA PLACA';
        }
        return;
      }

      const vehicle = {
        brand: v.brand,
        model: v.model,
        year: String(v.modelYear || v.year || ''),
        engine: v.engine || '',
        plate: v.plate || clean
      };

      setActiveVehicle(vehicle);
      show('pecas');
      const catInput = document.getElementById('catalogSearch');
      if (catInput) {
        catInput.value = v.model || v.brand;
        if (typeof loadCatalog === 'function') loadCatalog();
      }
      showToast('Veículo identificado: ' + v.brand + ' ' + v.model + ' (' + vehicle.year + ')!');

      if (buscarPlacaBtn) {
        buscarPlacaBtn.disabled = false;
        buscarPlacaBtn.textContent = 'BUSCAR PELA PLACA';
      }
    }

    buscarPlacaBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      executePlateConsult();
    });

    placaInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executePlateConsult();
      }
    });

    // 5. CLIQUE RÁPIDO NOS CHIPS DE PLACAS DE TESTE
    document.querySelectorAll('.vf-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const p = chip.dataset.plate;
        if (p) executePlateConsult(p);
      });
    });
  })();

  // Atalho "Informe seu veículo" leva para o localizador de veículo da home
  document.getElementById('qaVehicle')?.addEventListener('click', () => {
    show('inicio');
    setTimeout(() => {
      const vf = document.querySelector('.vehicle-finder');
      vf?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Sem auto-focus para não abrir teclado virtual no mobile
    }, 80);
  });

  // Ofertas especiais — monta os cards com peças reais do catálogo e o desconto do Pix
  (async function loadOffers() {
    const section = document.getElementById('offersSection');
    const list = document.getElementById('offersList');
    if (!section || !list) return;
    try {
      let rawEligible = [];
      let offersApiOk = false;
      try {
        const res = await fetch('/api/products/categories/featured?_t=' + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        rawEligible = data.products || data.categories || (Array.isArray(data.featured) ? data.featured.map(f => f.product || f) : []);
        offersApiOk = true;
      } catch (_) {}

      if (!offersApiOk || !rawEligible.length) {
        try {
          const r2 = await fetch('/api/products?_t=' + Date.now(), { cache: 'no-store' });
          const d2 = await r2.json();
          rawEligible = d2.products || [];
          offersApiOk = true;
        } catch (_) {}
      }

      if (!offersApiOk && !rawEligible.length) {
        rawEligible = (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS.slice() : [];
      }

      const filteredEligible = rawEligible.filter(p => {
        const v = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        return v > 0 && p.inStock !== false;
      });
      const realEligible = filteredEligible.filter(p => typeof isLojaRealWmsProduct === 'function' ? isLojaRealWmsProduct(p) : true);
      const allEligible = prioritizeRealProducts(realEligible.length > 0 ? realEligible : filteredEligible);
      if (!allEligible.length) return;

      // Seleciona ofertas destacadas garantindo variedade entre as categorias automotivas
      const byCategory = new Map();
      allEligible.forEach(p => {
        const cat = p.category || 'Geral';
        if (!byCategory.has(cat)) byCategory.set(cat, p);
      });
      let items = Array.from(byCategory.values());
      if (items.length < 8) {
        const usedIds = new Set(items.map(p => p.id));
        for (const p of allEligible) {
          if (!usedIds.has(p.id)) {
            items.push(p);
            usedIds.add(p.id);
            if (items.length >= 8) break;
          }
        }
      }

      list.innerHTML = items.map(p => {
        const photo = getLojaPrimaryPhoto(p);
        const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        const pixVal = priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04));
        const pixStr = money(pixVal).replace('R$', '').trim();
        return `
        <button type="button" class="offer-card" data-product-id="${p.id}">
          <div class="offer-card-text">
            <div class="offer-card-badges">
              <span class="offer-card-cat">${p.category || 'Peça'}</span>
              <span class="offer-card-tag-pix">-4% PIX</span>
            </div>
            <div class="offer-card-name">${p.name}</div>
            ${p.compatibility ? `<div class="offer-card-compat" title="${p.compatibility}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg><span>${p.compatibility}</span></div>` : ''}
            <div class="offer-card-price-block">
              <div class="offer-card-price-main">
                <span class="offer-card-label">À vista no Pix</span>
                <span class="offer-card-price"><small>R$</small>${pixStr}</span>
              </div>
              <span class="offer-card-cta">
                <span>VER PEÇA</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </div>
            <div class="offer-card-note">ou ${money(priceVal)} em até 12x no cartão</div>
          </div>
          <div class="offer-card-img">
            <img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;">
            <span class="offer-img-badge">OFERTA</span>
          </div>
        </button>`;
      }).join('');

      list.querySelectorAll('.offer-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.productId;
          const prod = items.find(p => String(p.id) === String(id));
          if (typeof openProductDetails === 'function') openProductDetails(id, prod);
        });
      });
      const btnAll = section.querySelector('.btn-offers-all');
      if (btnAll) {
        btnAll.onclick = () => show('pecas');
      }
      section.style.display = '';
    } catch (e) {
      console.error('Erro ao carregar ofertas:', e);
    }
  })();

  // Barra de navegação inferior (somente mobile)
  const tabbar = document.getElementById('mobileTabbar');
  if (tabbar) {
    const tabButtons = [...tabbar.querySelectorAll('button')];
    function setActiveTab(id) {
      tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    }
    tabbar.querySelector('[data-tab="inicio"]')?.addEventListener('click', () => { show('inicio'); setActiveTab('inicio'); });
    tabbar.querySelector('[data-tab="categorias"]')?.addEventListener('click', () => {
      show('inicio');
      setActiveTab('categorias');
      setTimeout(() => document.querySelector('.cat-grid-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    });
    tabbar.querySelector('[data-tab="buscar"]')?.addEventListener('click', () => {
      show('inicio');
      setActiveTab('buscar');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Sem auto-focus no mobile
      }, 80);
    });
    tabbar.querySelector('[data-tab="perfil"]')?.addEventListener('click', () => { show('perfil'); setActiveTab('perfil'); });
    tabbar.querySelector('[data-tab="carrinho"]')?.addEventListener('click', () => { show('carrinho'); setActiveTab('carrinho'); });

    // Mantém a aba ativa sincronizada quando a tela muda por outro caminho (voltar do navegador, links internos etc.)
    if (typeof screens !== 'undefined') {
      const tabbarObserver = new MutationObserver(() => {
        const activeScreen = document.querySelector('.screen.active')?.id;
        if (activeScreen && tabButtons.some((b) => b.dataset.tab === activeScreen)) setActiveTab(activeScreen);
      });
      screens.forEach((s) => tabbarObserver.observe(s, { attributes: true, attributeFilter: ['class'] }));
    }

    // Espelha o número do carrinho na barra inferior
    const badgeSrc = document.getElementById('cartBadge');
    const badgeDst = document.getElementById('mtbCartBadge');
    if (badgeSrc && badgeDst) {
      const syncBadge = () => { badgeDst.textContent = badgeSrc.textContent; };
      syncBadge();
      new MutationObserver(syncBadge).observe(badgeSrc, { childList: true, characterData: true, subtree: true });
    }
  }
})();

// ---------- Carrossel de Banner Panorâmico em Alta Definição no Hero ----------
(function initHeroBannerSlider() {
  const HERO_SLIDES = [
    'images/banner-slide-1.jpg',
    'images/banner-slide-2.jpg',
    'images/banner-slide-3.jpg',
    'images/banner-slide-4.jpg'
  ];

  let currentSlide = 0;
  let timer = null;

  function goToSlide(idx) {
    const bannerImg = document.getElementById('heroBannerImg');
    const dots = document.querySelectorAll('#heroDots span');

    if (!bannerImg) return;
    currentSlide = (idx + HERO_SLIDES.length) % HERO_SLIDES.length;
    const nextSrc = HERO_SLIDES[currentSlide];

    // Efeito suave de transição: fade out, troca a imagem widescreen, fade in
    bannerImg.classList.add('fading');

    setTimeout(() => {
      bannerImg.src = nextSrc;
      bannerImg.classList.remove('fading');
    }, 240);

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  function startRotation() {
    stopRotation();
    timer = setInterval(() => {
      goToSlide(currentSlide + 1);
    }, 3600);
  }

  function stopRotation() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function init() {
    const container = document.getElementById('heroBannerContainer');
    const dots = document.querySelectorAll('#heroDots span');

    dots.forEach((dot, idx) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(idx);
        startRotation();
      });
    });

    if (container) {
      container.addEventListener('click', () => {
        goToSlide(currentSlide + 1);
        startRotation();
      });
      container.addEventListener('mouseenter', stopRotation);
      container.addEventListener('mouseleave', startRotation);

      // Suporte a toque / swipe no celular
      let touchStartX = 0;
      container.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX;
        stopRotation();
      }, { passive: true });
      container.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const touchEndX = e.changedTouches[0].clientX;
          if (touchStartX - touchEndX > 35) {
            goToSlide(currentSlide + 1);
          } else if (touchEndX - touchStartX > 35) {
            goToSlide(currentSlide - 1);
          }
        }
        startRotation();
      }, { passive: true });
    }

    startRotation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();




/* ==========================================================================
   CARDS DE PEÇAS AO LADO DO BANNER (somente desktop)
   Usa exclusivamente peças reais do catálogo (mesma API das ofertas) e vai
   trocando o trio exibido, sem inventar marca, preço ou disponibilidade.
   ========================================================================== */
(function heroSideCards() {
  function start() {
    const box = document.getElementById('heroSideCards');
    if (!box) return;

    const SLOTS = 3;
    let items = [];
    let offset = 0;
    let timer = null;

    function cardHtml(p) {
      const photo = getLojaPrimaryPhoto(p);
      const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
      const pixVal = priceVal * (1 - (typeof PIX_DISCOUNT_RATE !== 'undefined' ? PIX_DISCOUNT_RATE : 0.04));
      return `
        <button type="button" class="hero-side-card" data-product-id="${p.id}" title="${p.name}">
          <span class="hsc-img"><img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;"></span>
          <span class="hsc-text">
            <span class="hsc-cat">${p.category || 'Peça'}</span>
            <span class="hsc-name">${p.name}</span>
            <span class="hsc-price"><small>À vista no Pix</small><b>${money(pixVal)}</b></span>
          </span>
        </button>`;
    }

    function render() {
      if (!items.length) return;
      const slice = [];
      for (let i = 0; i < SLOTS; i++) slice.push(items[(offset + i) % items.length]);
      box.innerHTML = slice.map(cardHtml).join('');
      box.querySelectorAll('.hero-side-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.productId;
          const prod = items.find((p) => String(p.id) === String(id));
          if (typeof openProductDetails === 'function') openProductDetails(id, prod);
        });
      });
    }

    function rotate() {
      if (window.innerWidth < 761 || items.length <= SLOTS) return;
      box.classList.add('swapping');
      setTimeout(() => {
        offset = (offset + SLOTS) % items.length;
        render();
        box.classList.remove('swapping');
      }, 250);
    }

    async function fetchProducts() {
      let rawList = [];
      let heroApiOk = false;
      try {
        const r = await fetch('/api/products/categories/featured?_t=' + Date.now(), { cache: 'no-store' });
        const data = await r.json();
        rawList = data.products || data.categories || (Array.isArray(data.featured) ? data.featured.map(f => f.product || f) : []);
        heroApiOk = true;
      } catch (e) {
        console.warn('Falha ao buscar hero side cards na API:', e);
      }

      if (!heroApiOk || !rawList.length) {
        try {
          const r2 = await fetch('/api/products?_t=' + Date.now(), { cache: 'no-store' });
          const d2 = await r2.json();
          rawList = d2.products || [];
          heroApiOk = true;
        } catch (_) {}
      }

      if (!heroApiOk && !rawList.length) {
        rawList = (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS.slice() : [];
      }

      const filteredList = rawList.filter((p) => {
        const v = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        return v > 0 && p.inStock !== false;
      });
      const realList = filteredList.filter((p) => typeof isLojaRealWmsProduct === 'function' ? isLojaRealWmsProduct(p) : true);
      const eligible = prioritizeRealProducts(realList.length > 0 ? realList : filteredList);

      // Intercala as categorias para que os três cards visíveis nunca
      // fiquem todos da mesma categoria.
      const buckets = new Map();
      eligible.forEach((p) => {
        const cat = p.category || 'Geral';
        if (!buckets.has(cat)) buckets.set(cat, []);
        buckets.get(cat).push(p);
      });
      const lists = Array.from(buckets.values());
      items = [];
      for (let i = 0; items.length < eligible.length; i++) {
        lists.forEach((l) => { if (l[i]) items.push(l[i]); });
      }
      if (items.length < SLOTS) {
        items = eligible.slice();
      }
      if (items.length === 0) return;
      render();

      if (timer) clearInterval(timer);
      timer = setInterval(rotate, 4500);
      box.addEventListener('mouseenter', () => { if (timer) { clearInterval(timer); timer = null; } });
      box.addEventListener('mouseleave', () => { if (!timer) timer = setInterval(rotate, 4500); });
    }

    // Inicialização instantânea com catálogo fallback para não deixar espaço vazio
    if (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined' && CATALOG_FALLBACK_PRODUCTS.length) {
      items = CATALOG_FALLBACK_PRODUCTS.slice();
      render();
      if (!timer) timer = setInterval(rotate, 4500);
    }
    fetchProducts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ==========================================================================
   TEMA CLARO / ESCURO
   O site abre por padrão SEMPRE no MODO BRANCO (CLARO). O botão do cabeçalho
   permite alternar para o escuro e a escolha fica guardada para visitas futuras.
   ========================================================================== */
(function alternadorDeTema() {
  const CHAVE_V2 = 'fahren-tema-v2';
  const CHAVE_LEGADA = 'fahren-tema';
  const CORES_BARRA = { escuro: '#090a0c', claro: '#f4f6f9' };
  let temaAtual = 'claro';

  try {
    const salvoV2 = localStorage.getItem(CHAVE_V2);
    if (salvoV2 === 'escuro') {
      temaAtual = 'escuro';
    } else {
      temaAtual = 'claro';
      localStorage.setItem(CHAVE_V2, 'claro');
      localStorage.setItem(CHAVE_LEGADA, 'claro');
    }
  } catch (e) {}

  function aplicar(tema) {
    temaAtual = tema;
    document.body.classList.toggle('tema-claro', tema === 'claro');
    const botao = document.getElementById('themeToggle');
    if (botao) {
      botao.setAttribute('aria-pressed', tema === 'claro' ? 'true' : 'false');
      botao.title = tema === 'claro' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', CORES_BARRA[tema]);
  }

  function iniciar() {
    aplicar(temaAtual);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const novo = temaAtual === 'claro' ? 'escuro' : 'claro';
      try {
        localStorage.setItem(CHAVE_V2, novo);
        localStorage.setItem(CHAVE_LEGADA, novo);
      } catch (e) {}
      aplicar(novo);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();

/* ==========================================================================
   SINCRONIZAÇÃO TOTAL EM TEMPO REAL (WMS ADMIN <-> LOJA VIRTUAL)
   ========================================================================== */
function broadcastSync(type, data = {}) {
  try {
    const ch = new BroadcastChannel('fahren_wms_sync');
    ch.postMessage({ type, data, timestamp: Date.now() });
    ch.close();
  } catch (e) {}
  try {
    localStorage.setItem('fahren_sync_event', JSON.stringify({ type, data, timestamp: Date.now() }));
  } catch (e) {}
}
window.broadcastSync = broadcastSync;

// Detecta se o cliente está tocando/rolando a tela agora (não atualizamos nada nesse momento)
let __userInteractingUntil = 0;
['touchstart', 'touchmove', 'touchend', 'wheel', 'keydown'].forEach(evt => {
  window.addEventListener(evt, () => { __userInteractingUntil = Date.now() + 1500; }, { passive: true });
});

let __stockRefreshRunning = false;
async function refreshLojaStockData() {
  if (__stockRefreshRunning) return;
  // Se o usuário estiver arrastando a tela, adia a atualização para não "puxar" a rolagem
  if (Date.now() < __userInteractingUntil) {
    setTimeout(refreshLojaStockData, 1600);
    return;
  }
  __stockRefreshRunning = true;
  const savedY = window.scrollY;
  try {
    const tasks = [loadCategories(), loadCategoryCarousel()];
    if (typeof window.loadCategoryCounts === 'function') {
      tasks.push(window.loadCategoryCounts());
    }
    const catalogEl = document.getElementById('catalogResults');
    const catalogHasContent = Boolean(catalogEl && catalogEl.children.length > 0);
    // Atualiza o catálogo se estiver visível ou já tiver sido renderizado (mantendo cards sincronizados)
    if (typeof loadCatalog === 'function' && ((typeof currentScreenId !== 'undefined' && currentScreenId === 'pecas') || catalogHasContent)) {
      tasks.push(loadCatalog());
    }
    // Na tela da peça: atualiza só preço/estoque, em modo silencioso (sem trocar de tela nem rolar)
    if (typeof currentScreenId !== 'undefined' && currentScreenId === 'produto' && currentProduct && currentProduct.id && typeof openProductDetails === 'function') {
      tasks.push(openProductDetails(currentProduct.id, null, false, { silent: true }));
    }
    await Promise.allSettled(tasks);
  } catch (e) {
  } finally {
    __stockRefreshRunning = false;
    // Garantia final: se algo alterou a rolagem e o usuário não estava mexendo, devolve à posição original
    if (Date.now() >= __userInteractingUntil && Math.abs(window.scrollY - savedY) > 2) {
      window.scrollTo({ top: savedY, behavior: 'auto' });
    }
  }
}
window.refreshLojaStockData = refreshLojaStockData;

(function initStoreSyncChannel() {
  const handleSyncEvent = (evtData) => {
    if (!evtData || !evtData.type) return;
    refreshLojaStockData();
  };

  try {
    const ch = new BroadcastChannel('fahren_wms_sync');
    ch.onmessage = (e) => handleSyncEvent(e.data);
  } catch (e) {}

  window.addEventListener('storage', (e) => {
    if (e.key === 'fahren_sync_event' && e.newValue) {
      try {
        handleSyncEvent(JSON.parse(e.newValue));
      } catch (err) {}
    }
  });

  // Polling a cada 15 segundos para atualizar estoque mesmo entre dispositivos distintos
  setInterval(() => {
    refreshLojaStockData();
  }, 15000);

  // Atualiza ao voltar para a aba ou janela
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshLojaStockData();
  });
  window.addEventListener('focus', () => {
    refreshLojaStockData();
  });
})();

// Sincronização automática quando o usuário volta para a aba no PC ou Celular
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser) {
    syncCartWithServer();
  }
});
window.addEventListener('focus', () => {
  if (currentUser) {
    syncCartWithServer();
  }
});

// Polling suave em segundo plano para refletir mudanças do celular no desktop sem recarregar
setInterval(() => { if (currentUser) syncCartWithServer(); }, 3500);
