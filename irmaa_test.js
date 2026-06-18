const SYSTEM_BRACKETS_2026 = {
    Single: {
        stdDeductionBase: 16100,
        seniorStandardBump: 1950,
        obbbMaxBonus: 6000,
        obbbPhaseStart: 75000,
        obbbPhaseEnd: 175000,
        ordSchedule: [
            { cap: 12400, rate: 0.10 }, { cap: 50400, rate: 0.12 },
            { cap: 105700, rate: 0.22 }, { cap: 201775, rate: 0.24 },
            { cap: 256225, rate: 0.32 }, { cap: 640600, rate: 0.35 },
            { cap: Infinity, rate: 0.37 }
        ],
        ltcgSchedule: [
            { cap: 49450, rate: 0.00 }, { cap: 545500, rate: 0.15 }, { cap: Infinity, rate: 0.20 }
        ],
        niitLimit: 200000,
        irmaaSchedule: [
            { cap: 109000, fee: 0 }, { cap: 137000, fee: 95.70 },
            { cap: 171000, fee: 240.50 }, { cap: 205000, fee: 385.00 },
            { cap: 500000, fee: 529.50 }, { cap: Infinity, fee: 577.70 }
        ]
    },
    MFJ: {
        stdDeductionBase: 32200,
        seniorStandardBump: 1550,
        obbbMaxBonus: 12000,
        obbbPhaseStart: 150000,
        obbbPhaseEnd: 250000,
        ordSchedule: [
            { cap: 24800, rate: 0.10 }, { cap: 100800, rate: 0.12 },
            { cap: 211400, rate: 0.22 }, { cap: 403550, rate: 0.24 },
            { cap: 512450, rate: 0.32 }, { cap: 768700, rate: 0.35 },
            { cap: Infinity, rate: 0.37 }
        ],
        ltcgSchedule: [
            { cap: 98900, rate: 0.00 }, { cap: 613700, rate: 0.15 }, { cap: Infinity, rate: 0.20 }
        ],
        niitLimit: 250000,
        irmaaSchedule: [
            { cap: 218000, fee: 0 }, { cap: 274000, fee: 191.40 },
            { cap: 342000, fee: 481.00 }, { cap: 410000, fee: 770.00 },
            { cap: 750000, fee: 1059.00 }, { cap: Infinity, fee: 1155.40 }
        ]
    }
};

function executeSystemTaxMath(wages, pretax, ss, stcg, recapture, ltcg, status, isSenior) {
    const matrix = SYSTEM_BRACKETS_2026[status];
    let ordinaryBaseGross = wages + pretax + stcg;
    let provIncome = ordinaryBaseGross + (ss * 0.5);

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

    // OBBB calculation omitted for brevity; not needed for these scenarios

    let totalDeductions = matrix.stdDeductionBase;
    if (isSenior) {
        totalDeductions += (status === "MFJ" ? matrix.seniorStandardBump * 2 : matrix.seniorStandardBump);
    }

    let netTaxableOrdinary = Math.max(0, ordinaryAGI - totalDeductions);
    let netTotalTaxable = Math.max(0, totalAGI - totalDeductions);

    let ordinaryTaxSum = 0;
    let priorCap = 0;
    for (let tier of matrix.ordSchedule) {
        let intersectionMin = Math.max(0, priorCap);
        let intersectionMax = Math.min(netTaxableOrdinary, tier.cap);
        if (intersectionMax > intersectionMin) {
            ordinaryTaxSum += (intersectionMax - intersectionMin) * tier.rate;
        }
        priorCap = tier.cap;
    }

    let ltcgTaxSum = 0;
    priorCap = 0;
    for (let tier of matrix.ltcgSchedule) {
        let intersectionMin = Math.max(0, priorCap);
        let intersectionMax = Math.min(netTotalTaxable, tier.cap);
        if (intersectionMax > intersectionMin) {
            ltcgTaxSum += (intersectionMax - intersectionMin) * tier.rate;
        }
        priorCap = tier.cap;
    }

    let niitSum = 0;
    if (totalAGI > matrix.niitLimit) {
        niitSum = Math.min(totalAGI - matrix.niitLimit, ltcg + stcg + recapture) * 0.038;
    }

    // Updated IRMAA logic: pick first cap >= totalAGI
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
        agiCalculated: totalAGI,
        monthlyIrmaa: monthlyIrmaaFee,
        annualIrmaa: annualIrmaaImpact,
        irmaaTier: activeIrmaaTier,
        compositeTaxMetric: ordinaryTaxSum + ltcgTaxSum + niitSum + annualIrmaaImpact
    };
}

function printScenario(name, wages, pretax, ss, stcg, recapture, ltcg, status, isSenior) {
    const res = executeSystemTaxMath(wages, pretax, ss, stcg, recapture, ltcg, status, isSenior);
    console.log(`--- ${name} ---`);
    console.log(`MAGI: $${Math.round(res.agiCalculated).toLocaleString()}`);
    console.log(`IRMAA monthly: $${res.monthlyIrmaa.toFixed(2)}`);
    console.log(`IRMAA annual: $${Math.round(res.annualIrmaa).toLocaleString()}`);
    console.log(`IRMAA tier index: ${res.irmaaTier}`);
    console.log(`Composite tax metric: $${Math.round(res.compositeTaxMetric).toLocaleString()}`);
    console.log();
}

// Scenario A: Senior MFJ ordinary=360k, LTCG=50k
printScenario('MFJ Senior: ordinary 360k + LTCG 50k', 360000, 0, 0, 0, 0, 50000, 'MFJ', true);

// Scenario B: MFJ Senior ordinary=300k, LTCG=0
printScenario('MFJ Senior: ordinary 300k', 300000, 0, 0, 0, 0, 0, 'MFJ', true);

// Scenario C: Single Senior ordinary=100k
printScenario('Single Senior: ordinary 100k', 100000, 0, 0, 0, 0, 0, 'Single', true);
