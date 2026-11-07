// Módulo WMS: 09-financeiro.js
// Fahren Motors - Painel de Gestão WMS

// ---------- 5. FINANCEIRO (NOVO MÓDULO) ----------
function renderFinances() {
  const totalRevEl = document.getElementById('finTotalRevenue');
  const pixTotalEl = document.getElementById('finPixTotal');
  const cardTotalEl = document.getElementById('finCardTotal');
  const avgTicketEl = document.getElementById('finAverageTicket');
  const tbody = document.getElementById('financesTableBody');

  const validOrders = allOrders.filter(o => o.status !== 'cancelado');
  const totalRev = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  
  const pixOrders = validOrders.filter(o => o.paymentMethod === 'pix');
  const pixTotal = pixOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const cardOrders = validOrders.filter(o => o.paymentMethod === 'cartao');
  const cardTotal = cardOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  const avgTicket = validOrders.length ? totalRev / validOrders.length : 0;

  if (totalRevEl) totalRevEl.textContent = money(totalRev);
  if (pixTotalEl) pixTotalEl.textContent = money(pixTotal);
  if (cardTotalEl) cardTotalEl.textContent = money(cardTotal);
  if (avgTicketEl) avgTicketEl.textContent = money(avgTicket);

  if (!tbody) return;

  if (!allOrders.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:25px;color:var(--text-muted)">Nenhuma transação financeira registrada.</td></tr>';
    return;
  }

  tbody.innerHTML = allOrders.map(o => {
    const isPix = o.paymentMethod === 'pix';
    const disc = isPix ? (Number(o.total) / 0.96) * 0.04 : 0;
    const bruto = Number(o.total) + disc;
    const isCancelled = o.status === 'cancelado';
    return `
      <tr class="fin-row">
        <td><strong class="order-id-badge">#${o.id}</strong></td>
        <td><strong class="fin-cust-name">${o.customerName || 'Cliente'}</strong></td>
        <td>${getPaymentBadgeHtml(o.paymentMethodLabel)}</td>
        <td class="fin-date-text">${formatDate(o.createdAt)}</td>
        <td class="fin-disc-text">${isPix ? money(disc) : '-'}</td>
        <td class="fin-bruto-text"><strong style="font-size:13.5px;font-weight:800;color:var(--text-primary);">${money(bruto)}</strong></td>
        <td style="font-weight:800;color:${isCancelled ? '#ff5e65' : '#16a34a'}">${money(o.total)}</td>
        <td>
          ${isCancelled ? '<span class="status-badge cancelado">Estornado</span>' : '<span class="status-badge pronto">Liquidado</span>'}
        </td>
      </tr>
    `;
  }).join('');
}
