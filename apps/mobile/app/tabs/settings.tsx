import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Switch, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useAuthStore } from '../../store/authStore'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [demoMode, setDemoMode] = useState(false)

  const handleLogout = () => {
    Alert.alert(
      'Wyloguj się',
      'Dr. Spender będzie smutny. Ale rozumie.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wyloguj', style: 'destructive', onPress: logout },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Ustawienia</Text>

        {/* Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Konto</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                  {user?.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Powiadomienia</Text>
          <View style={styles.card}>
            <SettingRow
              label="Komentarze Dr. Spendera"
              description="Otrzymuj powiadomienia push po transakcjach"
              value={notificationsEnabled}
              onToggle={setNotificationsEnabled}
            />
          </View>
        </View>

        {/* Demo mode */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tryb testowy</Text>
          <View style={styles.card}>
            <SettingRow
              label="Demo mode"
              description="Symulowane transakcje — bez prawdziwego konta"
              value={demoMode}
              onToggle={setDemoMode}
            />
            {demoMode && (
              <View style={styles.demoScenarios}>
                <Text style={styles.demoTitle}>Wybierz scenariusz:</Text>
                {DEMO_SCENARIOS.map((s) => (
                  <TouchableOpacity key={s.id} style={styles.scenarioBtn}>
                    <Text style={styles.scenarioEmoji}>{s.emoji}</Text>
                    <View>
                      <Text style={styles.scenarioName}>{s.name}</Text>
                      <Text style={styles.scenarioDesc}>{s.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Import */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Dane</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/transaction/new')}>
              <Text style={styles.actionLabel}>➕  Dodaj transakcję ręcznie</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.actionRow}>
              <Text style={styles.actionLabel}>📤  Importuj CSV z banku</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dr. Spender */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Postać</Text>
          <View style={[styles.card, styles.drCard]}>
            <Text style={styles.drQuote}>
              "Ustawienia to złudzenie kontroli. Twoje nawyki są prawdziwą konstytucją."
            </Text>
            <Text style={styles.drName}>— Dr. Spender</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Wyloguj się</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Spendr v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingRow({
  label, description, value, onToggle,
}: {
  label: string; description: string; value: boolean; onToggle: (v: boolean) => void
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accentLight }}
        thumbColor={colors.white}
      />
    </View>
  )
}

const DEMO_SCENARIOS = [
  { id: 'coffee-addict',       emoji: '☕', name: 'Kawoholicy',      desc: 'Waste Score: 72' },
  { id: 'subscription-zombie', emoji: '🧟', name: 'Zombie subskrypcje', desc: 'Waste Score: 78' },
  { id: 'impulse-buyer',       emoji: '🛍️', name: 'Impulsywny kupiec', desc: 'Waste Score: 68' },
  { id: 'reasonable-saver',    emoji: '💎', name: 'Wzorowy oszczędny',  desc: 'Waste Score: 15' },
]

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  scroll:        { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  heading:       { fontFamily: fontFamily.displayBold, fontSize: fontSize.xxl, color: colors.textPrimary, marginBottom: spacing.xs },
  section:       { gap: spacing.xs },
  sectionLabel:  { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4 },
  card:          { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  profileRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  avatarCircle:  { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentLight + '33', alignItems: 'center', justifyContent: 'center' },
  avatarLetter:  { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.accentLight },
  profileName:   { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.textPrimary },
  profileEmail:  { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  settingRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  settingLabel:  { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  settingDesc:   { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  demoScenarios: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  demoTitle:     { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  scenarioBtn:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  scenarioEmoji: { fontSize: 24 },
  scenarioName:  { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  scenarioDesc:  { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted },
  actionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  actionLabel:   { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textPrimary },
  chevron:       { fontFamily: fontFamily.body, fontSize: fontSize.lg, color: colors.textMuted },
  divider:       { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  drCard:        { padding: spacing.md, borderColor: colors.accentLight + '33' },
  drQuote:       { fontFamily: fontFamily.display, fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 22 },
  drName:        { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.accentLight, marginTop: spacing.sm, textAlign: 'right' },
  logoutBtn:     { borderWidth: 1, borderColor: colors.waste + '66', borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  logoutText:    { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.waste },
  version:       { textAlign: 'center', fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, paddingBottom: spacing.md },
})
