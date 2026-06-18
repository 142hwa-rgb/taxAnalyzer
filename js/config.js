// 2026 Tax brackets and system configuration
export const PROJECTION_DEFAULTS = {
    inflation: 0.03,
    growth: 0.06,
    rmdStartAge: 73
};

export const RMD_DIST_FACTORS = {
    // IRS Uniform Lifetime Table (Table III)
    73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
    81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
    89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
    97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9,
    105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3,
    113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0
};

export const SYSTEM_BRACKETS_2026 = {
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
