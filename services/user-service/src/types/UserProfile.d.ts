export type UserProfile = {
  name: string;
  email: string;
  education_level: string;
  experience_level: string;
  preferred_roles: string[];
  website: string;
  description: string;
  bio: string;
  cv_url?: string;
  joined_at?: string;
};
