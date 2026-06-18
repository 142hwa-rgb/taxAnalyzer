import { SYSTEM_BRACKETS_2026 } from './config.js';
import { getOrdinaryBracketRate } from './taxMath.js';
import { state } from './chartRenderer.js';

// Update all UI label texts based on language
export function updateUILabels(lexicon) {
    document.getElementById("uiInputHeader").innerText = lexicon.inputHeader;
    document.getElementById("uiInputDesc").innerText = lexicon.inputDesc;
    document.getElementById("uiFilingLabel").innerText = lexicon.filingLabel;
    document.getElementById("uiSeniorLabel").innerText = lexicon.seniorLabel;
    document.getElementById("optSingle").innerText = lexicon.single;
    document.getElementById("optMFJ").innerText = lexicon.mfj;
    document.getElementById("uiWagesLabel").innerText = lexicon.wages;
    document.getElementById("uiPreTaxLabel").innerText = lexicon.pretax;
    document.getElementById("uiSSLabel").innerText = lexicon.ss;
    document.getElementById("uiSTCGLabel").innerText = lexicon.stcg;
    document.getElementById("uiRecaptureLabel").innerText = lexicon.recapture;
    document.getElementById("uiLTCGLabel").innerText = lexicon.ltcg;

    // Projection & Account Vector Labels
    const labelMappings = {
        "uiBalLabel": lexicon.balLabel,
        "uiAgeLabel": lexicon.ageLabel,
        "uiBalLabel2": lexicon.balLabel2,
        "uiAgeLabel2": lexicon.ageLabel2,
        "uiInflationLabel": lexicon.inflationLabel,
        "uiGrowthLabel": lexicon.growthLabel,
        "uiPretaxInputsHeader": lexicon.pretaxInputsHeader,
        "uiAllocationLabel": lexicon.allocationLabel,
        "uiProjectionStrategyLabelSettings": lexicon.projectionStrategyLabel,
        "optProportional": lexicon.optProportional,
        "optFixed": lexicon.optFixed,
        "uiFixedPctLabel": lexicon.fixedPctLabel
    };
    Object.entries(labelMappings).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    });

    // Update projection assumption tooltip
    const projectionIcon = document.getElementById("uiProjectionAssumptionIcon");
    if (projectionIcon) projectionIcon.title = lexicon.projectionAssumption;

    document.getElementById("uiMagiTile").innerText = lexicon.magiTile;
    document.getElementById("uiStrategyHeader").innerText = lexicon.strategyHeader;
    document.getElementById("btnResetAll").innerText = lexicon.btnReset;
    
    const stratTableHead = document.querySelector("#strategyComparisonTable thead tr");
    if (stratTableHead) {
        stratTableHead.innerHTML = `<th>${lexicon.thStrategy}</th><th>${lexicon.thPretax}</th><th>${lexicon.thTotalTax}</th><th>${lexicon.thEffRate}</th><th>${lexicon.thMarginalVsBase}</th><th>Details</th>`;
    }

    document.getElementById("uiMarginalTile").innerText = lexicon.marginalTile;
    document.getElementById("uiTotalTaxTile").innerText = lexicon.totalTaxTile;
    document.getElementById("uiPhaseoutHeader").innerText = lexicon.phaseoutHeader;
    document.getElementById("thParam").innerText = lexicon.thParam;
    document.getElementById("thValue").innerText = lexicon.thValue;
    document.getElementById("thThreshold").innerText = lexicon.thThreshold;
    document.getElementById("thStatus").innerText = lexicon.thStatus;
    document.getElementById("rowOBBBName").innerText = lexicon.obbbName;
    document.getElementById("rowSSName").innerText = lexicon.ssName;
    document.getElementById("rowNIITName").innerText = lexicon.niitName;
    document.getElementById("rowIrmaaName").innerText = lexicon.irmaaName;
}

// Update input labels with their current values
export function updateInputLabels(wages, pretax, ss, stcg, recapture, ltcg, bal1, bal2, inflation, growth, fixedPct) {
    const valMappings = {
        "lblWages": "$" + wages.toLocaleString(),
        "lblPreTax": "$" + pretax.toLocaleString(),
        "lblSS": "$" + ss.toLocaleString(),
        "lblSTCG": "$" + stcg.toLocaleString(),
        "lblRecapture": "$" + recapture.toLocaleString(),
        "lblLTCG": "$" + ltcg.toLocaleString(),
        "lblBal1": "$" + (bal1 || 0).toLocaleString(),
        "lblBal2": "$" + (bal2 || 0).toLocaleString(),
        "lblInflation": (inflation * 100).toFixed(1) + "%",
        "lblGrowth": (growth * 100).toFixed(1) + "%",
        "lblFixedPct": (fixedPct * 100).toFixed(0) + "%"
    };
    
    Object.entries(valMappings).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    });
}

// Update metric tiles with computed values
export function updateMetricTiles(baseline, status, isSenior, lexicon) {
    document.getElementById("outMAGI").innerText = "$" + Math.round(baseline.agiCalculated).toLocaleString();
    
    // Toggle visibility of spouse-specific inputs based on filing status
    const spouseGroup = document.getElementById("spouseInputGroup");
    if (spouseGroup) {
        spouseGroup.style.display = (status === "MFJ") ? "block" : "none";
    }

    // Toggle visibility of the Pretax Settings Tab button based on senior status
    const pretaxTabBtn = document.getElementById("btnTabPretaxSettings");
    if (pretaxTabBtn) {
        pretaxTabBtn.style.display = isSenior ? "block" : "none";
        pretaxTabBtn.innerText = lexicon.pretaxInputsHeader;
    }

    // Toggle visibility of MFJ-only allocation controls
    const allocGroup = document.getElementById("allocationGroup");
    if (allocGroup) {
        allocGroup.style.display = (status === "MFJ" && isSenior) ? "block" : "none";
    }

    const allocMethod = document.getElementById("inputAllocationMethod")?.value;
    const fixedPctGroup = document.getElementById("fixedPctGroup");
    if (fixedPctGroup) {
        fixedPctGroup.style.display = (allocMethod === "fixed" && status === "MFJ") ? "block" : "none";
    }

    // Toggle projection tab button and handle navigation fallback
    const projectionTab = document.getElementById("btnTabProjection");
    if (projectionTab) {
        projectionTab.style.display = isSenior ? "block" : "none";
        if (!isSenior && projectionTab.classList.contains('active')) {
            document.getElementById("btnTabPhaseout").click();
        }
    }
    
    let baselineOrdinaryRate = getOrdinaryBracketRate(baseline.taxableOrdinaryCalculated, SYSTEM_BRACKETS_2026[status]);
    document.getElementById("outMarginal").innerText = (baselineOrdinaryRate * 100).toFixed(1) + "%";
    
    document.getElementById("outTotalTax").innerText = "$" + Math.round(baseline.compositeTaxMetric).toLocaleString();
}

// Update OBBB row in the phaseout table
export function updateOBBBRow(baseline, status, isSenior, lexicon) {
    const obbbNode = document.getElementById("rowOBBBBadge");
    document.getElementById("rowOBBBValue").innerText = "$" + Math.round(baseline.obbbValue).toLocaleString();
    document.getElementById("rowOBBBThreshold").innerText = status === "Single" ? "$75K - $175K MAGI" : "$150K - $250K MAGI";
    if (!isSenior) {
        obbbNode.innerText = lexicon.inactive; 
        obbbNode.className = "badge neutral";
    } else if (baseline.obbbValue === 0) {
        obbbNode.innerText = lexicon.phasedOut; 
        obbbNode.className = "badge alert";
    } else {
        obbbNode.innerText = lexicon.active; 
        obbbNode.className = "badge neutral";
    }
}

// Update Social Security row in the phaseout table
export function updateSSRow(baseline, status, lexicon) {
    document.getElementById("rowSSValue").innerText = "$" + Math.round(baseline.taxableSS).toLocaleString() + " " + lexicon.taxable;
    document.getElementById("rowSSThreshold").innerText = status === "Single" ? "$25K / $34K Prov" : "$32K / $44K Prov";
}

// Update NIIT row in the phaseout table
export function updateNIITRow(baseline, lexicon) {
    const niitNode = document.getElementById("rowNIITBadge");
    document.getElementById("rowNIITValue").innerText = "$" + Math.round(baseline.niitCalculated).toLocaleString();
    if (baseline.niitCalculated > 0) {
        niitNode.innerText = lexicon.triggered; 
        niitNode.className = "badge alert";
    } else {
        niitNode.innerText = lexicon.inactive; 
        niitNode.className = "badge neutral";
    }
}

// Update IRMAA row in the phaseout table
export function updateIRMAARow(baseline, status, isSenior, lexicon) {
    const irmaaRow = document.getElementById("rowIrmaaContainer");
    if (isSenior) {
        irmaaRow.style.display = "table-row";
        const irmaaNode = document.getElementById("rowIrmaaBadge");
        document.getElementById("rowIrmaaValue").innerText = "$" + Math.round(baseline.irmaaAnnual).toLocaleString() + " /yr";
        document.getElementById("rowIrmaaThreshold").innerText = status === "Single" ? "Cliffs start $109K MAGI" : "Cliffs start $218K MAGI";
        if (baseline.irmaaAnnual > 0) {
            irmaaNode.innerText = lexicon.triggered + ` (${lexicon.irmaaLabelShort} ${baseline.irmaaTier})`;
            irmaaNode.className = "badge alert";
        } else {
            irmaaNode.innerText = lexicon.inactive;
            irmaaNode.className = "badge neutral";
        }
    } else {
        irmaaRow.style.display = "none";
    }
}

// Update chart header with income scale
export function updateChartHeader(macroLimit, lexicon) {
    document.getElementById("uiChartHeader").innerText = lexicon.chartHeader + ` ($0 → $${(macroLimit/1000).toLocaleString()}K)`;
}

/**
 * Renders a comparison table for different withdrawal strategies
 */
export function renderStrategyComparison(scenarios, lexicon, baselineIrmaaTier) {
    const container = document.getElementById("strategyComparisonBody");
    if (!container) return;

    let html = "";
    scenarios.forEach(s => {
        const isSelected = s.isSelected;
        const isCurrent = s.id === 'current';
        const highlightClass = isSelected ? "style='background: rgba(34, 211, 238, 0.15); border-left: 4px solid #22d3ee; font-weight: bold;'" : "";
        const marginalDisplay = isCurrent ? "—" : `${s.marginalVsBase.toFixed(1)}%`;
        const deltaPretax = s.pretax - (parseInt(document.getElementById("inputPreTax").value) || 0);
        const deltaLabel = deltaPretax >= 0 ? "+" : "";

        // Directional Heatmap Logic:
        // If deltaPretax < 0 (Reducing income): High marginal rate is an OPPORTUNITY (Green).
        // If deltaPretax > 0 (Increasing income): High marginal rate is a PENALTY (Amber).
        let marginalColor = "var(--text-secondary)";
        if (!isCurrent) {
            const isSaving = deltaPretax < 0;
            // A move is "Significant" if it costs/saves > 30% marginally OR changes the IRMAA tier
            const isSignificant = s.marginalVsBase > 30 || s.irmaaTier !== baselineIrmaaTier;

            if (isSignificant) {
                marginalColor = isSaving ? "#34d399" : "var(--accent-amber)";
            }
        }

        html += `
            <tr ${highlightClass}>
                <td class="text-secondary">${s.label}</td>
                <td><span class="text-accent">$${Math.round(s.pretax).toLocaleString()}</span> <small style="color:var(--text-secondary); opacity:0.7">${deltaLabel}$${Math.round(deltaPretax).toLocaleString()}</small></td>
                <td>$${Math.round(s.totalTax).toLocaleString()}</td>
                <td style="color: var(--text-secondary)">${s.effRate.toFixed(2)}%</td>
                <td style="color: ${marginalColor}; font-weight: bold;">${marginalDisplay}</td>
                <td class="text-secondary" style="font-size: 0.85rem; vertical-align: middle;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span>MAGI: $${Math.round(s.magi).toLocaleString()}<br>${lexicon.irmaaLabelShort} ${s.irmaaTier}</span>
                        <button class="apply-strat-btn" 
                            data-pretax="${Math.round(s.pretax)}" 
                            data-strat-type="${s.stratMeta?.type || 'nominal'}" 
                            data-strat-val="${s.stratMeta?.value ?? ''}"
                            style="background: ${isSelected ? '#94a3b8' : '#22d3ee'}; color: #0f172a; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.7rem;">${lexicon.btnApply}</button>
                    </div>
                </td>
            </tr>
        `;
    });
    container.innerHTML = html;
}

/**
 * Handles tab switching logic
 */
export function setupTabListeners() {
    const buttons = document.querySelectorAll('.tab-btn[data-tab]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            buttons.forEach(b => { 
                b.style.background = "#0f172a"; 
                b.classList.remove('active'); 
            });
            btn.style.background = "#1e293b";
            btn.classList.add('active');

            // Update panels
            document.querySelectorAll('.tab-content').forEach(p => p.style.display = 'none');
            document.getElementById(btn.dataset.tab).style.display = 'block';

            // Auto-switch chart tab when projection tab is selected
            if (btn.dataset.tab === 'projectionPanel') {
                document.getElementById('btnChartProj')?.click();
            }
        });
    });
}

/**
 * Renders the projection results into a summary table
 */
export function renderProjectionTable(results, lexicon, selectedStrategyLabel, isMFJ) {
    const container = document.getElementById("projectionTableBody");
    if (!container) return;

    const stratIndicator = document.getElementById("uiSelectedStrategyIndicator");
    if (stratIndicator) stratIndicator.innerText = selectedStrategyLabel;

    const stratIndicatorSettings = document.getElementById("uiSelectedStrategyIndicatorSettings");
    if (stratIndicatorSettings) stratIndicatorSettings.innerText = selectedStrategyLabel;

    // Update Table Headers
    const head = document.querySelector("#projectionTable thead tr");
    if (head) {
        const balanceCols = isMFJ ? `<th>S1 Bal</th><th>S2 Bal</th>` : `<th>${lexicon.thBalance}</th>`;
        const drawCols = isMFJ ? `<th>S1 Draw</th><th>S2 Draw</th>` : `<th>${lexicon.thWithdrawal}</th>`;
        const rmdCols = isMFJ ? `<th>S1 RMD</th><th>S2 RMD</th>` : `<th>${lexicon.thRmd}</th>`;
        head.innerHTML = `<th>${lexicon.thYear}</th>${balanceCols}${drawCols}${rmdCols}<th>${lexicon.thAnnualTax}</th>`;
    }

    let html = "";
    results.forEach(r => {
        const isDepleted = r.totalBalance <= 0 && r.withdrawal <= 0;
        const rowStyle = isDepleted ? "style='opacity: 0.5; font-style: italic;'" : "";
        
        const balanceData = isMFJ ? 
            `<td class="text-accent">$${Math.round(r.s1Balance).toLocaleString()}</td><td class="text-accent">$${Math.round(r.s2Balance).toLocaleString()}</td>` : 
            `<td class="text-accent">$${Math.round(r.totalBalance).toLocaleString()}</td>`;
        
        const drawData = isMFJ ? 
            `<td>$${Math.round(r.s1Draw).toLocaleString()}</td><td>$${Math.round(r.s2Draw).toLocaleString()}</td>` : 
            `<td>$${Math.round(r.withdrawal).toLocaleString()}</td>`;

        const rmdData = isMFJ ? 
            `<td style="color: var(--text-secondary)">$${Math.round(r.s1Rmd).toLocaleString()}</td><td style="color: var(--text-secondary)">$${Math.round(r.s2Rmd).toLocaleString()}</td>` : 
            `<td style="color: var(--text-secondary)">$${Math.round(r.rmd).toLocaleString()}</td>`;

        html += `
            <tr ${rowStyle}>
                <td>${r.year}</td>
                ${balanceData}
                ${drawData}
                ${rmdData}
                <td style="color: var(--accent-amber); font-weight: bold;">$${Math.round(r.tax).toLocaleString()}</td>
            </tr>
        `;
    });
    container.innerHTML = html;

    // Render Cumulative Tax Summary
    renderCumulativeSummary(results, lexicon);
}

/**
 * Calculates and renders cumulative tax totals for 10, 20, and 30 years
 */
function renderCumulativeSummary(results, lexicon) {
    const summaryContainer = document.getElementById("projectionSummary");
    if (!summaryContainer) return;

    const calcTotal = (numYears) => {
        let nominal = 0;
        let real = 0;
        const currentSlice = results.slice(0, numYears);
        currentSlice.forEach((r, idx) => {
            const inflationFactor = Math.pow(1 + state.inflationRate, idx);
            nominal += r.tax;
            real += r.tax / inflationFactor;
        });

        const lastInPeriod = currentSlice[currentSlice.length - 1];
        const balanceNominal = lastInPeriod ? lastInPeriod.totalBalance : 0;
        const balanceReal = lastInPeriod ? (lastInPeriod.totalBalance / Math.pow(1 + state.inflationRate, currentSlice.length - 1)) : 0;

        return { nominal, real, balanceReal, balanceNominal };
    };

    const periods = [
        { label: lexicon.after10Y, data: calcTotal(10) },
        { label: lexicon.after20Y, data: calcTotal(20) },
        { label: lexicon.after30Y, data: calcTotal(30) }
    ];

    summaryContainer.innerHTML = periods.map(p => `
        <div class="metric-tile" style="background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border); padding: 12px;">
            <div class="metric-title" style="color: var(--accent-cyan); font-weight: bold; border-bottom: 1px solid var(--border); margin-bottom: 8px; padding-bottom: 4px;">
                ${p.label}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${lexicon.totalTaxNominal}</div>
            <div style="font-size: 1.1rem; color: #fff; margin-bottom: 8px;">$${Math.round(p.data.nominal).toLocaleString()}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${lexicon.totalTaxReal}</div>
            <div style="font-size: 1.1rem; color: var(--accent-amber); margin-bottom: 8px;">$${Math.round(p.data.real).toLocaleString()}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${lexicon.totalBalanceNominal}</div>
            <div style="font-size: 1.1rem; color: #fff; margin-bottom: 8px;">$${Math.round(p.data.balanceNominal).toLocaleString()}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">${lexicon.totalBalanceReal}</div>
            <div style="font-size: 1.1rem; color: var(--accent-cyan);">$${Math.round(p.data.balanceReal).toLocaleString()}</div>
        </div>
    `).join('');
}
