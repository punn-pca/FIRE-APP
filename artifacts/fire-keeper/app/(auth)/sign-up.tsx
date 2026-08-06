import { useSignUp, useAuth } from '@clerk/expo';
import { Link, Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  if (isSignedIn || signUp.status === 'complete') return <Redirect href="/" />;

  const needsVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address');
  const loading = fetchStatus === 'fetching';

  const handleStart = async () => {
    setMessage('');
    const result = await signUp.password({ emailAddress: emailAddress.trim(), password });
    if (result.error) {
      setMessage(result.error.message ?? 'สมัครสมาชิกไม่สำเร็จ');
      return;
    }
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    setMessage('');
    const result = await signUp.verifications.verifyEmailCode({ code });
    if (result.error) {
      setMessage(result.error.message ?? 'รหัสยืนยันไม่ถูกต้อง');
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => router.replace(decorateUrl('/') as never),
      });
    }
  };

  const errorText = message || errors.fields.emailAddress?.message || errors.fields.password?.message || errors.fields.code?.message;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.primary }]}>FIRE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {needsVerification ? 'ยืนยันอีเมล' : 'สร้างบัญชี'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {needsVerification ? 'กรอกรหัสที่ส่งไปยังอีเมลของคุณ' : 'สร้างพื้นที่ส่วนตัวสำหรับบทสนทนาและความจำของคุณ'}
        </Text>
        {!needsVerification ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>อีเมล</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmailAddress}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={emailAddress}
            />
            <Text style={[styles.label, { color: colors.foreground }]}>รหัสผ่าน</Text>
            <TextInput
              autoComplete="new-password"
              onChangeText={setPassword}
              placeholder="อย่างน้อยตามข้อกำหนดของระบบ"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={password}
            />
          </>
        ) : (
          <TextInput
            autoFocus
            keyboardType="number-pad"
            onChangeText={setCode}
            placeholder="รหัสยืนยัน"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, marginTop: 22 }]}
            value={code}
          />
        )}
        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
        <Pressable
          disabled={loading || (!needsVerification && (!emailAddress || !password)) || (needsVerification && !code)}
          onPress={needsVerification ? handleVerify : handleStart}
          style={[styles.primaryButton, { backgroundColor: colors.primary }, styles.disabled]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{needsVerification ? 'ยืนยันบัญชี' : 'สมัครสมาชิก'}</Text>}
        </Pressable>
        {needsVerification ? (
          <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.resend}>
            <Text style={[styles.link, { color: colors.primary }]}>ส่งรหัสใหม่</Text>
          </Pressable>
        ) : (
          <View style={styles.linkRow}>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>มีบัญชีแล้ว? </Text>
            <Link href={"/sign-in" as never} asChild>
              <Pressable><Text style={[styles.link, { color: colors.primary }]}>เข้าสู่ระบบ</Text></Pressable>
            </Link>
          </View>
        )}
        <View nativeID="clerk-captcha" />
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, justifyContent: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 440, alignSelf: 'center', borderWidth: 1, borderRadius: 20, padding: 24 },
    kicker: { fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
    title: { fontSize: 28, fontWeight: '700', marginTop: 8 },
    subtitle: { fontSize: 13, lineHeight: 20 },
    label: { fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 7 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15 },
    primaryButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    disabled: { opacity: 0.5 },
    error: { color: '#dc2626', fontSize: 12, marginTop: 10, lineHeight: 18 },
    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    resend: { alignItems: 'center', marginTop: 18 },
    link: { fontSize: 13, fontWeight: '700' },
  });
}