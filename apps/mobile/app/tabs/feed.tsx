import { useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useDrSpenderStore } from '../../store/drSpenderStore'
import type { Suggestion } from '../../store/drSpenderStore'

const MOOD_ICON: Record<string, string> = {
  ALARMED: '😱', DISAPPOINTED: '😔', SARCASTIC: '🧐',
  PHILOSOPHICAL: '🤔', DARK_SATISFIED: '😈', IMPRESSED: '😲', DEFAULT: '🎩',
}

const TYPE_ICON: Record<string, string> = {
  SWAP: '🔄', COOK: '🍳', CANCEL: '🚫', RULE: '📏', DOWNGRADE: '⬇️', DUPLICATE: '♊',
}

export default function FeedScreen() {
  const { comments, suggestions, fetchComments, fetchSuggestions, markRead, acceptSuggestion, dismissSuggestion } =
    useDrSpenderStore()
  const isLoading = useDrSpenderStore((s) => s.isLoading)

  useEffect(() => {
    fetchComments()
    fetchSuggestions()
  }, [])

  const activeSuggestions = suggestions.filter((s) => s.status === 'ACTIVE')

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { fetchComments(); fetchSuggestions() }}
            tintColor={colors.accentLight}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>Dr. Spender</Text>
            <Text style={styles.subheading}>Twój osobisty finansowy upiór</Text>

            {/* Suggestions */}
            {activeSuggestions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sugestie</Text>
                {activeSuggestions.map((sg) => (
                  <SuggestionCard
                    key={sg.id}
                    suggestion={sg}
                    onAccept={() => acceptSuggestion(sg.id)}
                    onDismiss={() => dismissSuggestion(sg.id)}
                  />
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Komentarze</Text>
          </>
        }
        data={comments}
        keyExtractor={(c) => c.id}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[styles.commentCard, !c.isRead && styles.commentCardUnread]}
            onPress={() => !c.isRead && markRead(c.id)}
            activeOpacity={0.8}
          >
            <View style={styles.commentHeader}>
              <Text style={styles.moodIcon}>{MOOD_ICON[c.mood] ?? '🎩'}</Text>
              <View style={styles.commentMeta}>
                <Text style={styles.commentName}>Dr. Spender</Text>
                <Text style={styles.commentDate}>
                  {format(new Date(c.createdAt), 'd MMM, HH:mm', { locale: pl })}
                </Text>
              </View>
              {!c.isRead && <View style={styles.unread} />}
            </View>
            <Text style={styles.commentText}>{c.text}</Text>
            <View style={[styles.scorePill, { backgroundColor: wasteColor(c.wasteScore) + '22' }]}>
              <Text style={[styles.scoreText, { color: wasteColor(c.wasteScore) }]}>
                Waste Score: {c.wasteScore}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Dr. Spender obserwuje. Jeszcze nic do skomentowania.
          </Text>
        }
      />
    </SafeAreaView>
  )
}

function SuggestionCard({
  suggestion: sg,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion
  onAccept: () => void
  onDismiss: () => void
}) {
  return (
    <View style={styles.suggCard}>
      <View style={styles.suggHeader}>
        <Text style={styles.suggIcon}>{TYPE_ICON[sg.type] ?? '💡'}</Text>
        <Text style={styles.suggTitle}>{sg.title}</Text>
        <Text style={styles.suggSavings}>+{formatPLN(sg.annualSavings)}/rok</Text>
      </View>
      <Text style={styles.suggDesc}>{sg.description}</Text>
      <View style={styles.suggActions}>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={styles.dismissText}>Pomiń</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>
            {sg.actionLabel ?? 'Zrobię to'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount)
}

function wasteColor(score: number) {
  if (score < 30) return colors.savings
  if (score < 60) return colors.warning
  return colors.waste
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.background },
  list:              { padding: spacing.md, paddingBottom: 80, gap: spacing.md },
  heading:           { fontFamily: fontFamily.displayBold, fontSize: fontSize.hero, color: colors.accentLight },
  subheading:        { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  section:           { gap: spacing.sm },
  sectionTitle:      { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs },

  commentCard:       { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  commentCardUnread: { borderColor: colors.accentLight + '55' },
  commentHeader:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moodIcon:          { fontSize: 28 },
  commentMeta:       { flex: 1 },
  commentName:       { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.accentLight },
  commentDate:       { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted },
  unread:            { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.waste },
  commentText:       { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  scorePill:         { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  scoreText:         { fontFamily: fontFamily.bodyBold, fontSize: 10 },

  suggCard:          { backgroundColor: colors.surfaceHigh, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.accentLight + '33' },
  suggHeader:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  suggIcon:          { fontSize: 22 },
  suggTitle:         { flex: 1, fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.textPrimary },
  suggSavings:       { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.savingsLight },
  suggDesc:          { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 18 },
  suggActions:       { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  dismissBtn:        { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  dismissText:       { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textSecondary },
  acceptBtn:         { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.accentLight },
  acceptText:        { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.black },

  empty:             { textAlign: 'center', color: colors.textMuted, fontFamily: fontFamily.body, fontSize: fontSize.sm, paddingVertical: spacing.xxl },
})
