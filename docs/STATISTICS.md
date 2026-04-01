# Statystyki i Analizy Finansowe — Cashy

## Metryki zbierane per transakcja

```typescript
interface TransactionMetrics {
  // Podstawowe
  amount: number;
  category: Category;
  date: Date;
  merchant?: string;

  // Obliczane przy zapisie
  wasteScore: number;        // 0-100
  isWasted: boolean;         // wasteScore > 50
  timeOfDay: TimeOfDay;      // morning/afternoon/evening/night
  dayOfWeek: number;         // 0-6
  isWeekend: boolean;
  isImpulse: boolean;        // nocna transakcja lub przy anomalii kwoty
}
```

---

## Algorytm Waste Score

Każda transakcja dostaje wynik 0-100 określający "jak bardzo zmarnowane są te pieniądze".

```typescript
function calculateWasteScore(
  transaction: Transaction,
  history: TransactionHistory
): number {
  let score = 0;

  // 1. KATEGORIA BAZOWA (0-40 punktów)
  const categoryBaseScore: Record<Category, number> = {
    COFFEE:            35,   // kawa na mieście = prawie zawsze zbędne
    ALCOHOL:           30,
    FOOD_RESTAURANT:   20,   // jedzenie na mieście — przyjemność ale nie konieczność
    ENTERTAINMENT:     25,
    CLOTHING:          15,   // zależy od kontekstu
    SUBSCRIPTION:      20,   // potencjalnie zombie
    FOOD_GROCERY:       5,   // konieczne
    HEALTH:             0,   // nigdy nie waste
    TRANSPORT:          5,
    ELECTRONICS:       20,
    TRAVEL:            10,
    SPORT:              5,
    OTHER:             10,
  };
  score += categoryBaseScore[transaction.category];

  // 2. CZĘSTOTLIWOŚĆ W KATEGORII (+0-20 punktów)
  const freqMultiplier = Math.min(history.transactionCountThisMonth / 5, 1);
  score += freqMultiplier * 20;

  // 3. KWOTA vs MEDIANA KATEGORII (+0-15 punktów)
  const median = history.medianAmountForCategory;
  if (median > 0) {
    const ratio = transaction.amount / median;
    if (ratio > 2) score += 15;
    else if (ratio > 1.5) score += 10;
    else if (ratio > 1.2) score += 5;
  }

  // 4. PORA NOCNA (+10 punktów)
  const hour = transaction.date.getHours();
  if (hour >= 23 || hour < 3) score += 10;

  // 5. SUBSKRYPCJA NIEUŻYWANA (+30 punktów)
  if (transaction.category === 'SUBSCRIPTION' && history.lastUsage) {
    const daysSinceUse = daysBetween(history.lastUsage, new Date());
    if (daysSinceUse > 30) score += 30;
    else if (daysSinceUse > 14) score += 15;
  }

  // 6. WZORZEC IMPULSU (+5 punktów)
  if (history.sameMerchantLastWeek >= 3) score += 5;

  return Math.min(score, 100);
}
```

---

## Aggregate Statistics — Obliczenia miesięczne

### Łączne statystyki miesięczne
```typescript
interface MonthlyStats {
  // Łączne
  totalSpent: number;
  totalWasted: number;        // suma amount gdzie isWasted=true
  wastePercentage: number;    // totalWasted / totalSpent * 100

  // Per kategoria
  byCategory: Record<Category, {
    total: number;
    count: number;
    wasteScore: number;       // średni waste score w kategorii
  }>;

  // Porównanie
  vsLastMonth: {
    totalSpentDiff: number;   // różnica w PLN
    totalSpentDiffPct: number; // różnica w %
    wastedDiff: number;
  };

  // Wzorce
  topWasteCategories: Category[];  // top 3 kategorii po zmarnowaniu
  avgWasteScore: number;
  worstDay: Date;              // dzień z najwyższymi wydatkami
  worstTimeOfDay: TimeOfDay;   // pora dnia z najwyższymi wydatkami

  // Subskrypcje
  activeSubscriptions: number;
  zombieSubscriptions: number;  // nieużywane > 30 dni
  zombieCost: number;           // miesięczny koszt zombie subskrypcji

  // "Mogłeś za to kupić"
  equivalents: WasteEquivalent[];
}
```

---

## "Co mógłbyś za to kupić" — Przeliczniki

```typescript
interface WasteEquivalent {
  name: string;
  price: number;
  quantity: number;    // ile sztuk za zmarnowane pieniądze
  unit: string;
  emoji?: string;
}

const EQUIVALENTS: Array<{ name: string; price: number; unit: string }> = [
  { name: "kawa z ekspresu w domu",   price: 0.50,   unit: "kawa" },
  { name: "bilet do kina",            price: 30,     unit: "bilet" },
  { name: "książka",                  price: 45,     unit: "książka" },
  { name: "lot do Barcelony i z pow.", price: 500,   unit: "lot" },
  { name: "ekspres do kawy Nespresso", price: 400,  unit: "ekspres" },
  { name: "miesiąc siłowni",          price: 120,   unit: "miesiąc" },
  { name: "obiad dla dwóch",          price: 100,   unit: "obiad" },
  { name: "butelka dobrego wina",     price: 60,    unit: "butelka" },
  { name: "noc w hotelu",             price: 200,   unit: "noc" },
];

function calculateEquivalents(wastedAmount: number): WasteEquivalent[] {
  return EQUIVALENTS
    .filter(eq => wastedAmount >= eq.price)
    .map(eq => ({
      ...eq,
      quantity: Math.floor(wastedAmount / eq.price),
    }))
    .slice(0, 3);
}
```

---

## Wykrywanie Wzorców

### Wzorce które śledzimy

```typescript
interface DetectedPattern {
  type: PatternType;
  description: string;
  affectedTransactions: string[];  // IDs
  monthlyCost: number;
  confidence: number;              // 0-1
}

enum PatternType {
  FRIDAY_TAKEOUT         = 'FRIDAY_TAKEOUT',          // co piątek jedzenie na wynos
  MORNING_COFFEE         = 'MORNING_COFFEE',          // kawa każdego ranka
  WEEKEND_SHOPPING       = 'WEEKEND_SHOPPING',        // zakupy w weekend
  LATE_NIGHT_DELIVERY    = 'LATE_NIGHT_DELIVERY',    // delivery po 23:00
  RECURRING_SUBSCRIPTION = 'RECURRING_SUBSCRIPTION', // cykliczne płatności
  MOOD_SHOPPING          = 'MOOD_SHOPPING',           // duże zakupy po długiej przerwie
  DUPLICATE_MERCHANTS    = 'DUPLICATE_MERCHANTS',     // ten sam merchant 3x w tygodniu
}
```

### Algorytm wykrywania
```
FRIDAY_TAKEOUT:
  → WeekDay = PIĄTEK
  → Category = FOOD_RESTAURANT lub ENTERTAINMENT
  → Ile razy w ostatnich 4 tygodniach?
  → Jeśli >= 3/4 → confidence: 0.75+

MORNING_COFFEE:
  → TimeOfDay = morning (6:00-10:00)
  → Category = COFFEE
  → Ile dni w tygodniu?
  → Jeśli >= 4/7 → confidence: 0.80+

ZOMBIE_SUBSCRIPTION:
  → Category = SUBSCRIPTION
  → Cykliczna płatność (co ~30 dni)
  → Brak aktywności w serwisie (heurystyka lub brak transakcji do serwisu)
  → confidence: 0.90
```

---

## Dashboardy i Wykresy — specyfikacja

### Wykres 1: Wydatki w czasie (SpendingLineChart)
- Typ: linia z obszarem
- Oś X: dni miesiąca lub tygodnie
- Oś Y: PLN
- Dwie linie: "Wszystkie wydatki" (szary) vs "Zmarnowane" (czerwony)
- Zaznaczenie anomalii: kropka gdy day > 2x mediana dzienna
- Biblioteka: victory-native

### Wykres 2: Kategorie (CategoryDonutChart)
- Typ: donut chart
- Segmenty: kategorie wydatków
- Kolory: "konieczne" = zielone odcienie, "zbędne" = czerwone/pomarańczowe
- Center: łączna kwota lub % zmarnowane
- Click/tap → lista transakcji w kategorii

### Wykres 3: Waste Score w czasie (WasteGauge)
- Typ: licznik/gauge (jak prędkościomierz)
- Skala: 0-100
- Strefy: 0-30 zielony, 30-60 żółty, 60-100 czerwony
- Animacja przy załadowaniu (wskazówka jedzie do wartości)
- Pod licznikiem: "W tym miesiącu zmarnowałeś X PLN (Y% budżetu)"

### Wykres 4: Porównanie miesięcy (MonthComparisonBar)
- Typ: grouped bar chart
- Ostatnie 6 miesięcy
- Dwa słupki: "Całkowite" i "Zmarnowane"
- Trend linia nad słupkami

### Wykres 5: Subskrypcje (SubscriptionList)
- Nie wykres — lista kart
- Każda karta: logo, nazwa, cena, ostatnie użycie, status (aktywna/zombie)
- Sortowanie: zombie na górze
- Akcja: "Anuluj" (link do strony)

---

## Tygodniowy Raport Wstydu — Struktura

Generowany w poniedziałek 8:00, dla poprzedniego tygodnia:

```typescript
interface WeeklyReport {
  week: { start: Date; end: Date };
  totalSpent: number;
  totalWasted: number;
  topWaste: Transaction[];        // top 3 największe "zmarnowania"
  improvementVsLastWeek?: number; // % zmniejszenia waste vs poprzedni tydzień
  kasjanuszMonologue: string;     // długi komentarz z Claude API
  positiveNote?: string;          // jeśli coś dobrego się wydarzyło
}
```

Prompt do Claude dla tygodniowego raportu:
```
Podsumuj tydzień finansowy użytkownika. Jesteś Kasjanuszem.
Masz dane: [dane tygodnia]
Napisz dramatyczny, sarkastyczny ale konkretny podsumowanie (4-6 zdań).
Wymień 2-3 konkretne transakcje po nazwie i kwocie.
Zakończ jednym zdaniem z prognozą lub przestrogą.
Jeśli był jakiś postęp — wspomnij o tym z niedowierzaniem.
```
