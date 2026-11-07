// Script de Divisão Modular do Frontend (Fahren Motors)
// Quebra os arquivos monolíticos admin.js e loja.js em módulos desacoplados e organizados.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. Módulos do Painel WMS / Admin
const adminPath = path.join(root, 'public', 'admin', 'admin.js');
const adminSrcDir = path.join(root, 'public', 'admin', 'src');
fs.mkdirSync(adminSrcDir, { recursive: true });

const adminContent = fs.readFileSync(adminPath, 'utf8');
const adminLines = adminContent.split('\n');

// Definição dos cortes baseados nos cabeçalhos lógicos
const adminBreakpoints = [
  { name: '01-state-and-helpers.js', start: 0, endMarker: '// ---------- Controle de Telas' },
  { name: '02-navigation-and-screens.js', startMarker: '// ---------- Controle de Telas', endMarker: '// ---------- Carregamento Global de Dados' },
  { name: '03-data-sync.js', startMarker: '// ---------- Carregamento Global de Dados', endMarker: '// ---------- 1. DASHBOARD WMS' },
  { name: '04-dashboard.js', startMarker: '// ---------- 1. DASHBOARD WMS', endMarker: '// ---------- 2. ESTOQUE & PRODUTOS' },
  { name: '05-products-and-stock.js', startMarker: '// ---------- 2. ESTOQUE & PRODUTOS', endMarker: '// Gerenciamento de Múltiplas Imagens' },
  { name: '06-product-images-wms.js', startMarker: '// Gerenciamento de Múltiplas Imagens', endMarker: '// ---------- 3. PEDIDOS & VENDAS' },
  { name: '07-orders-and-sales.js', startMarker: '// ---------- 3. PEDIDOS & VENDAS', endMarker: '// ---------- 4. EXPEDIÇÃO' },
  { name: '08-expedicao.js', startMarker: '// ---------- 4. EXPEDIÇÃO', endMarker: '// ---------- 5. FINANCEIRO' },
  { name: '09-financeiro.js', startMarker: '// ---------- 5. FINANCEIRO', endMarker: '// ---------- 6. NOTAS FISCAIS & DANFE' },
  { name: '10-fiscal-and-danfe.js', startMarker: '// ---------- 6. NOTAS FISCAIS & DANFE', endMarker: '// ===================================================================\n// ALTERNADOR DE TEMA' },
  { name: '11-theme-and-wms-operations.js', startMarker: '// ===================================================================\n// ALTERNADOR DE TEMA', endMarker: '// -------------------------------------------------------------------\n// 6. ETIQUETA DE PRODUTO' },
  { name: '12-barcode-and-labels.js', startMarker: '// -------------------------------------------------------------------\n// 6. ETIQUETA DE PRODUTO', endMarker: '// ==========================================\n// Gestão de Produtos Comerciais' },
  { name: '13-commercial-and-picking.js', startMarker: '// ==========================================\n// Gestão de Produtos Comerciais', end: adminLines.length },
];

function extractSections(lines, breakpoints, srcDir) {
  let curIndex = 0;
  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    let startIdx = curIndex;
    if (bp.startMarker) {
      const found = lines.findIndex((l, idx) => idx >= curIndex && l.includes(bp.startMarker.split('\n')[0]));
      if (found !== -1) startIdx = found;
    } else if (bp.start !== undefined) {
      startIdx = bp.start;
    }

    let endIdx = lines.length;
    if (bp.endMarker) {
      const found = lines.findIndex((l, idx) => idx > startIdx && l.includes(bp.endMarker.split('\n')[0]));
      if (found !== -1) endIdx = found;
    } else if (bp.end !== undefined) {
      endIdx = bp.end;
    }

    const chunk = lines.slice(startIdx, endIdx).join('\n');
    const targetFile = path.join(srcDir, bp.name);
    fs.writeFileSync(targetFile, `// Módulo WMS: ${bp.name}\n// Fahren Motors - Painel de Gestão WMS\n\n` + chunk.trim() + '\n', 'utf8');
    console.log(`Criado módulo: ${bp.name} (${endIdx - startIdx} linhas)`);
    curIndex = endIdx;
  }
}

console.log('--- Modulando Painel WMS (admin.js) ---');
extractSections(adminLines, adminBreakpoints, adminSrcDir);

// 2. Módulos da Loja do Cliente
const lojaPath = path.join(root, 'public', 'loja', 'loja.js');
const lojaSrcDir = path.join(root, 'public', 'loja', 'src');
fs.mkdirSync(lojaSrcDir, { recursive: true });

const lojaContent = fs.readFileSync(lojaPath, 'utf8');
const lojaLines = lojaContent.split('\n');

const lojaBreakpoints = [
  { name: '01-state-and-api.js', start: 0, endMarker: '// ---------- Navegação ----------' },
  { name: '02-navigation-and-masks.js', startMarker: '// ---------- Navegação ----------', endMarker: '// ---------- Cadastro / login ----------' },
  { name: '03-auth-and-addresses.js', startMarker: '// ---------- Cadastro / login ----------', endMarker: '// ---------- Catálogo com busca avançada ----------' },
  { name: '04-catalog-and-categories.js', startMarker: '// ---------- Catálogo com busca avançada ----------', endMarker: '// ---------- Detalhes da Peça' },
  { name: '05-product-detail-and-zoom.js', startMarker: '// ---------- Detalhes da Peça', endMarker: '// ---------- Pagamento via Pix' },
  { name: '06-payments-pix-and-card.js', startMarker: '// ---------- Pagamento via Pix', endMarker: '// ---------- Carrinho ----------' },
  { name: '07-cart-and-orders.js', startMarker: '// ---------- Carrinho ----------', endMarker: '// ---------- Controle da Tela de Carregamento' },
  { name: '08-init-and-redesign.js', startMarker: '// ---------- Controle da Tela de Carregamento', end: lojaLines.length },
];

console.log('\n--- Modulando Loja do Cliente (loja.js) ---');
extractSections(lojaLines, lojaBreakpoints, lojaSrcDir);

console.log('\nProcesso de modularização concluído com sucesso!');

