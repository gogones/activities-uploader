import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { GpxFile } from '@/components/gpx-uploader'
import { GpxUploader } from '@/components/gpx-uploader'
import { StravaConnect } from '@/components/strava-connect'
import { SourceActivities } from '@/components/source-activities'
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
  const [sourceToken, setSourceToken] = useState<string | null>(null)
  const [targetToken, setTargetToken] = useState<string | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [targetName, setTargetName] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Check if we already have tokens saved
    const savedSourceToken = localStorage.getItem('strava_source_access_token')
    const savedTargetToken = localStorage.getItem('strava_target_access_token')
    const savedSourceName = localStorage.getItem('strava_source_athlete_name')
    const savedTargetName = localStorage.getItem('strava_target_athlete_name')
    
    if (savedSourceToken) setSourceToken(savedSourceToken)
    if (savedTargetToken) setTargetToken(savedTargetToken)
    if (savedSourceName) setSourceName(savedSourceName)
    if (savedTargetName) setTargetName(savedTargetName)

    // Check if we are returning from Strava OAuth
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')
    const state = urlParams.get('state') as 'source' | 'target' | null

    if (error) {
      setAuthError(`Authentication failed: ${error}`)
    } else if (code && state) {
      // Only process the code if we don't already have that token
      if ((state === 'source' && !savedSourceToken) || (state === 'target' && !savedTargetToken)) {
        handleAuthCode(code, state)
      }
    }
  }, [])

  const handleAuthCode = async (code: string, type: 'source' | 'target') => {
    setIsAuthenticating(true)
    setAuthError(null)
    try {
      const response = await (exchangeCodeForToken as any)({ data: code })

      if (response && response.success && response.accessToken) {
        if (type === 'source') {
          setSourceToken(response.accessToken)
          localStorage.setItem('strava_source_access_token', response.accessToken)
          if (response.athlete) {
            const name = `${response.athlete.firstname || ''} ${response.athlete.lastname || ''}`.trim()
            if (name) {
              setSourceName(name)
              localStorage.setItem('strava_source_athlete_name', name)
            }
          }
        } else {
          setTargetToken(response.accessToken)
          localStorage.setItem('strava_target_access_token', response.accessToken)
          if (response.athlete) {
            const name = `${response.athlete.firstname || ''} ${response.athlete.lastname || ''}`.trim()
            if (name) {
              setTargetName(name)
              localStorage.setItem('strava_target_athlete_name', name)
            }
          }
        }
        
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

  const handleLogout = (type: 'source' | 'target' | 'all') => {
    if (type === 'source' || type === 'all') {
      localStorage.removeItem('strava_source_access_token')
      localStorage.removeItem('strava_source_athlete_name')
      setSourceToken(null)
      setSourceName(null)
    }
    if (type === 'target' || type === 'all') {
      localStorage.removeItem('strava_target_access_token')
      localStorage.removeItem('strava_target_athlete_name')
      setTargetToken(null)
      setTargetName(null)
    }
  }

  const handleBatchUpload = async (
    filesToUpload: Array<GpxFile>,
    updateFileStatus: (
      id: string,
      status: 'uploading' | 'success' | 'error' | 'pending',
      error?: string,
    ) => void,
  ) => {
    if (!targetToken) {
      setAuthError('You need to connect to the Target Strava account first.')
      return
    }

    setIsUploading(true)
    setResults([])

    for (const gpxFile of filesToUpload) {
      updateFileStatus(gpxFile.id, 'uploading')

      try {
        const formData = new FormData()
        formData.append('file', gpxFile.file)
        formData.append('accessToken', targetToken)

        await (uploadToStrava as any)({ data: formData })

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
          handleLogout('target')
          setAuthError('Your Target Strava session expired. Please connect again.')
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
            Strava Shifter
          </h1>
          <p className="text-xl text-muted-foreground w-full max-w-2xl mx-auto">
            Batch upload your .gpx files directly to Strava.
          </p>
        </div>

        <div className="pt-8 w-full max-w-2xl mx-auto space-y-8">
          {(!sourceToken || !targetToken) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!sourceToken ? (
                <StravaConnect type="source" isLoading={isAuthenticating} error={authError} />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card shadow-sm">
                  <h3 className="font-semibold text-lg text-green-600 mb-1">Source Connected</h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    {sourceName ? `Connected as ${sourceName}` : 'Ready to export your activities.'}
                  </p>
                  <button 
                    onClick={() => handleLogout('source')}
                    className="text-sm font-medium text-destructive hover:underline underline-offset-4"
                  >
                    Disconnect Source
                  </button>
                </div>
              )}
              
              {!targetToken ? (
                <StravaConnect type="target" isLoading={isAuthenticating} error={authError} />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card shadow-sm">
                  <h3 className="font-semibold text-lg text-green-600 mb-1">Target Connected</h3>
                  <p className="text-sm text-muted-foreground text-center mb-6">
                    {targetName ? `Connected as ${targetName}` : 'Ready to upload activities.'}
                  </p>
                  <button 
                    onClick={() => handleLogout('target')}
                    className="text-sm font-medium text-destructive hover:underline underline-offset-4"
                  >
                    Disconnect Target
                  </button>
                </div>
              )}
            </div>
          )}

          {sourceToken && targetToken && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => handleLogout('all')}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Disconnect All Accounts
                </button>
              </div>

              <div className="space-y-12">
                <SourceActivities 
                  sourceToken={sourceToken} 
                  targetToken={targetToken} 
                  sourceName={sourceName} 
                  targetName={targetName} 
                />

                <div className="space-y-4">
                  <h2 className="text-xl font-bold tracking-tight">Upload Local GPX Files</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your own GPX files directly to {targetName ? <span className="font-medium text-foreground">{targetName}'s</span> : 'Target'} account.
                  </p>
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
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
