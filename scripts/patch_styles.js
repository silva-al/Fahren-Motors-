const fs = require('fs');
const path = require('path');

const stylesPath = path.join(__dirname, '..', 'public', 'loja', 'styles.css');
let css = fs.readFileSync(stylesPath, 'utf8');

// 1. Topo logo-badge (linhas 17-21)
const oldTopBadge = '.logo-badge{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#ed1c24 0%,#8a0c10 100%);padding:2px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(237,28,36,.35);flex-shrink:0}';
const newTopBadge = '.logo-badge{width:42px;height:42px;border-radius:50%;background:#ffffff;border:2.5px solid #ed1c24;padding:0;display:flex;align-items:center;justify-content:center;box-shadow:none !important;flex-shrink:0;overflow:hidden}';
if (css.includes(oldTopBadge)) {
  css = css.replace(oldTopBadge, newTopBadge);
  console.log('✓ 1. Top logo-badge updated');
} else {
  console.log('Note: Top logo-badge might already be updated');
}

// 2. Substituir bloco mobile de logo (linhas 3331-3365)
const oldMobileLogoStart = '/* Logo compacta e fixa (sem flex:1 que causava overflow em cima de MOTORS) */';
const oldMobileLogoEnd = 'header.header .logo-badge-inner{font-size:9px !important}';
const sIdx = css.indexOf(oldMobileLogoStart);
const eIdx = css.indexOf(oldMobileLogoEnd);

if (sIdx !== -1 && eIdx !== -1) {
  const newMobileBlock = `/* Logo e Nome em tamanho de destaque no cabeçalho mobile */
  header.header .logo{
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 8px !important;
    font-size: 18.5px !important;
    line-height: 1.1 !important;
    letter-spacing: 0.2px !important;
    margin: 0 !important;
    order: 2 !important;
    flex: 0 1 auto !important;
    min-width: 0 !important;
    overflow: visible !important;
    box-shadow: none !important;
    background: transparent !important;
  }
  header.header .logo-text{
    display: flex !important;
    align-items: center !important;
    gap: 4px !important;
    white-space: nowrap !important;
    font-size: 18.5px !important;
    font-weight: 900 !important;
    line-height: 1.1 !important;
    box-shadow: none !important;
    background: transparent !important;
  }
  header.header .logo-text .brand-fahren,
  header.header .logo span.brand-fahren,
  header.header .logo span{
    font-size: 18.5px !important;
    font-weight: 900 !important;
    color: #ed1c24 !important;
    -webkit-text-fill-color: #ed1c24 !important;
    letter-spacing: 0.2px !important;
    margin: 0 !important;
    display: inline-block !important;
  }
  header.header .logo-text .brand-motors,
  header.header .logo-text .brand-parts,
  header.header .logo span.brand-motors{
    font-size: 18.5px !important;
    font-weight: 900 !important;
    letter-spacing: 0.2px !important;
    margin: 0 !important;
    display: inline-block !important;
  }
  body.tema-claro header.header .logo-text .brand-motors,
  body.tema-claro header.header .logo-text .brand-parts{
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }
  body:not(.tema-claro) header.header .logo-text .brand-motors,
  body:not(.tema-claro) header.header .logo-text .brand-parts{
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
  header.header .logo-badge{
    width: 38px !important;
    height: 38px !important;
    border-radius: 50% !important;
    border: 2.2px solid #ed1c24 !important;
    padding: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-shadow: none !important;
    flex-shrink: 0 !important;
    overflow: hidden !important;
  }
  body.tema-claro header.header .logo-badge{
    background: #ffffff !important;
  }
  body:not(.tema-claro) header.header .logo-badge{
    background: #090a0c !important;
  }
  header.header .logo-badge-inner{
    width: 100% !important;
    height: 100% !important;
    border-radius: 50% !important;
    background: transparent !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 14px !important;
    font-weight: 900 !important;
    letter-spacing: -0.5px !important;
    box-shadow: none !important;
  }
  body.tema-claro header.header .logo-badge-inner{
    color: #ed1c24 !important;
  }
  body:not(.tema-claro) header.header .logo-badge-inner{
    color: #ffffff !important;
  }`;
  css = css.slice(0, sIdx) + newMobileBlock + css.slice(eIdx + oldMobileLogoEnd.length);
  console.log('✓ 2. Mobile logo block replaced');
} else {
  console.log('Note: Mobile logo block already replaced or not found');
}

// 3. Substituir img-wrap em fp-rec-card
const oldRecImgWrap105 = /height:\s*105px\s*!important;\s*padding:\s*10px\s*!important;/g;
css = css.replace(oldRecImgWrap105, 'height: 145px !important; padding: 0 !important; margin: 0 !important;');

const oldRecImgWrap110 = /height:\s*110px\s*!important;\s*padding:\s*10px\s*!important;/g;
css = css.replace(oldRecImgWrap110, 'height: 145px !important; padding: 0 !important; margin: 0 !important;');

const oldRecImgWrap125 = /height:\s*125px\s*!important;/g;
css = css.replace(oldRecImgWrap125, 'height: 155px !important; padding: 0 !important; margin: 0 !important;');

// 4. Regra final de alta especificidade no fim do arquivo
const masterFlag = '/* MASTER OVERRIDES: LOGO & NOME DESTACADOS + PECAS RECOMENDADAS GRANDES */';
if (!css.includes(masterFlag)) {
  const finalMasterBlock = `\r\n\r\n${masterFlag}
/* 1. LOGO E NOME SEMPRE GRANDES, NITIDOS E SEM BORRAO VERMELHO */
header.header .logo,
.logo {
  cursor: pointer !important;
  gap: 8px !important;
  box-shadow: none !important;
  background: transparent !important;
}

header.header .logo-badge,
.logo-badge {
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  border: 2.5px solid #ed1c24 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: none !important;
  filter: none !important;
  flex-shrink: 0 !important;
  overflow: hidden !important;
}

body.tema-claro header.header .logo-badge,
body.tema-claro .logo-badge {
  background: #ffffff !important;
  border-color: #ed1c24 !important;
  box-shadow: none !important;
}

body:not(.tema-claro) header.header .logo-badge,
body:not(.tema-claro) .logo-badge {
  background: #090a0c !important;
  border-color: #ed1c24 !important;
  box-shadow: none !important;
}

header.header .logo-badge-inner,
.logo-badge-inner {
  width: 100% !important;
  height: 100% !important;
  border-radius: 50% !important;
  background: transparent !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 14.5px !important;
  font-weight: 900 !important;
  letter-spacing: -0.5px !important;
  box-shadow: none !important;
}

body.tema-claro header.header .logo-badge-inner,
body.tema-claro .logo-badge-inner {
  color: #ed1c24 !important;
  background: transparent !important;
}

body:not(.tema-claro) header.header .logo-badge-inner,
body:not(.tema-claro) .logo-badge-inner {
  color: #ffffff !important;
  background: transparent !important;
}

header.header .logo-text,
.logo-text {
  font-size: 18.5px !important;
  font-weight: 900 !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  line-height: 1.1 !important;
  box-shadow: none !important;
  background: transparent !important;
}

header.header .logo-text .brand-fahren,
.logo-text .brand-fahren,
header.header .logo span.brand-fahren {
  font-size: 18.5px !important;
  font-weight: 900 !important;
  color: #ed1c24 !important;
  -webkit-text-fill-color: #ed1c24 !important;
  letter-spacing: 0.2px !important;
  box-shadow: none !important;
}

header.header .logo-text .brand-motors,
header.header .logo-text .brand-parts,
.logo-text .brand-motors,
.logo-text .brand-parts,
header.header .logo span.brand-motors {
  font-size: 18.5px !important;
  font-weight: 900 !important;
  letter-spacing: 0.2px !important;
}

body.tema-claro header.header .logo-text .brand-motors,
body.tema-claro header.header .logo-text .brand-parts,
body.tema-claro .logo-text .brand-motors,
body.tema-claro .logo-text .brand-parts {
  color: #000000 !important;
  -webkit-text-fill-color: #000000 !important;
}

body:not(.tema-claro) header.header .logo-text .brand-motors,
body:not(.tema-claro) header.header .logo-text .brand-parts,
body:not(.tema-claro) .logo-text .brand-motors,
body:not(.tema-claro) .logo-text .brand-parts {
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}

/* 2. PECAS RECOMENDADAS: FOTOS GRANDES, DESTACADAS E BEM PROPORCIONADAS */
.fp-rec-card {
  border-radius: 14px !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease !important;
}

.fp-rec-card-img-wrap {
  width: 100% !important;
  height: 160px !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
  position: relative !important;
  display: block !important;
  border-top-left-radius: 13px !important;
  border-top-right-radius: 13px !important;
}

body.tema-claro .fp-rec-card-img-wrap {
  background: #f1f3f7 !important;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08) !important;
}

body:not(.tema-claro) .fp-rec-card-img-wrap {
  background: #11141a !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.fp-rec-card-img-wrap img {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: cover !important;
  object-position: center !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  filter: none !important;
  transition: transform 0.28s ease !important;
}

.fp-rec-card:hover .fp-rec-card-img-wrap img {
  transform: scale(1.06) !important;
}

.fp-rec-card-body {
  padding: 12px 13px 15px !important;
  display: flex !important;
  flex-direction: column !important;
  flex: 1 !important;
  gap: 4px !important;
}

.fp-rec-card-cat {
  font-size: 11px !important;
  font-weight: 800 !important;
  color: #ff3b44 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.6px !important;
  padding: 0 !important;
  margin: 0 !important;
}

.fp-rec-card-name {
  font-size: 13.5px !important;
  font-weight: 800 !important;
  line-height: 1.3 !important;
  padding: 2px 0 4px !important;
  margin: 0 !important;
  min-height: 36px !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

body.tema-claro .fp-rec-card-name {
  color: #0f172a !important;
}

body:not(.tema-claro) .fp-rec-card-name {
  color: #ffffff !important;
}

.fp-rec-card .cat-card-price-block {
  padding: 0 !important;
  margin-top: 4px !important;
}

.fp-rec-card .cat-card-pix {
  font-size: 19px !important;
  font-weight: 900 !important;
  letter-spacing: -0.4px !important;
}

@media (max-width: 760px) {
  header.header .logo-badge {
    width: 38px !important;
    height: 38px !important;
  }
  header.header .logo-badge-inner {
    font-size: 14px !important;
  }
  header.header .logo-text,
  header.header .logo-text .brand-fahren,
  header.header .logo-text .brand-motors,
  header.header .logo-text .brand-parts {
    font-size: 18px !important;
  }
  .fp-rec-card-img-wrap {
    height: 145px !important;
    padding: 0 !important;
    margin: 0 !important;
  }
}

@media (max-width: 480px) {
  header.header .logo {
    gap: 7px !important;
  }
  header.header .logo-badge {
    width: 36px !important;
    height: 36px !important;
  }
  header.header .logo-badge-inner {
    font-size: 13px !important;
  }
  header.header .logo-text,
  header.header .logo-text .brand-fahren,
  header.header .logo-text .brand-motors,
  header.header .logo-text .brand-parts {
    font-size: 17.5px !important;
  }
  .fp-rec-card-img-wrap {
    height: 140px !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .fp-rec-card-body {
    padding: 10px 11px 12px !important;
  }
  .fp-rec-card-name {
    font-size: 12.5px !important;
  }
  .fp-rec-card .cat-card-pix {
    font-size: 17.5px !important;
  }
}
`;
  css += finalMasterBlock;
  console.log('✓ 4. Master block appended');
}

fs.writeFileSync(stylesPath, css, 'utf8');
console.log('Done patching styles.css!');
