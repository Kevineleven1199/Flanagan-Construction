import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ui-error]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="app-error-boundary" role="alert">
        <section>
          <span className="app-error-mark" aria-hidden="true"></span>
          <p>Flanagan Construction</p>
          <h1>Something on this screen hiccuped.</h1>
          <span>
            The site is still running. Refresh the page, or jump back to the public site and try again.
          </span>
          <div>
            <button type="button" onClick={() => window.location.reload()}>
              Refresh page
            </button>
            <a href="/">
              Back to site
            </a>
          </div>
        </section>
      </main>
    )
  }
}
