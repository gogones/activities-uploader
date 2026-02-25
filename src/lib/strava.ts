import { createServerFn } from '@tanstack/react-start'

export const uploadToStrava = createServerFn({ method: 'POST' }).handler(
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
    stravaFormData.append('description', 'Uploaded via Activity Uploader')
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
