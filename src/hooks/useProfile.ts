import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useProfile() {
  const getProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) return null
    return data as Profile
  }

  const getMyProfile = async (): Promise<Profile | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return getProfile(user.id)
  }

  const updateProfile = async (data: Partial<Profile>): Promise<{ error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('profiles')
      .upsert({ ...data, id: user.id, updated_at: new Date().toISOString() })

    return { error: error?.message || null }
  }

  const uploadAvatar = async (file: File): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const path = `${user.id}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) return null

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  return { getProfile, getMyProfile, updateProfile, uploadAvatar }
}
