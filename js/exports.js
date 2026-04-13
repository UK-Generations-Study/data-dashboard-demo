/* ============================================================
   Export helpers: branded PNG, chart PNG, attrition PNG, cohort JSON.
   ============================================================ */

'use strict';

import { state } from './state.js';
import { $, toast } from './utils.js';

// ── Shared branded PNG export ─────────────────────────────────────────────
// Captures `element` with html2canvas, prepends a purple branded header,
// and triggers a download of `filename`.
function exportBrandedPNG(element, filename, hideEl) {
  if (hideEl) hideEl.style.visibility = 'hidden';

  const xhrDataURL = src => new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'blob';
    xhr.onload = () => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => resolve(null);
    xhr.send();
  });

  const imgFromDataURL = dataURL => new Promise(resolve => {
    if (!dataURL) { resolve(null); return; }
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });

  Promise.all([
    html2canvas(element, { backgroundColor: '#ffffff', scale: 2, logging: false }),
    xhrDataURL('assets/logo-g.png').then(imgFromDataURL),
    xhrDataURL('assets/logo-white.png').then(imgFromDataURL),
  ]).then(([snapshot, logoG, logoW]) => {
    if (hideEl) hideEl.style.visibility = '';

    const SCALE = 2;
    const W     = snapshot.width;
    const HDRH  = 84 * SCALE;
    const PAD   = 16 * SCALE;

    const out  = document.createElement('canvas');
    out.width  = W;
    out.height = HDRH + snapshot.height;
    const ctx2 = out.getContext('2d');

    ctx2.fillStyle = '#6B58A0';
    ctx2.fillRect(0, 0, W, HDRH);

    let x = PAD;
    const iconH = 40 * SCALE;
    if (logoG) {
      const iconW = Math.round(logoG.naturalWidth * iconH / logoG.naturalHeight);
      ctx2.drawImage(logoG, x, (HDRH - iconH) / 2, iconW, iconH);
      x += iconW + 8 * SCALE;
    }

    const wordH = 24 * SCALE;
    if (logoW) {
      const wordW = Math.round(logoW.naturalWidth * wordH / logoW.naturalHeight);
      ctx2.drawImage(logoW, x, (HDRH - wordH) / 2, wordW, wordH);
    }

    const dateStr   = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const dataLabel = state.pendingDatasets.length
      ? state.pendingDatasets.map(ds => ds.fileName).join(', ')
      : 'synthetic_data.json';
    const schLabel  = state.pendingSchemas.length
      ? state.pendingSchemas.map(s => s.fileName).join(', ')
      : (state.schemaSource === 'inferred' ? 'Auto-detected' : state.schemaSource === 'builtin' ? 'Built-in' : 'unknown');

    ctx2.textAlign    = 'right';
    ctx2.textBaseline = 'top';
    const lineH  = 15 * SCALE;
    const tyBase = (HDRH - 4 * lineH) / 2;

    ctx2.fillStyle = '#B9E05D';
    ctx2.font      = `bold ${12 * SCALE}px Arial, sans-serif`;
    ctx2.fillText('The Generations Study', W - PAD, tyBase);

    ctx2.fillStyle = 'rgba(255,255,255,0.9)';
    ctx2.font      = `${11 * SCALE}px Arial, sans-serif`;
    ctx2.fillText(`Date: ${dateStr}`,    W - PAD, tyBase + lineH);
    ctx2.fillText(`Data: ${dataLabel}`,  W - PAD, tyBase + 2 * lineH);
    ctx2.fillText(`Schema: ${schLabel}`, W - PAD, tyBase + 3 * lineH);

    ctx2.strokeStyle = '#B9E05D';
    ctx2.lineWidth   = 2 * SCALE;
    ctx2.beginPath();
    ctx2.moveTo(0, HDRH);
    ctx2.lineTo(W, HDRH);
    ctx2.stroke();

    ctx2.drawImage(snapshot, 0, HDRH);

    const a = document.createElement('a');
    a.href     = out.toDataURL('image/png');
    a.download = filename;
    a.click();
    toast(`Downloaded ${filename}`);
  }).catch(err => {
    if (hideEl) hideEl.style.visibility = '';
    console.error('PNG download failed:', err);
    toast('Download failed \u2014 see console for details');
  });
}

export function downloadChartPNG() {
  if (!state.mainChart) { toast('No chart to download'); return; }
  const card = document.querySelector('#var-detail > .card');
  if (!card) { toast('No chart to download'); return; }
  const modeName = { histogram: 'histogram', violin: 'violin', bar: 'barchart', pie: 'piechart' }[state.chartMode] || state.chartMode;
  const filename  = `${state.activeVar || 'chart'}_${modeName}.png`;
  const dlBtn = card.querySelector('.btn-download-png');
  exportBrandedPNG(card, filename, dlBtn);
}

export function exportAttritionPNG() {
  const card = document.querySelector('#attrition-flow')?.closest('.card');
  if (!card) { toast('No attrition flow to export'); return; }
  exportBrandedPNG(card, 'attrition_flow.png');
}

export function exportCohort() {
  const def = {
    meta: { created: new Date().toISOString(), tool: 'Generations Study Demo Dashboard',
      dataset: state.pendingDatasets.length ? state.pendingDatasets.map(ds => ds.fileName).join(', ') : 'unknown',
      total_n: state.rawData.length, cohort_n: state.cohortData.length },
    filters: state.filters.map(({field, operator, value, logic}) => ({field, operator, value, logic})),
    cohort_tcodes: state.cohortData.map(r => r.R0_TCode)
  };
  const blob = new Blob([JSON.stringify(def, null, 2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `cohort_${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('Cohort definition exported.');
}
