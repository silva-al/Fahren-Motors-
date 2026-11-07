// Módulo WMS: 01-state-and-helpers.js
// Fahren Motors - Painel de Gestão WMS

// Cache de renderização de abas para troca instantânea (0ms) sem travamentos
const _wmsTabRenderCache = {
  productsCount: -1,
  ordersCount: -1,
  lastAlertsFetch: 0,
  lastOperationsFetch: 0,
  lastMovementsFetch: 0,
  lastInventoryFetch: 0,
  initializedPanes: new Set(),
};

// ===================================================================
// FAHREN MOTORS — PAINEL DE GESTÃO WMS & MÓDULO FISCAL / FINANCEIRO
// ===================================================================

const API = '/api';
let currentAdmin = null;
let allProducts = [];
try {
  Object.defineProperty(window, 'allProducts', {
    get: () => allProducts,
    set: (val) => { allProducts = Array.isArray(val) ? val : []; },
    configurable: true,
  });
} catch (e) {
  window.allProducts = allProducts;
}
let allOrders = [];
let editingProductId = null;

// Configuração Fiscal da Empresa
const FISCAL_CONFIG = {
  razaoSocial: 'FAHREN MOTORS LTDA',
  nomeFantasia: 'FAHREN MOTORS',
  cnpj: '47.784.317/0001-20',
  ie: '338.419.820.114',
  logradouro: 'Av. Santana, 1420 - Parque Hortolândia',
  cidade: 'Hortolândia',
  uf: 'SP',
  cep: '13184-000',
  telefone: '(19) 99876-5432'
};

// Helper de API
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) throw new Error((data && data.error) || 'Ocorreu um erro na requisição.');
  return data;
}

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

async function quickAddStock(id, qty) {
  const p = allProducts.find(x => String(x.id) === String(id));
  if (!p) return;
  const current = Number(p.stockQty) || 0;
  const newStock = current + Number(qty);
  try {
    await api(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ stockQty: newStock, inStock: newStock > 0 })
    });
    showToast(`+${qty} un. adicionadas a "${p.name}" (Saldo: ${newStock})`);
    await refreshAllData();
    broadcastSync('STOCK_UPDATED');
  } catch (err) {
    showToast('Erro ao atualizar estoque: ' + err.message);
  }
}
window.quickAddStock = quickAddStock;

let adminSyncInitialized = false;
function initAdminSyncChannel() {
  if (adminSyncInitialized) return;
  adminSyncInitialized = true;

  const handleSyncEvent = async (evtData) => {
    if (!evtData || !evtData.type) return;
    console.log('[WMS Sync] Evento recebido no Admin:', evtData.type);
    
    // Atualiza todos os dados em background
    await refreshAllData();

    if (evtData.type === 'ORDER_CREATED') {
      showToast('🔔 Novo pedido recebido da loja virtual!');
    }
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

  // Polling automático a cada 15 segundos se admin estiver logado
  setInterval(() => {
    if (currentAdmin) {
      refreshAllData();
    }
  }, 15000);

  // Sincroniza ao focar na janela
  window.addEventListener('focus', () => {
    if (currentAdmin) {
      refreshAllData();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentAdmin) {
      refreshAllData();
    }
  });
}
window.initAdminSyncChannel = initAdminSyncChannel;

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}


function formatDateOnly(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR');
}

function formatTimeOnly(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const WMS_NO_PHOTO_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
  '<rect width="80" height="80" rx="10" fill="#1e2430"/>' +
  '<rect x="18" y="22" width="44" height="36" rx="5" fill="none" stroke="#64748b" stroke-width="2.5"/>' +
  '<circle cx="31" cy="34" r="4" fill="#64748b"/>' +
  '<path d="M21 53l12-11 9 8 7-6 10 9" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>'
);
window.WMS_NO_PHOTO_SVG = WMS_NO_PHOTO_SVG;

function getProductPhoto(p) {
  if (!p) return WMS_NO_PHOTO_SVG;
  let photo = '';
  if (typeof p === 'string') {
    photo = p;
  } else if (p && Array.isArray(p.photos)) {
    photo = p.photos.length ? p.photos[0] : (p.photo_url || p.photoUrl || '');
  } else if (p) {
    photo = p.photo_url || p.photoUrl || p.photo || p.product_photo || '';
  }
  if (!photo) {
    return WMS_NO_PHOTO_SVG;
  }
  photo = String(photo).trim();
  if (photo.startsWith('[')) {
    try {
      const arr = JSON.parse(photo);
      photo = (Array.isArray(arr) && arr.length) ? arr[0] : '';
    } catch {
      photo = '';
    }
  } else if (photo.includes(',')) {
    photo = photo.split(',')[0].trim();
  }
  if (!photo) return WMS_NO_PHOTO_SVG;
  if (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('data:')) {
    return photo;
  }
  if (photo.startsWith('/loja/')) {
    photo = photo.replace(/^\/loja\//, '/');
  } else if (photo.startsWith('loja/')) {
    photo = photo.replace(/^loja\//, '/');
  }
  if (!photo.startsWith('/')) {
    photo = '/' + photo;
  }
  return photo;
}
window.getProductPhoto = getProductPhoto;
