# Stack Technologiczny — Cashy

## Mobile App — React Native + Expo

**Dlaczego Expo zamiast bare React Native?**
- EAS Build — budowanie .apk/.ipa bez Mac'a
- Expo Notifications — push notyfikacje out-of-the-box
- Expo SecureStore — bezpieczne przechowywanie tokenów bankowych
- Over-the-air updates (bez review App Store dla małych zmian)
- Szybszy development cycle

**Kluczowe paczki mobilne:**
```
expo@51
expo-notifications        # Push notifications (Kasjanusz przerywa Twój dzień)
expo-secure-store         # Tokeny OAuth banku
expo-background-fetch     # Odpytywanie transakcji w tle
expo-task-manager         # Zarządzanie taskami w tle
@react-navigation/native  # Nawigacja
zustand                   # State management (lekki, bez boilerplate)
react-native-mmkv         # Szybki lokalny storage (szybszy od AsyncStorage)
react-native-reanimated   # Animacje (Kasjanusz "wchodzi" animowany)
react-native-skia         # Wykresy i custom graphics
victory-native            # Wykresy finansowe (linia, pie, bar)
axios                     # HTTP client
react-hook-form + zod     # Formularze + walidacja
date-fns                  # Operacje na datach
```

## Backend — Node.js + Express + TypeScript

**Dlaczego Node.js?**
- Spójny ekosystem z frontendem (TypeScript, typy współdzielone)
- Szybki I/O — obsługa webhooków bankowych w czasie rzeczywistym
- Bogaty ekosystem do integracji finansowych

**Kluczowe paczki backendowe:**
```
express@4                 # HTTP server
typescript@5              # Strict mode
prisma@5                  # ORM (PostgreSQL)
redis@4                   # Cache + kolejka zadań
bull                      # Job queue (przetwarzanie transakcji async)
@anthropic-ai/sdk         # Claude API
jsonwebtoken              # JWT auth
bcryptjs                  # Hashowanie haseł
zod                       # Walidacja danych wejściowych
winston                   # Logowanie
helmet                    # Security headers
cors                      # CORS
dotenv                    # Zmienne środowiskowe
```

## Baza danych — PostgreSQL + Prisma

**Schema (uproszczona):**
```prisma
model User {
  id            String        @id @default(uuid())
  email         String        @unique
  createdAt     DateTime      @default(now())
  transactions  Transaction[]
  bankAccounts  BankAccount[]
  settings      UserSettings?
}

model Transaction {
  id            String    @id @default(uuid())
  userId        String
  amount        Float
  currency      String    @default("PLN")
  category      Category
  subcategory   String?
  merchant      String?
  description   String?
  date          DateTime
  isWasted      Boolean   @default(false)
  wasteScore    Float?    // 0-100, ile "zmarnowane"
  source        TransactionSource  // BANK_API | CSV | MANUAL
  rawData       Json?     // oryginalne dane z banku
  createdAt     DateTime  @default(now())
  
  user          User      @relation(fields: [userId], references: [id])
  comments      KasjanuszComment[]
}

model KasjanuszComment {
  id            String      @id @default(uuid())
  transactionId String?
  userId        String
  content       String      // Tekst komentarza
  type          CommentType // TRANSACTION | WEEKLY_SUMMARY | PATTERN_DETECTED
  wasRead       Boolean     @default(false)
  createdAt     DateTime    @default(now())
}

model BankAccount {
  id              String    @id @default(uuid())
  userId          String
  nordigenId      String    @unique
  institutionId   String    // np. "PKO_BPKOPLPW"
  iban            String?
  name            String
  currency        String
  lastSynced      DateTime?
  isActive        Boolean   @default(true)
}

enum Category {
  FOOD_RESTAURANT
  FOOD_GROCERY
  COFFEE
  ALCOHOL
  TRANSPORT
  SUBSCRIPTION
  ENTERTAINMENT
  CLOTHING
  ELECTRONICS
  HEALTH
  SPORT
  TRAVEL
  OTHER
}

enum TransactionSource {
  BANK_API
  CSV_IMPORT
  MANUAL
}
```

**Redis — do czego:**
- Cache ostatnich transakcji (szybki dostęp w tle)
- Rate limiting zapytań do Claude API
- Sesje użytkowników
- Job queue dla Bull

## AI — Claude API

**Model:** `claude-sonnet-4-6`
- Dobry balans ceny/jakości dla częstych komentarzy
- Dla tygodniowych podsumowań można użyć `claude-opus-4-6`

**Podejście do promptów:**
- System prompt z osobowością Kasjanusza (statyczny, cachowany)
- User prompt zawiera: kategorię, kwotę, historię kategorii z ostatnich 30 dni, wzorce
- NIE wysyłamy surowych danych bankowych (numerów kont, IBAN) do API
- Dane są agregowane i anonimizowane przed wysłaniem

**Prompt caching** — Anthropic wspiera cache dla długich system promptów → tańsze i szybsze.

## Open Banking — Nordigen (GoCardless Bank Account Data)

**Dlaczego Nordigen?**
- Darmowy tier: do 50 requisitions/dzień
- Pokrywa polskie banki: PKO BP, mBank, ING, Santander, Millennium, Alior, BNP Paribas
- PSD2 compliant — legalny dostęp do danych konta
- Nie wymaga rejestracji TPP w KNF (Nordigen jest już zarejestrowany)
- REST API, dobra dokumentacja

**Flow integracji:**
```
1. User wybiera bank w aplikacji
2. Backend tworzy Nordigen Requisition
3. User przechodzi przez bank login (redirect/webview)
4. Nordigen zwraca access token dla konta
5. Backend odpytuje /transactions co X minut (background fetch)
6. Nowe transakcje → analiza → komentarz Kasjanusza
```

**Fallback gdy brak Open Banking:**
- Import pliku CSV/PDF z wyciągiem bankowym
- OCR paragonów (expo-camera + backend OCR)
- Ręczne dodawanie transakcji

## Push Notifications — Expo + FCM

```
Expo Push Service → FCM (Android) / APNs (iOS) → Urządzenie
```

**Typy notyfikacji:**
- `TRANSACTION_COMMENT` — po każdej transakcji
- `WEEKLY_ROAST` — tygodniowe podsumowanie od Kasjanusza
- `PATTERN_ALERT` — wykryto wzorzec marnowania
- `ZOMBIE_SUBSCRIPTION` — subskrypcja której nie używasz

## Testing

Szczegóły w `docs/TESTING.md`

- **Unit**: Jest + ts-jest
- **Integration**: Supertest (API endpoints)
- **Mobile**: React Native Testing Library
- **E2E**: Detox
- **Mock data**: pełny zestaw scenariuszy w `mock-data/`

## Hosting (produkcja)

| Serwis | Co | Koszt |
|--------|-----|-------|
| Railway lub Render | Backend Node.js | ~$5-10/mies |
| Supabase | PostgreSQL | darmowy tier |
| Upstash | Redis | darmowy tier |
| Expo EAS | Buildy mobilne | darmowy tier |
| Cloudflare | CDN + ochrona | darmowy tier |

## Zmienne środowiskowe

```env
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ANTHROPIC_API_KEY=sk-ant-...
NORDIGEN_SECRET_ID=...
NORDIGEN_SECRET_KEY=...
JWT_SECRET=...
PORT=3000

# Mobile (w Expo config)
EXPO_PUBLIC_API_URL=https://api.cashy.app
EXPO_PUBLIC_ENVIRONMENT=development
```
