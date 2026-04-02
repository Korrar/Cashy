export type Category =
  | 'FOOD_RESTAURANT' | 'FOOD_GROCERY' | 'COFFEE' | 'ALCOHOL'
  | 'TRANSPORT' | 'SUBSCRIPTION' | 'ENTERTAINMENT' | 'CLOTHING'
  | 'ELECTRONICS' | 'HEALTH' | 'SPORT' | 'TRAVEL' | 'OTHER'

export const CATEGORY_META: Record<Category, { label: string; emoji: string; color: string }> = {
  COFFEE:           { label: 'Kawa',          emoji: '☕', color: '#8B4513' },
  FOOD_RESTAURANT:  { label: 'Restauracje',   emoji: '🍽️', color: '#E53E3E' },
  FOOD_GROCERY:     { label: 'Zakupy spożywcze', emoji: '🛒', color: '#38A169' },
  SUBSCRIPTION:     { label: 'Subskrypcje',   emoji: '📱', color: '#805AD5' },
  TRANSPORT:        { label: 'Transport',     emoji: '🚗', color: '#3182CE' },
  CLOTHING:         { label: 'Ubrania',       emoji: '👗', color: '#D53F8C' },
  ELECTRONICS:      { label: 'Elektronika',   emoji: '💻', color: '#2B6CB0' },
  ENTERTAINMENT:    { label: 'Rozrywka',      emoji: '🎮', color: '#744210' },
  ALCOHOL:          { label: 'Alkohol',       emoji: '🍺', color: '#C05621' },
  HEALTH:           { label: 'Zdrowie',       emoji: '💊', color: '#276749' },
  SPORT:            { label: 'Sport',         emoji: '🏋️', color: '#2C7A7B' },
  TRAVEL:           { label: 'Podróże',       emoji: '✈️', color: '#2A69AC' },
  OTHER:            { label: 'Inne',          emoji: '📦', color: '#718096' },
}
