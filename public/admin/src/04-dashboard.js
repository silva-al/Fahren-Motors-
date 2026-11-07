// Módulo WMS: 04-dashboard.js
// Fahren Motors - Painel de Gestão WMS

// ---------- 1. DASHBOARD WMS ----------
function updateDashboardMetrics() {
  const totalProductsEl = document.getElementById('dashTotalProducts');
  const todayOrdersEl = document.getElementById('dashTodayOrders');
  const stockAlertsEl = document.getElementById('dashStockAlerts');
  const totalRevenueEl = document.getElementById('dashTotalRevenue');

  const activeProducts = allProducts.filter(p => p.active !== false);
  if (totalProductsEl) totalProductsEl.textContent = activeProducts.length;

  const lowStock = activeProducts.filter(p => Number(p.stockQty) <= 2 || !p.inStock);
  if (stockAlertsEl) stockAlertsEl.textContent = lowStock.length;

  // Pedidos de hoje
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = allOrders.filter(o => (o.createdAt || '').slice(0, 10) === todayStr);
  if (todayOrdersEl) todayOrdersEl.textContent = todayOrders.length;

  // Receita total de pedidos válidos
  const validOrders = allOrders.filter(o => o.status !== 'cancelado');
  const totalRev = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  if (totalRevenueEl) totalRevenueEl.textContent = money(totalRev);

  // Métrica Financeira de Descontos no PIX (4% OFF)
  const pixDiscountEl = document.getElementById('dashTotalPixDiscount');
  const pixOrdersCountEl = document.getElementById('dashPixOrdersCount');
  const pixImpactBadgeEl = document.getElementById('dashPixImpactBadge');

  const pixOrders = validOrders.filter(o => (o.paymentMethod || '').toLowerCase() === 'pix');
  const totalPixDiscount = pixOrders.reduce((acc, o) => {
    const paid = Number(o.total) || 0;
    // O valor pago corresponde a 96% do valor regular (4% de desconto no Pix)
    const disc = (paid / 0.96) * 0.04;
    return acc + disc;
  }, 0);

  if (pixDiscountEl) pixDiscountEl.textContent = money(totalPixDiscount);
  if (pixOrdersCountEl) pixOrdersCountEl.textContent = `${pixOrders.length} venda(s) via PIX`;
  if (pixImpactBadgeEl) {
    if (totalRev > 0 && totalPixDiscount > 0) {
      const pct = ((totalPixDiscount / (totalRev + totalPixDiscount)) * 100).toFixed(1);
      pixImpactBadgeEl.textContent = `Impacto de ${pct}% na margem bruta (Fluxo Caixa Imediato)`;
    } else {
      pixImpactBadgeEl.textContent = 'Métrica de impacto na margem';
    }
  }

  renderBarChart();
  renderRecentOrders();
  renderCategoryDistribution();
}

function renderBarChart() {
  const wrap = document.getElementById('dashBarChart');
  if (!wrap) return;

  const daysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date();

  // Constrói os últimos 7 dias em ordem cronológica real
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = daysShort[d.getDay()];
    last7Days.push({
      dateStr,
      dayName,
      isToday: i === 0,
      count: 0,
      revenue: 0
    });
  }

  // Acumula os pedidos reais cadastrados
  allOrders.forEach(o => {
    if (o.status === 'cancelado') return;
    const orderDate = (o.createdAt || '').slice(0, 10);
    const bucket = last7Days.find(d => d.dateStr === orderDate);
    if (bucket) {
      bucket.count += 1;
      bucket.revenue += Number(o.total) || 0;
    }
  });

  const maxVal = Math.max(...last7Days.map(d => d.count), 4);

  wrap.innerHTML = `
    <div class="dash-chart-bars-container">
      ${last7Days.map(d => {
        const heightPct = Math.max(14, Math.round((d.count / maxVal) * 100));
        return `
          <div class="bar-col ${d.isToday ? 'today' : ''}" title="${d.dayName} (${d.dateStr}): ${d.count} pedido(s) • ${money(d.revenue)}">
            <div class="bar-tooltip-pop">${d.count} ped.<br/><strong>${money(d.revenue)}</strong></div>
            <div class="bar-track">
              <div class="bar-fill" style="height:${heightPct}%;"></div>
            </div>
            <span class="bar-day">${d.isToday ? 'Hoje' : d.dayName}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCategoryDistribution() {
  const wrap = document.getElementById('dashCategoryDistribution');
  if (!wrap) return;

  const categoryCounts = {};
  let totalStockUnits = 0;

  allProducts.forEach(p => {
    if (p.active === false) return;
    const cat = p.category || 'Outros';
    const qty = Number(p.stockQty) || 0;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + qty;
    totalStockUnits += qty;
  });

  const sortedCats = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!sortedCats.length) {
    wrap.innerHTML = '<p class="text-muted" style="padding:16px 0;font-size:13px;">Nenhum produto cadastrado no catálogo.</p>';
    return;
  }

  const colorPalettes = [
    { bar: '#ed1c24', glow: 'rgba(237, 28, 36, 0.3)' },
    { bar: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)' },
    { bar: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
    { bar: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)' },
    { bar: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.3)' }
  ];

  wrap.innerHTML = sortedCats.map(([cat, qty], idx) => {
    const pct = totalStockUnits > 0 ? Math.round((qty / totalStockUnits) * 100) : 0;
    const col = colorPalettes[idx % colorPalettes.length];
    return `
      <div class="cat-mix-row">
        <div class="cat-mix-header">
          <span class="cat-mix-name">
            <span class="cat-color-dot" style="background:${col.bar};box-shadow:0 0 6px ${col.glow};"></span>
            ${cat}
          </span>
          <span class="cat-mix-vals">
            <strong>${qty} un.</strong>
            <small>(${pct}%)</small>
          </span>
        </div>
        <div class="cat-mix-track">
          <div class="cat-mix-fill" style="width:${pct}%;background:${col.bar};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentOrders() {
  const wrap = document.getElementById('dashRecentOrders');
  if (!wrap) return;
  if (!allOrders.length) {
    wrap.innerHTML = '<div class="dash-empty-state"><span class="empty-icon">📦</span><p>Nenhum pedido recente registrado.</p></div>';
    return;
  }
  const recent = allOrders.slice(0, 5);
  wrap.innerHTML = recent.map(o => {
    const timeFormatted = formatDate(o.createdAt);
    const initials = (o.customerName || 'Cliente').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return `
      <div class="dash-recent-item" onclick="switchTab('pedidos')" style="cursor:pointer;" title="Ver detalhes do Pedido #${o.id}">
        <div class="recent-item-left">
          <div class="recent-cust-avatar">${initials}</div>
          <div class="recent-cust-info">
            <div class="recent-order-headline">
              <strong class="dash-order-id">#${o.id}</strong>
              <span class="dash-cust-name">${o.customerName || 'Cliente'}</span>
            </div>
            <div class="dash-order-meta">
              <span>${timeFormatted}</span>
              <span class="meta-dot">•</span>
              <span class="meta-pay">${o.paymentMethodLabel}</span>
            </div>
          </div>
        </div>
        <div class="recent-item-right">
          <div class="dash-order-val">${money(o.total)}</div>
          <span class="status-badge ${o.status}">${ORDER_STATUS_LABEL[o.status] || o.status}</span>
        </div>
      </div>
    `;
  }).join('');
}
