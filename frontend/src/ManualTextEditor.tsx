import { useEffect, useRef, useState } from 'react'

export type ManualTextRegion = { location: string; value: string }
type Section = { location: string; text: string }

export default function ManualTextEditor({ file, analysisId, regions, onChange, disabled }: {
  file: File; analysisId: string; regions: ManualTextRegion[];
  onChange: (regions: ManualTextRegion[]) => void; disabled: boolean;
}) {
  const [sections, setSections] = useState<Section[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<ManualTextRegion | null>(null)
  const [attempt, setAttempt] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      const body = new FormData()
      body.append('file', file); body.append('analysis_id', analysisId)
      let response: Response | undefined
      for (let retry = 0; retry < 4; retry++) {
        response = await fetch('/text-preview', { method: 'POST', body, signal: controller.signal, cache: 'no-store' })
        if (response.status !== 503 || !response.headers.has('Retry-After') || retry === 3) break
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      if (!response?.ok) {
        const data = await response?.json().catch(() => null)
        throw Error(typeof data?.detail === 'string' ? data.detail : 'Text preview could not load. Retry the preview or analyze again.')
      }
      const data = await response.json()
      if (active) { setSections(data.sections); setError('') }
    }
    load().catch(error => { if (active && error.name !== 'AbortError') setError(error.message) })
    return () => { active = false; controller.abort() }
  }, [file, analysisId, attempt])
  useEffect(() => {
    function readSelection() {
      const selected = window.getSelection()
      const value = selected?.toString() || ''
      const anchor = selected?.anchorNode?.parentElement?.closest<HTMLElement>('[data-text-location]')
      const focus = selected?.focusNode?.parentElement?.closest<HTMLElement>('[data-text-location]')
      setSelection(value.trim() && value.length <= 2000 && anchor && anchor === focus && root.current?.contains(anchor)
        ? { location: anchor.dataset.textLocation!, value } : null)
    }
    document.addEventListener('selectionchange', readSelection)
    return () => document.removeEventListener('selectionchange', readSelection)
  }, [])
  function add(next: ManualTextRegion[]) {
    if (disabled) return
    const combined = [...regions]
    for (const item of next) {
      if (!combined.some(existing => existing.location === item.location && existing.value === item.value)) combined.push(item)
    }
    if (combined.length > 60) { setError('Select at most 60 text regions. Remove an existing selection first.'); return }
    onChange(combined)
    setError('')
  }
  const matches = query.trim() && query.length <= 2000 ? sections?.filter(section => section.text.includes(query)) || [] : []
  return <div className="manual-text-editor" ref={root}>
    <div className="workspace-toolbar" role="toolbar" aria-label="Manual text selection tools">
      <strong>Manual text selection</strong>
      <button className="tool-button" disabled={disabled || !selection} onPointerDown={event => event.preventDefault()}
        onClick={() => { if (selection) add([selection]) }}>Redact selected text</button>
    </div>
    <p className="pref-note">Highlight text below, then choose Redact selected text. Or enter an exact phrase to select it in the matching sections. Rectangles are available for PDFs and images.</p>
    <div className="manual-text-search">
      <label>Exact text to redact<input value={query} maxLength={2000} disabled={disabled}
        onChange={event => setQuery(event.target.value)} placeholder="Enter a name, phrase or value" /></label>
      <button className="secondary-action" disabled={disabled || !matches.length}
        onClick={() => { add(matches.map(section => ({ location: section.location, value: query }))); setQuery('') }}>Add matching text</button>
    </div>
    {error && <p className="warning" role="alert">{error} <button disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Retry text preview</button></p>}
    {!sections && !error && <p role="status">Loading editable text…</p>}
    {sections?.length === 0 && <p>No editable text was found. Embedded images require conversion to PDF or an image for rectangle masks.</p>}
    {regions.length > 0 && <div className="manual-text-selections" aria-label="Selected manual text">
      <strong>{regions.length} manual text selections</strong>
      {regions.map((region, index) => <div key={region.location + ':' + region.value}><span>{region.value}</span>
        <button disabled={disabled} aria-label={'Remove text selection ' + (index + 1)} onClick={() => onChange(regions.filter((_, i) => i !== index))}>Remove</button></div>)}
    </div>}
    <div className="text-section-list" aria-label="Editable document text">
      {sections?.map(section => <section key={section.location} className="text-section">
        <small>{section.location}</small><pre data-text-location={section.location}>{section.text}</pre>
      </section>)}
    </div>
    <p className="pref-note">Selected literal text is replaced in its editable paragraph or cell. Repeated occurrences within that section are replaced together. Formulas, embedded pictures and hidden content are not a rendered page preview.</p>
  </div>
}
