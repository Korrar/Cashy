import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { CATEGORY_META } from '../../constants/categories'
import type { Transaction } from '../../store/transactionsStore'

interface Props {
  transaction: Transaction
  onPress?: () => void
}

export function TransactionItem({ transaction: tx, onPress }: Props) {
  const meta  = CATEGORY_META[tx.category]
  const date  = format(new Date(tx.date), 'd MMM', { locale: pl })
  const waste = tx.wasteScore

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
        <Text style={styles.icon}>{meta.emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.merchant} numberOfLines={1}>
          {tx.merchant ?? tx.description}
        </Text>
        <Text style={styles.meta}>{meta.label} · {date}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>-{formatPLN(tx.amount)}</Text>
        {waste > 40 && (
          <View style={[styles.wastePill, { backgroundColor: wasteColor(waste) + '33' }]}>
            <Text style={[styles.wasteText, { color: wasteColor(waste) }]}>
              🔥 {waste}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount)
}

function wasteColor(score: number) {
  if (score < 60) return colors.warning
  return colors.waste
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  icon:     { fontSize: 18 },
  info:     { flex: 1, gap: 2 },
  merchant: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  meta:     { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted },
  right:    { alignItems: 'flex-end', gap: 3 },
  amount:   { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textPrimary },
  wastePill:{ borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  wasteText:{ fontFamily: fontFamily.bodyBold, fontSize: 10 },
})
