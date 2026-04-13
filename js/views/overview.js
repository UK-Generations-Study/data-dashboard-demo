/* ============================================================
   Overview tab.
   ============================================================ */

'use strict';

import { state } from '../state.js';
import { $, esc, isIdField } from '../utils.js';

export function renderOverview() {
  const data = state.cohortData;
  const n = data.length;
  const keys = Object.keys(state.SCHEMA).filter(k => !isIdField(k));
  const totalCells = n * keys.length;
  const missingCells = keys.reduce((acc, k) => {
    return acc + data.filter(r => r[k] === null || r[k] === undefined).length;
  }, 0);

  $('overview-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${n.toLocaleString()}</div><div class="stat-label">Participants</div></div>
    <div class="stat-card"><div class="stat-value">${keys.length}</div><div class="stat-label">Variables</div></div>
    <div class="stat-card"><div class="stat-value">${((1 - missingCells / totalCells) * 100).toFixed(1)}%</div><div class="stat-label">Completeness</div></div>
    <div class="stat-card"><div class="stat-value">${(missingCells / totalCells * 100).toFixed(1)}%</div><div class="stat-label">Overall Missing</div></div>
  `;

  const groups = {};
  keys.forEach(k => {
    const g = state.SCHEMA[k].group;
    groups[g] = (groups[g] || []);
    groups[g].push(k);
  });

  $('group-summary').innerHTML = Object.entries(groups).map(([g, ks]) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-weight:700;color:var(--navy);min-width:160px">${esc(state.GROUP_LABELS[g] || g)}</span>
      <span style="color:var(--muted);font-size:12px">${ks.length} variables</span>
      <span style="font-size:11px;color:var(--muted)">${esc(ks.slice(0,5).join(', '))}${ks.length > 5 ? '\u2026' : ''}</span>
    </div>`).join('');
}
