export type AuthProvider = 'email' | 'google';

export interface UserProfile {
  user_id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  bio: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  auth_provider: AuthProvider;
  created_at: string;
  updated_at: string;
}

export interface UserProfileUpdate {
  display_name?: string | null;
  full_name?: string | null;
  bio?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
}
