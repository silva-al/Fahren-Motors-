// Módulo WMS: 06-product-images-wms.js
// Fahren Motors - Painel de Gestão WMS

// Gerenciamento de Múltiplas Imagens da Peça
let currentProductImages = [];

function parseProductImages(val) {
  if (!val) return [];
  if (Array.isArray(val)) return Array.from(new Set(val.filter(Boolean).map(s => String(s).trim()).filter(Boolean)));
  val = String(val).trim();
  if (!val) return [];
  if (val.startsWith('[')) {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return Array.from(new Set(arr.filter(Boolean).map(s => String(s).trim()).filter(Boolean)));
    } catch {}
  }
  return Array.from(new Set(val.split(',').map(s => s.trim()).filter(Boolean)));
}

function applyUpdatedProductToState(updatedProduct) {
  if (!updatedProduct || updatedProduct.id === undefined) return;
  const normalizedPhotos = Array.isArray(updatedProduct.photos)
    ? parseProductImages(updatedProduct.photos)
    : parseProductImages(updatedProduct.photoUrl || updatedProduct.photo_url || '');
  const normalizedPhotoUrl = normalizedPhotos.length ? normalizedPhotos.join(', ') : null;
  const merged = {
    ...updatedProduct,
    photos: normalizedPhotos,
    photoUrl: normalizedPhotoUrl,
    photo_url: normalizedPhotoUrl,
  };
  const idx = allProducts.findIndex(item => String(item.id) === String(merged.id));
  if (idx >= 0) {
    allProducts[idx] = { ...allProducts[idx], ...merged };
  } else {
    allProducts.unshift(merged);
  }
  try {
    localStorage.setItem('fm_cache_products', JSON.stringify(allProducts));
  } catch (e) {}
  renderProductsTable(allProducts);
  renderCommercialProductsTable(allProducts);
  renderRelatorios();
  updateStockTabsBadges();
  updateDashboardMetrics();
  broadcastSync('PRODUCT_SAVED');
}

async function persistEditingProductPhotos(toastMsg) {
  if (!editingProductId) {
    if (toastMsg) showToast(toastMsg);
    return;
  }
  const targetId = editingProductId;
  const snapshotPhotos = [...currentProductImages];
  const nextPhotoUrl = snapshotPhotos.length ? snapshotPhotos.join(', ') : null;

  // Atualiza estado em memória e cache imediatamente para impedir reversão visual
  const existing = allProducts.find(item => String(item.id) === String(targetId));
  if (existing) {
    applyUpdatedProductToState({
      ...existing,
      photos: snapshotPhotos,
      photoUrl: nextPhotoUrl,
    });
  }

  _pendingPhotoSaveCount += 1;
  try {
    const res = await api('/products/' + targetId, {
      method: 'PUT',
      body: JSON.stringify({
        photoUrl: nextPhotoUrl,
        photos: snapshotPhotos,
      }),
    });
    if (res && res.product) {
      applyUpdatedProductToState(res.product);
    }
    if (toastMsg) showToast(toastMsg);
  } catch (err) {
    console.error('Erro ao persistir fotos da peça:', err);
    showToast(err.message || 'Erro ao salvar alteração de imagem no servidor');
  } finally {
    _pendingPhotoSaveCount = Math.max(0, _pendingPhotoSaveCount - 1);
  }
}

function renderProductPhotoGallery() {
  const previewWrap = document.getElementById('pPhotoPreviewWrap');
  const thumbsGrid = document.getElementById('pPhotoThumbnails');
  const countBadge = document.getElementById('pPhotoPreviewCount');
  const photoInput = document.getElementById('pPhoto');
  
  if (!previewWrap || !thumbsGrid) return;
  
  if (!currentProductImages.length) {
    previewWrap.classList.add('hidden');
    thumbsGrid.innerHTML = '';
    if (photoInput) photoInput.value = '';
    return;
  }
  
  previewWrap.classList.remove('hidden');
  const n = currentProductImages.length;
  if (countBadge) {
    countBadge.textContent = `✓ ${n} ${n === 1 ? 'foto vinculada' : 'fotos vinculadas'} (A 1ª é a capa principal)`;
  }
  if (photoInput) {
    photoInput.value = currentProductImages.join(', ');
  }
  
  thumbsGrid.innerHTML = currentProductImages.map((url, idx) => {
    const isPrimary = idx === 0;
    const cleanName = url.split('/').pop().split('?')[0] || `Foto ${idx + 1}`;
    return `
      <div class="photo-thumb-card ${isPrimary ? 'is-primary' : ''}" data-index="${idx}">
        <div class="photo-thumb-img-wrap" onclick="setPrimaryProductPhoto(${idx})" title="${isPrimary ? 'Capa Principal da Peça' : 'Clique para definir como Foto de Capa'}">
          <img src="${url}" alt="Foto ${idx + 1}" loading="lazy" />
          ${isPrimary ? '<span class="photo-capa-badge">★ CAPA</span>' : `<span class="photo-order-num">#${idx + 1}</span>`}
        </div>
        <div class="photo-thumb-info">
          <span class="photo-thumb-name" title="${cleanName}">${cleanName}</span>
        </div>
        <button type="button" class="btn-thumb-remove" onclick="removeProductPhoto(${idx})" title="Remover esta foto">✕</button>
      </div>
    `;
  }).join('');
}

async function removeProductPhoto(index) {
  if (index >= 0 && index < currentProductImages.length) {
    currentProductImages.splice(index, 1);
    renderProductPhotoGallery();
    await persistEditingProductPhotos('Imagem removida.');
  }
}
window.removeProductPhoto = removeProductPhoto;

async function setPrimaryProductPhoto(index) {
  if (index > 0 && index < currentProductImages.length) {
    const [picked] = currentProductImages.splice(index, 1);
    currentProductImages.unshift(picked);
    renderProductPhotoGallery();
    await persistEditingProductPhotos('Foto definida como capa principal!');
  }
}
window.setPrimaryProductPhoto = setPrimaryProductPhoto;

function clearAllProductPhotos() {
  currentProductImages = [];
  renderProductPhotoGallery();
  const fileInput = document.getElementById('pPhotoFile');
  if (fileInput) fileInput.value = '';
}
window.clearAllProductPhotos = clearAllProductPhotos;

document.getElementById('btnClearAllPhotos')?.addEventListener('click', async () => {
  clearAllProductPhotos();
  await persistEditingProductPhotos('Todas as fotos foram removidas.');
});

function resetProductForm() {
  editingProductId = null;
  const title = document.getElementById('formTitle');
  if (title) title.textContent = 'Cadastrar Nova Peça';
  ['pName', 'pCode', 'pCategory', 'pPrice', 'pStock', 'pLocation', 'pPhoto', 'pDescription', 'pCompatibility'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  clearAllProductPhotos();

  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.classList.add('hidden');
  const saveBtn = document.getElementById('saveProductBtn');
  if (saveBtn) saveBtn.textContent = 'SALVAR PEÇA NO SISTEMA';
  const errEl = document.getElementById('productFormError');
  if (errEl) errEl.classList.add('hidden');
  const msgEl = document.getElementById('productFormMsg');
  if (msgEl) msgEl.classList.add('hidden');

  const panel = document.getElementById('productFormPanel');
  if (panel) panel.classList.remove('hidden');
}

function cancelPieceEdit() {
  resetProductForm();
  switchTab('produtos');
}
window.cancelPieceEdit = cancelPieceEdit;

document.getElementById('cancelEditBtn')?.addEventListener('click', cancelPieceEdit);

// Upload e Anexo de Foto do Produto (Upload de Arquivos Únicos ou Múltiplos)
// Reduz a foto no navegador antes de enviar (máx. 1600px, JPEG ~85%).
// A Vercel recusa envios acima de ~4,5MB e fotos menores carregam mais rápido na loja.
async function comprimirImagem(file, maxLado = 1200, qualidade = 0.78) {
  if (!file || !/^image\/(jpe?g|png|webp)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // PNG transparente vira fundo branco
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualidade));
    if (!blob || (blob.size >= file.size && escala === 1)) return file;
    const nome = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg' });
  } catch (_e) {
    return file;
  }
}

async function enviarUmaImagem(file, campo = 'photos') {
  const compressed = await comprimirImagem(file);
  if (compressed && compressed.size > 5 * 1024 * 1024) {
    throw new Error(`A imagem "${file?.name || 'selecionada'}" excede 5MB mesmo após compressão.`);
  }
  const formData = new FormData();
  formData.append(campo, compressed);
  const res = await fetch('/api/uploads', { method: 'POST', credentials: 'include', body: formData });
  let data = {};
  try { data = await res.json(); } catch (_e) { /* resposta não-JSON */ }
  if (!res.ok) {
    throw new Error(data.error || (res.status === 413 ? 'Imagem grande demais para enviar.' : 'Falha no envio da imagem'));
  }
  return data.urls || (data.url ? [data.url] : []);
}

document.getElementById('pPhotoFile')?.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const btnText = document.getElementById('btnAttachPhotoText');
  const btnLabel = document.getElementById('btnAttachPhoto');
  const originalText = btnText ? btnText.textContent : 'ANEXAR';

  try {
    if (btnText) btnText.textContent = files.length === 1 ? 'Enviando...' : `Enviando (${files.length})...`;
    if (btnLabel) btnLabel.classList.add('is-uploading');

    const newUrls = [];
    const failedFiles = [];
    for (let i = 0; i < files.length; i++) {
      if (btnText && files.length > 1) btnText.textContent = `Enviando ${i + 1}/${files.length}...`;
      try {
        newUrls.push(...(await enviarUmaImagem(files[i], 'photos')));
      } catch (fileErr) {
        console.warn('Falha ao enviar arquivo individual:', fileErr);
        failedFiles.push(fileErr.message || files[i].name);
      }
    }
    if (newUrls.length > 0) {
      newUrls.forEach(url => {
        if (!currentProductImages.includes(url)) {
          currentProductImages.push(url);
        }
      });
      renderProductPhotoGallery();
      const msg = `${newUrls.length} ${newUrls.length === 1 ? 'imagem anexada' : 'imagens anexadas'} com sucesso!`;
      await persistEditingProductPhotos(msg);
    }
    if (failedFiles.length > 0) {
      showToast(failedFiles[0]);
    }
  } catch (err) {
    console.error('Erro no upload de fotos:', err);
    showToast(err.message || 'Erro ao enviar imagens');
  } finally {
    if (btnText) btnText.textContent = originalText;
    if (btnLabel) btnLabel.classList.remove('is-uploading');
    e.target.value = '';
  }
});

// Atualização de prévia ao colar ou digitar a URL da imagem manualmente
document.getElementById('pPhoto')?.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  currentProductImages = parseProductImages(val);
  renderProductPhotoGallery();
});

document.getElementById('saveProductBtn')?.addEventListener('click', async () => {
  const errEl = document.getElementById('productFormError');
  const msgEl = document.getElementById('productFormMsg');
  errEl.classList.add('hidden');
  msgEl.classList.add('hidden');

  const name = document.getElementById('pName').value.trim();
  const code = document.getElementById('pCode').value.trim();
  const category = document.getElementById('pCategory').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value.replace(',', '.'));
  const stockQty = parseInt(document.getElementById('pStock').value, 10);
  const location = (document.getElementById('pLocation')?.value || '').trim();
  const finalPhotos = currentProductImages.length
    ? [...currentProductImages]
    : parseProductImages(document.getElementById('pPhoto')?.value || '');
  const photoUrl = finalPhotos.length ? finalPhotos.join(', ') : null;
  const description = document.getElementById('pDescription').value.trim();
  const compatibility = document.getElementById('pCompatibility').value.trim();

  if (!name || !category || isNaN(price) || isNaN(stockQty)) {
    errEl.textContent = 'Preencha Nome, Categoria, Preço e Estoque.';
    errEl.classList.remove('hidden');
    return;
  }

  const payload = { name, code, category, price, stockQty, location, photoUrl, photos: finalPhotos, description, compatibility, inStock: stockQty > 0 };

  try {
    let savedRes;
    if (editingProductId) {
      savedRes = await api('/products/' + editingProductId, { method: 'PUT', body: JSON.stringify(payload) });
      msgEl.textContent = 'Peça atualizada com sucesso!';
      showToast('Peça atualizada com sucesso!');
    } else {
      savedRes = await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      msgEl.textContent = 'Peça cadastrada com sucesso!';
      showToast('Nova peça cadastrada com sucesso!');
    }
    if (savedRes && savedRes.product) {
      applyUpdatedProductToState(savedRes.product);
    }
    msgEl.classList.remove('hidden');
    const wasEditing = Boolean(editingProductId);
    resetProductForm();
    await refreshAllData();
    broadcastSync('PRODUCT_SAVED');
    showToast(wasEditing ? 'Peça atualizada com sucesso!' : 'Nova peça cadastrada com sucesso!');
    switchTab('produtos');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

async function removeProduct(id) {
  const p = allProducts.find(item => String(item.id) === String(id));
  const name = p ? p.name : 'esta peça';
  if (!confirm(`Tem certeza que deseja excluir "${name}" do catálogo?\n\nEsta operação removerá o item do sistema.`)) return;
  try {
    await api('/products/' + id, { method: 'DELETE' });
    // Remove localmente de imediato para não reaparecer na tela nem no cache
    allProducts = allProducts.filter(item => String(item.id) !== String(id));
    try { localStorage.setItem('fm_cache_products', JSON.stringify(allProducts)); } catch (e) {}
    renderProductsTable(allProducts);
    renderCommercialProductsTable(allProducts);
    updateDashboardMetrics();
    updateStockTabsBadges();
    showToast(`Peça "${name}" excluída com sucesso!`);
    await refreshAllData();
    broadcastSync('PRODUCT_SAVED');
  } catch (err) {
    showToast(err.message || 'Erro ao excluir peça');
  }
}
