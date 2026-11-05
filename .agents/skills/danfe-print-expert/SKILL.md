---
name: danfe-print-expert
description: Especialista em layout, padronização SEFAZ e impressão 100% confiável de DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) e DACCE em HTML/CSS para navegadores e PDFs.
---

# DANFE Print Expert — Padrão SEFAZ e Impressão Confiável no Navegador

Esta skill reúne as regras, padrões e correções para renderização e impressão de documentos fiscais brasileiros (DANFE Mod. 55 e DACCE) em navegadores web sem cortes e sem páginas em branco.

## 1. O Problema da Página em Branco na Impressão do Chrome / Edge

### Causa Raiz
Quando uma aplicação web abre um modal (ex: `.modal-overlay` com `overflow-y: auto`, `position: fixed`, ou `transform`) e o usuário rola o conteúdo para baixo:
1. O motor de renderização do Chromium preserva o deslocamento de scroll (`scrollTop > 0`) no momento de gerar a árvore de impressão (`@media print`).
2. Se o documento estiver dentro de um container com scroll ou modais irmãos, a parte superior da folha A4 (Canhoto, Emitente, Chave de Acesso) é jogada para fora da margem superior ou ocultada, deixando a página 1 completamente em branco e começando apenas na metade do documento (ex: a partir de `TRANSPORTADOR / VOLUMES TRANSPORTADOS`).
3. Regras globais de `@media print` como `body > *:not(#modal) { display: none }` colidem se popups ou janelas abertas utilizarem outra estrutura DOM.

### Solução Definitiva: Impressão Isolada via Iframe Oculto
A técnica recomendada e à prova de falhas para sistemas ERP/WMS:
- Não utilizar `window.open` (que é frequentemente bloqueado pelo bloqueador de pop-ups do navegador).
- Não depender do estado de scroll da janela principal.
- Criar um elemento `<iframe>` invisível dinâmico na mesma origem.
- Injetar um documento HTML autocontido com as regras puras de `@page { size: A4 portrait; margin: 4mm 5mm; }` e os estilos fiscais compilados.
- Disparar `iframe.contentWindow.print()` após 150-200ms.
- O iframe sempre possui `scrollTop: 0`, ocupa exatamente 1 folha A4 e não sofre interferência do layout ou do modo escuro (Dark Mode) da aplicação.

## 2. Padrões de Layout SEFAZ A4 (Manual de Orientação do Contribuinte)
- **Dimensões:** Folha A4 Retrato (210mm x 297mm).
- **Área Útil Máxima:** 200mm de largura, 280mm a 284mm de altura.
- **Bordas:** `1px solid #000000` contínuo.
- **Tipografia:** Arial / Helvetica / Sans-serif.
  - Rótulos dos campos: 5pt a 6pt (caixa alta, negrito leve ou regular).
  - Valores dos campos: 7.5pt a 9pt (caixa alta, negrito 700 ou 800).
  - Título DANFE: 12pt a 14pt negrito.
- **Canhoto:** Margem superior de 15mm a 18mm com picote (`border-bottom: 1px dashed #000`).
- **Código de Barras:** Padrão Code 128C oficial SEFAZ contendo os 44 dígitos da chave de acesso.
- **Tabela de Itens:** `page-break-inside: avoid` por linha quando documento de 1 página.

## 3. Checklist de Auditoria Fiscal no Código
1. [ ] A folha possui `background: #ffffff !important` e cores `#000000 !important`.
2. [ ] Sem sombras (`box-shadow: none`), sem bordas arredondadas (`border-radius: 0`).
3. [ ] Marca d'água (`.nf-watermark-overlay`) oculta na impressão oficial (`display: none !important`).
4. [ ] Sem elementos de navegação, botões de ação ou modais visíveis.
5. [ ] Altura total contida em no máximo 282mm para garantir 1 única página A4 no PDF.

