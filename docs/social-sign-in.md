# Google ve Apple ile giriş: kurulum

Kod hazır. Butonlar, aşağıdaki kimlikler hem sunucuya hem uygulamaya girilene kadar **gizli** kalır
(`GET /v1/auth/providers` boş liste döner). Kimlikleri sen oluşturmalısın; bunlar gizli değildir.

## Nasıl çalışır
1. Uygulama Google/Apple penceresini açar, kişi onaylar, uygulama bir **ID token** (imzalı JWT) alır.
2. Uygulama bunu `POST /v1/auth/oauth` ile sunucuya yollar.
3. Sunucu imzayı sağlayıcının açık anahtarlarıyla (JWKS) doğrular; token'ın bizim uygulamamız için
   üretildiğini (`aud`), süresini ve yayıncıyı kontrol eder (`backend/app/social_auth.py`).
4. İlk girişte hesap açılır (kullanıcı adı e-postadan türetilir, sonra değiştirilebilir; şifre yoktur).
   Aynı e-postayla zaten hesap varsa ve sağlayıcı e-postayı doğrulamışsa o hesaba bağlanır.
   Bağlantı `user_identities` tablosunda tutulur.

## Google
1. https://console.cloud.google.com → yeni proje → **APIs & Services > OAuth consent screen**: uygulama adı
   "availo", destek e-postası, gizlilik politikası bağlantısı.
2. **Credentials > Create credentials > OAuth client ID**, üç tane:
   - **Web application**: Authorized JavaScript origins'e web adresini (ve `http://localhost:8081`) ekle.
   - **iOS**: bundle id (ör. `app.availo.ios`, `app.json > expo.ios.bundleIdentifier` ile aynı olmalı).
   - **Android**: paket adı + imza sertifikasının SHA-1'i (`eas credentials` gösterir).
3. `mobile/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `..._IOS_...`, `..._ANDROID_...`
4. Kök `.env` (backend): `GOOGLE_CLIENT_IDS=["<web>","<ios>","<android>"]`, sonra `docker compose up -d backend`.

## Apple (yalnızca iPhone'da görünür)
1. Apple Developer Program üyeliği gerekir (yıllık $99).
2. developer.apple.com → Certificates, IDs & Profiles → **Identifiers** → uygulamanın App ID'sinde
   **Sign In with Apple**'ı aç.
3. `app.json`'a `expo.ios.bundleIdentifier` ekle (ör. `app.availo.ios`); `usesAppleSignIn` ve eklenti hazır.
4. Kök `.env`: `APPLE_AUDIENCES=["app.availo.ios"]`.
5. Expo Go'da Apple girişi Expo'nun kendi bundle id'siyle gelir; gerçek test için geliştirme derlemesi
   (`eas build --profile development`) gerekir.

Not: App Store kuralı: uygulamada Google girişi varsa iOS'ta Apple girişi de sunulmalı.
