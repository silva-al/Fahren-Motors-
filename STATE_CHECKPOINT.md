# STATE_CHECKPOINT.md

- **Data/Hora:** 2026-11-13 01:08 (BRT)
- **Último Commit Base:** `f01b5a4` (`fix(loja): blindar retorno de categoria no botao voltar nativo do celular e preservar filtro ativo`)

## Resumo das Entregas Recentes
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
