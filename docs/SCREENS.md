# Ekrany i UX — Spendr

## Ogólny design system

- **Kolorystyka:** Ciemna (dark mode domyślnie)
  - Background: #0A0A0B (prawie czarne)
  - Surface: #141416
  - Dr. Spender accent: #8B6914 (stara złota sepia)
  - Waste (czerwony): #E53E3E
  - Savings (zielony): #38A169
  - Text primary: #F7F7F7
  - Text secondary: #9B9B9B

- **Typografia:** 
  - Display: Playfair Display (XIX-wieczny klimat dla Dr. Spendera)
  - Body: Inter (czytelny, nowoczesny)

- **Ikonografia:** Linia, minimalistyczne

---

## Ekran 1: Splash / Loading

- Animowane logo Spendr
- Dr. Spender "otwiera oczy" (animacja Lottie)
- Tagline: *"Twoje pieniądze. Twój wstyd."*

---

## Ekran 2: Onboarding (3 slajdy)

**Slajd 1:** Przedstawienie Dr. Spendera
- Ilustracja postaci
- "Poznaj Dr. Spendera. Zna każdą złotówkę którą zmarnowałeś."

**Slajd 2:** Jak działa
- Ikony: transakcje → analiza → komentarz
- "Łączy się z Twoim bankiem. Ocenia Twoje decyzje. Nie ma litości."

**Slajd 3:** Wybór trybu
- Przycisk: "Połącz bank" (Open Banking)
- Przycisk: "Wgraj wyciąg CSV"
- Przycisk (mniejszy): "Wypróbuj w trybie demo"

---

## Ekran 3: Połączenie Banku

- Lista banków z logo (PKO, mBank, ING, Santander, Millennium...)
- Search bar do filtrowania
- Po wyborze → WebView z autoryzacją Nordigen
- Loading z animacją Dr. Spendera czekającego z zegarkiem

---

## Ekran 4: Dashboard (Tab 1)

```
┌──────────────────────────────────┐
│  Marzec 2026              ⚙️    │
├──────────────────────────────────┤
│ ┌────────────────────────────┐  │
│ │  KASJANUSZ WIDGET           │  │
│ │  [Portret]  "Czwarta kawa   │  │
│ │             w tym tygodniu. │  │
│ │             Gratuluję."     │  │
│ │  Nastrój: 😒 Zainteresowany│  │
│ └────────────────────────────┘  │
│                                  │
│  Wydatki tego miesiąca          │
│  ┌──────────┐  ┌──────────────┐ │
│  │ 2,340 PLN│  │  680 PLN     │ │
│  │Wszystkie │  │ Zmarnowane   │ │
│  └──────────┘  └──────────────┘ │
│                                  │
│  [SpendingLineChart]             │
│                                  │
│  Ostatnie transakcje             │
│  ┌────────────────────────────┐ │
│  │ ☕ Starbucks    28.50 PLN  │ │
│  │    "Czwarta kawa..." 💬    │ │
│  ├────────────────────────────┤ │
│  │ 🛒 Biedronka   134.20 PLN │ │
│  │    Spożywcze               │ │
│  ├────────────────────────────┤ │
│  │ 🚗 Bolt         22.00 PLN │ │
│  └────────────────────────────┘ │
│                                  │
│         [+ Dodaj ręcznie]        │
└──────────────────────────────────┘
```

---

## Ekran 5: Statystyki (Tab 2)

```
┌──────────────────────────────────┐
│  Statystyki          Marzec ▼   │
├──────────────────────────────────┤
│                                  │
│         LICZNIK WSTYDU           │
│    ┌─────────────────────┐      │
│    │   [Gauge: 68/100]   │      │
│    │  68% — Katastrofa   │      │
│    └─────────────────────┘      │
│    Zmarnowałeś 680 PLN z 2340   │
│                                  │
│  Mógłbyś za to kupić:           │
│  • 2x bilet do Barcelony        │
│  • 15x obiad dla dwóch          │
│  • 1x ekspres Nespresso         │
│                                  │
│  ──────────────────────────────  │
│  Kategorie                       │
│    [CategoryDonutChart]          │
│                                  │
│  ☕ Kawa       340 PLN   14%    │
│  🍔 Restauracje 210 PLN   9%   │
│  📱 Subskrypcje 130 PLN   5%   │
│                                  │
│  ──────────────────────────────  │
│  Subskrypcje Zombie 👻           │
│  ┌────────────────────────────┐ │
│  │ HBO Max    34.99 PLN/mies  │ │
│  │ Ostatnie logowanie: 47 dni │ │
│  │ Roczny koszt: 420 PLN      │ │
│  └────────────────────────────┘ │
│                                  │
│  ──────────────────────────────  │
│  Wykryte wzorce 🔍               │
│  • Kawa każdego ranka (~28 PLN) │
│  • Piątkowe delivery (~65 PLN)  │
└──────────────────────────────────┘
```

---

## Ekran 6: Dr. Spender Feed (Tab 3)

```
┌──────────────────────────────────┐
│  Dr. Spender                       │
├──────────────────────────────────┤
│  [Duży portret Dr. Spendera]       │
│  Stan: 😤 Rozbawiony             │
│                                  │
│  ──────────────────────────────  │
│  Dziś, 09:23                     │
│  ┌────────────────────────────┐ │
│  │ "Czwarta kawa za zewnątrz  │ │
│  │ w tym tygodniu. W sumie    │ │
│  │ 112 złotych. Za te pieniądze│ │
│  │ mógłbyś kupić ekspres i nie │ │
│  │ widywać mnie przez miesiąc."│ │
│  │                    ↕  🔗  │ │
│  └────────────────────────────┘ │
│                                  │
│  Wczoraj, 23:47                  │
│  ┌────────────────────────────┐ │
│  │ "23 minuty po północy.     │ │
│  │ 89 złotych. Delivery.      │ │
│  │ Dr. Spender notuje."          │ │
│  └────────────────────────────┘ │
│                                  │
│  Poniedziałek — Raport tygodnia  │
│  ┌────────────────────────────┐ │
│  │ 📜 RAPORT TYGODNIOWY        │ │
│  │ "Drogi użytkowniku,        │ │
│  │ minionego tygodnia..."      │ │
│  │          [Czytaj więcej]   │ │
│  └────────────────────────────┘ │
└──────────────────────────────────┘
```

---

## Ekran 7: Szczegóły Transakcji

```
┌──────────────────────────────────┐
│  ←  Transakcja                  │
├──────────────────────────────────┤
│                                  │
│        ☕                        │
│    Starbucks Centrum             │
│    28.50 PLN                     │
│    28 marca 2026, 09:23          │
│                                  │
│  Kategoria: Kawa                 │
│  [Zmień kategorię]               │
│                                  │
│  Waste Score: ██████░░░ 62/100   │
│                                  │
│  ──────────────────────────────  │
│  Dr. Spender mówi:                 │
│  ┌────────────────────────────┐ │
│  │ [Portret]                  │ │
│  │ "Czwarta kawa za zewnątrz  │ │
│  │ w tym tygodniu..."          │ │
│  └────────────────────────────┘ │
│                                  │
│  Kontekst:                       │
│  Kawa w marcu: 340 PLN (12x)    │
│  vs luty: 210 PLN (8x) ↑ 62%   │
│                                  │
│  [Oznacz jako konieczne]         │
└──────────────────────────────────┘
```

---

## Ekran 8: Dodaj transakcję ręcznie

```
┌──────────────────────────────────┐
│  ←  Nowa transakcja             │
├──────────────────────────────────┤
│                                  │
│  Kwota                           │
│  ┌────────────────────────────┐ │
│  │ PLN  [    0.00          ] │ │
│  └────────────────────────────┘ │
│                                  │
│  Kategoria                       │
│  ☕ Kawa  🍔 Jedzenie  🛒 Sklep  │
│  📱 Sub   👗 Ubrania   🚗 Trans  │
│  🎮 Rozr  💊 Zdrowie   ➕ Inne  │
│                                  │
│  Opis (opcjonalny)               │
│  ┌────────────────────────────┐ │
│  │ np. Starbucks              │ │
│  └────────────────────────────┘ │
│                                  │
│  Data                            │
│  [ Dziś, 09:30          ▼ ]    │
│                                  │
│  ┌────────────────────────────┐ │
│  │     Dodaj transakcję       │ │
│  └────────────────────────────┘ │
│                                  │
│  Dr. Spender już czeka...          │
└──────────────────────────────────┘
```

---

## Ekran 9: Ustawienia (Tab 4)

- Konto bankowe (status, odłącz, dodaj nowe)
- Dr. Spender settings:
  - Agresywność (slider: Delikatny ←→ Bezlitosny)
  - Częstotliwość powiadomień
  - Cisza nocna (toggle + godziny)
- Budżet miesięczny
- Import CSV
- Eksport danych
- O aplikacji

---

## Tryb Testowy / Demo — UI

Specjalny banner na górze ekranu:
```
┌────────────────────────────────────┐
│ 🧪 TRYB DEMO — Scenariusz: Kawoś   │
│ [Zmień scenariusz]  [Wyjdź z demo] │
└────────────────────────────────────┘
```

Panel wyboru scenariusza (modal):
- Kawoś (500 PLN na kawę)
- Subskrypcyjny Zombie (8 zombie subskrypcji)
- Nocny Impulsywny (zakupy po północy)
- Weekendowy Szaleniec
- Rozsądny Oszczędzający

Każdy scenariusz ma opis i preview waste score.
