import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { Link } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  name:            z.string().min(2, 'Min. 2 znaki'),
  email:           z.string().email('Nieprawidłowy e-mail'),
  password:        z.string().min(8, 'Min. 8 znaków'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Hasła się nie zgadzają',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function RegisterScreen() {
  const { register, isLoading, error } = useAuthStore()

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try { await register(data.email, data.password, data.name) }
    catch { /* error shown via store */ }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>Spendr</Text>
          <Text style={styles.tagline}>Dr. Spender nie może się doczekać.</Text>
        </View>

        <View style={styles.form}>
          {(['name', 'email', 'password', 'confirmPassword'] as const).map((field) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: { onChange, value } }) => (
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={[styles.input, errors[field] && styles.inputError]}
                    placeholder={
                      field === 'name'            ? 'Imię / pseudonim' :
                      field === 'email'           ? 'E-mail' :
                      field === 'password'        ? 'Hasło (min. 8 znaków)' :
                                                    'Potwierdź hasło'
                    }
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize={field === 'name' ? 'words' : 'none'}
                    keyboardType={field === 'email' ? 'email-address' : 'default'}
                    secureTextEntry={field === 'password' || field === 'confirmPassword'}
                    value={value}
                    onChangeText={onChange}
                  />
                  {errors[field] && (
                    <Text style={styles.fieldError}>{errors[field]?.message}</Text>
                  )}
                </View>
              )}
            />
          ))}

          {error && <Text style={styles.apiError}>{error}</Text>}

          <TouchableOpacity
            style={styles.btn}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={colors.black} />
              : <Text style={styles.btnText}>Stwórz konto</Text>
            }
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Masz już konto? </Text>
            <Link href="/auth/login">
              <Text style={styles.footerLink}>Zaloguj się</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.background },
  scroll:     { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  header:     { alignItems: 'center', marginBottom: spacing.xxl },
  logo:       { fontFamily: fontFamily.displayBold, fontSize: 48, color: colors.accentLight, letterSpacing: 2 },
  tagline:    { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  form:       { gap: spacing.md },
  fieldWrap:  { gap: 4 },
  input:      { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.textPrimary, fontFamily: fontFamily.body, fontSize: fontSize.md },
  inputError: { borderColor: colors.waste },
  fieldError: { color: colors.waste, fontFamily: fontFamily.body, fontSize: fontSize.xs },
  apiError:   { color: colors.waste, fontFamily: fontFamily.body, fontSize: fontSize.sm, textAlign: 'center' },
  btn:        { backgroundColor: colors.accentLight, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  btnText:    { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.black },
  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  footerText: { color: colors.textSecondary, fontFamily: fontFamily.body, fontSize: fontSize.sm },
  footerLink: { color: colors.accentLight, fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm },
})
