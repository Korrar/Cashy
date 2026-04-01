# Integracje zewnętrzne — Spendr

## 1. Open Banking — Nordigen (GoCardless Bank Account Data)

### Dlaczego Nordigen
- Pokrywa polskie banki w ramach PSD2
- Darmowy tier: 50 requisitions/dzień (wystarczy na MVP)
- Nie trzeba rejestrować własnej licencji TPP w KNF — Nordigen już to zrobił
- REST API z dobrą dokumentacją
- Oficjalne SDK: Python i Node.js

### Wspierane polskie banki
| Bank | Institution ID |
|------|----------------|
| PKO Bank Polski | `PKO_BPKOPLPW` |
| mBank | `MBANK_BREXPLPW` |
| ING Bank Śląski | `ING_INGBPLPW` |
| Santander Polska | `SANTANDER_WBKPPLPP` |
| Bank Millennium | `MILLENNIUM_BIGBPLPW` |
| Alior Bank | `ALIOR_ALBPPLPW` |
| BNP Paribas | `BNP_PPABPLPK` |
| Pekao SA | `PEKAO_PKOPPLPW` |

### Flow integracji krok po kroku

```
Krok 1: Utwórz konto na https://ob.nordigen.com/
Krok 2: Pobierz Secret ID i Secret Key z dashboardu
Krok 3: Zdobądź access token

POST https://ob.nordigen.com/api/v2/token/new/
{
  "secret_id": "...",
  "secret_key": "..."
}
→ { "access": "eyJ...", "refresh": "eyJ..." }

Krok 4: Lista dostępnych banków w Polsce
GET https://ob.nordigen.com/api/v2/institutions/?country=PL

Krok 5: Utwórz Requisition (żądanie dostępu do konta)
POST https://ob.nordigen.com/api/v2/requisitions/
{
  "redirect": "spendr://bank-callback",
  "institution_id": "PKO_BPKOPLPW",
  "reference": "user-{userId}",
  "user_language": "PL"
}
→ { "id": "req-xxx", "link": "https://ob.nordigen.com/ob/start/..." }

Krok 6: Użytkownik otwiera link (WebView lub external browser)
→ Loguje się do banku
→ Akceptuje dostęp do historii transakcji

Krok 7: Redirect wraca do aplikacji (spendr://bank-callback?ref=req-xxx)

Krok 8: Pobierz konta
GET https://ob.nordigen.com/api/v2/requisitions/{requisition_id}/
→ { "accounts": ["account-id-1", "account-id-2"] }

Krok 9: Pobierz transakcje
GET https://ob.nordigen.com/api/v2/accounts/{account_id}/transactions/
→ { "transactions": { "booked": [...], "pending": [...] } }
```

### Struktura transakcji z Nordigen
```typescript
interface NordigenTransaction {
  transactionId: string;
  bookingDate: string;           // "2026-03-28"
  valueDate: string;
  transactionAmount: {
    amount: string;              // "28.50"
    currency: string;            // "PLN"
  };
  creditorName?: string;         // "STARBUCKS WARSZAWA"
  debtorName?: string;
  remittanceInformationUnstructured?: string; // opis z banku
  bankTransactionCode?: string;
}
```

### Limity i ograniczenia
- Token dostępu wygasa po 90 dniach (użytkownik musi ponownie autoryzować)
- Historia transakcji: zazwyczaj 90 dni wstecz
- Rate limit: 10 req/s per token

---

## 2. Claude API — Anthropic

### Konfiguracja
```typescript
// packages/ai/src/claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### Model wyboru
| Użycie | Model | Powód |
|--------|-------|-------|
| Komentarz po transakcji | `claude-sonnet-4-6` | Szybki, tani, wystarczająco dobry |
| Tygodniowy raport | `claude-opus-4-6` | Dłuższy, bardziej dramatyczny monolog |
| Kategoryzacja | Bez AI (regex) | Szybkość, koszt, deterministyczność |

### Prompt Caching (oszczędność kosztów)
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 300,
  system: [
    {
      type: 'text',
      text: KASJANUSZ_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' }  // cache systemu prompt
    }
  ],
  messages: [{
    role: 'user',
    content: buildUserPrompt(context)
  }]
});
```

### Szacowane koszty
- Komentarz po transakcji: ~100 tokenów output → ~$0.001 per komentarz
- Tygodniowy raport: ~500 tokenów → ~$0.005
- Przy 100 aktywnych użytkownikach z 5 transakcji/dzień: ~$15/miesiąc na AI

### Rate limiting
- Przechowuj w Redis timestamp ostatniego komentarza na użytkownika
- Nie generuj więcej niż 1 komentarz per 5 minut per user
- Kolejkuj przez Bull zamiast wywoływać synchronicznie

---

## 3. Expo Push Notifications

### Setup
```typescript
// mobile: rejestracja push token
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications(): Promise<string | null> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;
  
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });
  
  // Wyślij token do backendu
  await api.post('/api/users/push-token', { token: token.data });
  return token.data;
}
```

### Wysyłanie z backendu
```typescript
// Expo Push API
const message = {
  to: user.pushToken,
  sound: 'default',
  title: 'Dr. Spender ma coś do powiedzenia',
  body: comment.content.slice(0, 100) + '...',
  data: {
    type: 'TRANSACTION_COMMENT',
    transactionId: transaction.id,
    commentId: comment.id,
  },
};

await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(message),
});
```

---

## 4. Background Sync — Expo TaskManager

```typescript
// mobile/tasks/syncTransactions.ts
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const SYNC_TASK = 'SYNC_TRANSACTIONS';

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    await apiSyncTransactions();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Rejestracja przy starcie aplikacji
await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
  minimumInterval: 15 * 60,  // co 15 minut
  stopOnTerminate: false,
  startOnBoot: true,
});
```

**Ograniczenia platformowe:**
- iOS: system decyduje o częstotliwości (zazwyczaj kilka razy dziennie)
- Android: bardziej przewidywalny, ale wymaga battery optimization whitelist
- Workaround: serwer wysyła push notification żeby wyzwolić sync

---

## 5. Import CSV — Polskie Banki

### Obsługiwane formaty:

**PKO BP (CSV)**
```
"Data operacji";"Data waluty";"Typ transakcji";"Kwota";"Waluta";"Saldo po transakcji";"Opis transakcji"
"2026-03-28";"2026-03-28";"Zakup przy użyciu karty";">-28,50";"PLN";"1234,56";"STARBUCKS WARSZAWA"
```

**mBank (CSV)**
```
#Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;#Saldo po operacji
2026-03-28;STARBUCKS WARSZAWA;eKonto;Restauracje;-28,50 PLN;1 234,56 PLN
```

**ING (CSV)**
```
"Data transakcji";"Data księgowania";"Dane kontrahenta";"Tytuł";"Nr rachunku";"Nazwa banku";"Szczegóły";"Kwota transakcji (waluta rachunku)";"Waluta"
"2026-03-28";"2026-03-28";"STARBUCKS";"Płatność kartą";"";"";"";"-28,50";"PLN"
```

### Parser w backendzie
```typescript
class CSVParser {
  static detect(content: string): BankFormat {
    if (content.includes('"Data operacji";"Data waluty"')) return 'PKO';
    if (content.includes('#Data operacji;#Opis operacji')) return 'MBANK';
    if (content.includes('"Data transakcji";"Data księgowania"')) return 'ING';
    return 'UNKNOWN';
  }

  static parse(content: string, format: BankFormat): ParsedTransaction[] {
    // każdy bank ma swój mapper
  }
}
```

---

## 6. Potencjalne przyszłe integracje (V2/V3)

| Integracja | Cel | Trudność |
|------------|-----|----------|
| **Google Vision API** | OCR paragonów | Średnia |
| **Open Exchange Rates** | Kursy walut (wydatki za granicą) | Łatwa |
| **GUS API** | Benchmarki wydatków vs statystyki krajowe | Łatwa |
| **Ceneo/Allegro** | "Tu kupiłbyś taniej" | Trudna |
| **Apple HealthKit** | Korelacja wydatków z nastrojem/snem | Średnia |
