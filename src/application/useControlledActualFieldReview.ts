import { useState } from 'react';
import { evaluateControlledActualFieldReview, type ControlledActualFieldReview, type MonetaryReviewTarget } from './controlledActualFieldReview';

function fingerprintSessionObject(value: object): string | null {
  try {
    const encoded = JSON.stringify(value, (_key, candidate) => {
      if (typeof candidate === 'number') {
        if (Number.isNaN(candidate)) return { __finmodSessionNumber: 'NaN' };
        if (candidate === Infinity) return { __finmodSessionNumber: 'Infinity' };
        if (candidate === -Infinity) return { __finmodSessionNumber: '-Infinity' };
        if (Object.is(candidate, -0)) return { __finmodSessionNumber: '-0' };
      }
      if (candidate === undefined) return { __finmodSessionValue: 'undefined' };
      return candidate;
    });
    return typeof encoded === 'string' ? encoded : null;
  } catch {
    return null;
  }
}

/** App-owned session. A changed model, source text, selection or realization
 * population cannot reuse a previous result, including failed new submissions.
 * Model scope and population identity are checked both by object reference and
 * by session-only structural fingerprints so in-place mutation cannot retain
 * stale evidence. Non-finite numeric, negative-zero and undefined values receive
 * explicit session tags so JSON normalization cannot collapse distinct runtime
 * states. Fingerprints are not durable identity, authentication or storage
 * hashes. No storage, approval or legacy dataset mutation is performed. */
export function useControlledActualFieldReview(modelScope: object) {
  const [draft, setDraft] = useState('');
  const [selectedFieldId, setSelected] = useState('');
  const [submission, setSubmission] = useState<{
    scope: object;
    scopeFingerprint: string | null;
    population: object;
    populationFingerprint: string | null;
    result: ControlledActualFieldReview;
  } | null>(null);
  return {
    draft, selectedFieldId,
    changeDraft(value: string) { setDraft(value); setSubmission(null); },
    selectField(value: string) { setSelected(value); setSubmission(null); },
    invalidate() { setSubmission(null); },
    submit(target: MonetaryReviewTarget, population: object) {
      setSubmission({
        scope: modelScope,
        scopeFingerprint: fingerprintSessionObject(modelScope),
        population,
        populationFingerprint: fingerprintSessionObject(population),
        result: evaluateControlledActualFieldReview(draft, target),
      });
    },
    resultFor(population: object) {
      if (!submission || submission.scope !== modelScope || submission.population !== population) return null;
      const currentScopeFingerprint = fingerprintSessionObject(modelScope);
      const currentPopulationFingerprint = fingerprintSessionObject(population);
      return submission.scopeFingerprint !== null &&
        currentScopeFingerprint === submission.scopeFingerprint &&
        submission.populationFingerprint !== null &&
        currentPopulationFingerprint === submission.populationFingerprint &&
        submission.result.target.fieldId === selectedFieldId
        ? submission.result
        : null;
    },
  };
}
export type ControlledActualFieldReviewController = ReturnType<typeof useControlledActualFieldReview>;
