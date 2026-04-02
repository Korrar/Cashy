import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, subMonths } from 'date-fns'
import { pl } from 'date-fns/locale'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useStatsStore } from '../../store/statsStore'
import { useTransactionsStore } from '../../store/transactionsStore'
import { CATEGORY_META } from '../../constants/categories'
import { WasteScoreGauge } from '../../components/ui/WasteScoreGauge'
import { TransactionItem } from '../../components/transactions/TransactionItem'

function monthParam(offset: number) {
  return format(subMonths(new Date(), offset), 'yyyy-MM')
}

export default function StatsScreen() {
  const [monthOffset, setMonthOffset] = useState(0)
  const { monthly, subscriptions, fetchMonthly, fetchSubscriptions, isLoading } = useStatsStore()
  const { items: txs, fetch: fetchTxs, hasMore } = useTransactionsStore()

  const currentMonth = monthParam(monthOffset)
  const monthLabel   = format(subMonths(new Date(), monthOffset), 'LLLL yyyy', { locale: pl })

  useEffect(() => { fetchMonthly(currentMonth); fetchSubscriptions() }, [monthOffset])
  useEffect(() => { fetchTxs(true) }, [])

  const zombies = subscriptions.filter((s) => s.isZombie)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => fetchMonthly(currentMonth)}
            tintColor={colors.accentLight}
          />
        }
        onScrollEndDrag={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40 && hasMore) {
            fetchTxs()
          }
        }}
      >
        <Text style={styles.heading}>Statystyki</Text>

        {/* Month selector */}
        <View style={styles.monthRow}>
          <TouchableOpacity style={styles.monthBtn} onPress={() => setMonthOffset((o) => o + 1)}>
            <Text style={styles.monthArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            style={styles.monthBtn}
            onPress={() => setMonthOffset((o) => Math.max(0, o - 1))}
            disabled={monthOffset === 0}
          >
            <Text style={[styles.monthArrow, monthOffset === 0 && styles.disabled]}>→</Text>
          </TouchableOpacity>
        </View>

        {monthly && (
          <>
            {/* Score + totals */}
            <View style={styles.row}>
              <View style={[styles.card, { flex: 1, alignItems: 'center' }]}>
                <Text style={styles.cardLabel}>Waste Score</Text>
                <WasteScoreGauge score={monthly.wasteScore} size={100} />
              </View>
              <View style={[styles.card, { flex: 1, gap: spacing.sm }]}>
                <StatLine label="Wydane"     value={formatPLN(monthly.totalSpent)}   color={colors.textPrimary} />
                <StatLine label="Zmarnowane" value={formatPLN(monthly.totalWasted)}  color={colors.wasteLight} />
                <StatLine label="Transakcje" value={String(monthly.transactionCount)} color={colors.textSecondary} />
                {monthly.forecast != null &&
                  <StatLine label="Prognoza" value={formatPLN(monthly.forecast)} color={colors.warning} />}
                {monthly.fireImpact != null &&
                  <StatLine label="FIRE impact" value={formatPLN(monthly.fireImpact)} color={colors.textMuted} />}
              </View>
            </View>

            {/* Category breakdown */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Podział kategorii</Text>
              {monthly.byCategory.map((c) => {
                const meta = CATEGORY_META[c.category]
                const pct  = monthly.totalSpent > 0 ? (c.total / monthly.totalSpent) * 100 : 0
                return (
                  <View key={c.category} style={styles.catRow}>
                    <Text style={styles.catEmoji}>{meta.emoji}</Text>
                    <View style={styles.catInfo}>
                      <View style={styles.catHeader}>
                        <Text style={styles.catLabel}>{meta.label}</Text>
                        <Text style={styles.catAmount}>{formatPLN(c.total)}</Text>
                      </View>
                      <View style={styles.catBar}>
                        <View
                          style={[styles.catBarFill, {
                            width: `${pct}%`,
                            backgroundColor: meta.color,
                          }]}
                        />
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* Zombie subs */}
        {zombies.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🧟 Zombie subskrypcje</Text>
            <Text style={styles.sectionSub}>
              Płacisz, ale nie korzystasz
            </Text>
            {zombies.map((s, i) => (
              <View key={i} style={styles.subRow}>
                <Text style={styles.subMerchant}>{s.merchant}</Text>
                <Text style={styles.subAmount}>{formatPLN(s.amount)}/mies.</Text>
              </View>
            ))}
          </View>
        )}

        {/* All transactions */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Wszystkie transakcje</Text>
          {txs.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))}
          {hasMore && (
            <TouchableOpacity onPress={() => fetchTxs()} style={styles.loadMore}>
              <Text style={styles.loadMoreText}>Załaduj więcej</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color }}>{value}</Text>
    </View>
  )
}

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount)
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  scroll:      { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  heading:     { fontFamily: fontFamily.displayBold, fontSize: fontSize.xxl, color: colors.textPrimary },
  monthRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm },
  monthBtn:    { padding: spacing.sm },
  monthArrow:  { fontFamily: fontFamily.bodyBold, fontSize: fontSize.lg, color: colors.accentLight },
  monthLabel:  { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.textPrimary },
  disabled:    { color: colors.textMuted },
  row:         { flexDirection: 'row', gap: spacing.md },
  card:        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardLabel:   { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs },
  sectionTitle:{ fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textPrimary, marginBottom: spacing.xs },
  sectionSub:  { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  catRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  catEmoji:    { fontSize: 18, marginTop: 2 },
  catInfo:     { flex: 1, gap: 4 },
  catHeader:   { flexDirection: 'row', justifyContent: 'space-between' },
  catLabel:    { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  catAmount:   { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textPrimary },
  catBar:      { height: 4, backgroundColor: colors.surfaceHigh, borderRadius: radius.full, overflow: 'hidden' },
  catBarFill:  { height: '100%', borderRadius: radius.full },
  subRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  subMerchant: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  subAmount:   { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.wasteLight },
  loadMore:    { alignItems: 'center', paddingVertical: spacing.md },
  loadMoreText:{ fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.accentLight },
})
