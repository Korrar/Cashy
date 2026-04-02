import { TouchableOpacity, View, Text, StyleSheet } from 'react-native'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useDrSpenderStore } from '../../store/drSpenderStore'
import type { DrSpenderComment } from '../../store/drSpenderStore'

interface Props {
  comment: DrSpenderComment
}

const MOOD_ICON: Record<string, string> = {
  ALARMED:       '😱',
  DISAPPOINTED:  '😔',
  SARCASTIC:     '🧐',
  PHILOSOPHICAL: '🤔',
  DARK_SATISFIED:'😈',
  IMPRESSED:     '😲',
  DEFAULT:       '🎩',
}

export function DrSpenderWidget({ comment }: Props) {
  const markRead = useDrSpenderStore((s) => s.markRead)

  const icon = MOOD_ICON[comment.mood] ?? MOOD_ICON.DEFAULT

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.85}
      onPress={() => !comment.isRead && markRead(comment.id)}
    >
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{icon}</Text>
        {!comment.isRead && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.bubble}>
        <Text style={styles.name}>Dr. Spender</Text>
        <Text style={styles.text}>{comment.text}</Text>
        <View style={styles.footer}>
          <View style={[styles.scorePill, { backgroundColor: wasteColor(comment.wasteScore) + '33' }]}>
            <Text style={[styles.scoreText, { color: wasteColor(comment.wasteScore) }]}>
              Waste: {comment.wasteScore}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function wasteColor(score: number) {
  if (score < 30) return colors.savings
  if (score < 60) return colors.warning
  return colors.waste
}

const styles = StyleSheet.create({
  container:  { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.accentLight + '44' },
  avatarWrap: { alignItems: 'center', position: 'relative' },
  avatarText: { fontSize: 36 },
  unreadDot:  { position: 'absolute', top: 0, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.waste },
  bubble:     { flex: 1, gap: spacing.xs },
  name:       { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.accentLight },
  text:       { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  footer:     { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  scorePill:  { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText:  { fontFamily: fontFamily.bodyBold, fontSize: 10 },
})
