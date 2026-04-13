/* ============================================================
   Missingness chart tab.
   ============================================================ */

'use strict';

import { state } from '../state.js';
import { $, isIdField } from '../utils.js';

export function renderMissingness(data) {
  data = data || state.cohortData;
  if (state.missChart) { state.missChart.destroy(); state.missChart = null; }
  const ctx = $('miss-chart').getContext('2d');
  const keys = Object.keys(state.SCHEMA).filter(k => !isIdField(k));
  const n = data.length;

  const rows = keys.map(k => {
    const vals = data.map(r => r[k]);
    const nullPct  = vals.filter(v => v === null || v === undefined).length / n * 100;
    const s = state.SCHEMA[k];
    const sentPct = s.sentinel != null ? vals.filter(v => v === s.sentinel).length / n * 100 : 0;
    return { key: k, nullPct, sentPct };
  }).sort((a, b) => b.nullPct - a.nullPct);

  state.missChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.key),
      datasets: [
        { label: 'Missing (null %)', data: rows.map(r => r.nullPct),
          backgroundColor: '#6B58A0cc', borderWidth: 0 },
        { label: 'Sentinel NA (%)',   data: rows.map(r => r.sentPct),
          backgroundColor: '#B9E05Daa', borderWidth: 0 },
      ]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true, max: 100, title: { display: true, text: '% of records' } },
        y: { stacked: true, ticks: { font: { size: 10 } } }
      },
      maintainAspectRatio: false,
    }
  });
}
