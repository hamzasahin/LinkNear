import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Last line of defense for uncaught render errors. Without this, any error
 * thrown inside a component subtree produces a blank white page.
 *
 * Keeps the fallback deliberately minimal — no dependencies, inline styles
 * so it renders even if the CSS pipeline itself fails.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f8f6f3',
          color: '#494440',
        }}
      >
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <p
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#706a64',
              margin: 0,
            }}
          >
            Error
          </p>
          <h1 style={{ fontSize: 36, margin: '0.75rem 0 0.75rem', color: '#3d3733', fontWeight: 400 }}>
            Something broke.
          </h1>
          <p style={{ color: '#706a64', fontSize: 14, marginBottom: '1.5rem' }}>
            An unexpected error happened while rendering this page. You can try again, or reload
            the app.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: 12,
                background: '#f2ede8',
                border: '1px solid #c2beba',
                padding: '0.75rem',
                borderRadius: 6,
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                color: '#b24535',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: 0,
                background: 'transparent',
                color: '#e66253',
                border: 'none',
                textDecoration: 'underline',
                textUnderlineOffset: 4,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Try again →
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: 0,
                background: 'transparent',
                color: '#706a64',
                border: 'none',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
