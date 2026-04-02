import { useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useAuthStore } from '../../store/authStore'
import { useStatsStore } from '../../store/statsStore'
import { useTransactionsStore } from '../../store/transactionsStore'
import { useDrSpenderStore } from '../../store/drSpenderStore'
import { CATEGORY_META } from '../../constants/categories'
import { WasteScoreGauge } from '../../components/ui/WasteScoreGauge'
import { TransactionItem } from '../../components/transactions/TransactionItem'
import { DrSpenderWidget } from '../../components/dr-spender/DrSpenderWidget'

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { monthly, fetchMonthly, isLoading: statsLoading } = useStatsStore()
  const { items: txs, fetch: fetchTxs } = useTransactionsStore()
  const { comments, fetchComments, fetchSuggestions } = useDrSpenderStore()

  const latestComment = comments.find((c) => !c.isRead) ?? comments[0]
  const recentTxs     = txs.slice(0, 5)

  useEffect(() => {
    fetchMonthly(0)
    fetchTxs(true)
    fetchComments()
    fetchSuggestions()
  }, [])

  const refresh = async () => {
    await Promise.all([fetchMonthly(0), fetchTxs(true), fetchComments()])
  }

  const monthLabel = format(new Date(), 'LLLL yyyy', { locale: pl })

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={statsLoading} onRefresh={refresh} tintColor={colors.accentLight} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Dzień dobry,</Text>
            <Text style={styles.userName}>{user?.name ?? 'Użytkowniku'}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/transaction/new')}>
            <Text style={styles.addBtnText}>+ Transakcja</Text>
          </TouchableOpacity>
        </View>

        {/* Dr. Spender Widget */}
        {latestComment && (
          <DrSpenderWidget comment={latestComment} />
        )}

        {/* Waste Score + This Month */}
        <View style={styles.row}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={styles.cardLabel}>Waste Score</Text>
            <WasteScoreGauge score={monthly?.wasteScore ?? 0} size={100} />
          </View>
          <View style={[styles.card, { flex: 1, gap: spacing.sm }]}>
            <Text style={styles.cardLabel}>{monthLabel}</Text>
            <View>
              <Text style={styles.amountBig}>{formatPLN(monthly?.totalSpent ?? 0)}</Text>
              <Text style={styles.amountSub}>wydane</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={[styles.amountMid, { color: colors.wasteLight }]}>
                {formatPLN(monthly?.totalWasted ?? 0)}
              </Text>
              <Text style={styles.amountSub}>zmarnowane</Text>
            </View>
          </View>
        </View>

        {/* Burn rate / forecast */}
        {monthly && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <MetricPill
                label="Dzienny koszt"
                value={`${formatPLN(monthly.burnRate)}/dzień`}
                color={colors.warning}
              />
              {monthly.forecast != null && (
                <MetricPill
                  label="Prognoza miesiąca"
                  value={formatPLN(monthly.forecast)}
                  color={colors.wasteLight}
                />
              )}
              {monthly.latteFactor != null && (
                <MetricPill
                  label="Latte factor / rok"
                  value={formatPLN(monthly.latteFactor)}
                  color={colors.textSecondary}
                />
              )}
            </View>
          </View>
        )}

        {/* Top categories */}
        {monthly && monthly.byCategory.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Kategorie</Text>
            <View style={styles.catList}>
              {monthly.byCategory.slice(0, 4).map((c) => {
                const meta = CATEGORY_META[c.category]
                return (
                  <View key={c.category} style={styles.catRow}>
                    <Text style={styles.catEmoji}>{meta.emoji}</Text>
                    <Text style={styles.catLabel}>{meta.label}</Text>
                    <View style={styles.catBar}>
                      <View
                        style={[
                          styles.catBarFill,
                          {
                            width: `${Math.min(100, (c.total / (monthly.totalSpent || 1)) * 100)}%`,
                            backgroundColor: meta.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.catAmount}>{formatPLN(c.total)}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Recent transactions */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Ostatnie transakcje</Text>
            <TouchableOpacity onPress={() => router.push('/tabs/stats')}>
              <Text style={styles.seeAll}>wszystkie →</Text>
            </TouchableOpacity>
          </View>
          {recentTxs.length === 0
            ? <Text style={styles.empty}>Brak transakcji. Dodaj pierwszą.</Text>
            : recentTxs.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onPress={() => router.push(`/transaction/${tx.id}`)}
                />
              ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={pillStyles.wrap}>
      <Text style={[pillStyles.value, { color }]}>{value}</Text>
      <Text style={pillStyles.label}>{label}</Text>
    </View>
  )
}

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount)
}

const pillStyles = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 2 },
  value: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm },
  label: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted },
})

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  scroll:      { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  greeting:    { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  userName:    { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  addBtn:      { backgroundColor: colors.accentLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  addBtnText:  { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.black },
  row:         { flexDirection: 'row', gap: spacing.md },
  rowBetween:  { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: spacing.md },
  card:        { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardLabel:   { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  amountBig:   { fontFamily: fontFamily.displayBold, fontSize: fontSize.xxl, color: colors.textPrimary },
  amountMid:   { fontFamily: fontFamily.bodyBold, fontSize: fontSize.lg, color: colors.textPrimary },
  amountSub:   { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted },
  divider:     { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  sectionTitle:{ fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textPrimary, marginBottom: spacing.sm },
  seeAll:      { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.accentLight },
  catList:     { gap: spacing.sm },
  catRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catEmoji:    { fontSize: 16, width: 24 },
  catLabel:    { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, width: 90 },
  catBar:      { flex: 1, height: 4, backgroundColor: colors.surfaceHigh, borderRadius: radius.full, overflow: 'hidden' },
  catBarFill:  { height: '100%', borderRadius: radius.full },
  catAmount:   { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textPrimary, width: 60, textAlign: 'right' },
  empty:       { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
})
