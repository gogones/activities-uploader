import { createServerFn } from '@tanstack/react-start'

export const uploadToStrava = createServerFn({ method: 'POST' }).handler(
  // @ts-expect-error ServerFn types are too complex without a validation library
  async ({ data: formData }: { data: FormData }) => {
    const accessToken = formData.get('accessToken') as string
    if (!accessToken) {
      throw new Error('No access token provided')
    }

    const file = formData.get('file') as File
    if (!file) {
      throw new Error('No file provided')
    }

    // We need to create a new FormData payload specifically for the Strava API
    const stravaFormData = new FormData()
    stravaFormData.append('file', file)
    stravaFormData.append('name', file.name.replace('.gpx', ''))
    stravaFormData.append('description', 'Uploaded via Strava Shifter')
    stravaFormData.append('data_type', 'gpx')

    // Optional parameters could be added here
    // stravaFormData.append('trainer', '0')
    // stravaFormData.append('commute', '0')

    console.log(`Uploading file ${file.name} to Strava...`)

    try {
      const response = await fetch('https://www.strava.com/api/v3/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          // Note: Do not set Content-Type header when using FormData with fetch,
          // it will automatically set the correct boundary.
        },
        body: stravaFormData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Strava API Error:', response.status, errorText)
        throw new Error(`Strava API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('Upload response:', data)

      return {
        success: true,
        uploadId: data.id,
        activityId: data.activity_id,
        status: data.status,
        filename: file.name,
      }
    } catch (error: any) {
      console.error('Error uploading to Strava:', error)
      throw new Error(error.message || 'Failed to upload to Strava')
    }
  },
)

export const getActivities = createServerFn({ method: 'POST' }).handler(
  // @ts-expect-error Types missing
  async ({ data: { accessToken, page = 1, perPage = 30, after, before } }: { data: { accessToken: string; page?: number; perPage?: number; after?: number; before?: number } }) => {
    if (!accessToken) throw new Error('No access token provided')

    try {
      const url = new URL('https://www.strava.com/api/v3/athlete/activities')
      url.searchParams.append('page', String(page))
      url.searchParams.append('per_page', String(perPage))
      if (after !== undefined) {
        url.searchParams.append('after', String(after))
      }
      if (before !== undefined) {
        url.searchParams.append('before', String(before))
      }

      const response = await fetch(
        url.toString(),
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (!response.ok) {
        throw new Error(`Strava API Error: ${response.status} ${await response.text()}`)
      }

      return await response.json()
    } catch (error: any) {
      console.error('Error fetching activities:', error)
      throw new Error(error.message || 'Failed to fetch activities')
    }
  }
)

export const exportActivityAsGpx = createServerFn({ method: 'POST' }).handler(
  // @ts-expect-error Types missing
  async ({ data: { accessToken, activityId } }: { data: { accessToken: string; activityId: string | number } }) => {
    if (!accessToken) throw new Error('No access token provided')

    try {
      // 1. Fetch Activity Details (to get the name and start time)
      const activityRes = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!activityRes.ok) throw new Error('Failed to fetch activity details')
      const activity = await activityRes.json()

    console.log(activity)

      // 2. Fetch Streams
      const streamsRes = await fetch(
        `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,latlng,altitude&key_by_type=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!streamsRes.ok) throw new Error('Failed to fetch activity streams')
      const streams = await streamsRes.json()

      // 3. Construct GPX
      if (!streams.time || !streams.latlng) {
        throw new Error('Activity does not have GPS data streams')
      }

      // Strava start_date is ISO8601 string
      const startTimeMs = new Date(activity.start_date).getTime()
      
      const typeMapping: Record<string, string> = {
        Ride: 'cycling',
        Walk: 'walking',
        Run: 'running',
      }
      const gpxActivityType = typeMapping[activity.type] || activity.sport_type || activity.type

      let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Strava Shifter" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${activity.name}</name>
    <time>${activity.start_date}</time>
  </metadata>
  <trk>
    <name>${activity.name}</name>
    <type>${gpxActivityType}</type>
    <trkseg>
`

      const timeStream = streams.time.data
      const latlngStream = streams.latlng.data
      const altitudeStream = streams.altitude ? streams.altitude.data : null

      for (let i = 0; i < latlngStream.length; i++) {
        const [lat, lng] = latlngStream[i]
        const timeOffset = timeStream[i] // offset in seconds from start
        const ptTime = new Date(startTimeMs + timeOffset * 1000).toISOString()
        const ele = altitudeStream ? altitudeStream[i] : 0

        gpx += `      <trkpt lat="${lat}" lon="${lng}">
        <ele>${ele}</ele>
        <time>${ptTime}</time>
      </trkpt>\n`
      }

      gpx += `    </trkseg>
  </trk>
</gpx>`

      return {
        success: true,
        gpx,
        filename: `${activity.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`,
        name: activity.name,
      }
    } catch (error: any) {
      console.error('Error exporting activity:', error)
      throw new Error(error.message || 'Failed to export activity')
    }
  }
)
