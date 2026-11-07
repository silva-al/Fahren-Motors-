// Módulo WMS: 07-cart-and-orders.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Carrinho ----------
function getCartItemImage(i) {
  if (i && i.image) return normalizeLojaPhoto(i.image);
  if (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') {
    const found = CATALOG_FALLBACK_PRODUCTS.find(p => String(p.id) === String(i && i.productId));
    if (found) return getLojaPrimaryPhoto(found);
  }
  return typeof LOJA_NO_PHOTO_SVG !== 'undefined' ? LOJA_NO_PHOTO_SVG : '';
}

function addToCart(productId, productsList, quantity = 1, triggerBtn = null) {
  const product = (productsList || []).find(p => String(p.id) === String(productId));
  if (!product || !product.inStock) return;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const image = getLojaPrimaryPhoto(product);
  const existing = cart.find(i => String(i.productId) === String(productId));
  if (existing) {
    existing.quantity += qty;
    if (!existing.image && image) existing.image = image;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: qty,
      category: product.category || '',
      image: image || ''
    });
  }
  saveCart(false, true);

  // Feedback visual imediato no botão da peça sem sair da página
  if (triggerBtn) {
    const origHtml = triggerBtn.innerHTML;
    triggerBtn.innerHTML = `✓ Adicionado (${qty} un.)`;
    triggerBtn.classList.add('added-feedback');
    setTimeout(() => {
      triggerBtn.innerHTML = origHtml;
      triggerBtn.classList.remove('added-feedback');
    }, 1800);
  }

  // Notificação toast elegante permitindo continuar comprando ou entrar no carrinho
  showToast(`✓ ${qty}x "${product.name}" colocado no carrinho!`, () => show('carrinho'));
}

function getCartShareUrl() {
  try {
    const compact = cart.map(i => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image || ''
    }));
    const raw = encodeURIComponent(JSON.stringify(compact));
    const token = btoa(raw);
    const origin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://fahrenmotors.com.br';
    const path = window.location.pathname.includes('loja') ? window.location.pathname : '/loja/';
    return `${origin}${path}?cart=${token}#carrinho`;
  } catch (e) {
    return window.location.href;
  }
}

function openMobileSyncModal() {
  const shareUrl = getCartShareUrl();
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`;
  const modal = document.createElement('div');
  modal.className = 'cart-sync-modal-backdrop';
  modal.innerHTML = `
    <div class="cart-sync-modal">
      <button type="button" class="cart-sync-modal-close" aria-label="Fechar">✕</button>
      <h3 class="cart-sync-modal-title">📱 Carrinho no seu Celular</h3>
      <p class="cart-sync-modal-subtitle">Aponte a câmera do seu celular para o QR Code abaixo para abrir os mesmos produtos instantaneamente.</p>
      <div class="cart-sync-qr-wrap">
        <img src="${qrUrl}" alt="QR Code do Carrinho" width="180" height="180" />
      </div>
      <div class="cart-sync-actions">
        <button type="button" class="btn-sync-copy" id="syncCopyLinkBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copiar Link do Carrinho</span>
        </button>
        <a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Acesse seu carrinho da Fahren Motors: ' + shareUrl)}" target="_blank" rel="noopener noreferrer" class="btn-sync-whatsapp">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
          <span>Enviar por WhatsApp</span>
        </a>
      </div>
    </div>
  `;
  modal.querySelector('.cart-sync-modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.querySelector('#syncCopyLinkBtn').onclick = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('📋 Link do carrinho copiado com sucesso!');
      }).catch(() => {
        showToast('Link: ' + shareUrl);
      });
    } else {
      showToast('Link: ' + shareUrl);
    }
  };
  document.body.appendChild(modal);
}

function renderCart() {
  updateCartBadge();
  const el = document.getElementById('cartContent');
  if (!cart.length) {
    el.innerHTML = `
      <div class="empty-cart-card">
        <div class="empty-cart-icon">🛒</div>
        <h3 class="empty-cart-title">Seu carrinho está vazio</h3>
        <p class="empty-cart-text">Explore nosso catálogo completo com mais de 3.000 peças automotivas com garantia e entrega rápida.</p>
        <button type="button" class="btn btn-empty-cart" data-go="pecas">VER CATÁLOGO DE PEÇAS</button>
      </div>`;
    el.querySelector('[data-go]')?.addEventListener('click', () => show('pecas'));
    return;
  }
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const pixTotal = subtotal * (1 - PIX_DISCOUNT_RATE);
  const pixSavings = subtotal - pixTotal;
  const installment = subtotal / 12;
  const amounts = { subtotal, pixTotal, pixSavings, installment };

  el.innerHTML = `
    

    <div class="cart-items">
      ${cart.map(i => {
        const itemImg = getCartItemImage(i);
        const itemPixPrice = i.price * (1 - PIX_DISCOUNT_RATE);
        const itemTotal = i.price * i.quantity;
        return `
        <div class="cart-row modern-cart-card" data-id="${i.productId}">
          <div class="cart-item-thumb">
            <span class="cart-thumb-badge">-4% PIX</span>
            <img src="${itemImg}" alt="${i.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          </div>
          <div class="cart-item-details">
            <div class="cart-item-head">
              <div class="cart-item-title-block">
                <span class="cart-stock-badge">● Em estoque • Envio Imediato</span>
                <b class="cart-item-title" title="${i.name}">${i.name}</b>
              </div>
              <button type="button" class="cart-btn-remove remove-item" title="Remover item do carrinho" aria-label="Remover item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
            <div class="cart-item-pricing">
              <div class="cart-pix-line">
                <span class="cart-pix-price">${money(itemPixPrice)}</span>
                <span class="cart-pix-pill">no Pix</span>
              </div>
              <div class="cart-unit-subtext">
                ${money(i.price)} un. ou em até 12x
              </div>
            </div>
            <div class="cart-item-footer">
              <div class="cart-qty-pill">
                <button type="button" class="qty-minus" title="Diminuir quantidade">−</button>
                <span class="qty-value">${i.quantity}</span>
                <button type="button" class="qty-plus" title="Aumentar quantidade">+</button>
              </div>
              <div class="cart-item-subtotal">
                <span class="subtotal-label">Subtotal:</span>
                <span class="subtotal-amount">${money(itemTotal)}</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="cart-summary-box">
      <div class="cart-summary-line">
        <span>Subtotal (${totalItems} ${totalItems === 1 ? 'item' : 'itens'})</span>
        <b>${money(subtotal)}</b>
      </div>
      <div class="cart-summary-line pix-discount">
        <span>Desconto no Pix (-4%)</span>
        <b class="text-pix-green">- ${money(pixSavings)}</b>
      </div>
      <div class="cart-summary-line total-line">
        <div class="total-title-wrap">
          <b>Total a pagar</b>
          <small>no Pix com aprovação imediata</small>
        </div>
        <div class="total-val-wrap">
          <b class="pix-highlight-price">${money(pixTotal)}</b>
          <span class="card-alt-text">ou ${money(subtotal)} em até 12x</span>
        </div>
      </div>
    </div>

    <div class="payment-select" style="margin-top:22px">
      <div class="payment-select-header">
        <span class="payment-select-title">Forma de pagamento</span>
        <span class="payment-select-badge">🔒 Pagamento 100% Seguro</span>
      </div>
      <label class="payment-option selected">
        <input checked name="paymentMethod" type="radio" value="pix"/>
        <span class="payment-option-body">
          <span class="payment-option-top">
            <b>Pix (4% de Desconto)</b>
            <span class="payment-badge-discount">-4% PIX</span>
          </span>
          <small>Aprovação imediata via QR Code ou Copia e Cola • Economize ${money(pixSavings)}</small>
        </span>
        <span class="payment-option-price">${money(pixTotal)}</span>
      </label>
      <label class="payment-option">
        <input name="paymentMethod" type="radio" value="cartao"/>
        <span class="payment-option-body">
          <span class="payment-option-top">
            <b>Cartão de Crédito</b>
            <span class="payment-badge-installments">Até 12x</span>
          </span>
          <small>Em até 12x de ${money(installment)} sem juros</small>
        </span>
        <span class="payment-option-price">${money(subtotal)}</span>
      </label>
      <label class="payment-option">
        <input name="paymentMethod" type="radio" value="retirada"/>
        <span class="payment-option-body">
          <span class="payment-option-top">
            <b>Pagar na Retirada ou Entrega</b>
          </span>
          <small>Pague no cartão ou dinheiro quando receber suas peças</small>
        </span>
        <span class="payment-option-price">${money(subtotal)}</span>
      </label>
    </div>

    <div id="paymentInfoPanel"></div>

    <button class="btn" id="checkoutBtn" style="width:100%;margin-top:18px">FINALIZAR PEDIDO</button>
    <div class="fp-error" id="checkoutError" style="display:none;margin-top:10px"></div>
  `;

  

  el.querySelectorAll('.cart-row').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('.qty-plus').onclick = () => { changeQty(id, 1); };
    row.querySelector('.qty-minus').onclick = () => { changeQty(id, -1); };
        // Clique na foto do item no carrinho abre o Relatório de Compra Fahren Motors
    row.querySelector('.cart-item-thumb')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCartItemReport(id);
    });

    row.querySelector('.remove-item').onclick = () => { cart = cart.filter(i => String(i.productId) !== String(id)); saveCart(false, true); renderCart(); };
  });
  el.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
    input.addEventListener('change', () => {
      el.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.toggle('selected', opt.querySelector('input').checked);
      });
      renderPaymentInfo(input.value, amounts, true);
    });
  });
  renderPaymentInfo('pix', amounts, false);
  document.getElementById('checkoutBtn').onclick = checkout;
}

function renderPaymentInfo(method, amounts, scroll) {
  const panel = document.getElementById('paymentInfoPanel');
  if (!panel) return;
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn && method !== 'cartao') checkoutBtn.style.display = '';
  if (method === 'pix') {
    const code = buildPixCode(amounts.pixTotal);
    const qrSvg = buildPixQrSvg(code);
    panel.innerHTML = `
      <div class="panel payment-panel pix-panel">
        <div class="kicker">PAGAMENTO VIA PIX (4% DE DESCONTO)</div>
        <p class="pix-total-note">Total no Pix: <b class="pix-total-green">${money(amounts.pixTotal)}</b> <span class="pix-savings-badge">Economia de ${money(amounts.pixSavings)}</span></p>
        ${qrSvg ? `<div class="pix-qr-box">${qrSvg}</div><p class="pix-qr-caption">Escaneie o QR Code com a câmera do app do seu banco</p>` : ''}
        <label class="pix-cpc-label">Ou use o Pix Copia e Cola:</label>
        <textarea id="pixCode" readonly rows="2">${code}</textarea>
        <button class="btn btn-copy-pix" id="copyPixBtn" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>COPIAR CÓDIGO PIX</span>
        </button>
        <p class="form-help pix-instructions">
          Copie o código acima e cole na opção "Pix Copia e Cola" do aplicativo do seu banco. Em seguida, clique em <b>Finalizar Pedido</b> abaixo para registrar a compra.
        </p>
      </div>`;
    const copyBtn = document.getElementById('copyPixBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const codeEl = document.getElementById('pixCode');
        if (codeEl) codeEl.select();
        const done = () => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>✓ CÓDIGO COPIADO!</span>`;
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>COPIAR CÓDIGO PIX</span>`;
          }, 2500);
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(code).then(done).catch(() => {
            try { document.execCommand('copy'); done(); } catch (_) {}
          });
        } else {
          try { document.execCommand('copy'); done(); } catch (_) {}
        }
      };
    }
  } else if (method === 'cartao') {
    panel.innerHTML = `
      <div class="panel payment-panel">
        <div class="kicker">PAGAMENTO NO CARTÃO DE CRÉDITO</div>
        <p style="margin:8px 0 14px;color:var(--fp-c7c9cd)">Total: <b>${money(amounts.subtotal)}</b> em até 12x de ${money(amounts.installment)} sem juros</p>
        <div id="cardPaymentBrick">
          <p class="form-help">Carregando formulário de pagamento...</p>
        </div>
        <p id="cardPaymentStatus" style="display:none;margin-top:10px;font-size:13px"></p>
        <p class="form-help">Seus dados do cartão são enviados direto e com segurança para o processador de pagamentos — a loja nunca guarda o número do seu cartão.</p>
      </div>`;
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.style.display = 'none';
    mountCardBrick(amounts);
  } else {
    panel.innerHTML = `
      <div class="panel payment-panel">
        <div class="kicker">PAGAR NA RETIRADA / ENTREGA</div>
        <p style="margin:8px 0;color:var(--fp-c7c9cd)">Total: <b>${money(amounts.subtotal)}</b></p>
        <p class="form-help">Pague em dinheiro ou cartão no momento de receber suas peças.</p>
      </div>`;
  }
  if (scroll) setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
}

function changeQty(id, delta) {
  const item = cart.find(i => String(i.productId) === String(id));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => String(i.productId) !== String(id));
  saveCart();
  renderCart();
}

async function checkout() {
  const errEl = document.getElementById('checkoutError');
  if (errEl) errEl.style.display = 'none';
  if (!authenticated) {
    alert('Cadastre-se ou entre na sua conta para finalizar o pedido.');
    show('cadastro');
    return;
  }
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'retirada';
  try {
    const { address } = await api('/api/addresses/mine');
    if (!address) {
      alert('Cadastre seu endereço de entrega antes de finalizar o pedido.');
      show('endereco');
      return;
    }
    const items = cart.map(i => ({ productId: i.productId, quantity: i.quantity }));
    const orderRes = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items, paymentMethod }) });
    broadcastSync('ORDER_CREATED', { orderId: orderRes?.order?.id });
    refreshLojaStockData();
    cart = []; saveCart();
    if (paymentMethod === 'pix') {
      alert('Pedido realizado! Finalize o pagamento com o código Pix que você copiou e acompanhe o status na sua tela de Perfil.');
    } else {
      alert('Pedido realizado com sucesso! Acompanhe o status na sua tela de Perfil.');
    }
    show('perfil');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

// ---------- Meus pedidos ----------
const ORDER_STATUS_LABEL = { novo: 'Novo', em_preparacao: 'Em preparação', pronto: 'Pronto para retirada/entrega', entregue: 'Entregue', cancelado: 'Cancelado' };

async function loadMyOrders() {
  const el = document.getElementById('myOrders');
  if (!el) return;
  try {
    const { orders } = await api('/api/orders/mine');
    if (!orders.length) { el.innerHTML = '<p style="color:var(--fp-9da2aa)">Você ainda não fez nenhum pedido.</p>'; return; }
    el.innerHTML = orders.map(o => `
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)">
        <div style="display:flex;justify-content:space-between"><b>Pedido #${o.id}</b><span class="chip">${ORDER_STATUS_LABEL[o.status] || o.status}</span></div>
        <div style="color:var(--fp-9da2aa);font-size:13px;margin-top:4px">${new Date(o.createdAt).toLocaleDateString('pt-BR')} • ${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</div>
        <div style="margin-top:4px"><b>${money(o.total)}</b></div>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<p style="color:#e06a6a">${err.message}</p>`;
  }
}


// ==========================================================================
// RELATÓRIO DO ITEM DO PEDIDO (AO CLICAR NA IMAGEM NO CARRINHO)
// Mostra Valores, Nome da Peça, Endereço de Entrega, Destinatário e Garantia
// ==========================================================================
async function openCartItemReport(productId) {
  const item = cart.find(i => String(i.productId) === String(productId));
  if (!item) return;

  const itemImg = getCartItemImage(item);
  const priceVal = Number(item.price) || 0;
  const qty = Number(item.quantity) || 1;
  const totalVal = priceVal * qty;
  const pixVal = totalVal * (1 - PIX_DISCOUNT_RATE);
  const pixDiff = totalVal - pixVal;
  const cardInstVal = totalVal / 12;

  let addressText = 'Endereço ainda não preenchido. Você poderá confirmar antes do pagamento.';
  let clientName = (currentUser && (currentUser.name || currentUser.fullName)) || 'Cliente Fahren Motors';
  let clientContact = (currentUser && (currentUser.phone || currentUser.email)) || 'WhatsApp informado no checkout';

  try {
    const res = await api('/api/addresses/mine');
    if (res && res.address) {
      const a = res.address;
      addressText = `${a.street || ''}, ${a.number || 'S/N'}${a.complement ? ' (' + a.complement + ')' : ''} - ${a.neighborhood || ''}, ${a.city || ''}/${a.state || ''} • CEP: ${a.cep || ''}`;
    }
  } catch (_) {
    const cep = document.getElementById('deliveryCep')?.value;
    const rua = document.getElementById('deliveryStreet')?.value;
    const num = document.getElementById('deliveryNumber')?.value;
    const bai = document.getElementById('deliveryNeighborhood')?.value;
    const cid = document.getElementById('deliveryCity')?.value;
    const uf = document.getElementById('deliveryState')?.value;
    if (rua && num) {
      addressText = `${rua}, ${num} - ${bai || ''}, ${cid || ''}/${uf || ''} • CEP: ${cep || ''}`;
    }
  }

  document.getElementById('fpCartReportModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'fpCartReportModal';
  modal.className = 'fp-cart-report-modal';
  modal.innerHTML = `
    <div class="fp-cart-report-card" role="dialog" aria-modal="true">
      <!-- CABEÇALHO COM LOGO OFICIAL DA LOJA (FM + FAHREN MOTORS) -->
      <div class="fp-cart-report-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="logo-badge" style="width:32px;height:32px;padding:2px;"><div class="logo-badge-inner" style="font-size:11px;font-weight:900;">FM</div></div>
          <div style="display:flex;flex-direction:column;line-height:1.15;">
            <div style="font-size:14px;font-weight:900;letter-spacing:0.3px;"><span class="brand-fahren" style="color:#ed1c24;">FAHREN</span> <span class="brand-parts" style="color:var(--fp-fff, #ffffff);">MOTORS</span></div>
            <span style="font-size:11px;color:#94a3b8;font-weight:600;">Relatório do Item no Carrinho</span>
          </div>
        </div>
        <button type="button" class="fp-cart-report-close" aria-label="Voltar para a sacolinha" title="Voltar para a sacolinha">&times;</button>
      </div>

      <div class="fp-cart-report-body">
        <!-- Peça, Foto e Nome -->
        <div class="fp-cart-report-prod-row">
          <img src="${itemImg}" alt="${item.name}" class="fp-cart-report-thumb" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          <div>
            <div style="font-size:11px;font-weight:800;color:#ed1c24;text-transform:uppercase;margin-bottom:2px">
              CÓD: #${item.code || item.productId} • EM ESTOQUE
            </div>
            <strong style="font-size:15px;line-height:1.4;display:block">${item.name}</strong>
            <span style="font-size:12.5px;color:#94a3b8;display:block;margin-top:4px">
              Quantidade: <strong style="color:var(--fp-fff, #ffffff)">${qty} unidade(s)</strong>
            </span>
          </div>
        </div>

        <!-- Discriminação de Valores com AS MESMAS CORES DA TELA ANTERIOR (VERDE NO PIX) -->
        <div>
          <div class="fp-cart-report-sec-title"><span>💰</span> Valores e Condições de Pagamento</div>
          <div class="fp-cart-report-box">
            <div class="fp-cart-report-val-line">
              <span style="color:#94a3b8;">Valor Unitário da Peça:</span>
              <strong style="color:var(--fp-fff, #ffffff)">${money(priceVal)}</strong>
            </div>
            <div class="fp-cart-report-val-line">
              <span style="color:#94a3b8;">Quantidade Solicitada:</span>
              <span>${qty}x</span>
            </div>
            <div class="fp-cart-report-val-line">
              <span style="color:#94a3b8;">Subtotal:</span>
              <strong style="color:var(--fp-fff, #ffffff)">${money(totalVal)}</strong>
            </div>
            <!-- Desconto no Pix em VERDE como na tela anterior -->
            <div class="fp-cart-report-val-line" style="color:#16a34a !important;font-weight:700;padding-top:4px;">
              <span>Desconto Especial no Pix (-4%):</span>
              <span style="color:#16a34a !important;font-weight:800;">- ${money(pixDiff)}</span>
            </div>
            <!-- Total no Pix destacado -->
            <div class="fp-cart-report-val-line fp-cart-report-val-total">
              <span style="font-weight:800;">Total à Vista no Pix:</span>
              <span style="color:#ed1c24;font-size:18px;font-weight:900;">${money(pixVal)}</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:6px;text-align:right">
              ou em até 12x de ${money(cardInstVal)} sem juros no cartão
            </div>
          </div>
        </div>

        <!-- Endereço de Destino da Entrega -->
        <div>
          <div class="fp-cart-report-sec-title"><span>📍</span> Endereço de Destino da Entrega</div>
          <div class="fp-cart-report-box">
            <div style="font-weight:700;margin-bottom:4px;color:var(--fp-fff, #ffffff)">Destinatário: ${clientName}</div>
            <div style="color:#cbd5e1">${addressText}</div>
            <div style="margin-top:6px;font-size:12px;color:#94a3b8">Contato para Rastreio: ${clientContact}</div>
          </div>
        </div>
      </div>

      <!-- BOTÃO DE RETORNO DIRETO PARA A SACOLINHA -->
      <div class="fp-cart-report-footer">
        <button type="button" class="btn fp-cart-report-btn-close" style="width:100%;background:#ed1c24;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          <span>←</span> VOLTAR PARA A SACOLINHA
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Registra no histórico do navegador para que o botão "Voltar" nativo do celular feche o modal
  try {
    window.history.pushState({ modal: 'cart-report', screen: 'carrinho', depth: navDepth + 1 }, '');
  } catch (_) {}

  // Fecha o modal garantindo que o cliente PERMANEÇA na sacolinha (#carrinho)
  let isClosed = false;
  const closeModal = (e, triggerHistoryBack = true) => {
    if (isClosed) return;
    isClosed = true;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    modal.remove();

    if (triggerHistoryBack && window.history.state && window.history.state.modal === 'cart-report') {
      window.history.back();
    }
  };

  modal.querySelector('.fp-cart-report-close')?.addEventListener('click', closeModal);
  modal.querySelector('.fp-cart-report-btn-close')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(e);
  });

  // Fecha no ESC sem sair do carrinho
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      window.removeEventListener('keydown', onEsc);
    }
  };
  window.addEventListener('keydown', onEsc);
}
window.openCartItemReport = openCartItemReport;
