import { createServerFn } from '@tanstack/react-start'

export const getStravaAuthUrl = createServerFn({ method: 'GET' }).handler(
  async () => {
    const clientId = process.env.STRAVA_CLIENT_ID

    if (!clientId) {
      throw new Error('STRAVA_CLIENT_ID is not configured in .env')
    }

    // Use the current origin or default to localhost:3000 for local dev
    const redirectUri =
      process.env.NODE_ENV === 'production'
        ? process.env.BASE_URL || 'https://your-production-url.com'
        : 'http://localhost:3000'

    const authUrl = new URL('https://www.strava.com/oauth/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('approval_prompt', 'force')
    authUrl.searchParams.append('scope', 'activity:write')

    return authUrl.toString()
  },
)

export const exchangeCodeForToken = createServerFn({ method: 'POST' }).handler(
  async ({ data: code }: { data: string }) => {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Strava API credentials are not fully configured in .env')
    }

    try {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(
          'Strava Token Exchange Error:',
          response.status,
          errorText,
        )
        throw new Error(`Failed to exchange token: ${errorText}`)
      }

      const data = await response.json()
      // data contains: access_token, refresh_token, expires_at, expires_in, athlete

      return {
        success: true,
        accessToken: data.access_token,
        athlete: data.athlete,
      }
    } catch (error: any) {
      console.error('Error exchanging code for token:', error)
      throw new Error(error.message || 'Failed to authenticate with Strava')
    }
  },
)
