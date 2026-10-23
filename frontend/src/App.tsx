import { useEffect, useRef, useState } from 'react'
import './App.css'

type Finding = {
  id: number
  category: string
  severity: string
  value: string
  page: number
  location?: string
  rectangles: number[][]
  locatable: boolean
}
type Analysis = {
  analysis_id: string
  filename: string
  format: string
  findings: Finding[]
  counts: Record<string, number>
  high_risk_count: number
  page_count: number
  preview_supported: boolean
  limitations: string[]
}
type ManualBox = { page: number; x: number; y: number; w: number; h: number }
type Report = {
  status: 'PASS_SCOPED' | 'FLAG' | 'UNVERIFIED'
  selected_count: number
  manual_boxes: number
  output_sha256: string
  remaining_selected: { value: string; category: string }[]
  checks: string[]
  unverified: string[]
}
type RedactionMode = 'blackout' | 'blur' | 'pixelate'
const privacyOptions = [
  { id: 'identity', label: 'Aadhaar number & VID', categories: ['aadhaar_candidate', 'vid_candidate'] },
  { id: 'name', label: 'Full name', categories: ['name_candidate'] },
  { id: 'address', label: 'Residential address', categories: ['address_candidate'] },
  { id: 'dob', label: 'Date of birth', categories: ['dob_candidate'] },
  { id: 'photo', label: 'Face / photograph', categories: ['face_candidate'] },
  { id: 'contacts', label: 'Phone and email', categories: ['email', 'indian_mobile_candidate'] },
  { id: 'codes', label: 'QR codes (barcode: manual)', categories: ['qr_candidate'] },
  { id: 'financial', label: 'PAN, UPI, cards and IFSC', categories: ['pan_candidate', 'upi_candidate', 'payment_card_candidate', 'ifsc_candidate'] },
  { id: 'other', label: 'Other areas (draw manually)', categories: [] },
]
function defaultFindingIds(findings: Finding[], wanted: string[]) {
  const categories = new Set(privacyOptions.filter(option => wanted.includes(option.id)).flatMap(option => option.categories))
  return findings.filter(f => f.locatable && categories.has(f.category)).map(f => f.id)
}
const allowed = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'bmp', 'tif', 'tiff'])
const outputExt: Record<string, string> = { '.pdf': '.pdf', '.docx': '.docx', '.pptx': '.pptx', '.xlsx': '.xlsx', '.csv': '.csv', '.txt': '.txt' }
function dataFor(file: File, extra?: Record<string, string>) {
  const data = new FormData()
  data.append('file', file)
  Object.entries(extra || {}).forEach(([key, value]) => data.append(key, value))
  return data
}
async function errorFrom(response: Response) {
  try {
    const json = await response.json()
    return typeof json.detail === 'string' ? json.detail : 'Request failed (' + response.status + ')'
  } catch { return 'Request failed (' + response.status + ')' }
}
function formatType(name: string) {
  return name.split('.').pop()?.toUpperCase() || 'FILE'
}
function MB(bytes: number) { return (bytes / 1048576).toFixed(2) + ' MB' }

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [phase, setPhase] = useState<'ready' | 'scanning' | 'processing'>('ready')
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState(false)
  const [page, setPage] = useState(1)
  const [manual, setManual] = useState<ManualBox[]>([])
  const [draft, setDraft] = useState<ManualBox | null>(null)
  const [originalPreview, setOriginalPreview] = useState('')
  const [outputPreview, setOutputPreview] = useState('')
  const [previewWidth, setPreviewWidth] = useState(1)
  const [previewHeight, setPreviewHeight] = useState(1)
  const [result, setResult] = useState<File | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [ocrAvailable, setOcrAvailable] = useState<boolean | null>(null)
  const [visionAvailable, setVisionAvailable] = useState<boolean | null>(null)
  const [privacyCategories, setPrivacyCategories] = useState<string[]>(privacyOptions.map(item => item.id))
  const [redactionMode, setRedactionMode] = useState<RedactionMode>('blackout')
  const [allOccurrences, setAllOccurrences] = useState(true)
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const input = useRef<HTMLInputElement>(null)
  const previewSurface = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)
  const resultUrl = useRef<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [recent, setRecent] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/health', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw Error('Server health check failed'); return r.json() })
      .then(x => { if (active) { setOcrAvailable(Boolean(x.ocr_available)); setVisionAvailable(Boolean(x.vision_available)); setServerStatus('online') } })
      .catch(() => { if (active) { setOcrAvailable(null); setVisionAvailable(null); setServerStatus('offline') } })
    return () => { active = false }
  }, [])
  useEffect(() => () => { if (resultUrl.current) URL.revokeObjectURL(resultUrl.current) }, [])

  function clearResult() {
    if (resultUrl.current) { URL.revokeObjectURL(resultUrl.current); resultUrl.current = null }
    setResult(null)
    setReport(null)
    setOutputPreview('')
  }
  function choose(next: File | null) {
    requestId.current += 1
    setPhase('ready')
    setFile(next)
    setAnalysis(null)
    setSelected([])
    setManual([])
    setDraft(null)
    setPage(1)
    setRecent(false)
    setOriginalPreview('')
    clearResult()
    setProblem(false)
    setMessage('')
    if (next && (!allowed.has(next.name.split('.').pop()?.toLowerCase() || '') || next.size > 12 * 1048576)) {
      setProblem(true)
      setMessage(next.size > 12 * 1048576 ? 'File exceeds the 12 MiB limit.' : 'Unsupported file extension. Convert it to a supported format.')
    }
  }
  const invalid = Boolean(file && (!allowed.has(file.name.split('.').pop()?.toLowerCase() || '') || file.size > 12 * 1048576))
  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0] || null)
    event.currentTarget.value = ''
  }
  function sample() {
    choose(new File(
      ['SHARESHIELD FICTIONAL TEST\nEmail: demo@example.org\nPhone: 9876543210\nPAN: ABCDE1234F\nIFSC: HDFC0001234\nCard: 4111 1111 1111 1111\nUPI: studentdemo@okaxis\n'],
      'shareshield-sample.txt', { type: 'text/plain' }
    ))
  }
  async function scan() {
    if (!file || invalid) return
    const id = ++requestId.current
    setPhase('scanning'); setProblem(false); setMessage('Scanning file for supported identifiers…')
    setAnalysis(null); setSelected([]); setManual([]); clearResult()
    try {
      const response = await fetch('/analyze', { method: 'POST', body: dataFor(file), cache: 'no-store' })
      if (!response.ok) throw Error(await errorFrom(response))
      const data: Analysis = await response.json()
      if (id !== requestId.current) return
      setAnalysis(data)
      setSelected(defaultFindingIds(data.findings, privacyCategories))
      setPage(1)
      setMessage(data.findings.length
        ? data.findings.length + ' candidate(s) found. Review them before redacting.'
        : 'No configured patterns detected. The file is NOT certified safe; use manual redaction for images and PDFs.')
      setProblem(false)
    } catch (error) {
      if (id !== requestId.current) return
      setProblem(true); setMessage(error instanceof Error ? error.message : 'Unable to analyze file.')
    } finally { if (id === requestId.current) setPhase('ready') }
  }
  useEffect(() => {
    if (!file || !analysis?.preview_supported) return
    let active = true
    const controller = new AbortController()
    async function load() {
      const response = await fetch('/preview', {
        method: 'POST', body: dataFor(file!, { page: String(page) }), signal: controller.signal, cache: 'no-store',
      })
      if (!response.ok) throw Error(await errorFrom(response))
      const blob = await response.blob()
      if (!active) return
      setPreviewWidth(Number(response.headers.get('X-Document-Width')) || 1)
      setPreviewHeight(Number(response.headers.get('X-Document-Height')) || 1)
      const url = URL.createObjectURL(blob)
      setOriginalPreview(previous => { if (previous) URL.revokeObjectURL(previous); return url })
    }
    load().catch(error => { if (active && error.name !== 'AbortError') { setProblem(true); setMessage(error.message) } })
    return () => { active = false; controller.abort() }
  }, [file, analysis, page])
  useEffect(() => {
    if (!result || !analysis?.preview_supported) return
    let active = true
    const controller = new AbortController()
    async function load() {
      const response = await fetch('/preview', {
        method: 'POST', body: dataFor(result!, { page: String(page) }), signal: controller.signal, cache: 'no-store',
      })
      if (!response.ok) throw Error(await errorFrom(response))
      const blob = await response.blob()
      if (!active) return
      const url = URL.createObjectURL(blob)
      setOutputPreview(previous => { if (previous) URL.revokeObjectURL(previous); return url })
    }
    load().catch(() => { if (active) setOutputPreview('') })
    return () => { active = false; controller.abort() }
  }, [result, analysis, page])
  useEffect(() => () => {
    if (originalPreview) URL.revokeObjectURL(originalPreview)
  }, [originalPreview])
  useEffect(() => () => {
    if (outputPreview) URL.revokeObjectURL(outputPreview)
  }, [outputPreview])

  function toggleCategory(id: string) {
    const next = privacyCategories.includes(id) ? privacyCategories.filter(item => item !== id) : [...privacyCategories, id]
    setPrivacyCategories(next)
    if (analysis) setSelected(defaultFindingIds(analysis.findings, next))
    clearResult()
  }
  function chooseMode(next: RedactionMode) {
    setRedactionMode(next)
    clearResult()
  }
  function changeSelected(id: number) {
    setSelected(current => current.includes(id) ? current.filter(i => i !== id) : [...current, id])
    clearResult()
  }
  function selectionAll(all: boolean) {
    setSelected(all ? (analysis?.findings.filter(f => f.locatable).map(f => f.id) || []) : [])
    clearResult()
  }
  function point(event: React.PointerEvent<HTMLDivElement>) {
    const box = previewSurface.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    }
  }
  const initialPoint = useRef<{ x: number; y: number } | null>(null)
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!analysis?.preview_supported || phase !== 'ready') return
    const pos = point(event)
    initialPoint.current = pos
    setDraft({ page, ...pos, w: 0, h: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = initialPoint.current
    if (!start) return
    const end = point(event)
    setDraft({ page, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) })
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = initialPoint.current
    if (!start) return
    const end = point(event)
    const box = { page, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) }
    if (box.w > .005 && box.h > .005 && manual.length < 60) {
      setManual(current => [...current, box])
      clearResult()
    }
    initialPoint.current = null
    setDraft(null)
  }
  function undo() {
    const index = manual.map(m => m.page).lastIndexOf(page)
    if (index < 0) return
    setManual(m => m.filter((_, i) => i !== index)); clearResult()
  }
  async function processFile() {
    if (!file || !analysis || (!selected.length && !manual.length)) return
    const id = requestId.current
    setPhase('processing'); setMessage('Redacting and verifying exported content…'); setProblem(false)
    clearResult()
    try {
      const request = dataFor(file, {
        analysis_id: analysis.analysis_id,
        selected_ids: selected.join(','),
        manual_regions: JSON.stringify(manual),
        redact_all: String(allOccurrences),
        redaction_mode: analysis.preview_supported ? redactionMode : 'blackout',
      })
      const response = await fetch('/redact', { method: 'POST', body: request, cache: 'no-store' })
      if (!response.ok) throw Error(await errorFrom(response))
      const bytes = await response.blob()
      const ext = outputExt[analysis.format] || '.png'
      const processed = new File([bytes], 'shareshield-redacted' + ext, { type: bytes.type })
      const verify = new FormData()
      verify.append('file', file)
      verify.append('redacted', processed)
      verify.append('analysis_id', analysis.analysis_id)
      verify.append('selected_ids', selected.join(','))
      verify.append('manual_count', String(manual.length))
      verify.append('redact_all', String(allOccurrences))
      verify.append('redaction_mode', analysis.preview_supported ? redactionMode : 'blackout')
      const check = await fetch('/verify', { method: 'POST', body: verify, cache: 'no-store' })
      if (!check.ok) throw Error(await errorFrom(check))
      const checked: Report = await check.json()
      if (id !== requestId.current) return
      setReport(checked)
      if (checked.status === 'FLAG') {
        setProblem(true); setMessage('Verification found selected information in the output. Download withheld.')
      } else {
        setResult(processed)
        setMessage(checked.status === 'PASS_SCOPED'
          ? 'Selected identifiers passed scoped reinspection. Review the output before sharing.'
          : 'Output created, but verification is incomplete. Inspect every masked area before sharing.')
      }
    } catch (error) {
      if (id !== requestId.current) return
      setProblem(true); setMessage(error instanceof Error ? error.message : 'Redaction failed.')
    } finally { if (id === requestId.current) setPhase('ready') }
  }
  function download() {
    if (!result) return
    const url = URL.createObjectURL(result)
    resultUrl.current = url
    const link = document.createElement('a')
    link.href = url; link.download = result.name
    document.body.append(link); link.click(); link.remove()
  }
  function downloadReport() {
    if (!report || !analysis) return
    const payload = {
      ...report, original_sha256: analysis.analysis_id, original_format: analysis.format,
      generated_at: new Date().toISOString(), disclaimer: 'Scoped checks only; not a full-file privacy guarantee.'
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'shareshield-verification.json'
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const chosen = analysis?.findings.filter(f => selected.includes(f.id)) || []
  const statusColor = report?.status === 'FLAG' ? 'failed' : report?.status === 'PASS_SCOPED' ? 'passed' : 'incomplete'
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">S</span>
          <span><strong>ShareShield</strong><small>PRIVACY WORKSPACE</small></span>
        </a>
        <p className="nav-heading">WORKSPACE</p>
        <button className={'nav-item ' + (!recent ? 'active' : '')} onClick={() => setRecent(false)}>▤ <span>Document review</span></button>
        <button className={'nav-item ' + (recent ? 'active' : '')} onClick={() => setRecent(true)}>◷ <span>Session status</span></button>
        <div className="sidebar-bottom">
          <span className={"local-indicator " + (serverStatus === "offline" ? "indicator-unavailable" : "")} />
          <div><strong>{serverStatus === 'online' ? 'Local backend connected' : serverStatus === 'checking' ? 'Checking local backend' : 'Backend unavailable'}</strong><small>{serverStatus === 'online' ? (ocrAvailable ? 'OCR ready · local processing' : 'OCR missing · text-only mode') : 'Start ShareShield on 127.0.0.1:8000'}</small></div>
        </div>
      </aside>
      <section className="main-content">
        <header className="topbar">
          <span>Workspace / {recent ? 'Session status' : 'Document review'}</span>
          <div className="topbar-right"><span className={"server-pill " + serverStatus} role="status">{serverStatus === "online" ? "● Backend connected" : serverStatus === "checking" ? "◌ Checking server" : "● Backend disconnected"}</span><span className="prototype-badge">SELF-HOSTED PROTOTYPE</span></div>
        </header>
        {recent ? (
          <section className="upload-card status-dashboard">
            <h2>Current session</h2>
            <p>ShareShield does not keep a document history or save uploaded files to an account.</p>
            <div className="metric-strip">
              <span><strong>{analysis?.findings.length || 0}</strong> detected candidates</span>
              <span><strong>{selected.length}</strong> selected</span>
              <span><strong>{manual.length}</strong> manual masks</span>
            </div>
            <p className="caption">This page reflects your current browser session only. Close or reload to clear session state.</p>
            <div className="action-row"><button className="primary-action" onClick={() => setRecent(false)}>Return to review</button><button className="secondary-action" onClick={() => choose(null)}>Clear session data</button></div>
          </section>
        ) : (
          <>
            <section className="welcome">
              <p className="eyebrow">DOCUMENT PRIVACY, SIMPLIFIED</p>
              <h1>Review before<br />you share.</h1>
              <p className="intro">Find potentially sensitive text in images, PDFs and documents. Approve removals, inspect the exported copy and check what has or hasn't been verified.</p>
            </section>
            <section className="upload-card">
              <div className="section-title"><div><h2>01 · Select a file and privacy goals</h2>
                <p>PDF, photos, Word, Excel, PowerPoint, CSV and text · up to 12 MiB</p></div>
                <span className="step-number">01 / 03</span></div>
              <div className={'dropzone ' + (dragging ? 'drag-over' : '')}
                role="button" tabIndex={0} aria-label="Browse supported files"
                onClick={() => input.current?.click()}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') input.current?.click() }}
                onDragOver={event => { event.preventDefault(); setDragging(true) }}
                onDragLeave={event => { event.preventDefault(); setDragging(false) }}
                onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0] || null) }}>
                <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.bmp,.tif,.tiff,.docx,.pptx,.xlsx,.csv,.txt" onChange={handleInput} onClick={event => event.stopPropagation()} />
                <span className="upload-icon">↑</span><strong>Drop a file or select from your computer</strong>
                <span className="muted">Only files you explicitly choose are processed</span>
                <span className="browse-button">Browse files</span>
              </div>
              {file && <div className="file-row"><span className="pdf-icon">{formatType(file.name)}</span>
                <div className="file-details"><strong>{file.name}</strong><small>{MB(file.size)}</small></div>
                <span className="file-state">{invalid ? 'Unsupported' : 'Selected'}</span>
                <button className="remove-button" onClick={() => choose(null)} aria-label="Remove selected file">×</button></div>}
              {file && <div className="privacy-preferences">
                <div className="pref-heading"><strong>What would you like to protect?</strong><span>Choose categories to preselect in your scan</span></div>
                <div className="privacy-checkboxes">
                  {privacyOptions.map(item => <label key={item.id} className="privacy-option">
                    <input type="checkbox" checked={privacyCategories.includes(item.id)} disabled={phase !== 'ready'} onChange={() => toggleCategory(item.id)} />
                    <span>{item.label}</span>
                  </label>)}
                </div>
                <label className="repeat-option"><input type="checkbox" checked={allOccurrences} onChange={event => { setAllOccurrences(event.target.checked); clearResult() }} /> Protect every recognized occurrence of a selected identifier, including other pages</label>
                <p className="pref-note">Names, addresses, dates and images are detected on a best-effort basis. Check every page and draw manual boxes for anything missed.</p>
              </div>}
              <div className="action-row">
                <button className="secondary-action" onClick={sample} disabled={phase !== 'ready'}>Load fictional demo file</button>
                <button className="primary-action" onClick={scan} disabled={!file || invalid || phase !== 'ready'}>{phase === 'scanning' ? 'Scanning…' : 'Scan file →'}</button>
              </div>
              {serverStatus === "offline" && <p className="warning">The local backend is not responding. Start the server, then refresh this page.</p>}
              {ocrAvailable === false && <p className="warning">OCR isn't available. Images and scanned PDFs cannot be text-scanned automatically.</p>}
              {visionAvailable === false && <p className="warning">Face/QR auto-detection is unavailable; manually draw masks over photos and codes.</p>}
              <p className={problem ? 'warning' : 'notice'} role="status" aria-live="polite">{message}</p>
              <div className="privacy-note"><span>♧</span><p><strong>Privacy comes first.</strong><br />
                Files are sent only to your configured ShareShield server. Use local deployment for private documents; this prototype cannot guarantee complete sanitization.</p></div>
            </section>
            {analysis && <section className="review-grid">
              <article className="review-card">
                <div className="section-title"><div><h2>02 · Review detections</h2><p>Choose information to redact</p></div><span className="step-number">{analysis.findings.length} FOUND</span></div>
                <div className="metric-strip"><span><strong>{analysis.high_risk_count}</strong> high-priority candidates</span><span><strong>{analysis.findings.length}</strong> total</span></div>
                <p className="pref-note">Selected categories preselect detected candidates. Individual boxes can still be unchecked.</p>
                <div className="action-row compact-actions">
                  <button className="secondary-action" onClick={() => selectionAll(true)}>Select all</button>
                  <button className="secondary-action" onClick={() => selectionAll(false)}>Clear</button>
                </div>
                <div className="findings-list">
                  {analysis.findings.length === 0 && <p className="muted">No supported patterns found. This does not mean the file is safe.</p>}
                  {analysis.findings.map(f => <label key={f.id} className="finding-row">
                    <input type="checkbox" checked={selected.includes(f.id)} disabled={!f.locatable} onChange={() => changeSelected(f.id)} />
                    <span className="finding-text"><strong>{f.value}</strong><small>{f.category.replaceAll('_', ' ')} · {f.severity} · {analysis.preview_supported ? 'page ' + f.page : f.location || 'text'}</small></span>
                  </label>)}
                </div>
                <details className="limitations" open><summary>Unverified areas and limits</summary>
                  <ul>{analysis.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </details>
              </article>
              <article className="review-card preview-card">
                <div className="section-title"><div><h2>03 · Redact and verify</h2>
                  <p>{analysis.preview_supported ? 'Draw on the original to mask anything detection missed' : 'Preview is available for images and PDFs only'}</p></div><span className="step-number">03 / 03</span></div>
                {analysis.preview_supported ? <>
                  <div className="redaction-method" role="group" aria-label="Preferred masking method">
                    <strong>Mask appearance</strong>
                    <div className="effect-options">
                      {(['blackout', 'blur', 'pixelate'] as RedactionMode[]).map(effect =>
                        <label key={effect} className={redactionMode === effect ? 'effect-option chosen' : 'effect-option'}>
                          <input type="radio" name="redaction-effect" checked={redactionMode === effect} onChange={() => chooseMode(effect)} />
                          {effect === 'blackout' ? '■ Permanent black box' : effect === 'blur' ? '◌ Blur photos' : '▦ Pixelate photos'}
                        </label>)}
                    </div>
                    <p className="pref-note">Text identifiers and QR codes are always blacked out. Blur/pixelation apply only to selected faces and manual boxes; PDF exports are flattened. Visual hiding is not guaranteed irreversible.</p>
                  </div>
                  <div className="preview-pair">
                    <div><p className="preview-caption">Original · selected areas highlighted</p>
                      <div className="page-frame" ref={previewSurface} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { initialPoint.current = null; setDraft(null) }}>
                        {originalPreview ? <img src={originalPreview} alt={'Original page ' + page} draggable={false} /> : <span>Loading preview…</span>}
                        <svg className="mark-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                          {chosen.filter(f => f.page === page).flatMap(f => f.rectangles.map((r, i) =>
                            <rect key={f.id + ':' + i} x={r[0] / previewWidth * 1000} y={r[1] / previewHeight * 1000}
                              width={(r[2] - r[0]) / previewWidth * 1000} height={(r[3] - r[1]) / previewHeight * 1000} className="auto-mask" />))}
                          {[...manual.filter(m => m.page === page), ...(draft ? [draft] : [])].map((m, i) =>
                            <rect key={'mask:' + i} x={m.x * 1000} y={m.y * 1000} width={m.w * 1000} height={m.h * 1000} className="manual-mask" />)}
                        </svg>
                      </div></div>
                    <div><p className="preview-caption">Export preview</p><div className="page-frame after">
                      {outputPreview ? <img src={outputPreview} alt={'Redacted page ' + page} /> : <span>Generate output to preview here</span>}
                    </div></div>
                  </div>
                  <div className="page-controls"><button onClick={() => setPage(x => Math.max(1, x - 1))} disabled={page === 1}>←</button>
                    <span>Page {page} of {analysis.page_count}</span><button onClick={() => setPage(x => Math.min(analysis.page_count, x + 1))} disabled={page === analysis.page_count}>→</button>
                    <button onClick={undo} disabled={!manual.some(m => m.page === page)}>Undo box</button>
                    <span className="muted">{manual.length} manual masks</span>
                  </div>
                </> : <p className="preview-placeholder">For Word, PowerPoint, Excel, CSV and TXT, recognized text is permanently replaced. Blur/photo masking is supported in images and PDFs only.</p>}
                <div className="action-row"><button className="primary-action" disabled={phase !== 'ready' || (!selected.length && !manual.length)}
                  onClick={processFile}>{phase === 'processing' ? 'Processing…' : 'Generate & verify copy'}</button>
                  <button className="secondary-action" disabled={!result} onClick={download}>Download reviewed copy ↓</button></div>
                {report && <div className={'report-card ' + statusColor}><h3>Verification: {report.status.replace('_', ' ')}</h3>
                  <p>{report.selected_count} recognized items selected · {report.manual_boxes} manual masks</p>
                  <p className="report-digest">Output SHA-256: {report.output_sha256}</p><p className="caption">{report.status === "PASS_SCOPED" ? "Only the selected recognized values were checked. Other hidden content may remain." : report.status === "UNVERIFIED" ? "Manual masking or incomplete checks require careful human review." : "At least one selected value remains detectable; download is blocked."}</p>
                  <details><summary>What was checked—and what wasn't</summary>
                    <strong>Completed checks</strong><ul>{report.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    <strong>Unverified</strong><ul>{report.unverified.map((c, i) => <li key={i}>{c}</li>)}</ul></details>
                  <button className="secondary-action" onClick={downloadReport}>Download verification JSON ↓</button>
                </div>}
              </article>
            </section>}
            <section className="workflow"><div className="section-title"><div><h2>Three steps to a safer share</h2><p>Keep control of every redaction.</p></div></div>
              <div className="workflow-grid">
                <article className="workflow-card"><span className="workflow-icon">⌕</span><span className="workflow-step">STEP 01</span><h3>Detect</h3><p>Scan chosen files for recognized identifier patterns.</p></article>
                <article className="workflow-card"><span className="workflow-icon">✎</span><span className="workflow-step">STEP 02</span><h3>Review & redact</h3><p>Approve selected findings or draw manual masks on PDFs and images.</p></article>
                <article className="workflow-card"><span className="workflow-icon">✓</span><span className="workflow-step">STEP 03</span><h3>Verify</h3><p>Check selected recognized data in the exported file and review warnings.</p></article>
              </div>
            </section>
          </>
        )}
        <footer><span>ShareShield · Local-first student prototype</span><span>Detect. Review. Redact. Verify. Then Share.</span></footer>
      </section>
    </main>
  )
}
export default App
