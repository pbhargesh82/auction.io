export const environment = {
  production: true,
  version: '1.0.0',
  supabase: {
    url: 'https://mcceuswycjpcsgseaixg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY2V1c3d5Y2pwY3Nnc2VhaXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMjYzMjUsImV4cCI6MjA2NjYwMjMyNX0.E2Fs5S7JbX9o4pQpwYhI9Zt01uz1YfPhsdPu85wBUbY'
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