// Módulo WMS: 12-barcode-and-labels.js
// Fahren Motors - Painel de Gestão WMS

// -------------------------------------------------------------------
// 1. MOVIMENTAÇÕES DE ESTOQUE (HISTÓRICO GERAL - TELA 4)
// -------------------------------------------------------------------
let movCurrentPage = 1;
let movDebounceTimer = null;

async function loadStockMovements(page = 1) {
  movCurrentPage = page;
  const tbody = document.getElementById('stockMovementsTbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Carregando movimentações do armazém...</td></tr>';

  const search = (document.getElementById('filterMovSearch')?.value || '').trim();
  const type = document.getElementById('filterMovType')?.value || '';
  const days = document.getElementById('filterMovDays')?.value || '30';

  try {
    const params = new URLSearchParams({
      page: String(movCurrentPage),
      limit: '25',
      days: String(days)
    });
    if (search) params.append('search', search);
    if (type) params.append('type', type);

    const res = await api(`/stock/movements?${params.toString()}`);
    const movements = res.movements || [];
    const stats = res.stats || {};

    // Atualiza KPIs da tela de movimentações
    const elEntradas = document.getElementById('kpiMovEntradas');
    if (elEntradas) elEntradas.textContent = `${stats.totalEntradas || 0} un.`;
    const elEntradasCount = document.getElementById('kpiMovEntradasCount');
    if (elEntradasCount) elEntradasCount.textContent = `${stats.countEntradas || 0} registros`;

    const elSaidas = document.getElementById('kpiMovSaidas');
    if (elSaidas) elSaidas.textContent = `${stats.totalSaidas || 0} un.`;
    const elSaidasCount = document.getElementById('kpiMovSaidasCount');
    if (elSaidasCount) elSaidasCount.textContent = `${stats.countSaidas || 0} registros`;

    const elTransf = document.getElementById('kpiMovTransf');
    if (elTransf) elTransf.textContent = `${stats.totalTransf || 0} un.`;
    const elTransfCount = document.getElementById('kpiMovTransfCount');
    if (elTransfCount) elTransfCount.textContent = `${stats.countTransf || 0} registros`;

    const elAjustes = document.getElementById('kpiMovAjustes');
    if (elAjustes) elAjustes.textContent = `${stats.totalAjustes || 0} un.`;
    const elAjustesCount = document.getElementById('kpiMovAjustesCount');
    if (elAjustesCount) elAjustesCount.textContent = `${stats.countAjustes || 0} registros`;

    renderMovementsTable(movements);
    renderMovPagination(res.pagination);
  } catch (err) {
    console.error('Erro ao carregar movimentações:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Erro ao carregar dados: ${err.message}</td></tr>`;
  }
}
window.loadStockMovements = loadStockMovements;

function renderMovementsTable(movements) {
  const tbody = document.getElementById('stockMovementsTbody');
  if (!tbody) return;

  if (!movements.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">Nenhuma movimentação encontrada para os filtros selecionados.</td></tr>';
    return;
  }

  tbody.innerHTML = movements.map(m => {
    const isPos = m.type === 'entrada' || (m.type === 'ajuste' && m.new_stock > m.previous_stock);
    const sign = isPos ? '+' : '−';
    const absQty = Math.abs(Number(m.quantity) || 0);
    const qtyColor = isPos ? '#10b981' : '#ef4444';
    const prodObj = (typeof allProducts !== 'undefined' && Array.isArray(allProducts)) ? allProducts.find(x => String(x.id) === String(m.product_id)) : null;
    const photo = prodObj ? getProductPhoto(prodObj) : getProductPhoto(m.product_photo || { photo_url: m.product_photo, category: m.product_category });
    const loc = m.to_location || m.current_location || m.location || m.from_location || 'H-04-04';
    const docRef = m.reference || m.document_ref || '';
    const note = m.notes || m.reason || (m.type === 'entrada' ? 'Recebimento WMS' : m.type === 'saida' ? 'Saída de Pedido' : 'Ajuste de Estoque');
    const currentStockVal = m.new_stock !== undefined && m.new_stock !== null ? m.new_stock : (m.stock_qty || 0);

    return `
      <tr>
        <td style="white-space:nowrap;">
          <strong style="font-size:12.5px;display:block;">${formatDate(m.created_at)}</strong>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openProductViewModal(${m.product_id})">
            <img src="${photo}" alt="" style="width:32px;height:32px;border-radius:6px;object-fit:cover;border:1px solid var(--panel-border);aspect-ratio:1;flex-shrink:0;" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
            <div>
              <strong style="font-size:13px;display:block;color:var(--text-primary);">${m.product_name || 'Produto Removido'}</strong>
              <small style="font-family:monospace;font-size:11px;color:var(--text-muted);">${m.product_code || 'S/SKU'}</small>
            </div>
          </div>
        </td>
        <td>${getMovementBadge(m.type)}</td>
        <td><strong style="font-size:13.5px;color:${qtyColor};">${sign}${absQty} un.</strong></td>
        <td>
          <strong style="font-size:13.5px;color:var(--text-primary);">${currentStockVal} un.</strong>
        </td>
        <td>
          <span class="location-badge" style="font-size:11px;" title="Posição no Armazém">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${loc}
          </span>
        </td>
        <td>
          <span style="font-size:12px;font-weight:600;">${m.user_name || 'Administrador'}</span>
        </td>
        <td>
          <div style="font-size:11.5px;max-width:240px;line-height:1.3;">
            ${docRef ? `<strong style="color:var(--text-primary);display:block;">${docRef}</strong>` : ''}
            <span style="color:var(--text-muted);">${note}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderMovPagination(pagination) {
  const container = document.getElementById('movPagination');
  if (!container || !pagination) return;
  const { page, totalPages, total } = pagination;
  if (totalPages <= 1) {
    container.innerHTML = `<span style="font-size:12px;color:var(--text-muted);">Exibindo ${total} registros</span>`;
    return;
  }

  container.innerHTML = `
    <span style="font-size:12px;color:var(--text-muted);">Página ${page} de ${totalPages} (${total} registros)</span>
    <div style="display:inline-flex;gap:6px;">
      <button class="btn btn-secondary btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="loadStockMovements(${page - 1})">&larr; Anterior</button>
      <button class="btn btn-secondary btn-sm" ${page >= totalPages ? 'disabled' : ''} onclick="loadStockMovements(${page + 1})">Próxima &rarr;</button>
    </div>
  `;
}

function debounceMovFilter() {
  clearTimeout(movDebounceTimer);
  movDebounceTimer = setTimeout(() => {
    loadStockMovements(1);
  }, 300);
}
window.debounceMovFilter = debounceMovFilter;

// -------------------------------------------------------------------
// 2. OPERAÇÕES DE ESTOQUE (TELA 5)
// -------------------------------------------------------------------
let currentOpType = 'entrada';

async function loadRecentOperations() {
  const tbody = document.getElementById('recentOperationsTbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Carregando operações recentes...</td></tr>';
  try {
    const res = await api('/stock/movements?limit=10');
    const movements = res.movements || [];
    if (!movements.length) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhuma operação recente registrada.</td></tr>';
      return;
    }
    if (tbody) {
      tbody.innerHTML = movements.map(m => {
        const isPos = m.type === 'entrada' || (m.type === 'ajuste' && m.new_stock > m.previous_stock);
        const sign = isPos ? '+' : '−';
        const absQty = Math.abs(Number(m.quantity) || 0);
        const qtyColor = isPos ? '#10b981' : '#ef4444';
        const loc = m.to_location || m.current_location || m.location || m.from_location || 'H-04-04';
        const docRef = m.reference || m.document_ref || '';
        const note = m.notes || m.reason || (m.type === 'entrada' ? 'Recebimento WMS' : m.type === 'saida' ? 'Saída WMS' : 'Ajuste de Estoque');
        const displayRef = docRef ? `${docRef} — ${note}` : note;
        const currentStockVal = m.new_stock !== undefined && m.new_stock !== null ? m.new_stock : (m.stock_qty || 0);

        return `
          <tr>
            <td><small>${formatDate(m.created_at)}</small></td>
            <td>${getMovementBadge(m.type)}</td>
            <td><strong>${m.product_name || 'Peça'}</strong> <small style="color:var(--text-muted);font-family:monospace;">(${m.product_code || ''})</small></td>
            <td><strong style="color:${qtyColor};">${sign}${absQty} un.</strong></td>
            <td><strong style="font-size:13px;color:var(--text-primary);">${currentStockVal} un.</strong></td>
            <td><span class="location-badge" style="font-size:10.5px;">📍 ${loc}</span></td>
            <td><small>${m.user_name || 'Admin'}</small></td>
            <td><small title="${displayRef}">${displayRef}</small></td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Erro ao carregar operações recentes:', err);
  }
}
window.loadRecentOperations = loadRecentOperations;

function openStockOperationModal(type = 'entrada', prodId = null) {
  currentOpType = type;
  selectOpType(type);

  // Popula o select oculto com as opções para submissão
  const select = document.getElementById('stockOpProductSelect');
  if (select) {
    select.innerHTML = '<option value="">Selecione uma peça...</option>' +
      allProducts.map(p => {
        return `<option value="${p.id}" data-qty="${p.stockQty || 0}" data-loc="${getProductLocation(p)}">${p.name} (${p.code || 'S/SKU'})</option>`;
      }).join('');
  }

  // Inicializa ou atualiza o Combobox com busca instantânea
  if (!stockOpComboboxInstance) {
    stockOpComboboxInstance = initProductCombobox({
      containerId: 'stockOpCombobox',
      inputId: 'stockOpSearchInput',
      dropdownId: 'stockOpDropdown',
      clearBtnId: 'stockOpClearBtn',
      hiddenSelectId: 'stockOpProductSelect',
      onSelect: (p) => {
        onStockOpProductChange();
      }
    });
  }

  if (prodId) {
    stockOpComboboxInstance.setProduct(prodId);
  } else {
    stockOpComboboxInstance.setProduct(null);
    document.getElementById('stockOpInfoCard')?.classList.add('hidden');
  }

  const qtyInput = document.getElementById('stockOpQty');
  if (qtyInput) qtyInput.value = '1';

  const docInput = document.getElementById('stockOpDocRef');
  if (docInput) docInput.value = '';

  const notesInput = document.getElementById('stockOpNotes');
  if (notesInput) notesInput.value = '';

  document.getElementById('stockOperationModal')?.classList.remove('hidden');
}
window.openStockOperationModal = openStockOperationModal;

function closeStockOperationModal() {
  document.getElementById('stockOperationModal')?.classList.add('hidden');
}
window.closeStockOperationModal = closeStockOperationModal;

function selectOpType(type) {
  currentOpType = type;
  
  // Atualiza classes ativas de todas as pills
  document.querySelectorAll('#opTypePills .op-pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });

  const transfFields = document.getElementById('stockOpTransfFields');
  if (transfFields) {
    transfFields.classList.toggle('hidden', type !== 'transferencia');
  }

  const title = document.getElementById('stockOpModalTitle');
  const btn = document.getElementById('btnSubmitStockOp');
  const qtyLabel = document.getElementById('stockOpQtyLabel');

  if (type === 'entrada') {
    if (title) title.textContent = 'Nova Entrada de Estoque (+)';
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Confirmar Entrada (+)';
    if (qtyLabel) qtyLabel.textContent = 'QUANTIDADE A ENTRAR NO ARMAZÉM (+)';
  } else if (type === 'saida') {
    if (title) title.textContent = 'Nova Saída de Estoque (-)';
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Confirmar Saída (-)';
    if (qtyLabel) qtyLabel.textContent = 'QUANTIDADE A RETIRAR DO ESTOQUE (-)';
  } else if (type === 'transferencia') {
    if (title) title.textContent = 'Transferência de Localização (⇄)';
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Confirmar Transferência';
    if (qtyLabel) qtyLabel.textContent = 'QUANTIDADE A TRANSFERIR';
  } else if (type === 'ajuste') {
    if (title) title.textContent = 'Ajuste Manual de Saldo';
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Confirmar Ajuste de Saldo';
    if (qtyLabel) qtyLabel.textContent = 'NOVO SALDO / QUANTIDADE AJUSTADA';
  }
}
window.selectOpType = selectOpType;

function onStockOpProductChange() {
  const select = document.getElementById('stockOpProductSelect');
  const infoCard = document.getElementById('stockOpInfoCard');
  if (!select || !infoCard) return;

  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) {
    infoCard.classList.add('hidden');
    return;
  }

  const qty = opt.dataset.qty || '0';
  const loc = opt.dataset.loc || 'Não definida';

  const elQty = document.getElementById('stockOpCurrentQty');
  if (elQty) elQty.textContent = `${qty} un.`;

  const elLoc = document.getElementById('stockOpCurrentLoc');
  if (elLoc) elLoc.textContent = loc;

  const destInput = document.getElementById('stockOpDestLocation');
  if (destInput && !destInput.value) {
    destInput.value = loc !== 'Não definida' ? loc : 'H-04-04';
  }

  infoCard.classList.remove('hidden');
}
window.onStockOpProductChange = onStockOpProductChange;

function stepOpQty(delta) {
  const inp = document.getElementById('stockOpQty');
  if (!inp) return;
  const cur = parseInt(inp.value, 10) || 1;
  inp.value = Math.max(1, cur + delta);
}
window.stepOpQty = stepOpQty;

async function submitStockOperation() {
  const select = document.getElementById('stockOpProductSelect');
  const prodId = select?.value;
  if (!prodId) {
    showToast('Selecione uma peça para realizar a operação.');
    return;
  }

  const qty = parseInt(document.getElementById('stockOpQty')?.value, 10) || 1;
  if (qty <= 0) {
    showToast('Informe uma quantidade válida maior que zero.');
    return;
  }

  const destinationLocation = document.getElementById('stockOpDestLocation')?.value?.trim();
  const documentRef = document.getElementById('stockOpDocRef')?.value?.trim();
  const userName = document.getElementById('stockOpUser')?.value?.trim() || 'Administrador';
  const reason = document.getElementById('stockOpNotes')?.value?.trim();

  const btn = document.getElementById('btnSubmitStockOp');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processando...';
  }

  try {
    const res = await api('/stock/operations', {
      method: 'POST',
      body: JSON.stringify({
        productId: Number(prodId),
        type: currentOpType,
        quantity: qty,
        destinationLocation: currentOpType === 'transferencia' ? destinationLocation : undefined,
        documentRef,
        userName,
        reason
      })
    });

    showToast(`Operação concluída: ${res.product?.name} (Saldo: ${res.newStock} un.)`);
    closeStockOperationModal();
    await refreshAllData();
    broadcastSync('STOCK_UPDATED');
    loadRecentOperations();
    loadStockMovements();
    loadStockAlerts();
  } catch (err) {
    console.error('Erro ao executar operação de estoque:', err);
    showToast(err.message || 'Erro ao registrar operação.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Confirmar Operação`;
    }
  }
}
window.submitStockOperation = submitStockOperation;

// -------------------------------------------------------------------
// 3. INVENTÁRIO & AUDITORIA (TELA 6)
// -------------------------------------------------------------------
let invDebounceTimer = null;

async function loadInventoryAudit() {
  const tbody = document.getElementById('inventoryAuditTbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Carregando itens para auditoria de inventário...</td></tr>';

  try {
    const res = await api('/stock/inventory');
    const items = res.inventory || [];
    const stats = res.stats || {};

    // Atualiza KPIs
    const elAccuracy = document.getElementById('invKpiAccuracy');
    if (elAccuracy) elAccuracy.textContent = `${stats.accuracy || 100}%`;

    const elAudited = document.getElementById('invKpiAudited');
    if (elAudited) elAudited.textContent = `${stats.auditedCount || 0} / ${stats.totalProducts || 0}`;

    const elAuditedPct = document.getElementById('invKpiAuditedPct');
    if (elAuditedPct) elAuditedPct.textContent = `${stats.auditedPercent || 0}% do catálogo`;

    const elDisc = document.getElementById('invKpiDiscrepancies');
    if (elDisc) elDisc.textContent = `${stats.discrepancyCount || 0} itens`;

    renderInventoryTable(items);
  } catch (err) {
    console.error('Erro ao carregar inventário:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Erro: ${err.message}</td></tr>`;
  }
}
window.loadInventoryAudit = loadInventoryAudit;

function renderInventoryTable(items) {
  const tbody = document.getElementById('inventoryAuditTbody');
  if (!tbody) return;

  const search = (document.getElementById('filterInvSearch')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('filterInvStatus')?.value || '';

  const filtered = items.filter(item => {
    const name = (item.name || '').toLowerCase();
    const code = (item.code || '').toLowerCase();
    const loc = (item.location || '').toLowerCase();
    const matchSearch = !search || name.includes(search) || code.includes(search) || loc.includes(search);

    let matchStatus = true;
    if (statusFilter === 'ok') matchStatus = item.audit_status === 'ok';
    else if (statusFilter === 'divergente') matchStatus = item.audit_status === 'divergente';
    else if (statusFilter === 'pendente') matchStatus = item.audit_status === 'pendente' || !item.audit_status;

    return matchSearch && matchStatus;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhum item corresponde aos critérios de inventário.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const photo = item.photo ? getProductPhoto({ photo: item.photo }) : WMS_NO_PHOTO_SVG;
    let statusBadge = '';
    if (item.audit_status === 'ok') {
      statusBadge = '<span class="status-badge pronto" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;">Conferido (OK)</span>';
    } else if (item.audit_status === 'divergente') {
      statusBadge = '<span class="status-badge cancelado" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">Divergente</span>';
    } else {
      statusBadge = '<span class="status-badge pendente">Pendente</span>';
    }

    const countedDisplay = item.physical_qty !== null && item.physical_qty !== undefined ? `${item.physical_qty} un.` : '<span style="color:var(--text-muted);">&mdash;</span>';
    const diffDisplay = item.difference !== null && item.difference !== undefined ? (
      item.difference === 0 ? '<strong style="color:#10b981;">0 un.</strong>' :
      item.difference > 0 ? `<strong style="color:#10b981;">+${item.difference} un.</strong>` :
      `<strong style="color:#ef4444;">${item.difference} un.</strong>`
    ) : '<span style="color:var(--text-muted);">&mdash;</span>';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="${photo}" alt="" style="width:32px;height:32px;border-radius:6px;object-fit:cover;border:1px solid var(--panel-border);aspect-ratio:1;flex-shrink:0;" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
            <div>
              <strong style="font-size:13px;display:block;color:var(--text-primary);">${item.name}</strong>
              <small style="font-family:monospace;font-size:11px;color:var(--text-muted);">${item.code || 'S/SKU'}</small>
            </div>
          </div>
        </td>
        <td><span class="location-badge" style="font-size:11px;">${item.location || 'H-04-04'}</span></td>
        <td><strong style="font-size:13px;">${item.system_qty} un.</strong></td>
        <td>${countedDisplay}</td>
        <td>${diffDisplay}</td>
        <td>${statusBadge}</td>
        <td><small>${item.last_counted_at ? formatDate(item.last_counted_at) : 'Nunca auditado'}</small></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openNewInventoryModal(${item.id})" style="font-weight:700;">
            ${item.audit_status === 'divergente' ? 'Conciliar' : 'Contar'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNewInventoryModal(prodId = null) {
  const targetId = prodId || (allProducts[0] ? allProducts[0].id : null);
  const p = allProducts.find(x => String(x.id) === String(targetId));

  // Inicializa o Combobox no modal de inventário
  if (!invComboboxInstance) {
    invComboboxInstance = initProductCombobox({
      containerId: 'invCombobox',
      inputId: 'invSearchInput',
      dropdownId: 'invDropdown',
      clearBtnId: 'invClearBtn',
      onSelect: (selectedP) => {
        if (!selectedP) return;
        document.getElementById('invModalProdId').value = selectedP.id;
        document.getElementById('invModalProdName').textContent = selectedP.name;
        document.getElementById('invModalProdSku').textContent = `SKU: ${selectedP.code || 'S/SKU'}`;
        document.getElementById('invModalSystemQty').textContent = `${selectedP.stockQty || 0} un.`;
        document.getElementById('invModalLocation').textContent = getProductLocation(selectedP);
        calcInvDiscrepancy();
      }
    });
  }

  if (p) {
    invComboboxInstance.setProduct(p);
    document.getElementById('invModalProdId').value = p.id;
    document.getElementById('invModalProdName').textContent = p.name;
    document.getElementById('invModalProdSku').textContent = `SKU: ${p.code || 'S/SKU'}`;
    document.getElementById('invModalSystemQty').textContent = `${p.stockQty || 0} un.`;
    document.getElementById('invModalLocation').textContent = getProductLocation(p);
  }

  const countInput = document.getElementById('invModalCountedQty');
  if (countInput) countInput.value = p ? (p.stockQty || 0) : 0;

  const notesInput = document.getElementById('invModalNotes');
  if (notesInput) notesInput.value = '';

  calcInvDiscrepancy();

  document.getElementById('inventoryCountModal')?.classList.remove('hidden');
}
window.openNewInventoryModal = openNewInventoryModal;

function closeInventoryCountModal() {
  document.getElementById('inventoryCountModal')?.classList.add('hidden');
}
window.closeInventoryCountModal = closeInventoryCountModal;

function stepInvCount(delta) {
  const inp = document.getElementById('invModalCountedQty');
  if (!inp) return;
  const cur = parseInt(inp.value, 10) || 0;
  inp.value = Math.max(0, cur + delta);
  calcInvDiscrepancy();
}
window.stepInvCount = stepInvCount;

function calcInvDiscrepancy() {
  const prodId = document.getElementById('invModalProdId')?.value;
  const p = allProducts.find(x => String(x.id) === String(prodId));
  if (!p) return;

  const sys = Number(p.stockQty) || 0;
  const count = parseInt(document.getElementById('invModalCountedQty')?.value, 10) || 0;
  const diff = count - sys;

  const banner = document.getElementById('invDiscrepancyBanner');
  const diffVal = document.getElementById('invDiffVal');
  const statusText = document.getElementById('invDiffStatusText');

  if (diffVal) {
    diffVal.textContent = diff === 0 ? '0 un.' : (diff > 0 ? `+${diff} un.` : `${diff} un.`);
  }

  if (banner && statusText) {
    if (diff === 0) {
      banner.style.background = 'rgba(16,185,129,0.1)';
      banner.style.borderColor = 'rgba(16,185,129,0.3)';
      diffVal.style.color = '#10b981';
      statusText.textContent = 'Contagem física idêntica ao sistema (100% acurado)';
    } else {
      banner.style.background = 'rgba(239,68,68,0.1)';
      banner.style.borderColor = 'rgba(239,68,68,0.3)';
      diffVal.style.color = '#ef4444';
      statusText.textContent = `Divergência detectada! O estoque será ajustado para ${count} un.`;
    }
  }
}
window.calcInvDiscrepancy = calcInvDiscrepancy;

async function submitInventoryCount() {
  const prodId = document.getElementById('invModalProdId')?.value;
  const p = allProducts.find(x => String(x.id) === String(prodId));
  if (!p) return;

  const physicalQty = parseInt(document.getElementById('invModalCountedQty')?.value, 10) || 0;
  const notes = document.getElementById('invModalNotes')?.value?.trim();

  const btn = document.getElementById('btnSaveInventoryCount');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Conciliando...';
  }

  try {
    // 1. Registra contagem
    await api('/stock/inventory/count', {
      method: 'POST',
      body: JSON.stringify({
        productId: Number(prodId),
        countedStock: physicalQty,
        physicalQty,
        notes,
        auditorName: 'Administrador'
      })
    });

    // 2. Se houver divergência, reconcilia o estoque automaticamente
    const currentStock = Number(p.stockQty) || 0;
    if (physicalQty !== currentStock) {
      await api('/stock/inventory/reconcile', {
        method: 'POST',
        body: JSON.stringify({
          productId: Number(prodId),
          countedStock: physicalQty,
          reconciledStock: physicalQty,
          physicalQty,
          notes: notes || `Conciliação de inventário: saldo corrigido de ${currentStock} para ${physicalQty} un.`,
          reason: `Conciliação de inventário: saldo corrigido de ${currentStock} para ${physicalQty} un.`
        })
      });
    }

    showToast(`Inventário de "${p.name}" salvo com sucesso!`);
    closeInventoryCountModal();
    await refreshAllData();
    broadcastSync('STOCK_UPDATED');
    loadInventoryAudit();
    loadStockMovements();
    loadStockAlerts();
  } catch (err) {
    console.error('Erro ao salvar inventário:', err);
    showToast(err.message || 'Erro ao registrar contagem.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Salvar Contagem e Conciliar`;
    }
  }
}
window.submitInventoryCount = submitInventoryCount;

function debounceInvFilter() {
  clearTimeout(invDebounceTimer);
  invDebounceTimer = setTimeout(() => {
    loadInventoryAudit();
  }, 250);
}
window.debounceInvFilter = debounceInvFilter;

// -------------------------------------------------------------------
// 4. ALERTAS & ESTOQUE CRÍTICO (TELA 7)
// -------------------------------------------------------------------
let currentAlertFilterType = 'todos';
let alertDebounceTimer = null;
let stockAlertsCache = null;

async function loadStockAlerts() {
  try {
    const res = await api('/stock/alerts');
    stockAlertsCache = res;

    // Atualiza contadores dos cards de alerta
    const elCrit = document.getElementById('alertCardCriticoCount');
    if (elCrit) elCrit.textContent = String(res.counts?.critical || 0);

    const elLow = document.getElementById('alertCardBaixoCount');
    if (elLow) elLow.textContent = String(res.counts?.low || 0);

    const elNoLoc = document.getElementById('alertCardSemLocalCount');
    if (elNoLoc) elNoLoc.textContent = String(res.counts?.noLocation || 0);

    const elDisc = document.getElementById('alertCardDivergenciaCount');
    if (elDisc) elDisc.textContent = String(res.counts?.discrepancy || 0);

    // Atualiza box "⚠ PRECISA DE ATENÇÃO" do Dashboard Operacional
    const dCrit = document.getElementById('dashCritCount');
    if (dCrit) dCrit.textContent = String(res.counts?.critical || 0);

    const dLow = document.getElementById('dashLowCount');
    if (dLow) dLow.textContent = String(res.counts?.low || 0);

    const dNoLoc = document.getElementById('dashNoLocCount');
    if (dNoLoc) dNoLoc.textContent = String(res.counts?.noLocation || 0);

    const dDisc = document.getElementById('dashDiscCount');
    if (dDisc) dDisc.textContent = String(res.counts?.discrepancy || 0);

    renderAlertsTable();
  } catch (err) {
    console.error('Erro ao carregar alertas:', err);
  }
}
window.loadStockAlerts = loadStockAlerts;

function filterAlertTab(type) {
  currentAlertFilterType = type;
  document.querySelectorAll('#pane-alertas .ped-kpi-card, .wms-alert-cards-grid .wms-alert-card').forEach(c => {
    c.classList.remove('active');
  });

  if (type === 'critico') document.querySelector('#pane-alertas .card-critico, .wms-alert-card.card-critico')?.classList.add('active');
  else if (type === 'baixo') document.querySelector('#pane-alertas .card-baixo, .wms-alert-card.card-baixo')?.classList.add('active');
  else if (type === 'sem_local') document.querySelector('#pane-alertas .card-sem-local, .wms-alert-card.card-sem-local')?.classList.add('active');
  else if (type === 'divergencia') document.querySelector('#pane-alertas .card-divergencia, .wms-alert-card.card-divergencia')?.classList.add('active');

  const select = document.getElementById('filterAlertSelect');
  if (select) select.value = type;

  renderAlertsTable();
}
window.filterAlertTab = filterAlertTab;

function filterMovByType(type) {
  const sel = document.getElementById('filterMovType');
  if (sel) {
    sel.value = type;
    loadStockMovements();
  }
}
window.filterMovByType = filterMovByType;

function filterInventoryByStatus(status) {
  const sel = document.getElementById('filterInvStatus');
  if (sel) {
    sel.value = status;
    loadInventoryAudit();
  }
}
window.filterInventoryByStatus = filterInventoryByStatus;

function filterInventoryByCorredor(corredor) {
  const searchInput = document.getElementById('filterInvSearch');
  if (searchInput) {
    searchInput.value = corredor ? corredor + '-' : '';
    loadInventoryAudit();
  }
}
window.filterInventoryByCorredor = filterInventoryByCorredor;

function filterAlertsByPriority(priority) {
  renderAlertsTable();
}
window.filterAlertsByPriority = filterAlertsByPriority;

function filterRecentOps(type) {
  const rows = document.querySelectorAll('#recentOperationsTbody tr');
  rows.forEach(tr => {
    if (!type) {
      tr.style.display = '';
      return;
    }
    const text = tr.innerText.toLowerCase();
    tr.style.display = text.includes(type.toLowerCase()) ? '' : 'none';
  });
}
window.filterRecentOps = filterRecentOps;

function filterRecentOpsSearch(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#recentOperationsTbody tr');
  rows.forEach(tr => {
    if (!q) {
      tr.style.display = '';
      return;
    }
    const text = tr.innerText.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}
window.filterRecentOpsSearch = filterRecentOpsSearch;

function filterWarehouseRackSearch(query) {
  const q = (query || '').toUpperCase().trim();
  if (q.length >= 1) {
    const aisleMatch = q.charAt(0);
    if (['A', 'B', 'C', 'D', 'H'].includes(aisleMatch) && typeof selectAisle === 'function') {
      selectAisle(aisleMatch);
    }
  }
}
window.filterWarehouseRackSearch = filterWarehouseRackSearch;

function filterNfStatus(status) {
  const rows = document.querySelectorAll('#pane-notas-fiscais tbody tr');
  rows.forEach(tr => {
    if (!status) {
      tr.style.display = '';
      return;
    }
    const text = tr.innerText.toLowerCase();
    tr.style.display = text.includes(status.toLowerCase()) ? '' : 'none';
  });
}
window.filterNfStatus = filterNfStatus;

function renderAlertsTable() {
  const tbody = document.getElementById('alertsTbody');
  if (!tbody || !stockAlertsCache) return;

  const search = (document.getElementById('filterAlertSearch')?.value || '').toLowerCase().trim();
  const alertItems = stockAlertsCache.alerts || [];

  const filtered = alertItems.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search) || (item.code || '').toLowerCase().includes(search);
    let matchType = true;
    if (currentAlertFilterType !== 'todos') {
      matchType = item.alertType === currentAlertFilterType;
    }
    return matchSearch && matchType;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Nenhum produto em estado crítico para esta categoria. Tudo em ordem no armazém!</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    let alertBadge = '';
    let actionBtn = '';

    if (item.alertType === 'critico') {
      alertBadge = '<span class="status-badge cancelado" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">🔴 Crítico (Zerado)</span>';
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="openStockOperationModal('entrada', ${item.id})">+ Repor Estoque</button>`;
    } else if (item.alertType === 'baixo') {
      alertBadge = '<span class="status-badge em_preparacao" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;">🟠 Baixo Estoque</span>';
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="openStockOperationModal('entrada', ${item.id})">+ Adicionar</button>`;
    } else if (item.alertType === 'sem_local') {
      alertBadge = '<span class="status-badge" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;">📍 Sem Endereço</span>';
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="openStockOperationModal('transferencia', ${item.id})">Endereçar</button>`;
    } else if (item.alertType === 'divergencia') {
      alertBadge = '<span class="status-badge" style="background:#fff7ed;color:#ea580c;border:1px solid #ffedd5;">📋 Divergência</span>';
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="openNewInventoryModal(${item.id})">Conciliar</button>`;
    }

    const photo = item.photo ? getProductPhoto({ photo: item.photo }) : WMS_NO_PHOTO_SVG;

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openProductViewModal(${item.id})">
            <img src="${photo}" alt="" style="width:32px;height:32px;border-radius:6px;object-fit:cover;border:1px solid var(--panel-border);aspect-ratio:1;flex-shrink:0;" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
            <div>
              <strong style="font-size:13px;display:block;color:var(--text-primary);">${item.name}</strong>
              <small style="font-family:monospace;font-size:11px;color:var(--text-muted);">${item.code || 'S/SKU'}</small>
            </div>
          </div>
        </td>
        <td><span class="cat-pill-badge">${item.category || 'Geral'}</span></td>
        <td><strong style="font-size:13.5px;color:${item.stockQty <= 0 ? '#ef4444' : '#d97706'};">${item.stockQty} un.</strong></td>
        <td><span style="font-size:12px;color:var(--text-muted);">${item.minStock || 5} un.</span></td>
        <td><span class="location-badge" style="font-size:11px;">${item.location || 'Sem posição'}</span></td>
        <td>${alertBadge}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

function debounceAlertFilter() {
  clearTimeout(alertDebounceTimer);
  alertDebounceTimer = setTimeout(renderAlertsTable, 200);
}
window.debounceAlertFilter = debounceAlertFilter;

// -------------------------------------------------------------------
// 5. LOCALIZAÇÕES DO ARMAZÉM (TELA 8)
// -------------------------------------------------------------------
let currentWarehouseAisle = 'H';
let currentWarehouseModule = '04';
let currentWarehouseShelf = '04';

function selectAisle(aisle) {
  currentWarehouseAisle = aisle;
  document.querySelectorAll('#aisleChips .aisle-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.aisle === aisle);
  });
  renderWarehouseLocation();
}
window.selectAisle = selectAisle;

function selectModule(mod) {
  currentWarehouseModule = mod;
  document.querySelectorAll('#moduleChips .module-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.module === mod);
  });
  renderWarehouseLocation();
}
window.selectModule = selectModule;

function selectShelf(shelf) {
  currentWarehouseShelf = shelf;
  document.querySelectorAll('#shelfChips .shelf-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.shelf === shelf);
  });
  renderWarehouseLocation();
}
window.selectShelf = selectShelf;

function renderWarehouseLocation() {
  const code = `${currentWarehouseAisle}-${currentWarehouseModule}-${currentWarehouseShelf}`;

  const codeEl = document.getElementById('locCurrentCode');
  if (codeEl) codeEl.textContent = code;

  const breadAisle = document.getElementById('locBreadAisle');
  if (breadAisle) breadAisle.textContent = `Corredor ${currentWarehouseAisle}`;

  const breadMod = document.getElementById('locBreadModule');
  if (breadMod) breadMod.textContent = `Módulo ${currentWarehouseModule}`;

  const breadShelf = document.getElementById('locBreadShelf');
  if (breadShelf) breadShelf.textContent = `Prateleira ${currentWarehouseShelf}`;

  // Atualiza o texto dinâmico no visualizador 3D do rack WMS
  const svgText = document.getElementById('rackSvgActiveCode');
  if (svgText) svgText.textContent = code;

  // Filtra produtos nesta localização
  const matchingProducts = allProducts.filter(p => {
    const loc = getProductLocation(p).toUpperCase();
    return loc.includes(code.toUpperCase()) || loc.includes(currentWarehouseAisle);
  });

  const countEl = document.getElementById('locItemCount');
  if (countEl) countEl.textContent = `${matchingProducts.length} produto(s)`;

  const totalUnits = matchingProducts.reduce((sum, p) => sum + (Number(p.stockQty) || 0), 0);
  const unitsEl = document.getElementById('locTotalUnits');
  if (unitsEl) unitsEl.textContent = `${totalUnits} un.`;

  const tbody = document.getElementById('locProductsTbody');
  if (!tbody) return;

  if (!matchingProducts.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          Nenhuma peça alocada diretamente no endereço <strong>${code}</strong>.
          <br/><button class="btn btn-sm btn-secondary" style="margin-top:8px;" onclick="openStockOperationModal('transferencia')">Mover Peça para Cá</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = matchingProducts.map(p => {
    const photo = getProductPhoto(p);
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openProductViewModal(${p.id})">
            <img src="${photo}" alt="" style="width:32px;height:32px;border-radius:6px;object-fit:cover;border:1px solid var(--panel-border);aspect-ratio:1;flex-shrink:0;" onerror="this.onerror=null; this.src=window.WMS_NO_PHOTO_SVG;"/>
            <div>
              <strong style="font-size:13px;display:block;color:var(--text-primary);">${p.name}</strong>
              <small style="font-family:monospace;font-size:11px;color:var(--text-muted);">${p.code || 'S/SKU'}</small>
            </div>
          </div>
        </td>
        <td><span class="cat-pill-badge">${p.category || 'Geral'}</span></td>
        <td><strong style="font-size:13px;">${p.stockQty || 0} un.</strong></td>
        <td>${p.stockQty > 5 ? '<span class="status-badge pronto">Disponível</span>' : '<span class="status-badge em_preparacao">Baixo</span>'}</td>
        <td>
          <div style="display:inline-flex;gap:4px;">
            <button class="btn btn-secondary btn-sm" onclick="openStockLabelModal(${p.id})" title="Imprimir Etiqueta">&#128224; Etiqueta</button>
            <button class="btn btn-secondary btn-sm" onclick="openStockOperationModal('transferencia', ${p.id})" title="Transferir de Local">⇄ Mover</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderWarehouseLocation = renderWarehouseLocation;

function openLocationPickerModal() {
  openStockOperationModal('transferencia');
}
window.openLocationPickerModal = openLocationPickerModal;

// -------------------------------------------------------------------
// 6. ETIQUETA DE PRODUTO (SCREEN 9: CODE128 + QR CODE MULTI-FORMATO)
// -------------------------------------------------------------------
let currentLabelProduct = null;

function generateLabelHtmlForFormat(product, format, isPrint = false) {
  const loc = getProductLocation(product);
  const barcodeText = product.code || `PROD-${product.id || '0000'}`;
  const qrData = encodeURIComponent(`FAHREN WMS|${barcodeText}|${product.name || 'Peça'}|${loc}`);
  const prodName = product.name || 'Peça Automotiva';
  const prodCode = product.code || 'S/SKU';
  const category = product.category || 'Peça / Componente';
  const lotDate = new Date().toLocaleDateString('pt-BR');
  const lotNumber = `L-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  function realQrImg(size) {
    return `<img src="/api/stock/qrcode?text=${qrData}&size=${size}" alt="QR ${prodCode}" width="${size}" height="${size}" style="display:block;border-radius:3px;background:#fff;" />`;
  }


  if (format === 'compacta') {
    // 60 x 30 mm (Peças Pequenas)
    const bcHeight = isPrint ? 14 : 20;
    const qrSize = isPrint ? 36 : 40;
    return `
      <div class="stock-label-card label-card-compacta" data-format="compacta">
        <div class="label-header compact">
          <div class="label-brand">
            <span class="label-brand-main">FAHREN</span>
            <span class="label-brand-sub">MOTORS</span>
          </div>
          <span class="label-tag-compact">WMS</span>
        </div>
        <div class="label-product-name compact" title="${prodName}">${prodName}</div>
        <div class="label-details-row compact">
          <span><strong>SKU:</strong> ${prodCode}</span>
          <span><strong>LOC:</strong> ${loc}</span>
        </div>
        <div class="label-barcodes-container compact">
          <div class="label-barcode-left">
            <div class="barcode-svg-render">${generateCode128Svg(barcodeText, bcHeight, 'label-barcode-svg')}</div>
            <span class="barcode-num-text compact">${barcodeText}</span>
          </div>
          <div class="label-qrcode-right compact">
            ${realQrImg(qrSize)}
          </div>
        </div>
      </div>
    `;
  }

  if (format === 'grande') {
    // 100 x 100 mm (Caixa Master / Pallet)
    const bcHeight = isPrint ? 32 : 38;
    const qrSize = isPrint ? 72 : 70;
    return `
      <div class="stock-label-card label-card-grande" data-format="grande">
        <div class="label-header grande">
          <div class="label-brand">
            <span class="label-brand-main">FAHREN</span>
            <span class="label-brand-sub">MOTORS</span>
          </div>
          <div class="label-tag grande">CAIXA MASTER / IDENTIFICAÇÃO WMS</div>
        </div>
        <div class="label-product-name grande" title="${prodName}">${prodName}</div>
        <div class="label-grid-quad">
          <div class="quad-cell">
            <span class="quad-label">CÓDIGO / SKU</span>
            <strong class="quad-val">${prodCode}</strong>
          </div>
          <div class="quad-cell">
            <span class="quad-label">LOCALIZAÇÃO WMS</span>
            <strong class="quad-val quad-loc">${loc}</strong>
          </div>
          <div class="quad-cell">
            <span class="quad-label">CATEGORIA</span>
            <strong class="quad-val">${category}</strong>
          </div>
          <div class="quad-cell">
            <span class="quad-label">DATA / LOTE</span>
            <strong class="quad-val">${lotDate} &bull; ${lotNumber}</strong>
          </div>
        </div>
        <div class="label-barcodes-container grande">
          <div class="label-barcode-left">
            <div class="barcode-svg-render">${generateCode128Svg(barcodeText, bcHeight, 'label-barcode-svg')}</div>
            <span class="barcode-num-text grande">${barcodeText}</span>
          </div>
          <div class="label-qrcode-right grande">
            ${realQrImg(qrSize)}
          </div>
        </div>
        <div class="label-inspection-box">
          <span>CONFERÊNCIA WMS: [&nbsp;&nbsp;] APROVADO</span>
          <span>RESPONSÁVEL: ___________________</span>
        </div>
        <div class="label-footer grande">
          <span>Rastreabilidade Logística WMS &bull; Fahren Motors &bull; fahrenmotors.com.br</span>
        </div>
      </div>
    `;
  }

  // Padrão WMS: 100 x 50 mm
  const bcHeight = isPrint ? 24 : 28;
  const qrSize = isPrint ? 52 : 52;
  return `
    <div class="stock-label-card label-card-padrao" data-format="padrao">
      <div class="label-header">
        <div class="label-brand">
          <span class="label-brand-main">FAHREN</span>
          <span class="label-brand-sub">MOTORS</span>
        </div>
        <div class="label-tag">WMS AUTO</div>
      </div>
      <div class="label-product-name" title="${prodName}">${prodName}</div>
      <div class="label-details-row">
        <div class="label-detail-item">
          <span class="lbl-k">SKU:</span>
          <strong class="lbl-v">${prodCode}</strong>
        </div>
        <div class="label-detail-item">
          <span class="lbl-k">Local:</span>
          <strong class="lbl-v">${loc}</strong>
        </div>
        <div class="label-detail-item">
          <span class="lbl-k">Cat:</span>
          <strong class="lbl-v">${category}</strong>
        </div>
      </div>
      <div class="label-barcodes-container">
        <div class="label-barcode-left">
          <div class="barcode-svg-render">${generateCode128Svg(barcodeText, bcHeight, 'label-barcode-svg')}</div>
          <span class="barcode-num-text">${barcodeText}</span>
        </div>
        <div class="label-qrcode-right">
          ${realQrImg(qrSize)}
        </div>
      </div>
      <div class="label-footer">
        <span>Peça Genuína / Fahren Motors &bull; fahrenmotors.com.br</span>
      </div>
    </div>
  `;
}
window.generateLabelHtmlForFormat = generateLabelHtmlForFormat;

function openStockLabelModal(prodId) {
  const p = allProducts.find(x => String(x.id) === String(prodId));
  if (!p) return;
  currentLabelProduct = p;

  updateLabelFormat();
  document.getElementById('stockLabelModal')?.classList.remove('hidden');
}
window.openStockLabelModal = openStockLabelModal;

function closeStockLabelModal() {
  document.getElementById('stockLabelModal')?.classList.add('hidden');
}
window.closeStockLabelModal = closeStockLabelModal;

function updateLabelFormat() {
  if (!currentLabelProduct) return;
  const format = document.getElementById('labelSizeSelect')?.value || 'padrao';
  const container = document.getElementById('labelPrintContainer');
  if (!container) return;

  const cardHtml = generateLabelHtmlForFormat(currentLabelProduct, format, false);

  let dimLabel = '100 × 50 mm (Padrão Industrial WMS)';
  if (format === 'compacta') dimLabel = '60 × 30 mm (Peças Pequenas / Micro)';
  if (format === 'grande') dimLabel = '100 × 100 mm (Caixa Master / Pallet)';

  container.innerHTML = `
    <div class="label-preview-dimension-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
      Dimensão Física de Impressão: <strong>${dimLabel}</strong>
    </div>
    <div class="label-preview-stage format-${format}">
      ${cardHtml}
    </div>
  `;
}
window.updateLabelFormat = updateLabelFormat;

function printStockLabel() {
  if (!currentLabelProduct) {
    showToast('Nenhum produto selecionado para impressão.');
    return;
  }
  const format = document.getElementById('labelSizeSelect')?.value || 'padrao';
  const copiesInput = document.getElementById('labelCopies');
  let copies = parseInt(copiesInput?.value, 10) || 1;
  if (copies < 1) copies = 1;
  if (copies > 100) copies = 100;

  let widthMm = 100;
  let heightMm = 50;
  if (format === 'compacta') {
    widthMm = 60;
    heightMm = 30;
  } else if (format === 'grande') {
    widthMm = 100;
    heightMm = 100;
  }

  const singleCardHtml = generateLabelHtmlForFormat(currentLabelProduct, format, true);
  let pagesHtml = '';
  for (let i = 0; i < copies; i++) {
    pagesHtml += `<div class="print-page">${singleCardHtml}</div>`;
  }

  const printDocumentHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Etiqueta ${currentLabelProduct.code || 'WMS'} - ${widthMm}x${heightMm}mm</title>
      <style>
        @page {
          size: ${widthMm}mm ${heightMm}mm;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          width: ${widthMm}mm;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .print-page {
          width: ${widthMm}mm;
          height: ${heightMm}mm;
          page-break-after: always;
          break-after: page;
          box-sizing: border-box;
          overflow: hidden;
          background: #fff;
          display: flex;
          flex-direction: column;
          padding: 0;
        }
        .print-page:last-child {
          page-break-after: avoid;
          break-after: avoid;
        }

        .stock-label-card {
          width: 100%;
          height: 100%;
          border: 1px solid #000;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #fff;
          color: #000;
        }

        /* MODELO PADRÃO (100 x 50 mm) */
        .label-card-padrao {
          padding: 2.5mm 3.5mm;
        }
        .label-card-padrao .label-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1.5px solid #000;
          padding-bottom: 1.5mm;
          margin-bottom: 1mm;
        }
        .label-card-padrao .label-brand-main {
          font-size: 12pt;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        .label-card-padrao .label-brand-sub {
          font-size: 8.5pt;
          font-weight: 700;
          color: #555;
          margin-left: 2px;
        }
        .label-card-padrao .label-tag {
          font-size: 7.5pt;
          font-weight: 800;
          background: #000;
          color: #fff;
          padding: 1px 5px;
          border-radius: 2px;
        }
        .label-card-padrao .label-product-name {
          font-size: 10pt;
          font-weight: 800;
          line-height: 1.15;
          max-height: 2.3em;
          overflow: hidden;
          margin-bottom: 1mm;
        }
        .label-card-padrao .label-details-row {
          display: flex;
          justify-content: space-between;
          font-size: 8pt;
          border-bottom: 1px dashed #666;
          padding-bottom: 1mm;
          margin-bottom: 1mm;
        }
        .label-card-padrao .lbl-k { color: #444; }
        .label-card-padrao .lbl-v { font-weight: 800; font-family: monospace; }
        .label-card-padrao .label-barcodes-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 3mm;
          flex: 1;
        }
        .label-card-padrao .label-barcode-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
        }
        .stock-label-card svg rect.barcode-bg,
        svg rect.barcode-bg {
          fill: #ffffff !important;
        }
        .stock-label-card svg rect.barcode-bar,
        svg rect.barcode-bar {
          fill: #000000 !important;
        }
        .label-card-padrao .barcode-svg-render svg {
          width: 100%;
          height: 22px;
          display: block;
        }
        .label-card-padrao .barcode-num-text {
          font-size: 7.5pt;
          font-family: monospace;
          font-weight: 700;
          letter-spacing: 1px;
          margin-top: 1px;
        }
        .label-card-padrao .label-qrcode-right svg {
          width: 16mm;
          height: 16mm;
          display: block;
        }
        .label-card-padrao .label-footer {
          font-size: 6pt;
          text-align: center;
          color: #444;
          margin-top: 0.5mm;
          border-top: 0.5px solid #ccc;
          padding-top: 0.5mm;
        }

        /* MODELO COMPACTO (60 x 30 mm) */
        .label-card-compacta {
          padding: 1.2mm 2mm;
        }
        .label-card-compacta .label-header.compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #000;
          padding-bottom: 0.5mm;
          margin-bottom: 0.5mm;
        }
        .label-card-compacta .label-brand-main {
          font-size: 8pt;
          font-weight: 900;
        }
        .label-card-compacta .label-brand-sub {
          font-size: 6pt;
          font-weight: 700;
          color: #555;
        }
        .label-card-compacta .label-tag-compact {
          font-size: 6pt;
          font-weight: 800;
          background: #000;
          color: #fff;
          padding: 0 3px;
          border-radius: 2px;
        }
        .label-card-compacta .label-product-name.compact {
          font-size: 7pt;
          font-weight: 800;
          line-height: 1.1;
          max-height: 2.2em;
          overflow: hidden;
          margin-bottom: 0.5mm;
        }
        .label-card-compacta .label-details-row.compact {
          display: flex;
          justify-content: space-between;
          font-size: 6pt;
          border-bottom: 0.5px dashed #888;
          padding-bottom: 0.5mm;
          margin-bottom: 0.5mm;
        }
        .label-card-compacta .label-barcodes-container.compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5mm;
          flex: 1;
        }
        .label-card-compacta .barcode-svg-render svg {
          width: 100%;
          height: 13px;
          display: block;
        }
        .label-card-compacta .barcode-num-text.compact {
          font-size: 5.5pt;
          font-family: monospace;
          font-weight: 700;
          text-align: center;
          display: block;
        }
        .label-card-compacta .label-qrcode-right.compact svg {
          width: 10.5mm;
          height: 10.5mm;
          display: block;
        }

        /* MODELO GRANDE / CAIXA MASTER (100 x 100 mm) */
        .label-card-grande {
          padding: 3.5mm 4.5mm;
        }
        .label-card-grande .label-header.grande {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 1.5mm;
          margin-bottom: 2mm;
        }
        .label-card-grande .label-brand-main {
          font-size: 14pt;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        .label-card-grande .label-brand-sub {
          font-size: 9.5pt;
          font-weight: 700;
          color: #555;
        }
        .label-card-grande .label-tag.grande {
          font-size: 7.5pt;
          font-weight: 800;
          background: #000;
          color: #fff;
          padding: 1.5px 6px;
          border-radius: 2px;
        }
        .label-card-grande .label-product-name.grande {
          font-size: 12.5pt;
          font-weight: 900;
          line-height: 1.15;
          margin-bottom: 2.5mm;
          max-height: 2.3em;
          overflow: hidden;
        }
        .label-card-grande .label-grid-quad {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5mm;
          margin-bottom: 2.5mm;
        }
        .label-card-grande .quad-cell {
          border: 1px solid #000;
          padding: 1.2mm 2mm;
          border-radius: 2px;
        }
        .label-card-grande .quad-label {
          display: block;
          font-size: 6pt;
          font-weight: 700;
          color: #555;
          text-transform: uppercase;
        }
        .label-card-grande .quad-val {
          display: block;
          font-size: 9pt;
          font-weight: 800;
          margin-top: 1px;
        }
        .label-card-grande .quad-loc {
          background: #f0f0f0;
          display: inline-block;
          padding: 0 3px;
        }
        .label-card-grande .label-barcodes-container.grande {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 3mm;
          border-top: 1px dashed #777;
          border-bottom: 1px dashed #777;
          padding: 2mm 0;
          margin-bottom: 2mm;
        }
        .label-card-grande .barcode-svg-render svg {
          width: 100%;
          height: 28px;
          display: block;
        }
        .label-card-grande .barcode-num-text.grande {
          font-size: 8.5pt;
          font-family: monospace;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-align: center;
          display: block;
          margin-top: 1mm;
        }
        .label-card-grande .label-qrcode-right.grande svg {
          width: 22mm;
          height: 22mm;
          display: block;
        }
        .label-card-grande .label-inspection-box {
          border: 1px solid #777;
          padding: 1.2mm 1.8mm;
          font-size: 6.5pt;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          margin-bottom: 1mm;
        }
        .label-card-grande .label-footer.grande {
          font-size: 6.5pt;
          text-align: center;
          color: #444;
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;

  let iframe = document.getElementById('wmsLabelPrintIframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'wmsLabelPrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
  }

  iframe.srcdoc = printDocumentHtml;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Erro ao acionar janela de impressão:', err);
      }
    }, 250);
  };
}
window.printStockLabel = printStockLabel;
