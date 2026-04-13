/* ============================================================
   Schema parsing, inference, and application.
   ============================================================ */

'use strict';

import { BUILTIN_SCHEMA, BUILTIN_GROUP_LABELS, state } from './state.js';
import { $ } from './utils.js';

// ── Parse a loaded JSON object into {schema, groupLabels} ─────────────────
// Supports:
//   1. JSON Schema Draft 2020-12  (has "properties" or "$schema")
//   2. App internal format        (object of {desc, type, group, ...} entries)
const DENIED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function parseSchemaFile(json) {
  let schema = Object.create(null), groupLabels = Object.create(null);

  function resolveJsonType(t) {
    if (!t) return null;
    if (Array.isArray(t)) return t.find(x => x !== 'null') || null;
    return t;
  }

  function inferRawType(prop) {
    const t = resolveJsonType(prop.type);
    if (t) return t;
    const variants = prop.oneOf || prop.anyOf;
    if (Array.isArray(variants)) {
      for (const v of variants) {
        if (v.type && v.type !== 'null' && v.const === undefined) return v.type;
      }
    }
    return null;
  }

  function extractCodes(prop) {
    if (prop['x-codes'])  return prop['x-codes'];
    if (prop['x-labels']) return prop['x-labels'];
    if (prop.codes)       return prop.codes;
    const variants = prop.oneOf || prop.anyOf;
    if (Array.isArray(variants)) {
      const hasNumericType = variants.some(
        v => (v.type === 'number' || v.type === 'integer') && v.const === undefined
      );
      if (hasNumericType) return null;
      const map = Object.create(null);
      variants.forEach(v => {
        if (v.const !== undefined && v.title) map[String(v.const)] = v.title;
        else if (v.const !== undefined && v.description) map[String(v.const)] = v.description;
      });
      if (Object.keys(map).length) return map;
    }
    if (Array.isArray(prop.enum) && Array.isArray(prop.enumNames)) {
      const map = Object.create(null);
      prop.enum.forEach((v, i) => {
        if (v !== null) map[String(v)] = prop.enumNames[i] || String(v);
      });
      return map;
    }
    if (Array.isArray(prop.enum) && Array.isArray(prop.enumDescriptions)) {
      const map = Object.create(null);
      prop.enumDescriptions.forEach(desc => {
        const colonIdx = desc.indexOf(': ');
        if (colonIdx === -1) return;
        const valStr = desc.substring(0, colonIdx).trim();
        if (valStr.toLowerCase() === 'null') return;
        const label = desc.substring(colonIdx + 2).replace(/\.$/, '').trim();
        map[valStr] = label;
      });
      if (Object.keys(map).length) return map;
    }
    if (Array.isArray(prop.enum) && prop.enum.length <= 20) {
      const map = Object.create(null);
      prop.enum.forEach(v => { if (v !== null) map[String(v)] = String(v); });
      return map;
    }
    return null;
  }

  if (json.properties || json.$schema) {
    // ── JSON Schema Draft 2020-12 (or similar) ──────────────────────────
    const props = json.properties || {};
    const groups = new Set();

    Object.entries(props).forEach(([key, prop]) => {
      if (DENIED_KEYS.has(key)) return;
      const rawJsonType = inferRawType(prop);
      const xType    = prop['x-type'] || prop['x-variableType'] || prop.variableType || null;
      const codes    = extractCodes(prop);

      let sentinel = prop['x-sentinel'] !== undefined ? prop['x-sentinel']
                   : prop.sentinel      !== undefined ? prop.sentinel : null;
      if (sentinel === null) {
        const variants = prop.oneOf || prop.anyOf;
        if (Array.isArray(variants)) {
          for (const v of variants) {
            if (v.const !== undefined && (v.title === 'NA' || v.description === 'NA'
                || String(v.title).toLowerCase().includes('not applicable')
                || String(v.description).toLowerCase().includes('not applicable'))) {
              sentinel = v.const;
              break;
            }
          }
        }
      }

      const group    = prop['x-group'] || prop['x-category'] || prop.group || prop.category || 'data';
      const desc     = prop.description || prop.title || key;
      let unit = prop['x-unit'] || prop.unit || null;
      if (!unit) {
        const m = desc.match(/\(([^)]+)\)\s*\.?\s*$/);
        if (m && !/\s/.test(m[1])) unit = m[1];
      }

      let type = xType;
      if (!type) {
        if (codes) {
          const nonSentinelKeys = Object.keys(codes).filter(k => +k !== 999 && +k !== 9999);
          type = nonSentinelKeys.length <= 2 ? 'binary' : 'categorical';
        } else if (rawJsonType === 'number')  { type = 'numeric';  }
        else if (rawJsonType === 'integer')   { type = 'integer';  }
        else if (rawJsonType === 'boolean')   { type = 'binary';   }
        else if (rawJsonType === 'string')    { type = 'string';   }
        else                                  { type = 'numeric';  }
      }

      const entry = { desc, group, type };
      if (unit)            entry.unit     = unit;
      if (sentinel !== null) entry.sentinel = sentinel;
      if (codes)           entry.codes    = codes;
      groups.add(group);
      schema[key] = entry;
    });

    groups.forEach(g => {
      const labelMap = json['x-groupLabels'] || json.groupLabels || {};
      groupLabels[g] = labelMap[g] || (g.charAt(0).toUpperCase() + g.slice(1).replace(/[_-]/g, ' '));
    });

  } else {
    // ── App internal format ──────────────────────────────────────────────
    Object.entries(json).forEach(([k, v]) => {
      if (!DENIED_KEYS.has(k)) schema[k] = v;
    });
    const groups = new Set(Object.values(schema).map(v => v.group).filter(Boolean));
    groups.forEach(g => {
      if (!DENIED_KEYS.has(g)) groupLabels[g] = g.charAt(0).toUpperCase() + g.slice(1).replace(/[_-]/g, ' ');
    });
  }

  // Backfill from BUILTIN_SCHEMA if schema has no group information
  const allDefault = Object.values(schema).every(v => !v.group || v.group === 'data');
  if (allDefault) {
    Object.keys(schema).forEach(key => {
      if (BUILTIN_SCHEMA[key] && BUILTIN_SCHEMA[key].group) {
        schema[key].group = BUILTIN_SCHEMA[key].group;
      }
    });
    const usedGrps = new Set(Object.values(schema).map(v => v.group).filter(Boolean));
    usedGrps.forEach(g => {
      if (!groupLabels[g]) groupLabels[g] = BUILTIN_GROUP_LABELS[g] || (g.charAt(0).toUpperCase() + g.slice(1).replace(/[_-]/g, ' '));
    });
  }

  return { schema, groupLabels };
}

// ── Auto-infer a minimal schema from data ─────────────────────────────────
export function inferSchemaFromData(data) {
  if (!data.length) return { schema: Object.create(null), groupLabels: { data: 'Data' } };
  const keys = Object.keys(data[0]).filter(k => !DENIED_KEYS.has(k));
  const schema = Object.create(null);
  keys.forEach(key => {
    const vals = data.map(r => r[key]).filter(v => v !== null && v !== undefined);
    if (!vals.length) { schema[key] = { desc: key, group: 'data', type: 'string' }; return; }
    const nums = vals.map(Number).filter(n => !isNaN(n));
    const unique = [...new Set(vals.map(String))].sort((a, b) => +a - +b);
    let type, codes;
    if (nums.length === vals.length) {
      if (unique.length <= 2)  { type = 'binary';      codes = Object.fromEntries(unique.map(v => [v, v])); }
      else if (unique.length <= 12) { type = 'categorical'; codes = Object.fromEntries(unique.map(v => [v, v])); }
      else if (nums.every(n => Number.isInteger(n))) { type = 'integer'; }
      else { type = 'numeric'; }
    } else {
      type = 'string';
    }
    const entry = { desc: key, group: 'data', type };
    if (codes) entry.codes = codes;
    schema[key] = entry;
  });
  return { schema, groupLabels: { data: 'Data' } };
}

// ── Merge multiple schema files ───────────────────────────────────────────
export function mergeSchemas(schemas) {
  const merged = Object.create(null), mergedLabels = Object.create(null), conflicts = [];
  schemas.forEach(({ schema, groupLabels }) => {
    Object.entries(schema).forEach(([key, entry]) => {
      if (DENIED_KEYS.has(key) || entry.group === 'id') return;
      if (key in merged) { conflicts.push(key); }
      else               { merged[key] = entry; }
    });
    Object.entries(groupLabels).forEach(([k, v]) => {
      if (!DENIED_KEYS.has(k)) mergedLabels[k] = v;
    });
  });
  return { schema: merged, groupLabels: mergedLabels, conflicts };
}

// ── Apply a schema to global state ────────────────────────────────────────
export function applySchema(schema, groupLabels_, source) {
  const s = Object.create(null);
  Object.entries(schema).forEach(([k, v]) => { if (!DENIED_KEYS.has(k)) s[k] = v; });
  state.SCHEMA = s;
  const gl = Object.create(null);
  Object.entries(groupLabels_).forEach(([k, v]) => { if (!DENIED_KEYS.has(k)) gl[k] = v; });
  state.GROUP_LABELS = gl;
  state.schemaSource = source;
  if (source === 'inferred') {
    $('dz-schema-hint').style.display = 'none';
    $('dz-schema-auto').style.display = '';
  }
}
