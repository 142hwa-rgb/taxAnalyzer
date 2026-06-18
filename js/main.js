import { LOCALE_ENGINE } from './i18n.js';
import { SYSTEM_BRACKETS_2026 } from './config.js';
import { 
    executeSystemTaxMath, 
    getOrdinaryBracketRate,
    calculateMultiYearProjection
} from './taxMath.js';
import { 
    updateUILabels, 
    updateInputLabels, 
    updateMetricTiles, 
    updateOBBBRow, 
    updateSSRow, 
    updateNIITRow, 
    updateIRMAARow, 
    updateChartHeader,
    renderStrategyComparison,
    setupTabListeners,
    renderProjectionTable
} from './uiController.js';
import { 
    generateIntegratedMatrix, 
    drawPlannerChart,
    state,
    drawProjectionChart as drawProjChart
} from './chartRenderer.js';

let currentLanguage = "en";

// Toggle between English and Chinese
export function toggleSystemLanguage() {
    currentLanguage = document.getElementById("langSelector").value;
    runPlannerEngine();
}

/**
 * Serializes current UI state to Local Storage
 */
function saveToLocalStorage() {
    const data = {
        filing: document.getElementById("paramFiling").value,
        senior: document.getElementById("checkSenior").checked,
        wages: document.getElementById("inputWages").value,
        pretax: document.getElementById("inputPreTax").value,
        ss: document.getElementById("inputSS").value,
        stcg: document.getElementById("inputSTCG").value,
        recapture: document.getElementById("inputRecapture").value,
        ltcg: document.getElementById("inputLTCG").value,
        age1: document.getElementById("inputAge1")?.value,
        bal1: document.getElementById("inputBal1")?.value,
        age2: document.getElementById("inputAge2")?.value,
        bal2: document.getElementById("inputBal2")?.value,
        inflation: document.getElementById("inputInflation")?.value,
        growth: document.getElementById("inputGrowth")?.value,
        alloc: document.getElementById("inputAllocationMethod")?.value,
        fixedPct: document.getElementById("inputFixedPct")?.value,
        lang: document.getElementById("langSelector").value
    };
    localStorage.setItem("tax_analyzer_save", JSON.stringify(data));
}

/**
 * Restores UI state from Local Storage
 */
function loadFromLocalStorage() {
    const saved = localStorage.getItem("tax_analyzer_save");
    if (!saved) return;
    try {
        const d = JSON.parse(saved);
        if (d.filing) document.getElementById("paramFiling").value = d.filing;
        if (d.senior !== undefined) document.getElementById("checkSenior").checked = d.senior;
        ['wages','pretax','ss','stcg','recapture','ltcg','age1','bal1','age2','bal2','inflation','growth','fixedPct'].forEach(key => {
            const el = document.getElementById("input" + key.charAt(0).toUpperCase() + key.slice(1));
            if (el && d[key] !== undefined) el.value = d[key];
        });
        if (d.alloc) document.getElementById("inputAllocationMethod").value = d.alloc;
        if (d.lang) { document.getElementById("langSelector").value = d.lang; currentLanguage = d.lang; }
    } catch (e) { console.error("Load failed", e); }
}

// Main engine: orchestrate all calculations and UI updates
export function runPlannerEngine() {
    const lexicon = LOCALE_ENGINE[currentLanguage];
    const status = document.getElementById("paramFiling").value;
    const isSenior = document.getElementById("checkSenior").checked;
    
    const wVal = parseInt(document.getElementById("inputWages").value);
    const pVal = parseInt(document.getElementById("inputPreTax").value);
    const sVal = parseInt(document.getElementById("inputSS").value);
    const stVal = parseInt(document.getElementById("inputSTCG").value);
    const rVal = parseInt(document.getElementById("inputRecapture").value);
    const lVal = parseInt(document.getElementById("inputLTCG").value);
    
    const age1 = parseInt(document.getElementById("inputAge1")?.value || 0);
    const bal1 = parseInt(document.getElementById("inputBal1")?.value || 0);
    const age2 = parseInt(document.getElementById("inputAge2")?.value || 0);
    const bal2 = parseInt(document.getElementById("inputBal2")?.value || 0);

    const inflationVal = parseFloat(document.getElementById("inputInflation")?.value || 0.03);
    const growthVal = parseFloat(document.getElementById("inputGrowth")?.value || 0.06);
    const allocMethod = document.getElementById("inputAllocationMethod")?.value || 'proportional';
    const fixedPct = parseFloat(document.getElementById("inputFixedPct")?.value || 0.5);
    
    state.pretaxAccounts = status === "MFJ" ? 
        [{ balance: bal1, age: age1 }, { balance: bal2, age: age2 }] : 
        [{ balance: bal1, age: age1 }];

    state.inflationRate = inflationVal;
    state.growthRate = growthVal;

    updateInputLabels(
        wVal, pVal, sVal, stVal, rVal, lVal, 
        bal1, bal2, inflationVal, growthVal, fixedPct
    );

    saveToLocalStorage();

    state.boundaryOrd = wVal + pVal + stVal;
    state.boundaryRecap = state.boundaryOrd + rVal;
    state.boundaryTotal = state.boundaryRecap + lVal;

    // Run the multi-year projection based on current inputs and assumptions
    state.projectionResults = calculateMultiYearProjection(
        { wages: wVal, pretax: pVal, ss: sVal, stcg: stVal, recapture: rVal, ltcg: lVal, status: status },
        { 
            inflationRate: state.inflationRate, 
            growthRate: state.growthRate,
            allocationMethod: allocMethod,
            fixedPct: fixedPct,
            strategy: state.selectedStrategy
        },
        state
    );

    let baseline = executeSystemTaxMath(wVal, pVal, sVal, stVal, rVal, lVal, status, isSenior);
    
    state.macroLimit = Math.max(100000, Math.ceil((2 * state.boundaryTotal) / 100000) * 100000);
    updateChartHeader(state.macroLimit, lexicon);

    updateMetricTiles(baseline, status, isSenior, lexicon);
    updateOBBBRow(baseline, status, isSenior, lexicon);
    updateSSRow(baseline, status, lexicon);
    updateNIITRow(baseline, lexicon);
    updateIRMAARow(baseline, status, isSenior, lexicon);
    
    // Manage chart tab visibility
    const btnChartProj = document.getElementById("btnChartProj");
    if (btnChartProj) {
        btnChartProj.style.display = isSenior ? "block" : "none";
    }

    // Find the label for the selected strategy to show in the projection tab
    const scenarios = calculateStrategies(baseline, status, isSenior, wVal, sVal, stVal, rVal, lVal, lexicon, true);
    const activeStrat = scenarios.find(s => s.isSelected);
    const stratLabel = activeStrat ? activeStrat.label : lexicon.stratNone;

    renderProjectionTable(state.projectionResults, lexicon, stratLabel, status === "MFJ");

    // Render Comparison Table
    renderStrategyComparison(scenarios, lexicon, baseline.irmaaTier);

    if (state.activeChartTab === 'projection' && isSenior) {
        document.getElementById("uiChartHeader").innerText = "Balance & Tax Projection (30 Year Horizon)";
        drawProjChart(lexicon, status === "MFJ");
    } else {
        state.activeChartTab = 'system'; // Fallback
        generateIntegratedMatrix(status, wVal, pVal, sVal, stVal, rVal, lVal, isSenior);
        drawPlannerChart(status, isSenior, lexicon);
    }
}

function calculateStrategies(baseline, status, isSenior, wages, ss, stcg, recapture, ltcg, lexicon, silent = false) {
    const matrix = SYSTEM_BRACKETS_2026[status];
    const scenarios = [];
    const currentPretax = parseInt(document.getElementById("inputPreTax").value);

    // 1. Current Scenario
    const currentIsSelected = state.selectedStrategy.type === 'nominal';
    scenarios.push({ 
        ...createScenario(baseline, lexicon.stratCurrent, 'current', currentPretax, baseline), 
        isSelected: currentIsSelected, stratMeta: { type: 'nominal' } 
    });

    // Solver to find pre-tax amount for a specific target (Taxable Income or MAGI)
    const solver = (targetVal, type) => {
        let low = 0, high = 1000000, bestP = 0;
        for(let i=0; i<25; i++) {
            let mid = (low + high) / 2;
            let test = executeSystemTaxMath(wages, mid, ss, stcg, recapture, ltcg, status, isSenior);
            let val = (type === 'taxable') ? (test.taxableOrdinaryCalculated ?? (test.agiCalculated - matrix.stdDeductionBase)) : test.agiCalculated;
            if (val < targetVal) { low = mid; bestP = mid; }
            else high = mid;
        }
        return bestP;
    };

    const currentTaxable = baseline.taxableOrdinaryCalculated ?? (baseline.agiCalculated - matrix.stdDeductionBase);
    const currentRate = getOrdinaryBracketRate(currentTaxable, matrix) || 0;
    const ordIdx = matrix.ordSchedule.findIndex(b => b.rate === currentRate);

    // 2. Tax Brackets: Below, Current, and Above
    const ordIndices = [ordIdx - 1, ordIdx, ordIdx + 1];
    ordIndices.forEach(idx => {
        if (idx >= 0 && idx < matrix.ordSchedule.length) {
            const bracket = matrix.ordSchedule[idx];
            if (bracket.cap === Infinity) return;
            
            const p = solver(bracket.cap - 0.01, 'taxable');
            const label = (idx < ordIdx) ? lexicon.stratPrevBracket : 
                          (idx === ordIdx) ? lexicon.stratFillCurrent : lexicon.stratFillNext;
            
            // Only add if it's a valid alternative (p > 0 and within reasonable range)
            if (p >= 0 && p < 1000000) {
                const isSelected = state.selectedStrategy.type === 'bracket' && state.selectedStrategy.value === idx;
                scenarios.push({ 
                    ...createScenario(executeSystemTaxMath(wages, p, ss, stcg, recapture, ltcg, status, isSenior), label, 'bracket_' + idx, p, baseline),
                    isSelected, stratMeta: { type: 'bracket', value: idx } 
                });
            }
        }
    });

    // 3. IRMAA Tiers: Below and Current (Cliff avoidance)
    if (isSenior) {
        const currentMagi = baseline.agiCalculated;
        const irmaaIdx = matrix.irmaaSchedule.findIndex(t => currentMagi <= t.cap);

        // Scenario: Hitting the ceiling of the tier below current
        if (irmaaIdx > 0) {
            const pPrev = solver(matrix.irmaaSchedule[irmaaIdx - 1].cap - 1, 'magi');
            if (pPrev >= 0) {
                const idx = irmaaIdx - 1;
                const isSelected = state.selectedStrategy.type === 'irmaa' && state.selectedStrategy.value === idx;
                scenarios.push({ 
                    ...createScenario(executeSystemTaxMath(wages, pPrev, ss, stcg, recapture, ltcg, status, isSenior), lexicon.stratPrevIrmaa, 'irmaa_prev', pPrev, baseline),
                    isSelected, stratMeta: { type: 'irmaa', value: idx }
                });
            }
        }

        // Scenario: Hitting the ceiling of the current tier (Stay below next cliff)
        if (irmaaIdx >= 0 && matrix.irmaaSchedule[irmaaIdx].cap !== Infinity) {
            const pCurr = solver(matrix.irmaaSchedule[irmaaIdx].cap - 1, 'magi');
            if (pCurr >= 0) {
                const isSelected = state.selectedStrategy.type === 'irmaa' && state.selectedStrategy.value === irmaaIdx;
                scenarios.push({ 
                    ...createScenario(executeSystemTaxMath(wages, pCurr, ss, stcg, recapture, ltcg, status, isSenior), lexicon.stratIrmaaSafe, 'irmaa_curr', pCurr, baseline),
                    isSelected, stratMeta: { type: 'irmaa', value: irmaaIdx } 
                });
            }
        }
    }

    // Deduplicate based on rounded pretax values and sort
    const uniqueScenarios = Array.from(new Map(scenarios.map(s => [Math.round(s.pretax), s])).values());
    const sorted = uniqueScenarios.sort((a,b) => a.pretax - b.pretax);
    if (silent) return sorted;
    return sorted;
}

function createScenario(res, label, id, pretax, baseline) {
    const currentPretax = parseInt(document.getElementById("inputPreTax").value);
    const taxDiff = res.compositeTaxMetric - baseline.compositeTaxMetric;
    const pretaxDiff = pretax - currentPretax;
    
    // Marginal rate over base = Delta Tax / Delta PreTax (High accuracy)
    const marginalVsBase = Math.abs(pretaxDiff) < 5 ? 0 : (taxDiff / pretaxDiff) * 100;

    return {
        id, label, pretax, marginalVsBase,
        totalTax: res.compositeTaxMetric,
        effRate: res.grossCalculated > 0 ? (res.compositeTaxMetric / res.grossCalculated) * 100 : 0,
        magi: res.agiCalculated,
        irmaaTier: res.irmaaTier
    };
}

// Initialize app: setup language, event listeners, and initial render
export function initializeApp() {
    const lexicon = LOCALE_ENGINE[currentLanguage];
    updateUILabels(lexicon);
    
    document.getElementById("langSelector").addEventListener("change", toggleSystemLanguage);
    document.getElementById("paramFiling").addEventListener("change", runPlannerEngine);
    document.getElementById("checkSenior").addEventListener("change", runPlannerEngine);
    document.getElementById("inputWages").addEventListener("input", runPlannerEngine);
    document.getElementById("inputPreTax").addEventListener("input", runPlannerEngine);
    document.getElementById("inputSS").addEventListener("input", runPlannerEngine);
    document.getElementById("inputSTCG").addEventListener("input", runPlannerEngine);
    document.getElementById("inputRecapture").addEventListener("input", runPlannerEngine);
    document.getElementById("inputLTCG").addEventListener("input", runPlannerEngine);
    
    document.getElementById("inputAge1")?.addEventListener("input", runPlannerEngine);
    document.getElementById("inputBal1")?.addEventListener("input", runPlannerEngine);
    document.getElementById("inputAge2")?.addEventListener("input", runPlannerEngine);
    document.getElementById("inputBal2")?.addEventListener("input", runPlannerEngine);
    document.getElementById("inputInflation")?.addEventListener("input", runPlannerEngine);
    document.getElementById("inputGrowth")?.addEventListener("input", runPlannerEngine);
    document.getElementById("inputAllocationMethod")?.addEventListener("change", runPlannerEngine);
    document.getElementById("inputFixedPct")?.addEventListener("input", runPlannerEngine);

    // Reset Button Logic
    document.getElementById("btnResetAll").addEventListener("click", () => {
        localStorage.removeItem("tax_analyzer_save");
        location.reload();
    });

    // Tooltip handling on canvas
    const canvasRef = document.getElementById("plannerCanvas");
    const tooltipRef = document.getElementById("plannerTooltip");

    canvasRef.addEventListener("mousemove", (e) => {
        const rect = canvasRef.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const paddingLeft = 55; 
        const paddingRight = 40;
        const scalePosition = (mouseX - paddingLeft) / (rect.width - paddingLeft - paddingRight);
        
        if (scalePosition >= 0 && scalePosition <= 1) {
            const targetedX = scalePosition * state.macroLimit;
            
            if (state.cachePlotData.length === 0) return;
            let closestPoint = state.cachePlotData.reduce((p, c) => 
                Math.abs(c.x - targetedX) < Math.abs(p.x - targetedX) ? c : p
            );

            let linesHtml = `<div class="tooltip-line"><strong>${lexicon.ttBaseOrd}</strong> <span style="color:#fff;">$${Math.round(closestPoint.x).toLocaleString()}</span></div><div class="tooltip-hr"></div>`;
            linesHtml += `<div class="tooltip-line" style="color:#22d3ee;"><span>${lexicon.ttBaseRate}</span> <strong>${closestPoint.ordMarginal.toFixed(1)}%</strong></div>`;
            // Reverted to show only one marginal rate, which is the nominal ordinary rate.
            // The spikeColor logic and ttTrueRate are removed.
            
            if (closestPoint.recapMarginal !== null) {
                linesHtml += `<div class="tooltip-line" style="color:#c084fc;"><span>Sec 1250 Recapture Marginal:</span> <strong>${closestPoint.recapMarginal.toFixed(1)}%</strong></div>`;
            }
            if (closestPoint.ltcgMarginal !== null) {
                linesHtml += `<div class="tooltip-line" style="color:#34d399;"><span>LTCG Marginal:</span> <strong>${closestPoint.ltcgMarginal.toFixed(1)}%</strong></div>`;
            }
            
            linesHtml += `<div class="tooltip-hr"></div>`;
            if (closestPoint.effectiveRate !== null) {
                linesHtml += `<div class="tooltip-line highlight"><strong>${lexicon.ttEffective}</strong> <span style="color:var(--accent-amber); font-weight:800; font-size:1.1rem;">${closestPoint.effectiveRate.toFixed(2)}%</span></div>`;
            } else {
                linesHtml += `<div class="tooltip-line highlight" style="color:var(--text-secondary); font-size:0.8rem; font-style:italic;">${lexicon.na}</div>`;
            }

            tooltipRef.style.display = "block";
            tooltipRef.style.left = (e.clientX - rect.left + 20) + "px";
            tooltipRef.style.top = (e.clientY - rect.top - 160) + "px";
            tooltipRef.innerHTML = linesHtml;
        } else { 
            tooltipRef.style.display = "none"; 
        }
    });

    canvasRef.addEventListener("mouseleave", () => { tooltipRef.style.display = "none"; });
    window.addEventListener('resize', () => runPlannerEngine());

    setupTabListeners();
    loadFromLocalStorage();

    // Chart Tab Listeners
    document.querySelectorAll('[data-chart-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.activeChartTab = btn.dataset.chartTab;
            document.querySelectorAll('[data-chart-tab]').forEach(b => {
                b.style.background = "#0f172a";
                b.classList.remove('active');
            });
            btn.style.background = "#1e293b";
            btn.classList.add('active');
            runPlannerEngine();
        });
    });

    // Handle Strategy Apply clicks via delegation
    const stratBody = document.getElementById("strategyComparisonBody");
    if (stratBody) {
        stratBody.addEventListener("click", (e) => {
            const btn = e.target.closest(".apply-strat-btn");
            if (btn) {
                document.getElementById("inputPreTax").value = btn.dataset.pretax;
                state.selectedStrategy = {
                    type: btn.dataset.stratType,
                    value: btn.dataset.stratVal !== "" ? parseInt(btn.dataset.stratVal) : null
                };
                runPlannerEngine();
            }
        });
    }

    // Initial render
    runPlannerEngine();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
