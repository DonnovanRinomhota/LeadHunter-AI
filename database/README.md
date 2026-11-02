# Database

1. Create a Supabase project.
2. Review `migrations/001_initial_schema.sql`.
3. Apply it to a development project first.
4. Create at least one workspace and add team members through the intended admin process.
5. Test RLS using two different authenticated users before adding real data.

The migration is a starting point, not a substitute for a security review. The app must validate workspace membership on server-side operations as well as rely on RLS.
