# Private file library

This site is a static GitHub Pages front end. Supabase Auth controls sign-in,
and files live in a private Supabase Storage bucket. Viewers can list and open
files; admins can also upload and delete them. The repository does not contain
the files, passwords, or a Supabase service-role key.

## Set up Supabase

1. Create a Supabase project.
2. In **Project Settings > API**, copy the **Project URL** and **anon/public key**.
   Put them in `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `javascript.js`.
   The anon key is designed for browser use. Never put a `service_role` key in
   this site or in GitHub.
3. Open **SQL Editor**, run `supabase-setup.sql`.
4. In **Authentication > Users**, create one account for each admin or viewer.
   Disable public sign-ups in **Authentication > Settings** so strangers cannot
   create accounts.
5. Copy each user's UUID and run the matching role statement at the bottom of
   `supabase-setup.sql` in the SQL Editor. Assign `admin` only to trusted users;
   everyone else should be `viewer`.
6. Deploy the repository to GitHub Pages. Use HTTPS when opening the site.

Use the account email and password to sign in. Supabase enforces access on the
server: a viewer cannot upload or delete files even if they modify the page.
Signed viewing links expire after ten minutes. If an account is compromised,
change its password or remove its row from `vault_users`.

The GitHub repository should contain only the site code. Upload private files
through the admin section after setup; do not commit them to the repository.
