'use client';

import React from 'react';
import { FileText, Code, Image, ChevronRight, ChevronLeft } from 'lucide-react';

interface Artifact {
  id: string;
  type: 'code' | 'file' | 'image';
  title: string;
  content: string;
  language?: string;
}

interface ArtifactPanelProps {
  artifacts: Artifact[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function ArtifactPanel({ artifacts, isCollapsed, onToggleCollapse }: ArtifactPanelProps) {
  const getIcon = (type: Artifact['type']) => {
    switch (type) {
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'file':
        return <FileText className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div
      className={`${
        isCollapsed ? 'w-12' : 'w-80'
      } bg-card border-l border-border flex flex-col transition-all duration-300 ease-in-out`}
    >
      <div className="p-3 border-b border-border flex items-center justify-between">
        {!isCollapsed && (
          <h3 className="text-sm font-medium text-foreground">Artifacts</h3>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isCollapsed ? "Expandir panel de artifacts" : "Colapsar panel de artifacts"}
        >
          {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2">
          {artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs">No hay artifacts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getIcon(artifact.type)}
                    <span className="text-sm font-medium text-foreground truncate">
                      {artifact.title}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {artifact.type === 'code' && artifact.language && (
                      <span className="px-1 py-0.5 bg-accent rounded text-accent-foreground">
                        {artifact.language}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}