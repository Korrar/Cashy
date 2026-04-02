import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSize, fontFamily } from '../../constants/theme'
import { useDrSpenderStore } from '../../store/drSpenderStore'

function TabIcon({ emoji, label, focused, badge }: {
  emoji: string; label: string; focused: boolean; badge?: number
}) {
  return (
    <View style={styles.tabItem}>
      <View>
        <Text style={[styles.emoji, focused && styles.emojiFocused]}>{emoji}</Text>
        {!!badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  )
}

export default function TabsLayout() {
  const unread = useDrSpenderStore((s) => s.unreadCount)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🎩" label="Dr. Spender" focused={focused} badge={unread} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📈" label="Statystyki" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" label="Ustawienia" focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor:  colors.border,
    borderTopWidth:  1,
    height:          72,
    paddingBottom:   8,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  emoji:        { fontSize: 22, opacity: 0.5 },
  emojiFocused: { opacity: 1 },
  label:        { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted },
  labelFocused: { color: colors.accentLight },
  badge:        { position: 'absolute', top: -4, right: -8, backgroundColor: colors.waste, borderRadius: 999, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:    { color: colors.white, fontSize: 9, fontFamily: fontFamily.bodyBold },
})
