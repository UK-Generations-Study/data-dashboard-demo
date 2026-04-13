/* ============================================================
   Tab navigation.
   ============================================================ */

'use strict';

import { $ } from '../utils.js';

export function showTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
  });
  const panel = $('tab-' + name) || $('load-screen');
  if (panel) panel.classList.add('active');
}
