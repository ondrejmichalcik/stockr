# Deploy to Cloudflare Pages

This folder is a standalone Astro site that builds the marketing landing and legal pages for `kalta.app`.

The markdown content for `/privacy`, `/terms`, and `/support` is imported from the repo's top-level `docs/` folder, so editing `docs/legal/privacy-policy.md` automatically updates the published site on next build.

## Local development

```bash
cd web
npm install
npm run dev        # http://localhost:4321
npm run build      # builds to web/dist/
npm run preview    # serves web/dist/ for local QA
```

## First-time Cloudflare Pages setup

### Option A — via GitHub integration (recommended)

1. Push the repo to GitHub if it's not already there.
2. In the Cloudflare dashboard go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Select the `kalta` repo.
4. Configure the build:
   - **Project name:** `kalta-web` (or anything — this is just the internal CF name)
   - **Production branch:** `master` (or whatever your main branch is)
   - **Framework preset:** `Astro`
   - **Build command:** `cd web && npm install && npm run build`
   - **Build output directory:** `web/dist`
   - **Root directory (Advanced):** leave blank
   - **Environment variables:** none required
5. Click **Save and Deploy**. First build should complete in ~1 minute.
6. CF will assign a preview URL like `kalta-web.pages.dev` — verify it works.

### Option B — via Wrangler CLI (no GitHub needed)

```bash
npm install -g wrangler
cd web
npm install
npm run build
wrangler pages deploy dist --project-name=kalta-web
```

First deploy creates the project. Subsequent deploys just use the same command.

## Custom domain setup

After the first successful deploy:

1. CF dashboard → **Workers & Pages → kalta-web → Custom domains → Set up a custom domain**.
2. Enter `kalta.app`. Cloudflare automatically creates the required CNAME record (since `kalta.app` is already on your CF account, no DNS change is required).
3. Optionally also add `www.kalta.app` and set it to redirect to the apex.
4. Wait ~30 seconds for the SSL certificate to provision. HTTPS should work out of the box.

After this, the live URLs are:

- `https://kalta.app` — landing
- `https://kalta.app/privacy` — Privacy Policy
- `https://kalta.app/terms` — Terms of Service
- `https://kalta.app/support` — FAQ + contact

## Updating content

- **Privacy Policy, Terms, FAQ** — edit the files under `docs/legal/` and `docs/support/` in the main repo. Commit and push. CF Pages auto-rebuilds the web site in about a minute.
- **Landing page copy / design** — edit `web/src/pages/index.astro` and `web/src/styles/global.css`.
- **Site-wide layout / meta tags** — edit `web/src/layouts/Layout.astro`.

## Assets to add later

These are optional but nice to have:

- `web/public/og-image.png` — 1200×630 PNG for social-media previews (OpenGraph). A screenshot of the app + "Kalta — Home emergency stock tracker" tagline works.
- `web/public/apple-touch-icon.png` — 180×180 PNG for iOS home screen bookmark icon.
- App Store download badge on the landing page (when the app is live on App Store).

## Troubleshooting

- **Build fails with "Cannot find module '../../../docs/legal/privacy-policy.md'"** — you're building from `web/` without the parent `docs/` folder available. Make sure you're deploying from the repo root or the full repo is cloned on the CF build server.
- **404 on a page that exists** — CF Pages needs to re-deploy after adding a new page. Trigger a rebuild from the CF dashboard (Deployments → Retry deployment).
- **Outdated content after edit** — check the CF deployment log; the build probably didn't see the change because it was cached. Clear the CF cache from the dashboard (Caching → Purge Everything) or wait ~5 minutes.

## Next steps after first deploy

1. Update `app.json` → `associatedDomains`:
   ```json
   "associatedDomains": ["applinks:kalta.app"]
   ```
   This enables Universal Links for invitation URLs.
2. Create `.well-known/apple-app-site-association` file served from `kalta.app` — see [Apple's docs](https://developer.apple.com/documentation/xcode/supporting-associated-domains) for format.
   - File must be served with `Content-Type: application/json`, not cached.
   - CF Pages auto-serves `.well-known/` files — just add `web/public/.well-known/apple-app-site-association` (no extension).
3. Enable Cloudflare Email Routing if you want `hello@kalta.app` → `ondrej.michalcik@gmail.com`.
