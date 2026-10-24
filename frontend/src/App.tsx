import { useEffect, useRef, useState } from 'react'
import './App.css'
import Icon from './Icon'
import PlayfulGuide from './PlayfulGuide'
import PrivacyPanel from './PrivacyPanel'
import HeroVisual from './HeroVisual'
import ShieldyAssistant from './ShieldyAssistant'
import CommandPalette, { type CommandAction } from './CommandPalette'

type Finding = {
  id: number
  category: string
  severity: string
  confidence: number
  auto_select: boolean
  value: string
  page: number
  location?: string
  rectangles: number[][]
  locatable: boolean
}
type Analysis = {
  analysis_id: string
  source_sha256: string
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
  remaining_selected: { category: string; page: number; severity: string }[]
  remaining_detected: { category: string; page: number; severity: string }[]
  remaining_detected_count: number
  remaining_high_risk_count: number
  redaction_mode: RedactionMode
  checks: string[]
  unverified: string[]
}
type RedactionMode = 'blackout' | 'blur' | 'pixelate'
type Appearance = 'light' | 'dark' | 'system'
const privacyOptions = [
  { id: 'identity', label: 'Identity & patient IDs', categories: ['aadhaar_candidate', 'id12_candidate', 'vid_candidate', 'passport_candidate', 'voter_candidate', 'licence_candidate', 'patient_id_candidate'] },
  { id: 'name', label: 'Full name', categories: ['name_candidate'] },
  { id: 'address', label: 'Residential address', categories: ['address_candidate'] },
  { id: 'dob', label: 'Date of birth', categories: ['dob_candidate'] },
  { id: 'photo', label: 'Face / photograph', categories: ['face_candidate'] },
  { id: 'contacts', label: 'Phone and email', categories: ['email', 'indian_mobile_candidate'] },
  { id: 'codes', label: 'QR codes (barcode: manual)', categories: ['qr_candidate'] },
  { id: 'financial', label: 'Bank accounts, PAN, UPI & cards', categories: ['pan_candidate', 'upi_candidate', 'payment_card_candidate', 'ifsc_candidate', 'bank_account_candidate'] },
  { id: 'other', label: 'Credentials & manual areas', categories: ['credential_candidate'] },
]
const privacyIcons: Record<string, string> = {
  identity: 'shield', name: 'file', address: 'privacy', dob: 'report',
  photo: 'image', contacts: 'monitor', codes: 'scan', financial: 'lock', other: 'wand',
}
const privacyNotes: Record<string, string> = {
  identity: 'National IDs', name: 'Personal identity', address: 'Home & location',
  dob: 'Personal dates', photo: 'Face detection', contacts: 'Email & mobile',
  codes: 'Visual codes', financial: 'Payment details', other: 'Manual areas',
}
function defaultFindingIds(findings: Finding[], wanted: string[]) {
  const categories = new Set(privacyOptions.filter(option => wanted.includes(option.id)).flatMap(option => option.categories))
  return findings.filter(f => f.locatable && f.auto_select && f.category !== 'text_region_candidate' && categories.has(f.category)).map(f => f.id)
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
/**
 * Retry only explicit temporary server-busy responses (HTTP 503).
 * Recreate the multipart body on each attempt and never silently retry
 * invalid documents, failed verifications, or permanent server errors.
 */
async function postWithBusyRetry(
  endpoint: string,
  makeBody: () => FormData,
  onRetry?: (attempt: number) => void,
): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(endpoint, { method: 'POST', body: makeBody(), cache: 'no-store' })
    if (response.status !== 503 || attempt === 3) return response
    onRetry?.(attempt + 1)
    const retryAfter = Number(response.headers.get('Retry-After'))
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(8000, retryAfter * 1000 + attempt * 1000)
      : 2500 + attempt * 2000
    await new Promise<void>(resolve => window.setTimeout(resolve, delay))
  }
  throw Error('Document processor could not complete this request. Please retry.')
}
function formatType(name: string) {
  return name.split('.').pop()?.toUpperCase() || 'FILE'
}
function MB(bytes: number) { return (bytes / 1048576).toFixed(2) + ' MB' }

function App() {
  const isHosted = !['localhost', '127.0.0.1'].includes(window.location.hostname)
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [phase, setPhase] = useState<'ready' | 'scanning' | 'processing'>('ready')
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState(false)
  const [page, setPage] = useState(1)
  const [manual, setManual] = useState<ManualBox[]>([])
  const [history, setHistory] = useState<ManualBox[][]>([])
  const [future, setFuture] = useState<ManualBox[][]>([])
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(100)
  const [compare, setCompare] = useState(50)
  const [viewMode, setViewMode] = useState<'split' | 'original' | 'export'>('split')
  const [reviewedPages, setReviewedPages] = useState<number[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
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
  const [processorBusy, setProcessorBusy] = useState(false)
  const lastBackendResponse = useRef(0)
  const [logoUnavailable, setLogoUnavailable] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const previewSurface = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)
  const resultUrl = useRef<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [recent, setRecent] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [toast, setToast] = useState('')
  const [commandOpen, setCommandOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [motionEnabled, setMotionEnabled] = useState(true)
  const [drawMode, setDrawMode] = useState(true)
  const [appearance, setAppearance] = useState<Appearance>(() => {
    const current = document.documentElement.dataset.preference
    return current === 'light' || current === 'dark' || current === 'system' ? current : 'dark'
  })

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let checking = false
    async function checkHealth() {
      if (!active || checking) return
      checking = true
      try {
        const response = await fetch('/api/status', { cache: 'no-store', credentials: 'same-origin' })
        if (!response.ok) throw Error('Health check returned ' + response.status)
        const status = await response.json()
        if (status?.status !== 'ok') throw Error('Invalid server health response')
        if (!active) return
        failures = 0
        lastBackendResponse.current = Date.now()
        setOcrAvailable(Boolean(status.ocr_available))
        setVisionAvailable(Boolean(status.vision_available))
        setProcessorBusy(Boolean(status.processor_busy))
        setServerStatus('online')
      } catch (error) {
        console.warn("ShareShield health probe failed", error)
        if (!active) return
        setOcrAvailable(null)
        setVisionAvailable(null)
        failures += 1
        // A working upload/preview is evidence that the server is online.
        // Do not turn a single transient health-probe miss into "Offline".
        if (Date.now() - lastBackendResponse.current < 60000) {
          setServerStatus('online')
        } else if (failures < 4) {
          setServerStatus('checking')
          timer = setTimeout(checkHealth, failures * 2500)
        } else {
          setServerStatus('offline')
        }
      } finally {
        checking = false
      }
    }
    void checkHealth()
    // Cold starts and long scans should not leave a permanent offline badge.
    const poll = window.setInterval(() => { void checkHealth() }, 20000)
    const onVisible = () => { if (document.visibilityState === 'visible') void checkHealth() }
    document.addEventListener('visibilitychange', onVisible)
    const onReconnect = () => {
      if (timer) clearTimeout(timer)
      failures = 0
      setServerStatus('checking')
      void checkHealth()
    }
    window.addEventListener('online', onReconnect)
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onReconnect)
    }
  }, [])
  useEffect(() => () => { if (resultUrl.current) URL.revokeObjectURL(resultUrl.current) }, [])
  useEffect(() => {
    if (!sidebarOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [sidebarOpen])
  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? 'on' : 'off'
  }, [motionEnabled])
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(open => !open)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = appearance === 'system' ? (media.matches ? 'dark' : 'light') : appearance
      document.documentElement.dataset.preference = appearance
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved
    }
    apply()
    media.addEventListener('change', apply)
    try { window.localStorage.setItem('shareshield-appearance', appearance) }
    catch { /* storage may be blocked; theme remains available for this session */ }
    return () => media.removeEventListener('change', apply)
  }, [appearance])
  function navigateTo(id: string) {
    setActiveSection(id)
    setRecent(false)
    setSidebarOpen(false)
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({
      behavior: !motionEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }), 0)
  }


  function clearResult() {
    if (resultUrl.current) { URL.revokeObjectURL(resultUrl.current); resultUrl.current = null }
    setResult(null)
    setReport(null)
    setOutputPreview('')
    setReviewedPages([])
    setAcknowledged(false)
  }
  function choose(next: File | null) {
    requestId.current += 1
    setPhase('ready')
    setFile(next)
    setAnalysis(null)
    setSelected([])
    setManual([])
    setHistory([])
    setFuture([])
    setEditIndex(null)
    setZoom(100)
    setCompare(50)
    setViewMode('split')
    setDraft(null)
    setPage(1)
    setRecent(false)
    setOriginalPreview('')
    setDrawMode(true)
    clearResult()
    setProblem(false)
    setMessage('')
    setToast(next ? 'Nice pick! Choose what to protect, then scan.' : '')
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
  function identitySample() {
    const canvas = document.createElement('canvas')
    canvas.width = 1100; canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1100, 900)
    ctx.fillStyle = '#111'; ctx.font = '32px sans-serif'
    const rows = ['Government of India', 'SAMPLE STUDENT', 'S/O SAMPLE PARENT',
      'Flat 14, Example Street', '3rd Main Example Nagar', 'Fiction City 560001',
      'Mobile: 98765 43210', 'Your Aadhaar No:', '2345 6789 0123',
      'VID: 1111 2222 3333 4444', 'DOB: 08/08/2006']
    rows.forEach((line, i) => ctx.fillText(line, 70, 60 + i * 68))
    ctx.fillStyle = '#174e72'; ctx.fillRect(790, 50, 230, 65)
    ctx.fillStyle = '#fff'; ctx.font = '19px sans-serif'; ctx.fillText('FICTIONAL TEST', 818, 90)
    ctx.fillStyle = '#dceaf1'; ctx.fillRect(800, 180, 210, 250)
    ctx.fillStyle = '#7597aa'; ctx.beginPath(); ctx.arc(905, 260, 48, 0, Math.PI * 2); ctx.fill()
    ctx.fillRect(845, 320, 120, 85)
    ctx.fillStyle = '#333'; ctx.font = '18px sans-serif'; ctx.fillText('Manual-mask example', 800, 460)
    canvas.toBlob(blob => { if (blob) choose(new File([blob], 'fictional-identity.png', {type:'image/png'})) }, 'image/png')
  }
  async function reconnect() {
    // Keep the user's selected file and manual work: a full reload loses both.
    setServerStatus('checking')
    try {
      const response = await fetch('/api/status', { cache: 'no-store', credentials: 'same-origin' })
      if (!response.ok) throw Error('Health check unsuccessful')
      const health = await response.json()
      if (health?.status !== 'ok') throw Error('Unexpected health response')
      setServerStatus('online')
      lastBackendResponse.current = Date.now()
      setOcrAvailable(Boolean(health.ocr_available))
      setVisionAvailable(Boolean(health.vision_available))
      setProcessorBusy(Boolean(health.processor_busy))
      setToast('Connected! Your selected file and settings are preserved.')
    } catch (error) {
      console.warn("ShareShield connection retry failed", error)
      setServerStatus('offline')
      setToast('Still reconnecting. Your selected file is safe in this browser session.')
    }
  }

  async function scan() {
    if (!file || invalid) return
    const id = ++requestId.current
    setPhase('scanning'); setProblem(false); setMessage('Scanning file for supported identifiers…')
    // Keep the previous review available if a temporary 503 blocks rescan.
    try {
      const response = await postWithBusyRetry(
        '/analyze', () => dataFor(file),
        attempt => {
          if (id !== requestId.current) return
          setServerStatus('online')
          setProcessorBusy(true)
          setMessage('Processor is occupied. Retrying automatically (' + attempt + ' of 3)…')
        },
      )
      if (!response.ok) throw Error(await errorFrom(response))
      const data: Analysis = await response.json()
      if (id !== requestId.current) return
      lastBackendResponse.current = Date.now()
      setServerStatus('online')
      setProcessorBusy(false)
      setAnalysis(data)
      setSelected([]); setManual([]); setHistory([]); setFuture([]); setEditIndex(null); clearResult()
      const incomplete = data.limitations.some(note => note.includes('UNVERIFIED:'))
      setToast(incomplete ? 'Partial scan: manually review unverified content.' : data.findings.length ? 'Scan finished! Check the suggestions below.' : 'Scan finished. Check for anything the scanner missed.')
      setSelected(defaultFindingIds(data.findings, privacyCategories))
      setPage(1)
      setMessage(incomplete
        ? 'Scan finished with incomplete coverage. Inspect every page and mask missed details manually.'
        : data.findings.length
          ? data.findings.length + ' candidate(s) found. Review them before redacting.'
          : 'No configured patterns detected. The file is NOT certified safe; use manual redaction for images and PDFs.')
      setProblem(false)
    } catch (error) {
      if (id !== requestId.current) return
      setProcessorBusy(false)
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
      lastBackendResponse.current = Date.now()
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
    setSelected(all ? (analysis?.findings.filter(f => f.locatable && f.category !== 'text_region_candidate').map(f => f.id) || []) : [])
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
  function commitManual(next: ManualBox[]) {
    setHistory(p => [...p.slice(-29), manual])
    setFuture([])
    setManual(next)
    clearResult()
  }
  function modifyManual(deltaX: number, deltaY: number, deltaSize: number) {
    if (editIndex === null || !manual[editIndex]) return
    const current = manual[editIndex]
    const w = Math.min(.99, Math.max(.01, current.w + deltaSize))
    const h = Math.min(.99, Math.max(.01, current.h + deltaSize))
    const next = { ...current, w, h,
      x: Math.max(0, Math.min(1 - w, current.x + deltaX - deltaSize / 2)),
      y: Math.max(0, Math.min(1 - h, current.y + deltaY - deltaSize / 2)) }
    commitManual(manual.map((box, index) => index === editIndex ? next : box))
  }
  function deleteManual() {
    if (editIndex === null) return
    commitManual(manual.filter((_, index) => index !== editIndex))
    setEditIndex(null)
  }
  function redo() {
    if (!future.length) return
    const next = future[future.length - 1]
    setHistory(p => [...p.slice(-29), manual])
    setFuture(p => p.slice(0, -1))
    setManual(next)
    setEditIndex(null)
    clearResult()
  }
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!analysis?.preview_supported || phase !== 'ready' || !drawMode) return
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
      commitManual([...manual, box])
      setToast('Manual mask added. Nice catch!')
      setEditIndex(manual.length)
    }
    initialPoint.current = null
    setDraft(null)
  }
  function undo() {
    if (!history.length) return
    const previous = history[history.length - 1]
    setFuture(p => [...p.slice(-29), manual])
    setHistory(p => p.slice(0, -1))
    setManual(previous)
    setEditIndex(null)
    clearResult()
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
      const response = await postWithBusyRetry(
        '/redact', () => request,
        attempt => {
          setServerStatus('online')
          setMessage('Processor is occupied. Retrying redaction (' + attempt + ' of 3)…')
        },
      )
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
      const check = await postWithBusyRetry(
        '/verify', () => verify,
        attempt => {
          setServerStatus('online')
          setMessage('Processor is occupied. Retrying verification (' + attempt + ' of 3)…')
        },
      )
      if (!check.ok) throw Error(await errorFrom(check))
      const checked: Report = await check.json()
      if (id !== requestId.current) return
      lastBackendResponse.current = Date.now()
      setServerStatus('online')
      setReport(checked)
      if (checked.status === 'FLAG') {
        setProblem(true); setMessage('Verification found selected information in the output. Download withheld.')
      } else {
        setResult(processed)
        setViewMode('split')
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
    if (!result || report?.status === 'FLAG' || !acknowledged || (analysis?.preview_supported && reviewedPages.length !== analysis.page_count)) return
    const url = URL.createObjectURL(result)
    resultUrl.current = url
    const link = document.createElement('a')
    link.href = url; link.download = result.name
    document.body.append(link); link.click(); link.remove()
  }
  function downloadReport() {
    if (!report || !analysis) return
    const payload = {
      ...report, original_sha256: analysis.source_sha256, original_format: analysis.format,
      review_pages_marked: reviewedPages.length, review_page_total: analysis.page_count,
      categories_requested: privacyCategories, acknowledged,
      generated_at: new Date().toISOString(), disclaimer: 'Best-effort scan only; not a certificate of complete sanitization.'
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'shareshield-verification.json'
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const chosen = analysis?.findings.filter(f => selected.includes(f.id)) || []
  const pagesComplete = Boolean(analysis && (!analysis.preview_supported || reviewedPages.length === analysis.page_count))
  const statusColor = report?.status === 'FLAG' ? 'failed' : report?.status === 'PASS_SCOPED' ? 'passed' : 'incomplete'
  const guideStage = report?.status === 'FLAG' ? 'blocked' :
    result ? (pagesComplete && acknowledged ? 'download' : 'check') :
    phase !== 'ready' ? 'working' : analysis ? 'review' : file ? 'scan' : 'pick'
  const commandActions: CommandAction[] = [
    { id: 'upload', title: 'Open file upload', description: 'Pick a document and choose what to protect', icon: 'upload', hint: '01', run: () => navigateTo('upload') },
    { id: 'demo', title: 'Load fictional demo', description: 'Try the sample without exposing real personal data', icon: 'file', disabled: phase !== 'ready', hint: '02',
      run: () => { sample(); navigateTo('upload') } },
    { id: 'review', title: 'Open document editor', description: 'Inspect findings and draw manual masks', icon: 'layers', disabled: !analysis, hint: '03', run: () => navigateTo('review') },
    { id: 'verification', title: 'View verification report', description: 'Read remaining risks and export status', icon: 'report', disabled: !report, hint: '04', run: () => navigateTo('verification') },
    { id: 'privacy', title: 'Privacy and safety', description: 'Understand file processing and limitations', icon: 'lock', run: () => { setShowPrivacy(true); navigateTo('privacy') } },
    { id: 'appearance', title: 'Appearance preferences', description: 'Light / Dark / System and motion effects', icon: 'settings', run: () => { setShowSettings(true); navigateTo('settings') } },
    { id: 'light', title: 'Switch to light mode', description: 'Ice-blue light theme', icon: 'sun', run: () => setAppearance('light') },
    { id: 'dark', title: 'Switch to dark mode', description: 'Midnight blue and electric cyan command center', icon: 'moon', run: () => setAppearance('dark') },
    { id: 'system', title: 'Follow system appearance', description: 'Use the current macOS appearance', icon: 'monitor', run: () => setAppearance('system') },
  ]
  const workflowStage = report ? 5 : analysis ? (phase === 'processing' ? 4 : 3) : file ? (phase === 'scanning' ? 2 : 1) : 0
  const workflowSteps = [
    { icon: 'upload', label: 'Upload' }, { icon: 'privacy', label: 'Choose' },
    { icon: 'scan', label: 'Analyze' }, { icon: 'eye', label: 'Review' },
    { icon: 'lock', label: 'Redact' }, { icon: 'checkCircle', label: 'Verify' },
  ]
  return (
    <main className="app-shell">
      <aside className={'sidebar' + (sidebarCollapsed ? ' is-collapsed' : '') + (sidebarOpen ? ' mobile-open' : '')} aria-label="Main navigation">
        <div className="sidebar-head">
          <a className="brand" href="/" aria-label="ShareShield home">
            <span className="brand-icon brand-icon-approved">{logoUnavailable ? <Icon name="shield" size={28} /> : <img src="/shareshield-mark.webp" alt="" width="48" height="48" onError={() => setLogoUnavailable(true)} />}</span>
            <span className="brand-words"><strong className="brand-wordmark"><span>Share</span><span>Shield</span></strong><small>PRIVACY WORKSPACE</small></span>
          </a>
          <button className="sidebar-toggle icon-button" type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => { setSidebarCollapsed(!sidebarCollapsed); setSidebarOpen(false) }}>
            <Icon name={sidebarCollapsed ? 'expand' : 'collapse'} size={19} />
          </button>
        </div>
        <p className="nav-heading">WORKSPACE</p>
        <nav className="side-nav" aria-label="Workspace sections">
          <button title="Dashboard" className={'nav-item ' + (!recent && activeSection === 'overview' ? 'active' : '')} onClick={() => navigateTo('overview')}><Icon name="dashboard" /><span>Dashboard</span></button>
          <button title="Redact document" className={'nav-item ' + (activeSection === 'upload' ? 'active' : '')} onClick={() => navigateTo('upload')}><Icon name="scan" /><span>Redact document</span></button>
          <button title="Review workspace" className={'nav-item ' + (activeSection === 'review' ? 'active' : '')} disabled={!analysis} onClick={() => navigateTo('review')}><Icon name="layers" /><span>Review workspace</span></button>
          <button title="Verification report" className={'nav-item ' + (activeSection === 'verification' ? 'active' : '')} disabled={!report} onClick={() => navigateTo('verification')}><Icon name="report" /><span>Verification report</span></button>
          <button title="Session status" className={'nav-item ' + (recent ? 'active' : '')} onClick={() => { setRecent(true); setActiveSection('session'); setSidebarOpen(false) }}><Icon name="bolt" /><span>Session status</span></button>
        </nav>
        <p className="nav-heading nav-secondary">TOOLS & MORE</p>
        <nav className="side-nav" aria-label="Additional tools">
          <button title="Load fictional sample" className="nav-item" onClick={() => { sample(); navigateTo('upload') }}><Icon name="file" /><span>Fictional demo file</span></button>
          <button title="Appearance settings" className={'nav-item ' + (activeSection === 'settings' ? 'active' : '')} onClick={() => { setShowSettings(x => !x); navigateTo('settings') }}><Icon name="settings" /><span>Appearance</span></button>
          <button title="Privacy and safety" className={'nav-item ' + (activeSection === 'privacy' ? 'active' : '')} onClick={() => { setShowPrivacy(true); navigateTo('privacy') }}><Icon name="lock"/><span>Privacy &amp; safety</span></button>
          <button title="About ShareShield" className={'nav-item ' + (activeSection === 'about' ? 'active' : '')} onClick={() => { setShowAbout(x => !x); navigateTo('about') }}><Icon name="info" /><span>About project</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-privacy">
          <span className="sidebar-privacy-mark"><Icon name="lock" size={19}/></span>
          <strong>{isHosted ? 'Cloud-hosted document workspace' : 'Local-first by design'}</strong>
          <span>{isHosted ? 'Uploaded files are processed on this hosting server, not on your device. For now, use fictional files only.' : 'Your selected files are processed by your configured local server, not a third-party AI service.'}</span>
        </div>
        <div className="sidebar-bottom">
          <span className={'local-indicator ' + (serverStatus === 'offline' ? 'indicator-unavailable' : '')} />
          <div><strong>{phase !== 'ready' ? 'Processing document' : serverStatus === 'online' ? (processorBusy ? 'Processor busy' : 'Backend connected') : serverStatus === 'checking' ? 'Checking service' : 'Reconnecting to server'}</strong>
            <small>{phase !== 'ready' ? 'Document processing in progress' : serverStatus === 'online' ? (processorBusy ? 'The server is processing a document' : ocrAvailable ? (isHosted ? 'OCR ready · server processing' : 'OCR ready · local processing') : 'OCR unavailable') : (isHosted ? 'Check connection or retry' : 'Start ShareShield locally')}</small></div>
        </div>
      </aside>
      {sidebarOpen && <button className="mobile-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <section className={'main-content' + (sidebarCollapsed ? ' expanded-content' : '')}>
        <header className="topbar">
          <div className="breadcrumb">
            <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
             <img className="mobile-brand-mark" src="/shareshield-mark.webp" alt="ShareShield" width="28" height="28" />
            <span className="breadcrumb-muted">Workspace</span><Icon name="chevronRight" size={14} />
            <strong>{recent ? 'Session status' : 'Overview'}</strong>
          </div>
          <div className="topbar-right">
            <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}
              aria-label="Open command search" title="Open command search (⌘K)">
              <Icon name="search" size={16}/><span>Search anything</span><kbd>⌘ K</kbd>
            </button>
            <button className={'motion-trigger ' + (motionEnabled ? 'motion-on' : '')} type="button"
              title={motionEnabled ? 'Pause decorative animations' : 'Enable decorative animations'}
              aria-label={motionEnabled ? 'Pause decorative animations' : 'Enable decorative animations'}
              aria-pressed={motionEnabled} onClick={() => setMotionEnabled(x => !x)}><Icon name="sparkle" size={16}/></button>
            <div className="theme-switcher" role="group" aria-label="Appearance">
              {([['light', 'sun', 'Light'], ['system', 'monitor', 'System'], ['dark', 'moon', 'Dark']] as const).map(([value, icon, label]) =>
                <button key={value} type="button" className={appearance === value ? 'theme-option active' : 'theme-option'}
                  aria-pressed={appearance === value} title={label + ' appearance'} onClick={() => setAppearance(value)}>
                  <Icon name={icon} size={15}/><span>{label}</span>
                </button>)}
            </div>
            <span className={'server-pill ' + (phase !== 'ready' ? 'checking' : serverStatus)} role="status">
              <span className="status-dot" />{phase !== 'ready' ? 'Processing' : serverStatus === 'online' ? (processorBusy ? 'Processor busy' : 'System online') : serverStatus === 'checking' ? 'Connecting' : 'Reconnecting'}
            </span>
          </div>
        </header>
        {recent ? (
          <section className="upload-card status-dashboard surface-card" id="session">
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
            <section className="welcome" id="overview">
              <div className="hero-copy">
                <span className="hero-eyebrow"><Icon name="sparkle" size={14}/> INTELLIGENT DOCUMENT PRIVACY</span>
                <h1>Your privacy,<br/><span>in your control.</span></h1>
                <p className="intro">Detect what matters. Redact with precision. Verify before you share. One thoughtful workspace for safer document handling.</p>
                <div className="hero-actions">
                  <button className="primary-action hero-primary" onClick={() => navigateTo('upload')}><Icon name="upload" size={18}/> Protect a document <Icon name="arrowRight" size={17}/></button>
                  <button className="secondary-action hero-secondary" onClick={() => { sample(); navigateTo('upload') }}><Icon name="file" size={17}/> Try fictional demo</button>
                </div>
                <p className="hero-footnote"><Icon name="lock" size={14}/> Review before export · Your choice, every step</p>
              </div>
              <HeroVisual busy={phase !== 'ready'} findings={analysis?.findings.length ?? 0} hasAnalysis={Boolean(analysis)} />
            </section>
            <PlayfulGuide stage={guideStage} onAction={() => {
              const section = guideStage === 'pick' || guideStage === 'scan' ? 'upload' :
                guideStage === 'review' || guideStage === 'blocked' ? 'review' : 'verification'
              navigateTo(section)
            }} />
            <section className="dashboard-metrics" aria-label="Current privacy workspace status">
              {[
                { icon: 'layers', label: 'Supported formats', value: String(allowed.size), note: 'Documents and images' },
                { icon: 'scan', label: 'Detected candidates', value: String(analysis?.findings.length ?? 0), note: analysis ? 'Current analysis' : 'Ready for your first scan' },
                { icon: 'shield', label: 'OCR engine', value: ocrAvailable === null ? '—' : ocrAvailable ? 'Ready' : 'Offline', note: 'Tesseract processing' },
                { icon: 'checkCircle', label: 'Export review', value: report ? report.status.replace('_', ' ') : 'Not started', note: report ? 'Latest session outcome' : 'Review required' },
              ].map(metric => <article className="dashboard-metric" key={metric.label}>
                <span className="metric-icon"><Icon name={metric.icon} size={20}/></span>
                <span className="dashboard-metric-label">{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </article>)}
            </section>
            {showSettings && <section className="settings-panel surface-card" id="settings">
              <div className="section-title"><div><h2><Icon name="settings" size={19}/> Appearance preferences</h2><p>Choose your theme. System automatically follows macOS.</p></div></div>
              <div className="theme-choices">
                {([['light', 'sun', 'Light'], ['system', 'monitor', 'System default'], ['dark', 'moon', 'Dark']] as const).map(([value, icon, label]) =>
                  <button key={value} className={'theme-choice ' + (appearance === value ? 'active' : '')}
                    aria-pressed={appearance === value} onClick={() => setAppearance(value)}>
                    <Icon name={icon} size={19}/><span>{label}</span>{appearance === value && <Icon name="check" size={17}/>}
                  </button>)}
              </div>
              <div className="motion-settings">
                <span className="motion-settings-icon"><Icon name="sparkle" size={19}/></span>
                <div><strong>Interface motion</strong><small>Ambient lighting, transitions and lightweight motion details. System Reduce Motion always takes priority.</small></div>
                <button className={'motion-toggle ' + (motionEnabled ? 'active' : '')} role="switch" aria-checked={motionEnabled}
                  onClick={() => setMotionEnabled(enabled => !enabled)} aria-label="Toggle decorative interface animations"><span/></button>
              </div>
              <p className="pref-note">Only the appearance preference is saved in this browser. Animation preference is for this tab only. Documents and analysis results are not stored by these controls.</p>
            </section>}
            {showPrivacy && <PrivacyPanel onClose={() => setShowPrivacy(false)} />}
            {showAbout && <section className="about-panel surface-card" id="about">
              <div className="section-title"><div><h2><Icon name="info" size={19}/> About ShareShield</h2><p>Intelligent on-device privacy leak detection and automatic redaction system.</p></div></div>
              <p>ShareShield is a document privacy workspace for finding, reviewing, and redacting information in files you choose. {isHosted ? 'This website processes uploads on its hosting server, not on your device. Only use fictional files on this public build.' : 'This session processes documents through your local server.'} It does not silently inspect other applications or guarantee complete anonymization.</p>
              <p className="pref-note">Always examine the exported file. Automatic OCR, face proposals, and other detections can miss sensitive information.</p>
            </section>}
            <details className="journey-panel" aria-label="Document protection process">
              <summary className="journey-summary"><Icon name="layers" size={17}/> See the full six-step workflow <span>Optional details</span></summary>
              <div className="journey-heading"><div><span className="eyebrow">YOUR WORKFLOW</span><h2>One clear path to a safer share.</h2></div>
                <span className="journey-progress">{report ? 'Review generated' : phase === 'scanning' ? 'Analyzing file' : phase === 'processing' ? 'Creating export' : analysis ? 'Ready for review' : 'Ready when you are'}</span></div>
              <div className="workflow-stepper">
                {workflowSteps.map((step, index) => <div key={step.label} className={'journey-step ' + (index < workflowStage ? 'complete ' : '') + (index === workflowStage ? 'current' : '')}>
                  <span className="journey-icon">{index < workflowStage ? <Icon name="check" size={17}/> : <Icon name={step.icon} size={18}/>}</span>
                  <span><small>{String(index+1).padStart(2,'0')}</small><strong>{step.label}</strong></span>
                </div>)}
              </div>
            </details>
            <section className="upload-card surface-card" id="upload">
              <div className="section-title"><div><span className="section-kicker">01 / GET STARTED</span><h2>Start with your document</h2>
                <p>PDF, photos, Word, Excel, PowerPoint, CSV and text · up to 12 MiB</p></div>
                <span className="section-side-note"><Icon name="lock" size={14}/> Explicit upload only</span></div>
              <div className={'dropzone ' + (dragging ? 'drag-over' : '') + (phase === 'scanning' ? ' scanning' : '')}
                role="button" tabIndex={0} aria-label="Browse supported files"
                onClick={() => input.current?.click()}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.current?.click() } }}
                onDragOver={event => { event.preventDefault(); setDragging(true) }}
                onDragLeave={event => { event.preventDefault(); setDragging(false) }}
                onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0] || null) }}>
                <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.bmp,.tif,.tiff,.docx,.pptx,.xlsx,.csv,.txt" onChange={handleInput} onClick={event => event.stopPropagation()} />
                <span className="upload-icon"><Icon name="upload" size={26}/></span><strong>Drag your file here, or browse</strong>
                <span className="muted">Your files stay within your configured ShareShield server</span>
                <span className="browse-button">Choose a file <Icon name="arrowRight" size={15}/></span>
                <span className="format-pills"><em>PDF</em><em>JPG / PNG</em><em>HEIC</em><em>Word</em><em>PowerPoint</em><em>Excel</em></span>
              </div>
              {phase === 'scanning' && <div className="status-strip" role="status" aria-live="polite">
                <span className="status-signal"/> Scanning supported privacy patterns on your configured server…
              </div>}
              {file && <div className="file-row"><span className="pdf-icon">{formatType(file.name)}</span>
                <div className="file-details"><strong>{file.name}</strong><small>{MB(file.size)}</small></div>
                <span className="file-state">{invalid ? 'Unsupported' : 'Selected'}</span>
                <button className="remove-button" onClick={() => choose(null)} aria-label="Remove selected file">×</button></div>}
              {file && <div className="privacy-preferences" id="privacy-preferences">
                <div className="pref-heading"><div><span className="section-kicker">02 / PRIVACY PREFERENCES</span><strong>What would you like to protect?</strong></div><span>{privacyCategories.length} selected · Choose your categories</span></div>
                <div className="privacy-presets" role="group" aria-label="Quick privacy selection">
                  <button type="button" className={privacyCategories.length === privacyOptions.length ? 'preset-chip active' : 'preset-chip'}
                    disabled={phase !== 'ready'} onClick={() => {
                      const all = privacyOptions.map(item => item.id)
                      setPrivacyCategories(all)
                      if (analysis) setSelected(defaultFindingIds(analysis.findings, all))
                      clearResult()
                      setToast('All supported categories selected. You can still adjust them.')
                    }}><Icon name="sparkle" size={14}/> All categories</button>
                  <button type="button" className={privacyCategories.length === 0 ? 'preset-chip active' : 'preset-chip'}
                    disabled={phase !== 'ready'} onClick={() => {
                      setPrivacyCategories([])
                      if (analysis) setSelected([])
                      clearResult()
                      setToast('No categories preselected. You must still review the output.')
                    }}>Clear selection</button>
                </div>
                <div className="privacy-checkboxes">
                  {privacyOptions.map(item => <label key={item.id} className={"privacy-option " + (privacyCategories.includes(item.id) ? "is-selected" : "")}>
                    <input type="checkbox" checked={privacyCategories.includes(item.id)} disabled={phase !== 'ready'} onChange={() => toggleCategory(item.id)} />
                    <span className="privacy-option-icon"><Icon name={privacyIcons[item.id]} size={18}/></span><span className="privacy-option-copy"><strong>{item.label}</strong><small>{privacyNotes[item.id]}</small></span><span className="privacy-option-check"><Icon name="check" size={13}/></span>
                  </label>)}
                </div>
                <p className="pref-note"><Icon name="info" size={14}/> Categories preselect suggestions, not guaranteed findings. Review every page for anything missed.</p>
                <details className="advanced-settings">
                  <summary><Icon name="settings" size={15}/> Extra scan options <span>Optional</span></summary>
                  <label className="repeat-option"><input type="checkbox" checked={allOccurrences} onChange={event => { setAllOccurrences(event.target.checked); clearResult() }} /> Protect every recognized occurrence of a selected identifier, including other pages</label>
                  <p className="pref-note">Repeated-value protection is on by default. Detection can still miss information; use manual masks for PDFs and images.</p>
                </details>
              </div>}
              <div className="action-row upload-actions">
                <button className="secondary-action" onClick={sample} disabled={phase !== 'ready'}><Icon name="file" size={17}/> Use fictional sample</button>
                <button className="secondary-action" onClick={identitySample} disabled={phase !== 'ready'}>Use fictional ID image</button>
                <button className="primary-action" onClick={scan} disabled={!file || invalid || phase !== 'ready'}>{phase === 'scanning' ? <><span className="mini-spinner"/> Analyzing…</> : <><Icon name="scan" size={18}/> Analyze document <Icon name="arrowRight" size={17}/></>}</button>
              </div>
              {serverStatus === 'offline' && phase === 'ready' && <p className="connection-notice" role="status"><Icon name="alert" size={15}/><span>{isHosted ? 'The server did not answer its last connection check. It may be waking up; retry when ready.' : 'Your local backend is not responding. Check that ShareShield is running.'}</span><button className="connection-retry" type="button" onClick={() => { void reconnect() }}>Retry connection</button></p>}
              {ocrAvailable === false && <p className="warning">OCR isn't available. Images and scanned PDFs cannot be text-scanned automatically.</p>}
              {visionAvailable === false && <p className="warning">Face/QR auto-detection is unavailable; manually draw masks over photos and codes.</p>}
              <p className={problem ? 'warning' : 'notice'} role="status" aria-live="polite">{phase === 'scanning' && <span className="mini-spinner"/>}{message}</p>
              <div className="privacy-note"><span>♧</span><p><strong>Privacy comes first.</strong><br />
                Files are sent to the ShareShield server powering this page. Public hosting is not suitable for genuine identity documents; check all redactions manually.</p></div>
            </section>
            {analysis && <section className="review-grid" id="review" aria-label="Redaction workspace">
              <article className="review-card findings-card surface-card">
                <div className="section-title"><div><span className="section-kicker">03 / FINDINGS</span><h2><Icon name="search" size={18}/> Review detections</h2><p>Approve each suggested redaction</p></div><span className="finding-total">{analysis.findings.length} found</span></div>
                <div className="metric-strip"><span><strong>{analysis.high_risk_count}</strong> high-priority</span><span><strong>{selected.length}</strong> selected</span></div>
                <p className="pref-note">Selected categories preselect detected candidates. Individual boxes can still be unchecked.</p>
                <div className="action-row compact-actions">
                  <button className="secondary-action" onClick={() => selectionAll(true)}>Select all</button>
                  <button className="secondary-action" onClick={() => selectionAll(false)}>Clear</button>
                </div>
                <div className="findings-list">
                  {analysis.findings.length === 0 && <p className="muted">No supported patterns found. This does not mean the file is safe.</p>}
                  {analysis.findings.map(f => <label key={f.id} className="finding-row">
                    <input type="checkbox" checked={selected.includes(f.id)} disabled={!f.locatable} onChange={() => changeSelected(f.id)} />
                    <span className="finding-text"><strong>{f.value}</strong><small>{f.category.replaceAll('_', ' ')} · {Math.round(f.confidence * 100)}% rule confidence · {f.auto_select ? 'recommended' : 'review suggestion'} · {analysis.preview_supported ? 'page ' + f.page : f.location || 'text'}</small></span><span className={'severity-tag ' + f.severity}>{f.severity}</span>
                  </label>)}
                </div>
                {analysis.limitations.some(note => note.includes('UNVERIFIED:')) && <div className="scan-caveat" role="alert">
                  <Icon name="alert" size={18}/>
                  <div><strong>Manual review required</strong><p>Parts of this document could not be automatically inspected. Review every page, check images and QR codes, and cover missed details before export. The report will remain unverified.</p></div>
                </div>}
                <details className="limitations" open={analysis.limitations.some(note => note.includes('UNVERIFIED:'))}><summary>What might the scanner miss?</summary>
                  <ul>{analysis.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </details>
              </article>
              <article className="review-card preview-card surface-card">
                <div className="section-title"><div><span className="section-kicker">04 / DOCUMENT WORKSPACE</span><h2><Icon name="layers" size={18}/> Redact &amp; verify</h2>
                  <p>{analysis.preview_supported ? 'Draw on the original to mask anything detection missed' : 'Preview is available for images and PDFs only'}</p></div><span className="section-side-note"><Icon name="shield" size={15}/> Human review required</span></div>
                {analysis.preview_supported ? <>
                  <div className="workspace-toolbar" role="toolbar" aria-label="Redaction tools">
                    <span className="toolbar-title"><Icon name="wand" size={17}/> Tools</span>
                    <button className={drawMode ? 'tool-button active' : 'tool-button'} aria-pressed={drawMode}
                      onClick={() => setDrawMode(x => !x)} title="Toggle drawing rectangles on the original preview">
                      <Icon name="privacy" size={16}/> {drawMode ? 'Drawing masks' : 'Draw mask'}
                    </button>
                    <span className="toolbar-spacer" />
                    <span className="toolbar-tip">Select regions on the original document</span>
                  </div>
                  <details className="mask-style-details">
                    <summary><Icon name="settings" size={16}/> Mask style <strong>{redactionMode === 'blackout' ? 'Blackout (recommended)' : redactionMode === 'blur' ? 'Blur (visual only)' : 'Pixelate (visual only)'}</strong></summary>
                  <div className="redaction-method" role="group" aria-label="Preferred masking method">
                    <strong><Icon name="lock" size={16}/> Mask appearance</strong>
                    <div className="effect-options">
                      {(['blackout', 'blur', 'pixelate'] as RedactionMode[]).map(effect =>
                        <label key={effect} className={redactionMode === effect ? 'effect-option chosen' : 'effect-option'}>
                          <input type="radio" name="redaction-effect" checked={redactionMode === effect} onChange={() => chooseMode(effect)} />
                          {effect === 'blackout' ? '■ Permanent black box' : effect === 'blur' ? '◌ Blur photos' : '▦ Pixelate photos'}
                        </label>)}
                    </div>
                    <p className="pref-note">Text identifiers and QR codes are always blacked out. Blur/pixelation apply only to selected faces and manual boxes; PDF exports are flattened. Visual hiding is not guaranteed irreversible.</p>
                  </div>
                  </details>
                  <div className="view-toolbar" role="group" aria-label="Document view">
                    {([['split', 'Compare both'], ['original', 'Original focus'], ['export', 'Export focus']] as const).map(([value, label]) =>
                      <button key={value} className={viewMode === value ? 'view-button active' : 'view-button'}
                        disabled={value === 'export' && !result} aria-pressed={viewMode === value} onClick={() => setViewMode(value)}>{label}</button>)}
                  </div>
                  <div className="zoom-controls"><strong><Icon name="search" size={16}/> Inspect fine details</strong><label>Zoom {zoom}% <input type="range" min="100" max="300" step="25" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label></div>
                  <div className={"preview-pair mode-" + viewMode}>
                    <div><p className="preview-caption"><span className="preview-dot original-dot"/> ORIGINAL · Selected areas highlighted</p>
                      <div className="zoom-viewport"><div className="page-frame" style={{ width: zoom + '%' }} ref={previewSurface} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { initialPoint.current = null; setDraft(null) }}>
                        {originalPreview ? <img src={originalPreview} alt={'Original page ' + page} draggable={false} /> : <span>Loading preview…</span>}
                        <svg className="mark-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                          {chosen.filter(f => f.page === page).flatMap(f => f.rectangles.map((r, i) =>
                            <rect key={f.id + ':' + i} x={r[0] / previewWidth * 1000} y={r[1] / previewHeight * 1000}
                              width={(r[2] - r[0]) / previewWidth * 1000} height={(r[3] - r[1]) / previewHeight * 1000} className="auto-mask" />))}
                          {[...manual.filter(m => m.page === page), ...(draft ? [draft] : [])].map((m, i) =>
                            <rect key={'mask:' + i} x={m.x * 1000} y={m.y * 1000} width={m.w * 1000} height={m.h * 1000} className="manual-mask" />)}
                        </svg>
                      </div></div></div>
                    <div><p className="preview-caption"><span className="preview-dot export-dot"/> REDACTED · Export preview</p><div className="zoom-viewport"><div className="page-frame after" style={{ width: zoom + '%' }}>
                      {outputPreview ? <img src={outputPreview} alt={'Redacted page ' + page} /> : <span>Generate output to preview here</span>}
                    </div></div></div>
                  </div>
                  <div className="page-controls"><button onClick={() => setPage(x => Math.max(1, x - 1))} disabled={page === 1}>←</button>
                    <span>Page {page} of {analysis.page_count}</span><button onClick={() => setPage(x => Math.min(analysis.page_count, x + 1))} disabled={page === analysis.page_count}>→</button>
                    <button onClick={undo} disabled={!history.length}>Undo edit</button>
                    <button onClick={redo} disabled={!future.length}>Redo edit</button>
                    <span className="muted">{manual.length} manual masks</span>
                  </div>
                  {manual.some(m => m.page === page) && <div className="mask-editor">
                    <strong>Move, resize or delete a manual box</strong>
                    <div className="mask-selector">
                      {manual.map((m, i) => m.page === page && <button key={i} className={editIndex === i ? 'active' : ''} onClick={() => setEditIndex(i)}>Box {i + 1}</button>)}
                    </div>
                    <div className="mask-actions">
                      <button disabled={editIndex === null} onClick={() => modifyManual(-.012, 0, 0)}>← Move</button>
                      <button disabled={editIndex === null} onClick={() => modifyManual(.012, 0, 0)}>Move →</button>
                      <button disabled={editIndex === null} onClick={() => modifyManual(0, -.012, 0)}>↑ Move</button>
                      <button disabled={editIndex === null} onClick={() => modifyManual(0, .012, 0)}>Move ↓</button>
                      <button disabled={editIndex === null} onClick={() => modifyManual(0, 0, .02)}>+ Enlarge</button>
                      <button disabled={editIndex === null} onClick={() => modifyManual(0, 0, -.02)}>− Shrink</button>
                      <button disabled={editIndex === null} onClick={deleteManual}>Delete box</button>
                    </div>
                    <p className="pref-note">Choose a box, then nudge or resize it. Draw on the original preview to add more.</p>
                  </div>}
                  {result && originalPreview && outputPreview && <div className="comparison-panel">
                    <div className="pref-heading"><strong>Before / after comparison</strong><span>Drag to reveal the original</span></div>
                    <div className="comparison-view">
                      <img src={outputPreview} alt={'Redacted comparison page ' + page} />
                      <img src={originalPreview} className="comparison-original" style={{ clipPath: 'inset(0 ' + (100 - compare) + '% 0 0)' }} alt={'Original comparison page ' + page} />
                      <span className="comparison-rule" style={{ left: compare + '%' }} />
                      <span className="comparison-label original-label">Original</span>
                      <span className="comparison-label export-label">Redacted</span>
                    </div>
                    <label className="compare-slider">Original visible: {compare}% <input type="range" min="0" max="100" value={compare} onChange={e => setCompare(Number(e.target.value))} /></label>
                  </div>}
                  {result && <div className="page-review" id="export-review"><label><input type="checkbox" checked={reviewedPages.includes(page)}
                    onChange={event => setReviewedPages(current => event.target.checked ? [...current, page] : current.filter(p => p !== page))} />
                    I have visually checked page {page} of the exported copy</label>
                    <small>{reviewedPages.length} / {analysis.page_count} pages reviewed. Inspect each page, including small IDs, signatures, photos and codes.</small>
                  </div>}
                </> : <p className="preview-placeholder">For Word, PowerPoint, Excel, CSV and TXT, recognized text is permanently replaced. Blur/photo masking is supported in images and PDFs only.</p>}
                {result && <div className={'download-guide ' + (pagesComplete && acknowledged ? 'download-ready' : '')} role="status">
                  <Icon name={pagesComplete && acknowledged ? 'checkCircle' : 'info'} size={18}/>
                  <div><strong>{pagesComplete && acknowledged ? 'Review steps completed — download enabled' :
                    !pagesComplete ? 'Almost ready: check ' + (analysis.page_count - reviewedPages.length) + ' more page(s)' :
                    'One final checkbox: acknowledge the limits below'}</strong>
                    <span>{pagesComplete && acknowledged ? 'Inspect the downloaded file once more before sharing.' :
                      'This keeps the export deliberate. It does not certify complete privacy.'}</span></div>
                  {!pagesComplete && <button className="guide-inline-link" onClick={() => navigateTo('review')}>Review pages <Icon name="arrowRight" size={14}/></button>}
                </div>}
                {report?.status === 'FLAG' && <p className="warning" role="alert"><Icon name="alert" size={15}/> This export is blocked until remaining high-risk candidates are addressed. Please adjust your masks and try again.</p>}
                <div className="action-row export-actions" id="export-actions"><button className="primary-action" disabled={phase !== 'ready' || (!selected.length && !manual.length)}
                  onClick={processFile}>{phase === 'processing' ? <><span className="mini-spinner"/> Processing…</> : <><Icon name="lock" size={17}/> Generate &amp; verify <Icon name="arrowRight" size={17}/></>}</button>
                  <button className="secondary-action" disabled={!result || !acknowledged || !pagesComplete || report?.status === 'FLAG'} onClick={download}><Icon name="download" size={17}/> Download reviewed copy</button></div>
                {report && <div id="verification" className={'report-card ' + statusColor}><h3><Icon name={report.status === 'FLAG' ? 'alert' : 'checkCircle'} size={19}/> Verification: {report.status.replace('_', ' ')}</h3>
                  <p>{report.selected_count} recognized items selected · {report.manual_boxes} manual masks</p>
                  <div className="metric-strip"><span><strong>{report.remaining_detected_count}</strong> remaining candidates</span><span><strong>{report.remaining_high_risk_count}</strong> high-risk remaining</span></div>
                  {report.remaining_detected_count > 0 && <div className="remaining-list"><strong>Detected in exported file (values omitted from audit)</strong>
                    <ul>{report.remaining_detected.map((item, i) => <li key={i}>{item.category.replaceAll('_', ' ')} · page {item.page} · {item.severity}</li>)}</ul>
                    {report.remaining_detected_count > report.remaining_detected.length && <small>Showing first {report.remaining_detected.length} only.</small>}
                  </div>}
                  <p className="report-digest">Output SHA-256: {report.output_sha256}</p>
                  <p className="caption">{report.status === 'PASS_SCOPED' ? 'The full output was rescanned for supported patterns, but unidentified private information may remain.' : report.status === 'UNVERIFIED' ? 'Some candidate information or visual masks remain unverified. Review every page.' : 'High-risk or previously selected values remain; download is blocked.'}</p>
                  {report.status !== 'FLAG' && <label className="acknowledgement">
                    <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
                    I have inspected the export and understand that automatic detection cannot guarantee complete privacy.
                  </label>}
                  {report.status !== 'FLAG' && !pagesComplete && <p className="warning">Review all {analysis.page_count} exported pages before downloading.</p>}
                  <details><summary>What was checked—and what wasn't</summary>
                    <strong>Completed checks</strong><ul>{report.checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    <strong>Unverified</strong><ul>{report.unverified.map((c, i) => <li key={i}>{c}</li>)}</ul></details>
                  <button className="secondary-action" onClick={downloadReport}>Download verification JSON ↓</button>
                </div>}
              </article>
            </section>}
            <section className="workflow"><div className="section-title"><div><span className="section-kicker">WHY SHARESHIELD</span><h2>Built around your decisions.</h2><p>Privacy means knowing exactly what is—and isn't—protected.</p></div></div>
              <div className="workflow-grid">
                <article className="workflow-card"><span className="workflow-icon"><Icon name="scan" size={22}/></span><span className="workflow-step">STEP 01</span><h3>Detect</h3><p>Scan chosen files for recognized identifier patterns.</p></article>
                <article className="workflow-card"><span className="workflow-icon"><Icon name="privacy" size={22}/></span><span className="workflow-step">STEP 02</span><h3>Review & redact</h3><p>Approve selected findings or draw manual masks on PDFs and images.</p></article>
                <article className="workflow-card"><span className="workflow-icon"><Icon name="checkCircle" size={22}/></span><span className="workflow-step">STEP 03</span><h3>Verify</h3><p>Rescan the entire exported document and manually inspect each page.</p></article>
              </div>
            </section>
          </>
        )}
        <footer><span><Icon name="shield" size={15}/> ShareShield · {isHosted ? 'Cloud document review · remote processing' : 'Local document review'}</span>
          <span><button className="footer-privacy" onClick={() => { setShowPrivacy(true); navigateTo('privacy') }}><Icon name="lock" size={14}/> Privacy &amp; safety</button> · Detect · Review · Redact · Verify</span></footer>
      </section>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} actions={commandActions}/>
      <ShieldyAssistant
        hasFile={Boolean(file)} hasAnalysis={Boolean(analysis)} hasResult={Boolean(result)}
        findingCount={analysis?.findings.length ?? 0}
        reviewedPages={reviewedPages.length} pageCount={analysis?.page_count ?? 0}
        pagesComplete={pagesComplete} acknowledged={acknowledged} phase={phase}
        verificationStatus={report?.status ?? null}
        onNavigate={id => {
          if (id === 'privacy') setShowPrivacy(true)
          if (id === 'settings') setShowSettings(true)
          navigateTo(id)
        }}
        onChooseFile={() => { navigateTo('upload'); input.current?.click() }}
        onDemo={sample}
      />
      {toast && <div className="delight-toast" role="status" aria-live="polite"><Icon name="sparkle" size={18}/><span>{toast}</span>
        <button aria-label="Dismiss notification" onClick={() => setToast('')}><Icon name="close" size={14}/></button></div>}
    </main>
  )
}
export default App
