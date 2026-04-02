// ============================================================
// FinancialFrameworkAnalyzer
//
// Applies established personal finance frameworks to generate
// high-level signals and metrics:
//
//   1. 50/30/20 Rule (Elizabeth Warren) — Needs/Wants/Savings split
//   2. Burn Rate — daily spend rate vs budget runway
//   3. Latte Factor (David Bach) — small recurring → compound loss
//   4. FIRE Impact — annualized + compounded waste opportunity cost
//   5. Zero-Based Budget adherence — envelope tracking
//
// References:
//   Warren & Tyagi (2005). "All Your Worth."
//   Bach, D. (2004). "The Automatic Millionaire."
//   Bengen, W. (1994). "Determining Withdrawal Rates Using Historical Data."
//   Thaler & Sunstein (2008). "Nudge."
// ============================================================

import type {
  AnalysisContext,
  AnalyzerResult,
  Signal,
  Category,
  Transaction,
} from '../types'

// 50/30/20 category mapping
// "Needs" = non-discretionary, "Wants" = discretionary
const NEEDS_CATEGORIES = new Set<Category>([
  'FOOD_GROCERY',
  'TRANSPORT',
  'HEALTH',
])
const WANTS_CATEGORIES = new Set<Category>([
  'FOOD_RESTAURANT',
  'COFFEE',
  'ALCOHOL',
  'ENTERTAINMENT',
  'CLOTHING',
  'SUBSCRIPTION',
  'ELECTRONICS',
  'SPORT',
  'TRAVEL',
  'OTHER',
])

// Investment return assumption for latte factor / FIRE calculations
// Conservative long-term real return (after inflation)
const ASSUMED_ANNUAL_RETURN = 0.07

// Latte factor: minimum monthly amount to flag
const LATTE_FACTOR_MIN_MONTHLY = 80  // PLN

// Burn rate: days-remaining buffer threshold
const BURN_RATE_CRITICAL_DAYS = 10

interface FinancialFrameworkFindings {
  fiftyThirtyTwenty: FiftyThirtyTwentyResult | null
  burnRate: BurnRateDetails
  latteFactor: LatteFactorResult | null
  fireImpact: FireImpactResult | null
  envelopeStatus: EnvelopeStatus[]
}

interface FiftyThirtyTwentyResult {
  needsSpent: number
  wantsSpent: number
  needsPct: number
  wantsPct: number
  // null if no income declared
  needsBudget: number | null
  wantsBudget: number | null
  savingsBudget: number | null
  wantsOverLimit: boolean
}

interface BurnRateDetails {
  dailyBurnRate: number
  projectedMonthEnd: number
  daysUntilBudgetExhausted: number | null
  isCritical: boolean
  budgetUsedPct: number | null
}

interface LatteFactorResult {
  category: Category
  monthlySpend: number
  annualSpend: number
  fiveYearCompound: number    // at ASSUMED_ANNUAL_RETURN
  tenYearCompound: number
  twentyYearCompound: number
  equivalentPerDay: number    // "X PLN dziennie"
}

interface FireImpactResult {
  annualWaste: number
  fiImpact: number            // How much this reduces your FI number target
  // How many years it adds to FI timeline (rough estimate)
  yearsAddedToFI: number | null
}

interface EnvelopeStatus {
  category: Category
  budget: number
  spent: number
  remaining: number
  usedPct: number
  isOverBudget: boolean
}

export class FinancialFrameworkAnalyzer {
  readonly id = 'FinancialFrameworkAnalyzer'

  analyze(ctx: AnalysisContext): AnalyzerResult<FinancialFrameworkFindings> {
    const signals: Signal[] = []

    const startOfMonth = new Date(ctx.transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonthTxns = ctx.history.last30Days.filter(
      t => t.date >= startOfMonth,
    )

    const fiftyThirtyTwenty = this.analyzeFiftyThirtyTwenty(
      thisMonthTxns,
      ctx.userSettings.monthlyNetIncome,
    )

    const burnRate = this.analyzeBurnRate(
      thisMonthTxns,
      ctx.calendar,
      ctx.userSettings.monthlyNetIncome ?? null,
    )

    const latteFactor = this.analyzeLatteFactor(
      ctx.history.last90Days,
      ctx.transaction.category,
    )

    const fireImpact = latteFactor
      ? this.analyzeFireImpact(
          latteFactor.annualWaste ?? latteFactor.annualSpend,
          ctx.userSettings.monthlyNetIncome,
        )
      : null

    const envelopeStatus = this.analyzeEnvelopes(
      thisMonthTxns,
      ctx.userSettings.categoryBudgets,
    )

    // ── Signals ─────────────────────────────────────────

    if (fiftyThirtyTwenty?.wantsOverLimit) {
      signals.push({
        type: 'WANTS_OVER_50PCT',
        severity: 'warning',
        value: fiftyThirtyTwenty.wantsPct,
        label: `${fiftyThirtyTwenty.wantsPct.toFixed(0)}% wydatków to zachcianki (reguła 50/30/20 mówi max 30%)`,
        metadata: { ...fiftyThirtyTwenty },
      })
    }

    if (burnRate.isCritical && burnRate.daysUntilBudgetExhausted !== null) {
      signals.push({
        type: 'BURN_RATE_CRITICAL',
        severity: 'critical',
        value: burnRate.daysUntilBudgetExhausted,
        label: `Przy obecnym tempie budżet skończy się za ${burnRate.daysUntilBudgetExhausted} dni — zostało jeszcze ${ctx.calendar.daysRemainingInMonth} dni w miesiącu`,
        metadata: { ...burnRate },
      })
    }

    if (latteFactor) {
      signals.push({
        type: 'LATTE_FACTOR',
        severity: latteFactor.monthlySpend > 300 ? 'warning' : 'info',
        value: latteFactor.tenYearCompound,
        label: `${latteFactor.equivalentPerDay.toFixed(1)} PLN/dzień na ${latteFactor.category} = ${latteFactor.tenYearCompound.toFixed(0)} PLN w 10 lat przy 7% zwrocie`,
        metadata: { ...latteFactor },
      })
    }

    if (fireImpact && fireImpact.annualWaste > 2000) {
      signals.push({
        type: 'FIRE_IMPACT',
        severity: 'info',
        value: fireImpact.fiImpact,
        label: `Roczne marnowanie ${fireImpact.annualWaste.toFixed(0)} PLN opóźnia niezależność finansową`,
        metadata: { ...fireImpact },
      })
    }

    // Per-envelope signals
    for (const envelope of envelopeStatus) {
      if (envelope.isOverBudget) {
        signals.push({
          type: 'BUDGET_EXCEEDED',
          severity: envelope.usedPct > 150 ? 'critical' : 'warning',
          value: envelope.usedPct,
          label: `Budżet ${envelope.category} przekroczony: wydano ${envelope.spent.toFixed(0)} / ${envelope.budget.toFixed(0)} PLN (${envelope.usedPct.toFixed(0)}%)`,
          metadata: { ...envelope },
        })
      }
    }

    return {
      analyzerId: this.id,
      findings: {
        fiftyThirtyTwenty,
        burnRate,
        latteFactor,
        fireImpact,
        envelopeStatus,
      },
      signals,
    }
  }

  // ── 1. 50/30/20 Rule ────────────────────────────────────

  private analyzeFiftyThirtyTwenty(
    monthlyTxns: Transaction[],
    monthlyIncome: number | null,
  ): FiftyThirtyTwentyResult | null {
    if (monthlyTxns.length === 0) return null

    const totalSpent = monthlyTxns.reduce((s, t) => s + t.amount, 0)
    const needsSpent = monthlyTxns
      .filter(t => NEEDS_CATEGORIES.has(t.category))
      .reduce((s, t) => s + t.amount, 0)
    const wantsSpent = monthlyTxns
      .filter(t => WANTS_CATEGORIES.has(t.category))
      .reduce((s, t) => s + t.amount, 0)

    const needsPct = totalSpent > 0 ? (needsSpent / totalSpent) * 100 : 0
    const wantsPct = totalSpent > 0 ? (wantsSpent / totalSpent) * 100 : 0

    return {
      needsSpent,
      wantsSpent,
      needsPct,
      wantsPct,
      needsBudget: monthlyIncome ? monthlyIncome * 0.5 : null,
      wantsBudget: monthlyIncome ? monthlyIncome * 0.3 : null,
      savingsBudget: monthlyIncome ? monthlyIncome * 0.2 : null,
      wantsOverLimit: wantsPct > 40, // Flag at 40% (50/30/20 allows 30%)
    }
  }

  // ── 2. Burn Rate ─────────────────────────────────────────

  private analyzeBurnRate(
    monthlyTxns: Transaction[],
    calendar: AnalysisContext['calendar'],
    budget: number | null,
  ): BurnRateDetails {
    const spentSoFar = monthlyTxns.reduce((s, t) => s + t.amount, 0)
    const daysElapsed = Math.max(calendar.daysElapsedInMonth, 1)
    const dailyBurnRate = spentSoFar / daysElapsed
    const projectedMonthEnd =
      spentSoFar + dailyBurnRate * calendar.daysRemainingInMonth

    const daysUntilBudgetExhausted =
      budget !== null && dailyBurnRate > 0
        ? Math.max(0, Math.floor((budget - spentSoFar) / dailyBurnRate))
        : null

    const isCritical =
      daysUntilBudgetExhausted !== null
      && daysUntilBudgetExhausted < calendar.daysRemainingInMonth
      && calendar.daysRemainingInMonth - daysUntilBudgetExhausted
        > BURN_RATE_CRITICAL_DAYS

    const budgetUsedPct =
      budget !== null ? (spentSoFar / budget) * 100 : null

    return {
      dailyBurnRate,
      projectedMonthEnd,
      daysUntilBudgetExhausted,
      isCritical,
      budgetUsedPct,
    }
  }

  // ── 3. Latte Factor (David Bach) ─────────────────────────

  /**
   * Compound interest on small recurring spending.
   * The latte factor is most persuasive when framed as
   * opportunity cost over 10-20 years.
   *
   * FV = PMT * [(1 + r)^n - 1] / r
   * where PMT = annual spend, r = annual return, n = years
   */
  private analyzeLatteFactor(
    history: Transaction[],
    category: Category,
  ): LatteFactorResult | null {
    const categoryTxns = history.filter(t => t.category === category)
    if (categoryTxns.length < 3) return null

    // Annualize from last 90 days
    const monthlySpend = categoryTxns.reduce((s, t) => s + t.amount, 0) / 3
    if (monthlySpend < LATTE_FACTOR_MIN_MONTHLY) return null

    const annualSpend = monthlySpend * 12

    return {
      category,
      monthlySpend,
      annualSpend,
      fiveYearCompound:   this.fv(annualSpend, ASSUMED_ANNUAL_RETURN, 5),
      tenYearCompound:    this.fv(annualSpend, ASSUMED_ANNUAL_RETURN, 10),
      twentyYearCompound: this.fv(annualSpend, ASSUMED_ANNUAL_RETURN, 20),
      equivalentPerDay:   annualSpend / 365,
      annualWaste:        annualSpend,
    } as LatteFactorResult & { annualWaste: number }
  }

  /** Future Value of annuity: PMT * [(1+r)^n - 1] / r */
  private fv(annualPmt: number, rate: number, years: number): number {
    return annualPmt * ((Math.pow(1 + rate, years) - 1) / rate)
  }

  // ── 4. FIRE Impact ───────────────────────────────────────

  /**
   * 4% safe withdrawal rule (Bengen 1994 / Trinity Study 1998):
   * FI Number = annual expenses / 0.04
   *
   * Reducing annual expenses by X reduces the FI Number by X / 0.04 = 25X.
   * "Every PLN of annual spending you eliminate removes 25 PLN from your FI number."
   */
  private analyzeFireImpact(
    annualWaste: number,
    monthlyIncome: number | null,
  ): FireImpactResult {
    const fiImpact = annualWaste * 25  // 1 / 0.04 = 25

    // Rough years-to-FI estimate requires savings rate
    // Only compute if income is known
    let yearsAddedToFI: number | null = null
    if (monthlyIncome !== null && monthlyIncome > 0) {
      const annualIncome = monthlyIncome * 12
      // Simplified: additional years = fiImpact / (annualIncome * savings_rate)
      // Assumes 20% savings rate as baseline
      const annualSavings = annualIncome * 0.2
      yearsAddedToFI = annualSavings > 0
        ? Math.round(fiImpact / annualSavings * 10) / 10
        : null
    }

    return { annualWaste, fiImpact, yearsAddedToFI }
  }

  // ── 5. Envelope (ZBB) tracking ───────────────────────────

  private analyzeEnvelopes(
    monthlyTxns: Transaction[],
    budgets: Partial<Record<Category, number>>,
  ): EnvelopeStatus[] {
    return Object.entries(budgets).map(([category, budget]) => {
      const cat = category as Category
      const spent = monthlyTxns
        .filter(t => t.category === cat)
        .reduce((s, t) => s + t.amount, 0)
      const remaining = budget - spent
      const usedPct = (spent / budget) * 100

      return {
        category: cat,
        budget,
        spent,
        remaining,
        usedPct,
        isOverBudget: spent > budget,
      }
    })
  }
}
