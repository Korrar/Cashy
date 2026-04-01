# Spendr — Sarkastyczny Asystent Finansowy

## Czym jest ta aplikacja

Spendr to mobilna aplikacja (React Native + Expo) która działa w tle i monitoruje transakcje finansowe użytkownika w czasie rzeczywistym. Po każdej transakcji — lub serii transakcji tworzących wzorzec — aplikacja komunikuje się z użytkownikiem przez postać o czarnym humorze, która komentuje jego finansowe decyzje. Celem NIE jest zarządzanie budżetem w klasycznym sensie — celem jest emocjonalne uświadomienie użytkownika ile pieniędzy marnuje, przez sarkastyczne, czepliwe, ale prawdziwe komentarze oparte na danych.

## Postać — Dr. Spender

Dr. Spender to duch dziewiętnastowiecznego bankruta, który obserwuje finansowe błędy użytkownika i komentuje je z mieszaniną rozpaczy i ironii. Zna całą historię zakupów, wyłapuje wzorce, nigdy nie kłamie o liczbach ale zawsze dodaje bolesny komentarz. Mówi po polsku, potocznie, z dramatycznym XIX-wiecznym akcentem. Generowany przez Claude API (model: claude-sonnet-4-6).

Przykłady wypowiedzi Dr. Spendera:
- "Czwarta kawa w Starbucks w tym tygodniu. W sumie 112 złotych. Za te pieniądze mógłbyś kupić kilogram porządnej kawy i nie widywać mnie przez miesiąc. Ale widzimy się codziennie."
- "Subskrypcja którą wykupiłeś w maju wciąż żyje. Użyłeś jej raz. Płacisz za nią jakbyś ją kochał."
- "Trzecia para butów w kwartale. Poprzednie dwie stały się eksponatami w muzeum Twojej szafy."

## Główne założenia produktowe

1. **Transakcje w czasie rzeczywistym** — integracja Open Banking (Nordigen/GoCardless), import CSV, ręczne wpisywanie
2. **Statystyki zmarnowanych pieniędzy** — kategorie, trendy, porównania miesięczne, "could have bought" (co mógłbyś za to kupić)
3. **Komentarze Dr. Spendera** — generowane przez Claude API, personalizowane na podstawie historii
4. **Suggestions** — konkretne, wykonalne propozycje zmiany nawyków oparte na wzorcach wydatków (zamiana, gotowanie zamiast zamawiania, anulowanie subskrypcji, zasady behawioralne). Szczegóły: docs/SUGGESTIONS.md
5. **Powiadomienia push** — Dr. Spender przerywa Twój dzień w najgorszym możliwym momencie
6. **Tryb testowy** — pełna symulacja z mockowanymi transakcjami bez prawdziwego konta

## Stack technologiczny (szczegóły w docs/TECH_STACK.md)

- **Mobile**: React Native 0.74+ z Expo SDK 51
- **Backend**: Node.js 20 + Express + TypeScript
- **AI**: Anthropic Claude API (claude-sonnet-4-6)
- **Baza danych**: PostgreSQL 16 + Prisma ORM + Redis
- **Open Banking**: Nordigen API (GoCardless Bank Account Data)
- **Powiadomienia**: Expo Notifications + FCM
- **Testy**: Jest + React Native Testing Library + Detox (E2E)

## Struktura projektu

```
spendr/
├── apps/
│   ├── mobile/          # React Native + Expo
│   └── backend/         # Node.js + Express API
├── packages/
│   ├── shared/          # Typy, utils, stałe
│   └── ai/              # Logika Claude API + prompty Dr. Spendera
├── docs/                # Dokumentacja projektowa
├── mock-data/           # Dane testowe — transakcje, scenariusze
└── CLAUDE.md            # Ten plik
```

## Kluczowe zasady developerskie

1. **Prywatność first** — dane finansowe nigdy nie idą do zewnętrznych serwisów poza Open Banking i własnym backendem. Claude API dostaje tylko skategoryzowane dane, nie surowe numery kont.
2. **Offline-capable** — podstawowe funkcje działają bez internetu (lokalna baza transakcji)
3. **TypeScript wszędzie** — strict mode, zero `any`
4. **Testy przed mergem** — każda logika biznesowa musi mieć testy jednostkowe
5. **Dr. Spender nie kłamie** — wszystkie liczby w komentarzach muszą być zgodne z rzeczywistymi danymi użytkownika

## Przepływ danych (uproszczony)

```
Bank → Nordigen API → Backend → PostgreSQL
                              → Redis (cache)
                              → Claude API (analiza wzorców)
                                        ↓
                              Komentarz Dr. Spendera
                                        ↓
                    Mobile App ← Push Notification
```

## Status projektu

Faza: Planowanie i setup
Branch: claude/finance-sarcasm-assistant-g6nuM
