/** The door sticker the business prints: a whole page with the venue's QR code. */
import QRCode from 'qrcode';

const QUIET_ZONE = 4;

/** The code as SVG, drawn from its modules (no canvas on the phone). */
export function qrSvg(text: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size + QUIET_ZONE * 2;
  let path = '';
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="360" height="360"><path d="${path}" fill="#000"/></svg>`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function doorPosterHtml(venueName: string, link: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(venueName)}</title></head>
<body style="margin:0;font-family:Georgia,serif;text-align:center;color:#2B1D16">
<div style="padding:48px 24px">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:44px;font-weight:600"><svg viewBox="0 17 100 70" width="52" height="52" style="vertical-align:-8px"><path d="M18 78 L35.19 35.95 A16 16 0 0 1 64.81 35.95 L82 78" stroke="#2B1D16" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="50" cy="60" r="8" fill="#C8102E"/></svg> Availo</div>
<div style="font-size:30px;font-weight:bold;margin:28px 0 8px">Şu an burası nasıl?</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:20px;margin-bottom:24px">Kameranla okut, check-in yap, puan kazan.</div>
${qrSvg(link)}
<div style="font-size:24px;margin-top:24px">${escapeHtml(venueName)}</div>
</div></body></html>`;
}

// The availo mark, for printed pages (cream arch and red dot on the dark sticker)
const MARK = (stroke: string) =>
  `<svg viewBox="0 17 100 70" width="44" height="44" style="vertical-align:-9px"><path d="M18 78 L35.19 35.95 A16 16 0 0 1 64.81 35.95 L82 78" stroke="${stroke}" stroke-width="14" stroke-linecap="round" fill="none"/><circle cx="50" cy="60" r="8" fill="#E0263F"/></svg>`;

/** The door sticker: 9×9 cm, in availo's colours ("availo'da · QR ile check-in"), four on an A4 page to cut out. */
export function doorStickerHtml(venueName: string, link: string): string {
  const qr = qrSvg(link).replace('width="360" height="360"', 'width="100%" height="100%"');
  const sticker = `<div class="s">
  <div class="top">${MARK('#FBF4E8')}<span>availo'da</span></div>
  <div class="q">Şu an burası nasıl?</div>
  <div class="code">${qr}</div>
  <div class="how">Okut, check-in yap, puan kazan</div>
  <div class="name">${escapeHtml(venueName)}</div>
</div>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(venueName)} · çıkartma</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .grid { display: grid; grid-template-columns: 90mm 90mm; gap: 8mm; justify-content: center; }
  .s { width: 90mm; height: 90mm; box-sizing: border-box; border-radius: 10mm; background: #17110E; color: #FBF4E8;
       padding: 6mm; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center;
       outline: 0.3mm dashed #bbb; outline-offset: 2mm; }
  .top { font-size: 7mm; font-weight: 700; display: flex; align-items: center; gap: 1.5mm; }
  .top svg { width: 8mm; height: 8mm; }
  .q { font-family: Georgia, serif; font-weight: 700; font-size: 5.2mm; }
  .code { width: 40mm; height: 40mm; background: #fff; border-radius: 3mm; padding: 1.5mm; box-sizing: border-box; }
  .how { font-size: 3.6mm; font-weight: 700; color: #FFB4A8; }
  .name { font-size: 3.4mm; opacity: .85; max-width: 76mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style></head>
<body><div class="grid">${sticker.repeat(4)}</div></body></html>`;
}
