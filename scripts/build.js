// Script de build para montar a pasta "dist" para deploy no Vercel.
//
// O Vercel publica a pasta declarada em "outputDirectory": "dist".
// Como a loja fica em public/loja e o painel em public/admin,
// este script junta as duas na estrutura final:
//   dist/            <- conteúdo de public/loja (a loja, na raiz)
//   dist/admin/      <- conteúdo de public/admin (o painel WMS em /admin)
//   dist/uploads/    <- uploads de imagens
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const dist = path.join(raiz, 'dist');

function copiarPasta(origem, destino) {
  if (!fs.existsSync(origem)) {
    console.warn(`Aviso: pasta de origem não encontrada, ignorando: ${origem}`);
    return 0;
  }
  fs.mkdirSync(destino, { recursive: true });
  let total = 0;
  for (const item of fs.readdirSync(origem, { withFileTypes: true })) {
    const de = path.join(origem, item.name);
    const para = path.join(destino, item.name);
    if (item.isDirectory()) {
      total += copiarPasta(de, para);
    } else {
      fs.copyFileSync(de, para);
      total += 1;
    }
  }
  return total;
}

fs.rmSync(dist, { recursive: true, force: true });

const daLoja = copiarPasta(path.join(raiz, 'public', 'loja'), dist);
const doAdmin = copiarPasta(path.join(raiz, 'public', 'admin'), path.join(dist, 'admin'));
const deUploads = copiarPasta(path.join(raiz, 'public', 'uploads'), path.join(dist, 'uploads'));

// Troca o ?v=... dos CSS/JS por um número novo a cada deploy, para o navegador
// baixar sempre a versão mais recente (sem precisar de Ctrl+F5).
const versao = Date.now().toString(36);
for (const html of [path.join(dist, 'index.html'), path.join(dist, 'admin', 'index.html')]) {
  if (!fs.existsSync(html)) continue;
  const conteudo = fs.readFileSync(html, 'utf8').replace(/(\.(?:css|js))\?v=[\w.-]+/g, `$1?v=${versao}`);
  fs.writeFileSync(html, conteudo, 'utf8');
}

console.log(`Build pronto: ${daLoja} arquivos da loja + ${doAdmin} do painel + ${deUploads} uploads em dist/`);

if (daLoja === 0) {
  console.error('ERRO: nenhum arquivo da loja foi copiado. O site sairia vazio.');
  process.exit(1);
}
