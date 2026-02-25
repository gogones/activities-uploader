import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { GpxFile } from '@/components/gpx-uploader'
import { GpxUploader } from '@/components/gpx-uploader'
import { StravaConnect } from '@/components/strava-connect'
import { uploadToStrava } from '@/lib/strava'
import { exchangeCodeForToken } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<
    Array<{ name: string; success: boolean; message?: string }>
  >([])

  // Auth state
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we already have a token saved
    const savedToken = localStorage.getItem('strava_access_token')
    if (savedToken) {
      setAccessToken(savedToken)
    }

    // Check if we are returning from Strava OAuth
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      setAuthError(`Authentication failed: ${error}`)
    } else if (code && !savedToken) {
      handleAuthCode(code)
    }
  }, [])

  const handleAuthCode = async (code: string) => {
    setIsAuthenticating(true)
    setAuthError(null)
    try {
      const response = await exchangeCodeForToken({ data: code })

      if (response && response.success && response.accessToken) {
        setAccessToken(response.accessToken)
        localStorage.setItem('strava_access_token', response.accessToken)
        // Clean up the URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        )
      } else {
        throw new Error('No access token received')
      }
    } catch (err: any) {
      console.error('Failed to exchange code:', err)
      setAuthError(err.message || 'Failed to complete authentication')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('strava_access_token')
    setAccessToken(null)
  }

  const handleBatchUpload = async (
    filesToUpload: Array<GpxFile>,
    updateFileStatus: (
      id: string,
      status: 'uploading' | 'success' | 'error' | 'pending',
      error?: string,
    ) => void,
  ) => {
    if (!accessToken) {
      setAuthError('You need to connect to Strava first.')
      return
    }

    setIsUploading(true)
    setResults([])

    for (const gpxFile of filesToUpload) {
      updateFileStatus(gpxFile.id, 'uploading')

      try {
        const formData = new FormData()
        formData.append('file', gpxFile.file)
        formData.append('accessToken', accessToken)

        await uploadToStrava({ data: formData })

        updateFileStatus(gpxFile.id, 'success')
        setResults((prev) => [
          ...prev,
          { name: gpxFile.file.name, success: true },
        ])
      } catch (error: any) {
        console.error(`Failed to upload ${gpxFile.file.name}:`, error)
        const errorMessage = error.message || 'Unknown error occurred'

        // Treat 401 as a token expiration
        if (errorMessage.includes('401')) {
          handleLogout()
          setAuthError('Your Strava session expired. Please connect again.')
        }

        updateFileStatus(gpxFile.id, 'error', errorMessage)
        setResults((prev) => [
          ...prev,
          { name: gpxFile.file.name, success: false, message: errorMessage },
        ])
      }

      // Add a small delay between uploads to respect rate limits
      if (filesToUpload.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    setIsUploading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 md:p-8">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Activity Uploader
          </h1>
          <p className="text-xl text-muted-foreground w-full max-w-2xl mx-auto">
            Batch upload your .gpx files directly to Strava.
          </p>
        </div>

        <div className="pt-8 w-full max-w-2xl mx-auto">
          {!accessToken ? (
            <StravaConnect isLoading={isAuthenticating} error={authError} />
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Disconnect from Strava
                </button>
              </div>

              <GpxUploader
                isUploadingBatch={isUploading}
                onUploadBatch={(
                  files: Array<GpxFile>,
                  updateStatus: (
                    id: string,
                    status: 'uploading' | 'success' | 'error' | 'pending',
                    errorMessage?: string,
                  ) => void,
                ) => handleBatchUpload(files, updateStatus)}
              />

              {results.length > 0 && !isUploading && (
                <div className="mt-8 p-6 bg-card rounded-xl border shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Upload Summary</h3>
                  <div className="space-y-2">
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-1 border-b last:border-0 border-border/50"
                      >
                        <span className="font-medium truncate mr-4">
                          {result.name}
                        </span>
                        <Badge
                          variant={result.success ? 'default' : 'destructive'}
                          className={
                            result.success
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : ''
                          }
                        >
                          {result.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
