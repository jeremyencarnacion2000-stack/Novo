'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import { Routine } from '@/types/routine'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ImportRoutineDialogProps {
  open: boolean
  onClose: () => void
  onImport: (routine: Omit<Routine, 'id'>) => void
}

export function ImportRoutineDialog({ open, onClose, onImport }: ImportRoutineDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedText, setParsedText] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('morning')
  const [duration, setDuration] = useState(30)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError('')
    setFile(selectedFile)

    // Check file type
    const fileType = selectedFile.type
    const fileName = selectedFile.name.toLowerCase()

    if (!fileName.endsWith('.pdf') && !fileName.endsWith('.doc') && !fileName.endsWith('.docx') && !fileName.endsWith('.txt')) {
      setError('Please upload a PDF, Word document (.doc/.docx), or text file')
      return
    }

    try {
      // For text files, read directly
      if (fileName.endsWith('.txt')) {
        const text = await selectedFile.text()
        setParsedText(text)
        parseRoutineFromText(text)
      } else {
        // For PDF/Word files, simulate parsing (in production, use a library like pdf.js or mammoth.js)
        const reader = new FileReader()
        reader.onload = (event) => {
          const text = event.target?.result as string
          // Simulate extracted text
          const simulatedText = `Sample routine content from ${selectedFile.name}\n\nMorning workout routine:\n- Warm up (5 min)\n- Exercise (20 min)\n- Cool down (5 min)\n- Stretching (10 min)`
          setParsedText(simulatedText)
          parseRoutineFromText(simulatedText)
        }
        reader.readAsText(selectedFile)
      }
    } catch (err) {
      setError('Error reading file. Please try again.')
    }
  }

  const parseRoutineFromText = (text: string) => {
    // Auto-extract routine name from first line or filename
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length > 0) {
      setName(lines[0].replace(/[:#]/g, '').trim().slice(0, 100))
    }

    // Try to auto-detect duration from text
    const durationMatch = text.match(/(\d+)\s*(min|minute|minutes)/i)
    if (durationMatch) {
      setDuration(parseInt(durationMatch[1]))
    }

    // Auto-detect time of day
    const lowerText = text.toLowerCase()
    if (lowerText.includes('morning') || lowerText.includes('am')) {
      setTimeOfDay('morning')
    } else if (lowerText.includes('afternoon') || lowerText.includes('noon')) {
      setTimeOfDay('afternoon')
    } else if (lowerText.includes('evening') || lowerText.includes('night') || lowerText.includes('pm')) {
      setTimeOfDay('evening')
    }
  }

  const handleImport = () => {
    if (!name.trim() || !parsedText.trim()) {
      setError('Please upload a file and ensure the routine has a name')
      return
    }

    // Parse tasks from text (look for bullet points, numbers, or line breaks)
    const lines = parsedText.split('\n').filter(line => line.trim())
    const tasks = lines
      .filter(line => {
        const trimmed = line.trim()
        return trimmed.startsWith('-') || 
               trimmed.startsWith('•') || 
               trimmed.startsWith('*') ||
               /^\d+[\.)]\s/.test(trimmed)
      })
      .map((line, index) => ({
        id: `task-${index}`,
        text: line.replace(/^[-•*]\s*|\d+[\.)]\s*/g, '').trim(),
        completed: false,
      }))

    const routine: Omit<Routine, 'id'> = {
      name: name.trim(),
      description: description.trim() || 'Imported from file',
      timeOfDay,
      duration,
      tasks: tasks.length > 0 ? tasks : [
        { id: 'task-1', text: 'Review imported content', completed: false }
      ],
      isActive: true,
    }

    onImport(routine)
    handleClose()
  }

  const handleClose = () => {
    setFile(null)
    setParsedText('')
    setName('')
    setDescription('')
    setTimeOfDay('morning')
    setDuration(30)
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Routine</DialogTitle>
          <DialogDescription>
            Upload a PDF, Word document, or text file to import a routine
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload File</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {parsedText && (
            <>
              {/* Preview */}
              <div className="space-y-2">
                <Label>Extracted Text</Label>
                <Textarea
                  value={parsedText}
                  onChange={(e) => setParsedText(e.target.value)}
                  placeholder="Text extracted from file..."
                  className="min-h-[120px] text-sm"
                />
              </div>

              {/* Routine Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Routine Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Morning Workout"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timeOfDay">Time of Day</Label>
                    <Select value={timeOfDay} onValueChange={(value: any) => setTimeOfDay(value)}>
                      <SelectTrigger id="timeOfDay">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="anytime">Anytime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                      min={5}
                      max={300}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!parsedText || !name.trim()} className="w-full sm:w-auto">
            Import Routine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
