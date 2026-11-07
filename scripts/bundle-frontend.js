// Compilador e Empacotador Modular do Frontend (Fahren Motors)
// Junta os módulos desacoplados de public/admin/src e public/loja/src
// nos bundles de produção mantendo total compatibilidade e alta manutenibilidade.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function bundleDir(srcDir, outputFile, appName) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[Bundle] Diretório fonte não encontrado: ${srcDir}`);
    return;
  }

  const files = fs.readdirSync(srcDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  let combined = `/**
 * ${appName} — Bundle Oficial Compilado
 * Gerado automaticamente a partir dos módulos desacoplados em src/
 * Total de módulos compilados: ${files.length}
 * Não edite este arquivo diretamente — faça alterações nos módulos em src/ e rode 'npm run bundle'
 */\n\n`;

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    combined += `\n/* =========================================================================\n * [MÓDULO: ${file}]\n * ========================================================================= */\n`;
    combined += content.trim() + '\n';
  }

  fs.writeFileSync(outputFile, combined, 'utf8');
  console.log(`[Bundle] ${appName}: ${files.length} módulos compilados em ${path.relative(root, outputFile)}`);
}

bundleDir(
  path.join(root, 'public', 'admin', 'src'),
  path.join(root, 'public', 'admin', 'admin.js'),
  'Painel de Gestão WMS (Admin)'
);

bundleDir(
  path.join(root, 'public', 'loja', 'src'),
  path.join(root, 'public', 'loja', 'loja.js'),
  'Loja Virtual do Cliente'
);

