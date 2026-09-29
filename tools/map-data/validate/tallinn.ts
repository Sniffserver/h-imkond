/**
 * Tallinn Municipal Record Validator
 */

import { NormalizedRecord, TALLINN_BBOX, ValidationIssue, ValidationResult } from '../types';
import { isWithinBoundingBox } from './bounds';

export function validateTallinnRecord(record: NormalizedRecord, bbox = TALLINN_BBOX): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isWithinBoundingBox(record.lat, record.lng, bbox)) {
    issues.push({
      recordId: record.id,
      field: 'coordinates',
      severity: 'error',
      message: `Municipal coordinates (${record.lat}, ${record.lng}) fall outside Tallinn bounding box`,
    });
  }

  if (!record.name || record.name.trim().length === 0) {
    issues.push({
      recordId: record.id,
      field: 'name',
      severity: 'error',
      message: 'Municipal record name is empty',
    });
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}

export function validateTallinnBatch(records: NormalizedRecord[], bbox = TALLINN_BBOX): {
  validRecords: NormalizedRecord[];
  rejectedRecords: { record: NormalizedRecord; issues: ValidationIssue[] }[];
} {
  const validRecords: NormalizedRecord[] = [];
  const rejectedRecords: { record: NormalizedRecord; issues: ValidationIssue[] }[] = [];

  for (const record of records) {
    const res = validateTallinnRecord(record, bbox);
    if (res.valid) {
      validRecords.push(record);
    } else {
      rejectedRecords.push({ record, issues: res.issues });
    }
  }

  return { validRecords, rejectedRecords };
}
