# Google OAuth Setup

Use this guide when Google sign-in fails with **`401: deleted_client`** or after rotating OAuth credentials.

## Architecture

```
User → Angular app → Supabase Auth → Google OAuth → Supabase callback → App /auth/callback
```

- **Google redirect URI** (one only): Supabase handles the Google callback.
- **App redirect URLs** (multiple): Supabase sends the user back to your app after auth.

## Project values

| Setting | Value |
|---|---|
| Supabase project ref | `uodenqudkimgnjgxuqxo` |
| Supabase URL | `https://uodenqudkimgnjgxuqxo.supabase.co` |
| Google redirect URI (in GCP) | `https://uodenqudkimgnjgxuqxo.supabase.co/auth/v1/callback` |

### App redirect URLs (Supabase allow-list)

Add every environment you use:

| Environment | Redirect URL |
|---|---|
| Local dev | `http://localhost:4200/auth/callback` |
| Develop | `https://auction-io-develop.netlify.app/auth/callback` |
| Production | `https://auction-io.netlify.app/auth/callback` |

The app uses `window.location.origin + '/auth/callback'` at runtime, so any new deploy origin must be added to Supabase **before** Google sign-in will work there.

---

## Part 1 — Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `auction-io-auth`).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Auction.io`
   - Support email: your email
   - Scopes: `email`, `profile`, `openid`
   - While in **Testing** mode, add sign-in accounts under **Test users**
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type: **Web application**
   - Name: `Auction.io Supabase`
   - **Authorized redirect URIs** — add exactly:

     ```
     https://uodenqudkimgnjgxuqxo.supabase.co/auth/v1/callback
     ```

4. Copy the **Client ID** and **Client Secret**.

Do **not** add Netlify or localhost URLs to Google redirect URIs — those belong in Supabase only.

---

## Part 2 — Supabase Dashboard

Open [Supabase → Authentication](https://supabase.com/dashboard/project/uodenqudkimgnjgxuqxo/auth/providers).

### Enable Google provider

1. **Providers → Google**
2. Enable Google
3. Paste **Client ID** and **Client Secret** from Part 1
4. Save

### Redirect URL allow-list

1. **URL Configuration → Redirect URLs**
2. Add all URLs from the table above (local, develop, production)
3. Set **Site URL** to the environment you are actively testing:
   - Develop: `https://auction-io-develop.netlify.app`
   - Production: `https://auction-io.netlify.app`
   - Local only: `http://localhost:4200`

If Site URL is `http://localhost:4200` while testing on develop Netlify, Google OAuth will redirect back to localhost after sign-in.

### Site URL checklist (required for new Google accounts)

Open [URL Configuration](https://supabase.com/dashboard/project/uodenqudkimgnjgxuqxo/auth/url-configuration) and confirm:

| Setting | Develop testing value |
|---|---|
| **Site URL** | `https://auction-io-develop.netlify.app` |
| **Redirect URLs** | All three callback URLs from the table above |

If users appear in Supabase Authentication but are not logged in on the site, Site URL is almost certainly still set to localhost.

### Google OAuth consent (required for all accounts)

Open [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent):

- **Testing** mode: only emails listed under **Test users** can sign in
- **Published** app: any Google account can sign in

---

## Part 3 — App code (already implemented)

[`src/app/services/supabase.service.ts`](../src/app/services/supabase.service.ts):

- Dynamic redirect: `window.location.origin + '/auth/callback'`
- PKCE flow (`flowType: 'pkce'`)
- OAuth hash recovery on app init (`recoverSessionFromUrl()`)
- Redirects tokens landing on `/` or `/login` to `/auth/callback` via [`app.ts`](../src/app/app.ts)

---

## Verification

**Test on** `https://auction-io-develop.netlify.app/login` — not localhost — unless `npm start` is running.

1. Open the develop login page
2. Click **Continue with Google**
3. Google consent screen appears (no `deleted_client`)
4. After approval → `https://auction-io-develop.netlify.app/auth/callback` → `/home`
5. User appears under Supabase **Authentication → Users** and is logged in in the browser

### Common errors

| Error | Fix |
|---|---|
| User in Supabase Auth but not logged in | Site URL wrong — session tokens never reached app origin. Set Site URL to your active deploy. |
| Chrome interstitial / “prevented page load” | OAuth redirect to unreachable URL (usually localhost). Fix Supabase Site URL; test on develop Netlify URL |
| Chrome bounce tracking warning (Issues tab) | Informational — Supabase is an intermediate OAuth hop. Ignore if login completes on develop |
| `401: deleted_client` | Recreate OAuth client in GCP; update Supabase Google provider |
| Redirect to wrong host | Add that origin’s `/auth/callback` to Supabase redirect URLs |
| `redirect_uri_mismatch` (Google) | GCP redirect URI must be exactly the Supabase callback URL |
| Access blocked (Testing) | Publish OAuth app or add the Google account under **Test users** |
| Redirect to `localhost:4200` from develop/production | Supabase **Site URL** is still `http://localhost:4200`, or the deploy origin’s `/auth/callback` is missing from **Redirect URLs** |
| Tokens in URL at `localhost:4200/#access_token=...` (no `/auth/callback`) | Same as above — Supabase fell back to Site URL. OAuth succeeded; fix Supabase URL config and retry |
| Safari “Can’t Connect to the Server” on localhost after Google | OAuth redirected to localhost without `ng serve` running. Fix Supabase Site URL for develop |
| “Sign-in completed but session could not be established” | OAuth callback timed out or redirect misconfigured. Check Site URL and redirect allow-list |

---

## Recovery checklist

If OAuth breaks again:

- [ ] New or existing GCP OAuth Web client with Supabase callback URI
- [ ] Supabase Google provider Client ID + Secret updated (replace stale client if you see `deleted_client`)
- [ ] **Site URL** set to active deploy (not localhost when testing develop)
- [ ] **Redirect URLs** include develop, production, and localhost callbacks
- [ ] Google OAuth app **published** (or test users added for each account)

### Known stale client (2026-07-31)

Develop/production currently redirect to this deleted Google client until Supabase is updated:

```
513811288769-3e7saqio0amnj9vio0uf89j9rrpkfpoh.apps.googleusercontent.com
```

Replace it in **Supabase → Authentication → Providers → Google** with a new Client ID from Part 1.
