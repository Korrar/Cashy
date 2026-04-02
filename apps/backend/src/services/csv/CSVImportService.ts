import type { BankFormat, ParseResult, ParsedTransaction } from './types'
import {
  parsePKO, parseMBank, parseING, parseSantander,
  parseMillennium, parseAlior, parseBNP,
} from './parsers'
import { createTransaction } from '../TransactionService'

// ── Format detection ──────────────────────────────────────────

export function detectFormat(content: string): BankFormat {
  const header = content.slice(0, 500).toLowerCase()

  if (header.includes('"data operacji","data waluty"') ||
      header.includes('data operacji,data waluty'))       return 'PKO_BP'
  if (header.includes('#data operacji;#opis operacji') ||
      header.includes('"#data operacji'))                 return 'MBANK'
  if (header.includes('"data transakcji";"data księgowania"') ||
      header.includes('data transakcji;data księgowania')) return 'ING'
  if (header.includes('data;opis;kwota;saldo;waluta'))    return 'SANTANDER'
  if (header.includes('data transakcji;data rozliczenia;opis transakcji;obciążenia')) return 'MILLENNIUM'
  if (header.includes('data księgowania') && header.includes('kwota') && header.includes('opis operacji')) return 'ALIOR'
  if (header.includes('data;opis;kwota operacji;waluta')) return 'BNP_PARIBAS'

  return 'UNKNOWN'
}

// ── Main parse ────────────────────────────────────────────────

export function parseCSV(content: string): ParseResult {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  const bank = detectFormat(normalized)
  const errors: string[] = []
  let transactions: ParsedTransaction[] = []

  try {
    switch (bank) {
      case 'PKO_BP':     transactions = parsePKO(lines);         break
      case 'MBANK':      transactions = parseMBank(lines);        break
      case 'ING':        transactions = parseING(lines);          break
      case 'SANTANDER':  transactions = parseSantander(lines);    break
      case 'MILLENNIUM': transactions = parseMillennium(lines);   break
      case 'ALIOR':      transactions = parseAlior(lines);        break
      case 'BNP_PARIBAS':transactions = parseBNP(lines);          break
      case 'UNKNOWN':
        errors.push('Nie rozpoznano formatu banku. Obsługiwane: PKO BP, mBank, ING, Santander, Millennium, Alior, BNP Paribas.')
        break
    }
  } catch (err) {
    errors.push(`Błąd parsowania: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    bank,
    transactions,
    skipped: lines.filter(l => l.trim()).length - transactions.length,
    errors,
  }
}

// ── Import to DB ──────────────────────────────────────────────

export interface ImportResult {
  bank: BankFormat
  imported: number
  skipped: number   // duplicates
  errors: string[]
}

export async function importCSV(
  userId: string,
  csvContent: string,
): Promise<ImportResult> {
  const { bank, transactions, skipped, errors } = parseCSV(csvContent)

  if (transactions.length === 0) {
    return { bank, imported: 0, skipped, errors }
  }

  let imported = 0
  let duplicates = 0

  for (const t of transactions) {
    try {
      await createTransaction({
        userId,
        amount:      t.amount,
        currency:    t.currency,
        merchant:    t.merchant ?? undefined,
        description: t.description ?? undefined,
        date:        t.date,
        source:      'CSV_IMPORT',
        externalId:  t.externalId,
      })
      imported++
    } catch (err: unknown) {
      // Prisma unique constraint = duplicate — skip silently
      if (isUniqueConstraintError(err)) {
        duplicates++
      } else {
        errors.push(`Pominięto transakcję ${t.date.toISOString()}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
  }

  return {
    bank,
    imported,
    skipped: skipped + duplicates,
    errors,
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code: string }).code === 'P2002'
  )
}
