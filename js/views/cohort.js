/* ============================================================
   Cohort builder: filters, attrition flow, cohort preview.
   ============================================================ */

'use strict';

import { state } from '../state.js';
import { $, esc, fmt, pct, getValidValues, summarise, freqTable, typeClass, isIdField } from '../utils.js';
import { renderVarDetail } from './explore.js';
import { renderOverview } from './overview.js';
import { renderMissingness } from './missingness.js';

export function addFilter() {
  const id = state.filterIdCounter++;
  state.filters.push({ id, field: 'R0_BMI', operator: '>', value: '', logic: 'AND' });
  renderFilterRows();
}

export function removeFilter(id) {
  state.filters = state.filters.filter(f => f.id !== id);
  renderFilterRows();
  applyFilters();
}

export function renderFilterRows() {
  const cont = $('filter-rows');
  cont.innerHTML = '';

  const numVars = Object.keys(state.SCHEMA).filter(k => ['numeric','integer'].includes(state.SCHEMA[k].type) && !isIdField(k));
  const catVars = Object.keys(state.SCHEMA).filter(k => ['categorical','binary'].includes(state.SCHEMA[k].type) && !isIdField(k));
  const allVars = [...numVars, ...catVars].sort();

  state.filters.forEach((f, idx) => {
    const s = state.SCHEMA[f.field] || {};
    const isNum = ['numeric','integer'].includes(s.type);
    const isCat = ['categorical','binary'].includes(s.type);

    const row = document.createElement('div');
    row.className = 'filter-row';

    const logicHtml = idx === 0 ? '<span style="min-width:50px;font-size:12px;color:var(--muted)">WHERE</span>'
      : `<select class="filter-logic" data-fid="${f.id}" data-fprop="logic">
           <option value="AND" ${f.logic==='AND'?'selected':''}>AND</option>
           <option value="OR"  ${f.logic==='OR'?'selected':''}> OR</option>
         </select>`;

    let opHtml = '';
    if (isNum) {
      opHtml = `<select class="filter-op" data-fid="${f.id}" data-fprop="operator">
        ${['>','>=','<','<=','=','!='].map(op => `<option ${f.operator===op?'selected':''}>${op}</option>`).join('')}
      </select>`;
    } else if (isCat && s.codes) {
      opHtml = `<select class="filter-op" style="width:60px" data-fid="${f.id}" data-fprop="operator">
        <option value="in" ${f.operator==='in'?'selected':''}>is</option>
        <option value="not_in" ${f.operator==='not_in'?'selected':''}>is not</option>
      </select>`;
    }

    let valHtml = '';
    if (isNum) {
      valHtml = `<input type="number" step="any" value="${esc(f.value)}" placeholder="value"
        data-fid="${f.id}" data-fprop="value" />`;
    } else if (isCat && s.codes) {
      valHtml = `<select class="filter-op" data-fid="${f.id}" data-fprop="value">
        ${Object.entries(s.codes).map(([code, label]) =>
          `<option value="${esc(code)}" ${String(f.value)===String(code)?'selected':''}>${esc(code)}: ${esc(label)}</option>`
        ).join('')}
      </select>`;
    }

    row.innerHTML = `
      ${logicHtml}
      <select data-fid="${f.id}" data-fprop="field">
        ${allVars.map(k => `<option value="${esc(k)}" ${f.field===k?'selected':''}>${esc(k)}</option>`).join('')}
      </select>
      ${opHtml}
      ${valHtml}
      <button class="btn-remove" data-fid="${f.id}" data-action="remove" title="Remove">\u00D7</button>
    `;
    cont.appendChild(row);
  });

  if (!state.filters.length) {
    cont.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px">No filters applied \u2014 showing full dataset.</p>';
  }
}

const FILTER_PROPS = new Set(['field', 'operator', 'value', 'logic']);

export function updateFilter(id, field, value) {
  if (!FILTER_PROPS.has(field)) return;
  const f = state.filters.find(x => x.id === id);
  if (!f) return;
  f[field] = value;
  if (field === 'field') {
    const s = state.SCHEMA[value];
    if (['numeric','integer'].includes(s.type)) { f.operator = '>'; f.value = ''; }
    else { f.operator = 'in'; f.value = Object.keys(s.codes || {})[0] || ''; }
    renderFilterRows();
  }
  applyFilters();
}

export function evalFilter(f, row) {
  const rv = row[f.field];
  if (rv === null || rv === undefined) return false;
  if (f.operator === 'in')     return String(rv) === String(f.value);
  if (f.operator === 'not_in') return String(rv) !== String(f.value);
  const nv = Number(rv), fv = Number(f.value);
  if (isNaN(nv) || isNaN(fv)) return false;
  switch (f.operator) {
    case '>':  return nv >  fv;
    case '>=': return nv >= fv;
    case '<':  return nv <  fv;
    case '<=': return nv <= fv;
    case '=':  return nv === fv;
    case '!=': return nv !== fv;
  }
  return false;
}

export function evalFilterList(fs, row) {
  if (!fs.length) return true;
  let groupResult = true;
  let anyGroup    = false;
  fs.forEach((f, idx) => {
    if (idx > 0 && f.logic === 'OR') {
      anyGroup = anyGroup || groupResult;
      groupResult = true;
    }
    groupResult = groupResult && evalFilter(f, row);
  });
  return anyGroup || groupResult;
}

export function applyFilters() {
  if (!state.filters.length) {
    state.cohortData = state.rawData;
    updateCohortUI();
    return;
  }
  state.cohortData = state.rawData.filter(row => evalFilterList(state.filters, row));
  updateCohortUI();
}

function updateCohortUI() {
  $('cohort-count').textContent = state.cohortData.length;
  buildAttritionFlow();
  renderCohortPreview();
  renderOverview();
  if (state.activeVar) renderVarDetail(state.activeVar, state.cohortData);
  renderMissingness(state.cohortData);
  $('miss-cohort-label').textContent = state.cohortData.length < state.rawData.length
    ? `Cohort (n=${state.cohortData.length})` : 'Full dataset';
}

export function buildAttritionFlow() {
  const cont = $('attrition-flow');
  const n    = state.rawData.length;
  const nc   = state.cohortData.length;

  let html = `
    <div class="attrition-step total">
      <span class="att-n">${n}</span>
      <span class="att-label">Total participants in dataset</span>
    </div>`;

  state.filters.forEach((f, i) => {
    const s = state.SCHEMA[f.field];
    const label = s.codes && s.codes[f.value] ? s.codes[f.value] : f.value;
    const partial = state.rawData.filter(row => evalFilterList(state.filters.slice(0, i + 1), row)).length;
    const prev    = i === 0 ? n
                  : state.rawData.filter(row => evalFilterList(state.filters.slice(0, i), row)).length;
    const drop = prev - partial;
    const logic = i === 0 ? '' : `${f.logic} `;
    html += `
      <div style="margin:0 0 0 20px;border-left:2px dashed var(--border);padding-left:12px">
        <div class="attrition-step included">
          <span class="att-n">${partial}</span>
          <span class="att-label">${esc(logic)}${esc(f.field)} ${esc(f.operator)} ${esc(label)}</span>
          <span class="att-pct" style="color:var(--warn)">\u2212${drop}</span>
        </div>
      </div>`;
  });

  if (state.filters.length) {
    html += `
      <div class="attrition-step included" style="margin-top:8px">
        <span class="att-n">${nc}</span>
        <span class="att-label">Final cohort</span>
        <span class="att-pct" style="color:var(--green)">${pct(nc, n)} retained</span>
      </div>`;
  }

  cont.innerHTML = html;
  $('cohort-preview-n').textContent = state.cohortData.length;
}

function renderCohortPreview() {
  const cont = $('cohort-preview-stats');
  const previewVars = [...new Set(state.filters.map(f => f.field).filter(Boolean))];

  if (!previewVars.length) {
    cont.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">Add filters above to see a summary here.</div>';
    return;
  }

  cont.innerHTML = previewVars.map(k => {
    const s = state.SCHEMA[k];
    if (!s) return '';
    const vals = getValidValues(k, state.cohortData);
    let summary = '';
    if (['numeric','integer'].includes(s.type)) {
      const ss = summarise(vals.map(Number));
      summary = ss ? `Mean ${fmt(ss.mean)} (SD ${fmt(ss.sd)})` : '\u2014';
    } else {
      const ft = freqTable(vals.map(String));
      const top = ft.slice(0, 3).map(([code, cnt]) => {
        const label = s.codes && s.codes[code] ? s.codes[code] : code;
        return `${esc(label)}: ${cnt}`;
      });
      summary = top.join(' | ');
    }
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:11px;font-weight:700;color:var(--navy)">${esc(k)}
        <span style="font-weight:400;color:var(--muted)"> \u2014 ${esc(s.desc || '')}</span></div>
      <div style="font-size:12px;color:var(--muted)">${summary}</div>
    </div>`;
  }).join('');
}

export function clearFilters() {
  state.filters = [];
  state.filterIdCounter = 0;
  renderFilterRows();
  applyFilters();
}

// Set up event delegation on the filter-rows container — called once at boot.
export function initFilterDelegation() {
  const cont = $('filter-rows');
  cont.addEventListener('change', e => {
    const el = e.target;
    const fid  = el.dataset.fid;
    const prop = el.dataset.fprop;
    if (fid != null && prop) {
      updateFilter(Number(fid), prop, el.value);
    }
  });
  cont.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.fid != null && el.dataset.fprop === 'value') {
      updateFilter(Number(el.dataset.fid), 'value', el.value);
    }
  });
  cont.addEventListener('click', e => {
    const removeBtn = e.target.closest('[data-action="remove"]');
    if (removeBtn && removeBtn.dataset.fid != null) {
      removeFilter(Number(removeBtn.dataset.fid));
    }
  });
}
