'use client'

import { useState, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { Upload, Trash2, CheckCircle } from 'lucide-react'
import { aiModelManager } from '@/lib/ai-models'
import type { AIModel } from '@/types/ai'
import { Section } from './settings-shared'

export function SettingsAiModels() {
  const { toast } = useToast()

  // AI Models state
  const [models, setModels] = useState<AIModel[]>([])
  const [isUploadingModel, setIsUploadingModel] = useState(false)
  const [modelUploadProgress, setModelUploadProgress] = useState(0)
  const modelFileInputRef = useRef<HTMLInputElement>(null)
  const [newModelName, setNewModelName] = useState('')
  const [newModelType, setNewModelType] = useState<'lora' | 'base'>('base')
  const [newModelBase, setNewModelBase] = useState('')

  // Load AI models on mount
  useEffect(() => {
    const loadedModels = aiModelManager.getModels()
    setModels(loadedModels)
  }, [])

  const handleModelFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !newModelName.trim()) return

    const validation = aiModelManager.validateModelFile(file)
    if (!validation.valid) {
      toast({
        title: 'Invalid model file',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    setIsUploadingModel(true)
    setModelUploadProgress(0)

    try {
      const model = await aiModelManager.uploadModel(
        file,
        newModelName.trim(),
        newModelType,
        newModelType === 'lora' ? newModelBase : undefined
      )

      setModels(aiModelManager.getModels())
      setNewModelName('')
      setNewModelBase('')
      setModelUploadProgress(100)

      toast({
        title: 'Model uploaded',
        description: `${model.name} has been uploaded successfully.`,
      })
    } catch (error) {
      console.error('Model upload failed:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload the model. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingModel(false)
      setModelUploadProgress(0)
    }
  }

  const handleSetActiveModel = async (modelId: string) => {
    try {
      await aiModelManager.setActiveModel(modelId)
      setModels(aiModelManager.getModels())

      const model = models.find(m => m.id === modelId)
      toast({
        title: 'Active model changed',
        description: `${model?.name} is now active.`,
      })
    } catch (error) {
      console.error('Failed to set active model:', error)
      toast({
        title: 'Failed to activate model',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteModel = async (modelId: string, modelName: string) => {
    if (!confirm(`Are you sure you want to delete the model "${modelName}"?`)) return

    try {
      await aiModelManager.deleteModel(modelId)
      setModels(aiModelManager.getModels())

      toast({
        title: 'Model deleted',
        description: `${modelName} has been removed.`,
      })
    } catch (error) {
      console.error('Failed to delete model:', error)
      toast({
        title: 'Failed to delete model',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Custom Models Uploader */}
      <Section title="Upload Custom AI Model">
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.015] p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="modelName">Model Label</Label>
              <Input
                id="modelName"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="LoRA model title..."
                className="bg-foreground/5 border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Model Type</Label>
              <Select value={newModelType} onValueChange={(value: any) => setNewModelType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base Model</SelectItem>
                  <SelectItem value="lora">LoRA Adaptor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {newModelType === 'lora' && (
            <div className="space-y-2">
              <Label htmlFor="baseModel">Base Model Identifier</Label>
              <Input
                id="baseModel"
                value={newModelBase}
                onChange={(e) => setNewModelBase(e.target.value)}
                placeholder="e.g., microsoft/DialoGPT-medium"
                className="bg-foreground/5 border-foreground/10"
              />
            </div>
          )}

          <input
            type="file"
            ref={modelFileInputRef}
            onChange={handleModelFileSelect}
            accept=".bin,.safetensors,.ckpt,.pth"
            className="hidden"
          />

          <Button
            variant="outline"
            className="w-full border-foreground/10 hover:bg-foreground/5"
            onClick={() => modelFileInputRef.current?.click()}
            disabled={!newModelName.trim() || isUploadingModel}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploadingModel ? 'Uploading...' : 'Select File & Upload'}
          </Button>

          {isUploadingModel && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs">
                <span>Upload progress</span>
                <span>{modelUploadProgress}%</span>
              </div>
              <Progress value={modelUploadProgress} />
            </div>
          )}
        </div>
      </Section>

      {/* Model selection list */}
      <Section title="Available Models">
        <div className="space-y-2">
          {models.map(model => (
            <div
              key={model.id}
              className="flex items-center justify-between p-3.5 border border-foreground/5 bg-foreground/[0.01] rounded-2xl hover:bg-foreground/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                {model.isActive ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-foreground/20" />
                )}
                <div>
                  <p className="font-semibold text-sm text-foreground/90">{model.name}</p>
                  <p className="text-xs text-foreground/35">
                    {model.type === 'lora' ? `LoRA (${model.baseModel})` : 'Base Model'} • {(model.size / (1024 * 1024)).toFixed(1)} MB • {new Date(model.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!model.isActive && model.id !== 'default' && (
                  <Button variant="outline" size="sm" onClick={() => handleSetActiveModel(model.id)} className="border-foreground/10 hover:bg-foreground/5 text-xs">
                    Activate
                  </Button>
                )}
                {model.id !== 'default' && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteModel(model.id, model.name)}>
                    <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
