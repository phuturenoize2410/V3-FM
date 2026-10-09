import { WorkingInputEditor } from '../WorkingInputEditor';
import React from 'react';
import { FullModelAssumptions } from '../../types';
import { Calendar, Flag } from 'lucide-react';

interface TimelineTabProps {
  assumptions: FullModelAssumptions;
  onUpdateAssumptions: (a: FullModelAssumptions) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ assumptions, onUpdateAssumptions }) => {
  const { project, funding } = assumptions;
  const nMonths = project.constructionPeriodMonths;
  const opYears = project.operatingPeriodYears;
  const repYears = funding.repaymentPeriodYears;

  // Only surface dates that actually exist in the current model-assumption boundary.
  // Do not manufacture hydro-specific milestones, contractual dates, or schedule status.
  const milestones = [
    {
      name: 'Construction Start',
      month: null,
      date: project.constructionStartDate,
      type: 'model assumption',
    },
    {
      name: 'Commercial Operation Date (COD)',
      month: null,
      date: project.codDate,
      type: 'model assumption',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <WorkingInputEditor kind="timeline" assumptions={assumptions} onUpdateAssumptions={onUpdateAssumptions} />
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Project Timeline & Phasing</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Construction: {nMonths} Months • Operation: {opYears} Years
          </span>
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">Assumption-backed view.</span>{' '}
          Dates below come from the current model assumptions. Financial close, contractual milestones,
          schedule status, approval evidence and milestone audit history are unavailable until a governed
          project-schedule source is connected.
        </div>

        <div className="space-y-4 mb-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Lifecycle Reference
          </div>
          <div className="w-full bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Construction start</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">{project.constructionStartDate}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">COD</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">{project.codDate}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Construction period</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">{nMonths} months</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Debt repayment period</div>
                <div className="mt-1 font-mono font-semibold text-slate-900">{repYears} years</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Available Timeline Inputs
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="text-left py-2 px-3">Timeline Item</th>
                  <th className="text-center py-2 px-3">Project Month</th>
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Evidence</th>
                  <th className="text-center py-2 px-3">Schedule Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {milestones.map((m) => (
                  <tr key={m.name} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <span className="flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-slate-500" />
                        {m.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">Not Calculated</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{m.date}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                        {m.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Unavailable
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Additional dates can be entered as reference milestones above. They do not determine financing or concession mechanics in the current engine.
          </p>
        </div>
      </div>
    </div>
  );
};
