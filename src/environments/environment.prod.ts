export const environment = {
  production: true,
  version: '1.0.0',
  supabase: {
    url: 'https://uodenqudkimgnjgxuqxo.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZGVucXVka2ltZ25qZ3h1cXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMzMxMDQsImV4cCI6MjA2OTkwOTEwNH0.megbUMq7s3KZkRTN_OPCPhHzBsSWPNFeoVIbXkYrT0g'
  },
  auth: {
    redirectUrl: 'https://auction-io.netlify.app/auth/callback'
  },
  features: {
    enableAnalytics: true,
    enableRealtime: true,
    enableDebugMode: false
  }
}; 