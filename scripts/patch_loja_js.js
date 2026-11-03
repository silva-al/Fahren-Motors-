const fs = require('fs');
const path = require('path');

const lojaPath = path.join(__dirname, '..', 'public', 'loja', 'loja.js');
let js = fs.readFileSync(lojaPath, 'utf8');

// 1. Em show(id, opts = {}), garantir que ir para 'pecas' limpa qualquer filtro invisível anterior, a menos que keepFilter seja true
const oldShowPecas = "if (id === 'pecas') loadCatalog();";
const newShowPecas = `if (id === 'pecas') {
    if (!opts.keepFilter) {
      const catInput = document.getElementById('catalogSearch');
      if (catInput) catInput.value = '';
      const catSelect = document.getElementById('filterCategory');
      if (catSelect) catSelect.value = '';
    }
    loadCatalog();
  }`;

if (js.includes(oldShowPecas)) {
  js = js.replace(oldShowPecas, newShowPecas);
  console.log('✓ 1. Updated show(id) to reset residual filters when viewing catalog');
} else {
  console.log('Note: oldShowPecas not found or already updated');
}

// 2. Em goToCategory(category), passar { keepFilter: true }
const oldGoToCat = "async function goToCategory(category) {\r\n  show('pecas');";
const oldGoToCatLF = "async function goToCategory(category) {\n  show('pecas');";
const newGoToCat = "async function goToCategory(category) {\r\n  show('pecas', { keepFilter: true });";

if (js.includes(oldGoToCat)) {
  js = js.replace(oldGoToCat, newGoToCat);
  console.log('✓ 2. Updated goToCategory CRLF');
} else if (js.includes(oldGoToCatLF)) {
  js = js.replace(oldGoToCatLF, "async function goToCategory(category) {\n  show('pecas', { keepFilter: true });");
  console.log('✓ 2. Updated goToCategory LF');
} else {
  console.log('Note: goToCategory not found or already updated');
}

// 3. Double-tap no lightbox: ir para 1.5x em vez de pular para 2.0x
if (js.includes("lbScale = 2.0;")) {
  js = js.replace("lbScale = 2.0;", "lbScale = 1.5;");
  console.log('✓ 3. Updated double-tap target to 1.5x in lightbox');
}

fs.writeFileSync(lojaPath, js, 'utf8');
console.log('Done patching loja.js!');
