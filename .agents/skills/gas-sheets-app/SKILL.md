---
name: gas-sheets-app
description: >-
  Guia completo de boas práticas, padrões de desenvolvimento e resolução de bugs
  para Google Apps Script (GAS) integrado ao Google Sheets e Web Apps HTML/JS.
  Use esta skill ao criar, depurar ou alterar scripts GAS, sincronização de estoque,
  apontamento de avarias/vencidos ou rotinas de exclusão e auditoria em planilhas.
---

# Google Apps Script & Google Sheets Web App Patterns

Este documento estabelece as regras técnicas, padrões de código e armadilhas comuns no desenvolvimento de backends com Google Apps Script e planilhas Google Sheets integradas a Web Apps mobile.

---

## 1. Comparação e Busca de Itens (Códigos de Barras e IDs)

### O Problema:
O Google Sheets frequentemente remove zeros à esquerda de códigos de barras (ex: `0078910003` é armazenado como número `78910003`), ou o usuário cadastra no app com ou sem zeros. Uma comparação estrita de string (`valCod === regCod`) faz a busca e a exclusão falharem silenciosamente.

### Padrão Obrigatório:
Sempre utilize fallback numérico para garantir a correspondência:
```javascript
let valCod = String(data[i][colCod] || "").trim();
let regCod = String(registro.codigo || "").trim();

let codMatch = (valCod === regCod) || 
               (Number(valCod) && Number(regCod) && Number(valCod) === Number(regCod));
```

---

## 2. Exclusão Segura de Linhas (Ordem Reversa)

### O Problema:
Ao deletar linhas em um loop tradicional do início ao fim (`for (let i = 0; i < data.length; i++)`), a chamada `sheet.deleteRow(i + 2)` desloca todas as linhas seguintes para cima. Isso altera a posição das linhas e faz com que registros adjacentes sejam ignorados.

### Padrão Obrigatório:
**SEMPRE** itere o array de dados de trás para frente (`data.length - 1` até `0`):
```javascript
for (let i = data.length - 1; i >= 0; i--) {
  let valCod = String(data[i][colCod] || "").trim();
  let regCod = String(registro.codigo || "").trim();
  let codMatch = (valCod === regCod) || (Number(valCod) && Number(regCod) && Number(valCod) === Number(regCod));

  let valLote = String(data[i][colLote] || "").trim();
  let regLote = String(registro.lote || "").trim();
  let loteMatch = (!regLote || regLote === "--" || valLote === regLote || valLote === "--");

  if (codMatch && loteMatch) {
    sheet.deleteRow(i + 2); // i + 2 compensa cabeçalho (linha 1) e índice base-1
  }
}
```

---

## 3. Prevenção de Erros de Range Vazio (`getLastRow() === 1`)

### O Problema:
Quando uma aba de planilha possui apenas o cabeçalho (`getLastRow() === 1`), a chamada:
```javascript
sheet.getRange(2, 1, sheet.getLastRow() - 1, cols)
```
Tenta buscar `0` linhas (`1 - 1 = 0`), disparando uma exceção fatal do Google Apps Script (`The number of rows in the range must be at least 1`).

### Padrão Obrigatório:
**SEMPRE** proteja a leitura verificando se `getLastRow() > 1`:
```javascript
var lr = sheet.getLastRow();
if (lr > 1) {
  var numCols = Math.max(sheet.getLastColumn(), 10);
  var headers = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  var data = sheet.getRange(2, 1, lr - 1, numCols).getValues();
  // Processamento seguro dos dados...
}
```

---

## 4. Normalização de Cabeçalhos e Nomes de Abas

### O Problema:
Cabeçalhos de planilhas criadas por humanos contêm acentos (`CÓDIGO`, `DESCRIÇÃO`), pontuações (`Nº LOTE`), espaços duplos ou caracteres especiais invisíveis (`\u00A0` - non-breaking space). Comparações ingênuas com `.toUpperCase()` falham.

### Padrão Obrigatório:
Utilize uma função de normalização que decomponha acentos (`NFD`) e elimine espaços extras:
```javascript
function normalizarTexto(s) {
  return String(s === null || s === undefined ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00A0\s]+/g, " ")
    .trim()
    .toUpperCase();
}
```

---

## 5. Mapeamento Estrito de Colunas de Data

### O Problema:
Uma verificação frouxa como `header.indexOf("DATA") === 0` captura tanto a coluna `DATA` (data da auditoria) quanto `DATA DE VALIDADE` (validade do produto), resultando na sobrescrita indevida da data de validade com a data de hoje.

### Padrão Obrigatório:
Separe explicitamente o carimbo de data da conferência da data de validade:
```javascript
let colData = -1;
let colValidade = -1;

for (let c = 0; c < headers.length; c++) {
  let h = normalizarTexto(headers[c]);
  if (h === "DATA" || h === "DATA AUDITORIA" || h === "DATA CONFERENCIA") {
    colData = c;
  } else if (h.indexOf("VALID") !== -1 || h.indexOf("VENC") !== -1) {
    colValidade = c;
  }
}
```

---

## 6. Sincronização em Cascata na Exclusão

Ao remover um item auditado através do aplicativo móvel, a exclusão deve ser refletida em todas as abas relacionadas:
1. **AUDITADOS**: Remover o registro do histórico ou desmarcar a flag de auditado.
2. **PRODUTOS / RECEBIMENTO**: Se for um produto novo criado pelo app (`NOVO SABOR` ou `NOVO LOTE`), remover a linha criada com `deleteRow`. Se for um item padrão do estoque, apenas desmarcar o fundo vermelho da descrição (`.setBackground(null).setFontColor(null)`).
3. **VENCIDOS / PRODUTOS VENCIDOS**: Se houver apontamento de item vencido associado àquele código e lote, remover a linha correspondente na aba de vencidos.
4. **Persistência**: Sempre executar `SpreadsheetApp.flush()` ao final para garantir que as alterações sejam gravadas no disco do Google Drive imediatamente.

---

## 7. Integridade de Codificação UTF-8

- Ao salvar ou editar arquivos `.gs`, `.html` ou scripts complementares no Windows, garanta codificação **UTF-8 pura sem BOM**.
- Evite ferramentas de shell padrão que reescrevam arquivos usando codepage do sistema (Windows-1252), pois isso corrompe caracteres acentuados (`ç`, `ã`, `é`, `ó`).
