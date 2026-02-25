import * as React from 'react'
import {
  IconAlertCircle,
  IconBrandStrava,
  IconLoader2,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getStravaAuthUrl } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface StravaConnectProps {
  type: 'source' | 'target'
  isLoading?: boolean
  error?: string | null
}

export function StravaConnect({ type, isLoading, error }: StravaConnectProps) {
  const [authUrl, setAuthUrl] = React.useState<string | null>(null)
  const [isFetchingUrl, setIsFetchingUrl] = React.useState(false)

  React.useEffect(() => {
    async function fetchUrl() {
      setIsFetchingUrl(true)
      try {
        const url = await getStravaAuthUrl({ data: type })
        setAuthUrl(url)
      } catch (e) {
        console.error('Failed to fetch Strava auth URL', e)
      } finally {
        setIsFetchingUrl(false)
      }
    }

    fetchUrl()
  }, [])

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-primary/20 bg-card overflow-hidden">
      <div className="h-2 w-full bg-[#FC4C02]" />{' '}
      {/* Strava Orange branding bar */}
      <CardHeader className="text-center pt-8 pb-4">
        <div className="mx-auto bg-muted p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 shadow-inner">
          <IconBrandStrava className="w-12 h-12 text-[#FC4C02]" />
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight">
          {type === 'source' ? 'Connect Source Account' : 'Connect Target Account'}
        </CardTitle>
        <CardDescription className="text-base mt-2">
          {type === 'source' 
            ? 'Authorize to read and export your activities.' 
            : 'Authorize to upload activities directly to this account.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-8 space-y-6">
        {error && (
          <div className="w-full flex items-start gap-3 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            <IconAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="w-full space-y-4">
          <Button
            asChild={!!authUrl && !isLoading}
            disabled={!authUrl || isLoading || isFetchingUrl}
            className={cn(
              'w-full h-14 text-base font-bold transition-all shadow-md active:shadow-sm',
              'bg-[#FC4C02] hover:bg-[#E34402] text-white',
              isLoading || isFetchingUrl || !authUrl
                ? 'opacity-70 cursor-not-allowed'
                : '',
            )}
          >
            {authUrl && !isLoading ? (
              <a href={authUrl}>
                {type === 'source' ? 'Connect Source (Export)' : 'Connect Target (Upload)'}
              </a>
            ) : (
              <span>
                <IconLoader2 className="mr-2 h-5 w-5 animate-spin inline-block" />
                {isLoading ? 'Authenticating...' : 'Loading...'}
              </span>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground px-4">
            You will be redirected to Strava to securely authorize access to
            your account.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
