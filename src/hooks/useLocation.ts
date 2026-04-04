import { useState, useEffect } from 'react'

interface LocationState {
  latitude: number | null
  longitude: number | null
  locationName: string
  error: string | null
  loading: boolean
}

interface UseLocationReturn extends LocationState {
  refreshLocation: () => void
  setManualLocation: (lat: number, lng: number, name: string) => void
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const addr = data.address
    if (addr) {
      const city = addr.city || addr.town || addr.village || addr.suburb || ''
      const state = addr.state || ''
      const country = addr.country_code?.toUpperCase() || ''
      return [city, state, country].filter(Boolean).join(', ')
    }
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`
  }
}

export function useLocation(): UseLocationReturn {
  const geolocationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    locationName: '',
    error: geolocationSupported ? null : 'Geolocation is not supported by your browser.',
    loading: geolocationSupported,
  })

  const refreshLocation = () => {
    if (!geolocationSupported) return

    setState(s => ({ ...s, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const locationName = await reverseGeocode(latitude, longitude)
        setState({ latitude, longitude, locationName, error: null, loading: false })
      },
      (err) => {
        setState(s => ({
          ...s,
          loading: false,
          error: err.message || 'Unable to retrieve your location.',
        }))
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  useEffect(() => {
    if (!geolocationSupported) return

    let cancelled = false

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const locationName = await reverseGeocode(latitude, longitude)
        if (!cancelled) {
          setState({ latitude, longitude, locationName, error: null, loading: false })
        }
      },
      (err) => {
        if (!cancelled) {
          setState(s => ({
            ...s,
            loading: false,
            error: err.message || 'Unable to retrieve your location.',
          }))
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    )

    return () => {
      cancelled = true
    }
  }, [geolocationSupported])

  const setManualLocation = (lat: number, lng: number, name: string) => {
    setState({ latitude: lat, longitude: lng, locationName: name, error: null, loading: false })
  }

  return { ...state, refreshLocation, setManualLocation }
}
