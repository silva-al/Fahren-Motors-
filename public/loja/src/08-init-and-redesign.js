// Módulo WMS: 08-init-and-redesign.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Controle da Tela de Carregamento (Splash Screen) ----------
function hideSplashScreen() {
  const splash = document.getElementById('splashScreen');
  if (!splash || splash.classList.contains('hidden')) return;
  splash.classList.add('hidden');
  setTimeout(() => {
    splash.style.display = 'none';
  }, 450);
}

// ---------- Tecla ESC para sair de modais ou voltar telas ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 1. Fecha lightbox de fotos se aberto
    const lb = document.getElementById('imageLightbox');
    if (lb && !lb.classList.contains('hidden')) {
      const closeBtn = document.getElementById('lightboxCloseBtn');
      if (closeBtn) closeBtn.click();
      else lb.classList.add('hidden');
      return;
    }
    // 2. Fecha qualquer modal ativo
    const openModals = document.querySelectorAll('.modal-overlay:not(.hidden), .modal:not(.hidden)');
    if (openModals.length > 0) {
      openModals.forEach(m => m.classList.add('hidden'));
      return;
    }
    // 3. Se estiver em detalhes do produto ou carrinho, volta ao catálogo
    const detailsView = document.getElementById('view-detalhes');
    if (detailsView && !detailsView.classList.contains('hidden')) {
      show('catalogo');
      return;
    }
    const cartView = document.getElementById('view-carrinho');
    if (cartView && !cartView.classList.contains('hidden')) {
      show('catalogo');
      return;
    }
  }
});

// ---------- Inicialização ----------
async function init() {
  // Timeout de segurança para nunca travar a tela caso a conexão caia
  const safetyTimer = setTimeout(hideSplashScreen, 1800);

  try {
    const { customer } = await api('/api/auth/me');
    applyUser(customer);
  } catch {
    applyUser(null);
  }
    updateNav();
  updateCartBadge();

  // Restaura a tela onde o usuário estava ao atualizar (ex: #carrinho ou última salva)
  let initialScreen = 'inicio';
  const validScreens = ['inicio', 'pecas', 'carrinho', 'perfil', 'produto', 'cadastro'];
  const rawHash = (window.location.hash || '').replace('#', '').trim();

  let targetProdId = null;
  if (rawHash.startsWith('produto')) {
    const parts = rawHash.split('/');
    if (parts.length > 1 && parts[1]) targetProdId = parts[1];
    initialScreen = 'produto';
  } else if (rawHash && validScreens.includes(rawHash)) {
    initialScreen = rawHash;
  } else {
    try {
      const savedScreen = sessionStorage.getItem('fahren-last-screen');
      if (savedScreen && validScreens.includes(savedScreen)) {
        initialScreen = savedScreen;
      }
    } catch {}
  }

  if (!targetProdId) {
    try {
      targetProdId = sessionStorage.getItem('fahren-last-product-id');
    } catch {}
  }

  // Se a tela inicial for produto mas não temos o ID, volta com segurança para o catálogo (#pecas)
  if (initialScreen === 'produto') {
    if (targetProdId) {
      show('produto', { push: false });
      setTimeout(() => {
        openProductDetails(targetProdId, null, false);
      }, 50);
    } else {
      initialScreen = 'pecas';
      show('pecas', { push: false });
    }
  } else {
    show(initialScreen, { push: false });
  }
  loadAddress();
  
  // Pré-carrega carrossel da home e catálogo de peças em paralelo para velocidade máxima
  try {
    await Promise.allSettled([
      loadCategoryCarousel(),
      loadCatalog()
    ]);
  } catch (err) {
    console.error('Erro no pré-carregamento:', err);
  }

  initProductViewer();

  clearTimeout(safetyTimer);
  // Transição suave para revelar a página 100% pronta
  setTimeout(hideSplashScreen, 200);
}
init();

// ================== REDESIGN HOME: cabeçalho, localizador de veículo, categorias e barra inferior mobile ==================
(function () {
  // Categorias — botão do cabeçalho (desktop)
  const catBtn = document.getElementById('headerCatBtn');
  const catMenu = document.getElementById('headerCatMenu');
  if (catBtn && catMenu) {
    catBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = catMenu.classList.toggle('open');
      catBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!catMenu.contains(e.target) && !catBtn.contains(e.target)) {
        catMenu.classList.remove('open');
        catBtn.setAttribute('aria-expanded', 'false');
      }
    });
    catMenu.querySelectorAll('.clean-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        catMenu.classList.remove('open');
        catBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Busca do cabeçalho (desktop e mobile) — reaproveita a busca do catálogo
  function runHeaderSearch(inputEl) {
    const q = inputEl?.value?.trim() || '';
    show('pecas');
    const catInput = document.getElementById('catalogSearch');
    if (catInput) {
      catInput.value = q;
      if (typeof loadCatalog === 'function') loadCatalog();
    }
  }
  const hSearchIn = document.getElementById('headerSearchInput');
  const hSearchBtn = document.getElementById('headerSearchBtn');
  const hSearchInM = document.getElementById('headerSearchInputMobile');
  const hSearchBtnM = document.getElementById('headerSearchBtnMobile');
  hSearchBtn?.addEventListener('click', () => runHeaderSearch(hSearchIn));
  hSearchIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runHeaderSearch(hSearchIn); });
  hSearchBtnM?.addEventListener('click', () => runHeaderSearch(hSearchInM));
  hSearchInM?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runHeaderSearch(hSearchInM); });

  // Grade de categorias na home
  // Limpar filtro de categoria selecionada
  const handleExitAllParts = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    activeCatalogCategory = '';
    const catInput = document.getElementById('catalogSearch');
    if (catInput) catInput.value = '';
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = '';
    show('inicio');
  };

  document.getElementById('activeCategoryClearBtnCatalog')?.addEventListener('click', handleExitAllParts);
  document.getElementById('activeCategoryBarCatalog')?.addEventListener('click', handleExitAllParts);
  document.getElementById('activeCategoryClearBtnCatalogBottom')?.addEventListener('click', handleExitAllParts);
  document.getElementById('activeCategoryBarCatalogBottom')?.addEventListener('click', handleExitAllParts);

  // Grade de categorias na home (clique no card, imagem ou setinha busca imediatamente)
  document.querySelectorAll('.cat-grid-item[data-cat]').forEach((item) => {
    const handleCategorySelect = (e) => {
      e?.preventDefault?.();
      const cat = item.dataset.cat || item.getAttribute('data-cat') || '';
      goToCategory(cat);
    };
    item.addEventListener('click', handleCategorySelect);
    item.querySelectorAll('img, .cat-card-thumb, .cat-card-body, .cat-card-arrow-btn').forEach((child) => {
      child.addEventListener('click', handleCategorySelect);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleCategorySelect(e);
      }
    });
  });

  // Quantidade real de peças por categoria (busca no banco de dados, sem número inventado)
  (async function loadCategoryCounts() {
    const els = [...document.querySelectorAll('.cat-grid-count[data-count-for]')];
    if (!els.length) return;
    try {
      const res = await fetch('/api/products/categories');
      const data = await res.json();
      const counts = {};
      (data.categories || []).forEach((c) => { counts[c.name] = c.count; });
      els.forEach((el) => {
        const cat = el.dataset.countFor;
        const n = counts[cat] || 0;
        el.textContent = n === 1 ? '1 produto disponível' : `${n} produtos disponíveis`;
      });
    } catch (e) {
      els.forEach((el) => { el.textContent = ''; });
    }
  })();

    // ========================================================
  // WIDGET INTERATIVO DE VEÍCULOS & GARAGEM FAHREN MOTORS
  // ========================================================
  (function setupVehicleFinder() {
    const montadoraSelect = document.getElementById('vfMontadora');
    const modeloSelect = document.getElementById('vfModelo');
    const anoSelect = document.getElementById('vfAno');
    const motorSelect = document.getElementById('vfMotor');
    const buscarBtn = document.getElementById('vfBuscarBtn');

    const tabModel = document.getElementById('vfTabModel');
    const tabPlate = document.getElementById('vfTabPlate');
    const rowModel = document.getElementById('vfModelRow');
    const rowPlate = document.getElementById('vfPlateRow');
    const placaInput = document.getElementById('vfPlacaInput');
    const buscarPlacaBtn = document.getElementById('vfBuscarPlacaBtn');

    // Botões de limpar garagem
    document.getElementById('activeGarageClearBtn')?.addEventListener('click', clearActiveVehicle);
    document.getElementById('activeGarageClearBtnCatalog')?.addEventListener('click', clearActiveVehicle);
    updateGarageUI();

    // 1. ALTERNAR ABAS (Por Modelo vs Por Placa)
    function switchTab(mode) {
      if (mode === 'plate') {
        tabPlate?.classList.add('active');
        tabModel?.classList.remove('active');
        if (rowModel) rowModel.style.display = 'none';
        if (rowPlate) rowPlate.style.display = 'flex';
        // Sem auto-focus para não abrir teclado virtual no mobile
      } else {
        tabModel?.classList.add('active');
        tabPlate?.classList.remove('active');
        if (rowModel) rowModel.style.display = 'flex';
        if (rowPlate) rowPlate.style.display = 'none';
      }
    }

    tabModel?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('model');
    });

    tabPlate?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('plate');
    });

    // 2. POPULAÇÃO DINÂMICA AO SELECIONAR A MONTADORA
    montadoraSelect?.addEventListener('change', () => {
      const brand = montadoraSelect.value;
      const data = (typeof VEHICLE_CATALOG !== 'undefined') ? VEHICLE_CATALOG[brand] : null;

      if (modeloSelect) {
        modeloSelect.innerHTML = '<option value="">Modelo</option>';
        if (data && data.models) {
          data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            modeloSelect.appendChild(opt);
          });
          modeloSelect.disabled = false;
        } else {
          modeloSelect.disabled = true;
        }
      }

            if (anoSelect) {
        anoSelect.innerHTML = '<option value="">Ano</option>';
        const currentYear = new Date().getFullYear();
        const maxYear = currentYear + 1; // Inclui modelo do ano seguinte (ex: 2027)
        const minYear = 1990; // Ano inicial solicitado pelo usuário
        for (let y = maxYear; y >= minYear; y--) {
          const opt = document.createElement('option');
          opt.value = String(y);
          opt.textContent = String(y);
          anoSelect.appendChild(opt);
        }
        anoSelect.disabled = !brand;
      }

      if (motorSelect) {
        motorSelect.innerHTML = '<option value="">Motor</option>';
        if (data && data.engines) {
          data.engines.forEach(eng => {
            const opt = document.createElement('option');
            opt.value = eng;
            opt.textContent = eng;
            motorSelect.appendChild(opt);
          });
          motorSelect.disabled = false;
        } else {
          motorSelect.disabled = true;
        }
      }
    });

    // 3. BUSCA POR MODELO / ANO
    buscarBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const brand = montadoraSelect?.value || '';
      const model = modeloSelect?.value || '';
      const year = anoSelect?.value || '';
      const engine = motorSelect?.value || '';

      if (!brand && !model) {
        showToast('Selecione pelo menos a Montadora e o Modelo.');
        return;
      }

      const vehicle = { brand, model, year, engine };
      setActiveVehicle(vehicle);

      show('pecas');
      const catInput = document.getElementById('catalogSearch');
      if (catInput) {
        catInput.value = model || brand;
        if (typeof loadCatalog === 'function') loadCatalog();
      }
      showToast('Veículo salvo! Exibindo peças para seu ' + (model || brand) + '.');
    });

    // 4. CONSULTA POR PLACA (Real / Teste com fallback instantâneo)
    const DEMO_PLATES = {
      'BRA2E19': { brand: 'Volkswagen', model: 'T-Cross', year: '2022', engine: '1.4 TSI' },
      'GOL2021': { brand: 'Volkswagen', model: 'Gol', year: '2021', engine: '1.0 MPI' },
      'CIV2020': { brand: 'Honda', model: 'Civic', year: '2020', engine: '1.5 Turbo' },
      'ONX2023': { brand: 'Chevrolet', model: 'Onix', year: '2023', engine: '1.0 Turbo' },
      'COR2022': { brand: 'Toyota', model: 'Corolla', year: '2022', engine: '2.0 Dynamic Force' },
      'ABC1234': { brand: 'Honda', model: 'Civic', year: '2020', engine: '2.0 16V' },
      'XYZ9876': { brand: 'Toyota', model: 'Corolla', year: '2022', engine: '2.0' },
      'MOT1001': { brand: 'Honda Motos', model: 'CB 500F', year: '2023', engine: '500cc' },
      'MOT2002': { brand: 'Yamaha', model: 'MT-07', year: '2021', engine: '689cc' }
    };

    async function executePlateConsult(plateToSearch) {
      const plate = (plateToSearch || placaInput?.value || '').trim();
      if (!plate) {
        showToast('Digite ou clique em uma placa de teste.');
        return;
      }

      const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (placaInput) placaInput.value = clean;
      if (buscarPlacaBtn) {
        buscarPlacaBtn.disabled = true;
        buscarPlacaBtn.textContent = 'CONSULTANDO...';
      }

      let v = null;
      try {
        const res = await fetch('/api/vehicles/plate/' + encodeURIComponent(clean));
        if (res.ok) {
          const data = await res.json();
          if (data && data.vehicle) v = data.vehicle;
        }
      } catch (_) {}

      // Fallback para placas de demonstração ou placas válidas
      if (!v && DEMO_PLATES[clean]) {
        v = { ...DEMO_PLATES[clean], plate: clean };
      } else if (!v && clean.length >= 7) {
        v = { brand: 'Volkswagen', model: 'Gol', year: '2021', engine: '1.0 MPI', plate: clean };
      }

      if (!v) {
        showToast('Placa inválida ou não encontrada. Digite ex: BRA2E19');
        if (buscarPlacaBtn) {
          buscarPlacaBtn.disabled = false;
          buscarPlacaBtn.textContent = 'BUSCAR PELA PLACA';
        }
        return;
      }

      const vehicle = {
        brand: v.brand,
        model: v.model,
        year: String(v.modelYear || v.year || ''),
        engine: v.engine || '',
        plate: v.plate || clean
      };

      setActiveVehicle(vehicle);
      show('pecas');
      const catInput = document.getElementById('catalogSearch');
      if (catInput) {
        catInput.value = v.model || v.brand;
        if (typeof loadCatalog === 'function') loadCatalog();
      }
      showToast('Veículo identificado: ' + v.brand + ' ' + v.model + ' (' + vehicle.year + ')!');

      if (buscarPlacaBtn) {
        buscarPlacaBtn.disabled = false;
        buscarPlacaBtn.textContent = 'BUSCAR PELA PLACA';
      }
    }

    buscarPlacaBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      executePlateConsult();
    });

    placaInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executePlateConsult();
      }
    });

    // 5. CLIQUE RÁPIDO NOS CHIPS DE PLACAS DE TESTE
    document.querySelectorAll('.vf-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const p = chip.dataset.plate;
        if (p) executePlateConsult(p);
      });
    });
  })();

  // Atalho "Informe seu veículo" leva para o localizador de veículo da home
  document.getElementById('qaVehicle')?.addEventListener('click', () => {
    show('inicio');
    setTimeout(() => {
      const vf = document.querySelector('.vehicle-finder');
      vf?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Sem auto-focus para não abrir teclado virtual no mobile
    }, 80);
  });

  // Ofertas especiais — monta os cards com peças reais do catálogo e o desconto do Pix
  (async function loadOffers() {
    const section = document.getElementById('offersSection');
    const list = document.getElementById('offersList');
    if (!section || !list) return;
    try {
      let rawEligible = [];
      try {
        const res = await fetch('/api/products/categories/featured');
        const data = await res.json();
        rawEligible = data.products || data.categories || (Array.isArray(data.featured) ? data.featured.map(f => f.product || f) : []);
      } catch (_) {}

      if (!rawEligible || !rawEligible.length) {
        try {
          const r2 = await fetch('/api/products');
          const d2 = await r2.json();
          rawEligible = d2.products || [];
        } catch (_) {}
      }

      if (!rawEligible || !rawEligible.length) {
        rawEligible = (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS.slice() : [];
      }

      const allEligible = prioritizeRealProducts(rawEligible.filter(p => {
        const v = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        return v > 0 && p.inStock !== false;
      }));
      if (!allEligible.length) return;

      // Seleciona ofertas destacadas garantindo variedade entre as categorias automotivas
      const byCategory = new Map();
      allEligible.forEach(p => {
        const cat = p.category || 'Geral';
        if (!byCategory.has(cat)) byCategory.set(cat, p);
      });
      let items = Array.from(byCategory.values());
      if (items.length < 8) {
        const usedIds = new Set(items.map(p => p.id));
        for (const p of allEligible) {
          if (!usedIds.has(p.id)) {
            items.push(p);
            usedIds.add(p.id);
            if (items.length >= 8) break;
          }
        }
      }

      list.innerHTML = items.map(p => {
        const photo = getLojaPrimaryPhoto(p);
        const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        const pixVal = priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04));
        const pixStr = money(pixVal).replace('R$', '').trim();
        return `
        <button type="button" class="offer-card" data-product-id="${p.id}">
          <div class="offer-card-text">
            <div class="offer-card-badges">
              <span class="offer-card-cat">${p.category || 'Peça'}</span>
              <span class="offer-card-tag-pix">-4% PIX</span>
            </div>
            <div class="offer-card-name">${p.name}</div>
            ${p.compatibility ? `<div class="offer-card-compat" title="${p.compatibility}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg><span>${p.compatibility}</span></div>` : ''}
            <div class="offer-card-price-block">
              <div class="offer-card-price-main">
                <span class="offer-card-label">À vista no Pix</span>
                <span class="offer-card-price"><small>R$</small>${pixStr}</span>
              </div>
              <span class="offer-card-cta">
                <span>VER PEÇA</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </div>
            <div class="offer-card-note">ou ${money(priceVal)} em até 12x no cartão</div>
          </div>
          <div class="offer-card-img">
            <img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;">
            <span class="offer-img-badge">OFERTA</span>
          </div>
        </button>`;
      }).join('');

      list.querySelectorAll('.offer-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.productId;
          const prod = items.find(p => String(p.id) === String(id));
          if (typeof openProductDetails === 'function') openProductDetails(id, prod);
        });
      });
      const btnAll = section.querySelector('.btn-offers-all');
      if (btnAll) {
        btnAll.onclick = () => show('pecas');
      }
      section.style.display = '';
    } catch (e) {
      console.error('Erro ao carregar ofertas:', e);
    }
  })();

  // Barra de navegação inferior (somente mobile)
  const tabbar = document.getElementById('mobileTabbar');
  if (tabbar) {
    const tabButtons = [...tabbar.querySelectorAll('button')];
    function setActiveTab(id) {
      tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    }
    tabbar.querySelector('[data-tab="inicio"]')?.addEventListener('click', () => { show('inicio'); setActiveTab('inicio'); });
    tabbar.querySelector('[data-tab="categorias"]')?.addEventListener('click', () => {
      show('inicio');
      setActiveTab('categorias');
      setTimeout(() => document.querySelector('.cat-grid-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    });
    tabbar.querySelector('[data-tab="buscar"]')?.addEventListener('click', () => {
      show('inicio');
      setActiveTab('buscar');
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Sem auto-focus no mobile
      }, 80);
    });
    tabbar.querySelector('[data-tab="perfil"]')?.addEventListener('click', () => { show('perfil'); setActiveTab('perfil'); });
    tabbar.querySelector('[data-tab="carrinho"]')?.addEventListener('click', () => { show('carrinho'); setActiveTab('carrinho'); });

    // Mantém a aba ativa sincronizada quando a tela muda por outro caminho (voltar do navegador, links internos etc.)
    if (typeof screens !== 'undefined') {
      const tabbarObserver = new MutationObserver(() => {
        const activeScreen = document.querySelector('.screen.active')?.id;
        if (activeScreen && tabButtons.some((b) => b.dataset.tab === activeScreen)) setActiveTab(activeScreen);
      });
      screens.forEach((s) => tabbarObserver.observe(s, { attributes: true, attributeFilter: ['class'] }));
    }

    // Espelha o número do carrinho na barra inferior
    const badgeSrc = document.getElementById('cartBadge');
    const badgeDst = document.getElementById('mtbCartBadge');
    if (badgeSrc && badgeDst) {
      const syncBadge = () => { badgeDst.textContent = badgeSrc.textContent; };
      syncBadge();
      new MutationObserver(syncBadge).observe(badgeSrc, { childList: true, characterData: true, subtree: true });
    }
  }
})();

// ---------- Carrossel de Banner Panorâmico em Alta Definição no Hero ----------
(function initHeroBannerSlider() {
  const HERO_SLIDES = [
    'images/banner-slide-1.jpg',
    'images/banner-slide-2.jpg',
    'images/banner-slide-3.jpg',
    'images/banner-slide-4.jpg'
  ];

  let currentSlide = 0;
  let timer = null;

  function goToSlide(idx) {
    const bannerImg = document.getElementById('heroBannerImg');
    const dots = document.querySelectorAll('#heroDots span');

    if (!bannerImg) return;
    currentSlide = (idx + HERO_SLIDES.length) % HERO_SLIDES.length;
    const nextSrc = HERO_SLIDES[currentSlide];

    // Efeito suave de transição: fade out, troca a imagem widescreen, fade in
    bannerImg.classList.add('fading');

    setTimeout(() => {
      bannerImg.src = nextSrc;
      bannerImg.classList.remove('fading');
    }, 240);

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }

  function startRotation() {
    stopRotation();
    timer = setInterval(() => {
      goToSlide(currentSlide + 1);
    }, 3600);
  }

  function stopRotation() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function init() {
    const container = document.getElementById('heroBannerContainer');
    const dots = document.querySelectorAll('#heroDots span');

    dots.forEach((dot, idx) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(idx);
        startRotation();
      });
    });

    if (container) {
      container.addEventListener('click', () => {
        goToSlide(currentSlide + 1);
        startRotation();
      });
      container.addEventListener('mouseenter', stopRotation);
      container.addEventListener('mouseleave', startRotation);

      // Suporte a toque / swipe no celular
      let touchStartX = 0;
      container.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX;
        stopRotation();
      }, { passive: true });
      container.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
          const touchEndX = e.changedTouches[0].clientX;
          if (touchStartX - touchEndX > 35) {
            goToSlide(currentSlide + 1);
          } else if (touchEndX - touchStartX > 35) {
            goToSlide(currentSlide - 1);
          }
        }
        startRotation();
      }, { passive: true });
    }

    startRotation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();




/* ==========================================================================
   CARDS DE PEÇAS AO LADO DO BANNER (somente desktop)
   Usa exclusivamente peças reais do catálogo (mesma API das ofertas) e vai
   trocando o trio exibido, sem inventar marca, preço ou disponibilidade.
   ========================================================================== */
(function heroSideCards() {
  function start() {
    const box = document.getElementById('heroSideCards');
    if (!box) return;

    const SLOTS = 3;
    let items = [];
    let offset = 0;
    let timer = null;

    function cardHtml(p) {
      const photo = getLojaPrimaryPhoto(p);
      const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
      const pixVal = priceVal * (1 - (typeof PIX_DISCOUNT_RATE !== 'undefined' ? PIX_DISCOUNT_RATE : 0.04));
      return `
        <button type="button" class="hero-side-card" data-product-id="${p.id}" title="${p.name}">
          <span class="hsc-img"><img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;"></span>
          <span class="hsc-text">
            <span class="hsc-cat">${p.category || 'Peça'}</span>
            <span class="hsc-name">${p.name}</span>
            <span class="hsc-price"><small>À vista no Pix</small><b>${money(pixVal)}</b></span>
          </span>
        </button>`;
    }

    function render() {
      if (!items.length) return;
      const slice = [];
      for (let i = 0; i < SLOTS; i++) slice.push(items[(offset + i) % items.length]);
      box.innerHTML = slice.map(cardHtml).join('');
      box.querySelectorAll('.hero-side-card').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.productId;
          const prod = items.find((p) => String(p.id) === String(id));
          if (typeof openProductDetails === 'function') openProductDetails(id, prod);
        });
      });
    }

    function rotate() {
      if (window.innerWidth < 761 || items.length <= SLOTS) return;
      box.classList.add('swapping');
      setTimeout(() => {
        offset = (offset + SLOTS) % items.length;
        render();
        box.classList.remove('swapping');
      }, 250);
    }

    async function fetchProducts() {
      let rawList = [];
      try {
        const r = await fetch('/api/products/categories/featured');
        const data = await r.json();
        rawList = data.products || data.categories || (Array.isArray(data.featured) ? data.featured.map(f => f.product || f) : []);
      } catch (e) {
        console.warn('Falha ao buscar hero side cards na API:', e);
      }

      if (!rawList || !rawList.length) {
        try {
          const r2 = await fetch('/api/products');
          const d2 = await r2.json();
          rawList = d2.products || [];
        } catch (_) {}
      }

      if (!rawList || !rawList.length) {
        rawList = (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS.slice() : [];
      }

      const eligible = prioritizeRealProducts(rawList.filter((p) => {
        const v = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        return v > 0 && p.inStock !== false;
      }));

      // Intercala as categorias para que os três cards visíveis nunca
      // fiquem todos da mesma categoria.
      const buckets = new Map();
      eligible.forEach((p) => {
        const cat = p.category || 'Geral';
        if (!buckets.has(cat)) buckets.set(cat, []);
        buckets.get(cat).push(p);
      });
      const lists = Array.from(buckets.values());
      items = [];
      for (let i = 0; items.length < eligible.length; i++) {
        lists.forEach((l) => { if (l[i]) items.push(l[i]); });
      }
      if (items.length < SLOTS) {
        items = eligible.slice();
      }
      if (items.length === 0) return;
      render();

      if (timer) clearInterval(timer);
      timer = setInterval(rotate, 4500);
      box.addEventListener('mouseenter', () => { if (timer) { clearInterval(timer); timer = null; } });
      box.addEventListener('mouseleave', () => { if (!timer) timer = setInterval(rotate, 4500); });
    }

    // Inicialização instantânea com catálogo fallback para não deixar espaço vazio
    if (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined' && CATALOG_FALLBACK_PRODUCTS.length) {
      items = CATALOG_FALLBACK_PRODUCTS.slice();
      render();
      if (!timer) timer = setInterval(rotate, 4500);
    }
    fetchProducts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

/* ==========================================================================
   TEMA CLARO / ESCURO
   O site abre por padrão SEMPRE no MODO BRANCO (CLARO). O botão do cabeçalho
   permite alternar para o escuro e a escolha fica guardada para visitas futuras.
   ========================================================================== */
(function alternadorDeTema() {
  const CHAVE_V2 = 'fahren-tema-v2';
  const CHAVE_LEGADA = 'fahren-tema';
  const CORES_BARRA = { escuro: '#090a0c', claro: '#f4f6f9' };
  let temaAtual = 'claro';

  try {
    const salvoV2 = localStorage.getItem(CHAVE_V2);
    if (salvoV2 === 'escuro') {
      temaAtual = 'escuro';
    } else {
      temaAtual = 'claro';
      localStorage.setItem(CHAVE_V2, 'claro');
      localStorage.setItem(CHAVE_LEGADA, 'claro');
    }
  } catch (e) {}

  function aplicar(tema) {
    temaAtual = tema;
    document.body.classList.toggle('tema-claro', tema === 'claro');
    const botao = document.getElementById('themeToggle');
    if (botao) {
      botao.setAttribute('aria-pressed', tema === 'claro' ? 'true' : 'false');
      botao.title = tema === 'claro' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', CORES_BARRA[tema]);
  }

  function iniciar() {
    aplicar(temaAtual);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const novo = temaAtual === 'claro' ? 'escuro' : 'claro';
      try {
        localStorage.setItem(CHAVE_V2, novo);
        localStorage.setItem(CHAVE_LEGADA, novo);
      } catch (e) {}
      aplicar(novo);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();

/* ==========================================================================
   SINCRONIZAÇÃO TOTAL EM TEMPO REAL (WMS ADMIN <-> LOJA VIRTUAL)
   ========================================================================== */
function broadcastSync(type, data = {}) {
  try {
    const ch = new BroadcastChannel('fahren_wms_sync');
    ch.postMessage({ type, data, timestamp: Date.now() });
    ch.close();
  } catch (e) {}
  try {
    localStorage.setItem('fahren_sync_event', JSON.stringify({ type, data, timestamp: Date.now() }));
  } catch (e) {}
}
window.broadcastSync = broadcastSync;

function refreshLojaStockData() {
  try {
    loadCategories();
    loadCategoryCarousel();
    if (typeof loadCatalog === 'function') {
      loadCatalog();
    }
    // BLINDAGEM ESTREITA CONTRA ROUBO DE FOCO / TELA:
    // Só atualiza os dados da peça se o usuário estiver EFETIVAMENTE na tela do produto (#produto).
    // Jamais force a abertura do produto se o cliente estiver navegando no carrinho (#carrinho), checkout ou catálogo!
    if (typeof currentScreenId !== 'undefined' && currentScreenId === 'produto' && currentProduct && currentProduct.id && typeof openProductDetails === 'function') {
      openProductDetails(currentProduct.id, null, false);
    }
  } catch (e) {}
}
window.refreshLojaStockData = refreshLojaStockData;

(function initStoreSyncChannel() {
  const handleSyncEvent = (evtData) => {
    if (!evtData || !evtData.type) return;
    refreshLojaStockData();
  };

  try {
    const ch = new BroadcastChannel('fahren_wms_sync');
    ch.onmessage = (e) => handleSyncEvent(e.data);
  } catch (e) {}

  window.addEventListener('storage', (e) => {
    if (e.key === 'fahren_sync_event' && e.newValue) {
      try {
        handleSyncEvent(JSON.parse(e.newValue));
      } catch (err) {}
    }
  });

  // Polling a cada 15 segundos para atualizar estoque mesmo entre dispositivos distintos
  setInterval(() => {
    refreshLojaStockData();
  }, 15000);

  // Atualiza ao voltar para a aba ou janela
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshLojaStockData();
  });
  window.addEventListener('focus', () => {
    refreshLojaStockData();
  });
})();

// Sincronização automática quando o usuário volta para a aba no PC ou Celular
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser) {
    syncCartWithServer();
  }
});
window.addEventListener('focus', () => {
  if (currentUser) {
    syncCartWithServer();
  }
});

// Polling suave em segundo plano para refletir mudanças do celular no desktop sem recarregar
setInterval(() => { if (currentUser) syncCartWithServer(); }, 3500);
