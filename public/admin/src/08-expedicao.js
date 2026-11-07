// Módulo WMS: 08-expedicao.js
// Fahren Motors - Painel de Gestão WMS

// ---------- 4. EXPEDIÇÃO ----------
let expedicaoFilter = 'todos';
window.filterExpedicao = function(status) {
  expedicaoFilter = status;
  renderExpedicao();
};

function renderExpedicao() {
  const grid = document.getElementById('expedicaoGrid');
  if (!grid) return;

  let expedicaoOrders = allOrders.filter(o => ['novo', 'em_preparacao', 'pronto'].includes(o.status));
  if (expedicaoFilter && expedicaoFilter !== 'todos') {
    expedicaoOrders = expedicaoOrders.filter(o => o.status === expedicaoFilter);
  }

  // Filtro por texto/barcode digitado
  const searchInput = document.getElementById('expedicaoBarcodeInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (query) {
    expedicaoOrders = expedicaoOrders.filter(o => {
      const matchId = String(o.id).includes(query);
      const matchCust = (o.customerName || '').toLowerCase().includes(query);
      const matchItem = (o.items || []).some(i => 
        (i.name || '').toLowerCase().includes(query) || 
        (i.code || '').toLowerCase().includes(query) ||
        (i.location || '').toLowerCase().includes(query)
      );
      return matchId || matchCust || matchItem;
    });
  }

  if (!expedicaoOrders.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:30px;text-align:center">Nenhum pedido pendente nesta etapa da expedição.</p>';
    return;
  }

  grid.innerHTML = expedicaoOrders.map(o => {
    const addr = o.address;
    const addressStr = addr ? `${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city}/${addr.state}` : 'Retirada na Oficina';
    const payLabel = o.paymentMethodLabel || o.paymentMethod || 'Retirada';
    return `
      <div class="expedicao-card" id="expCard-${o.id}">
        <div class="exp-card-header">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <strong class="exp-order-id">Pacote #${o.id}</strong>
              <span class="exp-cust-payment" style="font-size:11px;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-muted);font-weight:600;">💳 ${payLabel}</span>
            </div>
            <div class="exp-cust-name" style="font-weight:700;margin-top:4px;">${o.customerName || 'Cliente Balcão'}</div>
            <div class="exp-address-text" style="font-size:12px;color:var(--text-muted);margin-top:2px;">📍 ${addressStr}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="status-badge ${o.status}">${ORDER_STATUS_LABEL[o.status] || o.status}</span>
            <button class="order-action-btn btn-delete-action" onclick="deleteExpedicaoOrder(${o.id})" title="Excluir este pedido da expedição">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        <div class="exp-items-box">
          <strong class="exp-separar-title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span>Itens a separar:</span>
            <small style="color:var(--text-muted);font-weight:normal;">Localização no Armazém WMS</small>
          </strong>
          ${(o.items || []).map(i => `
            <div class="exp-item-line" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,0.06);gap:10px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <span class="order-item-qty" style="background:#2b6cb0;color:#fff;padding:2px 7px;border-radius:4px;font-weight:800;font-size:12px;">${i.quantity}x</span>
                <span class="order-item-title" style="font-weight:600;font-size:13px;word-break:break-word;">${i.name}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                ${i.code ? `<span style="font-size:11px;font-family:monospace;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;color:var(--text-muted);">SKU: ${i.code}</span>` : ''}
                <span style="font-size:12px;font-weight:700;color:#38bdf8;background:rgba(56,189,248,0.12);padding:3px 9px;border-radius:5px;border:1px solid rgba(56,189,248,0.25);">
                  📍 ${i.location || 'Sem prateleira'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="exp-card-footer" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">
          <span class="exp-total-price" style="font-weight:800;font-size:14px;">Total: ${money(o.total)}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button class="order-action-btn btn-danfe-action" onclick="openDanfeForOrder(${o.id})">📄 DANFE / Envio</button>
            
            ${o.status === 'em_preparacao' ? `
              <button class="btn btn-secondary btn-sm" onclick="stepBackOrderStatus(${o.id}, 'novo')" title="Voltar etapa para Novo">
                ↩ Voltar p/ Novo
              </button>
              <button class="btn btn-primary btn-sm" onclick="updateOrderStatusQuick(${o.id}, 'pronto')">
                ✓ Marcar Pronto
              </button>
              <button class="btn btn-primary btn-sm" style="background:#16a34a;border-color:#16a34a;font-weight:800;" onclick="fastDispatchOrder(${o.id})" title="Despacho Imediato Direto">
                ⚡ Despacho Direto
              </button>
            ` : o.status === 'pronto' ? `
              <button class="btn btn-secondary btn-sm" onclick="stepBackOrderStatus(${o.id}, 'em_preparacao')" title="Voltar etapa para Em Preparação">
                ↩ Voltar p/ Separação
              </button>
              <button class="btn btn-primary btn-sm btn-despachar" style="background:#16a34a;border-color:#16a34a;font-weight:800;" onclick="fastDispatchOrder(${o.id})">
                ⚡ Despachar Agora
              </button>
            ` : `
              <button class="btn btn-primary btn-sm" onclick="updateOrderStatusQuick(${o.id}, 'em_preparacao')">
                ▶ Iniciar Separação
              </button>
              <button class="btn btn-primary btn-sm" style="background:#16a34a;border-color:#16a34a;font-weight:800;" onclick="fastDispatchOrder(${o.id})" title="Despacho Imediato Direto">
                ⚡ Despacho Direto
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.stepBackOrderStatus = async (orderId, prevStatus) => {
  try {
    await api(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: prevStatus })
    });
    showToast(`Pedido #${orderId} retornou para "${ORDER_STATUS_LABEL[prevStatus] || prevStatus}".`);
    await refreshAllData();
    broadcastSync('ORDER_UPDATED');
  } catch (err) {
    console.error('Erro ao voltar etapa:', err);
    alert('Erro ao voltar etapa: ' + err.message);
  }
};

window.deleteExpedicaoOrder = async (orderId) => {
  if (!confirm(`Deseja realmente excluir o Pedido #${orderId}?\nOs itens reservados retornarão ao estoque da loja.`)) {
    return;
  }
  try {
    await api(`/orders/${orderId}`, { method: 'DELETE' });
    showToast(`Pedido #${orderId} excluído com sucesso!`);
    await refreshAllData();
    broadcastSync('ORDER_UPDATED');
    broadcastSync('STOCK_UPDATED');
  } catch (err) {
    console.error('Erro ao excluir pedido:', err);
    alert('Erro ao excluir pedido: ' + err.message);
  }
};

async function updateOrderStatusQuick(orderId, status) {
  try {
    await api(`/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (isAutoNfEnabled() && status !== 'cancelado') markNfAsIssued(orderId);
    await refreshAllData();
    broadcastSync('ORDER_UPDATED');
  } catch (err) {
    alert(err.message);
  }
}
