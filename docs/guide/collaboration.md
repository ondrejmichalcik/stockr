# Sharing & P2P sync

Kalta supports two ways to keep multiple people in sync: **cloud-based sharing** of a warehouse (invite-link flow through our backend) and **peer-to-peer sync** between two nearby iPhones over Bluetooth and WiFi (no internet needed).

Most households use cloud sharing as the default. P2P is there for offline scenarios or as a privacy-focused alternative.

## Cloud-based sharing (invite links)

A warehouse can be shared with other Kalta users. When you share, everyone who joins has **read and write access** to that warehouse: they can add and edit items, rename boxes, and mark things as opened. Only the **owner** can delete a warehouse or remove members.

### Generating an invite

1. Open the warehouse → **Settings** tab.
2. Tap **Invite**.
3. Kalta generates a link valid for **7 days**. You'll see the iOS share sheet.
4. Send the link however you like — iMessage, email, WhatsApp, AirDrop, Signal, any app on your phone.

<div class="screenshot">[Screenshot: Warehouse Settings → Invite screen with generated link + share sheet]</div>

### Accepting an invite

On the **recipient's side**:

1. Open the link on their iPhone.
2. If Kalta is installed → it opens directly. If not → App Store opens to Kalta's page; after install, the link is remembered and processed on first launch.
3. The recipient signs in with Apple (if they haven't already).
4. Kalta shows the warehouse preview. Tap **Accept**.
5. The warehouse appears in their dashboard. It's now shared.

### Member management

Inside the shared warehouse → Settings → **Members**:

- See all people who have access, with their display name.
- Owners can **remove members** — swipe left on a member → Remove. Access is revoked immediately.
- A removed member can be re-invited later with a new link.

### Safety tips

- **Only share invite links with people you trust.** There's no email verification or approval flow — whoever opens the link can accept.
- **Invite links expire** after 7 days but are **active for anyone** during that window. If a link goes to the wrong person, the fastest fix is to generate a fresh one (the old one doesn't auto-revoke, but it only works once). Then remove the wrong person from the Members list if they accepted.
- **Removed members can no longer see the warehouse** after removal, but any data they viewed or exported while active is theirs to keep — we cannot retroactively revoke what they already saw.

### Who sees what

All members see:

- All boxes, items, notes, and photos in the warehouse.
- Other members' display names.
- Inventory history (who added/changed what, if you had multiple members active at once).

Nobody outside the warehouse membership can see any of this — not other Kalta users, not us (well, we host the data but only you and members can read it via the app).

## P2P sync (two nearby iPhones)

P2P sync lets two iPhones running Kalta exchange inventory data directly over Bluetooth and WiFi using Apple's **MultipeerConnectivity** framework. No internet is required.

### When to use P2P

- **Offline locations** — cabin without WiFi, remote shelter, underground basement.
- **Initial setup** — want to clone your inventory to a second device quickly.
- **Privacy preference** — you don't want your sync traffic to pass through any server, including ours.

For day-to-day household use, cloud sharing is simpler — changes sync automatically in the background. P2P is a manual, on-demand transfer.

### How to start a P2P sync

**Both devices** must have Kalta open on the P2P Sync screen at the same time.

1. Open Kalta → **Settings** → **P2P Sync** (or from a warehouse's Settings tab).
2. Tap **Start searching** on both devices.
3. The other device's name appears in the list.
4. On one device, tap the peer → **Connect**.
5. The other device shows a connection confirmation → tap **Accept**.
6. Once connected, tap **Sync now** on either device to start the exchange.

<div class="screenshot">[Screenshot: P2P Sync screen showing discovered peer and Connect button]</div>

### Review and accept

Once you tap **Sync now**, both devices exchange their data and show a **review screen**:

- A banner at the top: "Changes from {peer name}".
- A list of every change the peer's data would make to your local copy: items added, item fields modified (quantity, notes, expiry, …) shown as a red "before" / green "after" diff, just like the pending changes screen.
- Any **conflicts** (you and the peer edited the same field with different values) are flagged in the same list with a warning icon.

At the bottom: **Reject** or **Accept**.

Both devices must independently tap **Accept** before any change is written to either local database. If either side taps **Reject** — or one of you closes the screen / the connection drops — the sync is canceled and **nothing is saved on either side**.

After both peers accept, each device applies the other's bundle to its local data. Conflicts (if any) get logged so you can resolve them later in **Settings → Conflicts**.

### What's exchanged

Both devices send each other a JSON bundle of their local data: warehouses, boxes, items, members, custom products, inventory sessions. The receiving side merges it using a **per-field merge with baseline awareness**: a field is considered a conflict only when both sides edited it concurrently to different values. If you and the peer edited different fields on the same item, both edits are kept — no conflict.

### Encryption

The MultipeerConnectivity session is **TLS-encrypted end-to-end** by Apple's framework — nobody in between (e.g., a passer-by on the same WiFi) can read the payload.

### Conflict resolution

Real conflicts (both sides edited the same field) get added to **Settings → Conflicts** after the sync completes. There you pick the correct value per field, the same flow as for cloud sync conflicts.

### Troubleshooting P2P

- **Both Bluetooth and WiFi radios must be on** on both devices. Despite the feature name suggesting "Bluetooth sync", iOS's MultipeerConnectivity framework uses both: WiFi (via AWDL, the same protocol as AirDrop) for peer discovery and fast transfer, Bluetooth as a fallback. Without WiFi radio on, devices won't find each other.
- Your WiFi does **not** need to be connected to any internet — just the radio must be active. Airplane mode with WiFi and Bluetooth manually re-enabled works perfectly.
- Make sure neither device is in **Low Power Mode** — it aggressively disables peer scanning.
- The P2P Sync screen has to stay **open on both devices** for them to see each other. Don't background the app during sync.
- If they don't see each other after 30 seconds, force-close Kalta on both devices and retry.
- Verify the device name shown in the peer list **matches the device you intend to pair with**. P2P is for trusted devices (family, your own second iPhone) — don't connect to random peers.

## Which should you use?

| Scenario | Cloud sharing | P2P sync |
|---|---|---|
| Share with partner/family on same plan | ✅ best | ⚠️ overkill |
| Sync your own devices | ✅ automatic | ⚠️ manual |
| No internet available | ❌ can't | ✅ yes |
| Want fastest possible transfer | ⚠️ depends on network | ✅ very fast locally |
| Don't want data on our servers | ❌ data is stored | ✅ direct only |

For most households: **cloud share with your partner once, forget about it**. Use P2P only when you actually need it.

## What's next

- If you haven't set up notifications yet, read [Expiry & reminders](/docs/expiry-and-reminders).
- For the printing side of boxes (labels, Brother printers), see [Printing QR labels](/docs/printing).
