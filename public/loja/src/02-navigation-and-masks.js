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
    openProductDetails(st.productId, null, false);
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
  if (navDepth > 0) {
    window.history.back();
  } else if (currentScreenId === 'produto') {
    show('pecas');
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
      const catInput = document.getElementById('catalogSearch');
      if (catInput) catInput.value = '';
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) catSelect.value = '';
    }
    loadCatalog();
  }
  if (id === 'carrinho') renderCart();
  if (id === 'perfil') loadMyOrders();

    try {
    sessionStorage.setItem('fahren-last-screen', id);
  } catch {}

  if (push) {
    const depth = (window.history.state && typeof window.history.state.depth === 'number') ? window.history.state.depth + 1 : 1;
    const targetHash = (id === 'inicio' ? '' : '#' + id);
    window.history.pushState({ screen: id, depth }, '', targetHash || window.location.pathname);
    navDepth = depth;
  } else {
    try {
      const targetHash = (id === 'inicio' ? '' : '#' + id);
      window.history.replaceState({ screen: id, depth: navDepth }, '', targetHash || window.location.pathname);
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
      // Limpa qualquer filtro residual para garantir exibição completa do catálogo
      const catInput = document.getElementById('catalogSearch');
      if (catInput) catInput.value = '';
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) catSelect.value = '';
    }
    show(dest);
    if (dest === 'pecas') {
      if (typeof loadCatalog === 'function') loadCatalog();
    }
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
