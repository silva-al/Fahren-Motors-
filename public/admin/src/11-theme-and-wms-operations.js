// Módulo WMS: 11-theme-and-wms-operations.js
// Fahren Motors - Painel de Gestão WMS

// ===================================================================
// CARTA DE CORREÇÃO ELETRÔNICA (CC-e) E DACCE
// ===================================================================
window.openCceModal = (orderId) => {
  const order = allOrders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  markNfAsIssued(orderId);
  const nfsMap = getIssuedNfsMap();
  const nf = nfsMap[orderId] || {};
  const cce = nf.cce || null;

  const orderIdInput = document.getElementById('cceOrderId');
  if (orderIdInput) orderIdInput.value = orderId;

  const nfNumEl = document.getElementById('cceNfNumber');
  if (nfNumEl) nfNumEl.textContent = `NF-e Nº. 000.${String(nf.nfNumber || (1000 + Number(orderId))).padStart(6, '0')} (Série ${nf.series || '1'})`;

  const custEl = document.getElementById('cceCustomerName');
  if (custEl) custEl.textContent = nf.customerName || order.customerName || 'Consumidor Final';

  const dateEl = document.getElementById('cceNfDate');
  if (dateEl) dateEl.textContent = formatDate(nf.issuedAt || new Date().toISOString());

  const keyEl = document.getElementById('cceNfKey');
  if (keyEl) keyEl.textContent = nf.accessKey || generateNfAccessKey(orderId);

  const textInput = document.getElementById('cceText');
  const seqInput = document.getElementById('cceSeq');
  const dateInput = document.getElementById('cceDate');
  const protocolInput = document.getElementById('cceProtocol');
  const btnPrintDacce = document.getElementById('btnPrintDacceFromModal');

  if (cce) {
    if (seqInput) seqInput.value = cce.seq || 1;
    if (dateInput) dateInput.value = cce.date ? new Date(cce.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
    if (protocolInput) protocolInput.value = cce.protocol || ('135' + Date.now().toString().slice(-11));
    if (textInput) textInput.value = cce.text || '';
    if (btnPrintDacce) {
      btnPrintDacce.classList.remove('hidden');
      btnPrintDacce.onclick = () => {
        closeCceModal();
        openDacceForOrder(orderId);
      };
    }
  } else {
    if (seqInput) seqInput.value = 1;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 16);
    if (protocolInput) protocolInput.value = '135' + Date.now().toString().slice(-11);
    if (textInput) textInput.value = '';
    if (btnPrintDacce) btnPrintDacce.classList.add('hidden');
  }

  const counter = document.getElementById('cceCharCounter');
  if (counter && textInput) counter.textContent = `${textInput.value.length} / 1000`;

  document.getElementById('cceModal')?.classList.remove('hidden');
};

window.closeCceModal = () => {
  document.getElementById('cceModal')?.classList.add('hidden');
};

document.getElementById('cceText')?.addEventListener('input', (e) => {
  const counter = document.getElementById('cceCharCounter');
  if (counter) counter.textContent = `${e.target.value.length} / 1000`;
});

document.getElementById('btnSaveCce')?.addEventListener('click', () => {
  const orderId = document.getElementById('cceOrderId')?.value;
  if (!orderId) return;

  const text = (document.getElementById('cceText')?.value || '').trim();
  if (text.length < 15) {
    showToast('O texto da correção deve ter no mínimo 15 caracteres (Regra SEFAZ).');
    return;
  }

  const nfsMap = getIssuedNfsMap();
  if (!nfsMap[orderId]) {
    markNfAsIssued(orderId);
  }

  const dateVal = document.getElementById('cceDate')?.value;
  const isoDate = dateVal ? new Date(dateVal).toISOString() : new Date().toISOString();
  const seq = parseInt(document.getElementById('cceSeq')?.value, 10) || 1;
  const protocol = document.getElementById('cceProtocol')?.value?.trim() || ('135' + Date.now().toString().slice(-11));

  nfsMap[orderId] = {
    ...(nfsMap[orderId] || {}),
    cce: {
      seq,
      date: isoDate,
      protocol,
      text,
      status: '135 - Evento homologado e vinculado à NF-e'
    }
  };

  try { localStorage.setItem(NF_STORAGE_KEY, JSON.stringify(nfsMap)); } catch (e) {}
  
  // Persistência permanente da CC-e no PostgreSQL
  fetch(`/api/fiscal/notes/${orderId}/cce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cceText: text })
  }).catch((e) => console.warn('[Fiscal:API] CC-e salva localmente; erro ao sincronizar no banco:', e));

  closeCceModal();
  renderFiscalTable();
  showToast(`Carta de Correção Eletrônica (Seq ${seq}) vinculada com sucesso!`);
});

window.openDacceForOrder = (orderId) => {
  const order = allOrders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const nfsMap = getIssuedNfsMap();
  const nf = nfsMap[orderId];
  if (!nf || !nf.cce) {
    showToast('Nenhuma Carta de Correção (CC-e) registrada para esta nota fiscal.');
    return;
  }

  const cce = nf.cce;
  const addr = order.address || {};
  const destName = nf.customerName || order.customerName || 'Consumidor Final';
  const destDoc = nf.customerDoc || order.customerCpf || '99.999.999/0001-91';
  const destAddr = nf.customerAddress || (addr.street ? `${addr.street}, ${addr.number || 'S/N'} - ${addr.neighborhood || 'Centro'}, ${addr.city || FISCAL_CONFIG.cidade}-${addr.state || FISCAL_CONFIG.uf}` : 'Av. Santana, 1420 - Centro');
  const nfNumFull = `000.${String(nf.nfNumber || (1000 + Number(orderId))).padStart(6, '0')}`;
  const rawKey = (nf.accessKey || generateNfAccessKey(orderId)).replace(/\s+/g, '');
  const cceDateFull = formatDate(cce.date);
  const nfDateFull = formatDate(nf.issuedAt || new Date().toISOString());

  const sheet = document.getElementById('daccePrintArea');
  if (!sheet) return;

  sheet.innerHTML = `
    <div style="border:1px solid #000;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #000;padding-bottom:8px;margin-bottom:8px">
        <div>
          <div style="font-size:14px;font-weight:900;text-transform:uppercase">${FISCAL_CONFIG.razaoSocial}</div>
          <div style="font-size:9.5px;color:#333;margin-top:2px">
            ${FISCAL_CONFIG.logradouro} - ${FISCAL_CONFIG.cidade}-${FISCAL_CONFIG.uf} - CEP: ${FISCAL_CONFIG.cep} - Fone: ${FISCAL_CONFIG.telefone}
          </div>
          <div style="font-size:9.5px;margin-top:2px">
            <strong>CNPJ:</strong> ${FISCAL_CONFIG.cnpj} &nbsp;|&nbsp; <strong>I.E.:</strong> ${FISCAL_CONFIG.ie}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:900;border:2px solid #000;padding:4px 10px;display:inline-block">DACCE</div>
          <div style="font-size:8.5px;margin-top:4px">DOCUMENTO AUXILIAR DA CARTA DE CORREÇÃO ELETRÔNICA</div>
        </div>
      </div>

      <div style="display:flex;gap:12px;align-items:center;background:#f9f9f9;padding:6px 10px;border:1px solid #ccc;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-size:8px;font-weight:700;color:#555">CHAVE DE ACESSO DA NF-E VINCULADA</div>
          <div style="font-family:monospace;font-size:12px;font-weight:700;letter-spacing:0.5px">${nf.accessKey || rawKey}</div>
        </div>
        <div style="width:220px">
          ${generateCode128Svg(rawKey, 34, 'cce-barcode-svg')}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;border:1px solid #000;padding:8px;margin-bottom:8px;font-size:9.5px">
        <div><strong>NF-E NÚMERO:</strong> ${nfNumFull}</div>
        <div><strong>SÉRIE:</strong> ${nf.series || '1'}</div>
        <div><strong>EMISSÃO NF-E:</strong> ${nfDateFull.slice(0, 10)}</div>
        <div><strong>PEDIDO LOJA:</strong> #${order.id}</div>
        <div style="grid-column:1 / -1"><strong>DESTINATÁRIO:</strong> ${destName} &nbsp;|&nbsp; <strong>CNPJ/CPF:</strong> ${destDoc}</div>
        <div style="grid-column:1 / -1"><strong>ENDEREÇO:</strong> ${destAddr}</div>
      </div>

      <div style="background:#000;color:#fff;font-weight:800;font-size:10px;padding:4px 8px;margin-bottom:6px">
        DADOS DO EVENTO FISCAL — SEFAZ AUTORIZADORA
      </div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;border:1px solid #000;padding:8px;margin-bottom:10px;font-size:9.5px">
        <div><strong>EVENTO:</strong> 110110 - CARTA DE CORREÇÃO</div>
        <div><strong>SEQUENCIAL DO EVENTO:</strong> ${cce.seq || 1}</div>
        <div><strong>ÓRGÃO RECEPTOR:</strong> SEFAZ - SP (35)</div>
        <div><strong>PROTOCOLO SEFAZ:</strong> ${cce.protocol || '135260009874512'}</div>
        <div><strong>DATA/HORA DO REGISTRO:</strong> ${cceDateFull}</div>
        <div><strong>STATUS DO EVENTO:</strong> 135 - Evento Homologado</div>
      </div>

      <div style="font-size:11px;font-weight:800;margin-bottom:4px">
        TEXTO DA CORREÇÃO A SER CONSIDERADA:
      </div>
      <div class="dacce-correction-box">
        ${cce.text}
      </div>

      <div style="border:1px solid #666;padding:8px;margin-top:10px;font-size:8px;line-height:1.35;color:#333;background:#fdfdfd">
        <strong>CONDIÇÃO DE USO:</strong> A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.
      </div>
      
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:8px;color:#666">
        <span>DACCE impresso em ${formatDate(new Date().toISOString())}</span>
        <span>JC Mantovan - Sistema de Gestão e Faturamento WMS Fahren Motors</span>
      </div>
    </div>
  `;

  document.getElementById('dacceModal')?.classList.remove('hidden');
};

window.closeDacceModal = () => {
  document.getElementById('dacceModal')?.classList.add('hidden');
};

// Helper de formatação numérica brasileira para campos fiscais
function moneyNum(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateCode128Svg(codeText, height = 52, customClass = '') {
  const patterns = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
    [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
    [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],[2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
    [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
    [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,3,1,1,1,2]
  ];

  const rawInput = String(codeText || '').trim();
  const digitsOnly = rawInput.replace(/\D/g, '');
  const isDanfe = digitsOnly.length === 44;
  const isSubsetC = isDanfe || (digitsOnly.length >= 4 && digitsOnly.length % 2 === 0 && digitsOnly.length === rawInput.length);

  let sequence = [];
  let checksum = 0;

  if (isSubsetC) {
    const startCode = 105; // Code 128 Subset C (Padrão Oficial SEFAZ / DANFE)
    checksum = startCode;
    sequence.push(startCode);
    let pos = 1;
    const targetDigits = isDanfe ? digitsOnly : rawInput;
    for (let i = 0; i < targetDigits.length; i += 2) {
      const val = parseInt(targetDigits.substr(i, 2), 10);
      sequence.push(val);
      checksum += val * pos;
      pos++;
    }
  } else {
    // Subset B (Padrão WMS para SKUs alfanuméricos como 'BRD0288')
    const startCode = 104; // Subset B
    checksum = startCode;
    sequence.push(startCode);
    const sanitized = rawInput.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let pos = 1;
    for (let i = 0; i < sanitized.length; i++) {
      const charCode = sanitized.charCodeAt(i) - 32;
      if (charCode >= 0 && charCode <= 95) {
        sequence.push(charCode);
        checksum += charCode * pos;
        pos++;
      }
    }
    if (sequence.length === 1) {
      sequence.push(16);
      checksum += 16 * 1;
    }
  }

  checksum %= 103;
  sequence.push(checksum);
  sequence.push(106); // Stop

  // Quiet Zone de segurança (mínimo de 20 módulos / 5mm no DANFE para leitura ótica imediata em coletores)
  const quietZone = isDanfe ? 20 : 10;
  let totalDataModules = 0;
  sequence.forEach(code => {
    const pattern = patterns[code];
    if (pattern) totalDataModules += pattern.reduce((a, b) => a + b, 0);
  });
  const totalWidth = totalDataModules + (quietZone * 2);

  // Renderização vetorial exata: cada barra é desenhada com sua largura inteira em módulos
  let rects = '';
  let currentX = quietZone;
  sequence.forEach(code => {
    const pattern = patterns[code];
    if (!pattern) return;
    let isBar = true;
    for (let w of pattern) {
      if (isBar) {
        rects += '<rect class="barcode-bar" x="' + currentX + '" y="0" width="' + w + '" height="' + height + '" fill="#000000" style="fill:#000000 !important; stroke:none !important;" shape-rendering="crispEdges"/>';
      }
      currentX += w;
      isBar = !isBar;
    }
  });

  const svgClass = customClass ? customClass : (isDanfe ? 'danfe-barcode-svg' : 'wms-barcode-svg');
  const svgStyle = isDanfe
    ? 'width:88mm;max-width:90mm;height:' + height + 'px;display:block;margin:0 auto;background:#ffffff !important;'
    : 'width:100%;height:' + height + 'px;display:block;margin:0 auto;background:#ffffff !important;';

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalWidth + ' ' + height + '" ' +
            'preserveAspectRatio="none" shape-rendering="crispEdges" class="' + svgClass + '" ' +
            'style="' + svgStyle + '">';
  svg += '<rect class="barcode-bg" x="0" y="0" width="' + totalWidth + '" height="' + height + '" fill="#ffffff" style="fill:#ffffff !important; stroke:none !important;" shape-rendering="crispEdges"/>';
  svg += rects;
  svg += '</svg>';
  return svg;
}

// Renderizador ultra nítido via Canvas nativo para o DANFE (600 DPI sem anti-aliasing / zero borrão em papel e coletores)
function generateDanfeBarcodeHtml(codeText, height = 48) {
  const digitsOnly = String(codeText).replace(/\D/g, '');
  if (digitsOnly.length === 44 && typeof document !== 'undefined' && document.createElement) {
    try {
      const patterns = [
        [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
        [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
        [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
        [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
        [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
        [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
        [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],[1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
        [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],[2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
        [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],[1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
        [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
        [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,3,1,1,1,2]
      ];
      const startCode = 105;
      let checksum = startCode;
      const sequence = [startCode];
      let pos = 1;
      for (let i = 0; i < digitsOnly.length; i += 2) {
        const val = parseInt(digitsOnly.substr(i, 2), 10);
        sequence.push(val);
        checksum += val * pos;
        pos++;
      }
      checksum %= 103;
      sequence.push(checksum);
      sequence.push(106);

      const quietZone = 20;
      const scale = 3; // 3 pixels inteiros por módulo (951px) para padrão ótico de alta definição 600 DPI
      let totalDataModules = 0;
      sequence.forEach(code => {
        const p = patterns[code];
        if (p) totalDataModules += p.reduce((a, b) => a + b, 0);
      });
      const totalModules = totalDataModules + (quietZone * 2);
      const canvasW = totalModules * scale;
      const canvasH = height * scale;

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#000000';

      let curX = quietZone * scale;
      sequence.forEach(code => {
        const p = patterns[code];
        if (!p) return;
        let isBar = true;
        for (let w of p) {
          if (isBar) {
            ctx.fillRect(curX, 0, w * scale, canvasH);
          }
          curX += w * scale;
          isBar = !isBar;
        }
      });

      const dataUrl = canvas.toDataURL('image/png');
      return `<img src="${dataUrl}" class="danfe-barcode-img" alt="Código de Barras Chave de Acesso DANFE" style="width:80mm;max-width:80mm;height:${height}px;display:block;margin:0 auto;image-rendering:pixelated;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;" />`;
    } catch (e) {
      console.warn('Canvas barcode fallback:', e);
    }
  }
  return generateCode128Svg(codeText, height, 'danfe-barcode-svg');
}

// ---------- MODAL DE IMPRESSÃO DO DANFE OFICIAL ----------
// Fechar modal, cancelar edição ou voltar de telas/abas com tecla ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 1. Fecha qualquer modal aberto no sistema (editNfModal, cceModal, dacceModal, danfeModal, stockModal, etc.)
    const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    if (openModals && openModals.length > 0) {
      openModals.forEach(m => m.classList.add('hidden'));
      return;
    }

    // 2. Se estiver editando produto no formulário, cancela edição
    if (editingProductId) {
      resetProductForm();
      showToast('Edição de peça cancelada.');
      return;
    }

    // 3. Se estiver em qualquer outra aba que não seja o Dashboard, volta pelo histórico ou para o Dashboard
    if (currentTabId && currentTabId !== 'dashboard') {
      if (tabHistory.length > 1) {
        tabHistory.pop(); // remove a aba atual
        const prevTab = tabHistory[tabHistory.length - 1] || 'dashboard';
        switchTab(prevTab, false);
      } else {
        switchTab('dashboard', false);
      }
      return;
    }
  }
});

// Fechar modais clicando no fundo escuro (backdrop)
['danfeModal', 'dacceModal', 'cceModal', 'editNfModal', 'stockModal'].forEach(mId => {
  document.getElementById(mId)?.addEventListener('click', (e) => {
    if (e.target.id === mId) {
      e.target.classList.add('hidden');
    }
  });
});

window.openDanfeForOrder = (orderId, options = {}) => {
  const order = allOrders.find(o => String(o.id) === String(orderId));
  if (!order) return '';
  window._currentDanfeOrderId = order.id;

  markNfAsIssued(orderId);
  const nfsMap = getIssuedNfsMap();
  const nf = nfsMap[orderId] || {
    nfNumber: 1000 + Number(orderId),
    series: '1',
    accessKey: generateNfAccessKey(orderId),
    operation: '6102 - Venda de mercadoria adquirida ou recebida de terceiros',
    protocol: '141200000220788',
    issuedAt: new Date().toISOString()
  };

  const sheet = document.getElementById('danfePrintArea');
  if (!sheet) return;

  const addr = order.address || {};
  const destName = nf.customerName || order.customerName || 'Consumidor Final';
  const destPhone = order.customerPhone || '(19) 99876-5432';
  const destCep = addr.cep || '13180-000';
  const destCity = addr.city || FISCAL_CONFIG.cidade;
  const destUf = addr.state || FISCAL_CONFIG.uf;
  const destBairro = addr.neighborhood || 'Centro';
  const destRua = nf.customerAddress || (addr.street ? `${addr.street}, ${addr.number || 'S/N'} ${addr.complement || ''}`.trim() : 'Av. Santana, 1420');
  const destCpfCnpj = nf.customerDoc || order.customerCpf || '99.999.999/0001-91';
  const naturezaOperacao = nf.operation || '6102 - Venda de mercadoria adquirida ou recebida de terceiros';
  const protocolo = nf.protocol || `141200000220788`;
  const serieNf = nf.series || '001';
  const infoComplementar = nf.notes || `Inf. Contribuinte: Pedido #${order.id} - Forma de Pagamento: ${order.paymentMethodLabel || 'PIX'}.<br/>Documento emitido por ME ou EPP optante pelo Simples Nacional.<br/>Permite o aproveitamento de crédito de ICMS correspondente à alíquota de 2,5%, nos termos do art. 23 da LC 123/2006.<br/>NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI. Destinado a consumidor final.`;

  const items = order.items || [];
  const totalProdutos = items.reduce((acc, i) => acc + ((Number(i.unitPrice) || 0) * (Number(i.quantity) || 1)), 0);
  const valorTotalNota = Number(order.total) || totalProdutos;
  const valorIcms = totalProdutos * 0.07;
  const emissaoDate = formatDate(nf.issuedAt).slice(0, 10);
  const emissaoFull = formatDate(nf.issuedAt);
  const emissaoHora = formatDate(nf.issuedAt).slice(11);
  const nfNumFull = `000.${String(nf.nfNumber).padStart(6, '0')}`;
  let rawKey = (nf.accessKey || '').replace(/\s+/g, '');
  if (rawKey.length === 44) {
    const key43 = rawKey.slice(0, 43);
    const validDv = calculateNfAccessKeyDv(key43);
    if (rawKey[43] !== validDv) {
      rawKey = key43 + validDv;
      nf.accessKey = rawKey.match(/.{1,4}/g).join(' ');
    }
  }
  const totalQtd = items.reduce((a, i) => a + (Number(i.quantity) || 1), 0);

  sheet.innerHTML = `
    <!-- CANHOTO DE RECEBIMENTO -->
    <div class="nf-canhoto">
      <div class="nf-canhoto-left">
        <div class="nf-canhoto-text">
          RECEBEMOS DE ${FISCAL_CONFIG.razaoSocial} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: ${emissaoDate} - VALOR TOTAL: R$ ${moneyNum(valorTotalNota)} - DESTINATÁRIO: ${destName} - ${destRua}, ${destBairro} - ${destCity}-${destUf}
        </div>
        <div class="nf-canhoto-bottom">
          <div class="nf-canhoto-data">
            <span class="nf-label">DATA DE RECEBIMENTO</span>
          </div>
          <div class="nf-canhoto-assinatura">
            <span class="nf-label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
          </div>
        </div>
      </div>
      <div class="nf-canhoto-right">
        <div class="nf-canhoto-nfe">NF-e</div>
        <div class="nf-canhoto-num">Nº. ${nfNumFull}</div>
        <div class="nf-canhoto-serie">Série ${serieNf}</div>
      </div>
    </div>
    <div class="nf-cut-line"></div>

    <!-- CABEÇALHO PRINCIPAL (3 COLUNAS) -->
    <div class="nf-header-main">
      <div class="nf-header-emitente">
        <div class="nf-emitente-sub">IDENTIFICAÇÃO DO EMITENTE</div>
        <div class="nf-emitente-brand">${FISCAL_CONFIG.razaoSocial}</div>
        <div class="nf-emitente-info">
          ${FISCAL_CONFIG.logradouro}<br/>
          ${FISCAL_CONFIG.cidade} - ${FISCAL_CONFIG.uf} - Fone/Fax: ${FISCAL_CONFIG.telefone}<br/>
          CEP: ${FISCAL_CONFIG.cep} - www.fahrenmotors.com.br
        </div>
      </div>
      <div class="nf-header-danfe">
        <div class="nf-danfe-word">DANFE</div>
        <div class="nf-danfe-desc">Documento Auxiliar da<br/>Nota Fiscal Eletrônica</div>
        <div class="nf-tp-emis-box">
          <div class="nf-tp-emis-text">0 - ENTRADA<br/>1 - SAÍDA</div>
          <div class="nf-tp-emis-digit">1</div>
        </div>
        <div class="nf-danfe-num">Nº. ${nfNumFull}</div>
        <div class="nf-danfe-sub">Série ${serieNf}</div>
        <div class="nf-danfe-sub">Folha 1/1</div>
      </div>
      <div class="nf-header-barcode">
        <div class="nf-barcode-svg-wrap">
          ${generateDanfeBarcodeHtml(rawKey, 48)}
        </div>
        <div class="nf-key-label">CHAVE DE ACESSO</div>
        <div class="nf-key-text">${nf.accessKey}</div>
        <div class="nf-consulta-box">
          Consulta de autenticidade no portal nacional da NF-e<br/>
          <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora
        </div>
      </div>
    </div>

    <!-- NATUREZA DA OPERAÇÃO / PROTOCOLO -->
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:2.2">
        <span class="nf-label">NATUREZA DA OPERAÇÃO</span>
        <strong>${naturezaOperacao}</strong>
      </div>
      <div class="nf-cell" style="flex:1.8;border-left:1px solid #000">
        <span class="nf-label">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
        <strong>${protocolo} - ${emissaoFull}</strong>
      </div>
    </div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:1">
        <span class="nf-label">INSCRIÇÃO ESTADUAL</span>
        <span>${FISCAL_CONFIG.ie}</span>
      </div>
      <div class="nf-cell" style="flex:1;border-left:1px solid #000">
        <span class="nf-label">INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.</span>
        <span>&nbsp;</span>
      </div>
      <div class="nf-cell" style="flex:1;border-left:1px solid #000">
        <span class="nf-label">CNPJ</span>
        <strong>${FISCAL_CONFIG.cnpj}</strong>
      </div>
    </div>

    <!-- DESTINATÁRIO / REMETENTE -->
    <div class="nf-section-title">DESTINATÁRIO / REMETENTE</div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:3">
        <span class="nf-label">NOME / RAZÃO SOCIAL</span>
        <strong>${destName}</strong>
      </div>
      <div class="nf-cell" style="flex:1.4;border-left:1px solid #000">
        <span class="nf-label">CNPJ / CPF</span>
        <strong>${destCpfCnpj}</strong>
      </div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000">
        <span class="nf-label">DATA DA EMISSÃO</span>
        <span>${emissaoDate}</span>
      </div>
    </div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:2.7">
        <span class="nf-label">ENDEREÇO</span>
        <span>${destRua}</span>
      </div>
      <div class="nf-cell" style="flex:1.3;border-left:1px solid #000">
        <span class="nf-label">BAIRRO / DISTRITO</span>
        <span>${destBairro}</span>
      </div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000">
        <span class="nf-label">CEP</span>
        <span>${destCep}</span>
      </div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000">
        <span class="nf-label">DATA SAÍDA/ENTRADA</span>
        <span>${emissaoDate}</span>
      </div>
    </div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:2.2">
        <span class="nf-label">MUNICÍPIO</span>
        <span>${destCity}</span>
      </div>
      <div class="nf-cell" style="flex:0.4;border-left:1px solid #000">
        <span class="nf-label">UF</span>
        <span>${destUf}</span>
      </div>
      <div class="nf-cell" style="flex:1.1;border-left:1px solid #000">
        <span class="nf-label">FONE / FAX</span>
        <span>${destPhone}</span>
      </div>
      <div class="nf-cell" style="flex:1.1;border-left:1px solid #000">
        <span class="nf-label">INSCRIÇÃO ESTADUAL</span>
        <span>ISENTO</span>
      </div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000">
        <span class="nf-label">HORA DA SAÍDA</span>
        <span>${emissaoHora}</span>
      </div>
    </div>

    <!-- CÁLCULO DO IMPOSTO -->
    <div class="nf-section-title">CÁLCULO DO IMPOSTO</div>
    <div class="nf-row nf-calc-imposto" style="border-top:0">
      <div class="nf-cell"><span class="nf-label">BASE DE CÁLC. DO ICMS</span>${moneyNum(totalProdutos)}</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR DO ICMS</span>${moneyNum(valorIcms)}</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">BASE DE CÁLC. ICMS S.T.</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR DO ICMS S.T.</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR DO F. POBREZA</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR DO II</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR TOTAL DOS PRODUTOS</span>${moneyNum(totalProdutos)}</div>
    </div>
    <div class="nf-row nf-calc-imposto" style="border-top:0">
      <div class="nf-cell"><span class="nf-label">VALOR DO FRETE</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR DO SEGURO</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">DESCONTO</span>${moneyNum(order.discount || 0)}</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">OUTRAS DESP. ACESS.</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR TOTAL DO IPI</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR TOTAL TRIBUTOS</span>0,00</div>
      <div class="nf-cell" style="border-left:1px solid #000"><span class="nf-label">VALOR TOTAL DA NOTA</span><strong>${moneyNum(valorTotalNota)}</strong></div>
    </div>

    <!-- TRANSPORTADOR / VOLUMES TRANSPORTADOS -->
    <div class="nf-section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:2.2"><span class="nf-label">NOME / RAZÃO SOCIAL</span>&nbsp;</div>
      <div class="nf-cell" style="flex:1.1;border-left:1px solid #000"><span class="nf-label">FRETE POR CONTA</span>(9) Sem Frete</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">CÓDIGO ANTT</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">PLACA DO VEÍCULO</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.3;border-left:1px solid #000"><span class="nf-label">UF</span>&nbsp;</div>
      <div class="nf-cell" style="flex:1.1;border-left:1px solid #000"><span class="nf-label">CNPJ / CPF</span>&nbsp;</div>
    </div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:2.5"><span class="nf-label">ENDEREÇO</span>&nbsp;</div>
      <div class="nf-cell" style="flex:1.5;border-left:1px solid #000"><span class="nf-label">MUNICÍPIO</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.3;border-left:1px solid #000"><span class="nf-label">UF</span>&nbsp;</div>
      <div class="nf-cell" style="flex:1;border-left:1px solid #000"><span class="nf-label">INSCRIÇÃO ESTADUAL</span>&nbsp;</div>
    </div>
    <div class="nf-row" style="border-top:0">
      <div class="nf-cell" style="flex:0.8"><span class="nf-label">QUANTIDADE</span>${totalQtd}</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">ESPÉCIE</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">MARCA</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">NUMERAÇÃO</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">PESO BRUTO</span>&nbsp;</div>
      <div class="nf-cell" style="flex:0.8;border-left:1px solid #000"><span class="nf-label">PESO LÍQUIDO</span>&nbsp;</div>
    </div>

    <!-- DADOS DOS PRODUTOS / SERVIÇOS -->
    <div class="nf-section-title">DADOS DOS PRODUTOS / SERVIÇOS</div>
    <div class="nf-products-container">
      <table class="nf-products-table">
        <thead>
          <tr>
            <th style="width:7%">CÓDIGO PRODUTO</th>
            <th style="width:33%">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
            <th style="width:7%">NCM/SH</th>
            <th style="width:4%">CST</th>
            <th style="width:5%">CFOP</th>
            <th style="width:4%">UNID.</th>
            <th style="width:5%">QUANT.</th>
            <th style="width:7%">VALOR UNIT.</th>
            <th style="width:7%">VALOR TOTAL</th>
            <th style="width:7%">B. CÁLC. ICMS</th>
            <th style="width:6%">VALOR ICMS</th>
            <th style="width:5%">VALOR IPI</th>
            <th style="width:4%">ALÍQ. ICMS</th>
            <th style="width:4%">ALÍQ. IPI</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => {
            const qtd = Number(i.quantity) || 1;
            const unit = Number(i.unitPrice) || 0;
            const tot = qtd * unit;
            const icmsItem = tot * 0.07;
            return `
              <tr class="nf-item-row">
                <td>${String(i.productId || '01').padStart(2, '0')}</td>
                <td style="text-align:center"><strong>${i.name}</strong></td>
                <td>8708.29.99</td>
                <td>0102</td>
                <td>5.102</td>
                <td>UN</td>
                <td>${qtd}</td>
                <td>${moneyNum(unit)}</td>
                <td>${moneyNum(tot)}</td>
                <td>${moneyNum(tot)}</td>
                <td>${moneyNum(icmsItem)}</td>
                <td>0,00</td>
                <td>7%</td>
                <td>0%</td>
              </tr>
            `;
          }).join('')}
          <tr class="nf-empty-filler">
            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DADOS ADICIONAIS -->
    <div class="nf-section-title">DADOS ADICIONAIS</div>
    <div class="nf-row nf-dados-adicionais" style="border-top:0">
      <div class="nf-cell" style="flex:2.6">
        <span class="nf-label">INFORMAÇÕES COMPLEMENTARES</span>
        <div style="font-size:6.2px;line-height:1.2;margin-top:1px">
          ${infoComplementar.includes('<br') ? infoComplementar : infoComplementar.replace(/\n/g, '<br/>')}
        </div>
      </div>
      <div class="nf-cell" style="flex:1;border-left:1px solid #000">
        <span class="nf-label">RESERVADO AO FISCO</span>
        &nbsp;
      </div>
    </div>
    <div class="nf-footer-line">
      <span>Impresso em ${emissaoFull}</span>
      <span>JC Mantovan - Desenvolvido por Sistema Fahren Motors Gestão WMS</span>
    </div>
  `;

  if (!options || !options.silent) {
    document.getElementById('danfeModal')?.classList.remove('hidden');
  }
  return sheet.innerHTML;
};


// ===================================================================
// IMPRESSÃO OFICIAL DANFE / DACCE EM 1 PÁGINA (ZERO PÁGINAS EM BRANCO)
// ===================================================================
window.addEventListener('beforeprint', () => {
  window.scrollTo(0, 0);
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
  const dm = document.getElementById('danfeModal');
  if (dm) dm.scrollTop = 0;
  const dcm = document.getElementById('dacceModal');
  if (dcm) dcm.scrollTop = 0;
  const v1 = document.querySelector('#danfeModal .danfe-scroll-viewport');
  if (v1) v1.scrollTop = 0;
  const v2 = document.querySelector('#dacceModal .danfe-scroll-viewport');
  if (v2) v2.scrollTop = 0;
});

function getDanfeStandalonePrintCss() {
  return `
    @page {
      size: A4 portrait;
      margin: 4mm 5mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
      width: 100% !important;
      height: auto !important;
      overflow: visible !important;
    }
    .danfe-sheet {
      background: #ffffff !important;
      color: #000000 !important;
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
      padding: 0 !important;
      margin: 0 auto !important;
      border: 1px solid #000000 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      font-size: 9px !important;
      line-height: 1.25 !important;
      width: 100% !important;
      max-width: 200mm !important;
      height: auto !important;
      box-sizing: border-box !important;
      page-break-before: avoid !important;
      break-before: avoid !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .nf-canhoto { display: flex !important; border: 1px solid #000 !important; box-sizing: border-box !important; page-break-inside: avoid !important; }
    .nf-canhoto-left { flex: 5.2 !important; display: flex !important; flex-direction: column !important; }
    .nf-canhoto-text { font-size: 7.2px !important; line-height: 1.3 !important; padding: 4px 7px !important; border-bottom: 1px solid #000 !important; text-transform: uppercase !important; }
    .nf-canhoto-bottom { display: flex !important; flex: 1 !important; min-height: 38px !important; }
    .nf-canhoto-data { flex: 1.3 !important; border-right: 1px solid #000 !important; padding: 4px 7px !important; }
    .nf-canhoto-assinatura { flex: 3.7 !important; padding: 4px 7px !important; }
    .nf-canhoto-assinatura .nf-label { letter-spacing: 0.3px !important; }
    .nf-canhoto-right { flex: 1.2 !important; border-left: 1px solid #000 !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important; padding: 6px 8px !important; }
    .nf-canhoto-nfe { font-size: 16px !important; font-weight: 900 !important; line-height: 1 !important; }
    .nf-canhoto-num { font-size: 10.5px !important; font-weight: bold !important; white-space: nowrap !important; margin-top: 3px !important; }
    .nf-canhoto-serie { font-size: 8.5px !important; margin-top: 1px !important; }
    .nf-cut-line { border-top: 1px dashed #000 !important; margin: 4px 0 5px 0 !important; }
    .nf-header-main { display: grid !important; grid-template-columns: 2.3fr 1.1fr 2.4fr !important; border: 1px solid #000 !important; box-sizing: border-box !important; min-height: 104px !important; page-break-inside: avoid !important; }
    .nf-header-emitente { padding: 6px 10px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; text-align: center !important; }
    .nf-emitente-sub { font-size: 6.8px !important; font-weight: bold !important; color: #222 !important; text-transform: uppercase !important; margin-bottom: 3px !important; }
    .nf-emitente-brand { font-size: 13px !important; font-weight: 900 !important; color: #000 !important; text-transform: uppercase !important; letter-spacing: 0.6px !important; margin-bottom: 3px !important; }
    .nf-emitente-info { font-size: 7.8px !important; line-height: 1.35 !important; color: #000 !important; }
    .nf-header-danfe { border-left: 1px solid #000 !important; border-right: 1px solid #000 !important; text-align: center !important; padding: 6px 6px !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; }
    .nf-danfe-word { font-size: 18px !important; font-weight: 900 !important; letter-spacing: 0.5px !important; line-height: 1 !important; }
    .nf-danfe-desc { font-size: 6.8px !important; line-height: 1.15 !important; text-align: center !important; margin-top: 2px !important; }
    .nf-tp-emis-box { display: flex !important; align-items: center !important; justify-content: center !important; gap: 7px !important; margin: 4px 0 !important; }
    .nf-tp-emis-text { font-size: 7.2px !important; font-weight: bold !important; line-height: 1.15 !important; text-align: left !important; }
    .nf-tp-emis-digit { border: 1px solid #000 !important; padding: 2px 7px !important; font-size: 11px !important; font-weight: bold !important; line-height: 1 !important; }
    .nf-danfe-num { font-size: 10.5px !important; font-weight: bold !important; white-space: nowrap !important; margin-top: 1px !important; }
    .nf-danfe-sub { font-size: 8px !important; line-height: 1.25 !important; }
    .nf-header-barcode { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; padding: 4px 6px !important; text-align: center !important; background: #ffffff !important; }
    .nf-barcode-svg-wrap { width: 100% !important; text-align: center !important; margin-bottom: 2px !important; display: flex !important; justify-content: center !important; align-items: center !important; background: #ffffff !important; }
    .nf-barcode-svg-wrap svg, .danfe-barcode-svg, .danfe-barcode-img { width: 80mm !important; max-width: 80mm !important; height: 48px !important; display: block !important; margin: 0 auto !important; shape-rendering: crispEdges !important; image-rendering: -webkit-optimize-contrast !important; image-rendering: crisp-edges !important; image-rendering: pixelated !important; }
    .nf-key-label { font-size: 6.8px !important; font-weight: bold !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; text-align: center !important; }
    .nf-key-text { font-family: 'Courier New', Courier, monospace !important; font-size: 8.2px !important; font-weight: bold !important; letter-spacing: 0.5px !important; white-space: nowrap !important; margin: 2px 0 3px 0 !important; text-align: center !important; }
    .nf-consulta-box { font-size: 6.4px !important; line-height: 1.2 !important; color: #000 !important; border-top: 1px solid #000 !important; width: 100% !important; padding-top: 3px !important; margin-top: 2px !important; text-align: center !important; }
    .nf-row { display: flex !important; border: 1px solid #000 !important; border-top: none !important; box-sizing: border-box !important; text-align: center !important; page-break-inside: avoid !important; }
    .nf-cell { flex: 1 !important; padding: 4px 6px !important; min-height: 30px !important; font-size: 8.8px !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; text-align: center !important; border-right: 1px solid #000 !important; }
    .nf-cell:last-child { border-right: none !important; }
    .nf-label { display: block !important; font-size: 6.8px !important; font-weight: bold !important; color: #000 !important; text-transform: uppercase !important; letter-spacing: 0.15px !important; line-height: 1.15 !important; margin: 0 0 2px 0 !important; text-align: center !important; width: 100% !important; }
    .nf-cell span, .nf-cell strong, .nf-val { font-size: 8.8px !important; color: #000 !important; line-height: 1.2 !important; text-align: center !important; width: 100% !important; display: block !important; }
    .nf-section-title { background: #e6e6e6 !important; font-weight: bold !important; font-size: 7.5px !important; padding: 3px 6px !important; border: 1px solid #000 !important; border-bottom: none !important; text-transform: uppercase !important; letter-spacing: 0.25px !important; margin-top: 4px !important; box-sizing: border-box !important; text-align: center !important; page-break-inside: avoid !important; }
    .nf-calc-imposto .nf-cell { text-align: center !important; padding: 4px 6px !important; min-height: 30px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; align-items: center !important; }
    .nf-products-container { position: relative !important; border: 1px solid #000 !important; border-top: none !important; min-height: 160px !important; display: flex !important; flex-direction: column !important; }
    .nf-products-table { width: 100% !important; border-collapse: collapse !important; font-size: 8.5px !important; table-layout: fixed !important; flex: 1 !important; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important; }
    .nf-products-table th { background: #e6e6e6 !important; border-bottom: 1px solid #000 !important; border-right: 1px solid #000 !important; padding: 3.5px 3px !important; text-align: center !important; font-size: 6.8px !important; font-weight: bold !important; text-transform: uppercase !important; line-height: 1.15 !important; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important; letter-spacing: 0.2px !important; }
    .nf-products-table th:last-child { border-right: none !important; }
    .nf-products-table td { padding: 4px 4px !important; border-right: 1px solid #000 !important; border-bottom: none !important; text-align: center !important; font-size: 8.5px !important; vertical-align: middle !important; line-height: 1.2 !important; color: #000 !important; background: #fff !important; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important; }
    .nf-products-table td:last-child { border-right: none !important; }
    .nf-products-table tr.nf-item-row td { border-bottom: 1px solid #ddd !important; }
    .nf-products-table tr.nf-empty-filler td { height: 100% !important; border-bottom: none !important; }
    .nf-dados-adicionais .nf-cell { font-size: 7.5px !important; line-height: 1.35 !important; min-height: 48px !important; padding: 4px 7px !important; text-align: left !important; }
    .nf-footer-line { display: flex !important; justify-content: center !important; gap: 30px !important; align-items: center !important; font-size: 6.8px !important; color: #555 !important; padding: 3px 0 0 0 !important; margin-top: 2px !important; text-align: center !important; page-break-inside: avoid !important; }
    .nf-watermark-overlay, .no-print, .danfe-mobile-tip { display: none !important; }

    /* DACCE - Carta de Correção */
    .dacce-sheet { background:#fff !important; color:#000 !important; font-family:Arial,sans-serif !important; border:1px solid #000 !important; margin:0 auto !important; width:100% !important; max-width:200mm !important; }
    .dacce-header { text-align:center !important; border-bottom:1px solid #000 !important; padding:10px !important; }
    .dacce-title { font-size:16px !important; font-weight:900 !important; }
    .dacce-sub { font-size:9px !important; margin-top:4px !important; }
    .dacce-grid { display:grid !important; grid-template-columns:1fr 1fr !important; border-bottom:1px solid #000 !important; }
    .dacce-field { padding:6px 10px !important; border-right:1px solid #000 !important; }
    .dacce-field:last-child { border-right:none !important; }
    .dacce-body { padding:12px !important; font-size:10px !important; line-height:1.4 !important; min-height:200px !important; }
  `;
}

window.printDanfeDocument = function() {
  const content = document.getElementById('danfePrintArea')?.innerHTML;
  if (!content) {
    window.print();
    return;
  }
  if (window._currentDanfeOrderId !== undefined && window._currentDanfeOrderId !== null) {
    markNfAsPrinted(window._currentDanfeOrderId);
    renderFiscalTable();
  }
  
  // Impressão isolada via iframe invisível: 0% de bloqueio de popup, 100% alinhado ao topo (sem scroll residual)
  let iframe = document.getElementById('danfe-print-frame');
  if (iframe) iframe.remove();
  
  iframe = document.createElement('iframe');
  iframe.id = 'danfe-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1000px';
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>DANFE - Fahren Motors</title><style>' + getDanfeStandalonePrintCss() + '</style></head><body><div class="danfe-sheet">' + content + '</div></body></html>');
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('Fallback impressão direta:', e);
      window.print();
    }
  }, 350);
};

window.batchPrintDanfes = function(orderIds) {
  const ids = (Array.isArray(orderIds) ? orderIds : [orderIds]).filter(id => id !== undefined && id !== null);
  if (!ids.length) return;

  const sheetsHtml = ids.map((id, idx) => {
    const html = window.openDanfeForOrder(id, { silent: true });
    if (!html) return '';
    const pageBreakStyle = idx < ids.length - 1 ? 'page-break-after:always;break-after:page;margin-bottom:8mm;' : '';
    return '<div class="danfe-sheet" style="' + pageBreakStyle + '">' + html + '</div>';
  }).filter(Boolean).join('');

  if (!sheetsHtml) return;

  markNfAsPrinted(ids);
  renderFiscalTable();
  showToast(ids.length === 1
    ? `Enviando DANFE do Pedido #${ids[0]} para a impressora...`
    : `Enviando lote de ${ids.length} DANFEs para a impressora...`);

  let iframe = document.getElementById('danfe-print-frame');
  if (iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = 'danfe-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1000px';
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>Lote DANFE - Fahren Motors</title><style>' + getDanfeStandalonePrintCss() + '</style></head><body>' + sheetsHtml + '</body></html>');
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('Fallback impressão em lote:', e);
    }
  }, 380);
};

window.printDacceDocument = function() {
  const content = document.getElementById('daccePrintArea')?.innerHTML;
  if (!content) {
    window.print();
    return;
  }
  
  let iframe = document.getElementById('danfe-print-frame');
  if (iframe) iframe.remove();
  
  iframe = document.createElement('iframe');
  iframe.id = 'danfe-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '1000px';
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>DACCE - Carta de Correção - Fahren Motors</title><style>' + getDanfeStandalonePrintCss() + '</style></head><body><div class="danfe-sheet dacce-sheet">' + content + '</div></body></html>');
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.warn('Fallback impressão direta:', e);
      window.print();
    }
  }, 350);
};
window.closeDanfeModal = () => {
  document.getElementById('danfeModal')?.classList.add('hidden');
};

// ---------- INICIALIZAÇÃO DO ADMIN ----------
document.getElementById('adminLoginBtn')?.addEventListener('click', async () => {
  const loginInput = document.getElementById('adminLogin') || document.getElementById('adminEmail');
  const login = (loginInput?.value || '').trim().toLowerCase();
  const password = (document.getElementById('adminPassword')?.value || '').trim();
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!login || !password) {
    errEl.textContent = 'Informe usuário e senha.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const { admin } = await api('/admin/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
    showMain(admin);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try { await api('/admin/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
  showLogin();
});

async function initAdmin() {
  startLiveClock();
  initAutoNfToggle();

  try {
    const { admin } = await api('/admin/auth/me');
    if (admin) {
      showMain(admin);
      return;
    }
  } catch {
    // Não logado
  }
  showLogin();
}

initAdmin();

// ===================================================================
// ALTERNADOR DE TEMA (CLARO / ESCURO) NO PAINEL ADMIN
// ===================================================================
(function alternadorDeTemaAdmin() {
  const CHAVE = 'fahren-tema-admin';
  let temaAtual = 'claro';

  try {
    const salvo = localStorage.getItem(CHAVE) || localStorage.getItem('fahren-tema');
    temaAtual = salvo === 'escuro' ? 'escuro' : 'claro';
  } catch (e) {}

  function aplicar(tema) {
    temaAtual = tema;
    const ehClaro = tema === 'claro';
    document.documentElement.classList.toggle('tema-claro', ehClaro);
    document.body.classList.toggle('tema-claro', ehClaro);
    
    document.querySelectorAll('.theme-toggle-admin').forEach(btn => {
      btn.setAttribute('aria-pressed', ehClaro ? 'true' : 'false');
      btn.title = ehClaro ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';
    });

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ehClaro ? '#f4f6f9' : '#090a0c');
  }

  function alternar() {
    const novo = temaAtual === 'claro' ? 'escuro' : 'claro';
    try {
      localStorage.setItem(CHAVE, novo);
      localStorage.setItem('fahren-tema', novo);
    } catch (e) {}
    aplicar(novo);
  }

  function iniciar() {
    aplicar(temaAtual);
    document.getElementById('loginThemeToggle')?.addEventListener('click', alternar);
    document.getElementById('topbarThemeToggle')?.addEventListener('click', alternar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();

// ===================================================================
// WMS EXPANDIDO: OPERAÇÕES, MOVIMENTAÇÕES, AUDITORIA & LOCALIZAÇÃO
// ===================================================================

// Helper de Badge de Tipo de Movimentação
function getMovementBadge(type) {
  switch (type) {
    case 'entrada':
      return '<span class="status-badge pronto" style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;">Entrada (+)</span>';
    case 'saida':
      return '<span class="status-badge cancelado" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;">Saída (−)</span>';
    case 'transferencia':
      return '<span class="status-badge" style="background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;">Transferência (⇄)</span>';
    case 'ajuste':
      return '<span class="status-badge" style="background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;">Ajuste</span>';
    case 'inventario':
      return '<span class="status-badge" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;">Inventário</span>';
    default:
      return `<span class="status-badge">${type}</span>`;
  }
}
window.getMovementBadge = getMovementBadge;

// Gerador de QR Code Vetorial em SVG Puro (Sem dependências externas)
function generateMiniQrSvg(text, size = 48) {
  const hash = String(text).split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  const n = 21;
  const grid = Array.from({ length: n }, () => Array(n).fill(false));

  function fillBox(x, y, w, h, v) {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (r < n && c < n) grid[r][c] = v;
      }
    }
  }

  // Finder pattern top-left
  fillBox(0, 0, 7, 7, true);
  fillBox(1, 1, 5, 5, false);
  fillBox(2, 2, 3, 3, true);

  // Finder pattern top-right
  fillBox(n - 7, 0, 7, 7, true);
  fillBox(n - 6, 1, 5, 5, false);
  fillBox(n - 5, 2, 3, 3, true);

  // Finder pattern bottom-left
  fillBox(0, n - 7, 7, 7, true);
  fillBox(1, n - 6, 5, 5, false);
  fillBox(2, n - 5, 3, 3, true);

  // Timing lines
  for (let i = 8; i < n - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Pseudo-random data pattern determinístico baseado no hash do texto
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inFinder = (r < 8 && (c < 8 || c >= n - 8)) || (r >= n - 8 && c < 8);
      if (!inFinder && r !== 6 && c !== 6) {
        grid[r][c] = ((r * 7 + c * 13 + hash) % 3) === 0;
      }
    }
  }

  const cellSize = (size / n).toFixed(2);
  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block;border-radius:3px;">`;
  svg += `<rect width="${size}" height="${size}" fill="#ffffff"/>`;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) {
        svg += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize}" height="${cellSize}" fill="#0f172a"/>`;
      }
    }
  }
  svg += `</svg>`;
  return svg;
}
window.generateMiniQrSvg = generateMiniQrSvg;
