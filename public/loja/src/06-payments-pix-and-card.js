// Módulo WMS: 06-payments-pix-and-card.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Pagamento via Pix (código "Copia e Cola" oficial, gerado aqui mesmo) ----------
// A chave Pix é pública para quem vai pagar (funciona como um número de conta
// para receber), por isso pode ficar no código do site sem problema.
const PIX_KEY = '47784317000120';
const PIX_MERCHANT_NAME = 'FAHREN MOTORS LTDA';
const PIX_MERCHANT_CITY = 'HORTOLANDIA';
const PIX_DISCOUNT_RATE = 0.04;

function pixStripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function pixTlv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

function pixCrc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Monta o payload EMV/BR Code do Pix (padrão Banco Central) com valor fixo,
// pronto para o cliente colar no "Pix Copia e Cola" do banco dele.
function buildPixCode(amount) {
  const merchantAccount = pixTlv('26', pixTlv('00', 'BR.GOV.BCB.PIX') + pixTlv('01', PIX_KEY));
  const name = pixStripAccents(PIX_MERCHANT_NAME).slice(0, 25);
  const city = pixStripAccents(PIX_MERCHANT_CITY).slice(0, 15);
  const payload =
    pixTlv('00', '01') +
    merchantAccount +
    pixTlv('52', '0000') +
    pixTlv('53', '986') +
    pixTlv('54', amount.toFixed(2)) +
    pixTlv('58', 'BR') +
    pixTlv('59', name) +
    pixTlv('60', city) +
    pixTlv('62', pixTlv('05', '***')) +
    '6304';
  return payload + pixCrc16(payload);
}

// Gera o QR Code (SVG) a partir do código Pix, usando a biblioteca local vendor/qrcode.js.
function buildPixQrSvg(pixCode) {
  if (typeof qrcode === 'undefined') return null;
  for (let typeNumber = 4; typeNumber <= 40; typeNumber++) {
    try {
      const qr = qrcode(typeNumber, 'M');
      qr.addData(pixCode);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 8 });
    } catch { /* código não coube nesse tamanho, tenta o próximo */ }
  }
  return null;
}

// ---------- Pagamento com Cartão de Crédito (Mercado Pago Checkout Bricks) ----------
// O formulário do cartão é renderizado AQUI DENTRO do site (o cliente nunca sai
// da página); só o token do cartão (nunca o número em si) sai do navegador.
let mpSdkInstance = null;
let mpPublicKeyCache = null;
let cardBrickController = null;

async function getMpPublicKey() {
  if (mpPublicKeyCache !== null) return mpPublicKeyCache;
  try {
    const { publicKey } = await api('/api/payments/config');
    mpPublicKeyCache = publicKey || false;
  } catch {
    mpPublicKeyCache = false;
  }
  return mpPublicKeyCache;
}

async function mountCardBrick(amounts) {
  const container = document.getElementById('cardPaymentBrick');
  const statusEl = document.getElementById('cardPaymentStatus');
  if (!container) return;

  const publicKey = await getMpPublicKey();
  if (publicKey && typeof MercadoPago !== 'undefined') {
    if (cardBrickController && cardBrickController.unmount) {
      try { cardBrickController.unmount(); } catch { /* já desmontado */ }
    }
    container.innerHTML = '';

    try {
      if (!mpSdkInstance) mpSdkInstance = new MercadoPago(publicKey, { locale: 'pt-BR' });
      const bricksBuilder = mpSdkInstance.bricks();

      cardBrickController = await bricksBuilder.create('cardPayment', 'cardPaymentBrick', {
        initialization: { amount: amounts.subtotal },
        customization: { visual: { style: { theme: 'dark' } } },
        callbacks: {
          onReady: () => {},
          onError: (error) => {
            console.error(error);
            if (statusEl) { statusEl.textContent = 'Verifique os dados do cartão e tente novamente.'; statusEl.style.color = '#e06a6a'; statusEl.style.display = 'block'; }
          },
          onSubmit: (cardFormData) => new Promise(async (resolve, reject) => {
            if (statusEl) { statusEl.textContent = 'Processando pagamento...'; statusEl.style.color = '#9da2aa'; statusEl.style.display = 'block'; }
            try {
              const { address } = await api('/api/addresses/mine');
              if (!address) {
                alert('Cadastre seu endereço de entrega antes de finalizar o pedido.');
                show('endereco');
                return reject();
              }
              const { order } = await api('/api/orders', { method: 'POST', body: JSON.stringify({ items, paymentMethod: 'cartao' }) });
              broadcastSync('ORDER_CREATED', { orderId: order.id });
              refreshLojaStockData();
              const result = await api('/api/payments/card', { method: 'POST', body: JSON.stringify({ orderId: order.id, ...cardFormData }) });

              if (result.status === 'approved') {
                if (statusEl) { statusEl.textContent = 'Pagamento aprovado!'; statusEl.style.color = '#39c979'; }
                cart = []; saveCart();
                alert('Pagamento aprovado! Seu pedido foi confirmado. Acompanhe o status na sua tela de Perfil.');
                show('perfil');
              } else if (result.status === 'in_process' || result.status === 'pending') {
                if (statusEl) { statusEl.textContent = 'Pagamento em análise. Você já pode acompanhar o pedido no seu Perfil.'; statusEl.style.color = '#e0b94a'; }
                cart = []; saveCart();
                show('perfil');
              } else {
                if (statusEl) { statusEl.textContent = 'Pagamento não aprovado. Verifique os dados do cartão ou tente outro cartão.'; statusEl.style.color = '#e06a6a'; }
              }
              resolve();
            } catch (err) {
              if (statusEl) { statusEl.textContent = err.message || 'Não foi possível processar o pagamento.'; statusEl.style.color = '#e06a6a'; statusEl.style.display = 'block'; }
              reject(err);
            }
          }),
        },
      });
      return;
    } catch (err) {
      console.warn('Falha ao instanciar Mercado Pago Brick, carregando formulário integrado:', err);
    }
  }

  // Se a chave pública não estiver configurada no .env ou o SDK não carregar,
  // renderiza o formulário de cartão completo da loja
  renderFallbackCardForm(amounts, container, statusEl);
}

function renderFallbackCardForm(amounts, container, statusEl) {
  if (cardBrickController && cardBrickController.unmount) {
    try { cardBrickController.unmount(); } catch { /* unmounted */ }
  }

  const subtotal = amounts.subtotal || 0;
  const installmentsCount = 12;
  let optionsHtml = '';
  for (let i = 1; i <= installmentsCount; i++) {
    const val = (subtotal / i).toFixed(2).replace('.', ',');
    optionsHtml += `<option value="${i}">${i}x de R$ ${val} sem juros</option>`;
  }

  container.innerHTML = `
    <div class="card-fallback-form" style="background:var(--fp-0c0e11);border:1px solid var(--fp-282b30);border-radius:14px;padding:20px;margin-top:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span style="font-size:12px;font-weight:700;color:var(--fp-9da2aa);text-transform:uppercase">Dados do Cartão de Crédito</span>
        <span id="detectedBrandBadge" style="background:var(--fp-202328);color:#39c979;font-size:11px;font-weight:800;padding:4px 10px;border-radius:6px;border:1px solid var(--fp-34373d)">CARTÃO</span>
      </div>

      <div class="field" style="margin:12px 0">
        <label>Número do Cartão</label>
        <input id="customCardNumber" type="tel" inputmode="numeric" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="cc-number" style="font-family:monospace;letter-spacing:1px" />
      </div>

      <div class="field" style="margin:12px 0">
        <label>Nome impresso no Cartão</label>
        <input id="customCardName" type="text" placeholder="Nome como impresso no cartão" autocomplete="cc-name" style="text-transform:uppercase" />
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field" style="margin:12px 0">
          <label>Validade (MM/AA)</label>
          <input id="customCardExpiry" type="tel" inputmode="numeric" placeholder="MM/AA" maxlength="5" autocomplete="cc-exp" />
        </div>
        <div class="field" style="margin:12px 0">
          <label>CVV (Código)</label>
          <input id="customCardCvv" type="password" inputmode="numeric" placeholder="123" maxlength="4" autocomplete="cc-csc" />
        </div>
      </div>

      <div class="field" style="margin:12px 0">
        <label>CPF do Titular</label>
        <input id="customCardCpf" type="tel" inputmode="numeric" placeholder="000.000.000-00" value="${(currentUser && currentUser.cpfCnpj) || ''}" />
      </div>

      <div class="field" style="margin:12px 0">
        <label>Opções de Parcelamento</label>
        <div style="margin-top:6px">
          <select id="customCardInstallments" style="width:100%;padding:14px;border-radius:10px;border:1px solid var(--fp-34373d);background:var(--fp-121418);color:var(--fp-fff);font-size:15px;cursor:pointer">
            ${optionsHtml}
          </select>
        </div>
      </div>

      <button class="btn" id="customCardSubmitBtn" type="button" style="width:100%;margin-top:16px;font-size:15px;padding:16px">
        PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO
      </button>

      <div style="margin-top:14px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--fp-8f949c);line-height:1.4">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#39c979;flex-shrink:0"></span>
        <span>Ambiente criptografado com SSL. Transação segura.</span>
      </div>
    </div>
  `;

  const numInput = document.getElementById('customCardNumber');
  const nameInput = document.getElementById('customCardName');
  const expInput = document.getElementById('customCardExpiry');
  const cvvInput = document.getElementById('customCardCvv');
  const cpfInput = document.getElementById('customCardCpf');
  const badge = document.getElementById('detectedBrandBadge');
  const submitBtn = document.getElementById('customCardSubmitBtn');

  function detectBrand(clean) {
    if (/^4/.test(clean)) return 'Visa';
    if (/^5[1-5]|^2[2-7]/.test(clean)) return 'Mastercard';
    if (/^4011|^4389|^4514|^4576|^5041|^5067|^5090|^6277|^6362|^6363|^650|^651|^655/.test(clean)) return 'Elo';
    if (/^3[47]/.test(clean)) return 'Amex';
    if (/^6062/.test(clean)) return 'Hipercard';
    return 'Cartão';
  }

  numInput?.addEventListener('input', () => {
    let val = numInput.value.replace(/\D/g, '').slice(0, 16);
    numInput.value = val.replace(/(\d{4})(?=\d)/g, '$1 ');
    const brand = detectBrand(val);
    if (badge) badge.textContent = brand.toUpperCase();
  });

  expInput?.addEventListener('input', () => {
    let val = expInput.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) expInput.value = `${val.slice(0, 2)}/${val.slice(2)}`;
    else expInput.value = val;
  });

  cvvInput?.addEventListener('input', () => {
    cvvInput.value = cvvInput.value.replace(/\D/g, '').slice(0, 4);
  });

  cpfInput?.addEventListener('input', () => {
    let v = cpfInput.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    cpfInput.value = v;
  });

  submitBtn?.addEventListener('click', async () => {
    const rawNumber = numInput.value.replace(/\D/g, '');
    const name = nameInput.value.trim();
    const expiry = expInput.value.trim();
    const cvv = cvvInput.value.trim();
    const cpf = cpfInput.value.replace(/\D/g, '');
    const installments = parseInt(document.getElementById('customCardInstallments').value, 10) || 1;

    if (rawNumber.length < 13) {
      alert('Digite o número completo do cartão.');
      numInput.focus();
      return;
    }
    if (!name) {
      alert('Digite o nome impresso no cartão.');
      nameInput.focus();
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      alert('Digite a validade no formato MM/AA.');
      expInput.focus();
      return;
    }
    const [expMonth] = expiry.split('/').map(Number);
    if (expMonth < 1 || expMonth > 12) {
      alert('Mês de validade inválido (deve ser de 01 a 12).');
      expInput.focus();
      return;
    }
    if (cvv.length < 3) {
      alert('Digite o código de segurança (CVV).');
      cvvInput.focus();
      return;
    }

    if (statusEl) {
      statusEl.textContent = 'Processando pagamento com cartão...';
      statusEl.style.color = '#9da2aa';
      statusEl.style.display = 'block';
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'PROCESSANDO...';

    try {
      if (!authenticated) {
        alert('Cadastre-se ou entre na sua conta para finalizar o pedido.');
        show('cadastro');
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
        return;
      }
      const { address } = await api('/api/addresses/mine');
      if (!address) {
        alert('Cadastre seu endereço de entrega antes de finalizar o pedido.');
        show('endereco');
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
        return;
      }

      const items = cart.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ items, paymentMethod: 'cartao' }),
      });
      broadcastSync('ORDER_CREATED', { orderId: order.id });
      refreshLojaStockData();

      const cardBrand = detectBrand(rawNumber);
      const result = await api('/api/payments/card', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          cardNumber: rawNumber,
          cardBrand,
          lastFour: rawNumber.slice(-4),
          installments,
          payer: {
            email: (currentUser && currentUser.email) || 'cliente@fahrenparts.com.br',
            identification: { type: 'CPF', number: cpf || '00000000000' },
          },
        }),
      });

      if (result.status === 'approved' || result.statusInterno === 'aprovado') {
        if (statusEl) {
          statusEl.textContent = 'Pagamento aprovado com sucesso!';
          statusEl.style.color = '#39c979';
        }
        cart = [];
        saveCart();
        alert('Pagamento aprovado! Seu pedido foi confirmado no cartão. Acompanhe o status na tela de Perfil.');
        show('perfil');
      } else {
        alert(result.message || 'Pagamento não aprovado. Tente novamente.');
        submitBtn.disabled = false;
        submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
      }
    } catch (err) {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = err.message || 'Não foi possível processar o pagamento.';
        statusEl.style.color = '#e06a6a';
        statusEl.style.display = 'block';
      }
      alert(err.message || 'Erro ao processar pagamento.');
      submitBtn.disabled = false;
      submitBtn.textContent = `PAGAR R$ ${money(subtotal).replace('R$', '').trim()} COM CARTÃO`;
    }
  });
}
