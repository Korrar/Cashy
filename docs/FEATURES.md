# Funkcjonalności — Cashy

## F1 — Onboarding

### F1.1 — Rejestracja/Logowanie
- Email + hasło (JWT)
- Opcjonalnie: Google OAuth
- Wprowadzenie postaci Kasjanusza — krótka animowana scena

### F1.2 — Podłączenie konta bankowego
Trzy ścieżki:
1. **Open Banking** (rekomendowane) — wybór banku z listy, redirect do autoryzacji
2. **Import CSV** — wgranie wyciągu z banku
3. **Tryb manualny** — ręczne dodawanie transakcji
4. **Tryb demo/testowy** — mockowane dane, bez prawdziwego konta

### F1.3 — Konfiguracja profilu wydatków
- Miesięczny budżet (opcjonalne)
- Kategorie które użytkownik chce śledzić
- Agresywność komentarzy Kasjanusza (Skala: "Delikatny" → "Bezlitosny")

---

## F2 — Dashboard Główny

### F2.1 — Podsumowanie miesiąca
- Łączne wydatki vs poprzedni miesiąc
- Kwota "zmarnowana" (kategorie uznane za zbędne)
- Top 3 kategorie wydatków
- "Mógłbyś za to kupić..." — przelicznik na coś konkretnego

### F2.2 — Feed transakcji
- Lista ostatnich transakcji
- Przy każdej: kategoria, kwota, ikona, komentarz Kasjanusza (jeśli był)
- Swipe aby ręcznie oznaczyć jako "zmarnowane" / "konieczne"

### F2.3 — Widget Kasjanusza
- Portret postaci (animated)
- Ostatni komentarz
- "Nastrój" Kasjanusza — zależy od kondycji finansów w tym miesiącu

---

## F3 — Statystyki i Analizy

### F3.1 — Wykres wydatków w czasie
- Linia: dzienne/tygodniowe/miesięczne wydatki
- Zaznaczenie "anomalii" — dni z ponadnormalnymi wydatkami
- Porównanie: ten miesiąc vs poprzedni

### F3.2 — Wykres kategorii (Pie/Donut)
- Podział wydatków na kategorie
- Wyróżnienie kategorii "zmarnowanych" (czerwony)
- Drill-down do konkretnych transakcji w kategorii

### F3.3 — "Licznik Wstydu" — Waste Score
Kluczowa funkcja. Każda transakcja dostaje `wasteScore` (0-100):

```
Algorytm wasteScore:
- Kategoria (kawa, fast-food, alkohol = wysoki score)
- Częstotliwość (ta sama kategoria 4x w tygodniu = +20)
- Kwota vs mediana (2x powyżej mediany dla kategorii = +15)
- Subskrypcje nieużywane (wykryto brak aktywności = +50)
- Impulsy nocne (transakcja między 23:00-2:00 = +10)
```

Wyświetlanie:
- Łączny "Waste Score" miesiąca jako procent budżetu
- Animowany licznik (jak licznik długu narodowego)
- Kolor: zielony → żółty → czerwony → "Kasjanusz płacze"

### F3.4 — "Co mógłbyś za to kupić"
Przelicznik zmarnowanych pieniędzy na konkretne rzeczy:
- "Za 340 zł zmarnowane na kawę mógłbyś kupić ekspres Nespresso"
- "Za 1200 zł na fast-food mógłbyś polecieć do Barcelony i z powrotem"
- "Za 89 zł na subskrypcje których nie używasz mógłbyś... po prostu je anulować"

### F3.5 — Subskrypcje Zombie
Dedykowana sekcja:
- Lista wykrytych subskrypcji cyklicznych
- Szacowana aktywność (na podstawie wzorców)
- Łączny koszt roczny
- Kasjanusz komentuje każdą z osobna

### F3.6 — Wzorce i Trendy
- Wykryte wzorce: "Każdy piątek = jedzenie na wynos"
- "Wakacyjny szał zakupów" (wzrost wydatków w lipcu/sierpniu)
- Porównanie do poprzednich okresów
- Prognoza: "Jeśli tak dalej pójdzie, w grudniu wydasz X"

### F3.7 — Tygodniowy Raport Wstydu
Wysyłany w poniedziałek rano:
- Podsumowanie tygodnia przez Kasjanusza (długi, dramatyczny monolog)
- Top 3 "najgłupsze" wydatki tygodnia
- Jeden "pochwalny" punkt jeśli użytkownik zaoszczędził gdzieś

---

## F4 — Komentarze Kasjanusza

### F4.1 — Komentarz po transakcji
Trigger: nowa transakcja z Open Banking lub ręczna
- Push notification z komentarzem
- W aplikacji: animacja Kasjanusza + tekst
- Generowany przez Claude API na podstawie kontekstu

### F4.2 — Komentarz przy wzorcu
Trigger: wykrycie wzorca (Bull job, co godzinę)
- "Zauważyłem że każda niedziela to dla Ciebie dzień zakupów..."
- "To już trzecia restauracja w tym tygodniu..."

### F4.3 — Kontekstowe komentarze
Kasjanusz reaguje na specjalne sytuacje:
- Pierwsza transakcja dnia
- Transakcja po długiej przerwie od zakupów
- Rekordowo wysoka transakcja w kategorii
- Zbliżający się koniec budżetu
- Transakcja nocna (po 23:00)

### F4.4 — Historia komentarzy
- Feed wszystkich komentarzy Kasjanusza
- Możliwość "polubienia" (Kasjanusz komentuje polubienia)
- Możliwość udostępnienia komentarza (viral potential)

---

## F5 — Zarządzanie Transakcjami

### F5.1 — Ręczne dodawanie
- Formularz: kwota, kategoria, opis, data
- Szybki shortcut: "Wydałem X na Y" (NLP parsing)

### F5.2 — Edycja kategorii
- Użytkownik może poprawić automatyczną kategoryzację
- System uczy się preferencji (local model adaptation)

### F5.3 — Import CSV
- Obsługa formatów popularnych polskich banków
- PKO BP, mBank, ING, Santander, Millennium
- Automatyczne mapowanie kolumn
- Deduplication (wykrywanie duplikatów)

### F5.4 — OCR Paragonów (v2)
- Zdjęcie paragonu → automatyczne wyciągnięcie danych
- expo-camera + backend OCR (Tesseract lub Google Vision API)

---

## F6 — Ustawienia i Personalizacja

### F6.1 — Profil finansowy
- Miesięczny dochód (opcjonalne, dla % obliczeń)
- Kategorie budżetowe i limity
- Dzień startu miesiąca budżetowego

### F6.2 — Personalizacja Kasjanusza
- Agresywność: Delikatny / Normalny / Bezlitosny / "Nie mam dla Ciebie litości"
- Częstotliwość powiadomień: po każdej / tylko ważne / tylko dzienne podsumowanie
- Cisza nocna (brak powiadomień w nocy)

### F6.3 — Zarządzanie kontami bankowymi
- Dodawanie/usuwanie kont
- Ręczna synchronizacja
- Status połączenia

---

## F7 — Tryb Testowy / Demo

Kluczowe dla developmentu i onboardingu:

### F7.1 — Predefiniowane scenariusze
- "Kawa-holic" — użytkownik wydający 500 zł/mies na kawę
- "Subskrypcyjny zombie" — 15 aktywnych subskrypcji, z czego 8 nieużywanych
- "Impulsywny zakupoholik" — duże zakupy bez wzorca
- "Rozsądny oszczędzający" — Kasjanusz nie ma dużo do powiedzenia (rzadki scenariusz)
- "Weekendowy szaleniec" — spokojny tydzień, szaleństwo w weekend

### F7.2 — Symulacja transakcji w czasie
- Przyspieszony timeline — "przeżyj miesiąc finansowy w 5 minut"
- Wyzwalanie konkretnych komentarzy Kasjanusza
- Możliwość dodawania własnych testowych transakcji

### F7.3 — Preview komentarzy
- Panel gdzie można podejrzeć różne komentarze dla różnych scenariuszy
- Przydatne przy dostosowywaniu agresywności Kasjanusza

---

## Priorytety implementacji (MVP vs V2 vs V3)

### MVP (pierwsze wydanie)
- [ ] Rejestracja/logowanie
- [ ] Ręczne dodawanie transakcji
- [ ] Import CSV
- [ ] Tryb testowy z mock danymi
- [ ] Podstawowe statystyki (wykres, kategorie, waste score)
- [ ] Komentarze Kasjanusza (Claude API)
- [ ] Push notifications

### V2
- [ ] Integracja Open Banking (Nordigen)
- [ ] Subskrypcje zombie
- [ ] Wykrywanie wzorców
- [ ] Tygodniowy raport wstydu
- [ ] "Co mógłbyś za to kupić"

### V3
- [ ] OCR paragonów
- [ ] Prognozowanie wydatków
- [ ] Social features (udostępnianie komentarzy)
- [ ] Apple Watch / widget
