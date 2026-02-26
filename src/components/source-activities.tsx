import { useState, useEffect } from 'react'
import { getActivities, exportActivityAsGpx, uploadToStrava } from '@/lib/strava'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IconCloudDownload, IconCheck, IconAlertCircle, IconLoader2, IconRun, IconBike } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SourceActivitiesProps {
  sourceToken: string
  targetToken: string
  sourceName?: string | null
  targetName?: string | null
}

export function SourceActivities({ sourceToken, targetToken, sourceName, targetName }: SourceActivitiesProps) {
  const [activities, setActivities] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [exportResults, setExportResults] = useState<Record<number, { success: boolean; error?: string }>>({})
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())

  useEffect(() => {
    loadActivities()
  }, [sourceToken, selectedYear])

  const loadActivities = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const year = parseInt(selectedYear, 10)
      const startOfYear = new Date(year, 0, 1).getTime() / 1000
      const endOfYear = new Date(year, 11, 31, 23, 59, 59).getTime() / 1000
      
      let allActivities: any[] = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        const data = await (getActivities as any)({ 
          data: { accessToken: sourceToken, perPage: 200, page, after: startOfYear, before: endOfYear } 
        })
        
        if (Array.isArray(data)) {
          allActivities = [...allActivities, ...data]
          if (data.length < 200) {
            hasMore = false
          } else {
            page++
          }
        } else {
          throw new Error('Invalid response from Strava')
        }
      }
      
      setActivities(allActivities)
    } catch (err: any) {
      console.error('Failed to load activities', err)
      setError(err.message || 'Failed to load activities from Source account')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async (activity: any) => {
    setExportingId(activity.id)
    try {
      // 1. Export as GPX String
      const exportRes = await (exportActivityAsGpx as any)({ data: { accessToken: sourceToken, activityId: activity.id } })
      
      if (!exportRes || !exportRes.success) {
        throw new Error('Failed to generate GPX from activity')
      }

      // 2. Convert to File
      const file = new File([exportRes.gpx], exportRes.filename, { type: 'application/gpx+xml' })
      
      // 3. Upload to Target
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accessToken', targetToken)

      await (uploadToStrava as any)({ data: formData })

      setExportResults(prev => ({ ...prev, [activity.id]: { success: true } }))
    } catch (err: any) {
      console.error(`Export failed for activity ${activity.id}:`, err)
      setExportResults(prev => ({ ...prev, [activity.id]: { success: false, error: err.message || 'Export failed' } }))
    } finally {
      setExportingId(null)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Source Activities</CardTitle>
            <CardDescription>
              Activities from {sourceName ? <span className="font-medium text-foreground">{sourceName}'s</span> : 'your Source'} account available for export to {targetName ? <span className="font-medium text-foreground">{targetName}</span> : 'Target'}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadActivities} disabled={isLoading}>
              {isLoading ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-start gap-3 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            <IconAlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {isLoading && activities.length === 0 ? (
          <div className="py-8 flex justify-center">
            <IconLoader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            No activities found in Source account for {selectedYear}.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map(activity => {
              const result = exportResults[activity.id]
              const isExporting = exportingId === activity.id
              const date = new Date(activity.start_date).toLocaleDateString()

              return (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-primary/10 rounded-full shrink-0 text-primary">
                      {activity.type === 'Ride' ? <IconBike className="w-5 h-5" /> : <IconRun className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-sm">{activity.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{date}</span>
                        <span>•</span>
                        <span>{(activity.distance / 1000).toFixed(2)} km</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 ml-4 flex items-center">
                    {result ? (
                      result.success ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1">
                          <IconCheck className="w-3 h-3" /> Exported
                        </Badge>
                      ) : (
                        <div className="flex flex-col items-end group relative">
                          <Badge variant="destructive" className="flex items-center gap-1 cursor-help">
                            <IconAlertCircle className="w-3 h-3" /> Failed
                          </Badge>
                          <div className="hidden group-hover:block absolute bottom-full right-0 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-md border z-10">
                            {result.error}
                          </div>
                        </div>
                      )
                    ) : (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleExport(activity)}
                        disabled={isExporting || exportingId !== null}
                      >
                        {isExporting ? (
                          <IconLoader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <IconCloudDownload className="w-4 h-4 mr-1.5" />
                            Export
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
