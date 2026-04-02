// ============================================================
// CSV Parsers — Polskie Banki
//
// Każdy bank ma inny format eksportu CSV.
// Każdy parser zwraca ujednolicony ParsedTransaction[].
//
// Formaty testowane na rzeczywistych wyciągach (2024-2026).
// ============================================================

import crypto from 'crypto'
import type { ParsedTransaction, BankFormat } from './types'

// ── Helpers ───────────────────────────────────────────────────

function hash(row: string): string {
  return crypto.createHash('sha1').update(row).digest('hex').slice(0, 16)
}

/** "28,50" | "28.50" | "-28,50" → number (always positive, sign handled separately) */
function parseAmount(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : Math.abs(n)
}

/** "2026-03-28" | "28.03.2026" | "28-03-2026" → Date */
function parseDate(raw: string): Date | null {
  const s = raw.trim()
  // ISO: 2026-03-28
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  // Polish: 28.03.2026 or 28-03-2026
  const m = s.match(/^(\d{2})[.\-](\d{2})[.\-](\d{4})$/)
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}`)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function splitCSV(line: string, delimiter: string): string[] {
  // Handle quoted fields (some banks quote merchant names with commas)
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''))
  return result
}

// ── PKO Bank Polski ───────────────────────────────────────────
//
// Format (separator: ,):
// "Data operacji","Data waluty","Typ transakcji","Kwota","Waluta",
// "Saldo po transakcji","Opis transakcji"
//
// Przykład:
// "2026-03-28","2026-03-28","Zakup przy użyciu karty","-28,50","PLN","1234,56","STARBUCKS WARSZAWA"

export function parsePKO(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.startsWith('"Data operacji"') || line.startsWith('Data operacji')) continue

    const cols = splitCSV(line, ',')
    if (cols.length < 7) continue

    const date   = parseDate(cols[0])
    const amount = parseAmount(cols[3])
    const currency = cols[4]?.trim() || 'PLN'
    const desc   = cols[6]?.trim() || null

    if (!date || amount === null || amount === 0) continue
    // Skip credits (positive amounts in PKO = income, not expenses)
    if (!cols[3].includes('-')) continue

    results.push({
      amount,
      currency,
      merchant:    extractMerchant(desc),
      description: desc,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── mBank ─────────────────────────────────────────────────────
//
// Format (separator: ;):
// #Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;#Saldo po operacji
//
// Przykład:
// 2026-03-28;STARBUCKS WARSZAWA;eKonto;Restauracje;-28,50 PLN;1 234,56 PLN

export function parseMBank(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.startsWith('#Data') || line.startsWith('"#Data')) continue

    const cols = splitCSV(line, ';')
    if (cols.length < 5) continue

    const date   = parseDate(cols[0])
    const desc   = cols[1]?.trim() || null
    const amtRaw = cols[4]?.replace(/\s+PLN/i, '').trim()
    const amount = parseAmount(amtRaw ?? '')

    if (!date || amount === null || amount === 0) continue
    if (!amtRaw?.includes('-')) continue  // Skip credits

    const currency = amtRaw?.includes('EUR') ? 'EUR'
      : amtRaw?.includes('USD') ? 'USD' : 'PLN'

    results.push({
      amount,
      currency,
      merchant:    extractMerchant(desc),
      description: desc,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── ING Bank Śląski ───────────────────────────────────────────
//
// Format (separator: ;):
// "Data transakcji";"Data księgowania";"Dane kontrahenta";"Tytuł";
// "Nr rachunku";"Nazwa banku";"Szczegóły";"Kwota transakcji (waluta rachunku)";"Waluta"
//
// Przykład:
// "2026-03-28";"2026-03-28";"STARBUCKS";"Płatność kartą";"";"";"";">-28,50";"PLN"

export function parseING(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.includes('Data transakcji') || line.includes('Waluta')) continue

    const cols = splitCSV(line, ';')
    if (cols.length < 9) continue

    const date      = parseDate(cols[0])
    const merchant  = cols[2]?.trim() || null
    const title     = cols[3]?.trim() || null
    const amtRaw    = cols[7]?.replace('>', '')
    const amount    = parseAmount(amtRaw ?? '')
    const currency  = cols[8]?.trim() || 'PLN'

    if (!date || amount === null || amount === 0) continue
    if (!amtRaw?.includes('-')) continue

    results.push({
      amount,
      currency,
      merchant:    merchant || extractMerchant(title),
      description: title,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── Santander Bank Polska ─────────────────────────────────────
//
// Format (separator: ;):
// Data;Opis;Kwota;Saldo;Waluta
//
// Przykład:
// 2026-03-28;STARBUCKS WARSZAWA;-28,50;1234,56;PLN

export function parseSantander(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.startsWith('Data;') || line.startsWith('"Data;')) continue

    const cols = splitCSV(line, ';')
    if (cols.length < 5) continue

    const date     = parseDate(cols[0])
    const desc     = cols[1]?.trim() || null
    const amount   = parseAmount(cols[2] ?? '')
    const currency = cols[4]?.trim() || 'PLN'

    if (!date || amount === null || amount === 0) continue
    if (!cols[2]?.includes('-')) continue

    results.push({
      amount,
      currency,
      merchant:    extractMerchant(desc),
      description: desc,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── Bank Millennium ───────────────────────────────────────────
//
// Format (separator: ;):
// Data transakcji;Data rozliczenia;Opis transakcji;Obciążenia;Uznania;Saldo;Waluta
//
// Przykład:
// 2026-03-28;2026-03-28;STARBUCKS WARSZAWA;28,50;;1234,56;PLN

export function parseMillennium(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.startsWith('Data transakcji') || line.startsWith('"Data transakcji')) continue

    const cols = splitCSV(line, ';')
    if (cols.length < 7) continue

    const date     = parseDate(cols[0])
    const desc     = cols[2]?.trim() || null
    const amtDebit = cols[3]?.trim()  // Obciążenia (wydatki)
    const amount   = amtDebit ? parseAmount(amtDebit) : null
    const currency = cols[6]?.trim() || 'PLN'

    if (!date || !amount || amount === 0) continue

    results.push({
      amount,
      currency,
      merchant:    extractMerchant(desc),
      description: desc,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── Alior Bank ────────────────────────────────────────────────
//
// Format (separator: ,):
// "Data księgowania";"Opis operacji";"Kwota";"Saldo końcowe";"Waluta"
//
// Przykład:
// "2026-03-28";"Zakup: STARBUCKS WARSZAWA";"-28,50";"1234,56";"PLN"

export function parseAlior(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.includes('Data księgowania')) continue

    const cols = splitCSV(line, ';')
    if (cols.length < 5) continue

    const date     = parseDate(cols[0])
    const desc     = cols[1]?.trim().replace(/^Zakup:\s*/i, '') || null
    const amount   = parseAmount(cols[2] ?? '')
    const currency = cols[4]?.trim() || 'PLN'

    if (!date || amount === null || amount === 0) continue
    if (!cols[2]?.includes('-')) continue

    results.push({
      amount,
      currency,
      merchant:    extractMerchant(desc),
      description: desc,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── BNP Paribas ───────────────────────────────────────────────
//
// Format (separator: ;):
// Data;Opis;Kwota operacji;Waluta;Saldo po operacji
//
// Przykład:
// 28-03-2026;STARBUCKS WARSZAWA;-28,50;PLN;1234,56

export function parseBNP(lines: string[]): ParsedTransaction[] {
  const results: ParsedTransaction[] = []

  for (const line of lines) {
    if (!line.trim() || line.startsWith('Data;') || line.startsWith('"Data;')) continue

    const cols = splitCSV(line, ';')
    if (cols.length < 5) continue

    const date     = parseDate(cols[0])
    const desc     = cols[1]?.trim() || null
    const amount   = parseAmount(cols[2] ?? '')
    const currency = cols[3]?.trim() || 'PLN'

    if (!date || amount === null || amount === 0) continue
    if (!cols[2]?.includes('-')) continue

    results.push({
      amount,
      currency,
      merchant:    extractMerchant(desc),
      description: desc,
      date,
      externalId:  hash(line),
    })
  }

  return results
}

// ── Merchant extractor ────────────────────────────────────────
// Banks often include extra info in the description field.
// Try to extract just the merchant name.

function extractMerchant(description: string | null): string | null {
  if (!description) return null

  const cleaned = description
    .replace(/^(Zakup przy użyciu karty|Zakup:?|Płatność kartą|PRZELEW PRZYCHODZĄCY|Przelew)/i, '')
    .replace(/\d{2}[-./]\d{2}[-./]\d{4}/, '')  // Remove dates
    .replace(/[A-Z]{2}\d{2}[A-Z0-9]{10,}/g, '') // Remove IBANs
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Truncate at common noise patterns
  const noiseIndex = cleaned.search(
    /\b(ul\.|al\.|pl\.|NIP|WARSZAWA|KRAKÓW|GDAŃSK|WROCŁAW|POZNAŃ|ŁÓDŹ|\d{5})/i,
  )
  const merchant = noiseIndex > 5 ? cleaned.slice(0, noiseIndex).trim() : cleaned

  return merchant.length > 2 ? merchant.slice(0, 100) : null
}
