import { useTransientProjectAssumptions } from './application/useTransientProjectAssumptions';
import { useControlledActualFieldReview } from './application/useControlledActualFieldReview';
import React, { useState, useMemo } from 'react';
import {
  FullModelAssumptions,
  CurrencyDisplay,
  ScenarioType,
  DrawdownOrder,
  IdcMode,
  TabId,
  CapexItem,
} from './types';
import { isTabId, type NavigateToTab } from './application/navigation';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import { FormulaTraceModal } from './components/FormulaTraceModal';
import { BASE_PLTA_ASSUMPTIONS } from './calculations/defaultAssumptions';
import {
  calculateModelMetrics,
  buildFormulaTraceNodes,
  PRESET_SCENARIOS,
  ScenarioDefinition,
  applyScenario,
} from './calculations/financialEngine';
import {
  calculateAuditedMonthlyCapex,
  calculateAuditedSourcesAndUses,
} from './calculations/constructionFundingEngine';
import { calculateAuditedDebtAndOperations } from './calculations/auditedOperatingEngine';
import { buildAuditedCalculationScheduleGovernanceBundle } from './calculations/auditedCalculationScheduleGovernanceBundle';

// Tab Components (All 30 Modules)
import { DriverCockpitTab } from './components/tabs/DriverCockpitTab';
import { ControlTab } from './components/tabs/ControlTab';
import { AssumptionsTab } from './components/tabs/AssumptionsTab';
import { TimelineTab } from './components/tabs/TimelineTab';
import { CapexTab } from './components/tabs/CapexTab';
import { SourcesUsesTab } from './components/tabs/SourcesUsesTab';
import { FundingTab } from './components/tabs/FundingTab';
import { DebtFinancingTab } from './components/tabs/DebtFinancingTab';
import { IdcTab } from './components/tabs/IdcTab';
import { RevenueTab } from './components/tabs/RevenueTab';
import { OpexTab } from './components/tabs/OpexTab';
import { FixedAssetsTab } from './components/tabs/FixedAssetsTab';
import { DepreciationTab } from './components/tabs/DepreciationTab';
import { TaxTab } from './components/tabs/TaxTab';
import { IncomeStatementTab } from './components/tabs/IncomeStatementTab';
import { BalanceSheetTab } from './components/tabs/BalanceSheetTab';
import { CashFlowStatementTab } from './components/tabs/CashFlowStatementTab';
import { CfadsTab } from './components/tabs/CfadsTab';
import { DscrTab } from './components/tabs/DscrTab';
import { DsraTab } from './components/tabs/DsraTab';
import { LlcrTab } from './components/tabs/LlcrTab';
import { ProjectCashFlowTab } from './components/tabs/ProjectCashFlowTab';
import { EquityCashFlowTab } from './components/tabs/EquityCashFlowTab';
import { ValuationTab } from './components/tabs/ValuationTab';
import { LcoeTab } from './components/tabs/LcoeTab';
import { SensitivityTab } from './components/tabs/SensitivityTab';
import { ScenarioTab } from './components/tabs/ScenarioTab';
import { ExecutiveSummaryTab } from './components/tabs/ExecutiveSummaryTab';
import { ModelChecksTab } from './components/tabs/ModelChecksTab';
import { ReconciliationTab } from './components/tabs/ReconciliationTab';
import { AuditTrailTab } from './components/tabs/AuditTrailTab';
import { PlanVsActualTab } from './components/tabs/PlanVsActualTab';

export default function App() {
  const { assumptions, setAssumptions, restoreInitialDemoAssumptions, authorityHandoff, rejectionReasons, opexReceipts } = useTransientProjectAssumptions(
    () => JSON.parse(JSON.stringify(BASE_PLTA_ASSUMPTIONS))
  );
  const controlledActualReview = useControlledActualFieldReview(assumptions);
  const [activeTab, setActiveTab] = useState<TabId>('00_driver_cockpit');
  const navigateToTab: NavigateToTab = (tab) => {
    if (isTabId(tab)) setActiveTab(tab);
  };
  const [currencyDisplay, setCurrencyDisplay] = useState<CurrencyDisplay>('IDR_B');
  const [activeScenarioId, setActiveScenarioId] = useState<string>('base');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditNodeKey, setAuditNodeKey] = useState<string>('project_irr');

  const capexSchedule = useMemo(() => {
    return calculateAuditedMonthlyCapex(assumptions);
  }, [assumptions]);

  const sourcesAndUses = useMemo(() => {
    return calculateAuditedSourcesAndUses(assumptions, capexSchedule);
  }, [assumptions, capexSchedule]);

  const operatingResult = useMemo(() => {
    return calculateAuditedDebtAndOperations(assumptions, sourcesAndUses);
  }, [assumptions, sourcesAndUses]);

  const debtSchedule = operatingResult.debtSchedule;
  const annualRows = operatingResult.annualRows;

  const metrics = useMemo(() => {
    return calculateModelMetrics(assumptions, capexSchedule, annualRows, sourcesAndUses);
  }, [assumptions, capexSchedule, sourcesAndUses, annualRows]);

  const checks = useMemo(() => {
    return [...buildAuditedCalculationScheduleGovernanceBundle(
      assumptions,
      sourcesAndUses,
      capexSchedule,
      operatingResult,
      metrics
    ).checks];
  }, [assumptions, sourcesAndUses, capexSchedule, operatingResult, metrics]);

  const traceNodes = useMemo(() => {
    return buildFormulaTraceNodes(assumptions, metrics, sourcesAndUses, annualRows);
  }, [assumptions, metrics, sourcesAndUses, annualRows]);

  const failedCheckCount = useMemo(() => {
    return checks.filter((c) => !c.passed).length;
  }, [checks]);

  const handleResetDefaults = () => {
    restoreInitialDemoAssumptions();
    setActiveScenarioId('base');
  };

  const handleSelectScenario = (sc: ScenarioDefinition) => {
    setActiveScenarioId(sc.id);
    const updated = applyScenario(BASE_PLTA_ASSUMPTIONS, sc);
    setAssumptions(updated);
  };

  const handleApplyScenarioFromTab = (scenario: ScenarioType, modifiedAssumptions: FullModelAssumptions) => {
    setActiveScenarioId(scenario);
    setAssumptions(modifiedAssumptions);
  };

  const handleOpenAuditTrace = (key: string = 'project_irr') => {
    setAuditNodeKey(key);
    setIsAuditModalOpen(true);
  };

  const handleUpdateCapexItem = (id: string, updates: Partial<CapexItem> | number) => {
    setAssumptions((prev) => ({
      ...prev,
      capexItems: prev.capexItems.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(typeof updates === 'number' ? { amountIdrBillion: updates } : updates),
            }
          : item
      ),
    }));
  };

  const handleChangeDrawdownOrder = (order: DrawdownOrder) => {
    setAssumptions((prev) => ({
      ...prev,
      funding: { ...prev.funding, drawdownOrder: order },
    }));
  };

  const handleChangeIdcMode = (mode: IdcMode) => {
    setAssumptions((prev) => ({
      ...prev,
      funding: { ...prev.funding, idcMode: mode },
    }));
  };

  return (
    <div className="h-screen w-screen bg-[#F8F9FA] text-[#1A1A1A] flex flex-col font-sans selection:bg-blue-600 selection:text-white antialiased overflow-hidden">
      <Header
        onSelectTab={navigateToTab}
        projectName={assumptions.project.projectName}
        capacityMW={assumptions.project.installedCapacityMW}
        technology={assumptions.project.technology || 'hydro'}
        operatingPeriodYears={assumptions.project.operatingPeriodYears}
        metrics={metrics}
        checks={checks}
        currencyDisplay={currencyDisplay}
        setCurrencyDisplay={setCurrencyDisplay}
        activeScenarioId={activeScenarioId}
        scenarios={PRESET_SCENARIOS}
        onSelectScenario={handleSelectScenario}
        onResetBase={handleResetDefaults}
        onOpenAuditTrace={handleOpenAuditTrace}
        fxIdrPerUsd={assumptions.revenue.fxIdrPerUsd}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className="flex-1 flex min-h-0">
        <Navigation
          activeTab={activeTab}
          onSelectTab={navigateToTab}
          failedCheckCount={failedCheckCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main data-active-tab={activeTab} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 pb-20 bg-slate-100/70 w-full">
          <div className="mb-3 text-[11px] text-slate-500" data-testid="working-authority">{authorityHandoff.authority} · In-memory working model · Not persisted / not approved</div>
          {assumptions.workingInputs?.opex && <p className="mb-3 text-xs text-amber-800">Working OPEX master active. Legacy OPEX controls and OPEX scenario shocks do not represent this master. <button data-nav-tab="10_opex" onClick={() => navigateToTab('10_opex')} className="underline font-semibold">Open OPEX master</button></p>}

          {rejectionReasons.length > 0 && <p role="alert" className="mb-3 text-xs text-amber-800">Input change blocked; last admitted model retained: {rejectionReasons.join(' ')}</p>}

          <div className="w-full space-y-4">
            {activeTab === '00_driver_cockpit' && (
              <DriverCockpitTab
                assumptions={assumptions}
                onChangeAssumptions={setAssumptions}
                onResetDefaults={handleResetDefaults}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
                onSelectTab={navigateToTab}
              />
            )}

            {activeTab === '01_control' && (
              <ControlTab
                annualRows={annualRows}
                onSelectTab={navigateToTab}
                setCurrencyDisplay={setCurrencyDisplay}
                activeScenarioId={activeScenarioId}
                onSelectScenario={handleSelectScenario}
                onResetBase={handleResetDefaults}
                assumptions={assumptions}
                metrics={metrics}
                checks={checks}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '02_assumptions' && (
              <AssumptionsTab
                assumptions={assumptions}
                onUpdateAssumptions={setAssumptions}
                onChangeAssumptions={setAssumptions}
                onResetBase={handleResetDefaults}
                onResetDefaults={handleResetDefaults}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '03_timeline' && (
              <TimelineTab assumptions={assumptions} onUpdateAssumptions={setAssumptions} />
            )}

            {activeTab === '04_capex' && (
              <CapexTab
                assumptions={assumptions}
                monthlySchedule={capexSchedule}
                capexSchedule={capexSchedule}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onUpdateAssumptions={setAssumptions}
                onChangeAssumptions={setAssumptions}
                onUpdateCapexItem={handleUpdateCapexItem}
                onChangeDrawdownOrder={handleChangeDrawdownOrder}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '05_sources_uses' && (
              <SourcesUsesTab
                assumptions={assumptions}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '06_funding' && (
              <FundingTab
                assumptions={assumptions}
                sourcesAndUses={sourcesAndUses}
                capexSchedule={capexSchedule}
                currencyDisplay={currencyDisplay}
                onChangeDrawdownOrder={handleChangeDrawdownOrder}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '07_debt' && (
              <DebtFinancingTab
                sourcesAndUses={sourcesAndUses}
                assumptions={assumptions}
                debtSchedule={debtSchedule}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onUpdateAssumptions={setAssumptions}
                onChangeAssumptions={setAssumptions}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '08_idc' && (
              <IdcTab
                assumptions={assumptions}
                capexSchedule={capexSchedule}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onChangeIdcMode={handleChangeIdcMode}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '09_revenue' && (
              <RevenueTab
                assumptions={assumptions}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
                onUpdateAssumptions={setAssumptions}
              />
            )}

            {activeTab === '10_opex' && (
              <>
                {opexReceipts.length > 0 && <details className="mb-3 text-xs text-slate-600" data-testid="opex-draft-receipts">
                  <summary className="cursor-pointer font-semibold">OPEX Draft change receipts · {opexReceipts.length} in this session</summary>
                  <p>Historical input snapshots only. Not saved, approved or verified. Actor, edit time, saved version and calculation result reference are unavailable. Reset clears this session history.</p>
                  {opexReceipts.map((receipt, index) => <div key={index} className="mt-2 border-t border-stone-200 pt-2">
                    <p>{receipt.reason} · {receipt.sourceReference} · DRAFT</p>
                    <ul>{receipt.records.map((record, row) => <li key={row}>{record.operation} · {record.targetId}</li>)}</ul>
                    <details><summary className="cursor-pointer">Exact input and change snapshot {index + 1}</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap">{JSON.stringify(receipt, null, 2)}</pre></details>
                  </div>)}
                </details>}
                <OpexTab
                  onUpdateAssumptions={setAssumptions}
                  assumptions={assumptions}
                  annualRows={annualRows}
                  currencyDisplay={currencyDisplay}
                  onOpenAuditTrace={handleOpenAuditTrace}
                />
              </>
            )}

            {activeTab === '11_fixed_assets' && (
              <FixedAssetsTab
                assumptions={assumptions}
                annualRows={annualRows}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '12_depreciation' && (
              <DepreciationTab
                assumptions={assumptions}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '13_tax' && (
              <TaxTab
                assumptions={assumptions}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '14_income_statement' && (
              <IncomeStatementTab
                assumptions={assumptions}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '15_balance_sheet' && (
              <BalanceSheetTab
                assumptions={assumptions}
                annualRows={annualRows}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '16_cash_flow' && (
              <CashFlowStatementTab
                assumptions={assumptions}
                annualRows={annualRows}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '17_cfads' && (
              <CfadsTab
                assumptions={assumptions}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '18_dscr' && (
              <DscrTab
                onUpdateAssumptions={setAssumptions}
                assumptions={assumptions}
                annualRows={annualRows}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '19_dsra' && (
              <DsraTab
                sourcesAndUses={sourcesAndUses}
                assumptions={assumptions}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '20_llcr' && (
              <LlcrTab
                assumptions={assumptions}
                annualRows={annualRows}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '21_project_cashflow' && (
              <ProjectCashFlowTab
                sourcesAndUses={sourcesAndUses}
                assumptions={assumptions}
                capexSchedule={capexSchedule}
                annualRows={annualRows}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '22_equity_cashflow' && (
              <EquityCashFlowTab
                sourcesAndUses={sourcesAndUses}
                assumptions={assumptions}
                capexSchedule={capexSchedule}
                annualRows={annualRows}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '23_valuation' && (
              <ValuationTab
                sourcesAndUses={sourcesAndUses}
                assumptions={assumptions}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '24_lcoe' && (
              <LcoeTab
                annualRows={annualRows}
                sourcesAndUses={sourcesAndUses}
                assumptions={assumptions}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '25_sensitivity' && (
              <SensitivityTab
                assumptions={assumptions}
                baseMetrics={metrics}
                currencyDisplay={currencyDisplay}
              />
            )}

            {activeTab === '26_scenarios' && (
              <ScenarioTab
                currentAssumptions={assumptions}
                currentScenario={activeScenarioId as ScenarioType}
                assumptions={assumptions}
                baseAssumptions={BASE_PLTA_ASSUMPTIONS}
                metrics={metrics}
                onApplyScenario={handleApplyScenarioFromTab}
                onResetBase={handleResetDefaults}
                currencyDisplay={currencyDisplay}
              />
            )}

            {activeTab === '27_executive_summary' && (
              <ExecutiveSummaryTab
                onSelectTab={navigateToTab}
                assumptions={assumptions}
                metrics={metrics}
                sourcesAndUses={sourcesAndUses}
                annualRows={annualRows}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}

            {activeTab === '28_model_checks' && (
              <ModelChecksTab onOpenAuditTrace={handleOpenAuditTrace} checks={checks} currencyDisplay={currencyDisplay} />
            )}

            {activeTab === '29_reconciliation' && (
              <ReconciliationTab
                debtSchedule={debtSchedule}
                annualRows={annualRows}
                onOpenAuditTrace={handleOpenAuditTrace}
                assumptions={assumptions}
                metrics={metrics}
                sourcesAndUses={sourcesAndUses}
                currencyDisplay={currencyDisplay}
              />
            )}

            {activeTab === '30_audit_trail' && (
              <AuditTrailTab
                traceNodes={traceNodes}
                onSelectAuditKey={(key) => handleOpenAuditTrace(key)}
              />
            )}

            {activeTab === '31_plan_vs_actual' && (
              <PlanVsActualTab
                controlledActualReview={controlledActualReview}
                assumptions={assumptions}
                sourcesAndUses={sourcesAndUses}
                annualRows={annualRows}
                metrics={metrics}
                currencyDisplay={currencyDisplay}
                onOpenAuditTrace={handleOpenAuditTrace}
              />
            )}
          </div>
        </main>
      </div>

      <FormulaTraceModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        nodeKey={auditNodeKey}
        traceNodes={traceNodes}
        onSelectNode={setAuditNodeKey}
      />
    </div>
  );
}
