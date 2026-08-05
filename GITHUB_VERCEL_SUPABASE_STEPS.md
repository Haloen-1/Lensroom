# Lensroom: GitHub + Vercel + Supabase Setup

## 1. Create Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste and run the contents of `supabase-schema.sql`.
4. Open **Project Settings > API**.
5. Copy:
   - Project URL
   - `service_role` key

Keep the service role key private. Do not put it in browser code.

## 2. Create GitHub Repo

1. Create a new GitHub repository.
2. Upload this project source.
3. Commit to the default branch.

## 3. Connect Vercel

1. In Vercel, create a new project from the GitHub repo.
2. Add these environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET` with value `photos`
3. Deploy.

## 4. Use Studio

1. Go to `/studio`.
2. Default passphrase: `lensroom2028`.
3. Upload a test photo.
4. Check the public gallery.

## 5. Add Domain

In Vercel, add your domain to the same project. If your domain is
`lensroom.com`, Studio will be available at `lensroom.com/studio`.
