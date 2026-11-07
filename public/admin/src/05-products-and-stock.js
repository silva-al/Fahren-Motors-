// Módulo WMS: 05-products-and-stock.js
// Fahren Motors - Painel de Gestão WMS

// ---------- 2. ESTOQUE & PRODUTOS (WMS & LOCALIZAÇÃO) ----------

// Helper de Localização no Armazém WMS
function getProductLocation(p) {
  if (p && p.location && p.location.trim()) return p.location.trim().toUpperCase();
  const cats = {
    'ignição': 'A', 'ignicao': 'A', 'elétrica': 'A', 'eletrica': 'A',
    'freios': 'B', 'freio': 'B',
    'suspensão': 'C', 'suspensao': 'C',
    'filtros': 'D', 'filtro': 'D',
    'sensores': 'E', 'sensor': 'E',
    'correias': 'F', 'correia': 'F',
    'arrefecimento': 'G', 'fluidos': 'H'
  };
  const catNorm = (p && p.category ? p.category : '').toLowerCase().trim();
  let aisle = 'A';
  for (const k in cats) {
    if (catNorm.includes(k)) { aisle = cats[k]; break; }
  }
  const shelf = String((Math.abs(Number(p && p.id) || 1) % 4) + 1).padStart(2, '0');
  const pos = String(((Math.abs(Number(p && p.id) || 1) * 3) % 6) + 1).padStart(2, '0');
  return `${aisle}-${shelf}-${pos}`;
}
window.getProductLocation = getProductLocation;

function selectWarehouseLocation(loc, prodName = '') {
  const cleanLoc = String(loc || 'A-02-03').trim().toUpperCase();
  const parts = cleanLoc.split('-');
  const corredor = parts[0] || 'A';
  const estante = parts[1] || '02';
  const posicao = parts[2] || '03';

  const selEl = document.getElementById('rackSelectedLocation');
  if (selEl) selEl.textContent = cleanLoc;
  const cEl = document.getElementById('rackCorredor');
  if (cEl) cEl.textContent = corredor;
  const eEl = document.getElementById('rackEstante');
  if (eEl) eEl.textContent = estante;
  const pEl = document.getElementById('rackPosicao');
  if (pEl) pEl.textContent = posicao;

  // Ajusta a posição do Pin no SVG isométrico do armazém
  const pin = document.querySelector('.rack-pin-group');
  if (pin) {
    const shelfNum = Math.min(3, Math.max(1, parseInt(estante, 10) || 2));
    const posNum = Math.min(6, Math.max(1, parseInt(posicao, 10) || 3));
    const y = 42 + (shelfNum - 1) * 43;
    const x = 70 + (posNum - 1) * 26;
    pin.setAttribute('transform', `translate(${x}, ${y})`);
  }

  // Destaca a linha selecionada
  document.querySelectorAll('.prod-row').forEach(row => {
    const locBadge = row.querySelector('.location-badge');
    if (locBadge && locBadge.textContent.trim() === cleanLoc) {
      row.classList.add('selected-rack-row');
    } else {
      row.classList.remove('selected-rack-row');
    }
  });

  if (prodName) {
    showToast(`Posição: Corredor ${corredor} • Estante ${estante} • Posição ${posicao}`);
  }
}
window.selectWarehouseLocation = selectWarehouseLocation;

function updateStockTabsBadges() {
  const total = allProducts.length;
  const inStock = allProducts.filter(p => Number(p.stockQty) > 5).length;
  const lowStock = allProducts.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5).length;
  const outStock = allProducts.filter(p => Number(p.stockQty) <= 0).length;

  const bAll = document.getElementById('stockBadgeAll');
  if (bAll) bAll.textContent = total;
  const bLow = document.getElementById('stockBadgeLow');
  if (bLow) bLow.textContent = lowStock;
  const bZero = document.getElementById('stockBadgeZero');
  if (bZero) bZero.textContent = outStock;

  // Atualiza também os badges do relatório
  const rAll = document.getElementById('repBadgeAll');
  if (rAll) rAll.textContent = total;
  const rZero = document.getElementById('repBadgeZero');
  if (rZero) rZero.textContent = outStock;
  const rLow = document.getElementById('repBadgeLow');
  if (rLow) rLow.textContent = lowStock;
  const rNormal = document.getElementById('repBadgeNormal');
  if (rNormal) rNormal.textContent = inStock;
}
window.updateStockTabsBadges = updateStockTabsBadges;

let currentStockFilter = '';
function filterProductsByStock(type) {
  currentStockFilter = type || '';
  document.querySelectorAll('.est-tabs-bar .est-tab-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.filter || '') === currentStockFilter);
  });

  let filtered = allProducts;
  if (currentStockFilter === 'in_stock') {
    filtered = allProducts.filter(p => Number(p.stockQty) > 5);
  } else if (currentStockFilter === 'low_stock' || currentStockFilter === 'baixo') {
    filtered = allProducts.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5);
  } else if (currentStockFilter === 'out_of_stock' || currentStockFilter === 'zero' || currentStockFilter === 'zerado') {
    filtered = allProducts.filter(p => Number(p.stockQty) <= 0);
  }
  renderProductsTable(filtered, currentStockFilter);
}
window.filterProductsByStock = filterProductsByStock;

function exportStockCSV() {
  if (!allProducts || !allProducts.length) {
    showToast('Nenhuma peça para exportar.');
    return;
  }
  const headers = ['Código', 'Peça', 'Categoria', 'Estoque', 'Localização', 'Preço (R$)', 'Status'];
  const rows = allProducts.map(p => {
    const loc = getProductLocation(p);
    const stock = Number(p.stockQty) || 0;
    const st = stock > 5 ? 'Disponível' : (stock > 0 ? 'Estoque Baixo' : 'Sem Estoque');
    return [
      `"${(p.code || '').replace(/"/g, '""')}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      stock,
      `"${loc}"`,
      Number(p.price || 0).toFixed(2),
      `"${st}"`
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `relatorio_estoque_wms_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Relatório de estoque baixado com sucesso!');
}
window.exportStockCSV = exportStockCSV;

function openAllLocationsModal() {
  const locsMap = {};
  allProducts.forEach(p => {
    const loc = getProductLocation(p);
    if (!locsMap[loc]) locsMap[loc] = [];
    locsMap[loc].push(p.name);
  });
  const count = Object.keys(locsMap).length;
  showToast(`Mapeamento WMS: ${count} posições ativas distribuídas nas estantes.`);
}
window.openAllLocationsModal = openAllLocationsModal;

function renderProductsTable(products, activeFilter = null) {
  const tbody = document.getElementById('productsTableBody');
  const summary = document.getElementById('stockTableSummary');
  if (summary) summary.textContent = `${products.length} peça(s) encontrada(s)`;

  // Atualiza os 4 KPIs de Estoque
  const total = allProducts.length;
  const inStock = allProducts.filter(p => Number(p.stockQty) > 5).length;
  const lowStock = allProducts.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5).length;
  const outStock = allProducts.filter(p => Number(p.stockQty) <= 0).length;

  const elTotal = document.getElementById('estTotalVal');
  if (elTotal) elTotal.textContent = total;
  const elInStock = document.getElementById('estInStockVal');
  if (elInStock) elInStock.textContent = inStock;
  const elLowStock = document.getElementById('estLowStockVal');
  if (elLowStock) elLowStock.textContent = lowStock;
  const elOutStock = document.getElementById('estOutStockVal');
  if (elOutStock) elOutStock.textContent = outStock;

  // Atualiza badges em tempo real
  updateStockTabsBadges();

  // Inicializa o widget de localização com o primeiro produto se ainda não tiver
  if (!window._rackInitialized && products.length > 0) {
    window._rackInitialized = true;
    selectWarehouseLocation(getProductLocation(products[0]));
  }

  if (!tbody) return;

  if (!products.length) {
    const filter = activeFilter !== null ? activeFilter : currentStockFilter;
    if (filter === 'out_of_stock' || filter === 'zero' || filter === 'zerado') {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:45px 20px;">
            <div style="max-width:460px;margin:0 auto;padding:26px 22px;background:rgba(255,255,255,0.03);border:1px solid var(--panel-border);border-radius:14px;">
              <div style="font-size:38px;margin-bottom:12px;">🎉</div>
              <h3 style="margin:0 0 8px;font-size:16px;color:var(--text-primary,#fff);font-weight:700;">Nenhuma peça com estoque zerado!</h3>
              <p style="margin:0 0 16px;font-size:13px;color:var(--text-muted,#8c929a);line-height:1.5;">
                Excelente! Todas as <strong>${total}</strong> peças cadastradas possuem saldo em estoque no armazém da Fahren Motors.
              </p>
              <button class="btn btn-secondary btn-sm" onclick="filterProductsByStock('')" style="display:inline-flex;align-items:center;gap:6px;">
                Ver Todas as Peças (${total})
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhuma peça encontrada no catálogo.</td></tr>';
    }
    return;
  }

  tbody.innerHTML = products.map(p => {
    const photo = getProductPhoto(p);
    const loc = getProductLocation(p);
    const stockNum = Number(p.stockQty) || 0;

    let statusHtml = '';
    if (stockNum > 5) {
      statusHtml = '<span class="status-badge pronto" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0">Disponível</span>';
    } else if (stockNum > 0) {
      statusHtml = '<span class="status-badge em_preparacao" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a">Baixo</span>';
    } else {
      statusHtml = '<span class="status-badge cancelado" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">Sem Estoque</span>';
    }

    return `
      <tr data-prod-row="${p.id}" class="prod-row">
        <td style="width:40px;cursor:pointer" data-view="${p.id}" title="Clique para ver detalhes">
          <img src="${photo}" alt="" class="prod-thumb-img" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
        </td>
        <td style="cursor:pointer" data-view="${p.id}" title="Clique para ver detalhes">
          <strong class="prod-name-strong">${p.name}</strong>
        </td>
        <td>
          <span class="prod-sku-code" style="font-weight:700;font-family:monospace">${p.code || 'S/CÓD'}</span>
        </td>
        <td><span class="cat-pill-badge">${p.category || 'Geral'}</span></td>
        <td>
          <strong class="prod-price-text" style="color:var(--text-primary);font-weight:800;font-size:13px">${money(p.price)}</strong>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:4px">
            <div class="stock-control-cell">
              <button type="button" class="btn-stock-qty" data-stock-step="-1" data-id="${p.id}" title="Subtrair 1 un">−</button>
              <input type="number" class="stock-num-input" value="${stockNum}" data-id="${p.id}" min="0" title="Altere e aperte Enter para salvar"/>
              <button type="button" class="btn-stock-qty" data-stock-step="1" data-id="${p.id}" title="Adicionar 1 un">+</button>
            </div>
            <button type="button" class="btn-stock-adjust" data-open-stock="${p.id}" title="Ajuste rápido (+5, +10, +50)">⚡</button>
          </div>
        </td>
        <td>
          <span class="location-badge" data-loc-badge="${p.id}" title="Corredor, Estante e Posição no armazém">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${loc}
          </span>
        </td>
        <td>
          ${statusHtml}
        </td>
        <td class="col-td-actions" style="text-align:center;white-space:nowrap;vertical-align:middle">
          <div class="prod-actions-stack">
            <button class="btn btn-secondary btn-sm btn-prod-action btn-prod-view" data-view="${p.id}" title="Ver detalhes completos da peça">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="pointer-events:none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span style="pointer-events:none">Ver</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-prod-action btn-prod-edit" data-edit="${p.id}" title="Editar dados da peça">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="pointer-events:none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span style="pointer-events:none">Editar</span>
            </button>
            <button class="btn btn-sm btn-prod-delete" data-remove="${p.id}" title="Excluir peça do catálogo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="pointer-events:none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span style="pointer-events:none">Excluir</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.prod-row').forEach(row => {
    row.onclick = () => {
      const p = allProducts.find(x => String(x.id) === String(row.dataset.prodRow));
      if (p) selectWarehouseLocation(getProductLocation(p), p.name);
    };
  });
  tbody.querySelectorAll('[data-loc-badge]').forEach(badge => {
    badge.onclick = (e) => {
      e.stopPropagation();
      const p = allProducts.find(x => String(x.id) === String(badge.dataset.locBadge));
      if (p) selectWarehouseLocation(getProductLocation(p), p.name);
    };
  });

  tbody.querySelectorAll('[data-view]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    openProductViewModal(b.dataset.view);
  });
  tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    startEdit(b.dataset.edit);
  });
  tbody.querySelectorAll('[data-remove]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    removeProduct(b.dataset.remove);
  });
  tbody.querySelectorAll('[data-open-stock]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    openStockModal(b.dataset.openStock);
  });

  // Cliques nos botões de + / -
  tbody.querySelectorAll('[data-stock-step]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const step = parseInt(b.dataset.stockStep, 10);
      const prod = allProducts.find(x => String(x.id) === String(id));
      if (!prod) return;
      const current = Number(prod.stockQty) || 0;
      quickUpdateStock(id, Math.max(0, current + step));
    };
  });

  // Alteração direta no input numérico de estoque
  tbody.querySelectorAll('.stock-num-input').forEach(inp => {
    const saveVal = () => {
      const id = inp.dataset.id;
      const val = Math.max(0, parseInt(inp.value, 10) || 0);
      quickUpdateStock(id, val);
    };
    inp.onchange = saveVal;
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') {
        inp.blur();
      }
    };
  });
}

// Atualização rápida de estoque via API
async function quickUpdateStock(id, newQty) {
  const prod = allProducts.find(x => String(x.id) === String(id));
  if (!prod) return;
  const qty = Math.max(0, parseInt(newQty, 10) || 0);
  try {
    await api(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ stockQty: qty, inStock: qty > 0 })
    });
    prod.stockQty = qty;
    prod.inStock = qty > 0;
    renderProductsTable(allProducts);
    renderRelatorios();
    updateStockTabsBadges();
    fetchIssuedNfsFromApi();
    updateDashboardMetrics();
    showToast(`Estoque de "${prod.name}" atualizado para ${qty} un.`);
  } catch (err) {
    console.error('Erro ao atualizar estoque:', err);
    showToast(err.message || 'Erro ao atualizar estoque');
  }
}
window.quickUpdateStock = quickUpdateStock;

// Adição rápida de estoque (+5, +10, etc.) no relatório e WMS
async function quickAddStock(productId, amount) {
  const prod = allProducts.find(x => String(x.id) === String(productId));
  if (!prod) return;
  const current = Number(prod.stockQty) || 0;
  const newQty = Math.max(0, current + amount);
  await quickUpdateStock(productId, newQty);
}
window.quickAddStock = quickAddStock;

// ---------- 8. RELATÓRIOS GERENCIAIS & AUDITORIA DE ESTOQUE WMS ----------
let currentRepFilter = 'all';

function filterRelatorios(filter) {
  currentRepFilter = filter || 'all';
  document.querySelectorAll('#repFilterButtons button').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.repFilter || '') === currentRepFilter);
  });
  renderRelatorios();
}
window.filterRelatorios = filterRelatorios;

function applyRelatoriosFilter() {
  renderRelatorios();
}
window.applyRelatoriosFilter = applyRelatoriosFilter;

function renderRelatorios() {
  const tbody = document.getElementById('relatoriosTableBody');
  if (!tbody) return;

  const total = allProducts.length;
  const inStock = allProducts.filter(p => Number(p.stockQty) > 5).length;
  const lowStock = allProducts.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5).length;
  const outStock = allProducts.filter(p => Number(p.stockQty) <= 0).length;
  const totalValue = allProducts.reduce((sum, p) => sum + ((Number(p.stockQty) || 0) * (Number(p.price) || 0)), 0);

  // Atualiza KPIs do painel de relatórios
  const elTotal = document.getElementById('repTotalProducts');
  if (elTotal) elTotal.textContent = total;
  const elNormal = document.getElementById('repNormalStock');
  if (elNormal) elNormal.textContent = inStock;
  const elLow = document.getElementById('repLowStock');
  if (elLow) elLow.textContent = lowStock;
  const elZero = document.getElementById('repZeroStock');
  if (elZero) elZero.textContent = outStock;
  const elVal = document.getElementById('repTotalStockValue');
  if (elVal) elVal.textContent = money(totalValue);

  // Atualiza Badges dos botões de filtro
  const bAll = document.getElementById('repBadgeAll');
  if (bAll) bAll.textContent = total;
  const bZero = document.getElementById('repBadgeZero');
  if (bZero) bZero.textContent = outStock;
  const bLow = document.getElementById('repBadgeLow');
  if (bLow) bLow.textContent = lowStock;
  const bNormal = document.getElementById('repBadgeNormal');
  if (bNormal) bNormal.textContent = inStock;

  // Filtragem
  let list = allProducts;
  if (currentRepFilter === 'zero') {
    list = allProducts.filter(p => Number(p.stockQty) <= 0);
  } else if (currentRepFilter === 'baixo') {
    list = allProducts.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5);
  } else if (currentRepFilter === 'normal') {
    list = allProducts.filter(p => Number(p.stockQty) > 5);
  }

  const search = (document.getElementById('repSearchInput')?.value || '').toLowerCase().trim();
  if (search) {
    list = list.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const loc = getProductLocation(p).toLowerCase();
      return name.includes(search) || code.includes(search) || cat.includes(search) || loc.includes(search);
    });
  }

  if (!list.length) {
    if (currentRepFilter === 'zero') {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:45px 20px;">
            <div style="max-width:500px;margin:0 auto;padding:28px 24px;background:rgba(255,255,255,0.03);border:1px solid var(--panel-border);border-radius:14px;">
              <div style="font-size:42px;margin-bottom:12px;">✅</div>
              <h3 style="margin:0 0 8px;font-size:17px;color:var(--text-primary,#fff);font-weight:700;">Estoque 100% Abastecido!</h3>
              <p style="margin:0 0 16px;font-size:13px;color:var(--text-muted,#8c929a);line-height:1.5;">
                Nenhuma peça está com estoque zerado no momento. Todas as <strong>${total}</strong> peças cadastradas possuem saldo físico disponível no armazém da Fahren Motors.
              </p>
              <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" onclick="filterRelatorios('baixo')">Ver Estoque Baixo (${lowStock})</button>
                <button class="btn btn-primary btn-sm" onclick="filterRelatorios('all')">Ver Todas as Peças (${total})</button>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:35px;color:var(--text-muted)">Nenhuma peça encontrada com os filtros selecionados.</td></tr>';
    }
    return;
  }

  tbody.innerHTML = list.map(p => {
    const loc = getProductLocation(p);
    const stock = Number(p.stockQty) || 0;
    const price = Number(p.price) || 0;
    const totalItemValue = stock * price;
    const safeName = (p.name || '').replace(/'/g, "\\'");

    let statusBadge = '';
    let stockBadge = '';
    if (stock <= 0) {
      statusBadge = '<span class="status-badge cancelado" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;font-weight:700">ZERADO</span>';
      stockBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#fef2f2;color:#dc2626;font-weight:800;border:1px solid #fecaca">0 un</span>';
    } else if (stock <= 5) {
      statusBadge = '<span class="status-badge em_preparacao" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;font-weight:700">BAIXO</span>';
      stockBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#fffbeb;color:#d97706;font-weight:800;border:1px solid #fde68a">${stock} un</span>`;
    } else {
      statusBadge = '<span class="status-badge pronto" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;font-weight:700">NORMAL</span>';
      stockBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:#ecfdf5;color:#059669;font-weight:800;border:1px solid #a7f3d0">${stock} un</span>`;
    }

    return `
      <tr>
        <td><strong class="rep-code-val" style="font-family:monospace;font-size:12px;">${p.code || 'S/CÓD'}</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openProductViewModal(${p.id})">
            <img src="${getProductPhoto(p)}" style="width:34px;height:34px;min-width:34px;min-height:34px;border-radius:6px;object-fit:cover;border:1px solid var(--panel-border);aspect-ratio:1;flex-shrink:0" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
            <div>
              <strong style="font-size:13px;display:block;color:var(--text-primary,#fff)">${p.name}</strong>
              <small style="font-size:11px;color:var(--text-muted,#8c929a)">${p.compatibility ? p.compatibility.slice(0, 45) + '...' : 'Compatível'}</small>
            </div>
          </div>
        </td>
        <td><span class="cat-pill-badge">${p.category || 'Geral'}</span></td>
        <td>
          <span class="location-badge" style="cursor:pointer" data-rep-loc="${p.id}" title="Ver no armazém 3D">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            ${loc}
          </span>
        </td>
        <td style="text-align:center">${stockBadge}</td>
        <td><strong style="font-size:12.5px">${money(price)}</strong></td>
        <td><strong class="rep-total-val" style="font-size:12.5px;">${money(totalItemValue)}</strong></td>
        <td>${statusBadge}</td>
        <td style="text-align:right;white-space:nowrap;vertical-align:middle">
          <div style="display:inline-flex;flex-direction:column;gap:3px;align-items:stretch;width:58px">
            <button class="btn btn-secondary btn-sm" onclick="quickAddStock(${p.id}, 5)" title="Adicionar 5 unidades rapidamente" style="padding:2px 6px;font-size:10.5px;font-weight:700;text-align:center;line-height:1.2">+5</button>
            <button class="btn btn-secondary btn-sm" onclick="quickAddStock(${p.id}, 10)" title="Adicionar 10 unidades rapidamente" style="padding:2px 6px;font-size:10.5px;font-weight:700;text-align:center;line-height:1.2">+10</button>
            <button class="btn btn-secondary btn-sm" onclick="openStockModal(${p.id})" title="Ajustar estoque completo" style="padding:2px 6px;font-size:10.5px;text-align:center;line-height:1.2">Ajustar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-rep-loc]').forEach(badge => {
    badge.onclick = (e) => {
      e.stopPropagation();
      const p = allProducts.find(x => String(x.id) === String(badge.dataset.repLoc));
      if (p) {
        switchTab('armazem');
        selectWarehouseLocation(getProductLocation(p), p.name);
      }
    };
  });
}
window.renderRelatorios = renderRelatorios;

// Modal de visualização completa da peça (Tela 3 do WMS)
async function openProductViewModal(id) {
  const p = allProducts.find(item => String(item.id) === String(id));
  if (!p) return;
  const modal = document.getElementById('productViewModal');
  if (!modal) return;

  const priceVal = Number(p.price) || 0;
  const pixVal = priceVal * 0.96;
  const photo = getProductPhoto(p);
  const allPiecePhotos = parseProductImages(
    Array.isArray(p.photos) && p.photos.length ? p.photos : (p.photoUrl || p.photo_url || '')
  );
  const loc = getProductLocation(p);

  const photoEl = document.getElementById('pvPhoto');
  if (photoEl) {
    photoEl.src = photo;
    photoEl.onerror = function() { this.onerror = null; this.src = WMS_NO_PHOTO_SVG; };
  }

  const pvThumbsEl = document.getElementById('pvPhotoThumbs');
  if (pvThumbsEl) {
    if (allPiecePhotos.length > 1) {
      pvThumbsEl.classList.remove('hidden');
      pvThumbsEl.innerHTML = allPiecePhotos.map((u, idx) => `
        <button type="button" class="pv-thumb-btn ${idx === 0 ? 'active' : ''}" data-pv-idx="${idx}" title="Ver foto ${idx + 1}">
          <img src="${u}" alt="Foto ${idx + 1}" loading="lazy" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;" />
        </button>
      `).join('');
      pvThumbsEl.querySelectorAll('.pv-thumb-btn').forEach(btn => {
        btn.onclick = () => {
          const i = Number(btn.dataset.pvIdx) || 0;
          if (photoEl && allPiecePhotos[i]) photoEl.src = allPiecePhotos[i];
          pvThumbsEl.querySelectorAll('.pv-thumb-btn').forEach(b => b.classList.toggle('active', b === btn));
        };
      });
    } else {
      pvThumbsEl.classList.add('hidden');
      pvThumbsEl.innerHTML = '';
    }
  }
  
  const catEl = document.getElementById('pvCategory');
  if (catEl) catEl.textContent = p.category || 'Geral';
  
  const statusEl = document.getElementById('pvStatus');
  if (statusEl) {
    if (p.inStock) {
      statusEl.textContent = 'Em Estoque';
      statusEl.className = 'status-badge pronto';
    } else {
      statusEl.textContent = 'Esgotado';
      statusEl.className = 'status-badge cancelado';
    }
  }

  const locEl = document.getElementById('pvLocation');
  if (locEl) locEl.textContent = loc;

  const nameEl = document.getElementById('pvName');
  if (nameEl) nameEl.textContent = p.name;
  
  const codeEl = document.getElementById('pvCode');
  if (codeEl) codeEl.textContent = p.code || 'S/CÓD';
  
  const pixEl = document.getElementById('pvPricePix');
  if (pixEl) pixEl.textContent = pixVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const regEl = document.getElementById('pvPriceReg');
  if (regEl) regEl.textContent = money(priceVal);
  
  const stockEl = document.getElementById('pvStockQty');
  if (stockEl) stockEl.textContent = String(p.stockQty || 0);

  // Stepper interativo direto dentro do modal Ver Peça (com auditoria)
  const minusBtn = document.getElementById('btnPvStockMinus');
  const plusBtn = document.getElementById('btnPvStockPlus');
  if (minusBtn) {
    minusBtn.onclick = async () => {
      const cur = Number(p.stockQty) || 0;
      if (cur <= 0) return;
      await quickUpdateStock(p.id, cur - 1);
      if (stockEl) stockEl.textContent = String(p.stockQty || 0);
      loadProductMovementHistory(p.id);
    };
  }
  if (plusBtn) {
    plusBtn.onclick = async () => {
      const cur = Number(p.stockQty) || 0;
      await quickUpdateStock(p.id, cur + 1);
      if (stockEl) stockEl.textContent = String(p.stockQty || 0);
      loadProductMovementHistory(p.id);
    };
  }

  // Gera código de barras e QR code da peça com separação física total
  const barcodeBox = document.getElementById('pvBarcodeSvg');
  if (barcodeBox) {
    const pieceCode = String(p.code || ('PROD-' + p.id)).trim();
    barcodeBox.innerHTML = `
      <div class="pv-barcode-render-wrap">
        ${generateCode128Svg(pieceCode, 26, 'wms-barcode-svg')}
      </div>
      <span class="pv-barcode-sku-caption">${pieceCode}</span>
    `;
  }

  const qrBox = document.getElementById('pvQrSvg');
  if (qrBox) {
    const qrData = encodeURIComponent(`FAHREN WMS|${p.code || 'PROD-' + p.id}|${p.name || 'Peça'}|${getProductLocation(p)}`);
    qrBox.innerHTML = `<img src="/api/stock/qrcode?text=${qrData}&size=76" alt="QR" width="38" height="38" style="display:block;border-radius:3px;background:#fff;" />`;
  }
  
  const compatEl = document.getElementById('pvCompatibility');
  if (compatEl) compatEl.textContent = p.compatibility || 'Aplicação compatível ou universal.';
  
  const descEl = document.getElementById('pvDescription');
  if (descEl) descEl.textContent = p.description || 'Sem descrição cadastrada.';

  const lblBtn = document.getElementById('pvPrintLabelBtn');
  if (lblBtn) {
    lblBtn.onclick = () => {
      closeProductViewModal();
      openStockLabelModal(p.id);
    };
  }

  const editBtn = document.getElementById('pvEditBtn');
  if (editBtn) {
    editBtn.onclick = () => {
      closeProductViewModal();
      startEdit(p.id);
    };
  }

  const stockBtn = document.getElementById('pvAdjustStockBtn');
  if (stockBtn) {
    stockBtn.onclick = () => {
      closeProductViewModal();
      openStockModal(p.id);
    };
  }

  // Carrega histórico individual desta peça (Tela 3)
  loadProductMovementHistory(p.id);

  modal.classList.remove('hidden');
}

async function loadProductMovementHistory(productId) {
  const tbody = document.getElementById('pvMovementsTbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-2">Carregando histórico da peça...</td></tr>';
  try {
    const res = await api(`/stock/movements?productId=${productId}&limit=10`);
    const movements = res.movements || [];
    if (!movements.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">Nenhuma movimentação anterior registrada para esta peça.</td></tr>';
      return;
    }
    tbody.innerHTML = movements.map(m => {
      const isPos = m.type === 'entrada' || (m.type === 'ajuste' && m.new_stock > m.previous_stock);
      const sign = isPos ? '+' : '−';
      const absQty = Math.abs(Number(m.quantity) || 0);
      const qtyClass = isPos ? 'text-success' : 'text-danger';
      const typeBadge = getMovementBadge(m.type);
      const loc = m.to_location || m.current_location || m.location || m.from_location || 'H-04-04';
      const docRef = m.reference || m.document_ref || '';
      const note = m.notes || m.reason || (m.type === 'entrada' ? 'Recebimento' : m.type === 'saida' ? 'Saída' : 'Ajuste');
      const currentStockVal = m.new_stock !== undefined && m.new_stock !== null ? m.new_stock : (m.stock_qty || 0);
      return `
        <tr>
          <td><small>${formatDate(m.created_at)}</small></td>
          <td>${typeBadge}</td>
          <td><strong class="${qtyClass}">${sign}${absQty} un.</strong></td>
          <td><strong style="color:var(--text-primary);">${currentStockVal} un.</strong></td>
          <td><span class="location-badge" style="font-size:10px;padding:1px 6px;">📍 ${loc}</span></td>
          <td><small>${m.user_name || 'Admin'} ${docRef ? `(${docRef})` : note ? `(${note})` : ''}</small></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar histórico da peça:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-2 text-danger">Não foi possível carregar o histórico.</td></tr>';
  }
}

function closeProductViewModal() {
  document.getElementById('productViewModal')?.classList.add('hidden');
}
window.openProductViewModal = openProductViewModal;
window.closeProductViewModal = closeProductViewModal;

// Modal de ajuste de estoque e dados da peça
function openStockModal(id) {
  const p = allProducts.find(item => String(item.id) === String(id));
  if (!p) return;
  document.getElementById('stockModalProdId').value = p.id;
  const codeEl = document.getElementById('stockModalProdCode');
  if (codeEl) codeEl.textContent = `SKU: ${p.code || 'S/CÓD'} | ${p.category || 'Geral'}`;
  
  const nameInput = document.getElementById('stockModalProdNameInput');
  if (nameInput) nameInput.value = p.name || '';
  
  const descInput = document.getElementById('stockModalProdDescInput');
  if (descInput) descInput.value = p.description || '';
  
  document.getElementById('stockModalQty').value = p.stockQty || 0;
  document.getElementById('stockModal').classList.remove('hidden');
}

function closeStockModal() {
  document.getElementById('stockModal').classList.add('hidden');
}

function stepStockQty(delta) {
  const input = document.getElementById('stockModalQty');
  if (!input) return;
  const current = parseInt(input.value, 10) || 0;
  input.value = Math.max(0, current + delta);
}

document.getElementById('btnStockMinus')?.addEventListener('click', () => stepStockQty(-1));
document.getElementById('btnStockPlus')?.addEventListener('click', () => stepStockQty(1));

document.getElementById('btnSaveStockModal')?.addEventListener('click', async () => {
  const id = document.getElementById('stockModalProdId').value;
  const qty = parseInt(document.getElementById('stockModalQty').value, 10) || 0;
  const newName = document.getElementById('stockModalProdNameInput')?.value?.trim();
  const newDesc = document.getElementById('stockModalProdDescInput')?.value?.trim();

  const prod = allProducts.find(x => String(x.id) === String(id));
  if (!prod) return;

  try {
    const payload = {
      stockQty: qty,
      inStock: qty > 0
    };
    if (newName && newName !== prod.name) {
      payload.name = newName;
    }
    if (newDesc !== undefined && newDesc !== (prod.description || '')) {
      payload.description = newDesc;
    }

    await api(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    prod.stockQty = qty;
    prod.inStock = qty > 0;
    if (payload.name) prod.name = payload.name;
    if (payload.description !== undefined) prod.description = payload.description;

    renderProductsTable(allProducts);
    renderRelatorios();
    updateStockTabsBadges();
    fetchIssuedNfsFromApi();
    updateDashboardMetrics();
    closeStockModal();
    await refreshAllData();
    broadcastSync('STOCK_UPDATED');
    showToast(`Peça "${prod.name}" atualizada com sucesso!`);
  } catch (err) {
    console.error('Erro ao salvar dados da peça:', err);
    showToast(err.message || 'Erro ao salvar alterações da peça');
  }
});

function fillCategoryList(products) {
  const list = document.getElementById('categoryList');
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  if (list) {
    list.innerHTML = cats.map(c => `<option value="${c}"></option>`).join('');
  }
  const filterSelect = document.getElementById('stockCategoryFilter');
  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
  }
}

function applyStockFilters() {
  const term = (document.getElementById('stockSearch')?.value || '').toLowerCase().trim();
  const cat = (document.getElementById('stockCategoryFilter')?.value || '').trim();
  const status = (document.getElementById('stockStatusFilter')?.value || '').trim();

  const filtered = allProducts.filter(p => {
    const name = (p.name || '').toLowerCase();
    const code = (p.code || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const loc = getProductLocation(p).toLowerCase();
    const stock = Number(p.stockQty) || 0;

    const matchesTerm = !term || name.includes(term) || code.includes(term) || category.includes(term) || loc.includes(term);
    const matchesCat = !cat || p.category === cat;
    let matchesStatus = true;
    if (status === 'disponivel') matchesStatus = stock > 5;
    else if (status === 'baixo') matchesStatus = stock > 0 && stock <= 5;
    else if (status === 'zerado') matchesStatus = stock <= 0;

    return matchesTerm && matchesCat && matchesStatus;
  });

  renderProductsTable(filtered);
}

document.getElementById('stockSearch')?.addEventListener('input', applyStockFilters);
document.getElementById('stockCategoryFilter')?.addEventListener('change', applyStockFilters);
document.getElementById('stockStatusFilter')?.addEventListener('change', applyStockFilters);

// Cadastro e Edição de Peças
document.getElementById('syncCatalogBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('syncCatalogBtn');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.6';
  }
  showToast('Sincronizando catálogo com o banco de dados...');
  try {
    const res = await api('/products/sync-catalog', { method: 'POST' });
    await refreshAllData();
    broadcastSync('CATALOG_SYNCED');
    showToast(res.message || 'Catálogo sincronizado com sucesso!');
  } catch (err) {
    showToast('Erro ao sincronizar catálogo: ' + (err.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
});

document.getElementById('newProductToggleBtn')?.addEventListener('click', () => {
  switchTab('estoque');
  const panel = document.getElementById('productFormPanel');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      resetProductForm();
      panel.classList.remove('hidden');
      const yOffset = -75;
      const y = panel.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setTimeout(() => {
        document.getElementById('pName')?.focus();
      }, 180);
    } else if (editingProductId) {
      resetProductForm();
      panel.classList.remove('hidden');
      const yOffset = -75;
      const y = panel.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      setTimeout(() => {
        document.getElementById('pName')?.focus();
      }, 180);
    } else {
      panel.classList.add('hidden');
    }
  }
});

function openNewProductForm() {
  switchTab('pecas');
  const panel = document.getElementById('productFormPanel');
  if (panel) {
    resetProductForm();
    panel.classList.remove('hidden');
    const yOffset = -75;
    const y = panel.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    setTimeout(() => {
      document.getElementById('pName')?.focus();
    }, 180);
  }
}
window.openNewProductForm = openNewProductForm;
window.openNewPartForm = openNewProductForm;

function startEdit(id) {
  const p = allProducts.find(item => String(item.id) === String(id));
  if (!p) return;
  switchTab('pecas');
  editingProductId = p.id;

  const panel = document.getElementById('productFormPanel');
  if (panel) {
    panel.classList.remove('hidden');
  }

  document.getElementById('formTitle').textContent = `Editar Peça: ${p.name}`;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pCode').value = p.code || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pPrice').value = String(p.price || '').replace('.', ',');
  document.getElementById('pStock').value = p.stockQty || 0;
  
  const locEl = document.getElementById('pLocation');
  if (locEl) locEl.value = p.location || getProductLocation(p);
  
  const photoVal = Array.isArray(p.photos) ? (p.photos.length ? p.photos : (p.photoUrl || p.photo_url || '')) : (p.photoUrl || p.photo_url || '');
  currentProductImages = parseProductImages(photoVal);
  renderProductPhotoGallery();

  document.getElementById('pDescription').value = p.description || '';
  document.getElementById('pCompatibility').value = p.compatibility || '';
  document.getElementById('cancelEditBtn').classList.remove('hidden');
  document.getElementById('saveProductBtn').textContent = 'SALVAR ALTERAÇÕES';
  
  if (panel) {
    const yOffset = -75;
    const y = panel.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  setTimeout(() => {
    document.getElementById('pName')?.focus();
  }, 180);
}
window.startEdit = startEdit;
