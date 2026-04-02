import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { CATEGORY_META, type Category } from '../../constants/categories'
import { useTransactionsStore } from '../../store/transactionsStore'

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const { items, updateCategory } = useTransactionsStore()
  const tx = items.find((t) => t.id === id)

  const [editingCat, setEditingCat] = useState(false)

  if (!tx) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>Transakcja nie znaleziona.</Text>
      </SafeAreaView>
    )
  }

  const meta = CATEGORY_META[tx.category]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Wstecz</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Transakcja</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Amount hero */}
        <View style={styles.amountCard}>
          <Text style={styles.emoji}>{meta.emoji}</Text>
          <Text style={styles.amount}>
            -{new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(tx.amount)}
          </Text>
          <Text style={styles.merchant}>{tx.merchant ?? tx.description}</Text>
          <Text style={styles.date}>
            {format(new Date(tx.date), 'EEEE, d MMMM yyyy', { locale: pl })}
          </Text>
        </View>

        {/* Waste score */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Waste Score</Text>
            <Text style={[styles.wasteScore, { color: wasteColor(tx.wasteScore) }]}>
              {tx.wasteScore} / 100
            </Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[styles.barFill, {
                width: `${tx.wasteScore}%`,
                backgroundColor: wasteColor(tx.wasteScore),
              }]}
            />
          </View>
        </View>

        {/* Category */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Kategoria</Text>
            <TouchableOpacity onPress={() => setEditingCat((v) => !v)}>
              <Text style={styles.editBtn}>{editingCat ? 'Zamknij' : 'Zmień'}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.currentCat, { borderColor: meta.color + '44' }]}>
            <Text style={styles.catEmoji}>{meta.emoji}</Text>
            <Text style={[styles.catLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>

          {editingCat && (
            <View style={styles.catGrid}>
              {CATEGORIES.map(([key, m]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.catChip, tx.category === key && { borderColor: m.color, backgroundColor: m.color + '22' }]}
                  onPress={async () => {
                    await updateCategory(tx.id, key)
                    setEditingCat(false)
                  }}
                >
                  <Text style={styles.catChipEmoji}>{m.emoji}</Text>
                  <Text style={[styles.catChipText, tx.category === key && { color: m.color }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Szczegóły</Text>
          <DetailRow label="Opis"   value={tx.description} />
          {tx.merchant && tx.merchant !== tx.description && (
            <DetailRow label="Sklep" value={tx.merchant} />
          )}
          <DetailRow label="Typ" value={tx.isManual ? 'Ręczna' : 'Import'} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  )
}

const detailStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textMuted },
  value: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textPrimary, flex: 1, textAlign: 'right' },
})

function wasteColor(score: number) {
  if (score < 30) return colors.savings
  if (score < 60) return colors.warning
  return colors.waste
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  notFound:    { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back:        { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.accentLight },
  title:       { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  scroll:      { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  amountCard:  { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  emoji:       { fontSize: 48 },
  amount:      { fontFamily: fontFamily.displayBold, fontSize: fontSize.hero, color: colors.textPrimary },
  merchant:    { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.textSecondary },
  date:        { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textMuted },
  card:        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardLabel:   { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textSecondary },
  rowBetween:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wasteScore:  { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl },
  barTrack:    { height: 6, backgroundColor: colors.surfaceHigh, borderRadius: radius.full, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: radius.full },
  editBtn:     { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.accentLight },
  currentCat:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  catEmoji:    { fontSize: 20 },
  catLabel:    { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 5, backgroundColor: colors.surfaceHigh },
  catChipEmoji:{ fontSize: 12 },
  catChipText: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
})
