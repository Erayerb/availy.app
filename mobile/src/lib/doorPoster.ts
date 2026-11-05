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
<div style="font-size:44px;color:#C8102E">availy</div>
<div style="font-size:30px;font-weight:bold;margin:28px 0 8px">Şu an burası nasıl?</div>
<div style="font-family:Helvetica,Arial,sans-serif;font-size:20px;margin-bottom:24px">Kameranla okut, check-in yap, puan kazan.</div>
${qrSvg(link)}
<div style="font-size:24px;margin-top:24px">${escapeHtml(venueName)}</div>
</div></body></html>`;
}
