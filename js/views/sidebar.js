/* ============================================================
   Sidebar variable list and selection.
   ============================================================ */

'use strict';

import { GROUP_ORDER, state } from '../state.js';
import { $, esc, typeClass, isIdField } from '../utils.js';
import { showTab } from './tabs.js';
import { renderVarDetail } from './explore.js';

export function renderVarList() {
  const search = $('var-search').value.toLowerCase();
  const list   = $('var-list');
  list.innerHTML = '';
  let shown = 0;

  const keys = Object.keys(state.SCHEMA)
    .filter(k => !isIdField(k))
    .sort((a, b) => {
      const ga = state.SCHEMA[a]?.group ?? '', gb = state.SCHEMA[b]?.group ?? '';
      const ia = GROUP_ORDER.indexOf(ga), ib = GROUP_ORDER.indexOf(gb);
      const ra = ia === -1 ? 9999 : ia, rb = ib === -1 ? 9999 : ib;
      return ra - rb;
    });

  keys.forEach(key => {
    const s = state.SCHEMA[key];
    if (state.activeGroup !== 'all' && s.group !== state.activeGroup) return;
    if (search && !key.toLowerCase().includes(search) && !s.desc.toLowerCase().includes(search)) return;

    shown++;
    const item = document.createElement('div');
    item.className = 'var-item' + (key === state.activeVar ? ' active' : '');
    item.innerHTML = `
      <div style="flex:1;overflow:hidden">
        <div class="var-name">${esc(key)}</div>
        <div class="var-desc">${esc(s.desc)}</div>
      </div>
      <span class="var-type-pill ${typeClass(s.type)}">${esc(s.type)}</span>`;
    item.addEventListener('click', () => selectVar(key));
    list.appendChild(item);
  });

  $('var-count-badge').textContent = `(${shown})`;
}

export function selectVar(key) {
  state.activeVar = key;
  renderVarList();
  showTab('explore');
  renderVarDetail(key, state.cohortData);
  document.body.classList.remove('sidebar-open');
}
