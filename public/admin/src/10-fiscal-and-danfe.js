// Módulo WMS: 10-fiscal-and-danfe.js
// Fahren Motors - Painel de Gestão WMS

// ---------- 6. NOTAS FISCAIS & DANFE (NOVA SOLICITAÇÃO) ----------
const NF_STORAGE_KEY = 'fahren_issued_nfs';
const AUTO_NF_STORAGE_KEY = 'fahren_auto_nf_enabled';
const AUTO_PRINT_NF_STORAGE_KEY = 'fahren_auto_print_nf_enabled';

function isAutoNfEnabled() {
  return localStorage.getItem(AUTO_NF_STORAGE_KEY) !== 'false';
}

function isAutoPrintNfEnabled() {
  return localStorage.getItem(AUTO_PRINT_NF_STORAGE_KEY) === 'true';
}

function initAutoNfToggle() {
  const toggle = document.getElementById('autoNfToggle');
  const badge = document.getElementById('autoNfStatusBadge');
  if (toggle) {
    const active = isAutoNfEnabled();
    toggle.checked = active;
    if (badge) {
      badge.textContent = active ? 'ATIVADO' : 'DESATIVADO';
      badge.style.color = active ? 'var(--accent-green)' : 'var(--text-muted)';
    }

    toggle.onchange = () => {
      const enabled = toggle.checked;
      try { localStorage.setItem(AUTO_NF_STORAGE_KEY, enabled ? 'true' : 'false'); } catch (e) {}
      if (badge) {
        badge.textContent = enabled ? 'ATIVADO' : 'DESATIVADO';
        badge.style.color = enabled ? 'var(--accent-green)' : 'var(--text-muted)';
      }
      if (enabled) {
        allOrders.forEach(o => {
          if (o.status !== 'cancelado') markNfAsIssued(o.id);
        });
        renderFiscalTable();
      }
    };
  }

  const printToggle = document.getElementById('autoPrintNfToggle');
  const printBadge = document.getElementById('autoPrintNfStatusBadge');
  if (printToggle) {
    const printActive = isAutoPrintNfEnabled();
    printToggle.checked = printActive;
    if (printBadge) {
      printBadge.textContent = printActive ? 'ATIVADO' : 'DESATIVADO';
      printBadge.style.color = printActive ? 'var(--accent-green)' : 'var(--text-muted)';
    }

    printToggle.onchange = () => {
      const enabled = printToggle.checked;
      try { localStorage.setItem(AUTO_PRINT_NF_STORAGE_KEY, enabled ? 'true' : 'false'); } catch (e) {}
      if (printBadge) {
        printBadge.textContent = enabled ? 'ATIVADO' : 'DESATIVADO';
        printBadge.style.color = enabled ? 'var(--accent-green)' : 'var(--text-muted)';
      }
      showToast(enabled
        ? 'Impressão automática de NF ativada! Novas notas serão enviadas à impressora.'
        : 'Impressão automática de NF desativada.');
    };
  }
}

function getIssuedNfsMap() {
  try {
    return JSON.parse(localStorage.getItem(NF_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function calculateNfAccessKeyDv(key43) {
  const digits = String(key43).replace(/\D/g, '').slice(0, 43);
  if (digits.length !== 43) return '0';
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += parseInt(digits[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const dv = (remainder === 0 || remainder === 1) ? 0 : 11 - remainder;
  return String(dv);
}

function generateNfAccessKey(orderId) {
  // Gera chave de acesso oficial NFe de 44 dígitos com Dígito Verificador Módulo 11 SEFAZ
  const year = '26';
  const month = '09';
  const cnpjClean = '47784317000120';
  const model = '55';
  const serie = '001';
  const numNf = String(orderId).padStart(9, '0');
  const typeEmis = '1';
  const codeNum = String(10000000 + Number(orderId) * 17).slice(-8);
  const rawKey43 = `35${year}${month}${cnpjClean}${model}${serie}${numNf}${typeEmis}${codeNum}`;
  const dv = calculateNfAccessKeyDv(rawKey43);
  const fullKey = rawKey43 + dv;
  // Formata com espaços a cada 4 dígitos
  return fullKey.match(/.{1,4}/g).join(' ');
}

async function fetchIssuedNfsFromApi() {
  try {
    const res = await fetch('/api/fiscal/notes');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.notesMap) {
      const localMap = getIssuedNfsMap();
      const merged = { ...localMap, ...data.notesMap };
      try { localStorage.setItem(NF_STORAGE_KEY, JSON.stringify(merged)); } catch (e) {}
      renderFiscalTable();
    }
  } catch (err) {
    console.warn('[Fiscal:Sync] Operando com cache local de notas fiscais.');
  }
}

function markNfAsIssued(orderId) {
  const map = getIssuedNfsMap();
  if (!map[orderId]) {
    const noteData = {
      nfNumber: 1000 + Number(orderId),
      accessKey: generateNfAccessKey(orderId),
      issuedAt: new Date().toISOString(),
      status: 'AUTORIZADA'
    };
    map[orderId] = noteData;
    try { localStorage.setItem(NF_STORAGE_KEY, JSON.stringify(map)); } catch (e) {}

    // Persistência permanente no PostgreSQL
    fetch('/api/fiscal/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        nfNumber: noteData.nfNumber,
        accessKey: noteData.accessKey,
        status: noteData.status,
        issuedAt: noteData.issuedAt
      })
    }).catch((e) => console.warn('[Fiscal:API] Nota salva localmente; erro ao sincronizar no banco:', e));
  }
}

function markNfAsPrinted(orderIds) {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  const map = getIssuedNfsMap();
  let changed = false;
  const nowIso = new Date().toISOString();
  ids.forEach((id) => {
    if (id !== undefined && id !== null && map[id]) {
      map[id].printed = true;
      map[id].printedAt = nowIso;
      changed = true;
    }
  });
  if (changed) {
    try { localStorage.setItem(NF_STORAGE_KEY, JSON.stringify(map)); } catch (e) {}

    // Persistência de impressão permanente no PostgreSQL
    fetch('/api/fiscal/notes/mark-printed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids })
    }).catch((e) => console.warn('[Fiscal:API] Impressão salva localmente; erro ao sincronizar no banco:', e));
  }
}

function renderFiscalTable() {
  const tbody = document.getElementById('nfTableBody');
  if (!tbody) return;

  const nfsMap = getIssuedNfsMap();
  const autoActive = isAutoNfEnabled();
  const autoPrintActive = isAutoPrintNfEnabled();
  const newlyIssuedIds = [];

  // Garante que pedidos ativos tenham NF se auto estiver ativado
  if (autoActive) {
    let hasChanges = false;
    allOrders.forEach(o => {
      if (o.status !== 'cancelado' && !nfsMap[o.id]) {
        nfsMap[o.id] = {
          nfNumber: 1000 + Number(o.id),
          accessKey: generateNfAccessKey(o.id),
          issuedAt: new Date().toISOString(),
          status: 'AUTORIZADA',
          printed: false
        };
        newlyIssuedIds.push(o.id);
        hasChanges = true;
      }
    });
    if (hasChanges) {
      try { localStorage.setItem(NF_STORAGE_KEY, JSON.stringify(nfsMap)); } catch (e) {}
    }
  }

  if (autoPrintActive && newlyIssuedIds.length > 0 && typeof window.batchPrintDanfes === 'function') {
    setTimeout(() => {
      window.batchPrintDanfes(newlyIssuedIds);
    }, 250);
  }

  const updatedMap = nfsMap; // Usa o map já atualizado em memória

  if (!allOrders.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:25px;color:var(--text-muted)">Nenhuma nota fiscal emitida ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = allOrders.map(o => {
    const nfData = updatedMap[o.id];
    const isIssued = !!nfData && o.status !== 'cancelado';
    const isPrinted = isIssued && !!nfData.printed;
    const nfNumFormatted = isIssued ? `Nº 000.${String(nfData.nfNumber).padStart(6, '0')} - Série 1` : 'Não emitida';
    const accessKey = isIssued ? nfData.accessKey : 'Pendente de envio SEFAZ';
    const issuedDate = isIssued ? formatDate(nfData.issuedAt) : '-';

      const hasCce = isIssued && !!nfData.cce;
      const cceSeq = hasCce ? (nfData.cce.seq || 1) : 1;

      return `
        <tr class="fiscal-row">
          <td>
            <strong class="fiscal-nf-num ${isIssued ? 'issued' : 'pending'}">${nfNumFormatted}</strong>
          </td>
          <td class="fiscal-key-cell">
            <span class="fiscal-key-text ${isIssued ? 'active' : ''}">${accessKey}</span>
            ${isIssued ? `<button onclick="copyAccessKey(this, '${accessKey.replace(/\s+/g, '')}')" title="Copiar chave de acesso" class="fiscal-copy-btn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>` : ''}
          </td>
          <td><strong class="fiscal-order-id">Pedido #${o.id}</strong></td>
          <td><span class="fiscal-cust-name">${o.customerName || 'Consumidor Final'}</span></td>
          <td class="fiscal-total-price">${money(o.total)}</td>
          <td class="fiscal-date-text">${issuedDate}</td>
          <td>
            ${isIssued ? '<span class="status-badge nf-emitida">Autorizada</span>' : '<span class="status-badge nf-pendente">Pendente</span>'}
            ${isIssued ? `<br/><span class="status-badge ${isPrinted ? 'nf-impressa' : 'nf-nao-impressa'}">${isPrinted ? '🖨️ Impressa' : '⏳ Não impressa'}</span>` : ''}
            ${hasCce ? `<br/><span class="status-badge cce-active-badge" title="Carta de Correção Eletrônica Vinculada">📝 CC-e Ativa (Seq ${cceSeq})</span>` : ''}
          </td>
          <td style="text-align:right;white-space:nowrap;vertical-align:middle">
            ${isIssued ? `
              <div class="fiscal-actions-group">
                <button class="order-action-btn btn-danfe-action" onclick="openDanfeForOrder(${o.id})" title="Imprimir Documento Fiscal">
                  🖨️ DANFE
                </button>
                <button class="order-action-btn btn-danfe-action" onclick="openEditNfModal(${o.id})" title="Editar campos da DANFE / NFe">
                  ✏️ Editar NF
                </button>
                <button class="order-action-btn btn-danfe-action" onclick="openCceModal(${o.id})" title="${hasCce ? 'Editar Carta de Correção (CC-e)' : 'Emitir Carta de Correção (CC-e)'}">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  <span>${hasCce ? 'Editar CC-e' : 'CC-e'}</span>
                </button>
                ${hasCce ? `
                  <button class="order-action-btn btn-danfe-action" onclick="openDacceForOrder(${o.id})" title="Visualizar e Imprimir a Carta de Correção">
                    🖨️ Imprimir Correção
                  </button>
                ` : ''}
              </div>
            ` : `
              <button class="order-action-btn btn-danfe-action" onclick="manualEmitNf(${o.id})">
                ⚡ Emitir Agora
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
}

window.manualEmitNf = (orderId) => {
  markNfAsIssued(orderId);
  renderFiscalTable();
  if (isAutoPrintNfEnabled()) {
    window.batchPrintDanfes([orderId]);
  } else {
    openDanfeForOrder(orderId);
  }
};

// Modal de edição da DANFE / NFe
window.openEditNfModal = (orderId) => {
  const order = allOrders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  markNfAsIssued(orderId);
  const nfsMap = getIssuedNfsMap();
  const nf = nfsMap[orderId] || {};

  const addr = order.address || {};
  const destAddressDefault = addr.street ? `${addr.street}, ${addr.number || 'S/N'} ${addr.complement || ''} - ${addr.neighborhood || 'Centro'}, ${addr.city || FISCAL_CONFIG.cidade}-${addr.state || FISCAL_CONFIG.uf} - CEP ${addr.cep || '13180-000'}` : `${FISCAL_CONFIG.logradouro} - Centro, ${FISCAL_CONFIG.cidade}-${FISCAL_CONFIG.uf}`;

  document.getElementById('editNfOrderId').value = orderId;
  document.getElementById('editNfNumber').value = nf.nfNumber || (1000 + Number(orderId));
  document.getElementById('editNfSeries').value = nf.series || '1';
  document.getElementById('editNfKey').value = nf.accessKey || generateNfAccessKey(orderId);
  document.getElementById('editNfOperation').value = nf.operation || '6102 - Venda de mercadoria adquirida ou recebida de terceiros';
  document.getElementById('editNfProtocol').value = nf.protocol || '141200000220788';
  
  const dateVal = nf.issuedAt ? new Date(nf.issuedAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
  document.getElementById('editNfDate').value = dateVal;
  
  document.getElementById('editNfCustomerName').value = nf.customerName || order.customerName || 'Consumidor Final';
  document.getElementById('editNfCustomerDoc').value = nf.customerDoc || order.customerCpf || '99.999.999/0001-91';
  document.getElementById('editNfCustomerAddress').value = nf.customerAddress || destAddressDefault;
  document.getElementById('editNfNotes').value = nf.notes || `Inf. Contribuinte: Pedido #${order.id} - Forma de Pagamento: ${order.paymentMethodLabel || 'PIX'}.\nDocumento emitido por ME ou EPP optante pelo Simples Nacional.\nPermite o aproveitamento de crédito de ICMS correspondente à alíquota de 2,5%, nos termos do art. 23 da LC 123/2006.\nNÃO GERA DIREITO A CRÉDITO FISCAL DE IPI. Destinado a consumidor final.`;

  document.getElementById('editNfModal').classList.remove('hidden');
};

window.closeEditNfModal = () => {
  document.getElementById('editNfModal').classList.add('hidden');
};

document.getElementById('btnSaveEditedNf')?.addEventListener('click', () => {
  const orderId = document.getElementById('editNfOrderId').value;
  if (!orderId) return;

  const nfsMap = getIssuedNfsMap();
  const dateInput = document.getElementById('editNfDate').value;
  const isoDate = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

  nfsMap[orderId] = {
    ...(nfsMap[orderId] || {}),
    nfNumber: document.getElementById('editNfNumber').value.trim() || (1000 + Number(orderId)),
    series: document.getElementById('editNfSeries').value.trim() || '1',
    accessKey: document.getElementById('editNfKey').value.trim() || generateNfAccessKey(orderId),
    operation: document.getElementById('editNfOperation').value.trim() || '6102 - Venda de mercadoria adquirida ou recebida de terceiros',
    protocol: document.getElementById('editNfProtocol').value.trim() || '141200000220788',
    issuedAt: isoDate,
    customerName: document.getElementById('editNfCustomerName').value.trim(),
    customerDoc: document.getElementById('editNfCustomerDoc').value.trim(),
    customerAddress: document.getElementById('editNfCustomerAddress').value.trim(),
    notes: document.getElementById('editNfNotes').value.trim(),
    status: 'AUTORIZADA'
  };

  try { localStorage.setItem(NF_STORAGE_KEY, JSON.stringify(nfsMap)); } catch (e) {}
  closeEditNfModal();
  renderFiscalTable();
  showToast('Dados da DANFE / Nota Fiscal salvos com sucesso!');
});

document.getElementById('emitAllPendingNfBtn')?.addEventListener('click', () => {
  const newlyIssued = [];
  const beforeMap = getIssuedNfsMap();
  allOrders.forEach(o => {
    if (o.status !== 'cancelado') {
      if (!beforeMap[o.id]) newlyIssued.push(o.id);
      markNfAsIssued(o.id);
    }
  });
  renderFiscalTable();
  if (isAutoPrintNfEnabled() && newlyIssued.length > 0) {
    window.batchPrintDanfes(newlyIssued);
  } else {
    showToast('Todas as notas fiscais pendentes foram emitidas e autorizadas!');
  }
});

document.getElementById('printAllIssuedNfBtn')?.addEventListener('click', () => {
  const nfsMap = getIssuedNfsMap();
  const issuedOrderIds = allOrders
    .filter(o => o.status !== 'cancelado' && !!nfsMap[o.id])
    .map(o => o.id);
  if (!issuedOrderIds.length) {
    showToast('Nenhuma nota fiscal autorizada disponível para impressão.');
    return;
  }
  window.batchPrintDanfes(issuedOrderIds);
});
