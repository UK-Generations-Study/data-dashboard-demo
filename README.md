# Generations Study – Data Dashboard (Demo)

A browser-based prototype for exploring the Generations Study dataset.
All processing occurs **locally in your browser** — no data is ever transmitted externally.

---

## Quick Start

Open the dashboard directly in your browser — no installation needed:

> **https://uk-generations-study.github.io/data-dashboard-demo/**

### Load a single dataset

1. Drag-and-drop `synthetic_data.json` onto the **Data File** drop zone
2. Drag-and-drop `DerivedVariables_Schema.json` onto the **Schema File** drop zone
3. Click **Load Dashboard**

### Load multiple datasets (multi-file merge)

The dashboard supports combining multiple JSON files via a full outer join on participant ID (`TCode`). For example, to explore derived variables alongside cancer summary data:

1. Drag-and-drop **both** `synthetic_data.json` and `synthetic_cancer_data.json` onto the **Data File** drop zone (or add them one at a time using "Add another file")
2. Drag-and-drop **both** `DerivedVariables_Schema.json` and `CancerSummary_Schema.json` onto the **Schema File** drop zone
3. Click **Load Dashboard**

The two datasets are joined on `TCode`. Participants not present in all files are retained (full outer join). For the cancer data, which has one row per tumour (some participants have multiple), only the earliest tumour record per participant is used; a **N_TUMOURS** variable records how many tumour records each participant had. A note is shown on charts for variables derived from deduplicated datasets.

> **Note:** Variable names must not overlap across schema files. If they do, an error is shown before loading.

---

### Repository contents

```
├── index.html                    ← Dashboard (open locally as an alternative)
├── app.js                        ← Dashboard logic
├── synthetic_data.json           ← 1000-participant synthetic derived-variables dataset
├── DerivedVariables_Schema.json  ← JSON Schema for the derived variables dataset
├── synthetic_cancer_data.json    ← Synthetic cancer summary (231 records, 220 participants)
├── CancerSummary_Schema.json     ← JSON Schema for the cancer summary dataset
├── sample_cohort.json            ← Example cohort definition (JSON)
├── generate_data.py              ← Python script that produced synthetic_data.json
├── generate_cancer_data.py       ← Python script that produced synthetic_cancer_data.json
├── examples.R                    ← R loading and analysis examples
├── examples.py                   ← Python loading and analysis examples
└── README.md                     ← This file
```

> **Note:** Chart.js is loaded from CDN (`cdn.jsdelivr.net`). An internet connection is required for the initial page load. Once loaded, all functionality works offline.

---

## Dashboard Features

| Tab | What it does |
|---|---|
| **Overview** | Dataset summary — participant count, completeness, variable groups |
| **Explore** | Click any variable for histogram / bar chart / violin plot + summary stats; download chart as PNG |
| **Missingness** | Horizontal bar chart of null % and sentinel NA % for all variables |
| **Stratified** | Compare a numeric variable's distribution across groups of a categorical variable |
| **Cohort Builder** | Build AND/OR filter chains with live cohort preview; export cohort as JSON; view attrition flow with PNG export |
| **Descriptive** | Summary statistics table for the active cohort; optional stratification; CSV export |

### Sidebar

- **Search box** — filter variables by name or description
- **Group buttons** — filter by variable group (e.g. Demographics, Reproductive, Lifestyle, Family History, Cancer Diagnosis)
- **Click any variable** — jumps to Explore tab with that variable selected
- **Mobile:** tap the ☰ button in the header to open the sidebar as an overlay

Variables appear in the same order as the group buttons, which reflects the order schema files were loaded.

### Schema file (optional)

Loading a JSON Schema file (Draft 2020-12) enriches the dashboard with:
- Human-readable variable labels and descriptions
- Correct variable types (numeric, integer, categorical, binary)
- Code labels (e.g. 0 = No, 1 = Yes)
- Units shown on chart axes
- Variable groupings for the sidebar filter buttons
- Sentinel value definitions (999 / 9999 = Not Applicable)

---

## Privacy

All data handling occurs entirely within your browser via the browser's `FileReader` API.
No participant data is uploaded, transmitted, or stored anywhere outside your device.
The only external network requests are to load the Chart.js library from CDN on first page load.

---

## Synthetic Datasets

### Derived variables (`synthetic_data.json`)

- **1,000 participants**, fields drawn from the Generations Study variable schema
- Realistic epidemiological distributions (BMI ~N(24.5, 4.5), smoking ~16%, etc.)
- Logical coherence maintained: BMI derived from height/weight; parity consistent with `R0_Parous`; HRT confined to older/postmenopausal participants; etc.
- Plausible missingness (~3–15% per variable; higher for age-conditional variables)
- Sentinel values (999 / 9999) preserved exactly as the schema defines them
- No real participant data — all values are synthetic

```bash
python3 generate_data.py
```

### Cancer summary (`synthetic_cancer_data.json`)

- **231 tumour records** across **220 participants** (~22% of the 1,000)
- **11 participants** have two tumour records (second primary cancer)
- 85% breast cancer (ICD-10 C50.x), remainder colorectal, lung, cervical, ovarian
- Realistic distributions for stage, grade, ER/PR/HER2 receptor status, Ki-67, tumour size
- Joins to `synthetic_data.json` on `TCode`

```bash
python3 generate_cancer_data.py
```

---

## Variable Types

| Type pill | Meaning |
|---|---|
| `numeric` | Continuous measurement (e.g. BMI, physical activity) |
| `integer` | Whole-number count or age |
| `categorical` | Coded integer or string with labelled categories |
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
| Chart.js via CDN | Mature, well-maintained; avoids embedding library code in the repository |
| Drag-and-drop data loading | Matches privacy requirement; data never leaves device |
| Multi-file full outer join | Supports modular datasets (e.g. cancer summary separate from derived variables) |
| Sidebar + tab layout | Separates variable navigation from analytical views |
| Sentinel vs null distinction | Preserves schema semantics in missingness visualisation |
| Cohort export as JSON | Machine-readable; reproducible; includes full participant ID list |
| Generate-then-load architecture | Dataset is separate from app — analysts can load real data when available |
| JSON Schema support | Enriches any compatible dataset with labels, types, and groupings |

---

## Requirements

- **Dashboard:** any modern browser; internet for initial CDN load
- **generate_data.py / generate_cancer_data.py:** Python 3.7+ (stdlib only)
- **examples.R:** R + `jsonlite` (optionally `tableone`)
- **examples.py:** Python + `pandas`, `numpy`, `matplotlib`

---

*This is a synthetic demonstration. All participant records are fictitious.*
*Schema: Generations Study variable definitions (JSON Schema Draft 2020-12).*
