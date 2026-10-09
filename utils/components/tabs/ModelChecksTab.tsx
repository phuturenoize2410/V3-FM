import React from 'react';
import { ModelCheckItem } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

interface ModelChecksTabProps {
  checks: ModelCheckItem[];
  onOpenAuditTrace: (key: string) => void;
}

export const ModelChecksTab: React.FC<ModelChecksTabProps> = ({
  checks,
}) => {
  const hasChecks = checks.length > 0;
  const allPassed = hasChecks && checks.every((c) => c.passed);
  const passedCount = checks.filter((c) => c.passed).length;
  const failedCount = checks.length - passedCount;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-[#FFFEFA] border border-slate-200/90 rounded-lg px-5 py-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-semibold tracking-tight text-slate-950">
              Model Integrity & Accounting Audit Checks
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Governed verification matrix for financial statements, roll-forwards, debt controls, and calculation integrity. A missing check population is never treated as a passing audit state.
          </p>
        </div>

        <div
          data-model-check-overall-status={
            !hasChecks ? 'NO_EVIDENCE' : allPassed ? 'PASS' : 'FAIL'
          }
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-semibold tracking-wide border ${
            !hasChecks
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : allPassed
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {!hasChecks ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>NO GOVERNED CHECK EVIDENCE</span>
            </>
          ) : allPassed ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ALL CHECKS PASSED · {passedCount}/{checks.length}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>{failedCount} CHECK{failedCount === 1 ? '' : 'S'} REQUIRE ATTENTION</span>
            </>
          )}
        </div>
      </div>

      <div className="bg-[#FFFEFA] border border-slate-200/90 rounded-lg shadow-xs overflow-hidden">
        <div className="bg-[#172033] text-slate-100 px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] border-b border-slate-700">
          <span>Project Finance Integrity Rules</span>
          <span className="text-slate-300 normal-case tracking-normal font-normal">
            Governed thresholds · explicit evidence · no inferred pass state
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse tabular-nums">
            <thead className="bg-[#F4F2EC] text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="text-left py-2.5 px-3">Control ID</th>
                <th className="text-left py-2.5 px-3">Integrity Validation</th>
                <th className="text-left py-2.5 px-3">Evidence & Tolerance</th>
                <th className="text-right py-2.5 px-3">Control Delta</th>
                <th className="text-center py-2.5 px-3">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {checks.map((check, idx) => {
                const hasFiniteDelta = Number.isFinite(check.delta);

                return (
                  <tr
                    key={check.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !check.passed ? 'bg-rose-50/35' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-600 align-top">
                      <div className="font-semibold text-slate-800" data-model-check-id={check.id}>
                        {check.id}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        Display order CHK-{String(idx + 1).padStart(2, '0')}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-semibold text-slate-900">{check.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{check.details}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                        {check.category.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px] align-top">
                      <div className="font-mono font-medium text-slate-800">{check.valueDescription}</div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Governed tolerance: &lt; {Number.isFinite(check.tolerance) ? check.tolerance : 'N/A'}
                      </div>
                    </td>
                    <td
                      className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 align-top"
                      data-model-check-delta={hasFiniteDelta ? 'FINITE' : 'MISSING_OR_INVALID'}
                    >
                      {hasFiniteDelta ? check.delta.toFixed(5) : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 text-center align-top">
                      {check.passed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold text-[10px] uppercase border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-semibold text-[10px] uppercase border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!hasChecks && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <div className="font-medium text-slate-700">No governed model-check evidence supplied.</div>
                    <div className="mt-1 text-[11px]">
                      Audit readiness remains unverified until the authoritative check population is available.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
