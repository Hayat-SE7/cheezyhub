import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Suppress console.error from ErrorBoundary
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function ThrowingComponent({ error }: { error: Error }) {
  throw error;
}

function SafeComponent() {
  return <div>Safe content</div>;
}

describe('[ErrorBoundary]', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('should render default fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test error message')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent error={new Error('Oops')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should show reload button in default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Fail')} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('should handle error without message', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error()} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
