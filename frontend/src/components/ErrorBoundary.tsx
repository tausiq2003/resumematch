import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, Home } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-6 w-6 text-red-500" />
                                <CardTitle>Oops! Something went wrong</CardTitle>
                            </div>
                            <CardDescription>
                                We apologize for the inconvenience. Please try again later.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    {this.state.error?.message || 'An unexpected error occurred'}
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={() => window.location.reload()}
                            >
                                Try Again
                            </Button>
                            <Button asChild>
                                <Link to="/">
                                    <Home className="mr-2 h-4 w-4" />
                                    Go Home
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

// Create a wrapper component that uses useRouteError
export function ErrorPage() {
    const error = useRouteError() as Error;
    
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                        <CardTitle>Error</CardTitle>
                    </div>
                    <CardDescription>
                        {error?.message || 'An unexpected error occurred'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Please refresh the page or try again later.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
} 