/* ============================================================
   Table 1 rendering and CSV export.
   ============================================================ */

'use strict';

import { state } from '../state.js';
import { $, esc, fmt, pct, typeClass, getValidValues, summarise, freqTable, isIdField, toast } from '../utils.js';

export function renderTable1() {
  const stratKey = $('t1-strat-by').value;
  const n = state.cohortData.length;
  $('t1-n-badge').textContent = `n=${n}`;
  $('t1-col-all').textContent = `All (n=${n})`;

  let stratGroups = null;
  const s1col = $('t1-col-s1'), s2col = $('t1-col-s2');
  s1col.style.display = 'none'; s2col.style.display = 'none';

  if (stratKey) {
    const sSchema = state.SCHEMA[stratKey];
    const gmap = {};
    state.cohortData.forEach(r => {
      const gv = r[stratKey];
      if (gv === null || gv === undefined) return;
      const gk = String(gv);
      if (!gmap[gk]) gmap[gk] = [];
      gmap[gk].push(r);
    });
    stratGroups = Object.entries(gmap).sort();
    if (stratGroups.length >= 1) {
      const [g0, g0data] = stratGroups[0];
      s1col.textContent = `${(sSchema.codes && sSchema.codes[g0]) || g0} (n=${g0data.length})`;
      s1col.style.display = '';
    }
    if (stratGroups.length >= 2) {
      const [g1, g1data] = stratGroups[1];
      s2col.textContent = `${(sSchema.codes && sSchema.codes[g1]) || g1} (n=${g1data.length})`;
      s2col.style.display = '';
    }
  }

  const keys = Object.keys(state.SCHEMA).filter(k => !isIdField(k));
  const tbody = $('t1-body');
  tbody.innerHTML = '';

  function cellSummary(key, data) {
    const s = state.SCHEMA[key];
    const vals = getValidValues(key, data);
    if (!vals.length) return '\u2014';

    if (s.type === 'numeric' || s.type === 'integer') {
      const ss = summarise(vals.map(Number));
      return ss ? `${esc(fmt(ss.mean, 1))} (${esc(fmt(ss.sd, 1))})` : '\u2014';
    } else {
      const ft = freqTable(vals.map(String));
      const top = ft.slice(0, 3).map(([code, cnt]) => {
        const label = (s.codes && s.codes[code]) ? s.codes[code] : code;
        const short = label.length > 14 ? label.slice(0,14)+'\u2026' : label;
        return `${esc(short)}: ${esc(String(cnt))} (${esc(pct(cnt, data.length))})`;
      });
      return top.join('<br>');
    }
  }

  keys.forEach(key => {
    const s = state.SCHEMA[key];
    const allVals = state.cohortData.map(r => r[key]);
    const nullCount = allVals.filter(v => v === null || v === undefined).length;
    const sentVal   = s.sentinel;
    const sentCount = sentVal != null
      ? allVals.filter(v => v === sentVal).length
      : 0;
    const tr = document.createElement('tr');

    let stratCells = '';
    if (stratGroups) {
      const [g0data] = stratGroups[0] ? [stratGroups[0][1]] : [[]];
      const [g1data] = stratGroups[1] ? [stratGroups[1][1]] : [[]];
      stratCells = `
        <td>${cellSummary(key, g0data)}</td>
        <td>${stratGroups[1] ? cellSummary(key, g1data) : ''}</td>`;
    } else {
      stratCells = '<td style="display:none"></td><td style="display:none"></td>';
    }

    const sentLabel = sentVal != null
      ? `<span class="t1-missing" title="${esc(sentVal)} = Not Applicable">${pct(sentCount, state.cohortData.length)}</span>
         <span style="font-size:10px;color:var(--muted);display:block">(${esc(sentVal)}=NA)</span>`
      : '<span style="color:var(--border)">\u2014</span>';

    tr.innerHTML = `
      <td><strong>${esc(key)}</strong><br><span class="t1-type">${esc(s.desc.slice(0,50))}${s.desc.length>50?'\u2026':''}</span></td>
      <td><span class="var-type-pill ${typeClass(s.type)}">${esc(s.type)}</span></td>
      <td>${cellSummary(key, state.cohortData)}</td>
      ${stratCells}
      <td><span class="t1-missing">${pct(nullCount, state.cohortData.length)}</span></td>
      <td>${sentLabel}</td>
    `;
    tbody.appendChild(tr);
  });
}

export function exportTable1CSV() {
  const rows = [['Variable','Type','Summary (n/mean\u00B1SD)','Null (%)','NA Sentinel (%)','Sentinel value']];
  const keys = Object.keys(state.SCHEMA).filter(k => !isIdField(k));
  keys.forEach(key => {
    const s = state.SCHEMA[key];
    const vals = getValidValues(key, state.cohortData);
    const allVals = state.cohortData.map(r => r[key]);
    const nullPct = pct(allVals.filter(v => v === null || v === undefined).length, state.cohortData.length);
    const sentVal = s.sentinel;
    const sentPct = sentVal != null
      ? pct(allVals.filter(v => v === sentVal).length, state.cohortData.length)
      : '\u2014';
    let summary = '';
    if (['numeric','integer'].includes(s.type)) {
      const ss = summarise(vals.map(Number));
      summary = ss ? `${fmt(ss.mean,1)} (SD ${fmt(ss.sd,1)})` : '';
    } else {
      const ft = freqTable(vals.map(String));
      summary = ft.slice(0,3).map(([code,cnt]) => `${code}:${cnt}`).join('; ');
    }
    rows.push([key, s.type, summary, nullPct, sentPct, sentVal != null ? String(sentVal) : '']);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download='table1.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Table 1 exported as CSV.');
}
