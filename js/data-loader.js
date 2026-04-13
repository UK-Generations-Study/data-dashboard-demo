/* ============================================================
   File loading, dataset merging, drag-drop setup, and app init.
   ============================================================ */

'use strict';

import { BUILTIN_GROUP_LABELS, GROUP_ORDER, state } from './state.js';
import { $, esc, toast, warnBanner, isIdField } from './utils.js';
import { parseSchemaFile, inferSchemaFromData, mergeSchemas, applySchema } from './schema.js';
import { renderVarList } from './views/sidebar.js';
import { showTab } from './views/tabs.js';
import { renderOverview } from './views/overview.js';
import { renderMissingness } from './views/missingness.js';
import { populateStratSelects } from './views/stratified.js';
import { buildAttritionFlow } from './views/cohort.js';

// ── Detect the TCode join key field in a record ──────────────────────────
function detectTCodeField(record) {
  if (!record) return null;
  if ('TCode'    in record) return 'TCode';
  if ('R0_TCode' in record) return 'R0_TCode';
  return Object.keys(record).find(k => k.endsWith('TCode')) || null;
}

// ── Merge multiple data files — full outer join on TCode ────────────────
function mergeDatasets(datasets) {
  if (!datasets.length) return [];
  if (datasets.length === 1) return datasets[0].data;

  const prepared = datasets.map(ds => {
    const tcodeField = ds.data.length ? detectTCodeField(ds.data[0]) : null;
    if (!tcodeField) throw new Error(
      `Cannot find a TCode field in "${ds.fileName}". Expected "TCode" or "R0_TCode".`
    );

    // Reject files with duplicate TCodes — multi-row-per-participant data is not yet supported
    const seen = new Set();
    for (const r of ds.data) {
      const t = r[tcodeField];
      if (t != null && seen.has(t)) {
        throw new Error(
          `Duplicate TCode "${t}" found in "${ds.fileName}". ` +
          `Files with multiple rows per participant are not currently supported.`
        );
      }
      if (t != null) seen.add(t);
    }

    const byTCode = new Map();
    ds.data.forEach(r => { if (r[tcodeField] != null) byTCode.set(r[tcodeField], r); });
    return { ...ds, tcodeField, byTCode };
  });

  const primaryField = prepared[0].tcodeField;
  const allTCodes    = new Set();
  prepared.forEach(ds => ds.byTCode.forEach((_, k) => allTCodes.add(k)));

  const merged = [];
  allTCodes.forEach(tcode => {
    const rec = { [primaryField]: tcode };
    prepared.forEach((ds, i) => {
      const r = ds.byTCode.get(tcode);
      if (r) {
        Object.entries(r).forEach(([k, v]) => {
          if (i > 0 && k === ds.tcodeField) return;
          if (!(k in rec)) rec[k] = v;
        });
      }
    });
    merged.push(rec);
  });
  return merged;
}

// ── Update file-list UI inside each panel ────────────────────────────────
function updateDataFileList() {
  $('dz-data-name').innerHTML = state.pendingDatasets.map(ds =>
    `<div>\u{1F4C4} ${esc(ds.fileName)} &nbsp;\u00B7&nbsp; ${ds.data.length.toLocaleString()} records</div>`
  ).join('');
}
function updateSchemaFileList() {
  $('dz-schema-name').innerHTML = state.pendingSchemas.map(s =>
    `<div>\u{1F4CB} ${esc(s.fileName)} &nbsp;\u00B7&nbsp; ${Object.keys(s.schema).length} variables</div>`
  ).join('');
}

// ── Drag-drop and file-input setup ───────────────────────────────────────
export function setupDrop() {
  // Data panel
  const dzData = $('dz-data');
  const fiData = $('file-input');
  fiData.setAttribute('multiple', '');
  dzData.addEventListener('click', () => fiData.click());
  fiData.addEventListener('change', e => {
    Array.from(e.target.files).forEach(loadDataFile);
    e.target.value = '';
  });
  dzData.addEventListener('dragover', e => { e.preventDefault(); dzData.classList.add('dragover'); });
  dzData.addEventListener('dragleave', () => dzData.classList.remove('dragover'));
  dzData.addEventListener('drop', e => {
    e.preventDefault(); dzData.classList.remove('dragover');
    Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json')).forEach(loadDataFile);
  });

  // Schema panel
  const dzSchema = $('dz-schema');
  const fiSchema = $('schema-input');
  fiSchema.setAttribute('multiple', '');
  dzSchema.addEventListener('click', () => fiSchema.click());
  fiSchema.addEventListener('change', e => {
    Array.from(e.target.files).forEach(f => loadSchemaFile(f));
    e.target.value = '';
  });
  dzSchema.addEventListener('dragover', e => { e.preventDefault(); dzSchema.classList.add('dragover'); });
  dzSchema.addEventListener('dragleave', () => dzSchema.classList.remove('dragover'));
  dzSchema.addEventListener('drop', e => {
    e.preventDefault(); dzSchema.classList.remove('dragover');
    Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json')).forEach(f => loadSchemaFile(f));
  });
}

// ── Load a data file ─────────────────────────────────────────────────────
function loadDataFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Expected a JSON array of records');
      const fp = `${data.length}:${data.length ? JSON.stringify(data[0]).slice(0,200) : ''}`;
      if (state.pendingDatasets.find(ds => ds.fileName === file.name && ds._fp === fp)) {
        toast(`"${file.name}" already loaded \u2014 skipped.`); return;
      }
      if (state.pendingDatasets.find(ds => ds.fileName === file.name)) {
        alert(`A different file named "${file.name}" is already loaded. ` +
              `Please rename one before continuing \u2014 they will not be merged.`);
        return;
      }
      state.pendingDatasets.push({ data, fileName: file.name, _fp: fp });
      $('dz-data-hint').style.display    = 'none';
      $('btn-data-select').style.display = 'none';
      $('dz-data-ok').style.display      = '';
      $('dz-data').classList.add('loaded');
      updateDataFileList();
      $('dz-continue').style.display = '';
    } catch (err) {
      warnBanner(`Failed to parse data file "${file.name}": ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// ── Load a schema file ───────────────────────────────────────────────────
export function loadSchemaFile(file, fromDashboard = false) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const json = JSON.parse(e.target.result);
      const { schema, groupLabels } = parseSchemaFile(json);
      const fp = `${Object.keys(schema).length}:${Object.keys(schema).slice(0,5).join(',')}`;
      if (state.pendingSchemas.find(s => s.fileName === file.name && s._fp === fp)) {
        toast(`"${file.name}" already loaded \u2014 skipped.`); return;
      }
      if (state.pendingSchemas.find(s => s.fileName === file.name)) {
        alert(`A different schema file named "${file.name}" is already loaded. ` +
              `Please rename one before continuing.`);
        return;
      }
      const tentative = state.pendingSchemas.concat([{ schema, groupLabels, fileName: file.name, _fp: fp }]);
      const merged = mergeSchemas(tentative);
      if (merged.conflicts.length) {
        alert('\u26A0 Overlapping variable names \u2014 schema not loaded:\n' + merged.conflicts.join(', '));
        return;
      }

      state.pendingSchemas.push({ schema, groupLabels, fileName: file.name, _fp: fp });

      $('dz-schema-hint').style.display    = 'none';
      $('dz-schema-auto').style.display    = 'none';
      $('btn-schema-select').style.display = 'none';
      $('dz-schema-ok').style.display      = '';
      $('dz-schema').classList.add('loaded');
      updateSchemaFileList();

      applySchema(merged.schema, merged.groupLabels, 'file');
      state.pendingSchema = merged;

      if (fromDashboard && state.pendingData) {
        initApp(state.pendingData);
        toast(`\u2713 Schema updated: ${file.name}`);
      }
      if (!fromDashboard && state.pendingDatasets.length && $('dz-continue').style.display === 'none') {
        $('dz-continue').style.display = '';
      }
    } catch (err) {
      warnBanner(`Failed to parse schema file "${file.name}": ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// ── Continue to app (merge + init) ───────────────────────────────────────
export function continueToApp() {
  if (!state.pendingDatasets.length) return;
  let finalData;
  try { finalData = mergeDatasets(state.pendingDatasets); }
  catch (err) { alert('Error merging data files:\n' + err.message); return; }
  state.pendingData = finalData;

  if (state.pendingSchemas.length) {
    const { schema, groupLabels, conflicts } = mergeSchemas(state.pendingSchemas);
    if (conflicts.length) {
      alert('\u26A0 Overlapping variable names found across schema files \u2014 please fix before continuing:\n\n' +
            conflicts.join(', '));
      return;
    }
    applySchema(schema, groupLabels, 'file');
  } else {
    const inferred = inferSchemaFromData(finalData);
    applySchema(inferred.schema, inferred.groupLabels, 'inferred');
  }
  initApp(finalData);
}

// ── Reload schema from the dashboard ─────────────────────────────────────
export function reloadSchema() {
  const fi = $('schema-input-2');
  fi.onchange = e => { if (e.target.files[0]) loadSchemaFile(e.target.files[0], true); fi.value = ''; };
  fi.click();
}

// ── Initialise app after data load ───────────────────────────────────────
export function initApp(data) {
  state.rawData    = data;
  state.cohortData = data;

  const wb = $('warn-banner');
  if (wb) { wb.style.display = 'none'; $('warn-banner-text').innerHTML = ''; }

  $('load-screen').classList.remove('active');
  $('sidebar').style.display   = 'flex';
  $('nav-tabs').style.display  = 'flex';
  $('cohort-badge').style.display = 'flex';

  $('total-count').textContent  = data.length;
  $('cohort-count').textContent = data.length;

  // Rebuild group filter buttons
  state.activeGroup = 'all';
  const gf = $('group-filter');
  gf.innerHTML = '<button class="gf-btn active" data-group="all">All</button>';
  const usedGroups = [...new Set(
    Object.values(state.SCHEMA).map(s => s.group).filter(g => g && g !== 'id')
  )].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  usedGroups.forEach(g => {
    const lbl = state.GROUP_LABELS[g] || (g.charAt(0).toUpperCase() + g.slice(1));
    const btn = document.createElement('button');
    btn.className = 'gf-btn';
    btn.dataset.group = g;
    btn.textContent = lbl;
    gf.appendChild(btn);
  });

  // Schema <-> data mismatch check
  if (data.length && state.schemaSource !== 'inferred') {
    const dataCols   = new Set(Object.keys(data[0]));
    const schemaCols = new Set(Object.keys(state.SCHEMA));

    const knownIdFields = new Set(['R0_TCode', 'TCode']);
    state.pendingSchemas.forEach(({ schema }) => {
      Object.entries(schema).forEach(([k, v]) => { if (v.group === 'id') knownIdFields.add(k); });
    });

    const inDataOnly   = [...dataCols].filter(k => !schemaCols.has(k) && !knownIdFields.has(k));
    const inSchemaOnly = [...schemaCols].filter(k => !dataCols.has(k));

    if (inDataOnly.length) {
      const extra = inferSchemaFromData(data);
      inDataOnly.forEach(k => { if (extra.schema[k]) state.SCHEMA[k] = extra.schema[k]; });
    }
    if (inSchemaOnly.length) {
      warnBanner(`\u26A0 ${inSchemaOnly.length} schema variable(s) not found in data and will be ignored:`, inSchemaOnly.join(', '));
    }
    if (inDataOnly.length) {
      warnBanner(`\u2139 ${inDataOnly.length} data column(s) not in schema \u2014 types have been auto-inferred:`, inDataOnly.join(', '));
    }
  }

  renderVarList();
  populateStratSelects();
  showTab('overview');
  renderOverview();
  renderMissingness();
  buildAttritionFlow();

  const nVars = Object.keys(state.SCHEMA).filter(k => state.SCHEMA[k].type !== 'string').length;
  toast(`\u2713 Loaded ${data.length.toLocaleString()} records \u00B7 ${nVars} variables \u00B7 schema: ${state.schemaSource}`);
}
