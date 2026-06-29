import { Component } from 'react'
import { notifyAdmin } from '../lib/notify'

// App-wide safety net: if any render throws, show a styled fallback instead of a
// blank white screen, and best-effort notify RHQ. Must be a class component —
// React only supports error boundaries this way.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    try {
      notifyAdmin(
        '[ATF-UNK-00] Portal UI crash',
        [
          `Error:   ${error?.message || String(error)}`,
          `Stack:   ${(error?.stack || '').slice(0, 600)}`,
          `Where:   ${(info?.componentStack || '').slice(0, 600)}`,
          `Page:    ${typeof location !== 'undefined' ? location.href : ''}`,
          `Time:    ${new Date().toISOString()}`,
        ].join('\n'),
      )
    } catch {
      /* never throw from the boundary */
    }
    // eslint-disable-next-line no-console
    console.error('1ATF UI crash:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="col center" style={{ minHeight: '100vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <div className="head hostile" style={{ letterSpacing: 3, fontSize: 22 }}>SYSTEM FAULT</div>
        <div className="mono dim" style={{ fontSize: 13, maxWidth: 460 }}>
          The portal hit an unexpected error and stopped to protect your data. RHQ has been notified.
          Reloading usually clears it.
        </div>
        <div className="mono dim" style={{ fontSize: 10, maxWidth: 460, opacity: 0.7 }}>
          [ATF-UNK-00] {String(this.state.error?.message || this.state.error).slice(0, 160)}
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="primary" onClick={() => location.reload()}>Reload portal</button>
          <button className="ghost" onClick={() => { location.href = import.meta.env.BASE_URL }}>Return home</button>
        </div>
      </div>
    )
  }
}
