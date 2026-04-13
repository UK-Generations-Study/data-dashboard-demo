/* ============================================================
   Entry point — wires up event listeners and the DOMContentLoaded
   bootstrap. Loaded as <script type="module">.
   ============================================================ */

'use strict';

import { state } from './state.js';
import { $ } from './utils.js';
import { setupDrop, continueToApp, reloadSchema } from './data-loader.js';
import { showTab } from './views/tabs.js';
import { renderVarList } from './views/sidebar.js';
import { renderMissingness } from './views/missingness.js';
import { renderStratified } from './views/stratified.js';
import { renderTable1, exportTable1CSV } from './views/table1.js';
import { addFilter, removeFilter, updateFilter, clearFilters, initFilterDelegation } from './views/cohort.js';
import { downloadChartPNG, exportAttritionPNG, exportCohort } from './exports.js';

// ── Public API (used by event delegation; frozen to prevent tampering) ──
window.App = Object.freeze({
  addFilter,
  removeFilter,
  updateFilter,
  clearFilters,
  exportCohort,
  exportAttritionPNG,
  renderStratified,
  renderTable1,
  exportTable1CSV,
  downloadChartPNG,
  continueToApp,
  reloadSchema,
});

// ── Helper: attach click listener with stopPropagation for file inputs ──
function fileClick(btnId, inputId) {
  const btn = $(btnId);
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); $(inputId).click(); });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupDrop();

  // Logo fallback (replaces inline onerror)
  const logoWordmark = $('logo-wordmark');
  if (logoWordmark) logoWordmark.addEventListener('error', () => { logoWordmark.style.display = 'none'; });

  // Warning banner dismiss
  $('warn-banner-close').addEventListener('click', () => { $('warn-banner').style.display = 'none'; });

  // Sidebar schema reload
  $('btn-reload-schema').addEventListener('click', () => App.reloadSchema());

  // Load-screen file selection buttons
  fileClick('btn-data-select', 'file-input');
  fileClick('btn-add-data-file', 'file-input');
  fileClick('btn-schema-select', 'schema-input');
  fileClick('btn-add-schema-file', 'schema-input');

  // Continue to dashboard
  $('btn-continue').addEventListener('click', () => App.continueToApp());

  // Stratified comparison
  $('btn-strat-compare').addEventListener('click', () => App.renderStratified());

  // Cohort builder buttons
  $('btn-add-filter').addEventListener('click', () => App.addFilter());
  $('btn-export-cohort').addEventListener('click', () => App.exportCohort());
  $('btn-export-attrition').addEventListener('click', () => App.exportAttritionPNG());
  $('btn-clear-filters').addEventListener('click', () => App.clearFilters());

  // Descriptive / Table 1 buttons
  $('btn-render-table1').addEventListener('click', () => App.renderTable1());
  $('btn-export-table1-csv').addEventListener('click', () => App.exportTable1CSV());

  // Cohort filter rows — event delegation (replaces inline handlers)
  initFilterDelegation();

  // Tab clicks
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      showTab(name);
      if (name === 'table1') renderTable1();
      if (name === 'missingness') renderMissingness(state.cohortData);
    });
  });

  // Sidebar search
  $('var-search').addEventListener('input', renderVarList);

  // Group filter buttons
  $('group-filter').addEventListener('click', e => {
    const btn = e.target.closest('.gf-btn');
    if (!btn) return;
    document.querySelectorAll('.gf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeGroup = btn.dataset.group;
    renderVarList();
  });

  // Mobile sidebar toggle
  const sidebarToggle = $('btn-sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
    document.querySelector('.app-shell').addEventListener('click', e => {
      if (!e.target.closest('.sidebar') && !e.target.closest('#btn-sidebar-toggle')) {
        document.body.classList.remove('sidebar-open');
      }
    });
  }
});
