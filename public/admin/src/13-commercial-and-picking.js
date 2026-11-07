// Módulo WMS: 13-commercial-and-picking.js
// Fahren Motors - Painel de Gestão WMS

// ==========================================
// Gestão de Produtos Comerciais (Loja Virtual)
// ==========================================
let currentCommercialFilter = 'all';

function renderCommercialProductsTable(products = allProducts) {
  const tbody = document.getElementById('commercialProductsTableBody');
  if (!tbody) return;

  const prods = (products || allProducts);
  
  // Atualiza KPIs
  const total = prods.length;
  const activeCount = prods.filter(p => p.active !== false).length;
  const lowCount = prods.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5).length;
  const outCount = prods.filter(p => Number(p.stockQty) <= 0).length;

  const elTotal = document.getElementById('prodTotalVal');
  if (elTotal) elTotal.textContent = total;
  const elActive = document.getElementById('prodActiveVal');
  if (elActive) elActive.textContent = activeCount;
  const elLow = document.getElementById('prodLowVal');
  if (elLow) elLow.textContent = lowCount;
  const elOut = document.getElementById('prodOutVal');
  if (elOut) elOut.textContent = outCount;

  // Popula categorias no select se vazio
  const catSelect = document.getElementById('commCategoryFilter');
  if (catSelect && catSelect.options.length <= 1) {
    const cats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))).sort();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      catSelect.appendChild(opt);
    });
  }

  // Popula datalist do form
  const dl = document.getElementById('commercialCategoryList');
  if (dl && dl.options.length === 0) {
    const cats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean))).sort();
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      dl.appendChild(opt);
    });
  }

  let filtered = [...prods];
  const q = (document.getElementById('commSearchInput')?.value || '').toLowerCase().trim();
  const status = document.getElementById('commStatusFilter')?.value || currentCommercialFilter;
  const cat = document.getElementById('commCategoryFilter')?.value || '';

  if (q) {
    filtered = filtered.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (getProductLocation(p).toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.compatibility && p.compatibility.toLowerCase().includes(q))
    );
  }

  if (cat) {
    filtered = filtered.filter(p => p.category === cat);
  }

  if (status === 'ativo') {
    filtered = filtered.filter(p => p.active !== false && Number(p.stockQty) > 0);
  } else if (status === 'pausado') {
    filtered = filtered.filter(p => p.active === false);
  } else if (status === 'esgotado') {
    filtered = filtered.filter(p => Number(p.stockQty) <= 0);
  } else if (status === 'baixo') {
    filtered = filtered.filter(p => Number(p.stockQty) > 0 && Number(p.stockQty) <= 5);
  }

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text-muted)">Nenhum produto comercial encontrado com os filtros selecionados.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const photo = getProductPhoto(p);
    const stockNum = Number(p.stockQty) || 0;
    const priceNum = Number(p.price) || 0;
    const isActive = p.active !== false;

    let statusBadge = '';
    if (!isActive) {
      statusBadge = '<span class="status-badge pausado">Pausado</span>';
    } else if (stockNum > 0) {
      statusBadge = '<span class="status-badge pronto" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0">Ativo na Loja</span>';
    } else {
      statusBadge = '<span class="status-badge cancelado" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca">Esgotado</span>';
    }

    return `
      <tr>
        <td style="width:45px">
          <img src="${photo}" alt="" class="prod-thumb-img" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
        </td>
        <td>
          <strong class="prod-name-strong">${p.name}</strong>
          ${p.description ? `<small style="display:block;font-size:11px;color:var(--text-muted);">${p.description.slice(0, 50)}${p.description.length > 50 ? '...' : ''}</small>` : ''}
        </td>
        <td><span class="prod-sku-code" style="font-weight:700;font-family:monospace">${p.code || 'S/REF'}</span></td>
        <td><span class="cat-pill-badge">${p.category || 'Geral'}</span></td>
        <td><strong style="color:var(--text-primary);font-size:13px">${money(priceNum)}</strong></td>
        <td style="text-align:center">
          <span style="font-weight:700;font-size:12.5px;color:${stockNum > 0 ? 'var(--text-primary)' : '#dc2626'}">${stockNum} un</span>
        </td>
        <td>${statusBadge}</td>
        <td class="col-td-actions" style="text-align:center;white-space:nowrap;vertical-align:middle">
          <div class="prod-actions-stack">
            <button class="btn btn-secondary btn-sm btn-prod-action btn-prod-view" onclick="openProductViewModal(${p.id})" title="Ver detalhes do produto">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="pointer-events:none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <span style="pointer-events:none">Ver</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-prod-action btn-prod-edit" onclick="editCommercialProduct(${p.id})" title="Editar dados do produto comercial">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="pointer-events:none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span style="pointer-events:none">Editar</span>
            </button>
            <button class="btn btn-sm btn-prod-delete" data-remove="${p.id}" title="Excluir produto">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="pointer-events:none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span style="pointer-events:none">Excluir</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      removeProduct(b.dataset.remove);
    };
  });
}
window.renderCommercialProductsTable = renderCommercialProductsTable;

function applyCommercialFilter() {
  renderCommercialProductsTable(allProducts);
}
window.applyCommercialFilter = applyCommercialFilter;

function filterCommercialProducts(type) {
  currentCommercialFilter = type;
  const sel = document.getElementById('commStatusFilter');
  if (sel) sel.value = type === 'all' ? '' : type;
  renderCommercialProductsTable(allProducts);
}
window.filterCommercialProducts = filterCommercialProducts;

let editingCommercialProductId = null;

function openNewCommercialProductForm() {
  editingCommercialProductId = null;
  const panel = document.getElementById('commercialProductFormPanel');
  if (!panel) return;
  document.getElementById('commFormTitle').textContent = 'Cadastrar Novo Produto';
  document.getElementById('cpName').value = '';
  document.getElementById('cpCode').value = '';
  document.getElementById('cpCategory').value = '';
  document.getElementById('cpPrice').value = '';
  document.getElementById('cpStock').value = '';
  document.getElementById('cpActive').value = 'true';
  document.getElementById('cpPhoto').value = '';
  document.getElementById('cpDescription').value = '';
  document.getElementById('commProductFormError')?.classList.add('hidden');
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('cpName')?.focus(), 150);
}
window.openNewCommercialProductForm = openNewCommercialProductForm;

function closeCommercialProductForm() {
  const panel = document.getElementById('commercialProductFormPanel');
  if (panel) panel.classList.add('hidden');
  editingCommercialProductId = null;
}
window.closeCommercialProductForm = closeCommercialProductForm;

function editCommercialProduct(id) {
  const p = allProducts.find(item => String(item.id) === String(id));
  if (!p) return;
  switchTab('produtos');
  editingCommercialProductId = p.id;
  const panel = document.getElementById('commercialProductFormPanel');
  if (!panel) return;
  document.getElementById('commFormTitle').textContent = `Editar Produto: ${p.name}`;
  document.getElementById('cpName').value = p.name || '';
  document.getElementById('cpCode').value = p.code || '';
  document.getElementById('cpCategory').value = p.category || '';
  document.getElementById('cpPrice').value = p.price !== undefined ? String(p.price).replace('.', ',') : '';
  document.getElementById('cpStock').value = p.stockQty !== undefined ? p.stockQty : '';
  document.getElementById('cpActive').value = p.active === false ? 'false' : 'true';
  document.getElementById('cpPhoto').value = p.photoUrl || '';
  document.getElementById('cpDescription').value = p.description || '';
  document.getElementById('commProductFormError')?.classList.add('hidden');
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.editCommercialProduct = editCommercialProduct;

async function saveCommercialProduct() {
  const errEl = document.getElementById('commProductFormError');
  if (errEl) errEl.classList.add('hidden');

  const name = document.getElementById('cpName')?.value?.trim();
  const code = document.getElementById('cpCode')?.value?.trim() || null;
  const category = document.getElementById('cpCategory')?.value?.trim() || null;
  const priceRaw = document.getElementById('cpPrice')?.value?.trim();
  const stockQtyRaw = document.getElementById('cpStock')?.value?.trim();
  const active = document.getElementById('cpActive')?.value === 'true';
  const rawCpPhoto = document.getElementById('cpPhoto')?.value?.trim() || '';
  const cpPhotos = parseProductImages(rawCpPhoto);
  const photoUrl = cpPhotos.length ? cpPhotos.join(', ') : null;
  const description = document.getElementById('cpDescription')?.value?.trim() || null;

  if (!name) {
    if (errEl) {
      errEl.textContent = 'Informe o nome do produto.';
      errEl.classList.remove('hidden');
    }
    return;
  }
  if (!priceRaw) {
    if (errEl) {
      errEl.textContent = 'Informe o preço de venda.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const price = parseFloat(priceRaw.replace(',', '.'));
  if (isNaN(price) || price < 0) {
    if (errEl) {
      errEl.textContent = 'Preço de venda inválido.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const stockQty = stockQtyRaw !== '' ? parseInt(stockQtyRaw, 10) : 0;
  if (isNaN(stockQty) || stockQty < 0) {
    if (errEl) {
      errEl.textContent = 'Quantidade em estoque inválida.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  const payload = {
    name,
    code,
    category,
    price,
    stockQty,
    active,
    photoUrl,
    photos: cpPhotos,
    description,
    itemType: 'produto'
  };

  try {
    const btn = document.getElementById('saveCommProductBtn');
    if (btn) btn.disabled = true;

    const wasEditingComm = Boolean(editingCommercialProductId);
    let res;
    if (editingCommercialProductId) {
      res = await fetch(`/api/products/${editingCommercialProductId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar produto');

    if (data && data.product) {
      applyUpdatedProductToState(data.product);
    }

    closeCommercialProductForm();
    await refreshAllData();
    broadcastSync('PRODUCT_SAVED');
    renderCommercialProductsTable(allProducts);
    alert(wasEditingComm ? 'Produto comercial atualizado!' : 'Produto comercial cadastrado!');
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  } finally {
    const btn = document.getElementById('saveCommProductBtn');
    if (btn) btn.disabled = false;
  }
}
window.saveCommercialProduct = saveCommercialProduct;

function triggerSyncCatalog() {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.click();
}
window.triggerSyncCatalog = triggerSyncCatalog;

// Anexo de Foto(s) do Produto Comercial (suporta múltiplas fotos ilimitadas)
document.getElementById('cpPhotoFile')?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  try {
    const newUrls = [];
    for (let i = 0; i < files.length; i++) {
      newUrls.push(...(await enviarUmaImagem(files[i], 'photos')));
    }
    const photoInput = document.getElementById('cpPhoto');
    const existing = parseProductImages(photoInput ? photoInput.value : '');
    const merged = Array.from(new Set([...existing, ...newUrls]));
    if (photoInput) photoInput.value = merged.join(', ');
    if (editingCommercialProductId && merged.length) {
      const saved = await api('/products/' + editingCommercialProductId, {
        method: 'PUT',
        body: JSON.stringify({ photoUrl: merged.join(', '), photos: merged })
      });
      if (saved && saved.product) applyUpdatedProductToState(saved.product);
      broadcastSync('PRODUCT_SAVED');
    }
    showToast(`${newUrls.length} ${newUrls.length === 1 ? 'imagem anexada' : 'imagens anexadas'} com sucesso!`);
  } catch (err) {
    console.error('Erro no upload de foto comercial:', err);
    showToast(err.message || 'Erro ao enviar imagem');
  } finally {
    e.target.value = '';
  }
});

// Inicialização imediata do canal de sincronização em tempo real
initAdminSyncChannel();




// ===================================================================
// SISTEMA UNIVERSAL DE BUSCA RÁPIDA DE PEÇAS (COMBOBOX AUTOCOMPLETE)
// ===================================================================
function initProductCombobox(cfg) {
  const container = document.getElementById(cfg.containerId);
  const input = document.getElementById(cfg.inputId);
  const dropdown = document.getElementById(cfg.dropdownId);
  const clearBtn = document.getElementById(cfg.clearBtnId);
  const hiddenSelect = cfg.hiddenSelectId ? document.getElementById(cfg.hiddenSelectId) : null;

  if (!container || !input || !dropdown) return null;

  let selectedProd = null;

  function renderList(query = '') {
    const q = query.trim().toLowerCase();
    const activeProducts = allProducts.filter(p => p.active !== false);
    
    let matches = activeProducts;
    if (q) {
      matches = activeProducts.filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const codeMatch = (p.code || '').toLowerCase().includes(q);
        const catMatch = (p.category || '').toLowerCase().includes(q);
        const locMatch = getProductLocation(p).toLowerCase().includes(q);
        return nameMatch || codeMatch || catMatch || locMatch;
      });
    }

    if (!matches.length) {
      dropdown.innerHTML = `<div class="combobox-empty">Nenhuma peça encontrada com "<strong>${query}</strong>"</div>`;
      dropdown.classList.remove('hidden');
      return;
    }

    // Limita a exibição a 30 itens para fluidez máxima
    const displayList = matches.slice(0, 30);
    dropdown.innerHTML = displayList.map(p => {
      const photo = getProductPhoto(p);
      const loc = getProductLocation(p);
      const isSelected = selectedProd && String(selectedProd.id) === String(p.id);
      const priceHtml = cfg.showPrice ? `<span class="combobox-item-price">${money(p.price)}</span>` : '';

      return `
        <div class="combobox-item ${isSelected ? 'selected' : ''}" data-prod-id="${p.id}">
          <img src="${photo}" alt="" class="combobox-thumb" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
          <div class="combobox-item-body">
            <div class="combobox-item-title">${p.name}</div>
            <div class="combobox-item-meta">
              <span class="combobox-badge-sku">${p.code || 'S/SKU'}</span>
              <span class="combobox-meta-stock">Saldo: <strong>${p.stockQty || 0} un.</strong></span>
              <span class="combobox-meta-loc">Local: <strong>${loc}</strong></span>
            </div>
          </div>
          ${priceHtml}
        </div>
      `;
    }).join('');

    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.combobox-item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const pId = item.dataset.prodId;
        const p = allProducts.find(x => String(x.id) === String(pId));
        if (p) selectProduct(p);
      };
    });
  }

  function selectProduct(p) {
    selectedProd = p;
    input.value = p ? `${p.name} (${p.code || 'S/SKU'})` : '';
    if (clearBtn) clearBtn.classList.toggle('hidden', !p);
    dropdown.classList.add('hidden');

    if (hiddenSelect) {
      hiddenSelect.value = p ? String(p.id) : '';
      hiddenSelect.dispatchEvent(new Event('change'));
    }

    if (typeof cfg.onSelect === 'function') {
      cfg.onSelect(p);
    }
  }

  input.onfocus = () => {
    renderList(input.value);
  };

  input.oninput = () => {
    if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
    renderList(input.value);
  };

  input.onkeydown = (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
    }
  };

  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      selectProduct(null);
      input.value = '';
      input.focus();
      renderList('');
    };
  }

  // Fecha ao clicar fora
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  return {
    setProduct: (prodOrId) => {
      if (!prodOrId) {
        selectProduct(null);
        return;
      }
      const p = typeof prodOrId === 'object' ? prodOrId : allProducts.find(x => String(x.id) === String(prodOrId));
      selectProduct(p);
    },
    refresh: () => {
      if (input === document.activeElement) renderList(input.value);
    }
  };
}

let stockOpComboboxInstance = null;
let invComboboxInstance = null;
let noComboboxInstance = null;


// Fechar qualquer modal ao clicar no fundo (backdrop / overlay)
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// Garante que nenhum modal abra automaticamente na inicialização da página
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
});


// Trava universal de scroll no body quando qualquer modal está aberto
function updateModalBodyScrollLock() {
  const visibleModal = document.querySelector('.modal-overlay:not(.hidden)');
  if (visibleModal) {
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
  }
}

// Observa mudanças nas classes de todos os modais para ativar/desativar o scroll lock
const modalObserver = new MutationObserver(() => {
  updateModalBodyScrollLock();
});
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
});

// Exporta relatório semanal em CSV
function exportWeeklyReportCSV() {
  const rows = [
    ['SEMANA', 'PERIODO', 'PEDIDOS CONCLUIDOS', 'TICKET MEDIO (R$)', 'TOTAL FATURADO (R$)', 'PARTICIPACAO (%)', 'STATUS'],
    ['Semana 1', '01/09 a 07/09', '29', '654.16', '18970.70', '22%', 'Dentro da Meta'],
    ['Semana 2', '08/09 a 14/09', '36', '646.72', '23282.22', '27%', 'Superou Meta (+12%)'],
    ['Semana 3', '15/09 a 21/09', '38', '658.07', '25006.83', '29%', 'Pico de Vendas'],
    ['Semana 4', '22/09 a 31/09', '29', '654.16', '18970.70', '22%', 'Dentro da Meta']
  ];
  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(';')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'relatorio_vendas_semanal_fahren.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Relatório semanal exportado com sucesso!');
}
window.exportWeeklyReportCSV = exportWeeklyReportCSV;


// ====================================================
// WMS EXPEDIÇÃO RÁPIDA & ROMANEIO DE SEPARAÇÃO (PICKING)
// ====================================================

window.fastDispatchOrder = async function(orderId) {
  try {
    await api(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'entregue' })
    });
    if (typeof isAutoNfEnabled === 'function' && isAutoNfEnabled()) {
      markNfAsIssued(orderId);
    }
    showToast(`⚡ Pedido #${orderId} despachado com sucesso!`);
    await refreshAllData();
    broadcastSync('ORDER_UPDATED');
  } catch (err) {
    showToast('Erro ao despachar pedido: ' + err.message, 'error');
  }
};

window.fastDispatchAllReadyOrders = async function() {
  const readyOrders = allOrders.filter(o => o.status === 'pronto');
  if (!readyOrders.length) {
    showToast('Nenhum pacote com status "Pronto" para despacho em massa.');
    return;
  }
  if (!confirm(`Deseja despachar todos os ${readyOrders.length} pacotes prontos de uma vez?`)) {
    return;
  }
  let successCount = 0;
  for (const o of readyOrders) {
    try {
      await api(`/orders/${o.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'entregue' })
      });
      successCount++;
    } catch (e) {
      console.error('Erro ao despachar pedido #' + o.id, e);
    }
  }
  showToast(`⚡ ${successCount} pacotes despachados com sucesso!`);
  await refreshAllData();
  broadcastSync('ORDER_UPDATED');
};

window.handleExpedicaoSearchOrScan = function(e) {
  renderExpedicao();
};

window.openPickingListModal = function() {
  const modal = document.getElementById('pickingListModal');
  const body = document.getElementById('pickingListBody');
  const summary = document.getElementById('pickingSummaryText');
  if (!modal || !body) return;

  const pendingOrders = allOrders.filter(o => ['novo', 'em_preparacao'].includes(o.status));
  if (!pendingOrders.length) {
    body.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px;">Nenhum pedido pendente de separação no momento.</p>';
    if (summary) summary.textContent = '0 pedidos pendentes';
    modal.classList.remove('hidden');
    return;
  }

  // Agrupar itens por produto e localização
  const itemsMap = {};
  let totalPieces = 0;

  for (const order of pendingOrders) {
    for (const item of (order.items || [])) {
      const key = item.productId || item.name;
      if (!itemsMap[key]) {
        itemsMap[key] = {
          name: item.name,
          code: item.code || 'S/N',
          location: item.location || 'Sem localização',
          totalQty: 0,
          orders: []
        };
      }
      itemsMap[key].totalQty += item.quantity;
      itemsMap[key].orders.push(`#${order.id} (${item.quantity}un)`);
      totalPieces += item.quantity;
    }
  }

  // Ordenar por localização de prateleira para rota ótima
  const sortedItems = Object.values(itemsMap).sort((a, b) => a.location.localeCompare(b.location));

  let tableHtml = `
    <table class="wms-table" style="width:100%;margin:0;">
      <thead>
        <tr>
          <th style="width:18%;">📍 Localização</th>
          <th style="width:18%;">SKU / Código</th>
          <th style="width:36%;">Descrição da Peça</th>
          <th style="width:12%;text-align:center;">Qtd Total</th>
          <th style="width:16%;">Destino (Pacotes)</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const item of sortedItems) {
    tableHtml += `
      <tr>
        <td>
          <span style="font-weight:800;color:#38bdf8;background:rgba(56,189,248,0.1);padding:3px 8px;border-radius:4px;border:1px solid rgba(56,189,248,0.2);">
            ${item.location}
          </span>
        </td>
        <td><code style="font-family:monospace;color:var(--text-muted);">${item.code}</code></td>
        <td style="font-weight:600;">${item.name}</td>
        <td style="text-align:center;">
          <span style="background:#2b6cb0;color:#fff;font-weight:800;padding:2px 8px;border-radius:12px;font-size:12px;">
            ${item.totalQty} un
          </span>
        </td>
        <td style="font-size:11px;color:var(--text-muted);">${item.orders.join(', ')}</td>
      </tr>
    `;
  }

  tableHtml += '</tbody></table>';
  body.innerHTML = tableHtml;

  if (summary) {
    summary.textContent = `Total: ${sortedItems.length} peças distintas | ${totalPieces} unidades em ${pendingOrders.length} pedidos pendentes`;
  }

  modal.classList.remove('hidden');
};

window.closePickingListModal = function() {
  const modal = document.getElementById('pickingListModal');
  if (modal) modal.classList.add('hidden');
};

window.printPickingList = function() {
  const content = document.getElementById('pickingListBody');
  if (!content) return;
  const printWin = window.open('', '_blank', 'width=900,height=650');
  printWin.document.write(`
    <html>
      <head>
        <title>Romaneio de Separação WMS - Fahren Motors</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 10pt; padding: 15px; color: #0f172a; background: #ffffff; }
          h2 { margin: 0 0 4px; font-size: 16pt; color: #0f172a; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
          p { margin: 4px 0 16px; color: #64748b; font-size: 9pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; background: #ffffff; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 9pt; text-align: left; background: #ffffff; color: #0f172a; }
          th { background: #f8fafc; font-weight: 700; color: #1e293b; border-bottom: 2px solid #94a3b8; }
          tbody tr:nth-child(even) td { background: #fbfcfd; }
          code { font-family: monospace; font-size: 9pt; color: #0f172a; }
          span { color: #0f172a !important; background: transparent !important; border: none !important; }
        </style>
      </head>
      <body>
        <h2>Fahren Motors - Romaneio de Separação (Picking List)</h2>
        <p>Gerado em: ${new Date().toLocaleString('pt-BR')} | Ordenado por Localização de Prateleira</p>
        ${content.innerHTML}
        <script>
          window.onload = function() { window.print(); window.close(); };
        </script>
      </body>
    </html>
  `);
  printWin.document.close();
};
