// Envío del PDF con el menú de compartir del sistema (o descarga si no hay).

const REVOKE_AFTER_MS = 15000;

/**
 * @param {{blob: Blob, filename: string, title: string}} pdf
 * @returns {Promise<'shared'|'cancelled'|'downloaded'>}
 */
export async function sharePdf(pdf) {
  const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: pdf.title }); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  download(pdf);
  return 'downloaded';
}

function download(pdf) {
  const url = URL.createObjectURL(pdf.blob);
  const a = document.createElement('a');
  a.href = url; a.download = pdf.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
