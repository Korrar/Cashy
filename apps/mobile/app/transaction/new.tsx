import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { CATEGORY_META, type Category } from '../../constants/categories'
import { useTransactionsStore } from '../../store/transactionsStore'

const schema = z.object({
  description: z.string().min(2, 'Opisz transakcję'),
  amount:      z.string().regex(/^\d+([,.]\d{1,2})?$/, 'Nieprawidłowa kwota'),
  category:    z.string() as z.ZodType<Category>,
  date:        z.string(),
})
type FormData = z.infer<typeof schema>

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]

export default function NewTransactionScreen() {
  const router = useRouter()
  const { add } = useTransactionsStore()
  const [saving, setSaving] = useState(false)

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:     format(new Date(), 'yyyy-MM-dd'),
      category: 'OTHER',
    },
  })

  const selectedCat = watch('category')

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const amount = parseFloat(data.amount.replace(',', '.'))
      await add({
        description: data.description,
        merchant:    data.description,
        amount,
        category:    data.category,
        date:        new Date(data.date).toISOString(),
        isManual:    true,
      })
      router.back()
    } catch {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Anuluj</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nowa transakcja</Text>
        <TouchableOpacity onPress={handleSubmit(onSubmit)} disabled={saving}>
          {saving
            ? <ActivityIndicator color={colors.accentLight} />
            : <Text style={styles.save}>Zapisz</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        {/* Description */}
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Opis</Text>
              <TextInput
                style={[styles.input, errors.description && styles.inputError]}
                placeholder="np. Starbucks, Żabka, Netflix..."
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
              />
              {errors.description && <Text style={styles.fieldError}>{errors.description.message}</Text>}
            </View>
          )}
        />

        {/* Amount */}
        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Kwota (PLN)</Text>
              <TextInput
                style={[styles.input, errors.amount && styles.inputError]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={value}
                onChangeText={onChange}
              />
              {errors.amount && <Text style={styles.fieldError}>{errors.amount.message}</Text>}
            </View>
          )}
        />

        {/* Date */}
        <Controller
          control={control}
          name="date"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Data</Text>
              <TextInput
                style={styles.input}
                placeholder="RRRR-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={value}
                onChangeText={onChange}
              />
            </View>
          )}
        />

        {/* Category */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Kategoria</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map(([key, meta]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.catChip,
                  selectedCat === key && { borderColor: meta.color, backgroundColor: meta.color + '22' },
                ]}
                onPress={() => setValue('category', key)}
              >
                <Text style={styles.catEmoji}>{meta.emoji}</Text>
                <Text style={[styles.catChipLabel, selectedCat === key && { color: meta.color }]}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancel:      { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.textSecondary },
  title:       { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  save:        { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.accentLight },
  form:        { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  fieldWrap:   { gap: spacing.xs },
  label:       { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  input:       { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.textPrimary, fontFamily: fontFamily.body, fontSize: fontSize.md },
  inputError:  { borderColor: colors.waste },
  fieldError:  { color: colors.waste, fontFamily: fontFamily.body, fontSize: fontSize.xs },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface },
  catEmoji:    { fontSize: 14 },
  catChipLabel:{ fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
})
