# Kalta — Support

## Frequently Asked Questions

### Getting started

**What is Kalta?**
Kalta is a home inventory app for tracking emergency supplies. Organize items in physical boxes labeled with QR codes, scan barcodes to look up product info, and get reminders before items expire.

**How does it work?**

1. Create a warehouse (e.g., "Basement pantry").
2. Create a box inside it and print or write down the QR label it generates.
3. Stick the label on the physical box.
4. Scan a product barcode — Kalta fills in the product info from the Open Food Facts database.
5. Add an expiration date and save. Kalta sorts items by urgency and notifies you before they expire.

---

### Scanning and adding items

**The barcode scan shows "Unknown product". What now?**
Not every product is in the Open Food Facts database, especially private-label store brands. You can:

- Enter the product name and category manually.
- Use the **AI suggestion** feature (see Claude Vision below) — take a photo and let it fill in fields.
- Save a "custom product" so that the next time you scan the same barcode, your filled-in data loads automatically.

**Can I add items without scanning?**
Yes. In the box detail, tap **Add items** and choose **Manual entry** from the menu.

**How do I change the expiration date after saving?**
Tap the item → edit sheet opens → change date → save.

---

### Expiration tracking and notifications

**When do I get notified about expiring items?**
Kalta schedules local iOS notifications for each item with an expiry date. Default reminder windows are 30 days, 7 days, 1 day before, and on the expiry day. You can customize these in Settings → Notifications.

**I'm not getting notifications.**
Check:

1. iOS Settings → Notifications → Kalta — make sure they're allowed.
2. iOS Focus / Do Not Disturb modes are not blocking them.
3. In Kalta Settings → Notifications, check that the reminder windows you expect are enabled.
4. If you changed reminder windows recently, existing items need to be reopened for the new schedule to apply (we're improving this in a future update).

**How does the expiry color coding work?**

- **Red** — Already expired.
- **Orange** — Within 30 days.
- **Yellow** — Within 90 days.
- **Green** — More than 90 days away.
- **Grey** — No expiry date set.

Boxes on the dashboard are sorted by the earliest expiry of any item inside.

---

### Sharing a warehouse

**How do I share a warehouse with my partner?**

1. Open the warehouse → **Settings** tab → **Invite** button.
2. Kalta generates a share link valid for 7 days.
3. Send the link however you like (iMessage, email, WhatsApp, AirDrop).
4. The recipient opens the link on their iPhone — if Kalta is installed, it opens directly; otherwise they get the App Store link first.
5. After they sign in with Apple, they can accept and the warehouse appears in their list.

**Can the other person edit items?**
Yes. All members of a warehouse have read and write access: add, edit, delete items. Only the owner can remove members and delete the warehouse.

**How do I remove someone?**
Warehouse → Settings tab → Members → swipe on the member → Remove. Their access is revoked immediately.

**Can I be in multiple warehouses?**
Yes. You can own your own warehouses and also be a member of warehouses other people share with you.

---

### P2P sync (sync between two nearby iPhones)

**What is P2P sync?**
P2P sync lets two iPhones running Kalta exchange inventory data directly over Bluetooth and WiFi, without going through the internet. Useful in locations with no signal.

**How do I use it?**

1. Both devices open Kalta → **Settings** (or from the warehouse) → **P2P Sync**.
2. Tap **Start searching** on both devices.
3. When the other device appears in the list, tap it on one device to initiate the connection.
4. After confirming, tap **Sync** to exchange data.

**Which device wins if we edited the same item on both?**
Kalta uses a last-write-wins rule per field: the most recent edit for each field of each item survives. If you edit different fields on different devices, both edits are preserved.

**P2P doesn't find the other device.**

- Make sure Bluetooth and WiFi are **on** on both devices (WiFi doesn't need to be connected to the same network, just enabled).
- Make sure neither device is in Low Power Mode (it limits Bluetooth discovery).
- Both devices must have the P2P Sync screen **open** at the same time.
- Force-close and re-open Kalta on both devices if it still doesn't work.

---

### Printing QR labels

**What printer is supported?**
Brother label printers via Bluetooth (Brother Print SDK). Tested with the Brother QL and PT series.

**I don't have a Brother printer.**
Tap the QR label on screen → **Share as image** → print or save it from the iOS share sheet. Or take a screenshot of the QR code when creating a box and stick the printout on.

**The printer is not found.**

- Make sure the printer is on, paired with your iPhone in iOS Settings → Bluetooth.
- Open Kalta → box detail → **Print QR label** → tap **Select printer** again.

---

### AI-assisted product recognition (Claude Vision)

**What is the AI feature?**
Kalta can use Anthropic's Claude Vision to analyze a product photo and fill in the product name, category, and typical shelf life. It's optional and requires your own Anthropic API key.

**How do I enable it?**

1. Create an account at https://console.anthropic.com and generate an API key.
2. Add credit to your Anthropic account (pay-as-you-go; a typical scan costs a fraction of a cent).
3. In Kalta → Settings → **AI** → paste your API key.
4. When scanning a product without a barcode match, tap **Suggest with AI**.

**How much does it cost?**
Anthropic charges per call based on image size and model. At the current pricing for Claude Haiku 4.5, a typical scan costs roughly **$0.001–0.005** depending on image size. Kalta never charges you for AI — you pay Anthropic directly.

**Is my API key safe?**
Your API key is stored in the iOS Keychain on your device and never leaves your device except as the `x-api-key` header in requests to Anthropic. We don't see it.

---

### Privacy and data

**Is my inventory private?**
Yes. Only you and people you explicitly invite to a warehouse can see your data. Kalta has no analytics, no ad tracking, no crash reporting. See the full [Privacy Policy](../legal/privacy-policy.md).

**Where is my data stored?**
On your iPhone in a local database, and synced to our backend hosted at Supabase in **Ireland, EEA**.

**Can I export my data?**
Email us at **ondrej.michalcik@gmail.com** and we'll provide a JSON export of your data.

**How do I delete my account?**
Email us at **ondrej.michalcik@gmail.com** from the email associated with your Apple ID. We delete your account and the warehouses you own within 30 days.

---

### Refunds and purchases

**How do I get a refund?**
Refunds are handled by Apple. Visit https://reportaproblem.apple.com, find the Kalta purchase, and request a refund. Apple decides based on their policy.

**I bought Kalta — can my family member use it too?**
Yes, if you're set up for Apple Family Sharing and Kalta's Family Sharing flag is enabled in the App Store. Your family members can install Kalta without paying again.

---

### Troubleshooting

**App crashes on launch.**
Usually caused by corrupt local data. Try:

1. Restart your iPhone.
2. If it still crashes, delete and reinstall the app. Your data remains safe in our backend and restores on sign-in.

**Sync seems stuck.**

- Check your internet connection.
- Pull down to refresh on the warehouses list.
- Force-close the app and reopen.
- If sync conflicts appear, resolve them from Settings → Conflicts.

**I signed out and lost my data!**
Your cloud data is safe — sign back in with the same Apple ID and it restores. Signing out only clears the local cache on that device.

---

## Contact

For anything not covered here:

**Email:** ondrej.michalcik@gmail.com

We're a one-person operation, so response times vary. We try to reply within 3–5 business days.
