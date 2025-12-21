'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo)
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined })
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center glass-panel rounded-3xl">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                    <h2 className="text-lg font-bold text-foreground mb-2">Something went wrong</h2>
                    <p className="text-sm text-muted-foreground mb-4 max-w-md">
                        {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                    </p>
                    <Button onClick={this.handleReset} variant="outline" className="gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        Try again
                    </Button>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
