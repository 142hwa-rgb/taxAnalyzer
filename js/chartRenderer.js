import { SYSTEM_BRACKETS_2026, PROJECTION_DEFAULTS } from './config.js';
import { getOrdinaryBracketRate, getLtcgBracketRate, executeSystemTaxMath } from './taxMath.js';

// State object for mutable values
export const state = {
    cachePlotData: [],
    macroLimit: 1000000,
    boundaryOrd: 0,
    boundaryRecap: 0,
    boundaryTotal: 0,
    pretaxAccounts: [], // Vector for senior account balances and ages
    inflationRate: PROJECTION_DEFAULTS.inflation,
    growthRate: PROJECTION_DEFAULTS.growth,
    projectionResults: [], // Stores multi-year data
    selectedStrategy: {
        type: 'nominal', // 'nominal', 'bracket', or 'irmaa'
        value: null      // index of bracket or tier
    },
    activeChartTab: 'system' // 'system' or 'projection'
};

// Generate integrated matrix for chart plotting
export function generateIntegratedMatrix(status, wVal, pVal, sVal, stVal, rVal, lVal, isSenior) {
    state.cachePlotData = [];
    let steps = 400;
    let stepSize = state.macroLimit / steps;

    let ratioW = wVal / (state.boundaryOrd || 1);
    let ratioP = pVal / (state.boundaryOrd || 1);
    let ratioST = stVal / (state.boundaryOrd || 1);
    if (state.boundaryOrd === 0) ratioW = 1.0;

    const matrix = SYSTEM_BRACKETS_2026[status];

    for (let i = 0; i <= steps; i++) {
        let currentX = i * stepSize;
        
        let simW_ord = currentX * ratioW;
        let simP_ord = currentX * ratioP;
        let simST_ord = currentX * ratioST;

        // Calculate nominal rate with fallback if taxableOrdinaryCalculated is missing
        let baseOrdOnly = executeSystemTaxMath(simW_ord, simP_ord, sVal, simST_ord, 0, 0, status, isSenior);
        let taxableIncome = baseOrdOnly.taxableOrdinaryCalculated ?? Math.max(0, baseOrdOnly.agiCalculated - matrix.stdDeductionBase);
        let ordMarginalRate = (getOrdinaryBracketRate(taxableIncome, matrix) || 0) * 100;
        
        // Keep original logic for recap/ltcg for segmented visualization but consider similar "True" logic

        let recapMarginalRate = null;
        if (currentX >= state.boundaryOrd && currentX <= state.boundaryRecap && rVal > 0) {
            let simR = currentX - state.boundaryOrd;
            let baseRecap = executeSystemTaxMath(wVal, pVal, sVal, stVal, simR, 0, status, isSenior);
            let taxableRecap = baseRecap.taxableOrdinaryCalculated ?? Math.max(0, baseRecap.agiCalculated - matrix.stdDeductionBase);
            let ordRate = getOrdinaryBracketRate(taxableRecap, matrix) || 0;
            let niitSurcharge = (baseRecap.agiCalculated > matrix.niitLimit) ? 3.8 : 0;
            recapMarginalRate = (Math.min(ordRate, 0.25) * 100) + niitSurcharge;
        }

        let ltcgMarginalRate = null;
        if (currentX >= state.boundaryRecap && currentX <= state.boundaryTotal && lVal > 0) {
            let simL = currentX - state.boundaryRecap;
            let baseLtcg = executeSystemTaxMath(wVal, pVal, sVal, stVal, rVal, simL, status, isSenior);
            let niitSurcharge = (baseLtcg.agiCalculated > matrix.niitLimit) ? 3.8 : 0;
            let taxableTotal = baseLtcg.taxableCalculated ?? Math.max(0, baseLtcg.agiCalculated - matrix.stdDeductionBase);
            ltcgMarginalRate = ((getLtcgBracketRate(taxableTotal, matrix) || 0) * 100) + niitSurcharge;
        }

        let cumulativeEffRate = null;
        if (currentX <= state.boundaryTotal) {
            let simW = 0, simP = 0, simST = 0, simR = 0, simL = 0;
            if (currentX <= state.boundaryOrd) {
                simW = currentX * ratioW; simP = currentX * ratioP; simST = currentX * ratioST;
            } else if (currentX <= state.boundaryRecap) {
                simW = wVal; simP = pVal; simST = stVal; simR = currentX - state.boundaryOrd;
            } else {
                simW = wVal; simP = pVal; simST = stVal; simR = rVal; simL = currentX - state.boundaryRecap;
            }
            let baseEff = executeSystemTaxMath(simW, simP, sVal, simST, simR, simL, status, isSenior);
            cumulativeEffRate = baseEff.grossCalculated > 0 ? (baseEff.compositeTaxMetric / baseEff.grossCalculated) * 100 : 0;
        }

        state.cachePlotData.push({
            x: currentX,
            ordMarginal: ordMarginalRate, // This now represents the nominal bracket rate
            recapMarginal: recapMarginalRate,
            ltcgMarginal: ltcgMarginalRate,
            effectiveRate: cumulativeEffRate
        });
    }
}

// Draw the main planner chart on canvas
export function drawPlannerChart(status, isSenior, lexicon) {
    const canvas = document.getElementById("plannerCanvas");
    const ctx = canvas.getContext("2d");
    
    const scaleFactor = window.devicePixelRatio || 1;
    const clientRect = canvas.getBoundingClientRect();
    canvas.width = clientRect.width * scaleFactor;
    canvas.height = clientRect.height * scaleFactor;
    ctx.scale(scaleFactor, scaleFactor);
    
    const w = clientRect.width;
    const h = clientRect.height;
    const padding = { top: 45, right: 40, bottom: 45, left: 55 };
    const maxPlotY = 50;

    ctx.clearRect(0, 0, w, h);

    function findCanvasX(val) { return padding.left + (val / state.macroLimit) * (w - padding.left - padding.right); }
    function findCanvasY(val) { return h - padding.bottom - (Math.max(0, Math.min(val, maxPlotY)) / maxPlotY) * (h - padding.top - padding.bottom); }

    // Draw grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";

    let stepInterval = state.macroLimit / 10;
    ctx.textAlign = "center";
    for (let xCoord = 0; xCoord <= state.macroLimit; xCoord += stepInterval) {
        ctx.fillText((xCoord / 1000) + "K", findCanvasX(xCoord), h - padding.bottom + 20);
        ctx.beginPath(); ctx.moveTo(findCanvasX(xCoord), padding.top); ctx.lineTo(findCanvasX(xCoord), h - padding.bottom); ctx.stroke();
    }

    ctx.textAlign = "right";
    for (let yCoord = 0; yCoord <= 50; yCoord += 10) {
        ctx.fillText(yCoord + "%", padding.left - 10, findCanvasY(yCoord) + 3);
        ctx.beginPath(); ctx.moveTo(padding.left, findCanvasY(yCoord)); ctx.lineTo(w - padding.right, findCanvasY(yCoord)); ctx.stroke();
    }

    // Draw IRMAA cliff lines
    if (isSenior) {
        const matrix = SYSTEM_BRACKETS_2026[status];
        let sVal = parseInt(document.getElementById("inputSS").value);
        let provIncomeEstimate = state.boundaryOrd + (sVal * 0.5);
        let taxableSSEstimate = 0;
        if (provIncomeEstimate > (status === "Single" ? 34000 : 44000)) taxableSSEstimate = sVal * 0.85;
        
        for (let idx = 0; idx < matrix.irmaaSchedule.length - 1; idx++) {
            let cliffBracketMAGI = matrix.irmaaSchedule[idx].cap;
            let dynamicXAnchor = cliffBracketMAGI - taxableSSEstimate; 
            
            if (dynamicXAnchor > 0 && dynamicXAnchor <= state.macroLimit) {
                let irmaaX = findCanvasX(dynamicXAnchor);
                ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
                ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(irmaaX, padding.top + 10); ctx.lineTo(irmaaX, h - padding.bottom); ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    // Draw legend
    ctx.textAlign = "left";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#22d3ee"; ctx.fillText(lexicon.legOrd, padding.left + 5, padding.top - 20); // Reverted to original legend text
    ctx.fillStyle = "#c084fc"; ctx.fillText(lexicon.legRecap, padding.left + 195, padding.top - 20); // Reverted to original legend text
    ctx.fillStyle = "#34d399"; ctx.fillText(lexicon.legLtcg, padding.left + 415, padding.top - 20);
    ctx.fillStyle = "#fbbf24"; ctx.fillText(lexicon.legEffective, padding.left + 615, padding.top - 20);

    // Draw ordinary marginal line
    ctx.beginPath();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    for (let k = 0; k < state.cachePlotData.length - 1; k++) {
        let pt1 = state.cachePlotData[k];
        let pt2 = state.cachePlotData[k+1];
        ctx.moveTo(findCanvasX(pt1.x), findCanvasY(pt1.ordMarginal));
        ctx.lineTo(findCanvasX(pt2.x), findCanvasY(pt2.ordMarginal));
    }
    ctx.stroke();

    // Draw recapture marginal line
    ctx.beginPath();
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 3;
    let insideRecap = false;
    for (let k = 0; k < state.cachePlotData.length; k++) {
        let pt = state.cachePlotData[k];
        if (pt.recapMarginal !== null) {
            if (!insideRecap) {
                ctx.moveTo(findCanvasX(pt.x), findCanvasY(pt.recapMarginal));
                insideRecap = true;
            } else {
                ctx.lineTo(findCanvasX(pt.x), findCanvasY(pt.recapMarginal));
            }
        }
    }
    ctx.stroke();

    // Draw LTCG marginal line
    ctx.beginPath();
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 3;
    let insideLtcg = false;
    for (let k = 0; k < state.cachePlotData.length; k++) {
        let pt = state.cachePlotData[k];
        if (pt.ltcgMarginal !== null) {
            if (!insideLtcg) {
                ctx.moveTo(findCanvasX(pt.x), findCanvasY(pt.ltcgMarginal));
                insideLtcg = true;
            } else {
                ctx.lineTo(findCanvasX(pt.x), findCanvasY(pt.ltcgMarginal));
            }
        }
    }
    ctx.stroke();

    // Draw effective rate line
    ctx.beginPath();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3.5;
    let firstEff = true;
    for (let k = 0; k < state.cachePlotData.length; k++) {
        let pt = state.cachePlotData[k];
        if (pt.effectiveRate !== null) {
            if (firstEff) {
                ctx.moveTo(findCanvasX(pt.x), findCanvasY(pt.effectiveRate));
                firstEff = false;
            } else {
                ctx.lineTo(findCanvasX(pt.x), findCanvasY(pt.effectiveRate));
            }
        }
    }
    ctx.stroke();

    // Draw cursors at boundaries
    let yAtOrd = null, yAtRecap = null, yAtTotal = null;
    state.cachePlotData.forEach(pt => {
        if (pt.x <= state.boundaryOrd) yAtOrd = pt.effectiveRate;
        if (pt.x <= state.boundaryRecap) yAtRecap = pt.effectiveRate;
        if (pt.x <= state.boundaryTotal) yAtTotal = pt.effectiveRate;
    });

    if (state.boundaryOrd > 0 && state.boundaryOrd <= state.macroLimit) {
        drawVerticalCursor(ctx, findCanvasX(state.boundaryOrd), padding.top, h - padding.bottom, "#22d3ee", lexicon.cursorOrd);
        if (yAtOrd !== null) drawCircularJunction(ctx, findCanvasX(state.boundaryOrd), findCanvasY(yAtOrd), "#22d3ee");
    }
    if (state.boundaryRecap > state.boundaryOrd && state.boundaryRecap <= state.macroLimit) {
        drawVerticalCursor(ctx, findCanvasX(state.boundaryRecap), padding.top, h - padding.bottom, "#c084fc", lexicon.cursorRecap);
        if (yAtRecap !== null) drawCircularJunction(ctx, findCanvasX(state.boundaryRecap), findCanvasY(yAtRecap), "#c084fc");
    }
    if (state.boundaryTotal > state.boundaryRecap && state.boundaryTotal <= state.macroLimit) {
        drawVerticalCursor(ctx, findCanvasX(state.boundaryTotal), padding.top, h - padding.bottom, "#34d399", lexicon.cursorTotal);
        if (yAtTotal !== null) drawCircularJunction(ctx, findCanvasX(state.boundaryTotal), findCanvasY(yAtTotal), "#34d399");
    }
}

function drawVerticalCursor(ctx, xPos, topY, bottomY, hexColor, label) {
    ctx.setLineDash([3, 3]); 
    ctx.strokeStyle = hexColor; 
    ctx.lineWidth = 1.5;
    ctx.beginPath(); 
    ctx.moveTo(xPos, topY); 
    ctx.lineTo(xPos, bottomY); 
    ctx.stroke(); 
    ctx.setLineDash([]);
    ctx.fillStyle = hexColor; 
    ctx.font = "9px sans-serif"; 
    ctx.textBaseline = "bottom"; 
    ctx.textAlign = "center";
    ctx.fillText(label, xPos, topY - 4); 
    ctx.textBaseline = "alphabetic";
}

function drawCircularJunction(ctx, xPos, yPos, hexColor) {
    ctx.beginPath(); 
    ctx.arc(xPos, yPos, 6, 0, 2 * Math.PI); 
    ctx.fillStyle = hexColor; 
    ctx.fill();
    ctx.lineWidth = 2; 
    ctx.strokeStyle = "#0b0f19"; 
    ctx.stroke();
}

/**
 * Draws the multi-year balance projection chart
 */
export function drawProjectionChart(lexicon, isMFJ) {
    const canvas = document.getElementById("plannerCanvas");
    const ctx = canvas.getContext("2d");
    const results = state.projectionResults;
    if (!results || results.length === 0) return;

    const scaleFactor = window.devicePixelRatio || 1;
    const clientRect = canvas.getBoundingClientRect();
    canvas.width = clientRect.width * scaleFactor;
    canvas.height = clientRect.height * scaleFactor;
    ctx.scale(scaleFactor, scaleFactor);
    
    const w = clientRect.width;
    const h = clientRect.height;
    const padding = { top: 40, right: 60, bottom: 40, left: 65 };

    ctx.clearRect(0, 0, w, h);

    // Calculate scales
    const maxBal = Math.max(...results.map(r => r.totalBalance), 100000);
    const maxFlow = Math.max(...results.map(r => Math.max(r.withdrawal, r.tax, r.rmd)), 10000);

    const getX = (idx) => padding.left + (idx / (results.length - 1 || 1)) * (w - padding.left - padding.right);
    const getYBal = (val) => h - padding.bottom - (val / maxBal) * (h - padding.top - padding.bottom);
    const getYFlow = (val) => h - padding.bottom - (val / maxFlow) * (h - padding.top - padding.bottom);

    // Draw Grid & Axes
    ctx.strokeStyle = "#1e293b";
    ctx.fillStyle = "#64748b";
    ctx.font = "10px monospace";
    
    // X-axis (Years)
    results.forEach((r, i) => {
        if (i % 5 === 0 || i === results.length - 1) {
            ctx.fillText(r.year, getX(i) - 10, h - padding.bottom + 15);
            ctx.beginPath(); ctx.moveTo(getX(i), padding.top); ctx.lineTo(getX(i), h - padding.bottom); ctx.stroke();
        }
    });

    // Y-axis Left (Balance)
    ctx.textAlign = "right";
    [0, 0.5, 1].forEach(p => {
        const val = maxBal * p;
        ctx.fillStyle = "#22d3ee";
        ctx.fillText("$" + (val/1000).toFixed(0) + "K", padding.left - 8, getYBal(val) + 3);
    });

    // Y-axis Right (Flows)
    ctx.textAlign = "left";
    [0, 0.5, 1].forEach(p => {
        const val = maxFlow * p;
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("$" + (val/1000).toFixed(0) + "K", w - padding.right + 8, getYFlow(val) + 3);
    });

    if (isMFJ) {
        // Individual Balances
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.strokeStyle = "#22d3ee";
        results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYBal(r.s1Balance)) : ctx.lineTo(getX(i), getYBal(r.s1Balance)));
        ctx.stroke();
        ctx.beginPath(); ctx.strokeStyle = "#34d399";
        results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYBal(r.s2Balance)) : ctx.lineTo(getX(i), getYBal(r.s2Balance)));
        ctx.stroke();

        // Individual Draws
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.strokeStyle = "#c084fc";
        results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYFlow(r.s1Draw)) : ctx.lineTo(getX(i), getYFlow(r.s1Draw)));
        ctx.stroke();
        ctx.beginPath(); ctx.strokeStyle = "#94a3b8";
        results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYFlow(r.s2Draw)) : ctx.lineTo(getX(i), getYFlow(r.s2Draw)));
        ctx.stroke();
        ctx.setLineDash([]);

        // Individual RMDs (dots)
        results.forEach((r, i) => {
            ctx.fillStyle = "#c084fc"; ctx.beginPath(); ctx.arc(getX(i), getYFlow(r.s1Rmd), 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.arc(getX(i), getYFlow(r.s2Rmd), 2, 0, Math.PI * 2); ctx.fill();
        });
    } else {
        // Draw Balance Line (Area)
        ctx.beginPath();
        ctx.fillStyle = "rgba(34, 211, 238, 0.1)";
        ctx.moveTo(getX(0), getYBal(0));
        results.forEach((r, i) => ctx.lineTo(getX(i), getYBal(r.totalBalance)));
        ctx.lineTo(getX(results.length - 1), getYBal(0));
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYBal(r.totalBalance)) : ctx.lineTo(getX(i), getYBal(r.totalBalance)));
        ctx.stroke();

        // Draw Withdrawal Line
        ctx.beginPath();
        ctx.strokeStyle = "#94a3b8";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYFlow(r.withdrawal)) : ctx.lineTo(getX(i), getYFlow(r.withdrawal)));
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw Tax Line
    ctx.beginPath();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    results.forEach((r, i) => i === 0 ? ctx.moveTo(getX(i), getYFlow(r.tax)) : ctx.lineTo(getX(i), getYFlow(r.tax)));
    ctx.stroke();

    // Legend
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    if (isMFJ) {
        ctx.fillStyle = "#22d3ee"; ctx.fillText("■ S1 Bal", padding.left, padding.top - 15);
        ctx.fillStyle = "#34d399"; ctx.fillText("■ S2 Bal", padding.left + 65, padding.top - 15);
        ctx.fillStyle = "#c084fc"; ctx.fillText("- - S1 Draw", padding.left + 130, padding.top - 15);
        ctx.fillStyle = "#94a3b8"; ctx.fillText("- - S2 Draw", padding.left + 210, padding.top - 15);
        ctx.fillStyle = "#fbbf24"; ctx.fillText("■ Tax", padding.left + 290, padding.top - 15);
        ctx.fillStyle = "#c084fc"; ctx.fillText("• S1 RMD", padding.left + 335, padding.top - 15);
        ctx.fillStyle = "#94a3b8"; ctx.fillText("• S2 RMD", padding.left + 400, padding.top - 15);
    } else {
        ctx.fillStyle = "#22d3ee"; ctx.fillText("■ Total Balance", padding.left, padding.top - 15);
        ctx.fillStyle = "#94a3b8"; ctx.fillText("- - Withdrawal", padding.left + 110, padding.top - 15);
        ctx.fillStyle = "#fbbf24"; ctx.fillText("■ Annual Tax", padding.left + 210, padding.top - 15);
    }
}
