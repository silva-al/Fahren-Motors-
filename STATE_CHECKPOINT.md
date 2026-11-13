# STATE_CHECKPOINT.md

- **Data/Hora:** 2026-11-13 01:26 (BRT)
- **Último Commit Base:** `e124863` (`fix(wms,loja): corrigir contagem de estoque, filtro estrito de categorias, cadastro de novas categorias e ocultacao automatica de itens ficticios`)

## Resumo das Entregas Recentes
- **Ativar/Desativar Categorias (ex.: Iluminação) entre WMS e Loja:**
  - `server/routes/products.js`: Persistência de `disabled_categories` em `app_meta`, endpoint `PUT /api/products/categories/visibility` (`requireRole('admin')`), e filtro automático em `GET /api/products`, `GET /api/products/categories` e `GET /api/products/categories/featured` (suportando `?includeDisabled=true` para o WMS).
  - `public/admin/index.html`, `public/admin/src/03-data-sync.js`, `public/admin/src/05-products-and-stock.js`: Painel de visibilidade de categorias (`#wmsCategoryVisibilityPanel` / `#wmsCategoryVisibilityBar`) na aba Estoque para desativar/reativar categorias com 1 clique.
  - `public/loja/src/08-init-and-redesign.js`: Ocultação automática dos cards e chips das categorias desativadas na vitrine.
  - `tests/categories-and-real-products.test.js`: Novo teste garantindo ocultação de categoria desativada na loja.
- **Correção de Colunas Cortadas/Overflow no WMS e Modo Tela Cheia (`ESC` / `✕ Voltar`):**
  - `public/admin/admin.css`: Ajuste do layout da sidebar (`.nav-badge`, `.sidebar-nav .nav-item`) para não cortar badges como `Notas Fiscais (NFe)` e `Pedidos`; distribuição responsiva de colunas sem overflow horizontal em `.wms-table`, `.orders-table`, `.estoque-table` e `.wms-mini-table`; estilos de `body.wms-fullscreen-mode` ocupando 100% da tela.
  - `public/admin/index.html` e `public/admin/src/02-navigation-and-screens.js`: Botões `#btnWmsFullscreen` e `#btnWmsExitFullscreen` (`✕ Voltar`) no topo, além de atalho `ESC` para fechar modais, sair da tela cheia ou voltar ao Dashboard.
1. **Correção da Categoria de Fluidos e Limpeza de Imagens Fictícias nos Cards da Home (`server/sync-catalog.js`, `server/catalog-data.js`, `public/loja/src/04-catalog-and-categories.js`, `public/loja/src/08-init-and-redesign.js`)**:
   - Migração única (`migrated_fluido_category_v1`) move produtos de `Fluido de Freio` que estavam em `Freios` para `Óleos e fluidos`, fazendo o card **FLUÍDOS** exibir o produto real e sua foto imediatamente.
   - `syncHomeCategoryCardPhotos(..., { clearFictitious: true })` remove automaticamente imagens fictícias (`images/categorias/...`) de qualquer card de categoria sem foto real, substituindo pelo placeholder neutro até que uma peça real com foto seja cadastrada.
1. **Correção do Bug de Quantidade Zero e Imagens Reais na Loja (`server/routes/products.js`, `public/loja/src/`)**:
   - Corrigida a detecção de fotos reais para aceitar URLs do Supabase Storage (`https://...`), URLs externas e uploads locais (`/api/uploads/...`, `/uploads/...`), além de peças reais cadastradas no WMS sem foto ainda.
   - Corrigida a contagem de produtos disponíveis por categoria (`/api/products/categories`) com normalização de nomes (ex: `Ignição` -> `Elétrica e ignição`), evitando que aparecesse `0 produtos disponíveis` após editar quantidade e imagem no WMS.
2. **Remoção Automática de Peças/Imagens Fictícias e Exclusão Definitiva (`server/sync-catalog.js`, `server/routes/products.js`, `public/loja/src/`)**:
   - Quando há peças reais cadastradas no WMS, os itens e imagens fictícias de teste (`images/produtos/...`, `images/categorias/...`) são ocultados automaticamente e dão espaço às peças reais.
   - `syncCatalog()` agora registra `catalog_seeded` na tabela `app_meta`, garantindo que peças de teste excluídas pelo usuário nunca sejam reinseridas automaticamente.
   - `CATALOG_FALLBACK_PRODUCTS` agora só é usado se a API estiver offline (erro de rede), nunca quando a API retorna lista vazia (`[]`).
3. **Filtro Estrito de Categorias e Cadastro/Seleção de Novas Categorias (`public/admin/index.html`, `public/admin/src/`, `public/loja/src/`)**:
   - Corrigido o filtro por categoria (`GET /api/products?category=...` e `loadCatalog` / `loadRecommendedProducts`) para nunca misturar peças de outras categorias (ex: ao entrar em `Ignição`).
   - Adicionado seletor de categorias (`#pCategorySelect`) no formulário de cadastro/edição do WMS com todas as categorias padrão e opção `+ Adicionar nova categoria...`.
   - Categorias customizadas criadas no WMS agora aparecem automaticamente na grade de categorias da Home e no menu `Categorias` do cabeçalho da loja.

## Arquivos Alterados
- `server/sync-catalog.js`
- `server/routes/products.js`
- `public/admin/index.html`
- `public/admin/src/05-products-and-stock.js`
- `public/admin/src/06-product-images-wms.js`
- `public/admin/admin.js`
- `public/loja/src/04-catalog-and-categories.js`
- `public/loja/src/05-product-detail-and-zoom.js`
- `public/loja/src/08-init-and-redesign.js`
- `public/loja/loja.js`
- `dist/*` (build atualizado)
- `tests/categories-and-real-products.test.js`

## Próximos Passos / Pendências
- Validar em produção (Netlify/Vercel + Supabase) após deploy.

