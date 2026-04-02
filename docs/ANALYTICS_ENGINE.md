# Analytics Engine — Spendr

Moduł odpowiedzialny za całą inteligencję analityczną aplikacji.
Ścieżka: `apps/backend/src/analytics/`

## Architektura modułu

```
analytics/
├── index.ts                          # Publiczne API — importuj tylko stąd
├── types.ts                          # Wszystkie typy wewnętrzne
├── AnalyticsPipeline.ts              # Orkiestrator — główny entry point
│
├── analyzers/                        # Niezależne moduły analizy
│   ├── AnomalyDetector.ts            # Odchylenia statystyczne (Modified Z-Score)
│   ├── RecurrenceDetector.ts         # Subskrypcje i płatności cykliczne (CV)
│   ├── PatternDetector.ts            # Wzorce temporalne (kawa, delivery, weekend)
│   ├── BehavioralAnalyzer.ts         # Ekonomia behawioralna (bias, adaptacja)
│   └── FinancialFrameworkAnalyzer.ts # Reguła 50/30/20, burn rate, latte factor
│
├── scoring/
│   └── WasteScoreEngine.ts           # Agregacja sygnałów → wynik 0–100
│
├── forecasting/
│   └── SpendingForecaster.ts         # Holt, Holt-Winters, pace-based forecast
│
└── suggestions/
    ├── SuggestionEngine.ts           # Orkiestrator sugestii (Strategy pattern)
    └── strategies/
        ├── CancelStrategy.ts         # Anuluj zombie subskrypcje
        ├── SwapStrategy.ts           # Tańsza alternatywa (ekspres zamiast Starbucks)
        ├── CookStrategy.ts           # Gotowanie zamiast delivery
        ├── RuleStrategy.ts           # Zasady behawioralne (24h rule, 3x/tydzień)
        ├── DowngradeStrategy.ts      # Tańszy wariant tej samej kategorii
        └── DuplicateStrategy.ts      # Pokrywające się subskrypcje
```

---

## Przepływ pipelineu

```
AnalysisContext (transakcja + historia + kalendarz + ustawienia)
        │
        ▼
┌───────────────────────────────────────┐
│  Stage 1: AnomalyDetector             │
│  Modified Z-Score per kategoria       │
│  → Signals: AMOUNT_ANOMALY,           │
│             FIRST_TIME_MERCHANT       │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 2: RecurrenceDetector          │
│  Coefficient of Variation < 0.15      │
│  → RecurringPayments[]                │
│  → Signals: ZOMBIE_SUBSCRIPTION,      │
│             DUPLICATE_SUBSCRIPTION    │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 3: PatternDetector             │
│  Day-of-week frequency analysis       │
│  → DetectedPatterns[]                 │
│  → Signals: RECURRING_DAY_PATTERN,    │
│             FREQUENCY_ESCALATION      │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 4: BehavioralAnalyzer          │
│  Present bias, hedonic adaptation,    │
│  mental accounting, anchoring         │
│  → Signals: PRESENT_BIAS,             │
│             HEDONIC_ADAPTATION,       │
│             MENTAL_ACCOUNTING_BONUS,  │
│             ANCHORING_EFFECT          │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 5: FinancialFrameworkAnalyzer  │
│  50/30/20, burn rate, latte factor,   │
│  FIRE impact, ZBB envelopes           │
│  → Signals: BURN_RATE_CRITICAL,       │
│             WANTS_OVER_50PCT,         │
│             LATTE_FACTOR,             │
│             BUDGET_EXCEEDED           │
└───────────────┬───────────────────────┘
                │
        All signals collected
                │
┌───────────────▼───────────────────────┐
│  Stage 6: WasteScoreEngine            │
│  Signal-driven scoring (0–100)        │
│  Breakdown: categoryBase +            │
│  frequencyPenalty + anomaly +         │
│  night + zombie + impulse             │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 7: SpendingForecaster          │
│  Tier by data availability:           │
│  < 60d → pace   60-180d → Holt        │
│  180d+ → Holt-Winters                 │
│  → BurnRateResult + intervals         │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 8: SuggestionEngine            │
│  6 strategies, ranked by             │
│  confidence × annualSavings           │
│  Max 3 suggestions returned           │
└───────────────┬───────────────────────┘
                │
┌───────────────▼───────────────────────┐
│  Stage 9: DrSpenderContext builder    │
│  Assembles structured context for    │
│  Claude API call                      │
│  → mood, topSignals, patterns,        │
│     history, suggestion               │
└───────────────┬───────────────────────┘
                │
                ▼
           PipelineResult
```

---

## Sygnały — tabela referencyjna

| Sygnał | Skąd | Severity | Opis |
|--------|------|----------|------|
| `AMOUNT_ANOMALY` | AnomalyDetector | warning/critical | Modified Z-Score > 2.5 vs kategoria |
| `FIRST_TIME_MERCHANT` | AnomalyDetector | info | Pierwszy raz u tego sprzedawcy |
| `FIRST_TIME_CATEGORY_THIS_MONTH` | AnomalyDetector | info | Pierwsza transakcja kategorii w tym miesiącu |
| `ZOMBIE_SUBSCRIPTION` | RecurrenceDetector | critical | Subskrypcja bez użycia > 30 dni |
| `DUPLICATE_SUBSCRIPTION` | RecurrenceDetector | warning | Dwie subskrypcje tej samej kategorii |
| `NEW_SUBSCRIPTION_DETECTED` | RecurrenceDetector | info | Właśnie stała się cykliczna |
| `SUNK_COST_SUBSCRIPTION` | RecurrenceDetector | critical | Portfel zombie subskrypcji > 50 PLN/mies |
| `RECURRING_DAY_PATTERN` | PatternDetector | info/warning | Wykryty wzorzec temporalny |
| `FREQUENCY_ESCALATION` | PatternDetector | warning | Częstość zakupów rośnie > 40% tygodniowo |
| `PRESENT_BIAS` | BehavioralAnalyzer | warning/critical | Nocny impuls zakupowy |
| `HEDONIC_ADAPTATION` | BehavioralAnalyzer | warning | Rosnąca częstość, malejąca radość |
| `MENTAL_ACCOUNTING_BONUS` | BehavioralAnalyzer | warning | Wydatki wzrosły po wpływie przelewu |
| `ANCHORING_EFFECT` | BehavioralAnalyzer | info | Kategoria drożeje po jednym dużym zakupie |
| `WANTS_OVER_50PCT` | FinancialFrameworkAnalyzer | warning | Reguła 50/30/20 naruszona |
| `BURN_RATE_CRITICAL` | FinancialFrameworkAnalyzer | critical | Budżet skończy się przed końcem miesiąca |
| `LATTE_FACTOR` | FinancialFrameworkAnalyzer | info/warning | Skumulowany koszt małych wydatków |
| `FIRE_IMPACT` | FinancialFrameworkAnalyzer | info | Wpływ marnowania na niezależność finansową |
| `BUDGET_EXCEEDED` | FinancialFrameworkAnalyzer | warning/critical | Przekroczono limit kategorii (ZBB) |

---

## Waste Score — szczegółowe obliczenie

```
WasteScore = categoryBase (0–40)
           + frequencyPenalty (0–20)   ← signal: FREQUENCY_ESCALATION
           + amountAnomalyPenalty (0–15) ← signal: AMOUNT_ANOMALY
           + nightPenalty (0–10)       ← signal: PRESENT_BIAS
           + zombiePenalty (0–30)      ← signal: ZOMBIE_SUBSCRIPTION
           + impulsePenalty (0–5)      ← signals: HEDONIC_ADAPTATION etc.
           ─────────────────────────
           Max: 100 (capped)
```

Baza per kategoria (0–40):
- COFFEE: 35, ALCOHOL: 30, ENTERTAINMENT: 25
- FOOD_RESTAURANT: 20, SUBSCRIPTION: 20, ELECTRONICS: 20
- CLOTHING: 15, TRAVEL: 10, OTHER: 10
- TRANSPORT: 5, SPORT: 5, FOOD_GROCERY: 5
- HEALTH: 0 (nigdy nie waste)

---

## Forecasting — dobór metody

| Dane | Metoda | Confidence |
|------|--------|------------|
| < 60 dni | Pace + day-of-week adjustment | low |
| 60–180 dni | Holt's Double Exponential Smoothing | medium |
| 180+ dni | Holt-Winters (trend + weekly seasonality) | high |

Zawsze zwraca przedział ufności (low, high), nie tylko punkt.
Zasada: "między 2800 a 3400 PLN" jest uczciwe, "3124 PLN" to fałszywa precyzja.

---

## Sugestie — ranking i limity

Strategie są uruchamiane dla każdej transakcji. Wynik rankingowania:

```
score = confidence × annualSavings
```

Zwracane są **maksymalnie 3 sugestie** — unikamy paraliżu decyzyjnego
(Thaler & Sunstein: zbyt wiele opcji = brak działania).

Każda sugestia zawiera `drSpenderQuip` — fragment przekazywany do
Claude API jako część kontekstu komentarza.

---

## Użycie z serwisów

```typescript
import { AnalyticsPipeline, AnalysisContext } from '../analytics'

const pipeline = new AnalyticsPipeline()

// Zbuduj kontekst (dane z Prisma)
const ctx: AnalysisContext = {
  userId: user.id,
  transaction,
  history: {
    last30Days:  await getTransactions(userId, 30),
    last90Days:  await getTransactions(userId, 90),
    allTime:     await getTransactions(userId, 365 * 3),
  },
  calendar: buildCalendarContext(transaction.date, user.settings),
  userSettings: mapUserSettings(user.settings),
}

// Uruchom pipeline
const result = pipeline.run(ctx)

// Zapisz wyniki
await prisma.transaction.update({
  where: { id: transaction.id },
  data: {
    wasteScore: result.wasteScore.score,
    isWasted:   result.wasteScore.score > 50,
  },
})

// Przekaż kontekst do DrSpenderService → Claude API
await drSpenderService.generateComment(result.drSpenderContext)

// Zapisz sugestie
await saveSuggestions(userId, result.suggestions)
```

---

## Rozszerzanie — dodawanie nowej strategii

1. Utwórz `apps/backend/src/analytics/suggestions/strategies/XxxStrategy.ts`
2. Zaimplementuj interfejs `SuggestionStrategy`
3. Dodaj do listy w `SuggestionEngine.ts`

Nie modyfikuj pipeline ani typów — strategie są izolowane.

---

## Rozszerzanie — dodawanie nowego sygnału

1. Dodaj nowy `SignalType` do `types.ts`
2. Emituj sygnał w odpowiednim Analyzerze
3. Dodaj wpis w `SIGNAL_CONTRIBUTIONS` w `WasteScoreEngine.ts` (opcjonalnie)
4. Obsłuż w `DrSpenderContext` jeśli ma wpływ na komentarz

---

## Fundamenty naukowe

| Metoda | Źródło |
|--------|--------|
| Modified Z-Score | Iglewicz & Hoaglin (1993). *How to Detect and Handle Outliers* |
| Subscription CV detection | Własna implementacja na podstawie metod detekcji cykliczności |
| Holt-Winters forecasting | Winters (1960). *Forecasting Sales by Exponentially Weighted Moving Averages* |
| 50/30/20 rule | Warren & Tyagi (2005). *All Your Worth* |
| Latte Factor | Bach (2004). *The Automatic Millionaire* |
| 4% FIRE rule | Bengen (1994). *Determining Withdrawal Rates Using Historical Data* |
| Present Bias | Kahneman & Tversky (1979). *Prospect Theory* |
| Hedonic Adaptation | Brickman & Campbell (1971). *Hedonic relativism and planning the good society* |
| Mental Accounting | Thaler (1985). *Mental Accounting and Consumer Choice* |
| Anchoring | Kahneman & Tversky (1974). *Judgment under Uncertainty* |
| Implementation intentions (Rules) | Gollwitzer (1999). *Implementation intentions* |
| Loss framing (Cancel/Duplicate) | Kahneman & Tversky (1979). *Prospect Theory* |
| Nudge principles | Thaler & Sunstein (2008). *Nudge* |
