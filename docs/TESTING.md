# Strategia Testowania — Cashy

## Piramida testów

```
        ┌───────┐
        │  E2E  │  ← Detox (5-10 scenariuszy)
       ┌┴───────┴┐
      │Integration│ ← Supertest (API endpoints)
     ┌┴───────────┴┐
    │  Unit Tests   │ ← Jest (logika biznesowa)
   └───────────────┘
```

## Unit Testy — Jest + ts-jest

### Co testujemy unitowo:

**Backend:**
- `TransactionService.categorize()` — kategoryzacja transakcji
- `StatsService.calculateWasteScore()` — algorytm waste score
- `PatternDetectionService.detect()` — wykrywanie wzorców
- `KasjanuszService.buildContext()` — budowanie kontekstu dla AI
- Utility functions (formatowanie kwot, dat)
- Walidatory Zod

**Mobile:**
- Zustand store reducers
- Utility functions (formatNumbers, formatDates)
- Kategoryzacja po stronie klienta

### Przykład testu waste score:
```typescript
// backend/tests/unit/StatsService.test.ts
describe('StatsService.calculateWasteScore', () => {
  it('should return high score for repeated coffee purchases', () => {
    const transaction = {
      category: 'COFFEE',
      amount: 28,
      date: new Date(),
    };
    const history = {
      categoryThisMonth: 140,  // 5 kawek już
      transactionCount: 5,
    };
    
    const score = StatsService.calculateWasteScore(transaction, history);
    expect(score).toBeGreaterThan(60);
  });

  it('should return low score for grocery shopping', () => {
    const transaction = {
      category: 'FOOD_GROCERY',
      amount: 200,
      date: new Date(),
    };
    const score = StatsService.calculateWasteScore(transaction, {
      categoryThisMonth: 400,
      transactionCount: 2,
    });
    
    expect(score).toBeLessThan(20);
  });

  it('should penalize night purchases (after 23:00)', () => {
    const nightDate = new Date();
    nightDate.setHours(23, 30, 0, 0);
    
    const scoreDay = StatsService.calculateWasteScore(
      { category: 'FOOD_RESTAURANT', amount: 80, date: new Date() },
      { categoryThisMonth: 80, transactionCount: 1 }
    );
    const scoreNight = StatsService.calculateWasteScore(
      { category: 'FOOD_RESTAURANT', amount: 80, date: nightDate },
      { categoryThisMonth: 80, transactionCount: 1 }
    );
    
    expect(scoreNight).toBeGreaterThan(scoreDay);
  });
});
```

### Przykład testu kategoryzacji:
```typescript
describe('TransactionService.categorize', () => {
  const cases = [
    { merchant: 'Starbucks', expected: 'COFFEE' },
    { merchant: 'Costa Coffee', expected: 'COFFEE' },
    { merchant: 'McDonald\'s', expected: 'FOOD_RESTAURANT' },
    { merchant: 'Biedronka', expected: 'FOOD_GROCERY' },
    { merchant: 'Uber', expected: 'TRANSPORT' },
    { merchant: 'Netflix', expected: 'SUBSCRIPTION' },
    { merchant: 'Spotify', expected: 'SUBSCRIPTION' },
    { merchant: 'Zalando', expected: 'CLOTHING' },
  ];

  test.each(cases)('categorizes $merchant as $expected', ({ merchant, expected }) => {
    expect(TransactionService.categorize(merchant, 0)).toBe(expected);
  });
});
```

## Integration Testy — Supertest

### Co testujemy:
- Wszystkie API endpoints (happy path + error cases)
- Autoryzacja JWT
- Walidacja danych wejściowych
- Odpowiedzi z mockowanym Claude API i Nordigen API

```typescript
// backend/tests/integration/transactions.test.ts
describe('POST /api/transactions', () => {
  it('should create transaction and return Kasjanusz comment', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        amount: 28.50,
        currency: 'PLN',
        category: 'COFFEE',
        merchant: 'Starbucks',
        date: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.transaction.id).toBeDefined();
    expect(res.body.kasjanuszComment).toBeDefined();
    expect(res.body.kasjanuszComment.content).toBeTruthy();
  });

  it('should reject transaction without auth', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({ amount: 50 });

    expect(res.status).toBe(401);
  });
});
```

### Mockowanie zewnętrznych API:
```typescript
// Mockowanie Claude API w testach
jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          text: 'Testowy komentarz Kasjanusza dla testów.'
        }]
      })
    }
  }))
}));

// Mockowanie Nordigen API
jest.mock('../services/NordigenService', () => ({
  getTransactions: jest.fn().mockResolvedValue(
    require('../../mock-data/scenarios/coffee-addict.json')
  )
}));
```

## E2E Testy — Detox

### Scenariusze E2E:

**Scenariusz 1: Onboarding i pierwsza transakcja**
```
1. Uruchom aplikację
2. Zarejestruj konto
3. Wybierz "Tryb testowy" (mock data)
4. Dodaj ręczną transakcję: Starbucks, 28 PLN
5. Oczekuj: pojawia się komentarz Kasjanusza
6. Oczekuj: waste score > 0
```

**Scenariusz 2: Import CSV**
```
1. Zaloguj
2. Idź do Ustawień → Dodaj konto → Import CSV
3. Wgraj mock CSV z 10 transakcjami
4. Oczekuj: 10 transakcji w liście
5. Oczekuj: statystyki zaktualizowane
6. Oczekuj: przynajmniej jeden komentarz Kasjanusza
```

**Scenariusz 3: Statystyki — waste score**
```
1. Zaloguj z danymi scenariusza "coffee-addict"
2. Przejdź do zakładki Stats
3. Oczekuj: waste score > 50 (dużo zmarnowanej kawy)
4. Sprawdź wykres kategorii
5. Oczekuj: kategoria COFFEE dominuje
```

## Mock Data — Tryb Testowy

### Plik: mock-data/scenarios/coffee-addict.json
```json
{
  "scenario": "coffee-addict",
  "description": "Użytkownik który wydaje ~500 PLN/mies na kawę i fast food",
  "transactions": [
    {
      "id": "mock-1",
      "amount": 28.50,
      "currency": "PLN",
      "category": "COFFEE",
      "merchant": "Starbucks Centrum",
      "date": "2026-03-28T08:15:00Z"
    },
    {
      "id": "mock-2",
      "amount": 28.50,
      "currency": "PLN",
      "category": "COFFEE",
      "merchant": "Starbucks Galeria",
      "date": "2026-03-27T09:30:00Z"
    }
    // ... więcej transakcji
  ],
  "expectedWasteScore": 72,
  "expectedKasjanuszMood": "amused"
}
```

### Dostępne scenariusze:
| Plik | Opis | Oczekiwany WS |
|------|------|----------------|
| `coffee-addict.json` | 500 PLN/mies na kawę | 70-80 |
| `subscription-zombie.json` | 15 subskrypcji, 8 nieużywanych | 75-85 |
| `impulse-buyer.json` | Losowe duże zakupy w nocy | 65-75 |
| `weekend-maniac.json` | Spokojny tydzień, szaleństwo w weekend | 50-60 |
| `reasonable-saver.json` | Rozsądne wydatki | 10-20 |

## Uruchamianie testów

```bash
# Backend — unit testy
cd apps/backend && npm test

# Backend — testy z coverage
cd apps/backend && npm run test:coverage

# Backend — integration testy
cd apps/backend && npm run test:integration

# Mobile — unit testy
cd apps/mobile && npm test

# E2E — Detox (wymaga emulatora)
cd apps/mobile && npx detox test --configuration android.emu.debug

# Wszystkie testy (z root)
npm test
```

## Coverage wymagania

- Unit testy: minimum 80% coverage dla services/
- Integration: wszystkie endpoints przetestowane
- E2E: minimum 5 krytycznych user flows

## CI/CD

```yaml
# .github/workflows/test.yml (gdy będziemy mieć GitHub Actions)
on: [push, pull_request]
jobs:
  test:
    steps:
      - npm ci
      - npm run test:unit
      - npm run test:integration
      - npm run build  # sprawdź że TypeScript się kompiluje
```
