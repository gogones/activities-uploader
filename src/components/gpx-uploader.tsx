import * as React from 'react'
import {
  IconAlertCircle,
  IconCheck,
  IconFile,
  IconLoader2,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

export interface GpxFile {
  file: File
  id: string
  status: UploadStatus
  progress?: number
  errorMessage?: string
}

interface GpxUploaderProps {
  onUploadBatch?: (
    files: Array<GpxFile>,
    updateStatus: (
      id: string,
      status: UploadStatus,
      errorMessage?: string,
    ) => void,
  ) => void
  isUploadingBatch?: boolean
}

export function GpxUploader({
  onUploadBatch,
  isUploadingBatch,
}: GpxUploaderProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const [files, setFiles] = React.useState<Array<GpxFile>>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDrag = function (e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = function (e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = function (e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = (newFiles: FileList) => {
    const gpxFiles = Array.from(newFiles).filter((file) =>
      file.name.toLowerCase().endsWith('.gpx'),
    )
    if (gpxFiles.length > 0) {
      const newGpxFiles = gpxFiles.map((file) => ({
        file,
        id: crypto.randomUUID(),
        status: 'pending' as UploadStatus,
      }))
      setFiles((prev) => [...prev, ...newGpxFiles])
    }
  }

  const removeFile = (idToRemove: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== idToRemove))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-primary/10">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Strava GPX Batch Uploader
        </CardTitle>
        <CardDescription>
          Upload multiple .gpx files to sync with your Strava account
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div
          className={cn(
            'relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out cursor-pointer group',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".gpx"
            multiple
            onChange={handleChange}
          />

          <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-4">
            <div
              className={cn(
                'p-4 rounded-full transition-transform duration-200 group-hover:scale-110',
                dragActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <IconUpload className="size-8" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                <span className="text-primary hover:underline">
                  Click to upload
                </span>{' '}
                or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Multiple GPX files allowed
              </p>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center justify-between">
              <span>Selected Files ({files.length})</span>
              {files.filter((f) => f.status === 'success').length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {files.filter((f) => f.status === 'success').length} uploaded
                </span>
              )}
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((gpxFile) => (
                <div
                  key={gpxFile.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm hover:shadow transition-shadow"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div
                      className={cn(
                        'p-2 rounded-md shrink-0',
                        gpxFile.status === 'success'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : gpxFile.status === 'error'
                            ? 'bg-destructive/10 text-destructive'
                            : gpxFile.status === 'uploading'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {gpxFile.status === 'success' ? (
                        <IconCheck className="size-5" />
                      ) : gpxFile.status === 'error' ? (
                        <IconAlertCircle className="size-5" />
                      ) : gpxFile.status === 'uploading' ? (
                        <IconLoader2 className="size-5 animate-spin" />
                      ) : (
                        <IconFile className="size-5" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-sm font-medium truncate"
                        title={gpxFile.file.name}
                      >
                        {gpxFile.file.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(gpxFile.file.size)}
                        </span>
                        {gpxFile.status !== 'pending' && (
                          <Badge
                            variant={
                              gpxFile.status === 'success'
                                ? 'default'
                                : gpxFile.status === 'error'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className={cn(
                              'text-[10px] uppercase tracking-wider h-4 px-1.5',
                              gpxFile.status === 'success' &&
                                'bg-green-500 hover:bg-green-600 text-white',
                              gpxFile.status === 'uploading' &&
                                'bg-primary text-primary-foreground animate-pulse',
                            )}
                          >
                            {gpxFile.status}
                          </Badge>
                        )}
                      </div>
                      {gpxFile.errorMessage && (
                        <span
                          className="text-xs text-destructive mt-0.5 max-w-[200px] truncate"
                          title={gpxFile.errorMessage}
                        >
                          {gpxFile.errorMessage}
                        </span>
                      )}
                    </div>
                  </div>

                  {gpxFile.status !== 'uploading' &&
                    gpxFile.status !== 'success' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeFile(gpxFile.id)}
                        disabled={isUploadingBatch}
                      >
                        <IconX className="size-4" />
                        <span className="sr-only">Remove file</span>
                      </Button>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {files.length > 0 && (
        <CardFooter className="bg-muted/30 border-t justify-between p-4">
          <Button
            variant="outline"
            onClick={() => setFiles([])}
            disabled={isUploadingBatch}
          >
            Clear All
          </Button>
          <Button
            onClick={() =>
              onUploadBatch?.(
                files.filter(
                  (f) => f.status === 'pending' || f.status === 'error',
                ),
                (id, status, error) => {
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === id ? { ...f, status, errorMessage: error } : f,
                    ),
                  )
                },
              )
            }
            disabled={
              files.filter(
                (f) => f.status === 'pending' || f.status === 'error',
              ).length === 0 || isUploadingBatch
            }
            className="min-w-[120px]"
          >
            {isUploadingBatch ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <IconUpload className="mr-2 size-4" />
                Upload{' '}
                {
                  files.filter(
                    (f) => f.status === 'pending' || f.status === 'error',
                  ).length
                }{' '}
                Files
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
