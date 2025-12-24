// src/utils/auth.js
import { supabase } from '../supabaseClient';

export const signUpDirector = async (email, password, fullName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'director',
      },
    },
  });
  return { data, error };
};

export const signInDirector = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOutDirector = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentDirector = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  return { user, profile };
};