/* ============================================================
   Explore tab: variable detail panel and chart drawing.
   ============================================================ */

'use strict';

import { state } from '../state.js';
import { $, esc, fmt, pct, arrMin, arrMax, typeClass, getValidValues, summarise, freqTable } from '../utils.js';

export function renderVarDetail(key, data) {
  const s = state.SCHEMA[key];
  if (!s) return;

  $('explore-prompt').style.display = 'none';
  $('var-detail').style.display     = 'block';
  $('detail-title').innerHTML = `${esc(key)} <span class="badge">${esc(s.group)}</span> <span style="font-size:12px;font-weight:400;color:var(--muted)">${esc(s.unit || '')}</span>`;

  $('detail-meta').innerHTML = `
    <div class="var-meta-row"><span class="meta-label">Description</span><span class="meta-val">${esc(s.desc)}</span></div>
    <div class="var-meta-row"><span class="meta-label">Type</span><span class="meta-val"><span class="var-type-pill ${typeClass(s.type)}">${esc(s.type)}</span></span></div>
    ${s.sentinel !== undefined ? `<div class="var-meta-row"><span class="meta-label">Sentinel</span><span class="meta-val">${esc(s.sentinel)} = Not Applicable</span></div>` : ''}
  `;

  const allVals  = data.map(r => r[key]);
  const sentinel = s.sentinel;
  const validVals= getValidValues(key, data);
  const nullCount= allVals.filter(v => v === null || v === undefined).length;
  const sentCount= sentinel != null ? allVals.filter(v => v === sentinel).length : 0;

  const statsEl = $('detail-stats');
  statsEl.innerHTML = '';

  function statChip(val, label) {
    const d = document.createElement('div');
    d.className = 'stats-mini-item';
    d.innerHTML = `<div class="sv">${esc(val)}</div><div class="sl">${esc(label)}</div>`;
    statsEl.appendChild(d);
  }

  statChip(validVals.length, 'Valid');
  statChip(`${pct(nullCount, data.length)}`, 'Missing (null)');
  if (sentCount > 0) statChip(sentCount, `Sentinel (${sentinel})`);

  if (s.type === 'numeric' || s.type === 'integer') {
    const ss = summarise(validVals);
    if (ss) {
      statChip(fmt(ss.mean, 1), 'Mean');
      statChip(fmt(ss.sd, 1), 'SD');
      statChip(fmt(ss.median, 1), 'Median');
      statChip(`${fmt(ss.min,1)} \u2013 ${fmt(ss.max,1)}`, 'Range');
    }
  } else {
    const ft = freqTable(validVals);
    const top = ft.slice(0, 3);
    top.forEach(([code, cnt]) => {
      const label = (s.codes && s.codes[code]) ? s.codes[code] : code;
      statChip(cnt, label.length > 12 ? label.slice(0,12)+'\u2026' : label);
    });
  }

  const btnContainer = $('chart-type-btns');
  btnContainer.innerHTML = '';
  const isNumeric = s.type === 'numeric' || s.type === 'integer';
  const modes = isNumeric ? ['histogram', 'violin', 'bar'] : ['bar', 'pie'];
  state.chartMode = modes[0];
  modes.forEach(mode => {
    const b = document.createElement('button');
    b.className = 'chart-btn' + (state.chartMode === mode ? ' active' : '');
    b.textContent = {histogram:'Histogram', violin:'Violin Plot', bar:'Bar chart', pie:'Pie chart'}[mode];
    b.onclick = () => {
      state.chartMode = mode;
      btnContainer.querySelectorAll('.chart-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      drawChart(key, data);
    };
    btnContainer.appendChild(b);
  });

  const dlBtn = document.createElement('button');
  dlBtn.className = 'btn-download-png';
  dlBtn.title = 'Download chart as PNG';
  dlBtn.innerHTML = '&#8595; PNG';
  dlBtn.onclick = () => window.App.downloadChartPNG();
  btnContainer.appendChild(dlBtn);

  drawChart(key, data);

  const dedupNote = $('chart-dedup-note');
  if (dedupNote) {
    dedupNote.style.display = state.DEDUP_VARIABLES.has(key) ? '' : 'none';
  }

  const enumCard = $('enum-card');
  if (s.codes) {
    enumCard.style.display = 'block';
    $('enum-legend').innerHTML = Object.entries(s.codes)
      .map(([code, label]) => `<div class="enum-item"><span class="enum-code">${esc(code)}</span><span>${esc(label)}</span></div>`)
      .join('');
  } else {
    enumCard.style.display = 'none';
  }
}

// ── Chart drawing ─────────────────────────────────────────────────────────
export function drawChart(key, data) {
  if (state.mainChart) { state.mainChart.destroy(); state.mainChart = null; }
  const ctx = $('main-chart').getContext('2d');
  const s   = state.SCHEMA[key];
  const values = getValidValues(key, data);

  const PALETTE = ['#6B58A0','#B9E05D','#A599C7','#d46c00','#3a3358','#3d8b5c','#c0392b','#4f3f7a'];

  if (state.chartMode === 'histogram') {
    const nums = values.map(Number).filter(n => !isNaN(n));
    const min = arrMin(nums), max = arrMax(nums);
    const range = max - min;
    const isInt = s.type === 'integer';

    let buckets, labels;

    if (isInt && range <= 50) {
      const numBins = range + 1;
      labels  = Array.from({length: numBins}, (_, i) => String(Math.round(min) + i));
      buckets = Array(numBins).fill(0);
      nums.forEach(v => {
        const idx = Math.round(v) - Math.round(min);
        if (idx >= 0 && idx < numBins) buckets[idx]++;
      });
    } else {
      const TARGET_BINS = 30;
      const step = isInt
        ? Math.max(1, Math.ceil(range / TARGET_BINS))
        : (range / TARGET_BINS || 1);
      const numBins = isInt
        ? Math.ceil((range + 1) / step)
        : TARGET_BINS;
      labels = Array.from({length: numBins}, (_, i) => {
        const lo = min + i * step;
        if (isInt) {
          const hi = Math.min(lo + step - 1, max);
          return step === 1 ? String(Math.round(lo)) : `${Math.round(lo)}\u2013${Math.round(hi)}`;
        }
        return fmt(lo, 1);
      });
      buckets = Array(numBins).fill(0);
      nums.forEach(v => {
        const idx = Math.min(numBins - 1, Math.floor((v - min) / step));
        buckets[idx]++;
      });
    }

    state.mainChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: key, data: buckets,
        backgroundColor: '#6B58A088', borderColor: '#6B58A0', borderWidth: 1 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {
        x: { title: { display: true, text: s.unit ? `${key} (${s.unit})` : key } },
        y: { title: { display: true, text: 'Count' } }
      }}
    });

  } else if (state.chartMode === 'violin') {
    const nums = values.map(Number).filter(n => !isNaN(n));
    if (!nums.length) return;
    state.mainChart = new Chart(ctx, {
      type: 'violin',
      data: {
        labels: [s.label || key],
        datasets: [{
          label: key,
          data: [nums],
          backgroundColor: '#6B58A030',
          borderColor: '#6B58A0',
          borderWidth: 2,
          medianColor: '#B9E05D',
          meanColor: '#B9E05D',
          itemRadius: 0,
          barPercentage: 0.25,
          categoryPercentage: 1.0,
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            title: { display: true, text: s.unit ? `${key} (${s.unit})` : key },
            min: arrMin(nums) - (arrMax(nums) - arrMin(nums)) * 0.05,
            max: arrMax(nums) + (arrMax(nums) - arrMin(nums)) * 0.05,
          }
        }
      }
    });

  } else {
    // Bar chart or Pie chart
    let ft;
    if (s.type === 'integer' && new Set(values).size > 15) {
      const nums = values.map(Number);
      const min = arrMin(nums), max = arrMax(nums);
      const bins = 12, step = Math.ceil((max - min + 1) / bins);
      const buckets = {}, labels = [];
      for (let i = min; i <= max; i += step) {
        const label = i + (step > 1 ? `\u2013${i + step - 1}` : '');
        labels.push(label);
        buckets[label] = 0;
      }
      nums.forEach(v => {
        const idx = Math.floor((v - min) / step);
        const label = labels[Math.min(idx, labels.length - 1)];
        if (label !== undefined) buckets[label]++;
      });
      ft = Object.entries(buckets);
    } else {
      ft = freqTable(values.map(String));
      ft = ft.slice(0, 20);
    }

    if (s.type === 'integer' || s.type === 'numeric') {
      ft.sort((a, b) => {
        const na = Number(a[0]), nb = Number(b[0]);
        const sentA = s.sentinel != null && na === Number(s.sentinel);
        const sentB = s.sentinel != null && nb === Number(s.sentinel);
        if (sentA && !sentB) return 1;
        if (!sentA && sentB) return -1;
        return na - nb;
      });
    } else if (s.codes) {
      ft.sort((a, b) => {
        const priority = code => {
          const lbl = (s.codes[code] || '').toLowerCase();
          const n = Number(code);
          if (lbl.startsWith('yes')) return 0;
          if (lbl.startsWith('no'))  return 1;
          if (s.sentinel != null && n === Number(s.sentinel)) return 9999;
          return 2 + n;
        };
        return priority(a[0]) - priority(b[0]);
      });
    }

    const labels = ft.map(([code]) => {
      const label = s.codes && s.codes[code] ? s.codes[code] : code;
      return label.length > 22 ? label.slice(0, 22) + '\u2026' : label;
    });

    const counts = ft.map(([,n]) => n);
    const bgColors = ft.map((_, i) => PALETTE[i % PALETTE.length] + 'cc');
    const bdColors = ft.map((_, i) => PALETTE[i % PALETTE.length]);

    if (state.chartMode === 'pie') {
      const total = counts.reduce((a, b) => a + b, 0);
      state.mainChart = new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data: counts, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 2 }] },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { font: { size: 12 }, padding: 14 } },
            tooltip: { callbacks: { label: c =>
              ` ${c.label}: ${c.parsed} (${((c.parsed/total)*100).toFixed(1)}%)`
            }}
          }
        }
      });
    } else {
      state.mainChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Count', data: counts, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 1 }] },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxRotation: 45 } },
            y: { title: { display: true, text: 'Count' }, beginAtZero: true }
          }
        }
      });
    }
  }
}
