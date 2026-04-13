# Implementation plan – Stockr

Živý dokument stavu vývoje. Po každém dokončeném kroku aktualizovat.

**Legenda:** ✅ hotovo · 🚧 in-progress · ⏳ pending · ❌ blokováno/odloženo

---

## Sprint 1 – Kostra ✅

- ✅ Expo 51 projekt, TypeScript, Expo Router
- ✅ `package.json`, `tsconfig.json`, `app.json`, `babel.config.js`, `.env.example`
- ✅ `supabase/schema.sql` — konsolidovaný, idempotentní, source of truth (viz sekce "Schema.sql cleanup")
- ✅ `src/types/database.ts` — TS typy + domain utility (`getExpiryStatus`, `formatExpiry`, `compareBoxesByExpiry`, `formatDateCs`, `toIsoDate`, `fromIsoDate`)
- ✅ `src/lib/supabase.ts` — klient + API (auth, warehouses, boxes, items, invitations, realtime)
- ✅ `app/_layout.tsx` — root layout, auth guard, deep link handler, `GestureHandlerRootView`
- ✅ `app/(auth)/login.tsx` — Apple Sign In s nonce, dev-only email/password fallback, `ensureWarehouse` po loginu
- ✅ `app/(auth)/_layout.tsx` — auth group layout
- ✅ `app/(app)/_layout.tsx` — stack navigator (bez nav headeru pro index screen)
- ✅ `app/(app)/index.tsx` — Dashboard s custom headerem, realtime subscription, useFocusEffect

---

## Sprint 2 – Core flow ✅

### Hlavní screeny
- ✅ `src/lib/openFoodFacts.ts` — EAN lookup + heuristické mapování kategorií
- ✅ `app/(app)/box/new.tsx` — formulář + QR náhled s placeholder tisku
- ✅ `app/(app)/scan.tsx` — QR scanner přes CameraView
- ✅ `app/(app)/box/[id].tsx` — detail bedny
- ✅ `app/(app)/box/[id]/add-items.tsx` — naskladňovací batch session

### Komponenty
- ✅ `src/components/ItemEditSheet.tsx` — edit položky
- ✅ `src/components/BoxEditSheet.tsx` — edit bedny

### Dodělávky po Sprint 2 feedback loop
- ✅ **A2** — Swipe-to-delete přes `react-native-gesture-handler` `Swipeable`
- ✅ **B** — Edit položky přes `ItemEditSheet` modal
- ✅ **C** — Nativní date picker (`@react-native-community/datetimepicker`, `display="inline"`, `locale="cs-CZ"`)
- ✅ **D** — Toggle Mřížka/Seznam + AsyncStorage perzistence
- ✅ **E** — Zobrazit QR štítek znovu přes modal
- ✅ **F** — Edit bedny + `ActionSheetIOS` menu (Štítek / Upravit / Smazat)
- ✅ **G** — Error states s retry pro Dashboard + Box detail
- ✅ **H** — Toast + haptic po přidání do fronty
- ✅ **I** — Svítilna ve scanneru (`enableTorch` prop)
- ✅ **J** — Source banner v draft formuláři (custom / OFF / manual)
- ✅ **K** — Copy QR do clipboardu
- ✅ **M** — Empty state CTA na dashboardu

### Odloženo / nezpracováno
- A1, A3 — alternativy k A2 (jen jedna přežije)
- Inline edit bedny v headeru — action sheet je čistší
- Per-box view mode perzistence — záměrně globální

---

## Session fixes & discoveries (první test run)

Při prvním pokusu o build a rozjetí appky se objevila série problémů, které jsou teď vyřešené. Zaznamenáno kvůli budoucí referenci:

### Build toolchain issues
- ✅ **Ruby / CocoaPods conflict s macOS system Ruby 2.6** — vyřešeno přes `brew install ruby` + přidání do `~/.zshrc` PATH, pak `gem install cocoapods` bez sudo
- ✅ **Expo SDK 51 × Xcode 26 / iOS 26 SDK inkompatibilita** — Apple v iOS 26 odstranil legacy macro `TARGET_IPHONE_SIMULATOR`, Expo modul `expo-dev-menu` ho ještě používal v `DevMenuViewController.swift`. Patch v `node_modules/expo-dev-menu/ios/DevMenuViewController.swift` — nahrazeno za `#if targetEnvironment(simulator)`. **POZOR:** patch se ztratí při `npm install` → do budoucna nastavit `patch-package` pro persistenci
- ✅ **Expo CLI nedefaultoval na simulátor** — explicitní `--device "iPhone 17 Pro"` nebo boot simulator přes `xcrun simctl boot` před `npx expo run:ios`

### Schema / RLS issues
- ✅ **Chicken-and-egg RLS v `createWarehouse`** — `.insert().select()` triggruje SELECT RLS na RETURNING, `is_member(id)` vyžaduje existující member record, ale ten se teprve vytváří v dalším kroku. Fix: `SECURITY DEFINER` RPC funkce `create_warehouse_for_me` (bypass RLS, atomická transakce). Viz `supabase/schema.sql`
- ✅ **Multi-warehouse ze selhaných loginů** — po dřívějších RLS failed pokusech zbyly orphan warehouses. Jednorázový cleanup SQL provedl consolidation
- ✅ **`getMyWarehouse` non-deterministic** — `limit(1)` bez `order by` vracel arbitrary warehouse → Dashboard a box/new mohly vidět jiný. Fix: `order by joined_at asc` pro deterministický výběr

### Realtime subscription issues
- ✅ **`supabase.channel('name')` cache collision** — při re-mount Expo routeru (Strict Mode nebo back nav) volání `subscribeItems`/`subscribeBoxes` s tím samým jménem vrátilo cached subscribed channel, `.on()` throwne. Fix: unique channel names s `Math.random()` + `supabase.removeChannel(channel)` v cleanup místo jen `unsubscribe()`
- ✅ **Supabase realtime publication missing tables** — `boxes`/`items` nebyly v `supabase_realtime` publication by default, žádné events nechodily. Fix: `alter publication supabase_realtime add table ...` v schema.sql (s exception handling v DO bloku kvůli idempotency)

### UI issues
- ✅ **`headerLargeTitle: true` overlap first card** — iOS large title vyžaduje ScrollView jako přímý child Stack navigatoru, ale FlatList je wrapnuté v SafeAreaView. Fix: `headerShown: false` + custom `<View><Text>Stockr</Text></View>` header v Dashboardu s `edges={['top', 'bottom']}` na SafeAreaView
- ✅ **Dashboard nerefreshuje po návratu z child screeny** — expo-router drží screeny v stack cache, `useEffect` se neřegne. Fix: `useFocusEffect` v Dashboard a box/[id] pro re-fetch při focus

### Supabase clipboard sync v simulátoru
- ⚠️ **Paste password do Apple ID v iOS Settings simulátoru nefunguje** — pro dev testing obejito přes `__DEV__`-only email/password login v `login.tsx`, test user vytvořen ručně v Supabase dashboardu (`test@stockr.local`)

---

## Schema.sql cleanup ✅

- ✅ **Konsolidován `fix-warehouse-rpc.sql` do hlavního `schema.sql`** — jediný source of truth
- ✅ **Plně idempotentní** — `create table if not exists`, `create index if not exists`, `drop policy if exists` + `create policy`, `drop trigger if exists` + `create trigger`, `create or replace function`, `on conflict do nothing` u inserts
- ✅ **Realtime publication v schematu** — 4 `alter publication supabase_realtime add table` pro boxes/items/warehouses/warehouse_members, wrapnuto v `do $$ exception when duplicate_object` pro re-runnable setup
- ✅ **Storage bucket v schematu** — `insert into storage.buckets` pro `product-images` s `public: true`
- ✅ **Handle_new_user trigger s on conflict** — ochrana proti duplicit insertu při edge cases (admin-created users)

---

## Sprint 2.5 – UI polish & tech debt 🚧

Insertnutý mezi Sprint 2 a Sprint 3. Cíl: projekt převést do angličtiny, sjednotit design language (brand green paleta + custom ikonografie), vyřešit dlouhodobý tech debt kolem buildu před tím, než začneme přidávat další native moduly pro Sprint 3.

### Fáze 1 — Tech debt (první, mění dependencies)

- ⏳ **Expo SDK 51 → 54+ upgrade**
  - `npx expo install expo@latest --fix`
  - Projít breaking changes (Expo Router v3→v4, expo-camera API, reanimated, ...)
  - `npx expo prebuild --clean --platform ios` + `npx expo run:ios`
  - Ověřit že všechny Sprint 1+2 flows fungují (dashboard, scan, box create, add items, edit sheet, swipe delete)
  - **Očekávaný benefit:** iOS 26 kompatibilita upstream → `DevMenuViewController` patch už nepotřeba
- ⏳ **patch-package fallback** — jen pokud SDK upgrade nevyřeší DevMenu issue
  - `npm install --save-dev patch-package postinstall-postinstall`
  - `package.json` postinstall script
  - `npx patch-package expo-dev-menu`
  - Commit `patches/` adresáře

### Fáze 2 — Design system foundation

- ⏳ **`src/theme/colors.ts`** — barevná paleta odvozená z brand green `#1E5F3E`
  - `primary` / `primaryDark` / `primaryLight`
  - `background` / `surface` / `surfaceElevated`
  - `text` / `textMuted` / `textOnPrimary`
  - `border` / `borderStrong`
  - `danger` / `warning` / `success` / `info`
  - `expiryExpired` / `expiryCritical` / `expirySoon` / `expiryOk` / `expiryNone` (re-tune do sladěné palety)
- ⏳ **`src/theme/spacing.ts`** — `xs | sm | md | lg | xl | 2xl` scale (4 / 8 / 12 / 16 / 24 / 32)
- ⏳ **`src/theme/typography.ts`** — `heading1 | heading2 | title | body | caption | label` tokeny
- ⏳ **`src/theme/index.ts`** — barrel export + `theme` objekt pro jednoduchý import
- ⏳ **Aplikovat napříč screeny:**
  - `app/(auth)/login.tsx`
  - `app/(app)/index.tsx` (Dashboard + custom header)
  - `app/(app)/scan.tsx`
  - `app/(app)/box/new.tsx`
  - `app/(app)/box/[id].tsx` (list + grid variants)
  - `app/(app)/box/[id]/add-items.tsx`
  - `src/components/ItemEditSheet.tsx`
  - `src/components/BoxEditSheet.tsx`
- ⏳ **Status bar + splash** — doladit `statusBarStyle`, `backgroundColor` v `app.json`

### Fáze 3 — Iconography

- ⏳ **Inventarizace ikon** — finální seznam bude ve shared dokumentu, tipuji:
  - Navigation: `back`, `close`, `check`, `chevron-right`, `more` (3 dots)
  - Actions: `add` (plus), `edit` (pencil), `delete` (trash), `share`, `copy`, `print`, `retry`
  - Input: `scan` (QR), `camera`, `gallery`, `flashlight-on`, `flashlight-off`
  - Display: `grid`, `list`, `search`, `filter`, `sort`
  - Status: `expired`, `critical`, `soon`, `ok`, `empty` (pro empty states)
  - Auth: `apple-logo` (pokud nepoužijeme built-in Apple button)
- ⏳ **User vygeneruje přes nano banana** — dodávka do `assets/icons/`, naming: `{name}.png` 512×512 nebo `{name}.svg`
- ⏳ **`src/components/Icon.tsx`** — wrapper komponenta, props: `name`, `size`, `color` (tint přes `tintColor` pro PNG nebo `fill` pro SVG)
- ⏳ **Nahradit všechny emoji + text-only labely** — `📦 / 🖨 / 📷 / ✏️ / 🗑 / 🔦` → `<Icon />`
- ⏳ **Action sheety** zůstávají textové (iOS native), ale v header buttonech všude `<Icon />`

### Fáze 4 — Translation (poslední, ať překládáme finální UI)

- ✅ **CLAUDE.md** — jazyková konvence přepsána na EN (už hotovo v setup fázi Sprintu 2.5)
- ⏳ **Doménové termíny** — konzistentní napříč UI i kódem:
  - bedna → **box**
  - sklad → **warehouse**
  - naskladnit / naskladňovací session → **add items**
  - položka → **item**
  - expirace → **expiry** (datum), **expires on** (věta)
  - štítek → **label** (QR label)
  - pozvánka → **invitation**
  - člen → **member**
- ⏳ **Projet a přeložit všechny stringy:**
  - `app/(auth)/login.tsx`
  - `app/(app)/index.tsx`
  - `app/(app)/scan.tsx`
  - `app/(app)/box/new.tsx`
  - `app/(app)/box/[id].tsx`
  - `app/(app)/box/[id]/add-items.tsx`
  - `src/components/ItemEditSheet.tsx`
  - `src/components/BoxEditSheet.tsx`
  - `src/lib/supabase.ts` (error messages vracené do UI, pokud nějaké jsou)
  - `src/lib/openFoodFacts.ts` (kategorie mapping — přeložit názvy)
  - `src/types/database.ts` (expiry status labely, `formatExpiry` helper)
- ⏳ **Rename `formatDateCs` → `formatDate`** v `src/types/database.ts`, format zachován (DD. MM. YYYY), aktualizovat callers
- ⏳ **Rename domain proměnných v kódu** — pokud někde je `bedna`, `sklad` apod., přejmenovat na EN
- ⏳ **Komentáře v kódu** — přeložit CZ komentáře na EN (ne masivně, ale když narazíme)

### Akceptační kritéria Sprintu 2.5

- [ ] Appka se buildí a běží na Expo SDK 54+ (nebo nejnovější)
- [ ] Žádný ruční patch v `node_modules` není potřeba (nebo je persisted přes `patch-package`)
- [ ] `src/theme/` existuje a všechny screeny ho používají místo hardcoded hexů
- [ ] Žádný emoji v UI (kromě záměrného obsahu)
- [ ] Všechny custom ikony z `assets/icons/` integrované přes `<Icon />`
- [ ] Žádná česká string v renderu (grep `[ěščřžýáíéůúťď]` v `app/` a `src/components/` = 0 výsledků)
- [ ] Sprint 1 + 2 flows stále fungují (viz `test-scenarios.md`)

---

## Sprint 3 – Tisk a AI ⏳

### Brother PT-P710BT tisk (revised plan)
**Rozhodnutí:** Brother PT-P710BT místo Niimbot B21. Důvody: AirPrint support (žádný BLE reverse engineering), laminované pásky vydrží 20+ let (prepper requirement), multi-use pro celou domácnost.

- ⏳ Nakoupit Brother PT-P710BT (~2500–3500 Kč)
- ⏳ Spárovat v iOS Settings → Bluetooth
- ⏳ `src/lib/qrLabel.ts` — HTML template s QR kódem + textem
- ⏳ `expo-print` integration — `Print.printAsync({ html })` → AirPrint dialog → user vybere Brother → print
- ⏳ Zapojit do `LabelModalContent` v `box/[id].tsx` + `box/new.tsx` — nahradit disabled tlačítko "🖨 Tisknout"
- ⏳ Fallback: `expo-sharing` → share PNG QR přes iMessage/Mail/AirDrop
- ❌ Niimbot BLE protokol — zrušeno, AirPrint cesta je robustnější

### Claude Vision pro produkty bez EAN
- ⏳ Supabase Edge Function `identify-product` (Deno)
  - Input: base64 jpeg
  - Volá Anthropic API se strukturovaným promptem
  - Output: `{ name, category, typical_shelf_life_days }`
- ⏳ `ANTHROPIC_API_KEY` v Supabase Secrets (dashboard)
- ⏳ `src/lib/vision.ts` — klientská wrapper funkce `identifyProduct(imageUri)`
- ⏳ V `add-items.tsx` přidat k "Přidat ručně" také "📸 Vyfotit produkt" tlačítko (když EAN 404 nebo žádný kód)
- ⏳ Po úspěšné identifikaci: prefill draft + nahrát foto do Storage + navázat do `items.image_url`

### Upload obrázků do Supabase Storage (Fáze A — nízkoriziková)
- ✅ Bucket `product-images` automaticky vytvořený přes schema.sql (public: true)
- ⏳ `src/lib/storage.ts` — `uploadProductImage(warehouseId, base64) → url`
- ⏳ Path convention: `{warehouse_id}/{timestamp}-{hash}.jpg`
- ⏳ `expo-image-picker` + `expo-image-manipulator` pro resize + compress před uploadem
- ⏳ Přidat do `add-items.tsx` a `ItemEditSheet`: tlačítko "📷 Vyfotit" / "🖼 Z galerie"
- ⏳ Použít i v Claude Vision flow

### Custom products rozšíření
- ✅ Upsert při přidání draftu se známým EAN — už je
- ⏳ Settings screen `settings/products.tsx` pro spravování custom DB — odložit do Sprint 4

---

## Sprint 4 – Sdílení a notifikace ⏳

### Pozvánky
- ⏳ `app/(app)/settings/index.tsx` — hlavní settings screen (přesunout dočasné "Odhlásit" z Dashboardu)
- ⏳ `app/(app)/settings/members.tsx` — seznam členů + pozvánkový formulář
- ⏳ `createInvitation` už existuje v API — UI zbývá
- ⏳ Sdílení linku `stockr://invite/{token}` přes `expo-sharing` (iMessage, Mail, Copy)
- ⏳ Deep link handler v `app/_layout.tsx` už parsuje path — otestovat real flow
- ⏳ Přijímač pozvánky: pokud user není přihlášen, persist token do SecureStore a zpracovat po loginu

### Role-aware UI
- ⏳ V `listMembers` / `getMyWarehouse` vrátit roli aktuálního usera
- ⏳ V `box/[id].tsx` action sheetu: pro member skrýt "Smazat bednu"
- ⏳ Testovat s druhým zařízením / Apple ID

### Push notifikace
- ⏳ `expo-notifications` setup (permissions, token registration)
- ⏳ Lokální scheduling po každém otevření appky (přečti items → naplánuj 30d/7d/same-day notifications)
- ⏳ Supabase Edge Function `daily-expiry-check` (cron trigger)
- ⏳ Settings pro zapnutí/vypnutí (opt-out)

### FIFO indikátor
- ⏳ Na dashboardu: na kartě bedny zobrazit "Otevřít první" pro tu s nejbližší expirací
- ⏳ Odlišit barvou/ikonou

---

## Sprint 5 – Release ⏳

### Assety
- ✅ `assets/icon.png` — 1024×1024, zelená paleta (nano banana generated)
- ✅ `assets/splash.png` — 1286×2778, stejná paleta, backgroundColor `#1E5F3E`
- ⏳ Případné zmenšení splash (z ~5.4 MB na <1 MB) — ImageOptim / pngquant
- ⏳ `assets/adaptive-icon.png` — foreground layer (prázdný pro iOS-only)

### TestFlight build
- ⏳ `eas.json` konfigurace (preview profile pro TestFlight)
- ⏳ `eas build --platform ios --profile preview`
- ⏳ `eas submit --platform ios` — upload na App Store Connect
- ⏳ Internal Testing group → pozvat manželku emailem
- ⏳ Test runtime na reálném zařízení (ne simulátoru)

### Polish
- ⏳ Accessibility labels pro screen reader
- ⏳ Dark mode (appka má zatím jen light)
- ⏳ iPad layout (pokud `supportsTablet: true` — zatím false)
- ⏳ Performance audit (React DevTools Profiler)
- ⏳ Odstranit dev-only email/password login z `login.tsx` před production buildem (`__DEV__` guard to už dělá automaticky)

### Dokumentace
- ⏳ README.md pro GitHub (pokud bude public repo)
- ⏳ Aktualizovat CLAUDE.md po Sprintu 5

---

## Technical debt

> **Pozn.:** patch-package a Expo SDK upgrade byly přesunuty do **Sprint 2.5** (Fáze 1 — Tech debt). Tahle sekce obsahuje jen zbývající položky.

### Role awareness (Sprint 4 territory, ale už se projevuje)
- Aktuálně UI zobrazuje destruktivní akce všem
- RLS policies to odmítnou, ale user dostane prázdný výsledek bez feedback
- **Fix:** v `listMembers` nebo v `getMyWarehouse` vrátit roli aktuálního usera a podmíněně renderovat tlačítka

### Refresh invalidace realtime
- Po `updateItem` v `ItemEditSheet` děláme optimistický update `setItems(prev.map(...))`
- Realtime subscription pak pošle event → znovu `load()` → zbytečný double refresh
- **Fix:** ignorovat vlastní write eventy (Supabase realtime má `eventId` per operation)
- **Priorita nízká** — race condition je kosmetická, UI se vrátí do konzistence do 200ms

### Settings screen + sign out
- Dashboard má dočasné "Odhlásit" tlačítko — ošklivé, ale funkční
- Přesunout do `settings/index.tsx` ve Sprintu 4

### Dev-only email/password login
- V `login.tsx` je `__DEV__` wrapped sekce s email/password fallback
- Slouží pro bypass Apple Sign In v simulátoru (password paste v iOS Settings nefunguje)
- **V production buildu se nerenderuje** (`__DEV__ === false`)
- Lze ponechat i do TestFlight buildu, ale doporučeno odstranit před App Store submission

### Error handling granularita
- Aktuální error states jsou jen na load level
- Save failures v editech jsou jen Alert (OK pro teď)
- Možná přidat retry-with-backoff pro síťové operace? — zvážit při prvním reálném použití

---

## Dependencies k dnešku

### Core
```json
"expo": "~51.0.28"
"react": "18.2.0"
"react-native": "0.74.5"
"typescript": "~5.3.3"
```

### Expo moduly
```
expo-router                 ~3.5.23
expo-apple-authentication   ~6.4.2
expo-camera                 ~15.0.16
expo-clipboard              ~6.0.3
expo-constants              ~16.0.2
expo-crypto                 ~13.0.2
expo-dev-client             ~4.0.23
expo-haptics                ~13.0.1
expo-linking                ~6.3.1
expo-secure-store           ~13.0.2
expo-splash-screen          ~0.27.5
expo-status-bar             ~1.12.1
expo-system-ui              ~3.0.7
```

### Third-party
```
@react-native-async-storage/async-storage     1.23.1
@react-native-community/datetimepicker        8.0.1
@supabase/supabase-js                         ^2.45.0
react-native-gesture-handler                  ~2.16.1
react-native-qrcode-svg                       ^6.3.0
react-native-reanimated                       ~3.10.1
react-native-safe-area-context                4.10.5
react-native-screens                          3.31.1
react-native-svg                              15.2.0
react-native-url-polyfill                     ^2.0.0
```

### Sprint 3 will add
```
expo-image-picker             (kamera foto / galerie)
expo-image-manipulator        (resize + compress před uploadem)
expo-print                    (Brother PT-P710BT přes AirPrint)
expo-sharing                  (fallback share PNG label)
```

### Sprint 4 will add
```
expo-notifications            (push)
```

---

## Aktuální stav prostředí

### Backend
- ✅ Supabase projekt vytvořený
- ✅ `schema.sql` spuštěný (plná konsolidovaná verze včetně RPC, realtime, storage bucket)
- ✅ Apple provider zapnutý v Supabase (Client ID: `com.ondrejmichalcik.stockr`, Allow users without email: ON)
- ✅ Test user `test@stockr.local` / `test1234` vytvořen pro dev bypass login
- ✅ Realtime replication enabled pro `boxes`, `items`, `warehouses`, `warehouse_members`
- ✅ Storage bucket `product-images` (public) vytvořený

### Frontend / Build
- ✅ `.env` vyplněný `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nový publishable key, ne legacy anon)
- ✅ `npm install` proběhl
- ✅ Ruby 3.x nainstalovaný přes Homebrew, PATH v ~/.zshrc
- ✅ CocoaPods nainstalované přes `gem install cocoapods`
- ✅ `expo-dev-menu` patchnut v `node_modules` pro iOS 26 kompatibilitu (nepersistovaný)
- ✅ `npx expo prebuild --platform ios` proběhl
- ✅ První iOS build přes `npx expo run:ios` úspěšný
- ✅ Dev client běží v iOS Simulator (iPhone 17 Pro, iOS 26.4)
- ✅ Metro bundler connected, JS bundle loaded
- ✅ Sprint 1 + 2 funkčně ověřeny v simulátoru (login, dashboard, create box, QR label, add items, edit, delete, toggle view mode)

### Apple Developer
- ✅ Apple Developer Program aktivní
- ✅ App ID `com.ondrejmichalcik.stockr` registrován s capabilities:
  - Sign In with Apple
  - Push Notifications
- ⏳ Fyzický iPhone — nespárovaný s Xcode signing (čeká na setup)
- ⏳ Apple Sign In test na reálném zařízení (v simulátoru obejito přes dev bypass)

### Assety
- ✅ `assets/icon.png` — 1024×1024, zelená paleta, symbolizuje Stockr
- ✅ `assets/splash.png` — 1286×2778, stejný vizuál, backgroundColor `#1E5F3E`

---

## Quick commands

```bash
# Install deps po pull
npm install

# Spustit Metro bundler (dev)
npx expo start --dev-client --clear

# Native build pro iOS (po přidání nového native modulu)
npx expo run:ios --device "iPhone 17 Pro"

# Vynucený clean build (když build cachuje problém)
rm -rf ios/Pods ios/Podfile.lock
npx expo prebuild --clean --platform ios
npx expo run:ios

# Re-applikovat DevMenuViewController patch (po npm install)
# V node_modules/expo-dev-menu/ios/DevMenuViewController.swift ~ line 66:
# Nahradit `let isSimulator = TARGET_IPHONE_SIMULATOR > 0`
# Za #if targetEnvironment(simulator) ... #endif blok

# TypeScript check
npm run typecheck     # alias pro `tsc --noEmit`

# EAS build pro TestFlight (Sprint 5)
eas build --platform ios --profile preview
eas submit --platform ios
```

---

## Příště začít

Po otevření nové session a prozkoumání stavu:

1. **Ověř, že patch `DevMenuViewController.swift` pořád drží** — pokud ne (po `npm install`), re-applikovat nebo nastavit `patch-package`
2. **Zkontroluj, že Metro bundler naběhne a appka se spustí** — `npx expo start --dev-client` a v simulátoru v dev client klikni connect
3. **Rozhodni, co dál**:
   - **Sprint 3 Fáze A** (image upload + manuální foto) — nízkoriziková, půl dne
   - **Fyzický iPhone signing setup** — pro reálný Apple Sign In + haptic + kamera
   - **patch-package setup** — tech debt cleanup
   - **Expo SDK upgrade** — větší rework, ale eliminuje patch

### Poslední session ukončena v:
- **Stav**: Sprint 1 + 2 + všechny dodělávky kompletní, běží v iOS Simulator, schema.sql konsolidovaný
- **Known issues**: žádné blokující, jen tech debt (viz sekce)
- **Nejbližší next step**: Sprint 2.5 — začít Fází 1 (Expo SDK upgrade)

### Aktuální session (2026-04-13):
- Insertnutý **Sprint 2.5 – UI polish & tech debt** mezi Sprint 2 a Sprint 3
- Rozhodnutí: UI přechází na angličtinu (změna konvence v `CLAUDE.md`)
- Rozhodnutí: custom ikony generované přes nano banana místo vector icon libraries
- Rozhodnutí: nejdřív tech debt (SDK upgrade), pak design system, pak ikony, až nakonec překlad
