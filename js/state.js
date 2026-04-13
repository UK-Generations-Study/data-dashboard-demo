/* ============================================================
   Shared mutable state.

   Every other module imports the single `state` object exported
   here and reads/writes its properties. This avoids polluting
   `window` and gives the app one well-defined source of truth.
   ============================================================ */

'use strict';

// ── Built-in derived-data schema (used as fallback / for backfill) ──────────
const BUILTIN_SCHEMA = {
  R0_TCode:               { desc:'Pseudo-anonymised 8-character study identifier', group:'id',            type:'string' },
  R0_Ethnicity:           { desc:'Ethnicity of the study participant',              group:'demographics',  type:'categorical',
    codes:{1:'White',2:'Black',3:'Asian',4:'Other',9:'Not known'} },
  R0_AshkenaziAncestry:   { desc:'Ashkenazi Jewish ancestry flag',                 group:'demographics',  type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_Height:              { desc:'Height in centimetres at study entry',            group:'anthropometry', type:'numeric', unit:'cm' },
  R0_Weight:              { desc:'Weight in kilograms at study entry',              group:'anthropometry', type:'numeric', unit:'kg' },
  R0_BMI:                 { desc:'BMI at study entry (999=pregnant at entry)',      group:'anthropometry', type:'numeric', unit:'kg/m²', sentinel:999 },
  R0_WaistCircum:         { desc:'Waist circumference in centimetres at entry',    group:'anthropometry', type:'numeric', unit:'cm' },
  R0_HipCircum:           { desc:'Hip circumference in centimetres at entry',      group:'anthropometry', type:'numeric', unit:'cm' },
  R0_WaistHipRatio:       { desc:'Waist-to-hip ratio at entry (999=pregnant)',     group:'anthropometry', type:'numeric', sentinel:999 },
  R0_Height20:            { desc:'Height in centimetres at age 20 (999=<20 at entry)',group:'anthropometry',type:'numeric',unit:'cm',sentinel:999},
  R0_Weight20:            { desc:'Weight in kilograms at age 20 (999=<20 at entry)',  group:'anthropometry',type:'numeric',unit:'kg', sentinel:999},
  R0_BMI20:               { desc:'BMI at age 20 (999=<20 or pregnant at 20)',      group:'anthropometry', type:'numeric', unit:'kg/m²', sentinel:999 },
  R0_PregAtEntry:         { desc:'Pregnant at study entry',                        group:'reproductive',  type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_PregAt20:            { desc:'Pregnant at age 20 (999=was <20 at entry)',      group:'reproductive',  type:'categorical',
    codes:{0:'No',1:'Yes',999:'NA (<20)'} },
  R0_AgeMenarche:         { desc:'Age at menarche (first period), whole years',    group:'reproductive',  type:'integer', unit:'years' },
  R0_Parous:              { desc:'Parity status at entry',                         group:'reproductive',  type:'categorical',
    codes:{'-1':'Never pregnant',0:'Nulliparous',1:'Parous',9:'Ever preg, parity unknown'} },
  R0_Parity:              { desc:'Number of live-birth pregnancies at entry',      group:'reproductive',  type:'integer' },
  R0_AgeBirthFirst:       { desc:'Age at first live birth (999=no live birth)',    group:'reproductive',  type:'numeric', unit:'years', sentinel:999 },
  R0_AgeBirthLast:        { desc:'Age at last live birth (999=no live birth)',     group:'reproductive',  type:'numeric', unit:'years', sentinel:999 },
  R0_BreastfeedingDuration:{ desc:'Total weeks breastfed across live births (9999=no live birth)', group:'reproductive', type:'numeric', unit:'weeks', sentinel:9999 },
  R0_Breastfed:           { desc:'Ever breastfed (999=no live birth)',             group:'reproductive',  type:'categorical',
    codes:{0:'No',1:'Yes',999:'NA (no live birth)'} },
  R0_Menopause:           { desc:'Menopausal status at baseline',                  group:'reproductive',  type:'categorical',
    codes:{1:'Postmenopausal',2:'Premenopausal',3:'Assumed postmeno',4:'Assumed premeno',9:'Never had periods'} },
  R0_AgeMenopause:        { desc:'Age at menopause (years)',                       group:'reproductive',  type:'integer', unit:'years' },
  R0_MenopauseReason:     { desc:'Reason periods stopped',                        group:'reproductive',  type:'categorical',
    codes:{1:'Natural',2:'Bilateral oophorectomy',3:'Hysterectomy only',4:'Surgery (type unknown)',
           5:'Chemo/radio/cancer tx',6:'Unknown reason',7:'Other reason',8:'On hormones',9:'On HRT',
           10:'Stress',11:'Breastfeeding/pregnant',12:'Perimenopausal',13:'Natural on HRT/OC',
           14:'Eating disorder',15:'Illness',16:'Premenopausal',17:'Status unknown',
           18:'Other surgery',19:'Never had periods'} },
  R0_OralContraceptiveStatus:{ desc:'Oral contraceptive use status at entry',     group:'lifestyle',     type:'categorical',
    codes:{0:'Never',1:'Former',2:'Current'} },
  R0_AgeStartedOC:        { desc:'Age first used oral contraceptives (999=never)',  group:'lifestyle',     type:'numeric', unit:'years', sentinel:999 },
  R0_AgeLastUsedOC:       { desc:'Age last used OC (999=current user)',            group:'lifestyle',     type:'numeric', unit:'years', sentinel:999 },
  R0_OCLength:            { desc:'Total duration of OC use (years)',               group:'lifestyle',     type:'numeric', unit:'years' },
  R0_HRTStatus:           { desc:'Menopausal hormone treatment status',            group:'lifestyle',     type:'categorical',
    codes:{0:'Never',1:'Former',2:'Current'} },
  R0_HRTStartAge:         { desc:'Age started HRT',                               group:'lifestyle',     type:'integer', unit:'years' },
  R0_HRTStopAge:          { desc:'Age stopped HRT',                               group:'lifestyle',     type:'integer', unit:'years' },
  R0_HRTDuration:         { desc:'Total duration of HRT use (years)',              group:'lifestyle',     type:'numeric', unit:'years' },
  R0_AlcoholStatus:       { desc:'Alcohol use status at baseline',                group:'lifestyle',     type:'categorical',
    codes:{0:'Never',1:'Former',2:'Current'} },
  R0_AgeStartedDrinking:  { desc:'Age started regularly drinking alcohol',        group:'lifestyle',     type:'integer', unit:'years' },
  R0_AgeStoppedDrinking:  { desc:'Age stopped regularly drinking alcohol',        group:'lifestyle',     type:'integer', unit:'years' },
  R0_AlcoholUnitsPerWeek: { desc:'Weekly alcohol units (current drinkers)',       group:'lifestyle',     type:'numeric', unit:'units/wk' },
  R0_SmokingStatus:       { desc:'Cigarette smoking status at baseline',          group:'lifestyle',     type:'categorical',
    codes:{0:'Never',1:'Former',2:'Current'} },
  R0_AgeStartedSmoking:   { desc:'Age started cigarette smoking',                group:'lifestyle',     type:'integer', unit:'years' },
  R0_AgeStoppedSmoking:   { desc:'Age stopped cigarette smoking',                group:'lifestyle',     type:'integer', unit:'years' },
  R0_CigsPerDay:          { desc:'Cigarettes smoked per day (current smokers)',   group:'lifestyle',     type:'numeric', unit:'cigs/day' },
  R0_PackYears:           { desc:'Cumulative smoking exposure (pack-years)',      group:'lifestyle',     type:'numeric', unit:'pack-yrs' },
  R0_PhysicalActivity:    { desc:'Physical activity (MET-hours/week)',            group:'lifestyle',     type:'numeric', unit:'MET-h/wk' },
  R0_GreenVegDailyServings:{ desc:'Average daily green vegetable servings',      group:'lifestyle',     type:'integer', unit:'servings/day' },
  R0_FruitDailyServings:  { desc:'Average daily fruit servings',                 group:'lifestyle',     type:'integer', unit:'servings/day' },
  R0_BBD:                 { desc:'History of benign breast disease',              group:'medical',       type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_DiabetesStatus:      { desc:'Diabetes diagnosis at baseline',               group:'medical',       type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_AgeDiabetes:         { desc:'Age at diabetes diagnosis (years)',             group:'medical',       type:'integer', unit:'years' },
  R0_DiabetesInsulin:     { desc:'Diabetes treated with insulin at baseline',    group:'medical',       type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_FamHistCancer:       { desc:'Family history of any cancer (1st degree)',    group:'family',        type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_FamHistCancerNum:    { desc:'No. of 1st-degree relatives with any cancer',  group:'family',        type:'integer' },
  R0_FamHistBC:           { desc:'Family history of breast cancer (1st degree)', group:'family',        type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_FamHistBCNum:        { desc:'No. of 1st-degree relatives with breast cancer',group:'family',       type:'integer' },
  R0_FamHistOV:           { desc:'Family history of ovarian cancer (1st degree)',group:'family',        type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_FamHistOVNum:        { desc:'No. of 1st-degree relatives with ovarian cancer',group:'family',      type:'integer' },
  R0_FamHistColo:         { desc:'Family history of colorectal cancer (1st degree)',group:'family',     type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_FamHistColoNum:      { desc:'No. of 1st-degree relatives with colorectal cancer',group:'family',   type:'integer' },
  R0_FamHistProst:        { desc:'Family history of prostate cancer (1st degree)',group:'family',       type:'binary',
    codes:{0:'No',1:'Yes'} },
  R0_FamHistProstNum:     { desc:'No. of 1st-degree relatives with prostate cancer',group:'family',     type:'integer' },
};

export const BUILTIN_GROUP_LABELS = {
  id:'Identifier', demographics:'Demographics', anthropometry:'Anthropometry',
  reproductive:'Reproductive', lifestyle:'Lifestyle', medical:'Medical', family:'Family History',
  cancer_diagnosis:'Cancer Diagnosis', tumour_characteristics:'Tumour Characteristics',
  biomarkers:'Tumour Biomarkers'
};

// Preferred group order — cancer groups always appear after study groups
export const GROUP_ORDER = [
  'demographics','anthropometry','reproductive','lifestyle','medical','family',
  'cancer_diagnosis','tumour_characteristics','biomarkers'
];

export { BUILTIN_SCHEMA };

// ── Single shared mutable state object ─────────────────────────────────────
export const state = {
  // Schema (mutable: replaced when a schema file is loaded or auto-inferred)
  SCHEMA:        Object.assign(Object.create(null), BUILTIN_SCHEMA),
  GROUP_LABELS:  Object.assign(Object.create(null), BUILTIN_GROUP_LABELS),
  schemaSource: 'builtin', // 'builtin' | 'file' | 'inferred'

  // Data
  rawData:    [],
  cohortData: [],

  // Cohort builder
  filters:         [],   // [{id, field, operator, value, logic}]
  filterIdCounter: 0,

  // UI state
  activeVar:   null,
  mainChart:   null,
  missChart:   null,
  chartMode:   'histogram', // 'histogram' | 'violin' | 'bar' | 'pie'
  activeGroup: 'all',

  // File-loading staging area
  pendingData:     null,   // merged data array (set by continueToApp)
  pendingSchema:   null,   // merged schema (set by continueToApp)
  pendingDatasets: [],     // [{ data, fileName, _fp }]
  pendingSchemas:  [],     // [{ schema, groupLabels, fileName, _fp }]

  // Variables that came from datasets with duplicate TCodes
  DEDUP_VARIABLES: new Set(),
};
