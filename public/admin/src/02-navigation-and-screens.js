// Módulo WMS: 02-navigation-and-screens.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Controle de Telas (Login vs Main) ----------
function showLogin() {
  document.documentElement.classList.remove('has-admin-session');
  try { localStorage.removeItem('fm_admin_session'); } catch {}
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainScreen').classList.add('hidden');
}

function showMain(admin) {
  currentAdmin = admin;
  document.documentElement.classList.add('has-admin-session');
  try {
    localStorage.setItem('fm_admin_session', JSON.stringify(admin));
  } catch (e) {}
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
  const nameEl = document.getElementById('adminName');
  if (nameEl) nameEl.textContent = admin.name || admin.email || 'Administrador';

  // Restaura a aba onde o usuário estava antes de recarregar
  const targetTab = getInitialTab();
  switchTab(targetTab, false, false);

  // Carrega dados do sistema preservando a rolagem onde o usuário estava
  refreshAllData();
  initAdminSyncChannel();

  try {
    const savedScroll = sessionStorage.getItem('fm_admin_scroll_y_' + targetTab);
    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo({ top: parseInt(savedScroll, 10) || 0, behavior: 'instant' });
      }, 120);
    }
  } catch (e) {}
}

// ---------- Relógio Digital em Tempo Real (Apenas Hora) ----------
function startLiveClock() {
  function update() {
    const now = new Date();
    const clockEl = document.getElementById('liveClockText');
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
    const dateEl = document.getElementById('liveDateText');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  }
  update();
  setInterval(update, 1000);
}

// ---------- Navegação por Abas do WMS ----------
const VALID_TABS = [
  'dashboard', 'produtos', 'pecas', 'estoque', 'pedidos', 'vendas',
  'operacoes-estoque', 'movimentacoes', 'inventario', 'localizacoes', 'alertas',
  'armazem', 'expedicao', 'financeiro', 'notas-fiscais', 'relatorios', 'configuracoes'
];
let currentTabId = 'dashboard';
const tabHistory = ['dashboard'];

function getInitialTab() {
  const hash = (window.location.hash || '').replace('#', '').trim();
  if (VALID_TABS.includes(hash)) return hash;
  try {
    const saved = localStorage.getItem('fm_admin_active_tab');
    if (VALID_TABS.includes(saved)) return saved;
  } catch (e) {}
  return 'dashboard';
}

function switchTab(tabId, pushHistory = true, resetScroll = true) {
  if (!VALID_TABS.includes(tabId)) tabId = 'dashboard';

  if (pushHistory && tabId !== currentTabId) {
    tabHistory.push(tabId);
  }
  currentTabId = tabId;

  // Persiste a aba atual para que F5 ou atualização mantenha o usuário exatamente aqui
  try {
    document.documentElement.setAttribute('data-active-tab', tabId);
    try { localStorage.setItem('fm_admin_active_tab', tabId); } catch (e) {}
    if (window.location.hash !== `#${tabId}`) {
      history.replaceState(null, '', `#${tabId}`);
    }
  } catch (e) {}

  let activePaneId = `pane-${tabId}`;
  let activeNavTab = tabId;
  if (tabId === 'estoque') {
    activePaneId = 'pane-produtos';
    activeNavTab = 'produtos';
  } else if (tabId === 'armazem') {
    activePaneId = 'pane-localizacoes';
    activeNavTab = 'localizacoes';
  }

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeNavTab);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === activePaneId);
  });

  if (resetScroll) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Transição fluida de abas: alterna UI no frame 0 e defere renders pesados
  requestAnimationFrame(() => {
    setTimeout(() => {
      if (tabId === 'dashboard') {
        updateDashboardMetrics();
        loadStockAlerts();
      }
      if (tabId === 'produtos' || tabId === 'estoque') renderProductsTable(allProducts);
      if (tabId === 'pecas') {
        if (!editingProductId) {
          resetProductForm();
        }
        const formPanel = document.getElementById('productFormPanel');
        if (formPanel) formPanel.classList.remove('hidden');
      }
      if (tabId === 'pedidos') renderOrdersTable(allOrders);
      if (tabId === 'vendas') renderVendas();
      if (tabId === 'operacoes-estoque') loadRecentOperations();
      if (tabId === 'movimentacoes') loadStockMovements();
      if (tabId === 'inventario') loadInventoryAudit();
      if (tabId === 'localizacoes' || tabId === 'armazem') renderWarehouseLocation();
      if (tabId === 'alertas') loadStockAlerts();
      if (tabId === 'expedicao') renderExpedicao();
      if (tabId === 'financeiro') renderFinances();
      if (tabId === 'notas-fiscais') renderFiscalTable();
      if (tabId === 'relatorios') renderRelatorios();
      if (tabId === 'armazem') {
        const rackEl = document.querySelector('.rack-widget-card');
        if (rackEl) rackEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  });
}

// Abertura de formulário de cadastro de peça 100% LIMPO e DO ZERO
function openNewProductForm() {
  editingProductId = null;
  resetProductForm();
  switchTab('pecas');
  setTimeout(() => {
    const el = document.getElementById('pName');
    if (el) el.focus();
  }, 60);
}

window.openNewProductForm = openNewProductForm;
window.openNewPieceForm = openNewProductForm;
window.switchTab = switchTab;

window.addEventListener('hashchange', () => {
  const hash = (window.location.hash || '').replace('#', '').trim();
  if (VALID_TABS.includes(hash) && hash !== currentTabId) {
    switchTab(hash, false, false);
  }
});

window.addEventListener('beforeunload', () => {
  try {
    sessionStorage.setItem('fm_admin_scroll_y_' + currentTabId, window.pageYOffset || 0);
  } catch (e) {}
});

document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
