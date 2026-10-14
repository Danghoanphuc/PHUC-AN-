import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button, C, Icon, Segment, s } from '../components/ui';
import { supabase } from '../lib/supabase';
import { projectUrl, publishableKey } from '../lib/config';
import { errorMessage } from '../lib/format';
import { acceptAuthLink } from '../lib/auth-link';
export function Auth() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [phone, setPhone] = useState(''),
    [otp, setOtp] = useState('');
  const [method, setMethod] = useState('email'),
    [signup, setSignup] = useState(false),
    [sent, setSent] = useState(false),
    [phoneEnabled, setPhoneEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [link, setLink] = useState(''),
    [showLink, setShowLink] = useState(false);
  async function sendLink() {
    setBusy(true);
    setError('');
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw Error('Nhập email trước khi nhận liên kết.');
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setShowLink(true);
      setNotice(
        'Email đã gửi. Sao chép địa chỉ liên kết trong email và dán bên dưới để đăng nhập ngay trong ứng dụng.',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void fetch(`${projectUrl}/auth/v1/settings`, { headers: { apikey: publishableKey } })
      .then((r) => r.json())
      .then((r) => setPhoneEnabled(r.external?.phone === true))
      .catch(() => {});
  }, []);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (method === 'phone') {
        if (!phoneEnabled)
          throw Error(
            'Đăng nhập SMS chưa được cấu hình. Vui lòng dùng email đã được quản trị cấp quyền.',
          );
        const p = phone
          .trim()
          .replace(/[\s.-]/g, '')
          .replace(/^0/, '+84');
        if (!/^\+[1-9]\d{8,14}$/.test(p))
          throw Error('Nhập số điện thoại hợp lệ, ví dụ 09… hoặc +84…');
        if (sent) {
          const { error } = await supabase.auth.verifyOtp({
            phone: p,
            token: otp.trim(),
            type: 'sms',
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithOtp({ phone: p });
          if (error) throw error;
          setSent(true);
          setNotice('Mã xác minh đã gửi. Không chia sẻ mã với người khác.');
        }
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
          throw Error('Vui lòng nhập email hợp lệ.');
        if (signup) {
          if (password.length < 12) throw Error('Mật khẩu cần ít nhất 12 ký tự.');
          const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
          if (error) throw error;
          if (!data.session) {
            setSignup(false);
            setPassword('');
            setNotice(
              'Mở email xác nhận, sau đó quay lại đăng nhập. Tài khoản chỉ truy cập được khi quản trị đã cấp quyền.',
            );
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
        }
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          s.page,
          { flexGrow: 1, justifyContent: 'center', paddingVertical: 48 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 30 }}>
          <View style={[s.row, { gap: 12 }]}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: C.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, color: 'white', fontWeight: '800' }}>PA</Text>
            </View>
            <View>
              <Text style={[s.h2, { letterSpacing: 2 }]}>PHÚC AN</Text>
              <Text style={s.muted}>Cùng chăm chút mỗi ngày</Text>
            </View>
          </View>
          <View style={{ gap: 9 }}>
            <Text style={[s.label, { color: C.orange }]}>KHÔNG GIAN LÀM VIỆC</Text>
            <Text style={[s.title, { fontSize: 37, lineHeight: 43 }]}>
              Một ngày mới,{'\n'}mọi việc trong tay.
            </Text>
            <Text style={[s.muted, { fontSize: 15, lineHeight: 23 }]}>
              Đơn hàng, khách hàng và hoạt động kinh doanh của Phúc An, ngay trên điện thoại.
            </Text>
          </View>
          <View style={[s.card, { padding: 22, gap: 18 }]}>
            <Text style={s.h2}>{signup ? 'Kích hoạt tài khoản' : 'Chào bạn, đăng nhập nhé'}</Text>
            <Segment
              values={[
                { value: 'email', label: 'Email' },
                { value: 'phone', label: 'Điện thoại' },
              ]}
              selected={method}
              onSelect={(v) => {
                setMethod(v);
                setError('');
                setSignup(false);
                setSent(false);
              }}
            />
            {method === 'email' ? (
              <>
                <View style={{ gap: 7 }}>
                  <Text style={s.muted}>Email</Text>
                  <TextInput
                    accessibilityLabel="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="username"
                    placeholder="Email được cấp quyền"
                    style={s.input}
                  />
                </View>
                <View style={{ gap: 7 }}>
                  <Text style={s.muted}>Mật khẩu</Text>
                  <TextInput
                    accessibilityLabel="Mật khẩu"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType={signup ? 'newPassword' : 'password'}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    autoCapitalize="none"
                    style={s.input}
                  />
                </View>
              </>
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Số điện thoại"
                  value={phone}
                  editable={!sent}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="Số điện thoại"
                  style={s.input}
                />
                {sent && (
                  <TextInput
                    accessibilityLabel="Mã xác minh SMS"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    placeholder="Mã xác minh"
                    style={s.input}
                  />
                )}{' '}
                {!phoneEnabled && (
                  <View style={s.banner}>
                    <Text style={s.muted}>
                      SMS chưa được cấu hình. Dùng email đã được quản trị cấp quyền để đăng nhập
                      trước.
                    </Text>
                  </View>
                )}
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={[s.text, { color: C.red }]}>
                {error}
              </Text>
            )}
            {!!notice && (
              <Text accessibilityRole="alert" style={s.text}>
                {notice}
              </Text>
            )}
            {busy ? (
              <ActivityIndicator color={C.green} />
            ) : (
              <Button
                title={
                  method === 'phone'
                    ? sent
                      ? 'Xác minh số điện thoại'
                      : 'Nhận mã xác minh'
                    : signup
                      ? 'Tạo tài khoản'
                      : 'Đăng nhập'
                }
                disabled={method === 'phone' && !phoneEnabled}
                onPress={() => void submit()}
                icon="arrow-forward-outline"
              />
            )}
            {method === 'email' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSignup(!signup);
                  setError('');
                  setNotice('');
                }}
              >
                <Text style={[s.muted, { textAlign: 'center', color: C.green }]}>
                  {signup ? 'Đã có tài khoản? Đăng nhập' : 'Lần đầu sử dụng? Kích hoạt tài khoản'}
                </Text>
              </Pressable>
            )}
            {method === 'email' && (
              <>
                <Button
                  title="Nhận liên kết đăng nhập email"
                  secondary
                  disabled={busy}
                  onPress={() => void sendLink()}
                />
                <Pressable accessibilityRole="button" onPress={() => setShowLink(!showLink)}>
                  <Text style={[s.muted, { textAlign: 'center' }]}>
                    Tôi đã có liên kết xác minh
                  </Text>
                </Pressable>
                {showLink && (
                  <>
                    <TextInput
                      accessibilityLabel="Liên kết xác minh email"
                      value={link}
                      onChangeText={setLink}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      placeholder="Dán liên kết từ email tại đây"
                      style={s.input}
                    />
                    <Button
                      title="Xác minh & đăng nhập"
                      disabled={busy || !link}
                      onPress={() => {
                        setBusy(true);
                        setError('');
                        void acceptAuthLink(link)
                          .catch((e) => setError(errorMessage(e)))
                          .finally(() => setBusy(false));
                      }}
                    />
                  </>
                )}
              </>
            )}
          </View>
          <View style={[s.row, { alignSelf: 'center' }]}>
            <Icon name="shield-checkmark-outline" size={17} color={C.muted} />
            <Text style={s.muted}>Chỉ dành cho đội ngũ Phúc An</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
