import type { WorkingOpexDraftReceipt } from './workingOpexAdmission';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { FullModelAssumptions } from '../types';
import {
  buildTransientProjectAssumptionHandoff,
  type ProjectAssumptionAuthorityHandoff,
} from './projectAssumptionAuthority';
import {
  applyTransientAssumptionMutation,
  restoreDemoAssumptionPopulation,
  type TransientAssumptionState,
} from './projectAssumptionMutation';

export interface TransientProjectAssumptionsController {
  assumptions: FullModelAssumptions;
  setAssumptions: Dispatch<SetStateAction<FullModelAssumptions>>;
  restoreDemoAssumptions: (assumptions: FullModelAssumptions) => void;
  restoreInitialDemoAssumptions: () => void;
  authorityHandoff: ProjectAssumptionAuthorityHandoff;
  rejectionReasons: readonly string[];
  opexReceipts: readonly WorkingOpexDraftReceipt[];
}

/**
 * Owns the live in-memory assumption population and routes every ordinary React
 * setter mutation through the calculation-free authority transition boundary.
 *
 * This hook deliberately remains transient: it does not persist data, create a
 * durable audit log, infer a stable project ID, identify an actor or approve a baseline.
 * OPEX admissions retain explicitly transient input/change snapshots. It only makes the DEMO_DEFAULT -> DRAFT
 * transition truthful and central so later persistence/versioning can attach to
 * one mutation surface instead of many module-specific setters.
 */
export function useTransientProjectAssumptions(
  initialDemoAssumptions: () => FullModelAssumptions
): TransientProjectAssumptionsController {
  const initialDemoFactory = useRef(initialDemoAssumptions);
  const [state, setState] = useState<TransientAssumptionState>(() =>
    restoreDemoAssumptionPopulation(initialDemoFactory.current())
  );

  const setAssumptions = useCallback<Dispatch<SetStateAction<FullModelAssumptions>>>(
    (mutation) => {
      setState((current) => applyTransientAssumptionMutation(current, mutation));
    },
    []
  );

  const restoreDemoAssumptions = useCallback((assumptions: FullModelAssumptions) => {
    setState(restoreDemoAssumptionPopulation(assumptions));
  }, []);

  const restoreInitialDemoAssumptions = useCallback(() => {
    setState(restoreDemoAssumptionPopulation(initialDemoFactory.current()));
  }, []);

  const authorityHandoff = useMemo(
    () => buildTransientProjectAssumptionHandoff(state.assumptions, state.authority),
    [state]
  );

  return {
    assumptions: state.assumptions,
    setAssumptions,
    restoreDemoAssumptions,
    restoreInitialDemoAssumptions,
    authorityHandoff,
    rejectionReasons: state.rejectionReasons ?? [],
    opexReceipts: state.opexReceipts ?? [],
  };
}
