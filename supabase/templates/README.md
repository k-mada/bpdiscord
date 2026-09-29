# Auth email templates

Branded HTML for the Supabase auth emails, styled to the site (light shell,
dark brand header, accent-green CTA). One source of truth lives here; the
hosted project and the local stack are both fed from these files.

| File | Supabase email type | Subject |
| --- | --- | --- |
| `recovery.html` | Reset Password | Reset your Big Picture Discord password |
| `magic_link.html` | Magic Link | Your Big Picture Discord sign-in link |

## Why the `{{ .ConfirmationURL }}` token must stay

Both templates use `{{ .ConfirmationURL }}` for the button and the copy-paste
link. That token carries the `redirect_to` back to `/reset-password`. Replacing
it with a hand-built `{{ .SiteURL }}` link drops the redirect and sends users to
the site root — the bug fixed in #236. Leave it intact.

## Local preview (Mailpit)

`supabase/config.toml` points the local stack at these files, so a restart picks
them up:

```bash
supabase stop && supabase start   # config is read at start
```

Trigger an email and view it at Mailpit (http://127.0.0.1:54324):

- Reset: use the app's Forgot Password, or `POST /auth/v1/recover`.
- Magic link: `POST /auth/v1/magiclink`.

## Install on production

The hosted project is **not** driven by these files — paste them in:

1. Dashboard → Authentication → Email Templates.
2. For **Reset Password** and **Magic Link**: set the subject (table above) and
   paste the matching file's contents into the message body. Save each.
3. Send yourself one and confirm the button link resolves to
   `https://thebigpicdiscord.com/reset-password` (reset) before relying on it.

Keep this repo copy and the dashboard in sync when either changes.

## Notes

- Web fonts (Be Vietnam Pro) are not used — Gmail/Outlook strip them. A system
  sans stack approximates it.
- "This link expires in 1 hour" matches Supabase's default OTP expiry. If you
  change that in Auth settings, update the copy in both files.
- The logo is referenced by absolute URL (`https://thebigpicdiscord.com/bpd-logo.png`),
  served from the client `public/` dir. Relative paths don't work in email. That
  filename is allowlisted in `vercel.json`'s static-asset route; a new logo name
  must be added there too or prod serves the SPA HTML instead of the image.
  The image only resolves once this branch is deployed to prod.
