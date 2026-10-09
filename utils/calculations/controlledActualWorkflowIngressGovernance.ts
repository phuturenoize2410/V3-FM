import {
  buildControlledActualWorkflowBundle,
  type ControlledActualWorkflowBundle,
  type ControlledActualWorkflowBundleInput,
} from './controlledActualWorkflowBundle';

export interface ControlledActualWorkflowIngressIssue {
  readonly field: string;
  readonly severity: 'error';
  readonly message: string;
}

export interface ControlledActualWorkflowIngressGovernanceBundle {
  readonly ready: boolean;
  readonly ingressReady: boolean;
  readonly workflowBundle: ControlledActualWorkflowBundle | null;
  readonly issues: ReadonlyArray<Readonly<ControlledActualWorkflowIngressIssue>>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectPopulationEnvelopeIssues(
  value: unknown,
  field: 'rows' | 'mappingRules',
  label: string
): ControlledActualWorkflowIngressIssue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) =>
    isRecord(entry)
      ? []
      : [{
          field: `${field}[${index}]`,
          severity: 'error' as const,
          message: `${label} entry at supplied index ${index} must be a non-array object envelope.`,
        }]
  );
}

function collectSourceRowScalarEnvelopeIssues(
  value: unknown
): ControlledActualWorkflowIngressIssue[] {
  if (!Array.isArray(value)) return [];

  const issues: ControlledActualWorkflowIngressIssue[] = [];
  const requiredStringFields = [
    'rowId',
    'sourceSystem',
    'postingDate',
    'dataClass',
  ] as const;
  const optionalStringFields = [
    'sourceFile',
    'cutoffDate',
    'company',
    'projectId',
    'phase',
    'glAccount',
    'costCenter',
    'wbsCode',
    'costCode',
    'contractId',
    'vendor',
    'currency',
    'description',
  ] as const;

  value.forEach((entry, index) => {
    if (!isRecord(entry)) return;

    requiredStringFields.forEach((field) => {
      if (typeof entry[field] !== 'string') {
        issues.push({
          field: `rows[${index}].${field}`,
          severity: 'error',
          message: `Controlled Actual source row ${field} at supplied index ${index} must be a string.`,
        });
      }
    });

    optionalStringFields.forEach((field) => {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') {
        issues.push({
          field: `rows[${index}].${field}`,
          severity: 'error',
          message: `Controlled Actual source row ${field} at supplied index ${index} must be a string when supplied.`,
        });
      }
    });

    if (typeof entry.amount !== 'number' || !Number.isFinite(entry.amount)) {
      issues.push({
        field: `rows[${index}].amount`,
        severity: 'error',
        message: `Controlled Actual source row amount at supplied index ${index} must be a finite number.`,
      });
    }
  });

  return issues;
}

function collectMappingRuleScalarEnvelopeIssues(
  value: unknown
): ControlledActualWorkflowIngressIssue[] {
  if (!Array.isArray(value)) return [];

  const issues: ControlledActualWorkflowIngressIssue[] = [];
  const requiredStringFields = [
    'id',
    'finmodCategory',
    'finmodLineItem',
  ] as const;
  const optionalStringFields = [
    'company',
    'projectId',
    'phase',
    'glAccount',
    'costCenter',
    'wbsPrefix',
    'costCodePrefix',
    'contractId',
    'finmodSubcategory',
    'accountingTreatment',
    'effectiveFrom',
    'effectiveTo',
  ] as const;

  value.forEach((entry, index) => {
    if (!isRecord(entry)) return;

    requiredStringFields.forEach((field) => {
      if (typeof entry[field] !== 'string') {
        issues.push({
          field: `mappingRules[${index}].${field}`,
          severity: 'error',
          message: `Controlled Actual Mapping Master rule ${field} at supplied index ${index} must be a string.`,
        });
      }
    });

    optionalStringFields.forEach((field) => {
      if (entry[field] !== undefined && typeof entry[field] !== 'string') {
        issues.push({
          field: `mappingRules[${index}].${field}`,
          severity: 'error',
          message: `Controlled Actual Mapping Master rule ${field} at supplied index ${index} must be a string when supplied.`,
        });
      }
    });

    if (typeof entry.priority !== 'number' || !Number.isFinite(entry.priority)) {
      issues.push({
        field: `mappingRules[${index}].priority`,
        severity: 'error',
        message: `Controlled Actual Mapping Master rule priority at supplied index ${index} must be a finite number.`,
      });
    }

    if (typeof entry.enabled !== 'boolean') {
      issues.push({
        field: `mappingRules[${index}].enabled`,
        severity: 'error',
        message: `Controlled Actual Mapping Master rule enabled flag at supplied index ${index} must be a boolean.`,
      });
    }

    if (entry.debtEligible !== undefined && typeof entry.debtEligible !== 'boolean') {
      issues.push({
        field: `mappingRules[${index}].debtEligible`,
        severity: 'error',
        message: `Controlled Actual Mapping Master rule debtEligible flag at supplied index ${index} must be a boolean when supplied.`,
      });
    }
  });

  return issues;
}

function collectSnapshotSignatureEnvelopeIssues(
  value: unknown
): ControlledActualWorkflowIngressIssue[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry, index) =>
    typeof entry === 'string'
      ? []
      : [{
          field: `mappingMasterSnapshot.ruleSignatures[${index}]`,
          severity: 'error' as const,
          message: `Expected Mapping Master rule signature at supplied index ${index} must be a string.`,
        }]
  );
}

function collectMetadataScalarEnvelopeIssues(
  metadata: Record<string, unknown>
): ControlledActualWorkflowIngressIssue[] {
  const issues: ControlledActualWorkflowIngressIssue[] = [];
  const requiredStringFields = [
    'importBatchId',
    'sourceReference',
    'mappingMasterVersion',
  ] as const;
  const optionalStringFields = [
    'preparedBy',
    'preparedAt',
    'notes',
  ] as const;

  requiredStringFields.forEach((field) => {
    if (typeof metadata[field] !== 'string') {
      issues.push({
        field: `metadata.${field}`,
        severity: 'error',
        message: `Controlled Actual release metadata ${field} must be supplied as a string.`,
      });
    }
  });

  optionalStringFields.forEach((field) => {
    if (metadata[field] !== undefined && typeof metadata[field] !== 'string') {
      issues.push({
        field: `metadata.${field}`,
        severity: 'error',
        message: `Controlled Actual release metadata ${field} must be a string when supplied.`,
      });
    }
  });

  return issues;
}

/**
 * Adapter-facing runtime boundary for Controlled Actual workflow evidence.
 *
 * Imported JSON, connector payloads and persisted evidence are `unknown` at runtime.
 * This boundary validates only the container and row/rule/metadata/snapshot envelope
 * shapes required to safely enter the existing authoritative workflow bundle. Once
 * those envelopes are safe to retain without shape-changing copies, the existing
 * Actual Import, Mapping Master, cutoff, release and snapshot governance remains
 * authoritative for all semantic validation and release decisions.
 *
 * This boundary deliberately does not repair rows, infer Mapping Master rules, create
 * expected snapshot signatures, authenticate a source system, convert currency/units,
 * approve a baseline or select a PIR case. It only prevents malformed runtime envelopes
 * from reaching retention/array/object/string/numeric operations that assume TypeScript
 * contracts were honoured. Source-row and Mapping Master scalar validation is primarily
 * type-only, with numeric finiteness enforced before mapping because non-finite Actual
 * amounts can poison control totals and non-finite priorities can make rule precedence
 * non-deterministic before downstream diagnostics get a chance to block release. Governed
 * value domains, blanks, dates, lifecycle phases, currency, data classes and accounting-
 * treatment semantics remain owned by the existing authoritative diagnostics rather than
 * being duplicated here. In particular, malformed row/rule entries, cutoff/metadata scalar
 * evidence and malformed snapshot scalar evidence fail before shallow retention or
 * `.trim()`/sort/sum-based operations can transform, contaminate or throw on caller-supplied
 * evidence. Optional source-row provenance strings are also kept type-safe so descriptive
 * evidence cannot be retained as arbitrary objects merely because it is not currently
 * consumed by Mapping Master matching.
 */
export function buildControlledActualWorkflowIngressGovernanceBundle(
  input: unknown
): ControlledActualWorkflowIngressGovernanceBundle {
  const issues: ControlledActualWorkflowIngressIssue[] = [];

  if (!isRecord(input)) {
    issues.push({
      field: 'workflow',
      severity: 'error',
      message: 'Controlled Actual workflow ingress requires an object envelope.',
    });
  }

  const envelope = isRecord(input) ? input : null;

  if (envelope && typeof envelope.cutoffDate !== 'string') {
    issues.push({
      field: 'cutoffDate',
      severity: 'error',
      message: 'Controlled Actual cutoff date must be supplied as a string.',
    });
  }

  if (envelope && !Array.isArray(envelope.rows)) {
    issues.push({
      field: 'rows',
      severity: 'error',
      message: 'Controlled Actual workflow rows must be supplied as an array population.',
    });
  } else if (envelope) {
    issues.push(
      ...collectPopulationEnvelopeIssues(
        envelope.rows,
        'rows',
        'Controlled Actual source row'
      ),
      ...collectSourceRowScalarEnvelopeIssues(envelope.rows)
    );
  }

  if (envelope && !Array.isArray(envelope.mappingRules)) {
    issues.push({
      field: 'mappingRules',
      severity: 'error',
      message: 'Controlled Actual Mapping Master rules must be supplied as an array population.',
    });
  } else if (envelope) {
    issues.push(
      ...collectPopulationEnvelopeIssues(
        envelope.mappingRules,
        'mappingRules',
        'Controlled Actual Mapping Master rule'
      ),
      ...collectMappingRuleScalarEnvelopeIssues(envelope.mappingRules)
    );
  }

  if (envelope && !isRecord(envelope.metadata)) {
    issues.push({
      field: 'metadata',
      severity: 'error',
      message: 'Controlled Actual release metadata must be supplied as an object.',
    });
  } else if (envelope && isRecord(envelope.metadata)) {
    issues.push(...collectMetadataScalarEnvelopeIssues(envelope.metadata));
  }

  if (envelope && !isRecord(envelope.mappingMasterSnapshot)) {
    issues.push({
      field: 'mappingMasterSnapshot',
      severity: 'error',
      message: 'Controlled Actual expected Mapping Master snapshot must be supplied as an object.',
    });
  } else if (envelope && isRecord(envelope.mappingMasterSnapshot)) {
    if (typeof envelope.mappingMasterSnapshot.version !== 'string') {
      issues.push({
        field: 'mappingMasterSnapshot.version',
        severity: 'error',
        message: 'Expected Mapping Master snapshot version must be supplied as a string.',
      });
    }

    if (!Array.isArray(envelope.mappingMasterSnapshot.ruleSignatures)) {
      issues.push({
        field: 'mappingMasterSnapshot.ruleSignatures',
        severity: 'error',
        message: 'Expected Mapping Master rule signatures must be supplied as an array population.',
      });
    } else {
      issues.push(
        ...collectSnapshotSignatureEnvelopeIssues(
          envelope.mappingMasterSnapshot.ruleSignatures
        )
      );
    }
  }

  const ingressReady = issues.length === 0;
  const workflowBundle = ingressReady && envelope
    ? buildControlledActualWorkflowBundle(
        envelope as unknown as ControlledActualWorkflowBundleInput
      )
    : null;

  const blockingReasons = [
    ...(issues.length > 0
      ? [`Controlled Actual workflow ingress is blocked by ${issues.length} malformed runtime envelope shape(s).`]
      : []),
    ...(workflowBundle?.blockingReasons ?? []),
  ];

  const ready = ingressReady && workflowBundle?.lifecycleEvidenceReady === true;

  return Object.freeze({
    ready,
    ingressReady,
    workflowBundle,
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
    blockingReasons: Object.freeze(Array.from(new Set(blockingReasons))),
  });
}
