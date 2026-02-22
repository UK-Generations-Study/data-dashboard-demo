# Generations Study – Derived Data Dashboard (Demo)

A browser-based prototype for exploring the Generations Study derived dataset.
All processing occurs **locally in your browser** — no data is transmitted externally.

---

## Quick Start

```
generations-demo/
├── index.html            ← Open this file to launch the dashboard
├── app.js                ← Dashboard logic
├── synthetic_data.json   ← 1000-participant synthetic dataset
├── sample_cohort.json    ← Example cohort definition (JSON)
├── generate_data.py      ← Python script that produced the dataset
├── examples.R            ← R loading and analysis examples
├── examples.py           ← Python loading and analysis examples
└── README.md             ← This file
```

### To run

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
2. Click **Select File** or drag-and-drop `synthetic_data.json` onto the drop zone
3. The dashboard loads immediately — no installation, no server required

> **Note:** Chart.js is loaded from CDN (`cdn.jsdelivr.net`). An internet connection is required for the initial page load. Once loaded, all functionality is offline.

---

## Dashboard Features

| Tab | What it does |
|---|---|
| **Overview** | Dataset summary — participant count, completeness, variable groups |
| **Explore** | Click any variable in the sidebar for histogram / bar chart / box plot + summary stats |
| **Missingness** | Horizontal bar chart of null % and sentinel NA % for all variables |
| **Stratified** | Compare a numeric variable's distribution across groups of a categorical variable |
| **Cohort Builder** | Build AND/OR filter chains with live cohort size; export cohort JSON |
| **Table 1** | Summary statistics table for the active cohort; optional stratification; CSV export |

### Sidebar

- **Search box** — filter variables by name or description
- **Group buttons** — filter by: Body, Repro, Lifestyle, Medical, Family
- **Click any variable** — jumps to Explore tab with that variable selected

---

## Synthetic Dataset

- **1000 participants**, all fields drawn from the `DerivedVariables.json` schema
- Realistic epidemiological distributions (BMI ~N(24.5, 4.5), smoking ~16%, etc.)
- Logical coherence maintained: BMI derived from height/weight; parity consistent with `R0_Parous`; HRT confined to older/postmenopausal participants; etc.
- Plausible missingness (~3–15% per variable; higher for age-conditional variables)
- Sentinel values (999 / 9999) preserved exactly as schema defines them
- No real participant data — all values are synthetic

### Regenerate

```bash
python3 generate_data.py
```

---

## Variable Types

| Type pill | Meaning |
|---|---|
| `numeric` | Continuous measurement (e.g. BMI, physical activity) |
| `integer` | Whole-number count or age |
| `categorical` | Coded integer with labelled categories |
| `binary` | 0/1 flag |

### Sentinel values

Some variables use `999` (or `9999`) to mean "Not Applicable" — distinct from `null` (missing/unknown):

| Sentinel | Example | Meaning |
|---|---|---|
| `999` | `R0_BMI` | Pregnant at study entry — BMI not calculated |
| `999` | `R0_AgeBirthFirst` | No live birth |
| `9999` | `R0_BreastfeedingDuration` | No live birth |

Filter out sentinels before analysis: see `examples.R` / `examples.py`.

---

## Sample Cohort Definition

`sample_cohort.json` defines:

> Premenopausal + Parous + BMI > 25 + Current alcohol drinker

```json
{
  "filters": [
    { "field": "R0_Menopause",     "operator": "in", "value": "2", "logic": "AND" },
    { "field": "R0_Parous",        "operator": "in", "value": "1", "logic": "AND" },
    { "field": "R0_BMI",           "operator": ">",  "value": "25","logic": "AND" },
    { "field": "R0_AlcoholStatus", "operator": "in", "value": "2", "logic": "AND" }
  ]
}
```

Apply in **R**:
```r
df_cohort <- df[df$R0_Menopause==2 & df$R0_Parous==1 & df$R0_BMI>25 & df$R0_AlcoholStatus==2, ]
```

Apply in **Python**:
```python
mask = (df.R0_Menopause==2) & (df.R0_Parous==1) & (df.R0_BMI>25) & (df.R0_AlcoholStatus==2)
df_cohort = df[mask]
```

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Single-page HTML + vanilla JS | No build step, no server, open and run |
| Chart.js via CDN | Mature, well-maintained; avoids embedding 200 KB of library code |
| Drag-and-drop data loading | Matches privacy requirement; data never leaves device |
| Sidebar + tab layout | Separates variable navigation from analytical views |
| Sentinel vs null distinction | Preserves schema semantics in missingness visualisation |
| Cohort export as JSON | Machine-readable; reproducible; includes full R0_TCode list |
| Generate-then-load architecture | Dataset is separate from app — analysts can load real data when available |

---

## Requirements

- **Dashboard:** any modern browser; internet for initial CDN load
- **generate_data.py:** Python 3.7+ (stdlib only)
- **examples.R:** R + `jsonlite` (optionally `tableone`)
- **examples.py:** Python + `pandas`, `numpy`, `matplotlib`

---

*This is a synthetic demonstration. All participant records are fictitious.*
*Schema: `DerivedVariables.json` (Draft 2020-12) — Breakthrough Generations Study.*
