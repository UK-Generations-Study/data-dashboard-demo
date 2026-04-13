<p align="center">
  <img src="assets/logo-g.png" alt="Generations Study" height="64" />
</p>

<h1 align="center">Generations Study — Data Dashboard</h1>

<p align="center">
  A browser-based tool for exploring, filtering, and summarising<br>
  Breast Cancer Now Generations Study data.
</p>

<p align="center">
  <a href="https://uk-generations-study.github.io/data-dashboard-demo/"><strong>Open the Dashboard</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/data_processing-100%25_local-4caf50?style=flat-square" alt="100% local processing" />
  <img src="https://img.shields.io/badge/network_requests-none-2196f3?style=flat-square" alt="No network requests" />
  <img src="https://img.shields.io/badge/installation-not_required-9c27b0?style=flat-square" alt="No install required" />
</p>

---

## Quick Start

Open the dashboard at **https://uk-generations-study.github.io/data-dashboard-demo/**.

### Loading data

1. Drag-and-drop one or more `.json` data files onto the **Data File** drop zone
2. Optionally drag-and-drop matching JSON Schema files onto the **Schema File** drop zone
3. Click **Continue to Dashboard**

To try the dashboard with the included synthetic data, use the files in `examples/` (e.g. `synthetic_data.json` + `DerivedVariables_Schema.json`).

### Multi-file merge

When multiple data files are loaded, they are combined via a full outer join on participant ID (`TCode`). Participants not present in all files are retained. Each file must have exactly one row per TCode — files with duplicate TCodes are rejected with an error.

> **Note:** Variable names must not overlap across schema files. If they do, an error is shown before loading.

---

## Features

| Tab | Description |
|:---|:---|
| **Overview** | Participant count, completeness, and variable group summary |
| **Explore** | Histogram, bar chart, violin plot, or pie chart per variable with summary stats and PNG download |
| **Missingness** | Horizontal bar chart showing null % and sentinel NA % across all variables |
| **Stratified** | Side-by-side distributions of a numeric variable split by a categorical grouping variable |
| **Cohort Builder** | AND/OR filter chains with live preview, attrition flow diagram, and JSON/PNG export |
| **Descriptive** | Table 1 — summary statistics for the active cohort with optional stratification and CSV export |

### Sidebar

- **Search** — filter variables by name or description
- **Group buttons** — filter by variable group (Demographics, Anthropometry, Reproductive, Lifestyle, etc.)
- **Click any variable** — jumps to the Explore tab with that variable selected
- **Mobile** — tap the &#9776; button to open the sidebar as an overlay

### Schema file (optional)

Loading a JSON Schema file (Draft 2020-12) enriches the dashboard with human-readable labels, correct variable types, code lookups (e.g. `0 = No`, `1 = Yes`), units on chart axes, variable groupings, and sentinel value definitions.

---

## Privacy & Security

All data handling occurs entirely within your browser via the `FileReader` API.
No participant data is uploaded, transmitted, or stored anywhere outside your device.
All vendor libraries are bundled locally — no CDN or external network requests are made.

---

## Repository Structure

```
index.html                              Main dashboard page
js/
  main.js                               Entry point and event wiring
  state.js                              Shared mutable application state
  utils.js                              DOM utilities, escaping, statistics helpers
  schema.js                             Schema parsing, inference, and merging
  data-loader.js                        File loading, dataset merging, drag-drop
  exports.js                            Branded PNG and JSON export helpers
  views/
    tabs.js                             Tab switching
    sidebar.js                          Variable list and selection
    overview.js                         Overview tab
    explore.js                          Variable detail panel and chart drawing
    missingness.js                      Missingness chart
    stratified.js                       Stratified comparison
    cohort.js                           Cohort builder, filters, and attrition flow
    table1.js                           Descriptive statistics table and CSV export
vendor/
  chart.umd.min.js                      Chart.js
  chartjs-chart-boxplot.umd.min.js      Chart.js box plot plugin
  html2canvas.min.js                    HTML-to-canvas for PNG export
  fonts/nunito.css                      Nunito web font
assets/
  logo-g.png                            Logo icon
  logo-white.png                        Logo wordmark
examples/
  synthetic_data.json                   1,000-participant synthetic dataset
  synthetic_cancer_data.json            Synthetic cancer summary (231 records)
  DerivedVariables_Schema.json          JSON Schema for derived variables
  CancerSummary_Schema.json             JSON Schema for cancer summary
  sample_cohort.json                    Example cohort definition
  generate_data.py                      Script that produced synthetic_data.json
  generate_cancer_data.py               Script that produced synthetic_cancer_data.json
```

---

## Synthetic Datasets

### Derived variables — `examples/synthetic_data.json`

- **1,000 participants** with fields drawn from the Generations Study variable schema
- Realistic epidemiological distributions (BMI ~N(24.5, 4.5), smoking ~16%, etc.)
- Logical coherence: BMI derived from height/weight; parity consistent with `R0_Parous`; HRT confined to older/postmenopausal participants
- Plausible missingness (~3--15% per variable; higher for age-conditional fields)
- Sentinel values (999 / 9999) preserved as defined in the schema
- **No real participant data** — all values are synthetic

```bash
python3 examples/generate_data.py
```

### Cancer summary — `examples/synthetic_cancer_data.json`

- **231 tumour records** across **220 participants** (~22% of the cohort)
- 11 participants have two records (second primary cancer)
- 85% breast cancer (ICD-10 C50.x); remainder colorectal, lung, cervical, ovarian
- Realistic stage, grade, ER/PR/HER2, Ki-67, and tumour size distributions
- Joins to `synthetic_data.json` on `TCode`

```bash
python3 examples/generate_cancer_data.py
```

---

## Variable Types

| Type | Meaning |
|:---|:---|
| `numeric` | Continuous measurement (e.g. BMI, physical activity) |
| `integer` | Whole-number count or age |
| `categorical` | Coded value with labelled categories |
| `binary` | 0 / 1 flag |

### Sentinel values

Some variables use `999` or `9999` to mean **Not Applicable** — distinct from `null` (missing / unknown):

| Sentinel | Example | Meaning |
|:---:|:---|:---|
| `999` | `R0_BMI` | Pregnant at study entry — BMI not calculated |
| `999` | `R0_AgeBirthFirst` | No live birth |
| `9999` | `R0_BreastfeedingDuration` | No live birth |

---

## Sample Cohort Definition

`examples/sample_cohort.json` defines:

> **Premenopausal + Parous + BMI > 25 + Current alcohol drinker**

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

**R:**
```r
df_cohort <- df[df$R0_Menopause == 2 & df$R0_Parous == 1 & df$R0_BMI > 25 & df$R0_AlcoholStatus == 2, ]
```

**Python:**
```python
mask = (df.R0_Menopause == 2) & (df.R0_Parous == 1) & (df.R0_BMI > 25) & (df.R0_AlcoholStatus == 2)
df_cohort = df[mask]
```

---

<sub>Schema: Generations Study variable definitions (JSON Schema Draft 2020-12).</sub>
