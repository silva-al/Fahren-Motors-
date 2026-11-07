// Módulo WMS: 03-data-sync.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Carregamento Global de Dados ----------
let _pendingPhotoSaveCount = 0;

async function refreshAllData() {
  const initialTab = currentTabId;
  const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
  
  // 1. Renderização Otimista APENAS no carregamento frio inicial (memória vazia),
  // nunca sobrescrevendo allProducts já carregado em memória com cache antigo do localStorage.
  try {
    const needColdProducts = !Array.isArray(allProducts) || allProducts.length === 0;
    const needColdOrders = !Array.isArray(allOrders) || allOrders.length === 0;
    const cachedProducts = needColdProducts ? localStorage.getItem('fm_cache_products') : null;
    const cachedOrders = needColdOrders ? localStorage.getItem('fm_cache_orders') : null;
    if (cachedProducts) {
      allProducts = JSON.parse(cachedProducts);
      renderProductsTable(allProducts);
      renderCommercialProductsTable(allProducts);
      fillCategoryList(allProducts);
    }
    if (cachedOrders) {
      allOrders = JSON.parse(cachedOrders);
      renderOrdersTable(allOrders);
      const badge = document.getElementById('ordersCountBadge');
      if (badge) badge.textContent = allOrders.filter(o => o.status !== 'cancelado').length;
      const nfBadge = document.getElementById('nfCountBadge');
      if (nfBadge) nfBadge.textContent = allOrders.length;
    }
    if (cachedProducts || cachedOrders) {
      updateDashboardMetrics();
      renderFinances();
      renderFiscalTable();
      renderExpedicao();
      renderVendas();
      renderRelatorios();
      updateStockTabsBadges();
    }
  } catch (e) {}

  // 2. Fetch em background para garantir os dados mais recentes do servidor
  try {
    const [productsRes, ordersRes] = await Promise.allSettled([
      api('/products?in_stock=&_t=' + Date.now()),
      api('/orders?_t=' + Date.now())
    ]);

    if (productsRes.status === 'fulfilled' && productsRes.value && _pendingPhotoSaveCount === 0) {
      allProducts = productsRes.value.products || [];
      try { localStorage.setItem('fm_cache_products', JSON.stringify(allProducts)); } catch (e) {}
      renderProductsTable(allProducts);
      renderCommercialProductsTable(allProducts);
      fillCategoryList(allProducts);
    }
    if (ordersRes.status === 'fulfilled' && ordersRes.value) {
      allOrders = ordersRes.value.orders || [];
      try { localStorage.setItem('fm_cache_orders', JSON.stringify(allOrders)); } catch (e) {}
      renderOrdersTable(allOrders);
      const badge = document.getElementById('ordersCountBadge');
      if (badge) badge.textContent = allOrders.filter(o => o.status !== 'cancelado').length;
      const nfBadge = document.getElementById('nfCountBadge');
      if (nfBadge) nfBadge.textContent = allOrders.length;
    }

    updateDashboardMetrics();
    renderFinances();
    renderFiscalTable();
    renderExpedicao();
    renderVendas();
    renderRelatorios();
    updateStockTabsBadges();
    fetchIssuedNfsFromApi();

    // Mantém a rolagem exatamente no mesmo lugar onde o usuário estava SOMENTE se ainda estiver na mesma aba
    if (currentY > 0 && currentTabId === initialTab) {
      setTimeout(() => {
        window.scrollTo({ top: currentY, behavior: 'instant' });
      }, 50);
    }
  } catch (err) {
    console.error('Erro ao atualizar dados:', err);
  }
}
window.refreshAllData = refreshAllData;

// Notificação toast elegante e moderna
function showToast(msg = 'Sistema atualizado com sucesso!') {
  const toast = document.getElementById('wmsToast');
  const msgEl = document.getElementById('wmsToastMsg');
  if (!toast) return;
  if (msgEl) msgEl.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// Copia chave de acesso da NF-e para a área de transferência
window.copyAccessKey = async (btn, key) => {
  try {
    await navigator.clipboard.writeText(key);
    const svg = btn.querySelector('svg');
    if (svg) {
      const original = svg.innerHTML;
      svg.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
      svg.style.color = 'var(--accent-green)';
      btn.style.color = 'var(--accent-green)';
      setTimeout(() => {
        svg.innerHTML = original;
        svg.style.color = '';
        btn.style.color = 'var(--text-muted)';
      }, 1500);
    }
    showToast('Chave de acesso copiada!');
  } catch {
    showToast('Não foi possível copiar.');
  }
};


const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('is-refreshing');
    showToast('Atualizando dados em tempo real...');
    try {
      await refreshAllData();
      showToast('Dados atualizados com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar dados:', err);
      showToast('Erro ao atualizar dados: ' + (err.message || err));
    } finally {
      setTimeout(() => {
        refreshBtn.classList.remove('is-refreshing');
      }, 700);
    }
  });
}
