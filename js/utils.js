/* ============================================================
   Pure helpers and DOM utilities.
   ============================================================ */

'use strict';

import { state } from './state.js';

// ── DOM shortcuts ─────────────────────────────────────────────────────────
export const $ = id => document.getElementById(id);
export const qs = sel => document.querySelector(sel);

// ── HTML escaping ─────────────────────────────────────────────────────────
// Data and schema files are loaded from disk and may contain untrusted
// strings — every data-derived string must be passed through this before
// being embedded as HTML.
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Iterative min/max (avoids call-stack overflow on large arrays) ────────
export function arrMin(arr) {
  let m = Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}
export function arrMax(arr) {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

// ── Formatting ────────────────────────────────────────────────────────────
export function fmt(n, dec=1) {
  if (n === null || n === undefined || isNaN(n)) return '\u2014';
  return Number(n).toFixed(dec);
}
export function pct(n, total) { return total ? ((n / total) * 100).toFixed(1) + '%' : '\u2014'; }

// ── Type helpers ──────────────────────────────────────────────────────────
export function typeClass(t) {
  return `type-${String(t).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// True for any variable that is an identifier field — any schema entry
// whose group is 'id', plus the well-known TCode column names.
export function isIdField(key) {
  if (!key) return false;
  if (key === 'R0_TCode' || key === 'TCode') return true;
  const s = state.SCHEMA[key];
  return !!(s && s.group === 'id');
}

// ── Data helpers ──────────────────────────────────────────────────────────
export function getValidValues(key, data) {
  const s = state.SCHEMA[key];
  const sentinel = s ? s.sentinel : null;
  return data
    .map(r => r[key])
    .filter(v => v !== null && v !== undefined && (sentinel == null || v !== sentinel));
}

export function isMissing(v, sentinel) {
  if (v === null || v === undefined) return true;
  if (sentinel && (v === sentinel || v === 9999)) return false; // sentinel != missing
  return false;
}

export function summarise(values) {
  const nums = values.map(Number).filter(n => !isNaN(n));
  if (!nums.length) return null;
  nums.sort((a, b) => a - b);
  const n = nums.length;
  const mean = nums.reduce((s, v) => s + v, 0) / n;
  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const q = p => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return nums[lo] + (nums[hi] - nums[lo]) * (idx - lo);
  };
  return { n, mean, sd: Math.sqrt(variance),
    min: nums[0], q1: q(0.25), median: q(0.5), q3: q(0.75), max: nums[n-1] };
}

export function freqTable(values) {
  const counts = Object.create(null);
  values.forEach(v => { const k = String(v); counts[k] = (counts[k] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ── Toast / warning banner ────────────────────────────────────────────────
export function toast(msg, ms=2500) {
  const el = $('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, ms);
}

// Persistent dismissible warning banner — stays until the user closes it.
// Accepts structured data: a plain text message and an optional list of
// strings to emphasise, avoiding raw-HTML injection.
export function warnBanner(msg, emphasise) {
  const banner = $('warn-banner');
  const text   = $('warn-banner-text');
  if (!banner || !text) return;

  const line = document.createElement('div');
  if (emphasise) {
    const span1 = document.createElement('span');
    span1.textContent = msg + ' ';
    line.appendChild(span1);
    const strong = document.createElement('strong');
    strong.textContent = emphasise;
    line.appendChild(strong);
  } else {
    line.textContent = msg;
  }

  if (banner.style.display === 'flex' && text.hasChildNodes()) {
    text.appendChild(line);
  } else {
    text.innerHTML = '';
    text.appendChild(line);
    banner.style.display = 'flex';
  }
}
