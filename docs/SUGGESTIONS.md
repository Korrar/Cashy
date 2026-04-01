# Suggestions — Spendr

## Czym są Suggestions

Suggestions to drugi głos Dr. Spendera — obok kąśliwego komentarza pojawia się
konkretna, wykonalna propozycja zmiany. Nie ogólniki ("wydawaj mniej") — tylko
precyzyjne alternatywy oparte na rzeczywistych danych użytkownika.

Komentarz uderza. Suggestion pokazuje wyjście.

---

## Kiedy pojawia się Suggestion

Nie po każdej transakcji — tylko gdy dane uzasadniają konkretną propozycję:

| Trigger | Warunek | Przykład |
|---------|---------|---------|
| Wzorzec kawowy | ta sama kategoria COFFEE ≥ 4x w tygodniu | "Kup ekspres" |
| Wzorzec delivery | FOOD_RESTAURANT z dostawą ≥ 3x w tygodniu | "Gotuj to samo w domu" |
| Droga restauracja | jedna transakcja > 150 PLN, ≥ 2x w miesiącu | "Tańsza alternatywa w okolicy" |
| Zombie subskrypcja | SUBSCRIPTION, brak użycia > 30 dni | "Anuluj — tu jak to zrobić" |
| Impulsy nocne | zakup po 23:00, ≥ 3x w miesiącu | "Zasada 24h przed zakupem" |
| Zakupy odzieżowe | CLOTHING ≥ 3x w miesiącu | "Capsule wardrobe zamiast impulsów" |
| Drogie transport | Bolt/Uber > 300 PLN/mies | "Komunikacja miejska, rower, porównanie" |
| Duplikat subskrypcji | dwie subskrypcje tej samej kategorii | "Masz już X, po co Y?" |

---

## Typy Suggestions

### TYPE 1 — Konkretna zamiana (Swap)
Bezpośrednia tańsza alternatywa dla tego co użytkownik kupuje.

```
Transakcja: Starbucks, 28.50 PLN (5. raz w tygodniu)

Suggestion:
  Tytuł:    "Ekspres zamiast Starbucksa"
  Oszczędność: ~280 PLN/miesiąc
  Jak:      "Ekspres kapsułkowy kosztuje 300-400 PLN.
             Zwraca się w 6 tygodniach przy Twoim tempie."
  Dr. Spender: "Mogę ci to policzyć jeszcze raz jeśli
                liczba 280 złotych miesięcznie nie przemawia."
```

### TYPE 2 — Gotowanie zamiast zamawiania (Cook)
Dla wzorców delivery i restauracji — przeliczenie tego samego posiłku zrobionego w domu.

```
Transakcja: Pyszne.pl, 65 PLN (pad thai, 3. raz w tygodniu)

Suggestion:
  Tytuł:    "Pad thai w domu: 14 PLN"
  Oszczędność: ~600 PLN/miesiąc
  Jak:      "Makaron ryżowy, warzywa, sos — składniki na 4 porcje
             kosztują tyle co jedno zamówienie."
  Dr. Spender: "Wiem że nie gotujesz. Ale mogłbyś zacząć
                za jedyne 14 złotych."
```

### TYPE 3 — Anuluj subskrypcję (Cancel)
Dla zombie subskrypcji — bezpośredni link lub instrukcja anulowania.

```
Transakcja: Canal+, 42 PLN (brak użycia od 63 dni)

Suggestion:
  Tytuł:    "Anuluj Canal+ — odzyskaj 504 PLN rocznie"
  Oszczędność: 504 PLN/rok
  Jak:      "Ustawienia → Subskrypcje → Anuluj plan.
             Dostęp masz do końca okresu rozliczeniowego."
  Dr. Spender: "63 dni ciszy. Kanały telewizyjne
                czekają na Ciebie jak porzucone dzieci."
```

### TYPE 4 — Zasada behawioralna (Rule)
Dla wzorców impulsywnych — propozycja prostej reguły.

```
Wzorzec: 4 zakupy online po 23:00 w tym miesiącu, łącznie 890 PLN

Suggestion:
  Tytuł:    "Zasada 24h"
  Oszczędność: szacunkowo ~600 PLN/miesiąc
  Jak:      "Dodaj do koszyka. Zamknij. Wróć jutro.
             80% nocnych impulsów nie przeżywa poranka."
  Dr. Spender: "O 23:47 wszystko wydaje się konieczne.
                O 8:00 rano już niekoniecznie."
```

### TYPE 5 — Tańsza alternatywa w tej samej kategorii (Downgrade)
Gdy użytkownik regularnie wybiera droższy wariant.

```
Wzorzec: Bolt/Uber, średnio 340 PLN/miesiąc, trasy < 5 km

Suggestion:
  Tytuł:    "Rower lub komunikacja: ~40 PLN/miesiąc"
  Oszczędność: ~300 PLN/miesiąc
  Jak:      "Trasy poniżej 5 km to 15-20 min rowerem.
             Miejski rower: 10 zł/miesiąc abonament."
  Dr. Spender: "300 złotych miesięcznie za przejazdy
                których długość zmierzysz krokomierzem."
```

### TYPE 6 — Duplikat (Duplicate)
Gdy użytkownik płaci za dwa serwisy tej samej kategorii.

```
Wzorzec: Netflix (49.99) + HBO Max (29.99) aktywne jednocześnie

Suggestion:
  Tytuł:    "Płacisz dwa razy za filmy"
  Oszczędność: 360 PLN/rok (jeśli anuluje HBO Max)
  Jak:      "Netflix i HBO Max pokrywają się w 70% treści.
             Wybierz jeden, zrezygnuj z drugiego."
  Dr. Spender: "Dwa serwisy streamingowe, 24 godziny
                doby. Coś tu nie gra matematycznie."
```

---

## Struktura danych Suggestion

```typescript
interface Suggestion {
  id: string;
  userId: string;
  type: SuggestionType;          // SWAP | COOK | CANCEL | RULE | DOWNGRADE | DUPLICATE
  status: SuggestionStatus;      // ACTIVE | DISMISSED | ACCEPTED | EXPIRED

  // Powiązanie z danymi
  relatedTransactionIds: string[];
  relatedPattern?: PatternType;
  category: Category;

  // Treść
  title: string;                 // krótki nagłówek
  monthlySavings: number;        // szacowana oszczędność PLN/miesiąc
  annualSavings: number;         // monthlySavings * 12
  howTo: string;                 // konkretne kroki
  drSpenderQuip: string;         // komentarz Dr. Spendera do sugestii

  // Przelicznik "co mógłbyś kupić"
  equivalent?: WasteEquivalent;  // "Za roczną oszczędność mógłbyś kupić..."

  // Akcja
  actionLabel?: string;          // np. "Anuluj subskrypcję"
  actionUrl?: string;            // np. link do ustawień Canal+

  createdAt: DateTime;
  expiresAt?: DateTime;          // sugestia wygasa jeśli wzorzec zanikł
}

enum SuggestionType {
  SWAP       = 'SWAP',
  COOK       = 'COOK',
  CANCEL     = 'CANCEL',
  RULE       = 'RULE',
  DOWNGRADE  = 'DOWNGRADE',
  DUPLICATE  = 'DUPLICATE',
}

enum SuggestionStatus {
  ACTIVE    = 'ACTIVE',
  DISMISSED = 'DISMISSED',   // user odrzucił
  ACCEPTED  = 'ACCEPTED',    // user kliknął "Spróbuję"
  EXPIRED   = 'EXPIRED',     // wzorzec zanikł sam
}
```

---

## Jak Suggestion jest generowana

```
1. PatternDetectionService wykrywa wzorzec
   (lub transakcja przekracza próg waste score)

2. SuggestionService.generate(pattern, history)
   → wybór TYPE na podstawie wzorca
   → obliczenie monthlySavings z rzeczywistych danych
   → wybór howTo z predefiniowanych szablonów
   → wywołanie Claude API dla drSpenderQuip

3. Zapis do DB — jedna aktywna sugestia per wzorzec

4. Wyświetlenie w aplikacji:
   → card pod transakcją (jeśli powiązana)
   → sekcja "Suggestions" w Stats tab
   → push notification raz w tygodniu dla nieodrzuconych
```

---

## UI — jak wygląda Suggestion

### Card pod transakcją
```
┌─────────────────────────────────────┐
│ 💡 Dr. Spender proponuje            │
│                                     │
│ Ekspres zamiast Starbucksa          │
│ Oszczędność: ~280 PLN/mies          │
│                                     │
│ "Mogę ci to policzyć jeszcze raz   │
│  jeśli 280 PLN nie przemawia."      │
│                                     │
│ [Dowiedz się więcej]  [Odrzuć]     │
└─────────────────────────────────────┘
```

### Ekran Suggestions (w zakładce Stats)
```
┌─────────────────────────────────────┐
│ Propozycje Dr. Spendera             │
│ Łączna możliwa oszczędność:         │
│ 1 240 PLN / miesiąc                 │
├─────────────────────────────────────┤
│ ☕ Ekspres zamiast Starbucksa       │
│    280 PLN/mies · SWAP              │
│    ████████████░░░░ (potencjał)     │
├─────────────────────────────────────┤
│ 📺 Anuluj Canal+ (63 dni nieużyw.) │
│    42 PLN/mies · CANCEL             │
│    [Jak anulować →]                 │
├─────────────────────────────────────┤
│ 🌙 Zasada 24h dla nocnych zakupów  │
│    ~600 PLN/mies · RULE             │
│    "80% impulsów nie przeżywa       │
│     poranka."                       │
└─────────────────────────────────────┘
```

### Szczegóły Suggestion (po kliknięciu)
```
┌─────────────────────────────────────┐
│ ← Ekspres zamiast Starbucksa        │
├─────────────────────────────────────┤
│ Twoje dane:                         │
│  Starbucks w marcu: 12x, 342 PLN   │
│  Średnio: 28.50 PLN / kawa          │
│                                     │
│ Alternatywa:                        │
│  Ekspres kapsułkowy: 350 PLN        │
│  Kapsułka: ~1.50 PLN               │
│  Zwrot inwestycji: 6 tygodni        │
│                                     │
│ Roczna oszczędność: 3 360 PLN      │
│ Za to mógłbyś:                      │
│  ✈️ Polecieć do Lizbony i z powrotem│
│                                     │
│ Dr. Spender:                        │
│ "Liczę to już trzeci miesiąc.       │
│  Ekspres nadal kosztuje 350 złotych.│
│  Starbucks nadal kosztuje 28.50.    │
│  Matematyka się nie zmieniła."      │
│                                     │
│ [✓ Spróbuję]        [Odrzuć]       │
└─────────────────────────────────────┘
```

---

## Tracking skuteczności

Gdy user kliknie "Spróbuję" → śledzimy czy wzorzec zanikł:

```typescript
interface SuggestionOutcome {
  suggestionId: string;
  accepted: boolean;
  patternChangeAfter30Days: number;  // % zmiana w kategorii po 30 dniach
  moneySavedActual: number;          // rzeczywista oszczędność vs poprzedni miesiąc
}
```

Jeśli wzorzec zanikł po akceptacji → Dr. Spender reaguje:
> "Miesiąc bez Starbucksa. Zaoszczędziłeś 280 złotych.
>  Kasjanusz odnotowuje to z niedowierzaniem w kronikach."

Jeśli wzorzec nie zanikł mimo akceptacji → Dr. Spender też reaguje:
> "Miesiąc temu kliknąłeś 'Spróbuję'. Dziś znów Starbucks.
>  Przynajmniej jesteś konsekwentny."
