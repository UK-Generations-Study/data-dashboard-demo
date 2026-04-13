/* ============================================================
   Stratified analysis tab.
   ============================================================ */

'use strict';

import { state } from '../state.js';
import { $, esc, fmt, arrMin, arrMax, getValidValues, summarise, isIdField } from '../utils.js';

export function populateStratSelects() {
  const catVars = Object.keys(state.SCHEMA).filter(k => {
    const s = state.SCHEMA[k];
    return (s.type === 'categorical' || s.type === 'binary') && s.codes && !isIdField(k);
  });
  const numVars = Object.keys(state.SCHEMA).filter(k => {
    const s = state.SCHEMA[k];
    return s.type === 'numeric' || s.type === 'integer';
  });

  const byOpts = catVars.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
  const tgtOpts = numVars.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

  $('strat-by').innerHTML     = byOpts;
  $('strat-target').innerHTML = tgtOpts;
  $('t1-strat-by').innerHTML  = '<option value="">None (whole cohort)</option>' + byOpts;
}

export function renderStratified() {
  const byKey  = $('strat-by').value;
  const tgtKey = $('strat-target').value;
  if (!byKey || !tgtKey) return;

  const s   = state.SCHEMA[byKey];
  const groups = {};
  state.cohortData.forEach(r => {
    const gv = r[byKey];
    if (gv === null || gv === undefined) return;
    const gk = String(gv);
    if (!groups[gk]) groups[gk] = [];
    groups[gk].push(r);
  });

  const area = $('strat-charts-area');
  area.innerHTML = '';

  const PALETTE = ['#6B58A0','#B9E05D','#A599C7','#d46c00'];

  Object.entries(groups).sort().slice(0, 8).forEach(([gval, gdata], idx) => {
    const label = (s.codes && s.codes[gval]) ? s.codes[gval] : gval;
    const values = getValidValues(tgtKey, gdata).map(Number).filter(n => !isNaN(n));
    if (!values.length) return;

    const div = document.createElement('div');
    div.className = 'card';

    const ss = summarise(values);
    const min = arrMin(values), max = arrMax(values);
    const bins = 20, step = (max - min) / bins || 1;
    const buckets = Array(bins).fill(0);
    const binLabels = Array.from({length:bins}, (_,i) => fmt(min + i*step, 1));
    values.forEach(v => {
      const bi = Math.min(bins-1, Math.floor((v - min)/step));
      buckets[bi]++;
    });

    div.innerHTML = `
      <div class="card-title" style="color:${PALETTE[idx%PALETTE.length]}">${esc(byKey)} = ${esc(label)}
        <span class="badge" style="background:${PALETTE[idx%PALETTE.length]}">${gdata.length}</span></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
        Mean ${fmt(ss.mean)} (SD ${fmt(ss.sd)}) | Median ${fmt(ss.median)} | Range ${fmt(ss.min)}\u2013${fmt(ss.max)}</div>
      <div style="position:relative;height:180px;">
        <canvas id="sc-${idx}"></canvas>
      </div>`;
    area.appendChild(div);

    const ctx2 = document.getElementById(`sc-${idx}`).getContext('2d');
    new Chart(ctx2, {
      type: 'bar',
      data: { labels: binLabels, datasets: [{
        label: tgtKey, data: buckets,
        backgroundColor: PALETTE[idx%PALETTE.length] + '99',
        borderColor: PALETTE[idx%PALETTE.length], borderWidth: 1
      }]},
      options: { plugins:{ legend:{ display:false } },
        scales:{ x:{ ticks:{ maxRotation:45, font:{size:9} } },
                 y:{ title:{ display:true, text:'Count' }, beginAtZero:true } },
        maintainAspectRatio: false }
    });
  });
}
