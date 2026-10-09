import {
  buildBaselineLatestSelectionGovernanceBundle,
  type BaselineLatestSelectionGovernanceBundle,
} from './baselineLatestSelectionGovernance';
import type { InvestmentBaselineSnapshot } from './baselineVersioningEngine';

export interface BaselineRegistryIngressIssue {
  readonly index: number | null;
  readonly field: string;
  readonly severity: 'error';
  readonly message: string;
}

export interface BaselineRegistryIngressGovernanceBundle {
  readonly ready: boolean;
  readonly ingressReady: boolean;
  readonly registrySnapshot: ReadonlyArray<Readonly<InvestmentBaselineSnapshot>> | null;
  readonly selection: BaselineLatestSelectionGovernanceBundle | null;
  readonly issues: ReadonlyArray<Readonly<BaselineRegistryIngressIssue>>;
  readonly blockingReasons: ReadonlyArray<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function retainRegistrySnapshot(
  population: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Readonly<InvestmentBaselineSnapshot>> {
  return Object.freeze(
    population.map((candidate) =>
      Object.freeze({
        ...candidate,
        sourceRefs: Array.isArray(candidate.sourceRefs)
          ? Object.freeze(
              candidate.sourceRefs.map((sourceRef) =>
                Object.freeze({ ...(sourceRef as Record<string, unknown>) })
              )
            )
          : undefined,
        metrics: Object.freeze({ ...(candidate.metrics as Record<string, unknown>) }),
      }) as unknown as Readonly<InvestmentBaselineSnapshot>
    )
  );
}

/**
 * Storage/adapter-facing runtime boundary for baseline-registry evidence.
 *
 * Persistence and connector payloads are `unknown` at runtime even when an upstream
 * TypeScript adapter claims a typed registry. This boundary rejects container shapes
 * that would otherwise be able to reach typed baseline selectors and deep-freeze code
 * before validation. Once the raw population is structurally safe to inspect, the
 * existing baseline latest-selection governance remains authoritative for baseline
 * identities, dates, statuses, metrics, project scope and deterministic selection.
 *
 * A structurally safe registry is retained as an immutable snapshot before selection.
 * This prevents caller-side mutation of baseline, source-reference or metric objects from
 * making the ingress evidence drift after latest-selection governance has already run.
 * The retained copy is structural evidence only: it does not authenticate durable storage,
 * create a persisted version, approve a baseline or alter any metric/economic value.
 *
 * This boundary does not authenticate storage, choose a persistence model, infer
 * lifecycle ordering, approve/supersede a baseline, or add project/sector economics.
 */
export function buildBaselineRegistryIngressGovernanceBundle(
  input: unknown
): BaselineRegistryIngressGovernanceBundle {
  const issues: BaselineRegistryIngressIssue[] = [];
  const blockingReasons: string[] = [];

  if (!Array.isArray(input)) {
    issues.push({
      index: null,
      field: 'registrySnapshot',
      severity: 'error',
      message: 'Baseline registry ingress requires an array population.',
    });
  }

  const rawPopulation = Array.isArray(input) ? input : [];

  rawPopulation.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      issues.push({
        index,
        field: 'snapshot',
        severity: 'error',
        message: `Baseline registry item ${index + 1} must be an object.`,
      });
      return;
    }

    if (
      candidate.sourceRefs !== undefined &&
      !Array.isArray(candidate.sourceRefs)
    ) {
      issues.push({
        index,
        field: 'sourceRefs',
        severity: 'error',
        message: `Baseline registry item ${index + 1} sourceRefs must be an array when supplied.`,
      });
    } else if (Array.isArray(candidate.sourceRefs)) {
      candidate.sourceRefs.forEach((sourceRef, sourceIndex) => {
        if (!isRecord(sourceRef)) {
          issues.push({
            index,
            field: `sourceRefs.${sourceIndex}`,
            severity: 'error',
            message:
              `Baseline registry item ${index + 1} source reference ${sourceIndex + 1} must be an object.`,
          });
        }
      });
    }

    if (!isRecord(candidate.metrics)) {
      issues.push({
        index,
        field: 'metrics',
        severity: 'error',
        message: `Baseline registry item ${index + 1} metrics must be an object.`,
      });
    }
  });

  if (issues.length > 0) {
    blockingReasons.push(
      `Baseline registry ingress is blocked by ${issues.length} malformed runtime container shape(s).`
    );
  }

  const ingressReady = issues.length === 0;
  const registrySnapshot = ingressReady
    ? retainRegistrySnapshot(rawPopulation as ReadonlyArray<Record<string, unknown>>)
    : null;

  const selection = registrySnapshot
    ? buildBaselineLatestSelectionGovernanceBundle({ registrySnapshot })
    : null;

  if (selection && !selection.ready) {
    blockingReasons.push(...selection.blockingReasons);
  }

  const ready = ingressReady && selection?.ready === true;

  return Object.freeze({
    ready,
    ingressReady,
    registrySnapshot,
    selection,
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
    blockingReasons: Object.freeze(Array.from(new Set(blockingReasons))),
  });
}
