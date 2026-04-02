export interface ParsedTransaction {
  amount: number
  currency: string
  merchant: string | null
  description: string | null
  date: Date
  externalId: string  // dedup key — hash of raw row
}

export interface ParseResult {
  bank: BankFormat
  transactions: ParsedTransaction[]
  skipped: number     // rows that couldn't be parsed
  errors: string[]    // non-fatal parse errors
}

export type BankFormat =
  | 'PKO_BP'
  | 'MBANK'
  | 'ING'
  | 'SANTANDER'
  | 'MILLENNIUM'
  | 'ALIOR'
  | 'BNP_PARIBAS'
  | 'UNKNOWN'
