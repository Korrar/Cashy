import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { Link } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { colors, spacing, fontSize, radius, fontFamily } from '../../constants/theme'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  email:    z.string().email('Nieprawidłowy e-mail'),
  password: z.string().min(6, 'Min. 6 znaków'),
})
type FormData = z.infer<typeof schema>

export default function LoginScreen() {
  const { login, isLoading, error } = useAuthStore()
  const [showPass, setShowPass] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try { await login(data.email, data.password) }
    catch { /* error shown via store */ }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Spendr</Text>
        <Text style={styles.tagline}>Dr. Spender czeka na Twoje pieniądze.</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldWrap}>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="E-mail"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
              />
              {errors.email && <Text style={styles.fieldError}>{errors.email.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View style={styles.fieldWrap}>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                  placeholder="Hasło"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                  value={value}
                  onChangeText={onChange}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass((v) => !v)}>
                  <Text style={styles.eyeText}>{showPass ? 'ukryj' : 'pokaż'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}
            </View>
          )}
        />

        {error && <Text style={styles.apiError}>{error}</Text>}

        <TouchableOpacity
          style={styles.btn}
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color={colors.black} />
            : <Text style={styles.btnText}>Zaloguj się</Text>
          }
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Nie masz konta? </Text>
          <Link href="/auth/register">
            <Text style={styles.footerLink}>Zarejestruj się</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  header:       { alignItems: 'center', marginBottom: spacing.xxl },
  logo:         { fontFamily: fontFamily.displayBold, fontSize: 48, color: colors.accentLight, letterSpacing: 2 },
  tagline:      { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  form:         { gap: spacing.md },
  fieldWrap:    { gap: 4 },
  input:        { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.textPrimary, fontFamily: fontFamily.body, fontSize: fontSize.md },
  inputError:   { borderColor: colors.waste },
  passwordWrap: { position: 'relative' },
  passwordInput:{ paddingRight: 72 },
  eyeBtn:       { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
  eyeText:      { color: colors.textSecondary, fontFamily: fontFamily.body, fontSize: fontSize.xs },
  fieldError:   { color: colors.waste, fontFamily: fontFamily.body, fontSize: fontSize.xs },
  apiError:     { color: colors.waste, fontFamily: fontFamily.body, fontSize: fontSize.sm, textAlign: 'center' },
  btn:          { backgroundColor: colors.accentLight, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  btnText:      { fontFamily: fontFamily.bodyBold, fontSize: fontSize.md, color: colors.black },
  footer:       { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  footerText:   { color: colors.textSecondary, fontFamily: fontFamily.body, fontSize: fontSize.sm },
  footerLink:   { color: colors.accentLight, fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm },
})
