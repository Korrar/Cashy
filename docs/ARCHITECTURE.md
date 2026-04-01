# Architektura — Spendr

## Diagram wysokopoziomowy

```
┌─────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                              │
│  React Native + Expo                                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │Dashboard │  │ Stats &  │  │Dr. Spender │  │Transactions  │  │
│  │Screen    │  │Analytics │  │Feed      │  │Screen        │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │              │                │          │
│  ┌────┴──────────────┴──────────────┴────────────────┴───────┐ │
│  │                    Zustand Store                           │ │
│  │  transactionsSlice | drSpenderSlice | statsSlice          │ │
│  └────────────────────────────┬───────────────────────────────┘ │
│                               │ axios                           │
└───────────────────────────────┼─────────────────────────────────┘
                                │ HTTPS + JWT
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                          BACKEND API                            │
│  Node.js + Express + TypeScript                                 │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │ Auth Routes  │  │Transaction     │  │Stats Routes        │  │
│  │ /auth/*      │  │Routes          │  │/stats/*            │  │
│  │              │  │/transactions/* │  │                    │  │
│  └──────────────┘  └───────┬────────┘  └────────────────────┘  │
│                            │                                    │
│  ┌─────────────────────────┴──────────────────────────────────┐ │
│  │                    Service Layer                            │ │
│  │  TransactionService | DrSpenderService | StatsService      │ │
│  └──┬──────────────────┬──────────────────┬───────────────────┘ │
│     │                  │                  │                      │
│  ┌──┴───┐  ┌───────────┴──┐  ┌───────────┴──────┐             │
│  │Prisma│  │ Bull Queue   │  │ Claude API Client│             │
│  │(PG)  │  │(Redis)       │  │ Dr. Spender        │             │
│  └──────┘  └──────────────┘  └──────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
        │                │                   │
   ┌────┴────┐    ┌───────┴────┐    ┌────────┴────────┐
   │Postgres │    │  Redis     │    │  Anthropic API  │
   │(Prisma) │    │  Cache +   │    │  claude-sonnet  │
   │         │    │  Bull Jobs │    │  -4-6           │
   └─────────┘    └────────────┘    └─────────────────┘
        │
   ┌────┴──────────────┐
   │  Nordigen API     │
   │  Open Banking     │
   │  (background sync)│
   └───────────────────┘
```

## Przepływ danych — Nowa Transakcja (Open Banking)

```
1. Background fetch (Expo Task Manager, co 15 min)
   → GET /api/sync/transactions

2. Backend odpytuje Nordigen API
   → GET https://ob.nordigen.com/api/v2/accounts/{id}/transactions/

3. Nowe transakcje → TransactionService.categorize()
   → Algorytm kategoryzacji (regex + ML keywords)
   → Zapis do PostgreSQL

4. Bull Queue: job "analyze-transaction"
   → StatsService.calculateWasteScore(transaction)
   → PatternDetectionService.checkPatterns(userId)

5. Jeśli wasteScore > 30 LUB wykryto wzorzec:
   → DrSpenderService.generateComment(context)
   → Anthropic Claude API call
   → Zapis komentarza do DB

6. Push notification przez Expo Push Service
   → Tytuł: "Dr. Spender ma coś do powiedzenia"
   → Body: pierwsze zdanie komentarza

7. Mobile app odbiera notification
   → Deep link do transakcji
   → Animacja Dr. Spendera w aplikacji
```

## Przepływ danych — Ręczna Transakcja

```
1. User wypełnia formularz w aplikacji
   → POST /api/transactions

2. Backend: walidacja (zod) → zapis do DB

3. Synchroniczny przepływ:
   → DrSpenderService.generateComment()  (szybki, bez kolejki)
   → Odpowiedź zawiera komentarz

4. Mobile app wyświetla komentarz Dr. Spendera od razu
   → Brak push notificaton (user jest w aplikacji)
```

## Przepływ danych — Tygodniowy Raport

```
Cron job: każdy poniedziałek 8:00
1. StatsService.getWeeklySummary(userId)
2. DrSpenderService.generateWeeklyRoast(summary)
   → Długi prompt, model: claude-opus-4-6
3. Zapis do DrSpenderComment (type: WEEKLY_ROAST)
4. Push notification
```

## Struktura katalogów — szczegółowa

```
spendr/
├── apps/
│   ├── mobile/
│   │   ├── app/                    # Expo Router (file-based routing)
│   │   │   ├── (auth)/
│   │   │   │   ├── login.tsx
│   │   │   │   └── register.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx       # Dashboard
│   │   │   │   ├── stats.tsx       # Statystyki
│   │   │   │   ├── dr-spender.tsx   # Feed komentarzy
│   │   │   │   └── settings.tsx   # Ustawienia
│   │   │   ├── transaction/
│   │   │   │   ├── [id].tsx        # Szczegóły transakcji
│   │   │   │   └── add.tsx         # Dodaj ręcznie
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── dr-spender/
│   │   │   │   ├── Dr. SpenderWidget.tsx
│   │   │   │   ├── Dr. SpenderAvatar.tsx
│   │   │   │   └── CommentBubble.tsx
│   │   │   ├── charts/
│   │   │   │   ├── SpendingLineChart.tsx
│   │   │   │   ├── CategoryPieChart.tsx
│   │   │   │   └── WasteScoreGauge.tsx
│   │   │   ├── transactions/
│   │   │   │   ├── TransactionItem.tsx
│   │   │   │   └── TransactionList.tsx
│   │   │   └── ui/                 # Komponenty bazowe
│   │   ├── store/                  # Zustand slices
│   │   │   ├── transactionsSlice.ts
│   │   │   ├── drSpenderSlice.ts
│   │   │   └── statsSlice.ts
│   │   ├── services/               # API calls
│   │   │   ├── api.ts              # Axios instance
│   │   │   ├── transactions.ts
│   │   │   └── stats.ts
│   │   ├── tasks/                  # Expo background tasks
│   │   │   └── syncTransactions.ts
│   │   └── constants/
│   │       ├── categories.ts
│   │       └── theme.ts
│   │
│   └── backend/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── transactions.ts
│       │   │   ├── stats.ts
│       │   │   └── sync.ts
│       │   ├── services/
│       │   │   ├── TransactionService.ts
│       │   │   ├── DrSpenderService.ts
│       │   │   ├── StatsService.ts
│       │   │   ├── PatternDetectionService.ts
│       │   │   └── NordigenService.ts
│       │   ├── jobs/               # Bull queue jobs
│       │   │   ├── analyzeTransaction.ts
│       │   │   └── weeklyReport.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   └── validate.ts
│       │   ├── lib/
│       │   │   ├── prisma.ts
│       │   │   ├── redis.ts
│       │   │   └── claude.ts
│       │   └── index.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── tests/
│
├── packages/
│   └── shared/
│       ├── types/                  # Współdzielone typy TS
│       │   ├── Transaction.ts
│       │   ├── DrSpenderComment.ts
│       │   └── Stats.ts
│       └── constants/
│           └── categories.ts
│
├── mock-data/
│   ├── scenarios/
│   │   ├── coffee-addict.json
│   │   ├── subscription-zombie.json
│   │   └── impulse-buyer.json
│   └── generators/
│       └── generateTransactions.ts
│
└── docs/
```

## Decyzje architektoniczne

### Dlaczego monorepo?
- Współdzielone typy między mobile i backend (packages/shared)
- Jeden `package.json` dla workspace (npm workspaces lub pnpm)
- Łatwiejsze CI/CD

### Dlaczego Zustand zamiast Redux?
- Mniejszy boilerplate
- TypeScript-friendly
- Wystarczający dla skali tej aplikacji

### Dlaczego Bull + Redis zamiast inline processing?
- Komentarze Dr. Spendera nie muszą być synchroniczne
- Izolacja — błąd w AI nie zatrzymuje zapisu transakcji
- Rate limiting — ograniczenie wywołań Claude API

### Dlaczego Expo Router zamiast React Navigation?
- File-based routing (jak Next.js) — intuicyjny
- Wbudowana obsługa deep links
- Lepsza integracja z resztą ekosystemu Expo

### Offline-first
- Lokalna baza transakcji (MMKV) — podstawowe funkcje bez internetu
- Sync gdy internet wraca
- Komentarze Dr. Spendera cachowane lokalnie

## Security

- JWT tokeny (access: 15min, refresh: 30dni)
- Tokeny bankowe (Nordigen) przechowywane w Expo SecureStore
- Dane finansowe szyfrowane at-rest w PostgreSQL (pg_crypto)
- HTTPS only, HSTS
- Rate limiting na wszystkich endpointach (express-rate-limit)
- Dane do Claude API: TYLKO skategoryzowane liczby, BEZ numerów kont/IBAN
- CORS — tylko whitelisted origins
