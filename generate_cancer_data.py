"""
Generations Study – Synthetic Cancer Summary Generator
Generates synthetic NewCancerSummary-style data for ~22% of participants.
Produces one row per tumour (some participants have 2 records).
Run: python3 generate_cancer_data.py
"""

import json
import random
import math

random.seed(123)

# ── Load existing synthetic data to get TCode list ───────────────────────────
with open('synthetic_data.json') as f:
    base_data = json.load(f)

tcodes = [p['R0_TCode'] for p in base_data]

# ~22% develop cancer
n_cancer = int(len(tcodes) * 0.22)
cancer_tcodes = random.sample(tcodes, n_cancer)

# ~5% of those get a second cancer record
n_second = max(1, int(n_cancer * 0.05))
second_cancer_tcodes = set(random.sample(cancer_tcodes, n_second))

# ── Helpers ──────────────────────────────────────────────────────────────────
tumour_counter = 1

def make_tumour_id():
    global tumour_counter
    tid = f'T{tumour_counter:05d}'
    tumour_counter += 1
    return tid

def maybe_null(value, p=0.06):
    return None if random.random() < p else value

# ── Record generator ─────────────────────────────────────────────────────────
def generate_cancer_record(tcode, is_second=False, first_year=None):
    # Age at diagnosis
    age = round(random.gauss(58, 10))
    age = max(35, min(85, age))
    if is_second:
        age = min(85, age + random.randint(3, 8))

    # Diagnosis year
    year = random.randint(1998, 2022)
    if is_second and first_year:
        year = min(2022, first_year + random.randint(3, 8))

    # Cancer type — predominantly breast (Generations Study focus)
    cancer_type = random.choices(
        ['breast', 'colorectal', 'lung', 'cervical', 'ovarian'],
        weights=[0.85, 0.05, 0.04, 0.03, 0.03]
    )[0]

    if cancer_type == 'breast':
        icd_code    = random.choices(
            ['C50.1', 'C50.2', 'C50.3', 'C50.4', 'C50.5', 'C50.8', 'C50.9'],
            weights=[0.10, 0.20, 0.15, 0.15, 0.15, 0.15, 0.10]
        )[0]
        cancer_site  = 'Breast'
        grouped_site = 'Breast'
        morph_code   = random.choices(
            ['8500/3', '8520/3', '8510/3', '8480/3'],
            weights=[0.70, 0.15, 0.10, 0.05]
        )[0]
        laterality = random.choices(['L', 'R'], weights=[0.50, 0.50])[0]
    elif cancer_type == 'colorectal':
        icd_code     = random.choice(['C18.0', 'C18.2', 'C18.4', 'C18.7', 'C19', 'C20'])
        cancer_site  = 'Colon/Rectum'
        grouped_site = 'Colorectum'
        morph_code   = '8140/3'
        laterality   = 'M'
    elif cancer_type == 'lung':
        icd_code     = random.choice(['C34.1', 'C34.2', 'C34.3'])
        cancer_site  = 'Lung'
        grouped_site = 'Lung'
        morph_code   = random.choices(['8046/3', '8140/3', '8070/3'], weights=[0.5, 0.3, 0.2])[0]
        laterality   = random.choices(['L', 'R'], weights=[0.50, 0.50])[0]
    elif cancer_type == 'cervical':
        icd_code     = random.choice(['C53.0', 'C53.1', 'C53.8'])
        cancer_site  = 'Cervix uteri'
        grouped_site = 'Cervix uteri'
        morph_code   = random.choices(['8070/3', '8140/3'], weights=[0.7, 0.3])[0]
        laterality   = 'M'
    else:  # ovarian
        icd_code     = random.choice(['C56', 'C57.0'])
        cancer_site  = 'Ovary'
        grouped_site = 'Ovary'
        morph_code   = random.choices(['8441/3', '8460/3', '9000/3'], weights=[0.5, 0.3, 0.2])[0]
        laterality   = random.choices(['L', 'R'], weights=[0.50, 0.50])[0]

    # Grade
    grade = maybe_null(
        random.choices(['G1', 'G2', 'G3', 'GX'], weights=[0.15, 0.45, 0.35, 0.05])[0],
        p=0.05
    )

    # Tumour size (mm)
    tumour_size = None
    if random.random() > 0.10:
        raw = math.exp(random.gauss(math.log(18), 0.6))
        tumour_size = round(min(max(raw, 2), 150), 1)

    # Stage
    stage = maybe_null(
        random.choices(['I', 'II', 'III', 'IV', 'X'], weights=[0.30, 0.40, 0.20, 0.05, 0.05])[0],
        p=0.04
    )

    # TNM staging
    if stage == 'I':
        t_stage = random.choices(['T1a', 'T1b', 'T1c'], weights=[0.2, 0.3, 0.5])[0]
        n_stage = 'N0'
        m_stage = 'M0'
    elif stage == 'II':
        t_stage = random.choices(['T1', 'T2'], weights=[0.4, 0.6])[0]
        n_stage = random.choices(['N0', 'N1'], weights=[0.5, 0.5])[0]
        m_stage = 'M0'
    elif stage == 'III':
        t_stage = random.choices(['T2', 'T3', 'T4'], weights=[0.2, 0.5, 0.3])[0]
        n_stage = random.choices(['N1', 'N2', 'N3'], weights=[0.3, 0.4, 0.3])[0]
        m_stage = 'M0'
    elif stage == 'IV':
        t_stage = random.choices(['T2', 'T3', 'T4'], weights=[0.2, 0.4, 0.4])[0]
        n_stage = random.choices(['N1', 'N2', 'N3'], weights=[0.2, 0.3, 0.5])[0]
        m_stage = 'M1'
    else:
        t_stage, n_stage, m_stage = 'TX', 'NX', 'MX'

    # Apply some nulls to staging fields
    t_stage = maybe_null(t_stage, p=0.06)
    n_stage = maybe_null(n_stage, p=0.06)
    m_stage = maybe_null(m_stage, p=0.06)

    # Biomarkers (breast only)
    er_status = pr_status = her2_status = her2_fish = ki67 = None
    if cancer_type == 'breast':
        er_status   = maybe_null(
            random.choices(['Positive', 'Negative', 'Unknown'], weights=[0.75, 0.20, 0.05])[0]
        )
        pr_status   = maybe_null(
            random.choices(['Positive', 'Negative', 'Unknown'], weights=[0.65, 0.30, 0.05])[0]
        )
        her2_status = maybe_null(
            random.choices(['Positive', 'Negative', 'Borderline', 'Unknown'],
                           weights=[0.15, 0.70, 0.10, 0.05])[0]
        )
        if her2_status == 'Borderline':
            her2_fish = random.choices(['Positive', 'Negative'], weights=[0.4, 0.6])[0]
        if random.random() > 0.25:
            raw_ki67 = math.exp(random.gauss(math.log(18), 0.8))
            ki67 = round(min(max(raw_ki67, 1), 95), 1)

    # Screen detected
    screen_detected = None
    if cancer_type == 'breast':
        p_screen = 0.30 if stage in ('I', 'II') else 0.15
        screen_detected = 1 if random.random() < p_screen else 0

    # Diagnosis date (shifted — year + random month/day)
    month = random.randint(1, 12)
    day   = random.randint(1, 28)
    diag_date = f'{year}-{month:02d}-{day:02d}T00:00:00'

    return {
        'TCode':                  tcode,
        'TUMOUR_ID':              make_tumour_id(),
        'DIAGNOSIS_DATE_SHIFTED': diag_date,
        'DIAGNOSIS_YEAR':         year,
        'AGE_AT_DIAGNOSIS':       age,
        'ICD_CODE':               icd_code,
        'MORPH_CODE':             morph_code,
        'CANCER_SITE':            cancer_site,
        'GROUPED_SITE':           grouped_site,
        'GRADE':                  grade,
        'TUMOUR_SIZE':            tumour_size,
        'STAGE':                  maybe_null(stage, p=0.03),
        'LATERALITY':             laterality,
        'T_STAGE':                t_stage,
        'N_STAGE':                n_stage,
        'M_STAGE':                m_stage,
        'ER_STATUS':              er_status,
        'PR_STATUS':              pr_status,
        'HER2_STATUS':            her2_status,
        'HER2_FISH':              her2_fish,
        'Ki67':                   ki67,
        'SCREEN_DETECTED':        screen_detected,
    }, year


# ── Generate all records ─────────────────────────────────────────────────────
records = []
for tcode in cancer_tcodes:
    record, year = generate_cancer_record(tcode)
    records.append(record)
    if tcode in second_cancer_tcodes:
        second, _ = generate_cancer_record(tcode, is_second=True, first_year=year)
        records.append(second)

random.shuffle(records)

# ── Save ─────────────────────────────────────────────────────────────────────
with open('synthetic_cancer_data.json', 'w') as f:
    json.dump(records, f, indent=2)

n_participants = len(cancer_tcodes)
n_second_actual = len(second_cancer_tcodes)
print(f'Generated {len(records)} cancer records')
print(f'  Participants with cancer:       {n_participants} / {len(tcodes)} ({n_participants/len(tcodes)*100:.0f}%)')
print(f'  Participants with 2nd cancer:   {n_second_actual}')
print(f'  Output: synthetic_cancer_data.json')
