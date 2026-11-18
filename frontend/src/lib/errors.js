// Turn raw Supabase / network errors into something a person can act on.
export const friendlyError = (err) => {
  const raw = String(err?.message || err || '').toLowerCase();

  if (!raw) return 'Something went wrong. Please try again.';
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('network request failed'))
    return "We couldn't reach the server. Check your connection and try again.";
  if (raw.includes('invalid login credentials')) return 'That email and password don’t match. Try again or reset your password.';
  if (raw.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link we sent.';
  if (raw.includes('user already registered')) return 'An account with this email already exists. Try signing in instead.';
  if (raw.includes('password should be at least')) return 'Your password needs to be at least 6 characters.';
  if (raw.includes('rate limit') || raw.includes('too many requests')) return 'Too many attempts. Please wait a minute and try again.';
  if (raw.includes('jwt') || raw.includes('session') && raw.includes('expired')) return 'Your session has expired. Please sign in again.';
  if (raw.includes('schema cache') || raw.includes('does not exist'))
    return 'Your database needs a quick update. Run the latest Supabase migration (see supabase/migrations).';
  if (raw.includes('duplicate key') || raw.includes('already exists')) return 'That name is already in use.';
  if (raw.includes('violates check constraint')) return 'One of the values isn’t allowed. Check amounts are positive and names aren’t empty.';
  if (raw.includes('ai service') || raw.includes('categorize') || raw.includes('parse receipt'))
    return 'The smart assistant is unavailable right now. You can still add it manually.';
  if (raw.includes('bucket not found')) return 'Receipt storage isn’t set up yet. Run the latest Supabase migration.';
  if (raw.includes('payload too large') || raw.includes('exceeded the maximum')) return 'That file is too large. Try a smaller photo.';

  return 'Something went wrong. Please try again.';
};
