/**
 * Tallinn Open Data Ingestion Worker: Validate
 * Validates municipal registry records for coordinate correctness, register codes, and schema conformity.
 */

import { NormalizedRecord, TALLINN_BBOX, ValidationIssue, ValidationResult } from '../types';

export function validateTallinnRecord(record: NormalizedRecord, bbox = TALLINN_BBOX): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Geographic bounds check
  if (
    record.lat < bbox.minLat ||
    record.lat > bbox.maxLat ||
    record.lng < bbox.minLng ||
    record.lng > bbox.maxLng
  ) {
    issues.push({
      recordId: record.id,
      field: 'coordinates',
      severity: 'error',
      message: `Municipal point coordinates (${record.lat}, ${record.lng}) fall outside Tallinn boundary`,
    });
  }

  // 2. Registry code check
  if (!record.sourceId || record.sourceId.trim().length < 3) {
    issues.push({
      recordId: record.id,
      field: 'sourceId',
      severity: 'error',
      message: 'Missing or empty municipal registry code (registri_kood)',
    });
  }

  // 3. Name check
  if (!record.name || record.name.trim().length === 0) {
    issues.push({
      recordId: record.id,
      field: 'name',
      severity: 'error',
      message: 'Official record name is empty',
    });
  }

  // 4. Address check
  if (!record.address || record.address.trim().length === 0) {
    issues.push({
      recordId: record.id,
      field: 'address',
      severity: 'warning',
      message: 'Official record missing postal address',
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
