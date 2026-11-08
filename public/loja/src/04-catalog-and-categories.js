// Módulo WMS: 04-catalog-and-categories.js
// Fahren Motors - Painel de Gestão WMS

// ---------- Catálogo com busca avançada ----------
// Foto real da categoria usada quando a peça ainda não tem foto própria cadastrada.
const CATEGORY_IMAGES = {
  'Filtros': 'images/categorias/filtros.jpg',
  'Freios': '/api/uploads/img/24.jpg',
  'Elétrica e ignição': 'images/categorias/eletrica.jpg',
  'Suspensão': '/api/uploads/img/19.jpg',
  'Correias': 'images/categorias/correias.jpg',
  'Sensores e injeção': '/api/uploads/img/28.jpg',
  'Iluminação': 'images/categorias/iluminacao.jpg',
  'Óleos e fluidos': 'images/categorias/oleos.jpg',
};

// Catálogo oficial com peças reais cadastradas no WMS prontas para venda imediata
const CATALOG_FALLBACK_PRODUCTS = [
  {
    id: 3298,
    name: 'BARRA AXIAL ESQUERDA/DIREITA 175MM BRD0288 PERFECT',
    code: 'BRD0288',
    category: 'Suspensão',
    description: 'Barra axial de direção reforçada 175mm Perfect com coifa e porca. Peça pronta para instalação imediata.',
    compatibility: 'Linha automotiva nacional compatível',
    price: 64.87,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/19.jpg, /api/uploads/img/20.jpg',
    photos: ['/api/uploads/img/19.jpg', '/api/uploads/img/20.jpg']
  },
  {
    id: 3299,
    name: 'BARRA AXIAL ESQUERDA/DIREITA GOL/FOX',
    code: '680192',
    category: 'Suspensão',
    description: 'Barra axial de direção para Volkswagen Gol e Fox. Alta precisão e durabilidade certificada.',
    compatibility: 'Volkswagen Gol, Fox, Voyage, Saveiro',
    price: 51.89,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/22.jpg',
    photos: ['/api/uploads/img/22.jpg']
  },
  {
    id: 3300,
    name: 'BUCHA BARRA ESTABILIZADORA DIANTEIRA DIANTEIRA 20MM 2790 SAMPEL',
    code: 'Sampel 2790',
    category: 'Suspensão',
    description: 'Bucha da barra estabilizadora dianteira 20mm Sampel em composto vulcanizado de alta resistência.',
    compatibility: 'Compatibilidade conforme aplicação Sampel 2790',
    price: 44.61,
    stockQty: 2,
    inStock: true,
    photoUrl: '/api/uploads/img/23.jpg',
    photos: ['/api/uploads/img/23.jpg']
  },
  {
    id: 3301,
    name: 'Corpo de borboleta do Renault Duster 2.0',
    code: '20366',
    category: 'Sensores e injeção',
    description: 'Corpo de borboleta TBI eletrônico para Renault Duster 2.0. Peça pronta para venda e envio imediato.',
    compatibility: 'Renault Duster 2.0 16V Hi-Flex',
    price: 759.65,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/28.jpg, /api/uploads/img/29.jpg',
    photos: ['/api/uploads/img/28.jpg', '/api/uploads/img/29.jpg']
  },
  {
    id: 3277,
    name: 'DISCO FREIO DIANTEIRO VENTILADO 266MM 4 FUROS S/ CUBO HF750 HIPPER FREIOS',
    code: 'HF750',
    category: 'Freios',
    description: 'Disco de freio dianteiro ventilado 266mm 4 furos sem cubo Hipper Freios. Excelente dissipação de calor.',
    compatibility: 'Aplicações conforme especificação HF750',
    price: 322.86,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/24.jpg',
    photos: ['/api/uploads/img/24.jpg']
  },
  {
    id: 3278,
    name: 'Fluido de Freio DOT 4  500ml',
    code: 'DOT4-500',
    category: 'Freios',
    description: 'Fluido de freio sintético DOT 4 de alta performance para máxima segurança de frenagem.',
    compatibility: 'Sistemas de freio a disco e tambor padrão DOT 4',
    price: 32.87,
    stockQty: 3,
    inStock: true,
    photoUrl: '/api/uploads/img/25.jpg',
    photos: ['/api/uploads/img/25.jpg']
  },
  {
    id: 3276,
    name: 'Jogo de pastilhas de freio dianteiras Fiat',
    code: '1BP30889AA',
    category: 'Freios',
    description: 'Jogo completo de pastilhas de freio dianteiras para veículos da linha Fiat.',
    compatibility: 'Linha Fiat compatível',
    price: 58.94,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/26.jpg, /api/uploads/img/27.jpg',
    photos: ['/api/uploads/img/26.jpg', '/api/uploads/img/27.jpg']
  },
  {
    id: 3297,
    name: 'PIVO SUSPENSAO DIANTEIRO INFERIOR ESQUERDO/DIREITO PVI1010 PERFECT',
    code: 'pvi1010',
    category: 'Suspensão',
    description: 'Pivô de suspensão dianteiro inferior esquerdo/direito Perfect PVI1010 reforçado.',
    compatibility: 'Linha automotiva nacional compatível',
    price: 49.90,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/16.jpg, /api/uploads/img/17.jpg, /api/uploads/img/18.jpg',
    photos: ['/api/uploads/img/16.jpg', '/api/uploads/img/17.jpg', '/api/uploads/img/18.jpg']
  },
  {
    id: 3296,
    name: 'Terminal de direção Explorer Ranger',
    code: 'N2120',
    category: 'Suspensão',
    description: 'Terminal de direção reforçado para Ford Explorer e Ranger.',
    compatibility: 'Ford Ranger, Explorer',
    price: 106.69,
    stockQty: 2,
    inStock: true,
    photoUrl: '/api/uploads/img/14.jpg, /api/uploads/img/15.jpg',
    photos: ['/api/uploads/img/14.jpg', '/api/uploads/img/15.jpg']
  },
  {
    id: 3255,
    name: 'Terminal de direção Gol',
    code: 'N1027',
    category: 'Suspensão',
    description: 'Terminal de direção articulado para linha Volkswagen Gol.',
    compatibility: 'Volkswagen Gol, Parati, Saveiro, Voyage',
    price: 52.99,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/12.jpg, /api/uploads/img/13.jpg',
    photos: ['/api/uploads/img/12.jpg', '/api/uploads/img/13.jpg']
  },
  {
    id: 3234,
    name: 'Terminal de direção Gol',
    code: 'N183',
    category: 'Suspensão',
    description: 'Terminal de direção para Volkswagen Gol com encaixe cônico de precisão.',
    compatibility: 'Volkswagen Gol, Parati, Saveiro',
    price: 58.37,
    stockQty: 1,
    inStock: true,
    photoUrl: '/api/uploads/img/10.jpg, /api/uploads/img/11.jpg',
    photos: ['/api/uploads/img/10.jpg', '/api/uploads/img/11.jpg']
  }
];

// Função para priorizar no topo da loja peças reais com fotos cadastradas
function prioritizeRealProducts(list) {
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => {
    const aPhoto = a.photoUrl || (Array.isArray(a.photos) ? a.photos[0] : '') || '';
    const bPhoto = b.photoUrl || (Array.isArray(b.photos) ? b.photos[0] : '') || '';
    const aIsReal = aPhoto.includes('/api/uploads/') || aPhoto.includes('/uploads/');
    const bIsReal = bPhoto.includes('/api/uploads/') || bPhoto.includes('/uploads/');
    if (aIsReal && !bIsReal) return -1;
    if (!aIsReal && bIsReal) return 1;
    return 0;
  });
}

function money(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const LOJA_NO_PHOTO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240">' +
      '<rect width="320" height="240" fill="#141821"/>' +
      '<rect x="116" y="64" width="88" height="68" rx="10" fill="none" stroke="#475569" stroke-width="4"/>' +
      '<circle cx="143" cy="88" r="8" fill="#475569"/>' +
      '<path d="M124 122l22-22 18 16 14-12 18 18" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="160" y="164" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="14" font-weight="700">Sem foto cadastrada</text>' +
    '</svg>'
  );
if (typeof window !== 'undefined') {
  window.LOJA_NO_PHOTO_SVG = LOJA_NO_PHOTO_SVG;
}

function extractLojaPhotos(product) {
  if (!product) return [];
  let list = [];
  if (Array.isArray(product.photos) && product.photos.length) {
    list = product.photos;
  } else {
    const raw = (!Array.isArray(product.photos) && product.photos) || product.photoUrl || product.photo_url || '';
    if (!raw) return [];
    const s = String(raw).trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr) && arr.length) list = arr;
      } catch {}
    } else if (s.includes(',')) {
      list = s.split(',');
    } else if (s) {
      list = [s];
    }
  }
  const cleanList = list.map(p => normalizeLojaPhoto(p, '')).filter(Boolean);
  return Array.from(new Set(cleanList));
}

function getLojaPrimaryPhoto(product) {
  const photos = extractLojaPhotos(product);
  return photos.length ? photos[0] : LOJA_NO_PHOTO_SVG;
}

function normalizeLojaPhoto(url, fallback = LOJA_NO_PHOTO_SVG) {
  if (!url) return fallback;
  url = String(url).trim();
  if (url.startsWith('[')) {
    try {
      const arr = JSON.parse(url);
      if (Array.isArray(arr) && arr.length) url = arr[0];
    } catch {}
  } else if (url.includes(',')) {
    url = url.split(',')[0].trim();
  }
  if (!url) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;

  // Garante que imagens locais da loja fiquem relativas ("images/...") para funcionar tanto via http:// quanto via file://
  if (url.startsWith('/loja/images/')) url = url.replace(/^\/loja\//, '');
  else if (url.startsWith('loja/images/')) url = url.replace(/^loja\//, '');
  else if (url.startsWith('/images/')) url = url.replace(/^\//, '');

  // Ajusta uploads quando o usuário abre direto o arquivo via file://
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    if (url.startsWith('/uploads/')) url = '../uploads/' + url.replace(/^\/uploads\//, '');
    else if (url.startsWith('uploads/')) url = '../' + url;
  }

  return url;
}

async function loadCategories() {
  const select = document.getElementById('filterCategory');
  if (!select) return;
  const currentVal = select.value;
  try {
    const data = await api('/api/products/categories');
    const list = data.categories || [];
    select.innerHTML = '<option value="">Todas as categorias</option>';
    list.forEach(item => {
      const name = typeof item === 'string' ? item : item.name;
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    if (currentVal) select.value = currentVal;
    select.dataset.loaded = '1';
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
  }
}

// ---------- Carrossel automático infinito de todas as peças (exclusivo da tela Início) ----------
async function loadCategoryCarousel() {
  const wrap = document.getElementById('categoryCarousel');
  const track = document.getElementById('categoryCarouselTrack');
  if (!track) return;
  try {
    let items = [];
    try {
      const res = await api('/api/products/categories/featured');
      items = res.products || res.categories || (Array.isArray(res.featured) ? res.featured.map(f => f.product || f) : []);
    } catch (e) {
      console.warn('Tentando fallback para carrossel:', e);
    }

    if (!items || !items.length) {
      try {
        const pRes = await api('/api/products');
        items = pRes.products || [];
      } catch (_) {}
    }

    if (!items || !items.length) {
      items = (typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS.slice() : [];
    }

    if (!items.length) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = '';

    const cardHtml = (c, hidden) => {
      const photo = getLojaPrimaryPhoto(c);
      const priceVal = typeof c.price === 'number' ? c.price : (c.price_cents ? c.price_cents / 100 : 0);
      const pixVal = priceVal > 0 ? (priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04))) : 0;
      const installmentVal = priceVal > 0 ? priceVal / 6 : 0;
      return `<div class="card cat-card" data-product-id="${c.id || ''}" data-category="${c.category || ''}"${hidden ? ' aria-hidden="true"' : ''}>
        <div class="cat-card-img-wrap">
          <img alt="${hidden ? '' : c.name}" loading="lazy" src="${photo}" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;">
          ${priceVal > 0 ? `<span class="cat-card-pix-badge">-4% PIX</span>` : ''}
        </div>
        <small class="cat-card-category">${c.category || 'Peça'}</small>
        <b class="cat-card-name" title="${c.name}">${c.name}</b>
        ${c.compatibility ? `<div class="cat-card-compat" title="${c.compatibility}"><span>🚗 ${c.compatibility}</span></div>` : ''}
        <div class="cat-card-price-block">
          <span class="cat-card-pix-label">À vista no Pix</span>
          <div class="cat-card-pix">${priceVal > 0 ? money(pixVal) : 'Disponível'}</div>
          ${priceVal > 0 ? `<div class="cat-card-installment">ou ${money(priceVal)} em até 6x</div>` : ''}
        </div>
        ${c.inStock !== false && priceVal > 0 ? `
        <button type="button" class="cat-card-cart-btn" data-cart-id="${c.id || ''}" aria-label="Adicionar ao carrinho" title="Adicionar ao carrinho">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        </button>` : ''}
      </div>`;
    };

    const cardAllHtml = (hidden) => `
      <div class="card cat-card cat-card-all" data-go-all="1"${hidden ? ' aria-hidden="true"' : ''} title="Ver todas as peças do catálogo">
        <div class="cat-card-all-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
        <b>Ver Todas</b>
        <small>Catálogo completo ›</small>
      </div>`;

    // Itens únicos sem repetições infinitas (cada produto aparece apenas uma vez)
    const uniqueMap = new Map();
    items.forEach(p => {
      if (p && p.id && !uniqueMap.has(String(p.id))) {
        uniqueMap.set(String(p.id), p);
      }
    });
    const baseList = Array.from(uniqueMap.values());

    const htmlContent = baseList.map(c => cardHtml(c, false)).join('') + cardAllHtml(false);
    if (track.__renderSig === htmlContent && track.children.length) return;
    track.__renderSig = htmlContent;
    track.innerHTML = htmlContent;
    track.style.animation = 'none';

    track.querySelectorAll('.cat-card:not(.cat-card-all)').forEach(el => {
      el.onclick = () => {
        const prodId = el.dataset.productId;
        if (prodId) {
          const prodObj = items.find(p => String(p.id) === String(prodId));
          openProductDetails(prodId, prodObj);
        } else {
          goToCategory(el.dataset.category);
        }
      };
    });
    track.querySelectorAll('.cat-card-all').forEach(el => {
      el.onclick = () => show('pecas');
    });
    track.querySelectorAll('.cat-card-cart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prodId = btn.dataset.cartId;
        if (prodId) addToCart(prodId, items, 1, btn);
      });
    });
  } catch (err) {
    console.error('Erro ao carregar carrossel:', err);
  }
}

// ---------- Peças Recomendadas da Mesma Categoria (Grid estático, sem carrossel) ----------
async function loadRecommendedProducts(product) {
  const section = document.getElementById('detailRelatedSection');
  const grid = document.getElementById('detailRecommendedGrid');
  const catNameEl = document.getElementById('detailRelatedCategoryName');
  const seeCatBtn = document.getElementById('detailRelatedSeeCategoryBtn');

  if (!section || !grid) return;

  const categoryName = product?.category || '';
  if (catNameEl) catNameEl.textContent = categoryName || 'Peças Automotivas';
  if (seeCatBtn) {
    seeCatBtn.onclick = () => goToCategory(categoryName);
  }

  grid.innerHTML = '<p style="color:var(--fp-9da2aa);grid-column:1/-1;padding:20px 0">Buscando peças recomendadas...</p>';

  try {
    let items = [];
    if (categoryName) {
      const res = await api('/api/products?category=' + encodeURIComponent(categoryName));
      items = (res.products || []).filter(p => String(p.id) !== String(product.id));
    }

    // Se a mesma categoria tiver poucas opções, busca itens gerais para complementar
    if (items.length < 4) {
      try {
        const altRes = await api('/api/products/categories/featured');
        const rawAlts = altRes.products || altRes.categories || (Array.isArray(altRes.featured) ? altRes.featured.map(f => f.product || f) : []);
        const fallbackAlts = rawAlts.length ? rawAlts : ((typeof CATALOG_FALLBACK_PRODUCTS !== 'undefined') ? CATALOG_FALLBACK_PRODUCTS : []);
        const alts = fallbackAlts.filter(
          p => String(p.id) !== String(product.id) && !items.some(i => String(i.id) === String(p.id))
        );
        items = items.concat(alts);
      } catch (_) {}
    }

    const recommended = items.slice(0, 4);

    if (!recommended.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    grid.innerHTML = recommended.map(p => {
      const photo = getLojaPrimaryPhoto(p);
      const priceVal = typeof p.price === 'number' ? p.price : (p.price_cents ? p.price_cents / 100 : 0);
      const pixVal = priceVal > 0 ? (priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04))) : 0;
      return `
        <div class="fp-rec-card" data-rec-id="${p.id}" role="button" tabindex="0">
          <div class="fp-rec-card-img-wrap">
            <img src="${photo}" alt="${p.name}" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          </div>
          <div class="fp-rec-card-body">
            <span class="fp-rec-card-cat">${p.category || 'Peça'}</span>
            <strong class="fp-rec-card-name" title="${p.name}">${p.name}</strong>
            <div class="cat-card-price-block">
              <span class="cat-card-pix-label">À vista no Pix</span>
              <div class="cat-card-pix">${priceVal > 0 ? money(pixVal) : 'Disponível'}</div>
              ${priceVal > 0 ? `<div class="cat-card-installment">ou ${money(priceVal)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.fp-rec-card').forEach(card => {
      card.onclick = () => {
        const id = card.dataset.recId;
        const target = recommended.find(p => String(p.id) === String(id));
        if (target) {
          openProductDetails(id, target);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      };
    });
  } catch (err) {
    console.error('Erro ao carregar peças recomendadas:', err);
    section.style.display = 'none';
  }
}

function syncHomeCategoryCardPhotos(productsOrCategories) {
  if (!Array.isArray(productsOrCategories)) return;
  const bestPhotoByCat = {};
  productsOrCategories.forEach(item => {
    if (!item) return;
    // Se vier do endpoint /api/products/categories ({ name, photo, hasRealPhoto })
    if (item.name && item.photo && (item.hasRealPhoto || item.photo.includes('/api/uploads/') || item.photo.includes('/uploads/'))) {
      const normName = normalizeCatalogCategory(item.name);
      if (normName && !bestPhotoByCat[normName]) {
        bestPhotoByCat[normName] = normalizeLojaPhoto(item.photo, '');
      }
      return;
    }
    // Se vier de uma lista de produtos
    const cat = normalizeCatalogCategory(item.category || '');
    if (!cat || bestPhotoByCat[cat]) return;
    const photos = extractLojaPhotos(item);
    const firstReal = photos.find(p => p.includes('/api/uploads/') || p.includes('/uploads/'));
    if (firstReal) {
      bestPhotoByCat[cat] = firstReal;
    }
  });

  Object.keys(bestPhotoByCat).forEach(cat => {
    CATEGORY_IMAGES[cat] = bestPhotoByCat[cat];
  });

  document.querySelectorAll('.cat-grid-item[data-cat]').forEach(card => {
    const rawCat = card.dataset.cat || card.getAttribute('data-cat') || '';
    const normCat = normalizeCatalogCategory(rawCat);
    const img = card.querySelector('.cat-card-thumb img');
    if (img && bestPhotoByCat[normCat]) {
      if (img.getAttribute('src') !== bestPhotoByCat[normCat]) {
        img.src = bestPhotoByCat[normCat];
      }
    }
  });
}
if (typeof window !== 'undefined') {
  window.syncHomeCategoryCardPhotos = syncHomeCategoryCardPhotos;
}

async function goToCategory(category) {
  activeCatalogCategory = normalizeCatalogCategory(category);
  try {
    sessionStorage.setItem('fahren-last-category', activeCatalogCategory);
  } catch {}
  const searchInput = document.getElementById('catalogSearch');
  if (searchInput) {
    searchInput.value = '';
  }
  show('pecas', { keepFilter: true });
}


// ==========================================
// CATÁLOGO DE VEÍCULOS & SISTEMA DE GARAGEM
// ==========================================
const VEHICLE_CATALOG = {
  'Volkswagen': {
    models: ['Gol', 'Polo', 'Fox', 'Voyage', 'Saveiro', 'Virtus', 'T-Cross', 'Nivus', 'Jetta', 'Golf', 'Tiguan', 'Amarok'],
    engines: ['1.0 8V Total Flex', '1.0 12V MPI', '1.0 200 TSI', '1.4 250 TSI', '1.6 8V Total Flex', '1.6 16V MSI', '2.0 TSI']
  },
  'Chevrolet': {
    models: ['Onix', 'Prisma', 'Tracker', 'Spin', 'Cruze', 'Celta', 'Corsa', 'Montana', 'S10', 'Astra', 'Vectra'],
    engines: ['1.0 8V VHC / SPE/4', '1.0 Turbo ECOTEC', '1.2 Turbo', '1.4 8V Econoflex', '1.4 Turbo', '1.8 8V Econoflex', '2.8 CTDI Turbo Diesel']
  },
  'Fiat': {
    models: ['Strada', 'Palio', 'Uno', 'Mobi', 'Argo', 'Cronos', 'Toro', 'Siena', 'Punto', 'Fiorino', 'Fastback', 'Pulse'],
    engines: ['1.0 Fire 8V', '1.0 Firefly', '1.0 Turbo T200', '1.3 Firefly', '1.3 Turbo T270', '1.4 Fire', '1.8 E.torQ 16V', '2.0 MultiJet Diesel']
  },
  'Toyota': {
    models: ['Corolla', 'Hilux', 'Etios', 'Yaris', 'Corolla Cross', 'SW4', 'RAV4'],
    engines: ['1.3 16V Dual VVT-i', '1.5 16V Dual VVT-i', '1.8 16V Dual VVT-i / Hybrid', '2.0 16V Dynamic Force', '2.8 Turbo Diesel 1GD']
  },
  'Honda': {
    models: ['Civic', 'Fit', 'City', 'HR-V', 'WR-V', 'CR-V'],
    engines: ['1.4 8V / 16V i-DSI / i-VTEC', '1.5 16V i-VTEC', '1.5 Turbo VTEC', '1.8 16V i-VTEC', '2.0 16V i-VTEC']
  },
  'Hyundai': {
    models: ['HB20', 'HB20S', 'HB20X', 'Creta', 'Tucson', 'i30', 'Santa Fe'],
    engines: ['1.0 12V Kappa', '1.0 Turbo TGDI', '1.6 16V Gamma', '2.0 16V Nu']
  },
  'Ford': {
    models: ['Ka', 'Fiesta', 'EcoSport', 'Focus', 'Ranger', 'Fusion'],
    engines: ['1.0 12V TiVCT 3 Cilindros', '1.5 12V Dragon', '1.5 16V Sigma', '1.6 16V Sigma', '2.0 Duratec', '3.2 Duratorq Diesel']
  },
  'Renault': {
    models: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Oroch', 'Clio', 'Megane'],
    engines: ['1.0 12V SCe 3 Cilindros', '1.6 8V Hi-Flex', '1.6 16V SCe', '2.0 16V F4R', '1.3 TCe Turbo Flex']
  }
};

function getActiveVehicle() {
  try {
    const raw = localStorage.getItem('fahren_selected_vehicle');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setActiveVehicle(vehicle) {
  try {
    localStorage.setItem('fahren_selected_vehicle', JSON.stringify(vehicle));
  } catch {}
  updateGarageUI();
  if (typeof loadCatalog === 'function') loadCatalog();
}

function clearActiveVehicle() {
  try {
    localStorage.removeItem('fahren_selected_vehicle');
  } catch {}

  // 1. Limpa o input de placa
  const placaInput = document.getElementById('vfPlacaInput');
  if (placaInput) placaInput.value = '';

  // 2. Limpa os selects de modelo, ano, motor e montadora
  const montadora = document.getElementById('vfMontadora');
  const modelo = document.getElementById('vfModelo');
  const ano = document.getElementById('vfAno');
  const motor = document.getElementById('vfMotor');
  if (montadora) montadora.value = '';
  if (modelo) {
    modelo.innerHTML = '<option value="">Modelo</option>';
    modelo.disabled = true;
  }
  if (ano) {
    ano.innerHTML = '<option value="">Ano</option>';
    ano.disabled = true;
  }
  if (motor) {
    motor.innerHTML = '<option value="">Motor</option>';
    motor.disabled = true;
  }

  // 3. Limpa o campo de busca do catálogo
  const catInput = document.getElementById('catalogSearch');
  if (catInput) catInput.value = '';

  // 4. Atualiza a barra de garagem (oculta o veículo ativo)
  updateGarageUI();
  if (typeof loadCatalog === 'function') loadCatalog();

  // 5. Navega para a página inicial
  show('inicio');

  // 6. Ativa a aba "Por Placa do Veículo" na página inicial
  const tabPlate = document.getElementById('vfTabPlate');
  const tabModel = document.getElementById('vfTabModel');
  const rowModel = document.getElementById('vfModelRow');
  const rowPlate = document.getElementById('vfPlateRow');
  if (tabPlate && tabModel) {
    tabPlate.classList.add('active');
    tabModel.classList.remove('active');
    if (rowModel) rowModel.style.display = 'flex';
    if (rowPlate) rowPlate.style.display = 'none';
  }

  // 7. Rola suavemente até o localizador de veículo (sem abrir teclado virtual!)
  setTimeout(() => {
    const vf = document.getElementById('vehicleFinderWidget') || document.querySelector('.vehicle-finder');
    vf?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);

  showToast('Filtro limpo! Digite uma placa ou selecione o modelo.');
}

function updateGarageUI() {
  const v = getActiveVehicle();
  const bars = [
    { bar: document.getElementById('activeGarageBar'), title: document.getElementById('activeGarageTitle') },
    { bar: document.getElementById('activeGarageBarCatalog'), title: document.getElementById('activeGarageTitleCatalog') }
  ];

  bars.forEach(({ bar, title }) => {
    if (!bar) return;
    if (v && v.model) {
      bar.style.display = 'flex';
      const text = [v.brand, v.model, v.year, v.engine].filter(Boolean).join(' • ');
      if (title) title.textContent = text;
    } else {
      bar.style.display = 'none';
    }
  });
}

function checkProductCompatibility(product) {
  const v = getActiveVehicle();
  if (!v || !v.model) return null;
  const comp = (product.compatibility || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  const full = comp + ' ' + desc + ' ' + name;
  const model = v.model.toLowerCase();
  const brand = (v.brand || '').toLowerCase();

  if (full.includes('universal') || comp.includes('universal')) {
    return { ok: true, label: 'Aplicação Universal Compatível' };
  }
  if (full.includes(model)) {
    return { ok: true, label: '100% Compatível com seu ' + v.model };
  }
  if (brand && full.includes(brand)) {
    return { ok: true, label: 'Compatível com linha ' + v.brand };
  }
  return { ok: false, label: 'Verificar compatibilidade' };
}

function renderProducts(container, products) {
  // Evita redesenhar a lista (e fazer a página "pular") quando os dados não mudaram
  const renderSig = JSON.stringify(products || []);
  if (container.__renderSig === renderSig && container.children.length) return;
  container.__renderSig = renderSig;
  if (!products.length) {
    container.innerHTML = '<p style="color:var(--fp-9da2aa)">Nenhuma peça encontrada com esses filtros.</p>';
    return;
  }
  container.innerHTML = products.map(p => {
    const photos = extractLojaPhotos(p);
    const hasMultiple = photos.length > 1;
    let photoHtml = '';
    if (hasMultiple) {
      photoHtml = `
        <div class="card-photo-slider" data-card-id="${p.id}" data-current-index="0">
          <img src="${photos[0]}" alt="${p.name}" class="card-photo-img" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />
          <button type="button" class="card-photo-nav-btn card-photo-prev" aria-label="Foto anterior" title="Foto anterior">‹</button>
          <button type="button" class="card-photo-nav-btn card-photo-next" aria-label="Próxima foto" title="Próxima foto">›</button>
          <div class="card-photo-counter">1/${photos.length}</div>
        </div>
      `;
    } else if (photos.length === 1) {
      photoHtml = `<img src="${photos[0]}" alt="${p.name}" class="card-photo-img" loading="lazy" onerror="this.onerror=null; this.src=window.LOJA_NO_PHOTO_SVG;" />`;
    } else {
      photoHtml = `<img src="${LOJA_NO_PHOTO_SVG}" alt="${p.name}" class="card-photo-img is-placeholder" loading="lazy" />`;
    }

    const maxQty = p.stockQty || 99;
    const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
    const pixVal = priceVal > 0 ? (priceVal * (1 - (PIX_DISCOUNT_RATE || 0.04))) : 0;
    return `
    <div class="product" data-product-id="${p.id}">
      <div class="part-photo">${photoHtml}</div>
      <div class="product-info-wrap">
        <b class="product-name" title="${p.name}">${p.name}</b>
        <small class="product-meta">${p.description || p.category || 'Aplicação compatível'}</small>
        <div class="stock">${p.inStock ? '● Disponível' : '○ Fora de estoque'}</div>
      </div>
      <div class="product-price-block">
        <div class="product-pix-row">
          <span class="product-pix-price">${priceVal > 0 ? money(pixVal) : 'Sob Consulta'}</span>
          ${priceVal > 0 ? `
            <span class="product-pix-tag">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px"><path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z"/></svg>
              no Pix
            </span>
            <span class="product-pix-badge">4% OFF</span>
          ` : ''}
        </div>
        ${priceVal > 0 ? `
          <div class="product-alt-price">ou <strong>${money(priceVal)}</strong> em até 12x no cartão</div>
        ` : ''}
      </div>
      <div class="product-bottom-actions">
        ${p.inStock ? `
          <div class="product-qty-row">
            <label class="qty-label">Quantidade:</label>
            <div class="qty-control">
              <button type="button" class="btn-qty-btn p-minus" data-id="${p.id}" aria-label="Diminuir quantidade">−</button>
              <input type="number" class="product-qty-val" data-id="${p.id}" value="1" min="1" max="${maxQty}" readonly />
              <button type="button" class="btn-qty-btn p-plus" data-id="${p.id}" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <button class="btn add-cart-btn" data-id="${p.id}">COLOCAR NO CARRINHO</button>
        ` : `
          <button class="btn" disabled style="opacity:.5;cursor:not-allowed;width:100%">FORA DE ESTOQUE</button>
        `}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.product').forEach(card => {
    const id = card.dataset.productId;
    const input = card.querySelector('.product-qty-val');
    const minus = card.querySelector('.p-minus');
    const plus = card.querySelector('.p-plus');
    const addBtn = card.querySelector('.add-cart-btn');
    const max = parseInt(input?.max, 10) || 99;

    // Navegação de fotos diretamente no card do catálogo quando houver múltiplas imagens
    const sliderWrap = card.querySelector('.card-photo-slider');
    if (sliderWrap) {
      const prodItem = products.find(item => String(item.id) === String(id));
      const cardPhotos = extractLojaPhotos(prodItem);
      if (cardPhotos.length > 1) {
        const imgEl = sliderWrap.querySelector('.card-photo-img');
        const counterEl = sliderWrap.querySelector('.card-photo-counter');
        const btnPrev = sliderWrap.querySelector('.card-photo-prev');
        const btnNext = sliderWrap.querySelector('.card-photo-next');
        let cardIdx = 0;

        const updateCardPhoto = (newIdx) => {
          cardIdx = (newIdx + cardPhotos.length) % cardPhotos.length;
          sliderWrap.dataset.currentIndex = cardIdx;
          if (imgEl) imgEl.src = cardPhotos[cardIdx];
          if (counterEl) counterEl.textContent = `${cardIdx + 1}/${cardPhotos.length}`;
        };

        // Suporte completo a swipe por toque no mobile diretamente no card
        let cardStartX = 0;
        let cardStartY = 0;
        let cardSwiped = false;

        sliderWrap.addEventListener('touchstart', (e) => {
          if (e.touches && e.touches[0]) {
            cardStartX = e.touches[0].clientX;
            cardStartY = e.touches[0].clientY;
            cardSwiped = false;
          }
        }, { passive: true });

        sliderWrap.addEventListener('touchmove', (e) => {
          if (e.touches && e.touches[0]) {
            const diffX = e.touches[0].clientX - cardStartX;
            const diffY = e.touches[0].clientY - cardStartY;
            if (Math.abs(diffX) > 20 && Math.abs(diffX) > Math.abs(diffY)) {
              cardSwiped = true;
            }
          }
        }, { passive: true });

        sliderWrap.addEventListener('touchend', (e) => {
          if (!cardSwiped || !e.changedTouches || !e.changedTouches[0]) return;
          const diffX = e.changedTouches[0].clientX - cardStartX;
          if (diffX < -30) {
            updateCardPhoto(cardIdx + 1);
          } else if (diffX > 30) {
            updateCardPhoto(cardIdx - 1);
          }
        });

        if (btnPrev) {
          btnPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            updateCardPhoto(cardIdx - 1);
          });
          btnPrev.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        }
        if (btnNext) {
          btnNext.addEventListener('click', (e) => {
            e.stopPropagation();
            updateCardPhoto(cardIdx + 1);
          });
          btnNext.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
        }
      }
    }

    // Ao clicar na foto, nome ou card da peça, abre a tela completa com hiper zoom
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-qty-row') || e.target.closest('.add-cart-btn') || e.target.closest('.card-photo-nav-btn') || e.target.closest('button')) {
        return;
      }
      const prod = products.find(p => String(p.id) === String(id));
      openProductDetails(id, prod);
    });

    if (minus && input) {
      minus.onclick = (e) => {
        e.stopPropagation();
        let val = parseInt(input.value, 10) || 1;
        if (val > 1) input.value = val - 1;
      };
    }
    if (plus && input) {
      plus.onclick = (e) => {
        e.stopPropagation();
        let val = parseInt(input.value, 10) || 1;
        if (val < max) input.value = val + 1;
      };
    }
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.stopPropagation();
        const qty = parseInt(input?.value, 10) || 1;
        addToCart(id, products, qty, addBtn);
      };
    }
  });
}
