// ============================================================
// Analytics Engine — Public API
//
// Only import from this file in the rest of the backend.
// Internal modules (analyzers, strategies) are implementation
// details and should not be imported directly by services.
// ============================================================

export { AnalyticsPipeline }    from './AnalyticsPipeline'
export { RecurrenceDetector }   from './analyzers/RecurrenceDetector'

// Types needed by services and routes
export type {
  AnalysisContext,
  PipelineResult,
  DrSpenderContext,
  DrSpenderMood,
  SuggestionCandidate,
  Signal,
  SignalType,
  DetectedPattern,
  PatternType,
  RecurringPayment,
  WasteScoreResult,
  FinancialHealthScore,
  BurnRateResult,
  ForecastResult,
  Transaction,
  Category,
  UserSettings,
  CalendarContext,
} from './types'
