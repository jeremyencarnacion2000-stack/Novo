'use client'

import { useState, useRef, useEffect } from 'react'
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
import { Upload, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { Routine } from '@/types/routine'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

interface ImportRoutineDialogProps {
  open: boolean
  onClose: () => void
  onImport: (payload: any) => void
}

export function ImportRoutineDialog({ open, onClose, onImport }: ImportRoutineDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedText, setParsedText] = useState('')
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [parsedData, setParsedData] = useState<any>(null)
  const [selectedBlocks, setSelectedBlocks] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError('')
    setFile(selectedFile)
    setParsedText('')
    setIsProcessing(true)

    const fileName = selectedFile.name.toLowerCase()

    if (!fileName.endsWith('.pdf') && !fileName.endsWith('.doc') && !fileName.endsWith('.docx') && !fileName.endsWith('.txt')) {
      setError('Please upload a PDF, Word document (.doc/.docx), or text file')
      setIsProcessing(false)
      return
    }

    try {
      let text = ''
      if (fileName.endsWith('.txt')) {
        text = await selectedFile.text()
      } else if (fileName.endsWith('.pdf')) {
        text = await extractTextFromPdf(selectedFile)
      } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        text = await extractTextFromDocx(selectedFile)
      }

      setParsedText(text)
      await parseRoutineFromText(text, selectedFile.name)
    } catch (err) {
      console.error('Error reading file:', err)
      setError('Error reading file. Please ensure it is a valid document.')
    } finally {
      setIsProcessing(false)
    }
  }

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(' ')
      fullText += pageText + '\n'
    }
    return fullText
  }

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  const parseRoutineFromText = async (text: string, filename: string) => {
    try {
      setIsProcessing(true)
      const response = await fetch('/api/routines/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Failed to parse routine')
      }

      const data = await response.json()
      setParsedData(data)

      const initialSelection: Record<string, boolean> = {}
      if (data.planning) initialSelection['planning'] = true
      if (data.routines) {
        data.routines.forEach((_: any, i: number) => {
          initialSelection[`routine-${i}`] = true
        })
      }
      if (data.trackers && data.trackers.length > 0) initialSelection['trackers'] = true
      if (data.checklists && data.checklists.length > 0) initialSelection['checklists'] = true

      setSelectedBlocks(initialSelection)
      setStep('preview')
    } catch (err) {
      console.error('Error parsing routine:', err)
      setError('Failed to analyze the routine. Please try again or enter details manually.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleImport = () => {
    if (!parsedData) return;

    const payload: any = {
      routines: [],
      trackers: selectedBlocks['trackers'] ? parsedData.trackers : [],
      checklists: selectedBlocks['checklists'] ? parsedData.checklists : [],
      planning: selectedBlocks['planning'] ? parsedData.planning : null,
    };

    if (parsedData.routines) {
      parsedData.routines.forEach((r: any, i: number) => {
        if (selectedBlocks[`routine-${i}`]) {
          payload.routines.push(r);
        }
      });
    }

    onImport(payload);
    handleClose();
  }

  const handleClose = () => {
    setFile(null)
    setParsedText('')
    setError('')
    setIsProcessing(false)
    setStep('upload')
    setParsedData(null)
    setSelectedBlocks({})
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
                disabled={isProcessing}
              >
                {isProcessing && !parsedData ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {isProcessing && !parsedData ? 'Processing...' : 'Choose File'}
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

          {isProcessing && !parsedData && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground animate-pulse">Analizando documento con Inteligencia Artificial...</p>
            </div>
          )}

          {parsedData && (
            <div className={cn("space-y-6 transition-all duration-500", isProcessing ? "opacity-50 pointer-events-none" : "opacity-100")}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-lg font-bold">Contenido Detectado</Label>
                  <p className="text-xs text-muted-foreground">Selecciona qué deseas importar a tu cuenta</p>
                </div>
                {isProcessing && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
              </div>

              <div className="grid gap-4">
                {parsedData.planning && (
                  <Card className={cn("transition-all border-2", selectedBlocks['planning'] ? "border-primary bg-primary/5" : "border-transparent opacity-70")}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="block-planning"
                          checked={selectedBlocks['planning']}
                          onCheckedChange={(checked) => setSelectedBlocks(prev => ({ ...prev, planning: !!checked }))}
                        />
                        <CardTitle className="text-sm font-semibold">📅 Planificación: {parsedData.planning.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {parsedData.planning.schedule?.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="flex gap-2">
                            <span className="font-medium min-w-[80px]">{item.time}</span>
                            <span>{item.activity}</span>
                          </div>
                        ))}
                        {parsedData.planning.schedule?.length > 3 && <p className="pt-1 font-medium">... y {parsedData.planning.schedule.length - 3} actividades más</p>}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {parsedData.routines?.map((routine: any, i: number) => (
                  <Card key={i} className={cn("transition-all border-2", selectedBlocks[`routine-${i}`] ? "border-primary bg-primary/5" : "border-transparent opacity-70")}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`block-routine-${i}`}
                          checked={selectedBlocks[`routine-${i}`]}
                          onCheckedChange={(checked) => setSelectedBlocks(prev => ({ ...prev, [`routine-${i}`]: !!checked }))}
                        />
                        <CardTitle className="text-sm font-semibold">⚔️ Rutina: {routine.name}</CardTitle>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase font-bold">{routine.type || 'fitness'}</span>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{routine.description}</p>
                      <div className="flex gap-4 text-[10px] text-muted-foreground">
                        <span>⏱️ {routine.duration || 0} min</span>
                        <span>🔄 {routine.frequency || 'N/A'}</span>
                        <span>💪 {routine.exercises?.length || routine.days?.reduce((acc: number, d: any) => acc + (d.exercises?.length || 0), 0) || 0} ejercicios</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {parsedData.trackers && parsedData.trackers.length > 0 && (
                  <Card className={cn("transition-all border-2", selectedBlocks['trackers'] ? "border-primary bg-primary/5" : "border-transparent opacity-70")}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="block-trackers"
                          checked={selectedBlocks['trackers']}
                          onCheckedChange={(checked) => setSelectedBlocks(prev => ({ ...prev, trackers: !!checked }))}
                        />
                        <CardTitle className="text-sm font-semibold">📈 Trackers y Hábitos</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="flex flex-wrap gap-2">
                        {parsedData.trackers.map((t: any, i: number) => (
                          <span key={i} className="text-[10px] bg-muted px-2 py-1 rounded-md">{t.name}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {parsedData.checklists && parsedData.checklists.length > 0 && (
                  <Card className={cn("transition-all border-2", selectedBlocks['checklists'] ? "border-primary bg-primary/5" : "border-transparent opacity-70")}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="block-checklists"
                          checked={selectedBlocks['checklists']}
                          onCheckedChange={(checked) => setSelectedBlocks(prev => ({ ...prev, checklists: !!checked }))}
                        />
                        <CardTitle className="text-sm font-semibold">✅ Checklists de Misión</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {parsedData.checklists.slice(0, 3).map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                            <span>{item.text}</span>
                          </div>
                        ))}
                        {parsedData.checklists.length > 3 && <p className="text-[10px] font-medium pt-1">... y {parsedData.checklists.length - 3} items más</p>}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(!parsedData.planning && (!parsedData.routines || parsedData.routines.length === 0) && (!parsedData.trackers || parsedData.trackers.length === 0) && (!parsedData.checklists || parsedData.checklists.length === 0)) && (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">No se detectó contenido estructurado.</p>
                      <p className="text-xs text-muted-foreground">La IA no pudo identificar bloques claros de rutinas o planes.</p>
                    </div>
                    <div className="px-4">
                      <Label className="text-[10px] uppercase text-muted-foreground mb-1 block text-left">Texto Extraído:</Label>
                      <Textarea
                        readOnly
                        value={parsedText}
                        className="text-[10px] h-32 bg-muted/30 font-mono"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                      Intentar de nuevo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsedData || isProcessing || Object.values(selectedBlocks).every(v => !v)}
            className="w-full sm:w-auto"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Import Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
