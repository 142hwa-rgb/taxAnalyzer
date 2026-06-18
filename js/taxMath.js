import { SYSTEM_BRACKETS_2026, RMD_DIST_FACTORS, PROJECTION_DEFAULTS } from './config.js';

// Calculate the ordinary income bracket rate for a given taxable ordinary income
export function getOrdinaryBracketRate(taxableOrdinary, matrix) {
    if (taxableOrdinary <= 0) {
        return 0.0;
    }
    let priorCap = 0;
    for (let tier of matrix.ordSchedule) {
        if (taxableOrdinary > priorCap && taxableOrdinary <= tier.cap) {
            return tier.rate;
        }
        priorCap = tier.cap;
    }
    return 0.37;
}

// Calculate the LTCG bracket rate for a given total taxable income
export function getLtcgBracketRate(totalTaxable, matrix) {
    if (totalTaxable <= 0) {
        return 0.0;
    }
    let priorCap = 0;
    for (let tier of matrix.ltcgSchedule) {
        if (totalTaxable > priorCap && totalTaxable <= tier.cap) {
            return tier.rate;
        }
        priorCap = tier.cap;
    }
    return 0.20;
}

// Calculate Required Minimum Distribution (RMD)
export function calculateRMD(age, balance) {
    if (age < PROJECTION_DEFAULTS.rmdStartAge) return 0;
    const factor = RMD_DIST_FACTORS[age] || RMD_DIST_FACTORS[120];
    return balance / factor;
}

/**
 * Internal solver for projection years to find pretax needed for a target
 */
function solveForProjectionYear(wages, ss, stcg, recapture, ltcg, status, isSenior, inflationFactor, targetVal, type) {
    const matrix = scaleMatrix(SYSTEM_BRACKETS_2026[status], inflationFactor);
    let low = 0, high = 2000000, bestP = 0;
    for(let i=0; i<20; i++) {
        let mid = (low + high) / 2;
        let test = executeSystemTaxMath(wages, mid, ss, stcg, recapture, ltcg, status, isSenior, inflationFactor);
        let val = (type === 'taxable') ? test.taxableOrdinaryCalculated : test.agiCalculated;
        if (val < targetVal) { low = mid; bestP = mid; }
        else high = mid;
    }
    return bestP;
}

/**
 * Projects balances and taxes over a 30-year horizon
 */
export function calculateMultiYearProjection(inputs, params, initialState) {
    const years = 30;
    const results = [];
    
    // Deep copy current account state for simulation
    let currentAccounts = JSON.parse(JSON.stringify(initialState.pretaxAccounts));
    
    for (let t = 0; t < years; t++) {
        const inflationFactor = Math.pow(1 + params.inflationRate, t);
        const matrix = scaleMatrix(SYSTEM_BRACKETS_2026[inputs.status], inflationFactor);
        
        // 1. Calculate individual RMDs and potential funds available after growth
        const rmds = currentAccounts.map(acc => calculateRMD(acc.age, acc.balance));
        const totalRMD = rmds.reduce((sum, val) => sum + val, 0);
        const availableFunds = currentAccounts.map(acc => acc.balance * (1 + params.growthRate));
        const totalBalBeforeWithdrawal = currentAccounts.reduce((sum, a) => sum + a.balance, 0);

        // 2. Determine Strategy Withdrawal Amount
        let strategyWithdrawal = 0;
        const strat = params.strategy;

        if (strat.type === 'bracket' && strat.value !== null) {
            const target = matrix.ordSchedule[strat.value].cap - 0.01;
            strategyWithdrawal = solveForProjectionYear(inputs.wages * inflationFactor, inputs.ss * inflationFactor, inputs.stcg * inflationFactor, inputs.recapture * inflationFactor, inputs.ltcg * inflationFactor, inputs.status, true, inflationFactor, target, 'taxable');
        } else if (strat.type === 'irmaa' && strat.value !== null) {
            const target = matrix.irmaaSchedule[strat.value].cap - 1;
            strategyWithdrawal = solveForProjectionYear(inputs.wages * inflationFactor, inputs.ss * inflationFactor, inputs.stcg * inflationFactor, inputs.recapture * inflationFactor, inputs.ltcg * inflationFactor, inputs.status, true, inflationFactor, target, 'magi');
        } else {
            // Default/Nominal strategy
            strategyWithdrawal = inputs.pretax * inflationFactor;
        }

        const intendedWithdrawal = Math.max(strategyWithdrawal, totalRMD);

        // 3. Allocate and CAP by available balance
        const excessIntended = Math.max(0, intendedWithdrawal - totalRMD);
        const individualWithdrawals = [];

        if (currentAccounts.length === 1) {
            // Single account: cap by what's actually there
            individualWithdrawals.push(Math.min(intendedWithdrawal, availableFunds[0]));
        } else {
            if (totalBalBeforeWithdrawal > 0) {
                let s1Weight = (params.allocationMethod === 'proportional') 
                    ? (currentAccounts[0].balance / totalBalBeforeWithdrawal)
                    : params.fixedPct;
                
                // Calculate intended draws
                let s1Request = rmds[0] + (excessIntended * s1Weight);
                let s2Request = rmds[1] + (excessIntended * (1 - s1Weight));
                
                // Cap individual draws by available funds
                individualWithdrawals.push(Math.min(s1Request, availableFunds[0]));
                individualWithdrawals.push(Math.min(s2Request, availableFunds[1]));
            } else {
                individualWithdrawals.push(0, 0);
            }
        }

        const actualTotalWithdrawal = individualWithdrawals.reduce((s, v) => s + v, 0);

        // 4. Determine if individuals are seniors in this projected year
        const isSeniorProjected = currentAccounts.some(acc => acc.age >= 65);

        // 5. Calculate year-specific tax with indexed boundaries using ACTUAL withdrawal
        const yearResult = executeSystemTaxMath(
            inputs.wages * inflationFactor,
            actualTotalWithdrawal,
            inputs.ss * inflationFactor,
            inputs.stcg * inflationFactor,
            inputs.recapture * inflationFactor,
            inputs.ltcg * inflationFactor,
            inputs.status,
            isSeniorProjected,
            inflationFactor
        );

        results.push({
            year: 2026 + t,
            totalBalance: totalBalBeforeWithdrawal,
            s1Balance: currentAccounts[0].balance,
            s2Balance: currentAccounts[1]?.balance || 0,
            withdrawal: actualTotalWithdrawal,
            s1Draw: individualWithdrawals[0] || 0,
            s2Draw: individualWithdrawals[1] || 0,
            rmd: totalRMD,
            s1Rmd: rmds[0] || 0,
            s2Rmd: rmds[1] || 0,
            tax: yearResult.compositeTaxMetric
        });

        // 7. Update balances for next year
        currentAccounts.forEach((acc, idx) => {
            const withdrawn = individualWithdrawals[idx] || 0;
            acc.balance = Math.max(0, (acc.balance * (1 + params.growthRate)) - withdrawn);
            acc.age += 1;
        });
    }
    return results;
}

// Core tax calculation engine
export function executeSystemTaxMath(wages, pretax, ss, stcg, recapture, ltcg, status, isSenior, inflationScale = 1.0) {
    // Apply inflation scaling to tax boundaries and brackets
    const matrix = scaleMatrix(SYSTEM_BRACKETS_2026[status], inflationScale);
    
    let ordinaryBaseGross = wages + pretax + stcg;
    let provIncome = ordinaryBaseGross + (ss * 0.5);
    
    // Social Security taxability calculation
    let taxableSS = 0;
    let ssFloor = status === "Single" ? 25000 : 32000;
    let ssCeiling = status === "Single" ? 34000 : 44000;
    if (provIncome > ssCeiling) {
        taxableSS = Math.min(0.85 * ss, (provIncome - ssCeiling) * 0.85 + Math.min(4500, (ssCeiling - ssFloor) * 0.5));
    } else if (provIncome > ssFloor) {
        taxableSS = Math.min(0.50 * ss, (provIncome - ssFloor) * 0.5);
    }
    
    let ordinaryAGI = ordinaryBaseGross + taxableSS;
    let totalAGI = ordinaryAGI + recapture + ltcg;
    
    // OBBB calculation (senior bonus deduction)
    let finalObbbDeductionValue = 0;
    if (isSenior) {
        if (totalAGI <= matrix.obbbPhaseStart) {
            finalObbbDeductionValue = matrix.obbbMaxBonus;
        } else if (totalAGI < matrix.obbbPhaseEnd) {
            let overage = totalAGI - matrix.obbbPhaseStart;
            let reduction = overage * 0.12; 
            finalObbbDeductionValue = Math.max(0, matrix.obbbMaxBonus - reduction);
        } else {
            finalObbbDeductionValue = 0;
        }
    }

    let totalDeductions = matrix.stdDeductionBase;
    if (isSenior) {
        totalDeductions += (status === "MFJ" ? matrix.seniorStandardBump * 2 : matrix.seniorStandardBump);
        totalDeductions += finalObbbDeductionValue;
    }
    
    let netTaxableOrdinary = Math.max(0, ordinaryAGI - totalDeductions);
    let netTotalTaxable = Math.max(0, totalAGI - totalDeductions);
    
    // Calculate income floor/ceiling boundaries for each income type
    let ordinaryFloor = 0;
    let ordinaryCeiling = netTaxableOrdinary;
    let recaptureFloor = ordinaryCeiling;
    let recaptureCeiling = Math.max(recaptureFloor, netTotalTaxable - ltcg);
    let ltcgFloor = recaptureCeiling;
    let ltcgCeiling = netTotalTaxable;

    // Tax calculation for ordinary income
    let ordinaryTaxSum = 0;
    let priorCap = 0;
    for (let tier of matrix.ordSchedule) {
        let intersectionMin = Math.max(ordinaryFloor, priorCap);
        let intersectionMax = Math.min(ordinaryCeiling, tier.cap);
        if (intersectionMax > intersectionMin) {
            ordinaryTaxSum += (intersectionMax - intersectionMin) * tier.rate;
        }
        priorCap = tier.cap;
    }
    
    // Tax calculation for Sec 1250 recapture
    let recaptureTaxSum = 0;
    priorCap = 0;
    for (let tier of matrix.ordSchedule) {
        let intersectionMin = Math.max(recaptureFloor, priorCap);
        let intersectionMax = Math.min(recaptureCeiling, tier.cap);
        if (intersectionMax > intersectionMin) {
            recaptureTaxSum += (intersectionMax - intersectionMin) * Math.min(tier.rate, 0.25);
        }
        priorCap = tier.cap;
    }
    
    // Tax calculation for LTCG
    let ltcgTaxSum = 0;
    priorCap = 0;
    for (let tier of matrix.ltcgSchedule) {
        let intersectionMin = Math.max(ltcgFloor, priorCap);
        let intersectionMax = Math.min(ltcgCeiling, tier.cap);
        if (intersectionMax > intersectionMin) {
            ltcgTaxSum += (intersectionMax - intersectionMin) * tier.rate;
        }
        priorCap = tier.cap;
    }
    
    // Net Investment Income Tax (NIIT) calculation
    let niitSum = 0;
    if (totalAGI > matrix.niitLimit) {
        niitSum = Math.min(totalAGI - matrix.niitLimit, ltcg + stcg + recapture) * 0.038;
    }
    
    // IRMAA calculation
    let monthlyIrmaaFee = 0;
    let activeIrmaaTier = 0;
    if (isSenior) {
        for (let i = 0; i < matrix.irmaaSchedule.length; i++) {
            const tier = matrix.irmaaSchedule[i];
            if (totalAGI <= tier.cap) {
                monthlyIrmaaFee = tier.fee;
                activeIrmaaTier = i + 1;
                break;
            }
        }
    }
    let annualIrmaaImpact = monthlyIrmaaFee * 12;

    return {
        grossCalculated: ordinaryBaseGross + ss + recapture + ltcg,
        agiCalculated: totalAGI,
        taxableCalculated: netTotalTaxable,
        taxableOrdinaryCalculated: netTaxableOrdinary,
        taxableSS: taxableSS,
        obbbValue: finalObbbDeductionValue,
        niitCalculated: niitSum,
        irmaaMonthly: monthlyIrmaaFee,
        irmaaAnnual: annualIrmaaImpact,
        irmaaTier: activeIrmaaTier,
        compositeTaxMetric: ordinaryTaxSum + recaptureTaxSum + ltcgTaxSum + niitSum + annualIrmaaImpact
    };
}

/**
 * Scales tax boundaries based on an inflation factor
 */
function scaleMatrix(matrix, factor) {
    if (factor === 1.0) return matrix;
    return {
        ...matrix,
        stdDeductionBase: matrix.stdDeductionBase * factor,
        seniorStandardBump: matrix.seniorStandardBump * factor,
        obbbMaxBonus: matrix.obbbMaxBonus * factor,
        obbbPhaseStart: matrix.obbbPhaseStart * factor,
        obbbPhaseEnd: matrix.obbbPhaseEnd * factor,
        ordSchedule: matrix.ordSchedule.map(s => ({ ...s, cap: s.cap === Infinity ? Infinity : s.cap * factor })),
        ltcgSchedule: matrix.ltcgSchedule.map(s => ({ ...s, cap: s.cap === Infinity ? Infinity : s.cap * factor })),
        niitLimit: matrix.niitLimit * factor,
        irmaaSchedule: matrix.irmaaSchedule.map(s => ({ ...s, cap: s.cap === Infinity ? Infinity : s.cap * factor }))
    };
}
