import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '../components/Pressable';

import { ProfilePhoto } from '../components/ProfilePhoto';
import { Collapsible } from '../components/Collapsible';
import { ProfileEditor } from '../components/business/ProfileEditor';
import { BadgeGrid } from '../components/BadgeGrid';
import { BackButton } from '../components/BackButton';
import { useVenuesByIds } from '../hooks/useVenuesByIds';
import { useCampaigns } from '../context/CampaignsContext';
import { useLoyalty } from '../context/LoyaltyContext';
import { accountKey, MIN_PASSWORD_LENGTH, normalizeUsername, type User } from '../lib/auth';
import { downloadMyData } from '../lib/dataExport';
import { availyPoints } from '../lib/loyalty';
import { colors, themed } from '../theme';

type Props = {
  user: User | null;
  onBack: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onChangeUsername: (username: string) => Promise<string | null>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<string | null>;
  onChangeEmail: (email: string, password: string) => Promise<string | null>;
  onSendVerification: () => Promise<string | null>;
  onVerifyEmail: (code: string) => Promise<string | null>;
  onDeleteAccount: () => Promise<void>;
  onFreezeAccount: () => Promise<void>;
  onOpenMyProfile: () => void;
  onOpenVerification: () => void; // business: Daha fazla > İşletme doğrulama
};

export function ProfileScreen({
  user,
  onBack,
  onLogin,
  onRegister,
  onChangeUsername,
  onChangePassword,
  onChangeEmail,
  onSendVerification,
  onVerifyEmail,
  onDeleteAccount,
  onFreezeAccount,
  onOpenMyProfile,
  onOpenVerification,
}: Props) {
  const business = user?.role === 'business';
  // Business: its venue, edited from here
  const { venues, refresh: refreshVenue } = useVenuesByIds(business && user?.venueId ? [user.venueId] : []);
  const venue = venues[0];
  const { programs } = useLoyalty();
  const { coupons } = useCampaigns();

  if (!user || user.isGuest) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text style={styles.title}>Profil</Text>
        </View>
        <View style={styles.guest}>
          {user && <Text style={styles.name}>{user.name}</Text>}
          <Text style={styles.muted}>
            Misafir olarak geziyorsun. Misafir check-in'leri daha az sayılır. Kayıt olursan tam sayılır ve
            puanların korunur.
          </Text>
          <Pressable style={styles.primary} onPress={onRegister}>
            <Text style={styles.primaryText}>Kayıt ol</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onLogin}>
            <Text style={styles.secondaryText}>Hesabım var, giriş yap</Text>
          </Pressable>
          {user && (
            <Text style={styles.muted}>
              Başka bir hesapla giriş yaparsan bu misafir hesabının puanları o hesaba geçmez.
            </Text>
          )}
          {user && (
            <Text style={styles.text}>
              Misafir puanın: {user.points ?? 0} (misafirler her şeyden yarım puan alır)
            </Text>
          )}
          {user?.badges && <BadgeGrid badges={user.badges} />}
        </View>
      </ScrollView>
    );
  }

  const stamps = programs.reduce((sum, p) => sum + (p.member?.totalStamps ?? 0), 0);
  const used = business ? 0 : coupons.filter((c) => c.redeemedAt).length;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <BackButton onPress={onBack} />
        <Text style={styles.title}>{business ? 'İşletme Profili' : 'Profil ayarları'}</Text>
      </View>

      <View style={styles.card}>
        {!business && user.username && user.token ? (
          <ProfilePhoto username={user.username} token={user.token} />
        ) : null}
        <Text style={styles.name}>{user.username ? `@${user.username}` : user.name}</Text>
        <Text style={styles.muted}>
          {user.email} · {user.role === 'business' ? 'İşletme hesabı' : 'Bireysel hesap'}
        </Text>
        {!business && user.customerCode && (
          <Text style={styles.text}>
            Müşteri kodun: <Text style={styles.code}>{user.customerCode}</Text>
          </Text>
        )}
        {/* Points, badges and visited venues are on the profile behind the top-right icon */}
        {!business && (
          <Pressable style={styles.secondary} onPress={onOpenMyProfile}>
            <Text style={styles.secondaryText}>
              Profilimi gör · {(user.points ?? 0) + availyPoints(stamps, used)} puan, rozetler, mekanlar
            </Text>
          </Pressable>
        )}
        {user.emailVerified && <Text style={styles.success}>✓ E-posta doğrulandı</Text>}
      </View>

      {user.email && !user.emailVerified && (
        <VerifyEmail email={user.email} onChangeEmail={onChangeEmail} onSend={onSendVerification} onVerify={onVerifyEmail} />
      )}

      {business && venue && (
        <View style={styles.card}>
          <View style={styles.verifyRow}>
            <Text style={[styles.bold, styles.flex, venue.verified && styles.success]}>
              {venue.verified ? '✓ Doğrulanmış işletme' : 'Doğrulanmamış işletme'}
            </Text>
            {!venue.verified && (
              <Pressable style={styles.smallPrimary} onPress={onOpenVerification}>
                <Text style={styles.primaryText}>Doğrula</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.muted}>
            {venue.verified
              ? 'Müşteriler mekan sayfanda ✓ rozetini görür.'
              : 'Mekan sahipliğin doğrulanınca sayfanda ✓ rozeti çıkar.'}
          </Text>
        </View>
      )}

      {business ? (
        <View style={styles.section}>
          {venue && user.token && <ProfileEditor venue={venue} token={user.token} onSaved={refreshVenue} />}
        </View>
      ) : null}

      {/* A business has these under Daha fazla > Ayarlar */}
      {!business && (
        <AccountSettings
          user={user}
          onChangeUsername={onChangeUsername}
          onChangePassword={onChangePassword}
          onChangeEmail={onChangeEmail}
          onFreezeAccount={onFreezeAccount}
          onDeleteAccount={onDeleteAccount}
        />
      )}
    </ScrollView>
  );
}

type AccountProps = Pick<
  Props,
  'onChangeUsername' | 'onChangePassword' | 'onChangeEmail' | 'onFreezeAccount' | 'onDeleteAccount'
> & { user: User };

/** "Verilerimi indir" (KVKK): everything kept about me on the server, as a JSON file. */
function MyData({ token }: { token: string | null | undefined }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  if (!token) return null;
  return (
    <Collapsible title="Verilerimi indir" summary="Sunucuda senin hakkında tutulan her şey, tek dosyada">
      <Text style={styles.muted}>
        Hesap bilgilerin, check-in'lerin, puanların, yorumların, arkadaşların, grupların, kuponların ve sadakat
        kartların bir JSON dosyası olarak iner. Şifren ve telefon numaran dosyada yer almaz.
      </Text>
      <Pressable
        style={[styles.secondary, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          const error = await downloadMyData(token);
          setBusy(false);
          setNote(error ? { ok: false, text: error } : { ok: true, text: '✓ Verilerin hazırlandı.' });
        }}
      >
        <Text style={styles.secondaryText}>{busy ? 'Hazırlanıyor…' : 'Verilerimi indir'}</Text>
      </Pressable>
      {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}
    </Collapsible>
  );
}

/** User name, e-mail, password, freeze and delete: Profil ayarları (customers) or Ayarlar (businesses); Çıkış Yap is in Daha fazla. */
export function AccountSettings({
  user,
  onChangeUsername,
  onChangePassword,
  onChangeEmail,
  onFreezeAccount,
  onDeleteAccount,
}: AccountProps) {
  const [username, setUsername] = useState(user.username ?? '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Shown right under the user name field, where the change is made
  const [usernameMessage, setUsernameMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const savePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage({ ok: false, text: `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` });
      return;
    }
    const error = await onChangePassword(oldPassword, newPassword);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Şifre değiştirildi.' });
    if (!error) {
      setOldPassword('');
      setNewPassword('');
    }
  };

  return (
    <>
      <Collapsible title="Kullanıcı adını değiştir" summary={user.username ? `Şu an @${user.username}` : undefined}>
        <TextInput
          value={username}
          onChangeText={(text) => {
            setUsername(normalizeUsername(text));
            setUsernameMessage(null);
          }}
          placeholder="kullaniciadi"
          style={styles.input}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.muted}>Arkadaşların seni bununla bulur; eski adın başkası tarafından alınabilir.</Text>
        <Pressable
          style={styles.secondary}
          onPress={async () => {
            if (normalizeUsername(username) === user.username) {
              setUsernameMessage({ ok: false, text: 'Bu zaten senin kullanıcı adın.' });
              return;
            }
            const error = await onChangeUsername(username);
            setUsernameMessage(
              error ? { ok: false, text: error } : { ok: true, text: `✓ Kullanıcı adın @${normalizeUsername(username)} olarak değişti.` },
            );
          }}
        >
          <Text style={styles.secondaryText}>Kaydet</Text>
        </Pressable>
        {usernameMessage && (
          <Text style={usernameMessage.ok ? styles.success : styles.error}>{usernameMessage.text}</Text>
        )}
      </Collapsible>

      <Collapsible title="E-posta adresini değiştir" summary={user.email ? `Şu an ${user.email}` : undefined}>
        <EmailForm current={user.email} onSave={onChangeEmail} />
      </Collapsible>

      <Collapsible title="Şifreni değiştir" summary="Mevcut şifren ve yeni şifren">
        <TextInput
          value={oldPassword}
          onChangeText={setOldPassword}
          placeholder="Mevcut şifre"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Yeni şifre"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          style={styles.input}
        />
        <Pressable style={styles.secondary} onPress={savePassword}>
          <Text style={styles.secondaryText}>Şifreyi değiştir</Text>
        </Pressable>
        {message && <Text style={message.ok ? styles.success : styles.error}>{message.text}</Text>}
      </Collapsible>

      <MyData token={user.token} />

      <Collapsible title="Hesabı geçici olarak dondur" summary="Silmeden profilini ve aktiviteni gizler">
        <Text style={styles.muted}>
          Profilin, check-in'lerin, yorumların ve sıralamadaki yerin kimseye görünmez; çıkış yapılır. Verilerin silinmez:
          tekrar giriş yaptığında hesabın olduğu gibi geri açılır.
        </Text>
        <TypedConfirm
          word={user.username ?? 'dondur'}
          action="Hesabımı dondur"
          question="Hesabını dondurmak istediğine emin misin?"
          onConfirm={onFreezeAccount}
        />
      </Collapsible>

      <Collapsible title="Hesabı sil" summary="Hesabın ve yorumların kalıcı olarak silinir">
        <Text style={styles.muted}>
          Hesabın, yorumların, arkadaşlıkların ve puanların silinir; check-in'lerin yalnızca adsız doluluk bilgisi olarak
          kalır. Bu geri alınamaz.
        </Text>
        <TypedConfirm
          word={user.username ?? 'sil'}
          action="Hesabımı kalıcı olarak sil"
          question="Hesabını kalıcı olarak silmek istediğine emin misin? Bu geri alınamaz."
          onConfirm={onDeleteAccount}
        />
      </Collapsible>
    </>
  );
}

/** New e-mail + current password (so someone holding the phone cannot take the account over). */
/**
 * "E-posta henüz doğrulanmadı" + Doğrula: the e-mail (a new one needs the password), then the
 * 6-digit code sent there.
 */
function VerifyEmail({
  email,
  onChangeEmail,
  onSend,
  onVerify,
}: {
  email: string;
  onChangeEmail: (email: string, password: string) => Promise<string | null>;
  onSend: () => Promise<string | null>;
  onVerify: (code: string) => Promise<string | null>;
}) {
  const [step, setStep] = useState<'closed' | 'email' | 'code'>('closed');
  const [address, setAddress] = useState(email);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = address.trim().toLowerCase() !== email;

  const sendCode = async () => {
    if (changed) {
      const error = await onChangeEmail(address, password);
      if (error) return setNote({ ok: false, text: error });
    }
    const error = await onSend();
    if (error) return setNote({ ok: false, text: error });
    setNote({ ok: true, text: `${address.trim().toLowerCase()} adresine 6 haneli kod gönderdik.` });
    setStep('code');
  };

  return (
    <View style={styles.card}>
      <View style={styles.verifyRow}>
        <Text style={[styles.bold, styles.flex]}>E-posta henüz doğrulanmadı</Text>
        {step === 'closed' && (
          <Pressable style={styles.smallPrimary} onPress={() => setStep('email')}>
            <Text style={styles.primaryText}>Doğrula</Text>
          </Pressable>
        )}
      </View>
      {step === 'email' && (
        <>
          <Text style={styles.muted}>Kodu hangi adrese gönderelim? Şifreni unutursan hesabını bu adresle kurtarırsın.</Text>
          <TextInput
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setNote(null);
            }}
            placeholder="E-posta"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
          {changed && (
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mevcut şifren (e-posta değişecek)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              style={styles.input}
            />
          )}
          <Pressable style={styles.primary} onPress={sendCode}>
            <Text style={styles.primaryText}>Kod gönder</Text>
          </Pressable>
          <Pressable onPress={() => setStep('code')} hitSlop={8}>
            <Text style={styles.link}>Kodu zaten aldım</Text>
          </Pressable>
        </>
      )}
      {step === 'code' && (
        <>
          <TextInput
            value={code}
            onChangeText={(text) => {
              setCode(text.replace(/\D/g, '').slice(0, 6));
              setNote(null);
            }}
            placeholder="6 haneli kod"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            style={styles.input}
          />
          <Pressable
            style={styles.primary}
            onPress={async () => {
              const error = await onVerify(code);
              setNote(error ? { ok: false, text: error } : { ok: true, text: '✓ E-posta adresin doğrulandı.' });
            }}
          >
            <Text style={styles.primaryText}>Doğrula</Text>
          </Pressable>
          <Pressable onPress={() => setStep('email')} hitSlop={8}>
            <Text style={styles.link}>Kod gelmedi mi? Tekrar gönder</Text>
          </Pressable>
        </>
      )}
      {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}
    </View>
  );
}

function EmailForm({ current, onSave }: { current: string | null; onSave: (email: string, password: string) => Promise<string | null> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      <TextInput
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setNote(null);
        }}
        placeholder="Yeni e-posta"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Mevcut şifren"
        placeholderTextColor={colors.placeholder}
        secureTextEntry
        style={styles.input}
      />
      <Text style={styles.muted}>Giriş yaparken artık yeni e-postayı kullanırsın. Kullanıcı adınla girişin değişmez.</Text>
      <Pressable
        style={styles.secondary}
        onPress={async () => {
          if (email.trim().toLowerCase() === current) return setNote({ ok: false, text: 'Bu zaten senin e-posta adresin.' });
          const error = await onSave(email, password);
          setNote(error ? { ok: false, text: error } : { ok: true, text: `✓ E-posta adresin ${email.trim().toLowerCase()} olarak değişti.` });
          if (!error) setPassword('');
        }}
      >
        <Text style={styles.secondaryText}>E-postayı değiştir</Text>
      </Pressable>
      {note && <Text style={note.ok ? styles.success : styles.error}>{note.text}</Text>}
    </>
  );
}

/**
 * Two steps for actions that hide or remove the account: "Emin misin?", then the
 * user name has to be typed before the button works.
 */
function TypedConfirm({ word, action, question, onConfirm }: { word: string; action: string; question: string; onConfirm: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = normalizeUsername(typed) === word.toLowerCase();

  if (!asking) {
    return (
      <Pressable onPress={() => setAsking(true)}>
        <Text style={styles.deleteLink}>{action}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.confirm}>
      <Text style={styles.confirmQuestion}>{question}</Text>
      <Text style={styles.muted}>
        Eminsen onaylamak için kullanıcı adını yaz: <Text style={styles.code}>{word}</Text>
      </Text>
      {/* Empty, clearly framed box: the name is typed, not pre-filled */}
      <TextInput
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Kullanıcı adını yaz"
        style={[styles.confirmInput, ok && styles.confirmInputOk]}
      />
      <View style={styles.row}>
        <Pressable
          style={[styles.danger, styles.flex, (!ok || busy) && styles.dangerOff]}
          disabled={!ok || busy}
          onPress={async () => {
            setBusy(true);
            await onConfirm();
          }}
        >
          <Text style={styles.primaryText}>Eminim</Text>
        </Pressable>
        <Pressable
          style={[styles.secondary, styles.flex]}
          onPress={() => {
            setAsking(false);
            setTyped('');
          }}
        >
          <Text style={styles.secondaryText}>Vazgeç</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  confirm: { gap: 10, padding: 12, borderRadius: 12, backgroundColor: colors.cream },
  confirmQuestion: { fontSize: 15, fontWeight: '700', color: colors.text },
  confirmInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmInputOk: { borderColor: colors.success },
  dangerOff: { opacity: 0.4 },
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 48, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  guest: { paddingHorizontal: 8, gap: 16 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  code: { fontWeight: '800', letterSpacing: 1 },
  section: { gap: 14 },
  input: { padding: 12, borderRadius: 12, backgroundColor: colors.cream, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  primary: { paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
  secondary: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  danger: { paddingVertical: 12, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center' },
  deleteLink: { color: colors.danger, fontWeight: '600' },
  success: { color: colors.success, fontWeight: '600' },
  bold: { fontSize: 15, fontWeight: '800', color: colors.text },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallPrimary: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary },
  link: { color: colors.primary, fontWeight: '600' },
  error: { color: colors.danger },
}));
