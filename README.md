# Darbar Secondary School website

## Secure notice portal setup

The public website can display notices without logging in. Notice publishing, deletion, and image uploads require Supabase Auth and database/storage policies; the browser never contains an administrator password or service-role key.

1. Create a Supabase project.
2. In **Project Settings → API**, copy the project URL and the **publishable** key (or legacy anon key). Put them in a root `.env.local` file using the names in `.env.example`. These are public client values; never put a service-role/secret key in a `VITE_` variable.
3. Open the Supabase **SQL Editor** and run `supabase/migrations/20261001000000_secure_notice_portal.sql`, then run `supabase/migrations/20261013000000_complaints_inbox.sql`, followed by `supabase/migrations/20261014000000_limit_complaint_submissions.sql`.
4. In **Authentication → Providers → Email**, disable public sign-ups. Create the single administrator account yourself from the Supabase dashboard; do not add a public registration page.
5. In **Authentication → Users**, copy that account's user UUID. In the SQL Editor, allow-list only that account:

   ```sql
   insert into public.school_admins (user_id)
   values ('PASTE-THE-ADMIN-USER-UUID-HERE');
   ```

   Do not share or insert any other user's UUID. The migration grants no client permission to edit this allow-list.
6. Give the account a new, unique password. The old password that used to be embedded in the frontend must be treated as exposed and must not be reused.
7. Restart the development server after setting `.env.local`, then deploy the same two public variables through the hosting provider's environment-variable settings and rebuild the site.

The SQL policies allow the public to read notices and published images, but only the allow-listed authenticated account can create/delete notices or upload/remove notice images. The image bucket limits uploads to JPG, PNG, or WebP files up to 1 MB. Authenticated sessions are managed by Supabase; browser state alone does not grant write access.

The complaints migration adds a separate `/admin/complaints` inbox. Anyone can submit a complaint and up to four JPG, PNG, or WebP images (1 MB each); complaint records are not publicly readable, and only allow-listed admins can read, resolve, or delete them. Complaint images are stored in a private bucket and are shown to admins through short-lived signed URLs. An administrator must be signed in to open the inbox.

The complaint rate-limit migration permits up to three submissions using the same normalized contact value per hour. This limits repeated submissions but is not IP-based bot protection; a production CAPTCHA or WAF requires a server-verified challenge or hosting-level configuration.

Run all three migrations in the production Supabase project before deploying the updated frontend. The complaint form reports configuration or submission errors rather than showing a false success when Supabase is unavailable.

For bot resistance, keep Supabase Auth's rate limits enabled and keep public account sign-ups disabled. Cloudflare bot/rate-limit protections add a layer for the hosted website, but do not replace Supabase Auth controls or database row-level security. Supabase CAPTCHA/Turnstile token handling is not wired into this frontend; do not enable Supabase CAPTCHA until the login form is updated to provide its token. No static site setup can guarantee protection from every denial-of-service attack.

## Development

```sh
npm install
npm run dev
```

Without Supabase environment variables, the app only shows its sample notices; admin login and notice publishing are unavailable. This mode is for local preview and is not shared between visitors.
