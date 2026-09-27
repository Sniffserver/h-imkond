/**
 * OpenStreetMap (OSM) Ingestion Worker: Validate
 * Validates normalized OSM records against geographic bounding box and data integrity rules.
 */

import { NormalizedRecord, TALLINN_BBOX, ValidationIssue, ValidationResult } from '../types';

export function validateOsmRecord(record: NormalizedRecord, bbox = TALLINN_BBOX): ValidationResult {
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
      message: `Coordinates (${record.lat}, ${record.lng}) fall outside Tallinn bioregion bounding box`,
    });
  }

  // 2. Name validation
  if (!record.name || record.name.trim().length < 2) {
    issues.push({
      recordId: record.id,
      field: 'name',
      severity: 'error',
      message: 'Place name is missing or too short',
    });
  }

  // 3. Source ID validation
  if (!record.sourceId || (!record.sourceId.startsWith('node/') && !record.sourceId.startsWith('way/') && !record.sourceId.startsWith('relation/'))) {
    issues.push({
      recordId: record.id,
      field: 'sourceId',
      severity: 'warning',
      message: `Unexpected OSM sourceId format: "${record.sourceId}"`,
    });
  }

  // 4. Address check
  if (!record.address || record.address.trim().length === 0) {
    issues.push({
      recordId: record.id,
      field: 'address',
      severity: 'warning',
      message: 'Record missing street address',
    });
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}

export function validateOsmBatch(records: NormalizedRecord[], bbox = TALLINN_BBOX): {
  validRecords: NormalizedRecord[];
  rejectedRecords: { record: NormalizedRecord; issues: ValidationIssue[] }[];
} {
  const validRecords: NormalizedRecord[] = [];
  const rejectedRecords: { record: NormalizedRecord; issues: ValidationIssue[] }[] = [];

  for (const record of records) {
    const res = validateOsmRecord(record, bbox);
    if (res.valid) {
      validRecords.push(record);
    } else {
      rejectedRecords.push({ record, issues: res.issues });
    }
  }

  return { validRecords, rejectedRecords };
}
