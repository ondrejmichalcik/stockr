# App Store Screenshots — capture plan

Step-by-step guide to produce the 6 App Store screenshots required for Kalta's v1 launch.

---

## App Icon audit — DONE ✓

- **Source**: `assets/icon.png` (1024×1024, RGBA)
- **Issue found**: has alpha channel. Apple rejects app icons with alpha on submission.
- **Fix applied**: created `assets/icon-appstore.png` — same image, alpha stripped (1024×1024, RGB, sRGB).
- **Usage**: upload `icon-appstore.png` to App Store Connect → App Information → App Icon when submitting.

---

## Target sizes

Apple now only requires screenshots for the **largest iPhone display size**. Everything else auto-scales from that.

| Size label | Device | Dimensions | Required? |
|---|---|---|---|
| **6.9"** | iPhone 16 Pro Max, 15 Pro Max | **1290 × 2796 px** portrait | **YES** |
| 6.5" | iPhone 11 Pro Max, XS Max | 1242 × 2688 px | optional |
| 6.1" | iPhone 16, 15, 14 | 1179 × 2556 px | optional, nice-to-have |

**For v1 submission**: capture 6 screenshots at 6.9" (1290×2796). That alone is enough. Add 6.1" later if you have time.

---

## Capture method — manual in simulator

Simplest and fastest for 6 screenshots:

1. Open Xcode → **Open Developer Tool → Simulator**.
2. File → **Open Simulator → iOS 18.x → iPhone 16 Pro Max** (or the latest available Pro Max, which gives you 1290×2796 natively).
3. In simulator: **Device → Erase All Content and Settings** (clean slate).
4. Drag & drop your `.ipa` from the latest EAS build onto the simulator (or `npx expo run:ios --device "iPhone 16 Pro Max"` to build+install fresh).
5. Open Kalta, sign in with a demo Apple ID (see "Demo data" section below).
6. Navigate to each target screen (see "Screens to capture" below).
7. On each screen: simulator → **File → Save Screen** (`⌘S`). Saves a PNG to Desktop with correct 1290×2796 resolution.
8. Rename each file: `01-dashboard.png`, `02-box-detail.png`, etc.

Alternative: **⌘+1** in simulator = 100% size on your Mac screen. Might be too large to fit. Use **⌘+3** (33%) to see full device then capture. Screenshot resolution is preserved regardless of view zoom.

### Screenshot quality checklist

Before capturing each:

- [ ] Status bar shows a normal time (e.g., 9:41, Apple's marketing default). Simulator sets this automatically but you can override via `xcrun simctl status_bar "iPhone 16 Pro Max" override --time "9:41"`.
- [ ] No debug / dev menu showing.
- [ ] No keyboard open unless it's the point of the shot.
- [ ] Network indicator shows full signal + WiFi.
- [ ] Battery icon shows full.

---

## Demo data — populate before capturing

To make screenshots compelling (not "empty state" which feels amateur), populate this data in the demo account:

### Warehouse 1 — "Home pantry"

**Box A: "Canned food"** (8 items, mixed urgency):
- Canned beans (x4) — expired 2026-03
- Tuna cans (x6) — expiring 2026-05 (critical)
- Tomato paste (x3) — expiring 2026-08 (soon)
- Olive oil (x1) — expiring 2027-06 (ok)
- Rice 1kg (x2) — expiring 2028-01 (ok)
- Pasta (x4) — expiring 2027-11 (ok)
- Canned corn (x2) — expiring 2026-07 (soon)
- Coffee beans (x1) — expiring 2027-02 (ok)

**Box B: "Medicines"** (5 items):
- Paracetamol — expired 2025-12
- Ibuprofen — expiring 2026-05 (critical)
- Band-aids — no expiry
- Antiseptic gel — expiring 2026-11 (soon)
- Painkillers — expiring 2027-03 (ok)

**Box C: "Batteries & flashlights"** (4 items):
- AA batteries (x12) — no expiry
- AAA batteries (x8) — no expiry
- LED flashlight — no expiry
- Solar power bank — no expiry

### Warehouse 2 — "Basement supplies"

**Box D: "Water bottles"** (3 items):
- 1L bottled water (x20) — expiring 2028-03 (ok)
- 5L emergency water (x4) — expiring 2029-01 (ok)
- Water purification tablets (x1) — expiring 2026-09 (soon)

**Box E: "First aid"** (4 items):
- Bandages — no expiry
- Sterile gauze — expiring 2027-08 (ok)
- Saline solution — expiring 2026-06 (critical)
- Emergency blanket — no expiry

### Result on dashboard

- **Home pantry** appears first (has expired items → urgent)
- **Basement supplies** second (critical item in first aid)
- Within each warehouse, boxes sort by soonest expiry inside

This gives you the full color palette in screenshots: red, orange, yellow, green, grey.

---

## Screens to capture (6 shots)

### Screenshot 1 — Warehouses dashboard
**The hero shot.** What people see first in App Store search results.

- Navigate to: app launch (after sign-in) → default screen
- Should show: 2 warehouses ("Home pantry", "Basement supplies"), each with their card showing earliest expiry color
- **Why this matters**: immediately communicates "this app is for tracking supplies in organized boxes"
- **Caption suggestion**: *"Organize emergency supplies in real boxes."*

### Screenshot 2 — Box detail with items
**The "color-coded expiry" shot.**

- Navigate to: Home pantry → Canned food box
- Should show: 6-8 items visible in list, mix of red (expired), orange (critical), yellow (soon), green (ok)
- **Why this matters**: demonstrates the core tracking value
- **Caption suggestion**: *"Expiration tracked at a glance."*

### Screenshot 3 — Barcode scanner
**The "scan in seconds" shot.**

- Navigate to: any box → Add items → Scan barcode
- Should show: camera overlay with focus indicator, a product (can from your kitchen) in frame
- Alternative: show the "just scanned, fill in expiry" sheet that appears after recognition, with product name + brand + category pre-filled
- **Why this matters**: shows the "speed" value prop
- **Caption suggestion**: *"Scan to add in seconds."*

### Screenshot 4 — QR label preview
**The "this is different from every other list app" shot.**

- Navigate to: box → Print QR (or view the QR preview)
- Should show: the generated QR code full-size with box name below
- **Why this matters**: differentiates from generic inventory apps. Shows physical-world integration.
- **Caption suggestion**: *"Print QR labels for every box."*

### Screenshot 5 — Sharing settings
**The "share with family" shot.**

- Navigate to: warehouse → Settings tab → Members
- Should show: current member (you) + another member (fake "Lucie" or whoever) + Invite button
- Tip: create a second test Apple ID and invite it, so you have 2 member rows visible
- **Why this matters**: answers "can I share this with my wife?"
- **Caption suggestion**: *"Share with your family."*

### Screenshot 6 — Item detail / edit sheet
**The "rich data" shot.**

- Navigate to: any item → tap to edit
- Should show: item edit sheet with all fields filled (name, quantity, expiry date picker, category, notes, photo)
- **Why this matters**: shows what "tracking" actually means — not just a name
- **Caption suggestion**: *"Every detail, right where you need it."*

---

## Optional: caption overlays

Two paths:

### A) Raw screenshots (recommended for v1)

Upload the Cmd+S outputs directly to App Store Connect. No framing, no text overlay. Apple displays them with the phone frame of the target device automatically.

**Pros**: honest, fast, shows actual UI, easy to redo when app changes
**Cons**: less "produced" look compared to competitors

### B) Screenshot with caption + frame

Adds a text overlay ("Organize emergency supplies…") and optionally an iPhone device frame around the screenshot.

**Pros**: higher conversion rate, more "launched app" feel
**Cons**: requires design work (Figma or similar), takes 1-2h for 6 shots, needs re-export when content changes

**Tools:**
- **Figma** — free, flexible. Set up a 1290×2796 frame template with caption text area + screenshot placeholder. Duplicate per shot.
- **Fastlane `frameit`** — CLI tool that auto-frames + captions. Requires caption strings file.
- **Online tools**: AppMockUp, Previewed, Screenshot Creator — most have free tiers for 6 shots.

**My recommendation**: ship v1 with **raw screenshots** (Option A), iterate to captioned (Option B) after real user feedback.

---

## Output format

App Store Connect accepts:

- **File format**: PNG or JPEG
- **Color space**: sRGB or Display P3 (no CMYK)
- **Max file size**: 8 MB per screenshot
- **No transparency** (PNG with alpha is OK, but the alpha must be 100% opaque)

Simulator's Cmd+S produces PNG in the correct format automatically.

---

## Upload to App Store Connect

Once you have 6 screenshots ready:

1. App Store Connect → Apps → Kalta → **App Store** tab.
2. Scroll to **iOS Preview and Screenshots** section.
3. **6.9" Display** row → click upload icon.
4. Drag all 6 PNG files into the slot. Order them 1-6 (dashboard first, item detail last).
5. **Save** (top right).

Screenshots can be swapped anytime — even after approval — without triggering a new app review.

---

## Optional: add 6.1" size (iPhone 16 / 15)

To give App Store Connect more flexibility on different devices, also capture at 6.1":

- Simulator: **iPhone 16** (not Pro Max) → 1179×2556 portrait.
- Repeat the same 6 screens with the same demo data.
- Upload under the 6.1" row in App Store Connect.

Not required — Apple scales the 6.9" set down automatically — but it gives more control over how things render on smaller screens.

---

## After capture checklist

- [ ] 6 screenshots saved: `01-dashboard.png` through `06-item-detail.png`
- [ ] All files are 1290×2796 PNG
- [ ] Status bar clean (9:41 time, full signal)
- [ ] No personal data visible (use demo account email/name)
- [ ] No debug UI / dev menu visible
- [ ] Demo data feels realistic (not "Lorem ipsum" or obviously fake)
- [ ] Files uploaded to App Store Connect

When all boxes checked, screenshot part of submission is complete.
