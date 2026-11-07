// Módulo WMS: 05-product-detail-and-zoom.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Detalhes da Peça e Visualizador de Hiper Zoom 3D ----------
let currentProduct = null;

async function openProductDetails(productId, cachedProduct = null, push = true, opts = {}) {
  let product = null;
  if (productId !== undefined && productId !== null && productId !== '') {
    try {
      const data = await api('/api/products/' + productId);
      if (data && data.product) product = data.product;
    } catch (err) {
      console.warn('Usando cache local da peça após falha na API:', err);
    }
  }
  if (!product) {
    product = cachedProduct;
  }

  if (!product) {
    alert('Não foi possível carregar os dados desta peça no momento.');
    return;
  }

  // MODO SILENCIOSO (sincronização de estoque em segundo plano):
  // atualiza apenas preço/estoque no lugar, sem redesenhar galeria, sem trocar de tela e sem mexer na rolagem.
  if (opts.silent) {
    if (!currentProduct || String(currentProduct.id) !== String(product.id)) return;
    const contentSig = (p) => JSON.stringify([p.name, p.code, p.category, p.description, p.compatibility, extractLojaPhotos(p)]);
    const contentChanged = contentSig(product) !== contentSig(currentProduct);
    const sig = JSON.stringify([product.price, product.inStock, product.stockQty]);
    const oldSig = JSON.stringify([currentProduct.price, currentProduct.inStock, currentProduct.stockQty]);
    if (contentChanged) {
      // Fotos/descrição mudaram no WMS: redesenha a peça (cai no fluxo completo abaixo), sem trocar de tela
      opts = { ...opts, silentFull: true };
    } else {
      currentProduct = product;
      if (sig === oldSig) return;
    const sPrice = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
    const sInStock = product.inStock !== false && (product.stockQty == null || product.stockQty > 0);
    const sMax = sInStock ? (product.stockQty > 0 ? product.stockQty : 99) : 0;
    const pixEl = document.getElementById('detailPixPrice');
    const regEl = document.getElementById('detailPrice');
    const instEl = document.getElementById('detailInstallment');
    if (pixEl) pixEl.textContent = money(sPrice * (1 - (PIX_DISCOUNT_RATE || 0.04)));
    if (regEl) regEl.textContent = money(sPrice);
    if (instEl) instEl.textContent = `em até 12x de ${money(sPrice > 0 ? sPrice / 12 : 0)} sem juros`;
    const specStock = document.getElementById('specStock');
    if (specStock) specStock.textContent = sInStock ? 'Disponível para pronta entrega' : 'Sob consulta';
    const addBtn = document.getElementById('detailAddCartBtn');
    if (addBtn) {
      addBtn.disabled = !sInStock;
      addBtn.style.opacity = sInStock ? '1' : '.5';
      addBtn.style.cursor = sInStock ? 'pointer' : 'not-allowed';
      addBtn.textContent = sInStock ? '🛒 COLOCAR NO CARRINHO' : 'FORA DE ESTOQUE';
    }
    const buyBtn = document.getElementById('detailBuyNowBtn');
    if (buyBtn) {
      buyBtn.disabled = !sInStock;
      buyBtn.style.display = sInStock ? 'inline-block' : 'none';
    }
    const qIn = document.getElementById('detailQtyInput');
    if (qIn) {
      qIn.max = sMax;
      if ((parseInt(qIn.value, 10) || 1) > sMax && sMax > 0) qIn.value = sMax;
    }
    return;
    }
  }

  currentProduct = product;
  const priceVal = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
  const pixPrice = priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04));
  const installmentVal = priceVal > 0 ? (priceVal / 12) : 0;
  const inStock = product.inStock !== false && (product.stockQty == null || product.stockQty > 0);
  const stockQty = product.stockQty || 0;
  const maxQty = inStock ? (stockQty > 0 ? stockQty : 99) : 0;

  // Breadcrumbs e Títulos
  const crumbCat = document.getElementById('detailBreadcrumbCat');
  const crumbName = document.getElementById('detailBreadcrumbName');
  if (crumbCat) crumbCat.textContent = product.category || 'Peças';
  if (crumbName) crumbName.textContent = product.name;

  const catBadge = document.getElementById('detailCategoryBadge');
  const codeBadge = document.getElementById('detailCodeBadge');
  if (catBadge) catBadge.textContent = product.category || 'Geral';
  if (codeBadge) codeBadge.textContent = `Cód: #${product.code || ('FP-00' + product.id)}`;

  const titleEl = document.getElementById('detailTitle');
  const subtitleEl = document.getElementById('detailSubtitle');
  if (titleEl) titleEl.textContent = product.name;
  if (subtitleEl) subtitleEl.textContent = product.description || 'Aplicação compatível e procedência certificada com garantia.';

  // Imagens e Galeria de Fotos (suporte a quantidade ilimitada de imagens)
  const allPhotos = extractLojaPhotos(product);
  const photosToRender = allPhotos.length ? allPhotos : [LOJA_NO_PHOTO_SVG];
  
  const track = document.getElementById('gallerySlidesTrack');
  if (track) {
    track.innerHTML = photosToRender.map((pUrl, idx) => `
      <div class="gallery-slide" data-slide-index="${idx}" style="cursor:zoom-in;">
        <div class="slide-img-wrap" style="cursor:zoom-in;" title="Clique para ver a imagem inteira e dar zoom" onclick="if (typeof openLightbox === 'function') openLightbox();">
          <img ${idx === 0 ? 'id="detailMainImg"' : ''} class="detail-gallery-img" src="${pUrl}" alt="${product.name} - Foto ${idx + 1}" loading="${idx === 0 ? 'eager' : 'lazy'}" draggable="false" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
        </div>
      </div>
    `).join('');
  }

  const dotsRow = document.getElementById('galleryDotsRow');
  if (dotsRow) {
    if (photosToRender.length > 1) {
      dotsRow.innerHTML = photosToRender.map((_, i) => `<span class="g-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('');
      dotsRow.style.display = 'flex';
    } else {
      dotsRow.innerHTML = '';
      dotsRow.style.display = 'none';
    }
  }

  const thumbsRow = document.getElementById('galleryThumbsRow');
  if (thumbsRow) {
    if (photosToRender.length > 1) {
      thumbsRow.innerHTML = photosToRender.map((pUrl, i) => `
        <button type="button" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Ver foto ${i + 1}" title="Foto ${i + 1}">
          <img src="${pUrl}" alt="Miniatura ${i + 1}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
        </button>
      `).join('');
      thumbsRow.style.display = 'flex';
    } else {
      thumbsRow.innerHTML = '';
      thumbsRow.style.display = 'none';
    }
  }

  const prevBtn = document.getElementById('galleryPrevBtn');
  const nextBtn = document.getElementById('galleryNextBtn');
  if (prevBtn && nextBtn) {
    prevBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
  }

  const counterEl = document.getElementById('detailSlideCounter');
  if (counterEl) {
    counterEl.textContent = `1 / ${photosToRender.length}`;
    counterEl.style.display = photosToRender.length > 1 ? 'inline-block' : 'none';
  }

  const lbPrevBtn = document.getElementById('lbPrevBtn');
  const lbNextBtn = document.getElementById('lbNextBtn');
  if (lbPrevBtn && lbNextBtn) {
    lbPrevBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
    lbNextBtn.style.display = photosToRender.length > 1 ? 'flex' : 'none';
  }

  const mainImg = document.getElementById('detailMainImg');
  const lbImg = document.getElementById('lightboxImg');
  const lbTitle = document.getElementById('lightboxTitle');
  if (mainImg) {
    mainImg.src = photosToRender[0];
    mainImg.alt = product.name;
  }
  if (lbImg) lbImg.src = photosToRender[0];
  if (lbTitle) lbTitle.textContent = `${product.name} - Inspeção em Alta Resolução`;

  // Ações de Botões e Estoque
  const addCartBtn = document.getElementById('detailAddCartBtn');
  const buyNowBtn = document.getElementById('detailBuyNowBtn');
  if (addCartBtn) {
    addCartBtn.disabled = !inStock;
    addCartBtn.style.opacity = inStock ? '1' : '.5';
    addCartBtn.style.cursor = inStock ? 'pointer' : 'not-allowed';
    addCartBtn.textContent = inStock ? '🛒 COLOCAR NO CARRINHO' : 'FORA DE ESTOQUE';
  }
  if (buyNowBtn) {
    buyNowBtn.disabled = !inStock;
    buyNowBtn.style.display = inStock ? 'inline-block' : 'none';
  }

  // Preço e Parcelamento
  const pixEl = document.getElementById('detailPixPrice');
  const regEl = document.getElementById('detailPrice');
  const instEl = document.getElementById('detailInstallment');
  if (pixEl) pixEl.textContent = money(pixPrice);
  if (regEl) regEl.textContent = money(priceVal);
  if (instEl) instEl.textContent = `em até 12x de ${money(installmentVal)} sem juros`;

  // Seletor de Quantidade
  const qtyInput = document.getElementById('detailQtyInput');
  const qtySubtotal = document.getElementById('detailQtySubtotal');
  if (qtyInput) {
    qtyInput.value = 1;
    qtyInput.max = maxQty;
  }
  function updateDetailSubtotal() {
    const q = parseInt(qtyInput?.value, 10) || 1;
    if (qtySubtotal) qtySubtotal.textContent = `Total: ${money(priceVal * q)}`;
  }
  updateDetailSubtotal();

  const minusBtn = document.getElementById('detailQtyMinus');
  const plusBtn = document.getElementById('detailQtyPlus');
  if (minusBtn && qtyInput) {
    minusBtn.onclick = () => {
      let q = parseInt(qtyInput.value, 10) || 1;
      if (q > 1) {
        qtyInput.value = q - 1;
        updateDetailSubtotal();
      }
    };
  }
  if (plusBtn && qtyInput) {
    plusBtn.onclick = () => {
      let q = parseInt(qtyInput.value, 10) || 1;
      if (q < maxQty) {
        qtyInput.value = q + 1;
        updateDetailSubtotal();
      }
    };
  }

  // Ações de Carrinho
  if (addCartBtn) {
    addCartBtn.onclick = () => {
      if (!inStock) return;
      const q = parseInt(qtyInput?.value, 10) || 1;
      addToCart(product.id, [product], q, addCartBtn);
    };
  }
  if (buyNowBtn) {
    buyNowBtn.onclick = () => {
      if (!inStock) return;
      const q = parseInt(qtyInput?.value, 10) || 1;
      addToCart(product.id, [product], q, buyNowBtn);
      show('carrinho');
    };
  }

  // Link para WhatsApp com mensagem personalizada
  const waLink = document.getElementById('detailWhatsAppLink');
  if (waLink) {
    const msg = `Olá! Gostaria de tirar uma dúvida sobre a peça ${product.name} (Código: ${product.code || product.id}).`;
    waLink.href = `https://wa.me/5519994755798?text=${encodeURIComponent(msg)}`;
  }

  // Descrição Técnica Completa
  const fullDesc = document.getElementById('detailFullDescription');
  if (fullDesc) {
    fullDesc.innerHTML = `
      <p style="font-size:15px;line-height:1.6;color:var(--fp-e1e4ea)">
        ${product.description ? product.description : `A peça <strong>${product.name}</strong> é desenvolvida atendendo aos mais rigorosos padrões de qualidade e especificações técnicas de montadoras automotivas.`}
      </p>
      <p style="margin-top:12px;color:var(--fp-9da2aa);line-height:1.5">
        Item essencial para o correto funcionamento e durabilidade do veículo. Proporciona alto rendimento, durabilidade prolongada e encaixe preciso de fábrica sem necessidade de adaptações.
      </p>
      <div style="margin-top:16px;padding:12px 14px;background:var(--fp-14171e);border-left:3px solid #ed1c24;border-radius:6px;font-size:13.5px;color:var(--fp-cbd0d8)">
        <strong style="color:var(--fp-fff)">⚠️ Recomendação de Instalação:</strong> Para garantir a segurança e a validade da garantia de 90 dias com Nota Fiscal, a instalação deve ser realizada por um profissional ou centro automotivo especializado.
      </div>
    `;
  }

  const specName = document.getElementById('specName');
  const specCode = document.getElementById('specCode');
  const specCat = document.getElementById('specCategory');
  const specStock = document.getElementById('specStock');
  if (specName) specName.textContent = product.name;
  if (specCode) specCode.textContent = product.code || `#FP-${product.id}`;
  if (specCat) specCat.textContent = product.category || 'Geral';
  if (specStock) specStock.textContent = inStock ? 'Disponível para pronta entrega' : 'Sob consulta';

  // Aplicação e Compatibilidade Veicular Detalhada
  const compatBody = document.getElementById('detailCompatibility');
  if (compatBody) {
    const hasCustomCompat = Boolean(product.compatibility && product.compatibility.trim());
    compatBody.innerHTML = `
      <div class="fp-compat-header" style="margin-bottom:18px">
        <h3 style="font-size:17px;color:var(--fp-fff);margin-bottom:6px;display:flex;align-items:center;gap:8px">
          <span>🚗</span> Aplicação e Veículos Compatíveis
        </h3>
        <p style="color:var(--fp-9da2aa);font-size:13.5px">
          ${hasCustomCompat 
            ? 'Esta peça possui as seguintes aplicações veiculares e modelos compatíveis homologados:'
            : 'Aplicações compatíveis com as linhas de montadoras que utilizam esta especificação:'}
        </p>
      </div>

      <div class="fp-compat-detail-box" style="background:var(--fp-111319);border:1px solid var(--fp-292d37);border-radius:12px;padding:18px;margin-bottom:18px">
        ${hasCustomCompat ? `
          <div style="white-space:pre-line;color:var(--fp-f0f2f5);font-size:14.5px;line-height:1.7;font-weight:500">
            ${product.compatibility.trim()}
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px">
            <div>
              <span style="color:var(--fp-8e949c);font-size:11.5px;text-transform:uppercase;display:block">Referência / Código:</span>
              <strong style="color:var(--fp-fff);font-size:14.5px">${product.code || ('FP-00' + product.id)}</strong>
            </div>
            <div>
              <span style="color:var(--fp-8e949c);font-size:11.5px;text-transform:uppercase;display:block">Sistema do Veículo:</span>
              <strong style="color:var(--fp-fff);font-size:14.5px">${product.category || 'Peças Automotivas'}</strong>
            </div>
            <div>
              <span style="color:var(--fp-8e949c);font-size:11.5px;text-transform:uppercase;display:block">Padrão de Fabricação:</span>
              <strong style="color:#3fb950;font-size:14.5px">Encaixe Original 100% Plug & Play</strong>
            </div>
          </div>
          <p style="margin-top:14px;color:var(--fp-a0a5ae);font-size:13px;border-top:1px solid var(--fp-20242e);padding-top:12px">
            Peça de primeira linha compatível com montadoras que adotam este padrão. Ao cadastrar novas peças ou atualizá-las no painel administrativo, os detalhes de modelos, motorizações e anos compatíveis serão listados aqui.
          </p>
        `}
      </div>

      <div class="fp-compat-cta" style="background:var(--fp-141720);border-left:4px solid #ed1c24;border-radius:8px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <strong style="color:var(--fp-fff);font-size:14px;display:block">Dúvida sobre o chassi, motor ou ano do seu carro?</strong>
          <span style="color:var(--fp-9da2aa);font-size:12.5px">Nossa equipe confirma na hora pelo catálogo técnico da montadora.</span>
        </div>
        <a href="https://wa.me/5519994755798?text=${encodeURIComponent('Olá! Gostaria de confirmar a compatibilidade da peça ' + product.name + ' (Código: ' + (product.code || product.id) + ') com o modelo do meu carro.')}" target="_blank" rel="noopener" style="background:#238636;color:var(--fp-fff);padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:background .15s">
          <span>💬</span> Confirmar no WhatsApp
        </a>
      </div>
    `;
  }

  // Reseta a galeria para a primeira foto SOMENTE se for uma peça diferente da anterior
  const isDifferentProduct = !window.__lastRenderedProdId || String(window.__lastRenderedProdId) !== String(product.id);
  window.__lastRenderedProdId = product.id;
  if (isDifferentProduct) {
    if (typeof window.resetProductGallery === 'function') {
      window.resetProductGallery();
    } else if (typeof window.resetViewer === 'function') {
      window.resetViewer();
    }
  }

  // Atualiza texto de compatibilidade no slide 2 da galeria
  const slideCompat = document.getElementById('slideCompatText');
  if (slideCompat) {
    if (product.compatibility && product.compatibility.trim()) {
      slideCompat.textContent = `Compatível com: ${product.compatibility}`;
    } else {
      slideCompat.textContent = `Compatível com padrão original da montadora para ${product.category || 'este veículo'}. Consulte a tabela completa abaixo.`;
    }
  }

  // Salva no sessionStorage para que F5 / reload nunca perca a peça ativa
  try {
    sessionStorage.setItem('fahren-last-product-id', String(product.id));
  } catch {}

  // Navega para a tela do produto SOMENTE se push for true OU se o usuário já estiver na tela de produto
  if (!opts.silent && (push || (typeof currentScreenId !== 'undefined' && currentScreenId === 'produto'))) {
    show('produto', { push, scrollTop: push === true });
    if (push) {
      window.history.replaceState({ screen: 'produto', depth: navDepth, productId: product.id }, '', '#produto/' + product.id);
    }
    loadRecommendedProducts(product);
  }
}

// Inicializador da Galeria de Fotos e Detalhes Deslizável por Arrastar/Toque
function initProductViewer() {
  const slider = document.getElementById('gallerySlider');
  const track = document.getElementById('gallerySlidesTrack');
  const prevBtn = document.getElementById('galleryPrevBtn');
  const nextBtn = document.getElementById('galleryNextBtn');
  const dotsRow = document.getElementById('galleryDotsRow');
  const thumbsRow = document.getElementById('galleryThumbsRow');
  const counter = document.getElementById('detailSlideCounter');
  const badgeText = document.getElementById('viewerBadgeText');
  const zoomBtn = document.getElementById('galleryZoomBtn');
  const lbPrevBtn = document.getElementById('lbPrevBtn');
  const lbNextBtn = document.getElementById('lbNextBtn');

  if (!slider || !track) return;

  let currentSlide = 0;
  let startX = 0;
  let isDragging = false;

  function updateGallery(index) {
    const slides = track.querySelectorAll('.gallery-slide');
    const total = Math.max(1, slides.length);
    currentSlide = (index + total) % total;
    track.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.25, 1)';
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    const lbImg = document.getElementById('lightboxImg');
    const activeSlideImg = slides[currentSlide]?.querySelector('img');
    if (lbImg && activeSlideImg) {
      lbImg.src = activeSlideImg.src;
    }

    if (counter) {
      counter.textContent = `${currentSlide + 1} / ${total}`;
      counter.style.display = total > 1 ? 'inline-block' : 'none';
    }
    if (dotsRow) {
      dotsRow.querySelectorAll('.g-dot').forEach((d, i) => {
        d.classList.toggle('active', i === currentSlide);
      });
      dotsRow.style.display = total > 1 ? 'flex' : 'none';
    }
    if (thumbsRow) {
      thumbsRow.querySelectorAll('.gallery-thumb').forEach((th, i) => {
        th.classList.toggle('active', i === currentSlide);
      });
      thumbsRow.style.display = total > 1 ? 'flex' : 'none';
    }
    if (prevBtn && nextBtn) {
      prevBtn.style.display = total > 1 ? 'flex' : 'none';
      nextBtn.style.display = total > 1 ? 'flex' : 'none';
    }
    if (lbPrevBtn && lbNextBtn) {
      lbPrevBtn.style.display = total > 1 ? 'flex' : 'none';
      lbNextBtn.style.display = total > 1 ? 'flex' : 'none';
    }

    if (badgeText) {
      if (total > 1) {
        badgeText.textContent = `Foto ${currentSlide + 1} de ${total} • Arraste para navegar`;
      } else {
        badgeText.textContent = 'Inspeção técnica em alta resolução';
      }
    }
  }

  window.updateProductGallery = updateGallery;
  window.resetProductGallery = function() {
    updateGallery(0);
  };
  window.resetViewer = window.resetProductGallery;

  // Gerenciador de Inatividade para ocultar setas de navegação (Modo Imersivo)
  let navBtnsTimer = null;
  function showNavButtonsTemporarily() {
    [prevBtn, nextBtn, lbPrevBtn, lbNextBtn].forEach(b => b?.classList.remove('autohide'));
    if (navBtnsTimer) clearTimeout(navBtnsTimer);
    navBtnsTimer = setTimeout(() => {
      [prevBtn, nextBtn, lbPrevBtn, lbNextBtn].forEach(b => b?.classList.add('autohide'));
    }, 2800);
  }

  // Qualquer interação com o slider ou lightbox exibe as setas temporariamente
  ['mousemove', 'touchstart', 'touchmove', 'click'].forEach(evt => {
    slider?.addEventListener(evt, showNavButtonsTemporarily, { passive: true });
    document.getElementById('detailLightboxModal')?.addEventListener(evt, showNavButtonsTemporarily, { passive: true });
  });
  showNavButtonsTemporarily();

  prevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide - 1 + total) % total);
  });

  nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide + 1) % total);
  });

  dotsRow?.addEventListener('click', (e) => {
    const dot = e.target.closest('.g-dot');
    if (dot && dot.dataset.index != null) {
      updateGallery(parseInt(dot.dataset.index, 10));
    }
  });

  thumbsRow?.addEventListener('click', (e) => {
    const thumb = e.target.closest('.gallery-thumb');
    if (thumb && thumb.dataset.index != null) {
      updateGallery(parseInt(thumb.dataset.index, 10));
    }
  });

  lbPrevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide - 1 + total) % total);
  });

  lbNextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const slides = track.querySelectorAll('.gallery-slide');
    const total = slides.length;
    if (total <= 1) return;
    updateGallery((currentSlide + 1) % total);
  });

  // Touch & Mouse Dragging manual e suave
  function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  }

  let touchMoved = false;
  let touchStartTime = 0;
  let startY = 0;

  function touchStart(e) {
    touchMoved = false;
    touchStartTime = Date.now();
    const slides = track.querySelectorAll('.gallery-slide');
    if (e.touches && e.touches.length > 1) {
      isDragging = false;
      return;
    }
    isDragging = true;
    startX = getPositionX(e);
    startY = e.touches && e.touches[0] ? e.touches[0].clientY : (e.clientY || 0);
    track.style.transition = 'none';
  }

  function touchMove(e) {
    if (!isDragging) return;
    const currentX = getPositionX(e);
    const currentY = e.touches && e.touches[0] ? e.touches[0].clientY : (e.clientY || 0);
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
      touchMoved = true;
    }

    const slides = track.querySelectorAll('.gallery-slide');
    if (slides.length <= 1) return;

    // Se estiver deslizando para os lados, cancela o scroll vertical para resposta imediata
    if (Math.abs(diffX) > Math.abs(diffY) && e.cancelable) {
      e.preventDefault();
    }

    const offset = -currentSlide * slider.offsetWidth + diffX;
    track.style.transform = `translateX(${offset}px)`;
  }

  function touchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    const endX = e.type.includes('mouse') ? e.pageX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : startX);
    const endY = e.type.includes('mouse') ? e.pageY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : startY);
    const diff = endX - startX;
    const diffY = endY - startY;
    const elapsed = Date.now() - touchStartTime;

    // Toque/Clique no Mobile ou Desktop (sem arraste longo): ENTRA IMEDIATAMENTE NA IMAGEM INTEIRA COM ZOOM
    if (!touchMoved && Math.abs(diff) < 14 && Math.abs(diffY) < 14 && elapsed < 650) {
      if (typeof openLightbox === 'function') {
        openLightbox();
        return;
      }
    }

    const slides = track.querySelectorAll('.gallery-slide');
    if (slides.length <= 1) return;

    if (diff < -35) {
      updateGallery((currentSlide + 1) % slides.length);
    } else if (diff > 35) {
      updateGallery((currentSlide - 1 + slides.length) % slides.length);
    } else {
      updateGallery(currentSlide);
    }
  }

  slider.addEventListener('touchstart', touchStart, { passive: true });
  slider.addEventListener('touchmove', touchMove, { passive: false });
  slider.addEventListener('touchend', touchEnd);
  slider.addEventListener('touchcancel', () => {
    isDragging = false;
    updateGallery(currentSlide);
  });

  thumbsRow?.addEventListener('touchstart', (e) => {
    const thumb = e.target.closest('.gallery-thumb');
    if (thumb && thumb.dataset.index != null) {
      updateGallery(parseInt(thumb.dataset.index, 10));
    }
  }, { passive: true });

  slider.addEventListener('mousedown', (e) => {
    touchStart(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (isDragging) touchMove(e);
  });
  window.addEventListener('mouseup', (e) => {
    if (isDragging) touchEnd(e);
  });

  zoomBtn?.addEventListener('click', () => {
    const modal = document.getElementById('detailLightboxModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (typeof window.resetLbPan === 'function') window.resetLbPan();
    }
  });

  // Lightbox Modal para tela cheia com movimentação livre por toque ou mouse
  const modal = document.getElementById('detailLightboxModal');
  const lbOverlay = document.getElementById('lightboxOverlay');
  const lbClose = document.getElementById('lightboxClose');
  const lbImg = document.getElementById('lightboxImg');
  const lbViewport = document.getElementById('lightboxViewport');
  const lbZoomIn = document.getElementById('lbZoomIn');
  const lbZoomOut = document.getElementById('lbZoomOut');
  const lbResetPan = document.getElementById('lbResetPan');
  const lbZoomLevel = document.getElementById('lbZoomLevel');

  let lbScale = 1.0;
  let lbPanX = 0;
  let lbPanY = 0;
  let targetScale = 1.0;
  let targetPanX = 0;
  let targetPanY = 0;
  let isZoomAnimating = false;
  let lbDragging = false;
  let lbStartX = 0;
  let lbStartY = 0;
  let initialPinchDist = 0;
  let initialPinchScale = 1.0;
  let lastTapTime = 0;

  function updateLbTransform() {
    if (lbImg) {
      lbImg.style.transform = `translate3d(${lbPanX}px, ${lbPanY}px, 0px) scale(${lbScale})`;
    }
    if (lbZoomLevel) {
      lbZoomLevel.textContent = `${lbScale.toFixed(1)}x`;
    }
  }

  function syncZoomTargets() {
    targetScale = lbScale;
    targetPanX = lbPanX;
    targetPanY = lbPanY;
    isZoomAnimating = false;
  }

  // Loop de animação contínua (Lerp 60/120 FPS) para zoom fluido sem travamento
  function runZoomSpringLoop() {
    if (!isZoomAnimating) return;

    const lerpFactor = 0.22;
    const dScale = targetScale - lbScale;
    const dPanX = targetPanX - lbPanX;
    const dPanY = targetPanY - lbPanY;

    if (Math.abs(dScale) < 0.001 && Math.abs(dPanX) < 0.2 && Math.abs(dPanY) < 0.2) {
      lbScale = targetScale;
      lbPanX = targetPanX;
      lbPanY = targetPanY;
      updateLbTransform();
      isZoomAnimating = false;
      return;
    }

    lbScale += dScale * lerpFactor;
    lbPanX += dPanX * lerpFactor;
    lbPanY += dPanY * lerpFactor;
    updateLbTransform();
    requestAnimationFrame(runZoomSpringLoop);
  }

  let isLightboxOpen = false;

  function openLightbox() {
    if (modal) {
      modal.style.display = 'flex';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      lbScale = 1.0;
      lbPanX = 0;
      lbPanY = 0;
      syncZoomTargets();
      updateLbTransform();
      isLightboxOpen = true;
      try {
        const prodId = currentProduct ? currentProduct.id : null;
        window.history.pushState({ modal: 'lightbox', screen: 'produto', productId: prodId, depth: navDepth + 1 }, '');
      } catch (_) {}
    }
  }

  function closeLightbox(fromPopState = false) {
    if (modal) modal.style.display = 'none';
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    lbDragging = false;
    isZoomAnimating = false;
    lbViewport?.classList.remove('is-dragging');

    if (isLightboxOpen) {
      isLightboxOpen = false;
      // Ao fechar pelo botão X ou overlay (sem popstate), remove o estado modal: 'lightbox'
      // com replaceState garantindo que o usuário PERMANEÇA na tela do produto e NUNCA vá para a tela inicial!
      if (!fromPopState && window.history.state && window.history.state.modal === 'lightbox') {
        try {
          const prodId = currentProduct ? currentProduct.id : null;
          window.history.replaceState({ screen: 'produto', depth: navDepth, productId: prodId }, '', prodId ? ('#produto/' + prodId) : '#pecas');
        } catch (_) {}
      }
    }
  }

  // Zoom contínuo ultra-fluido e instantâneo (0ms delay) com a rodinha do mouse (Desktop)
  let lbRafPending = false;
  const handleLbWheelZoom = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomStep = 1.18;
    const prevScale = lbScale;
    let newScale = e.deltaY < 0 ? (prevScale * zoomStep) : (prevScale / zoomStep);
    newScale = Math.min(6.0, Math.max(1.0, newScale));

    if (newScale === prevScale) return;

    if (newScale <= 1.01) {
      lbScale = 1.0;
      lbPanX = 0;
      lbPanY = 0;
    } else if (lbViewport) {
      const rect = lbViewport.getBoundingClientRect();
      const originX = e.clientX - rect.left - rect.width / 2;
      const originY = e.clientY - rect.top - rect.height / 2;
      const k = 1 - (newScale / prevScale);
      lbPanX += (originX - lbPanX) * k;
      lbPanY += (originY - lbPanY) * k;
      lbScale = newScale;
    } else {
      lbScale = newScale;
    }

    syncZoomTargets();
    updateLbTransform();
  };

  modal?.addEventListener('wheel', handleLbWheelZoom, { passive: false });

  // Duplo clique rápido no Lightbox para alternar zoom instantâneo (1.0x <-> 2.5x)
  lbViewport?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (lbScale > 1.2) {
      lbScale = 1.0;
      lbPanX = 0;
      lbPanY = 0;
    } else {
      const rect = lbViewport.getBoundingClientRect();
      const originX = e.clientX - rect.left - rect.width / 2;
      const originY = e.clientY - rect.top - rect.height / 2;
      const newScale = 2.5;
      const k = 1 - newScale;
      lbPanX = originX * k;
      lbPanY = originY * k;
      lbScale = newScale;
    }
    syncZoomTargets();
    updateLbTransform();
  });

  // Swipe para navegar fotos no Lightbox em tela cheia no mobile
  let lbTouchStartX = 0;
  let lbTouchStartY = 0;
  let lbTouchSwiped = false;

  lbViewport?.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1 && lbScale <= 1.05) {
      lbTouchStartX = e.touches[0].clientX;
      lbTouchStartY = e.touches[0].clientY;
      lbTouchSwiped = false;
    }
  }, { passive: true });

  lbViewport?.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length === 1 && lbScale <= 1.05) {
      const diffX = e.touches[0].clientX - lbTouchStartX;
      const diffY = e.touches[0].clientY - lbTouchStartY;
      if (Math.abs(diffX) > 20 && Math.abs(diffX) > Math.abs(diffY)) {
        lbTouchSwiped = true;
      }
    }
  }, { passive: true });

  lbViewport?.addEventListener('touchend', (e) => {
    if (!lbTouchSwiped || lbScale > 1.05 || !e.changedTouches || !e.changedTouches[0]) return;
    const diffX = e.changedTouches[0].clientX - lbTouchStartX;
    const trackEl = document.getElementById('gallerySlidesTrack');
    const totalSlides = trackEl ? trackEl.querySelectorAll('.gallery-slide').length : 1;
    if (totalSlides <= 1) return;
    if (diffX < -35) {
      if (typeof window.updateProductGallery === 'function') {
        window.updateProductGallery((currentSlide + 1) % totalSlides);
      }
    } else if (diffX > 35) {
      if (typeof window.updateProductGallery === 'function') {
        window.updateProductGallery((currentSlide - 1 + totalSlides) % totalSlides);
      }
    }
  });

  window.openLightbox = openLightbox;
  window.closeLightbox = closeLightbox;

  document.getElementById('ctrlFullscreen')?.addEventListener('click', openLightbox);
  document.getElementById('galleryZoomBtn')?.addEventListener('click', openLightbox);
  document.getElementById('detailMainImg')?.addEventListener('click', openLightbox);
  document.querySelector('.slide-img-wrap')?.addEventListener('click', openLightbox);

  // Clique na foto principal da galeria abre imediatamente o Lightbox em tela cheia com zoom
  const gallerySliderEl = document.getElementById('gallerySlider');
  if (gallerySliderEl && !gallerySliderEl.__lbBound) {
    gallerySliderEl.__lbBound = true;
    gallerySliderEl.addEventListener('click', (e) => {
      if (e.target.closest('#galleryPrevBtn, #galleryNextBtn, .gallery-nav-btn, .gallery-thumb, #galleryThumbsRow, .g-dot, #galleryDotsRow')) return;
      openLightbox();
    });
  }

  const galleryTrackEl = document.getElementById('gallerySlidesTrack');
  if (galleryTrackEl && !galleryTrackEl.__lbBound) {
    galleryTrackEl.__lbBound = true;
    galleryTrackEl.addEventListener('click', (e) => {
      if (e.target.closest('#galleryPrevBtn, #galleryNextBtn, .gallery-nav-btn')) return;
      openLightbox();
    });
  }
  lbOverlay?.addEventListener('click', () => closeLightbox(false));
  lbClose?.addEventListener('click', () => closeLightbox(false));

  // Controles de Zoom fino de 0.1 em 0.1 (1.0 -> 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 ...)
  lbZoomIn?.addEventListener('click', () => {
    if (lbScale < 5.0) {
      lbScale = Math.min(5.0, Math.round((lbScale + 0.1) * 10) / 10);
      syncZoomTargets();
      updateLbTransform();
    }
  });

  lbZoomOut?.addEventListener('click', () => {
    if (lbScale > 1.0) {
      lbScale = Math.max(1.0, Math.round((lbScale - 0.1) * 10) / 10);
      syncZoomTargets();
      updateLbTransform();
    }
  });

  lbResetPan?.addEventListener('click', () => {
    lbScale = 1.0;
    lbPanX = 0;
    lbPanY = 0;
    syncZoomTargets();
    updateLbTransform();
  });

  // Movimentação livre com Mouse (Desktop)
  if (lbViewport) {
    lbViewport.addEventListener('mousedown', (e) => {
      e.preventDefault();
      syncZoomTargets();
      lbDragging = true;
      lbStartX = e.clientX - lbPanX;
      lbStartY = e.clientY - lbPanY;
      lbViewport.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!lbDragging) return;
      lbPanX = e.clientX - lbStartX;
      lbPanY = e.clientY - lbStartY;
      if (!lbRafPending) {
        lbRafPending = true;
        requestAnimationFrame(() => {
          updateLbTransform();
          lbRafPending = false;
        });
      }
    });

    window.addEventListener('mouseup', () => {
      if (lbDragging) {
        lbDragging = false;
        lbViewport.classList.remove('is-dragging');
      }
    });

    // Zoom a mão com 2 dedos (Pinch-to-zoom) e duplo toque para aproximar/afastar
    lbViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        lbDragging = false;
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchScale = lbScale;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 320) {
          // Duplo toque com a mão: alterna entre 1.0x e 2.0x
          if (lbScale > 1.1) {
            lbScale = 1.0;
            lbPanX = 0;
            lbPanY = 0;
          } else {
            lbScale = 1.5;
          }
          updateLbTransform();
          lastTapTime = 0;
          return;
        }
        lastTapTime = now;
        lbDragging = true;
        lbStartX = e.touches[0].clientX - lbPanX;
        lbStartY = e.touches[0].clientY - lbPanY;
        lbViewport.classList.add('is-dragging');
      }
    }, { passive: true });

    lbViewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const delta = currentDist / initialPinchDist;
        lbScale = Math.min(5.0, Math.max(1.0, Math.round(initialPinchScale * delta * 10) / 10));
        updateLbTransform();
      } else if (e.touches.length === 1 && lbDragging) {
        lbPanX = e.touches[0].clientX - lbStartX;
        lbPanY = e.touches[0].clientY - lbStartY;
        updateLbTransform();
      }
    }, { passive: true });

    lbViewport.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) initialPinchDist = 0;
      if (e.touches.length === 0) {
        lbDragging = false;
        lbViewport.classList.remove('is-dragging');
      }
    });
  }

  // Navegação por Abas
  document.querySelectorAll('.fp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fp-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.fp-tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // Botões de Voltar ao Catálogo — limpa qualquer filtro para mostrar catálogo completo
  document.getElementById('backToCatalogBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const catInput = document.getElementById('catalogSearch');
    if (catInput) catInput.value = '';
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = '';
    show('pecas');
  });
  document.getElementById('crumbCatalogLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const catInput = document.getElementById('catalogSearch');
    if (catInput) catInput.value = '';
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = '';
    show('pecas');
  });
}

let catalogTimer = null;
async function loadCatalog() {
  await loadCategories();
  const container = document.getElementById('catalogResults');
  if (!container) return;

  const catBar = document.getElementById('activeCategoryBarCatalog');
  if (catBar) {
    catBar.style.display = 'flex';
  }
  const catBarBottom = document.getElementById('activeCategoryBarCatalogBottom');
  if (catBarBottom) {
    catBarBottom.style.display = 'flex';
  }

  const params = new URLSearchParams();
  const q = document.getElementById('catalogSearch')?.value.trim();
  const category = activeCatalogCategory || document.getElementById('filterCategory')?.value || '';
  if (q) params.set('q', q);
  if (category) params.set('category', category);

  try {
    let prods = [];
    try {
      const res = await api('/api/products?' + params.toString());
      if (res && Array.isArray(res.products)) prods = res.products;
    } catch (_) {}

    // Se a API estiver offline ou sem retorno, exibe os produtos do catálogo com busca e filtro ativos
    if (!prods.length && typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') {
      const qLower = (q || '').toLowerCase();
      const catLower = (category || '').toLowerCase();
      prods = CATALOG_FALLBACK_PRODUCTS.filter(p => {
        const pCat = (p.category || '').toLowerCase();
        const pName = (p.name || '').toLowerCase();
        const pDesc = (p.description || '').toLowerCase();
        const pComp = (p.compatibility || '').toLowerCase();
        const pCode = (p.code || '').toLowerCase();

        const matchCat = !catLower || pCat === catLower || pCat.includes(catLower) || catLower.includes(pCat);
        const matchQ = !qLower || pName.includes(qLower) || pDesc.includes(qLower) || pComp.includes(qLower) || pCode.includes(qLower) || pCat.includes(qLower);
        return matchCat && matchQ;
      });
    }

    renderProducts(container, prioritizeRealProducts(prods));
  } catch (err) {
    container.__renderSig = null;
    container.innerHTML = `<p style="color:#e06a6a">Não foi possível carregar as peças agora. ${err.message}</p>`;
  }
}
['catalogSearch'].forEach(id => document.getElementById(id)?.addEventListener('input', () => { clearTimeout(catalogTimer); catalogTimer = setTimeout(loadCatalog, 300); }));
document.getElementById('filterCategory')?.addEventListener('change', loadCatalog);
