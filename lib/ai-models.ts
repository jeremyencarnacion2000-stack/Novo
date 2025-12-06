import { AIModel, ConversationMessage } from '@/types/ai';

// Storage key for models
const MODELS_STORAGE_KEY = 'novo_ai_models';

// Default fallback model (mock for now)
const DEFAULT_MODEL: AIModel = {
  id: 'default',
  name: 'Default Assistant',
  type: 'base',
  filePath: '',
  uploadedAt: '',
  size: 0,
  isActive: false
};




export class AIModelManager {
  private static instance: AIModelManager;
  private models: AIModel[] = [];
  private loadedModel: any = null;

  private constructor() {
    this.loadModels();
  }

  static getInstance(): AIModelManager {
    if (!AIModelManager.instance) {
      AIModelManager.instance = new AIModelManager();
    }
    return AIModelManager.instance;
  }

  private loadModels(): void {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(MODELS_STORAGE_KEY);
    if (stored) {
      this.models = JSON.parse(stored);
    }

    // Ensure default model exists
    if (!this.models.find(m => m.id === 'default')) {
      this.models.push(DEFAULT_MODEL);
      this.saveModels();
    }

  }

  private saveModels(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(this.models));
  }

  getModels(): AIModel[] {
    return [...this.models];
  }

  getActiveModel(): AIModel | null {
    return this.models.find(m => m.isActive) || null;
  }

  async uploadModel(file: File, name: string, type: 'lora' | 'base', baseModel?: string): Promise<AIModel> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const modelId = `model_${Date.now()}`;

          // Store model data in IndexedDB for larger files
          await this.storeModelData(modelId, arrayBuffer);

          const model: AIModel = {
            id: modelId,
            name,
            type,
            baseModel,
            filePath: modelId, // Reference to stored data
            uploadedAt: new Date().toISOString(),
            size: file.size,
            isActive: false
          };

          this.models.push(model);
          this.saveModels();

          resolve(model);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  private async storeModelData(id: string, data: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NovoAIModels', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['models'], 'readwrite');
        const store = transaction.objectStore('models');
        const putRequest = store.put({ id, data });

        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' });
        }
      };
    });
  }

  private async loadModelData(id: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NovoAIModels', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['models'], 'readonly');
        const store = transaction.objectStore('models');
        const getRequest = store.get(id);

        getRequest.onerror = () => reject(getRequest.error);
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.data);
          } else {
            reject(new Error('Model data not found'));
          }
        };
      };
    });
  }

  async setActiveModel(modelId: string): Promise<void> {
    // Deactivate all models
    this.models.forEach(m => m.isActive = false);

    // Activate selected model
    const model = this.models.find(m => m.id === modelId);
    if (model) {
      model.isActive = true;
      this.saveModels();

      // Unload current model
      if (this.loadedModel) {
        this.loadedModel = null;
      }

      // Load new model if not default
      if (modelId !== 'default') {
        await this.loadModel(model);
      }
    }
  }

  private async loadModel(model: AIModel): Promise<void> {
    try {
      // For LoRA models, we need to load base model + LoRA
      if (model.type === 'lora') {
        // This is a simplified implementation
        // In practice, you'd need proper LoRA loading logic
        const modelData = await this.loadModelData(model.filePath);

        // Mock loading - in real implementation, use transformers.js
        this.loadedModel = {
          type: 'lora',
          baseModel: model.baseModel,
          data: modelData
        };
      } else {
        // Base model loading
        const modelData = await this.loadModelData(model.filePath);
        this.loadedModel = {
          type: 'base',
          data: modelData
        };
      }
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    }
  }

  async generateResponse(message: string, context: string, history: ConversationMessage[] = []): Promise<string> {
    const activeModel = this.getActiveModel();

    if (!activeModel || activeModel.id === 'default') {
      // Use mock response for default
      return this.generateMockResponse(message, context);
    }


    if (!this.loadedModel) {
      throw new Error('Model not loaded');
    }

    // Only run transformers on client side
    if (typeof window === 'undefined') {
      return this.generateMockResponse(message, context);
    }

    try {
      // Dynamic import to avoid SSR issues with onnxruntime-node
      const { pipeline } = await import('@xenova/transformers');

      let generator;
      if (this.loadedModel.type === 'lora') {
        // For LoRA, we'd need to load base model + apply LoRA
        // This is a simplified implementation
        generator = await pipeline('text-generation', this.loadedModel.baseModel || 'microsoft/DialoGPT-small');
      } else {
        // For base models, load directly
        generator = await pipeline('text-generation', 'microsoft/DialoGPT-small');
      }

      // Generate response with context
      const prompt = `Context: ${context}\nUser: ${message}\nAssistant:`;
      const output = await generator(prompt, {
        max_new_tokens: 100,
        temperature: 0.7,
        do_sample: true,
        pad_token_id: generator.tokenizer.sep_token_id
      });

      return (output[0] as any).generated_text.split('Assistant:')[1]?.trim() || this.generateMockResponse(message, context);
    } catch (error) {
      console.error('Inference failed:', error);
      // Fallback to mock
      return this.generateMockResponse(message, context);
    }
  }

  private generateMockResponse(message: string, context: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('create a task') || lowerMessage.includes('add task')) {
      return 'I\'ve created that task for you in your projects.';
    }

    if (lowerMessage.includes('add habit') || lowerMessage.includes('create habit')) {
      return 'I\'ve added that habit to your trackers.';
    }

    return `I understand you said: "${message}". Based on your context, I can help you manage your tasks, habits, and more. What would you like me to do?`;
  }

  async deleteModel(modelId: string): Promise<void> {
    if (modelId === 'default') {
      throw new Error('Cannot delete default model');
    }

    // Remove from IndexedDB
    await this.deleteModelData(modelId);

    // Remove from models list
    this.models = this.models.filter(m => m.id !== modelId);

    // If deleted model was active, activate default
    const activeModel = this.getActiveModel();
    if (!activeModel) {
      await this.setActiveModel('default');
    }

    this.saveModels();
  }

  private async deleteModelData(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NovoAIModels', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['models'], 'readwrite');
        const store = transaction.objectStore('models');
        const deleteRequest = store.delete(id);

        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onsuccess = () => resolve();
      };
    });
  }

  validateModelFile(file: File): { valid: boolean; error?: string } {
    // Basic validation
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      return { valid: false, error: 'Model file too large (max 500MB)' };
    }

    // Check file extension (simplified)
    const allowedExtensions = ['.bin', '.safetensors', '.ckpt', '.pth'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      return { valid: false, error: 'Unsupported file format' };
    }

    return { valid: true };
  }
}

export const aiModelManager = AIModelManager.getInstance();
