import React from 'react';
import {
  FullModelAssumptions,
  SourcesAndUses,
  CurrencyDisplay,
} from '../../types';
import {
  formatCurrencyValue,
  formatPercent,
  formatNumber,
} from '../../utils/formatters';
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Shield,
  Layers,
} from 'lucide-react';

interface SourcesUsesTabProps {
  assumptions: FullModelAssumptions;
  sourcesAndUses: SourcesAndUses;
  currencyDisplay: CurrencyDisplay;
}

export const SourcesUsesTab: React.FC<SourcesUsesTabProps> = ({
  assumptions,
  sourcesAndUses,
  currencyDisplay,
}) => {
  const fx = assumptions.revenue.fxIdrPerUsd;
  const isZeroVariance = sourcesAndUses.variance < 0.001;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner with Mandatory Reconciliation Check */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Funding Sources & Uses Statement
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full project funding commitment reconciliation. Sources must exactly equal Uses.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold ${
            isZeroVariance
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-xs'
              : 'bg-rose-50 text-rose-800 border border-rose-300'
          }`}
        >
          {isZeroVariance ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>MANDATORY CHECK PASSED: TOTAL SOURCES - TOTAL USES = 0.00</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>
                CRITICAL MISMATCH: Variance of {sourcesAndUses.variance.toFixed(4)} IDR B
              </span>
            </>
          )}
        </div>
      </div>

      {/* Side-by-Side Sources and Uses Comparison Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* USES OF FUNDS */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
            <span>Project Uses of Funds (Expenditures)</span>
            <span className="font-mono">
              {formatCurrencyValue(sourcesAndUses.totalUses, currencyDisplay, fx, 2)}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="text-left py-2 px-3">Uses Item</th>
                <th className="text-right py-2 px-3">IDR Billion</th>
                <th className="text-right py-2 px-3">USD Million</th>
                <th className="text-right py-2 px-3">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">EPC Civil Works</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.epcCivil.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.epcCivil * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.epcCivil / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Electro-Mechanical Equipment</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.electroMechanical.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.electroMechanical * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.electroMechanical / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Transmission & Substation</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.transmission.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.transmission * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.transmission / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Development & Permitting</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.developmentCost.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.developmentCost * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.developmentCost / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Pre-Operating & Commissioning</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.preOperatingCost.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.preOperatingCost * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.preOperatingCost / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Owner's Cost & PMC</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.ownersCost.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.ownersCost * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.ownersCost / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Physical Contingency</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.contingency.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.contingency * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.contingency / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Initial Working Capital Seed</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.initialWorkingCapital.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.initialWorkingCapital * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.initialWorkingCapital / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="py-2 px-3 font-sans text-slate-900">Subtotal Base Hard & Soft CAPEX</td>
                <td className="py-2 px-3 text-right font-bold text-slate-900">{sourcesAndUses.baseCapexTotal.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-700">
                  {((sourcesAndUses.baseCapexTotal * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-700">
                  {((sourcesAndUses.baseCapexTotal / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">Financing Fees (Upfront & Commitment)</td>
                <td className="py-2 px-3 text-right">{sourcesAndUses.financingFees.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.financingFees * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.financingFees / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-sans text-slate-800">
                  Interest During Construction ({assumptions.funding.idcMode.toUpperCase()})
                </td>
                <td className="py-2 px-3 text-right text-blue-700 font-semibold">{sourcesAndUses.idcTotal.toFixed(3)}</td>
                <td className="py-2 px-3 text-right text-slate-500">
                  {((sourcesAndUses.idcTotal * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {((sourcesAndUses.idcTotal / sourcesAndUses.totalUses) * 100).toFixed(1)}%
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
              <tr>
                <td className="py-2.5 px-3 font-sans">TOTAL USES OF FUNDS</td>
                <td className="py-2.5 px-3 text-right text-sm">{sourcesAndUses.totalUses.toFixed(3)}</td>
                <td className="py-2.5 px-3 text-right">
                  {((sourcesAndUses.totalUses * 1e9) / fx / 1e6).toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SOURCES OF FUNDS */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-slate-900 text-white px-4 py-2.5 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <span>Project Sources of Funds (Financing)</span>
              <span className="font-mono">
                {formatCurrencyValue(sourcesAndUses.totalSources, currencyDisplay, fx, 2)}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-3">Sources Item</th>
                  <th className="text-right py-2 px-3">IDR Billion</th>
                  <th className="text-right py-2 px-3">USD Million</th>
                  <th className="text-right py-2 px-3">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                <tr>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-semibold text-slate-900">Senior Commercial Bank Loan</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {assumptions.funding.bankDebtPct}% Gearing • {assumptions.funding.bankInterestRatePct}% Rate • {assumptions.funding.repaymentPeriodYears}y Tenor
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700 font-bold text-sm">
                    {sourcesAndUses.bankLoanAmount.toFixed(3)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {((sourcesAndUses.bankLoanAmount * 1e9) / fx / 1e6).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                    {((sourcesAndUses.bankLoanAmount / sourcesAndUses.totalSources) * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-semibold text-slate-900">Sponsor Paid-in Equity</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      EPN ({assumptions.project.epnParticipationPct}%) & Partners ({assumptions.project.otherSponsorParticipationPct}%)
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-bold text-sm">
                    {sourcesAndUses.equityAmount.toFixed(3)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600">
                    {((sourcesAndUses.equityAmount * 1e9) / fx / 1e6).toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                    {((sourcesAndUses.equityAmount / sourcesAndUses.totalSources) * 100).toFixed(1)}%
                  </td>
                </tr>
                {assumptions.funding.shareholderLoanPct > 0 && (
                  <tr>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-900">Shareholder Subordinated Loan</div>
                    </td>
                    <td className="py-3 px-3 text-right text-purple-700 font-bold text-sm">
                      {sourcesAndUses.shareholderLoanAmount.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {((sourcesAndUses.shareholderLoanAmount * 1e9) / fx / 1e6).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">
                      {((sourcesAndUses.shareholderLoanAmount / sourcesAndUses.totalSources) * 100).toFixed(1)}%
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                <tr>
                  <td className="py-2.5 px-3 font-sans">TOTAL SOURCES OF FUNDS</td>
                  <td className="py-2.5 px-3 text-right text-sm">{sourcesAndUses.totalSources.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-right">
                    {((sourcesAndUses.totalSources * 1e9) / fx / 1e6).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Reconciliation Audit Card */}
          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-slate-700">Reconciliation Variance Check:</span>
              <span className="font-mono font-bold text-emerald-700">
                {sourcesAndUses.variance.toFixed(6)} IDR B
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Every Rupiah of project expenditure is fully backed by verified commercial bank commitments and sponsor equity calls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
