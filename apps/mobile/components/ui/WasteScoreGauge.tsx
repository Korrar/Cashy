import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { colors, fontFamily, fontSize } from '../../constants/theme'

interface Props {
  score: number   // 0–100
  size?: number
}

function scoreColor(score: number): string {
  if (score < 30) return colors.savings
  if (score < 60) return colors.warning
  return colors.waste
}

function scoreLabel(score: number): string {
  if (score < 20) return 'Wzorowy'
  if (score < 40) return 'Nieźle'
  if (score < 60) return 'Uwaga'
  if (score < 80) return 'Marnotraw.'
  return 'Katastrofa'
}

export function WasteScoreGauge({ score, size = 120 }: Props) {
  const clamp   = Math.max(0, Math.min(100, score))
  const r       = (size - 16) / 2
  const cx      = size / 2
  const cy      = size / 2
  const circ    = 2 * Math.PI * r
  // Half-circle gauge: we use 75% of circumference for 0-100
  const sweep   = circ * 0.75
  const fill    = sweep * (clamp / 100)
  const dash    = `${fill} ${circ}`
  const offset  = circ * 0.125   // start at 7 o'clock (rotate -225deg below)
  const color   = scoreColor(clamp)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={colors.surfaceHigh}
          strokeWidth={8}
          strokeDasharray={`${sweep} ${circ}`}
          strokeDashoffset={-offset}
          strokeLinecap="round"
          rotation={-225}
          origin={`${cx},${cy}`}
        />
        {/* Fill */}
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={dash}
          strokeDashoffset={-offset}
          strokeLinecap="round"
          rotation={-225}
          origin={`${cx},${cy}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color }]}>{clamp}</Text>
        <Text style={styles.label}>{scoreLabel(clamp)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  score:  { fontFamily: fontFamily.displayBold, fontSize: fontSize.xxl },
  label:  { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
})
