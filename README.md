# Orbit

Orbit is a browser-based HTML, CSS, and JavaScript editor with a live preview. Projects save in the current browser until you sign in; signed-in projects sync to Supabase.

## Supabase setup

The browser uses the project's publishable key. It is expected to be public; never put a database password, secret key, or service-role key in `index.html`.

1. In Supabase, open **SQL Editor**, paste and run [`supabase/setup.sql`](supabase/setup.sql).
2. In **Authentication → URL Configuration**, set the Site URL to `https://save-codes.github.io/my-code/` and add that URL to the redirect URL allowlist.
3. Keep the **Email** provider enabled. Users choose a username, recovery email, and password. Email confirmation and password recovery use that email; Google sign-in is not used.
   The default Supabase email sender is for testing and may only send to project-team addresses. To confirm accounts for other people, configure a custom SMTP provider in **Authentication → SMTP Settings**.
4. Install the Supabase CLI, then from this repository run:

   ```sh
   supabase login
   supabase link --project-ref xxielgvlkjrkdnhiddrh
   supabase functions deploy username-login
   ```

   The deployed function uses Supabase's server-side environment variables. Do not copy a service-role or secret key into the website or share it.
5. Upload the updated `index.html`, `README.md`, and `supabase/` files to the GitHub repository that publishes the Pages site. Pages will redeploy from its configured branch.

The SQL enables row-level security so authenticated users can only read or change their own projects. Username lookup is performed by the `username-login` Edge Function; it does not expose account email addresses to other visitors.
