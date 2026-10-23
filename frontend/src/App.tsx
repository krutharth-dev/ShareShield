
import { useState } from 'react'
import './App.css'

type ScreenStatus = 'idle' | 'selected' | 'unsupported'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ScreenStatus>('idle')

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]

    if (!selected) return

    setFile(selected)
    setStatus(
      selected.type === 'application/pdf'
        ? 'selected'
        : 'unsupported',
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">S</span>
          <span>
            <strong>ShareShield</strong>
            <small>PRIVACY WORKSPACE</small>
          </span>
        </a>

        <p className="nav-heading">WORKSPACE</p>
        <div className="nav-item active">▤ <span>Document review</span></div>
        <div className="nav-item">◷ <span>Recent activity</span></div>

        <div className="sidebar-bottom">
          <span className="local-indicator" />
          <div>
            <strong>Local-first processing</strong>
            <small>Your files stay on your device</small>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <span>Workspace / Document review</span>
          <span className="prototype-badge">PHASE 1 PROTOTYPE</span>
        </header>

        <section className="welcome">
          <p className="eyebrow">DOCUMENT PRIVACY, SIMPLIFIED</p>
          <h1>Review before<br />you share.</h1>
          <p className="intro">
            Find sensitive information, choose what to redact,
            and verify the exported document before sharing it.
          </p>
        </section>

        <section className="upload-card">
          <div className="section-title">
            <div>
              <h2>Start a document review</h2>
              <p>Choose a searchable English PDF to get started.</p>
            </div>
            <span className="step-number">01 / 03</span>
          </div>

          <label className="dropzone">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
            />
            <span className="upload-icon">↑</span>
            <strong>Select a PDF file</strong>
            <span className="muted">
              Choose a file from your computer
            </span>
            <span className="browse-button">Browse files</span>
          </label>

          {file && (
            <div className="file-row">
              <span className="pdf-icon">PDF</span>
              <div className="file-details">
                <strong>{file.name}</strong>
                <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
              </div>
              <span className="file-state">
                {status === 'selected' ? 'Selected' : 'Unsupported'}
              </span>
              <button
                className="remove-button"
                onClick={() => {
                  setFile(null)
                  setStatus('idle')
                }}
                aria-label="Remove selected file"
              >
                ×
              </button>
            </div>
          )}

          {status === 'unsupported' && (
            <p className="warning">
              This prototype currently accepts PDF files only.
            </p>
          )}

          {status === 'selected' && (
            <p className="notice">
              File selected. Detection and upload processing have not
              been connected to the backend yet.
            </p>
          )}

          <div className="privacy-note">
            <span>♧</span>
            <p>
              <strong>Privacy comes first.</strong>
              <br />
              The original document will be preserved. Redaction and
              verification will be performed by the connected backend.
            </p>
          </div>
        </section>

        <section className="workflow">
          <div className="section-title">
            <div>
              <h2>How ShareShield works</h2>
              <p>Three steps to a more carefully reviewed document.</p>
            </div>
          </div>

          <div className="workflow-grid">
            <article className="workflow-card">
              <span className="workflow-icon">⌕</span>
              <span className="workflow-step">STEP 01</span>
              <h3>Detect</h3>
              <p>Identify potential IDs and email addresses.</p>
            </article>
            <article className="workflow-card">
              <span className="workflow-icon">✎</span>
              <span className="workflow-step">STEP 02</span>
              <h3>Review & redact</h3>
              <p>Choose findings and redact a separate copy.</p>
            </article>
            <article className="workflow-card">
              <span className="workflow-icon">✓</span>
              <span className="workflow-step">STEP 03</span>
              <h3>Verify</h3>
              <p>Reopen the export and check for residual leaks.</p>
            </article>
          </div>
        </section>

        <footer>
          <span>ShareShield · Mini-project prototype</span>
          <span>Detect. Redact. Verify. Then Share.</span>
        </footer>
      </section>
    </main>
  )
}

export default App
