# Orbit

Orbit is a browser-based HTML, CSS, and JavaScript editor with a live preview. Projects save in the current browser until you sign in; signed-in projects sync to Supabase.

## Supabase setup

The browser uses the project's publishable key. It is expected to be public; never put a database password, secret key, or service-role key in `index.html`.

1. In Supabase, open **SQL Editor**, paste and run [`supabase/setup.sql`](supabase/setup.sql).
2. In **Authentication → URL Configuration**, set the Site URL to `https://save-codes.github.io/my-code/` and add that URL to the redirect URL allowlist.
3. Keep the **Email** provider enabled and turn off **Confirm email** in **Authentication → Sign In / Providers**. Users can create an account and sign in with only their email and password; signup does not send a confirmation email. Configure custom SMTP in **Authentication → SMTP Settings** if you want password reset emails delivered to users.
4. Upload the updated `index.html`, `README.md`, and `supabase/setup.sql` to the GitHub repository that publishes the Pages site. Pages will redeploy from its configured branch.

The SQL enables row-level security so authenticated users can only read or change their own projects. It also removes the old username-based signup trigger; existing accounts and their project data remain intact.
