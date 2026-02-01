/**
 * USCDI v3 Coverage Analysis
 *
 * Maps Popper export fields to USCDI v3 data classes and analyzes
 * coverage gaps for regulatory compliance reporting.
 *
 * Per spec: §6.1 of 02-popper-contracts-and-interfaces.md
 *
 * Note: USCDI validation is RECOMMENDED, not blocking for v1.
 *
 * @module export/uscdi
 */

import type { ExportAuditEvent, ExportIncidentSummary, ExportSupervisionReceipt } from './types';

/** USCDI v3 data classes relevant to Popper supervision */
export type USCDIDataClass =
  | 'patient_demographics'
  | 'problems'
  | 'medications'
  | 'vital_signs'
  | 'laboratory'
  | 'clinical_notes'
  | 'allergies';

/** Coverage status for a USCDI data class */
export interface USCDIDataClassEntry {
  class: USCDIDataClass;
  status: 'present' | 'partial' | 'missing';
  source_fields: string[];
  gaps?: string[];
}

/** USCDI coverage analysis report */
export interface USCDICoverageReport {
  version: 'v3';
  data_classes: USCDIDataClassEntry[];
  coverage_score: number;
  gaps_summary: string;
}

/**
 * Mapping from Popper event metadata fields to USCDI data classes.
 * Keys are metadata field names; values are the USCDI class they map to.
 */
export const USCDI_FIELD_MAPPINGS: Record<string, USCDIDataClass> = {
  // Patient Demographics
  subject_id_hash: 'patient_demographics',

  // Problems
  conditions: 'problems',

  // Medications
  medications: 'medications',
  medication_name: 'medications',
  medication_dose: 'medications',

  // Vital Signs
  vitals: 'vital_signs',
  bp_trend: 'vital_signs',
  weight_trend: 'vital_signs',
  heart_rate: 'vital_signs',

  // Laboratory
  potassium: 'laboratory',
  creatinine: 'laboratory',
  eGFR: 'laboratory',
  lab_results: 'laboratory',

  // Clinical Notes (mapped from redaction summaries)
  // Handled separately via supervision receipts

  // Allergies
  allergies: 'allergies',
};

/** Metadata field names that indicate incident-level problems data */
const INCIDENT_PROBLEM_KEYWORDS = ['condition', 'diagnosis', 'problem'];

/** All USCDI data classes for exhaustive iteration */
const ALL_USCDI_CLASSES: USCDIDataClass[] = [
  'patient_demographics',
  'problems',
  'medications',
  'vital_signs',
  'laboratory',
  'clinical_notes',
  'allergies',
];

/**
 * Determine which USCDI data classes a single audit event maps to
 */
export function mapEventToUSCDI(event: ExportAuditEvent): USCDIDataClass[] {
  const classes = new Set<USCDIDataClass>();

  // subject_id_hash → patient_demographics
  if (event.subject_id_hash) {
    classes.add('patient_demographics');
  }

  // Check metadata fields against USCDI mappings
  if (event.metadata) {
    for (const field of Object.keys(event.metadata)) {
      const mapped = USCDI_FIELD_MAPPINGS[field];
      if (mapped) {
        classes.add(mapped);
      }
    }
  }

  return [...classes];
}

/**
 * Analyze USCDI v3 coverage across an entire export bundle's data.
 *
 * Checks which USCDI data classes are represented in the export,
 * which are partially covered, and which are missing entirely.
 */
export function analyzeUSCDICoverage(
  events: ExportAuditEvent[],
  receipts: ExportSupervisionReceipt[],
  incidents: ExportIncidentSummary[],
): USCDICoverageReport {
  // Track which source fields contributed to each class
  const classFields: Record<USCDIDataClass, Set<string>> = {
    patient_demographics: new Set(),
    problems: new Set(),
    medications: new Set(),
    vital_signs: new Set(),
    laboratory: new Set(),
    clinical_notes: new Set(),
    allergies: new Set(),
  };

  // Scan events
  for (const event of events) {
    if (event.subject_id_hash) {
      classFields.patient_demographics.add('subject_id_hash');
    }

    if (event.metadata) {
      for (const field of Object.keys(event.metadata)) {
        const mapped = USCDI_FIELD_MAPPINGS[field];
        if (mapped) {
          classFields[mapped].add(field);
        }
      }
    }
  }

  // Scan supervision receipts for clinical_notes
  for (const receipt of receipts) {
    if (receipt.request_redaction?.summary) {
      classFields.clinical_notes.add('request_redaction.summary');
    }
    if (receipt.response_redaction?.summary) {
      classFields.clinical_notes.add('response_redaction.summary');
    }
  }

  // Scan incidents for problems data
  for (const incident of incidents) {
    const trigger = incident.trigger.toLowerCase();
    if (INCIDENT_PROBLEM_KEYWORDS.some((kw) => trigger.includes(kw))) {
      classFields.problems.add(`incident.trigger(${incident.trigger})`);
    }
  }

  // Build coverage entries
  const dataClasses: USCDIDataClassEntry[] = ALL_USCDI_CLASSES.map((cls) => {
    const fields = classFields[cls];
    const sourceFields = [...fields];

    if (sourceFields.length === 0) {
      return {
        class: cls,
        status: 'missing' as const,
        source_fields: [],
        gaps: [getGapDescription(cls)],
      };
    }

    // Determine if coverage is full or partial
    const expectedFields = getExpectedFields(cls);
    const hasAllExpected = expectedFields.every((f) => fields.has(f));

    if (hasAllExpected) {
      return {
        class: cls,
        status: 'present' as const,
        source_fields: sourceFields,
      };
    }

    const missingFields = expectedFields.filter((f) => !fields.has(f));
    return {
      class: cls,
      status: 'partial' as const,
      source_fields: sourceFields,
      gaps: missingFields.map((f) => `Missing field: ${f}`),
    };
  });

  // Calculate coverage score
  const presentCount = dataClasses.filter((d) => d.status === 'present').length;
  const partialCount = dataClasses.filter((d) => d.status === 'partial').length;
  const coverageScore = (presentCount + partialCount * 0.5) / ALL_USCDI_CLASSES.length;

  // Build gaps summary
  const missingClasses = dataClasses.filter((d) => d.status === 'missing').map((d) => d.class);
  const partialClasses = dataClasses.filter((d) => d.status === 'partial').map((d) => d.class);

  let gapsSummary = '';
  if (missingClasses.length === 0 && partialClasses.length === 0) {
    gapsSummary = 'Full USCDI v3 coverage achieved.';
  } else {
    const parts: string[] = [];
    if (missingClasses.length > 0) {
      parts.push(`Missing: ${missingClasses.join(', ')}`);
    }
    if (partialClasses.length > 0) {
      parts.push(`Partial: ${partialClasses.join(', ')}`);
    }
    gapsSummary = parts.join('. ');
  }

  return {
    version: 'v3',
    data_classes: dataClasses,
    coverage_score: Math.round(coverageScore * 100) / 100,
    gaps_summary: gapsSummary,
  };
}

/**
 * Get minimum expected fields for a USCDI data class to be considered "present"
 */
function getExpectedFields(cls: USCDIDataClass): string[] {
  switch (cls) {
    case 'patient_demographics':
      return ['subject_id_hash'];
    case 'problems':
      return ['conditions'];
    case 'medications':
      return ['medications'];
    case 'vital_signs':
      return ['vitals'];
    case 'laboratory':
      return ['potassium'];
    case 'clinical_notes':
      return ['request_redaction.summary'];
    case 'allergies':
      return ['allergies'];
  }
}

/**
 * Get human-readable gap description for a missing USCDI data class
 */
function getGapDescription(cls: USCDIDataClass): string {
  switch (cls) {
    case 'patient_demographics':
      return 'No subject identifiers found in events';
    case 'problems':
      return 'No conditions/problems data in events or incidents';
    case 'medications':
      return 'No medication data in events';
    case 'vital_signs':
      return 'No vital signs data in events';
    case 'laboratory':
      return 'No laboratory results in events';
    case 'clinical_notes':
      return 'No clinical note redaction summaries in supervision receipts';
    case 'allergies':
      return 'No allergy data in events';
  }
}
