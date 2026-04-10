/**
 * Determine whether a profile's photo should be revealed to the current user.
 *
 * Rules:
 * 1. Users always see their own photo.
 * 2. If the profile owner opted into public photos, everyone sees it.
 * 3. Otherwise, only mutually connected (accepted) users see the photo.
 */
export function shouldShowPhoto(
  profileId: string,
  currentUserId: string,
  showPhotoPublicly: boolean,
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined'
): boolean {
  if (profileId === currentUserId) return true
  if (showPhotoPublicly) return true
  return connectionStatus === 'accepted'
}
