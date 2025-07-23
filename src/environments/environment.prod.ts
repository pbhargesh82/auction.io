export const environment = {
  production: true,
  supabase: {
    url: process.env['SUPABASE_URL'] || 'YOUR_SUPABASE_URL',
    anonKey: process.env['SUPABASE_ANON_KEY'] || 'YOUR_SUPABASE_ANON_KEY'
  }
}; 