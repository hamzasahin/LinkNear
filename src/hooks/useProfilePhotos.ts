import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { validateAndCompress } from '../lib/imagePipeline'

export interface ProfilePhoto {
  id: string
  user_id: string
  photo_url: string
  sort_order: number
  created_at: string
}

const MAX_PHOTOS = 6

export function useProfilePhotos() {
  const [photos, setPhotos] = useState<ProfilePhoto[]>([])
  const [loading, setLoading] = useState(false)

  const getPhotos = useCallback(async (userId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('profile_photos')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
    setPhotos((data || []) as ProfilePhoto[])
    setLoading(false)
    return (data || []) as ProfilePhoto[]
  }, [])

  const uploadPhoto = useCallback(async (file: File): Promise<{ error: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    // Check limit
    const { count } = await supabase
      .from('profile_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count || 0) >= MAX_PHOTOS) return { error: `Maximum ${MAX_PHOTOS} photos allowed` }

    let processed
    try {
      processed = await validateAndCompress(file)
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }

    const uuid = crypto.randomUUID()
    const path = `${user.id}/photos/${uuid}.${processed.extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, processed.blob, { contentType: processed.mimeType })
    if (uploadError) return { error: uploadError.message }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: insertError } = await supabase
      .from('profile_photos')
      .insert({
        user_id: user.id,
        photo_url: urlData.publicUrl,
        sort_order: (count || 0),
      })
    if (insertError) return { error: insertError.message }

    await getPhotos(user.id)
    return { error: null }
  }, [getPhotos])

  const deletePhoto = useCallback(async (photoId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('profile_photos')
      .delete()
      .eq('id', photoId)
    if (error) return { error: error.message }

    setPhotos(prev => prev.filter(p => p.id !== photoId))
    return { error: null }
  }, [])

  return { photos, loading, getPhotos, uploadPhoto, deletePhoto, MAX_PHOTOS }
}
