import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import ShieldyRobot from './ShieldyRobot'
import { answerHelpQuestion, helpTopics } from './shieldyKnowledge'

type Props = {
  hasFile: boolean
  hasAnalysis: boolean
  hasResult: boolean
  findingCount: number
  reviewedPages: number
  pageCount: number
  pagesComplete: boolean
  acknowledged: boolean
  phase: 'ready' | 'scanning' | 'processing'
  verificationStatus: 'PASS_SCOPED' | 'UNVERIFIED' | 'FLAG' | null
  onNavigate: (section: string) => void
  onChooseFile: () => void
  onDemo: () => void
}

type Step = { title: string; message: string; target: string; button: string; icon: string }

const tourSteps: Step[] = [
  { title: 'Choose a document', message: 'Start with a file you own or the fictional sample. Nothing is inspected until you choose and analyze a file.', target: 'upload', button: 'Browse files', icon: 'upload' },
  { title: 'Choose what to protect', message: 'Select privacy categories, then press Analyze document. Suggested findings are not automatically removed.', target: 'upload', button: 'Show privacy choices', icon: 'privacy' },
  { title: 'Review detected details', message: 'Check the suggestions, uncheck anything you do not want to mask, and draw manual boxes for areas the scanner missed. Then Generate & verify.', target: 'review', button: 'Open review workspace', icon: 'eye' },
  { title: 'Inspect the exported copy', message: 'Compare original and redacted pages. Tick each page after checking it, then acknowledge the limitations before downloading.', target: 'review', button: 'Go to export review', icon: 'checkCircle' },
  { title: 'Download your reviewed file', message: 'The required checks are marked complete, but this is not proof of full sanitization. Inspect the saved file before sharing.', target: 'verification', button: 'See final export', icon: 'download' },
]

function getStep(props: Props) {
  if (!props.hasFile) return 0
  if (!props.hasAnalysis) return 1
  if (props.verificationStatus === 'FLAG' || !props.hasResult) return 2
  if (!props.pagesComplete || !props.acknowledged) return 3
  return 4
}

export default function ShieldyAssistant(props: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'ask' | 'tour'>('ask')
  const [tourActive, setTourActive] = useState(false)
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<ReturnType<typeof answerHelpQuestion> | null>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const questionInput = useRef<HTMLInputElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const stepIndex = getStep(props)
  const step = tourSteps[stepIndex]
  const target = stepIndex === 3 ? (props.pagesComplete ? 'verification' : 'export-review') : stepIndex === 4 ? 'export-actions' : step.target
  const busy = props.phase !== 'ready'
  const statusMessage = props.verificationStatus === 'FLAG'
    ? 'Verification found remaining sensitive data. Download is blocked. Please review the selected regions and regenerate.'
    : props.phase === 'scanning'
      ? 'Your file is being analyzed on the configured server. Scanning is best effort.'
      : props.phase === 'processing'
        ? 'Your export is being generated and verified.'
        : stepIndex === 2
          ? props.findingCount + ' candidate(s) found. Each suggestion still needs your review.'
          : stepIndex === 3
            ? props.reviewedPages + ' of ' + props.pageCount + ' page(s) marked reviewed.' + (props.acknowledged ? '' : ' The final acknowledgement is still required.')
            : step.message

  useEffect(() => {
    if (!tourActive) return
    const node = document.getElementById(target)
    node?.setAttribute('data-shieldy-focus', 'true')
    return () => node?.removeAttribute('data-shieldy-focus')
  }, [tourActive, target])

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        launcher.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function dismiss() {
    setOpen(false)
    launcher.current?.focus()
  }
  function startTour() {
    setTourActive(true)
    setMode('tour')
    props.onNavigate(target)
  }
  function goToStep() {
    if (busy) return
    if (stepIndex === 0) props.onChooseFile()
    else props.onNavigate(target)
  }
  function ask(text: string) {
    const response = answerHelpQuestion(text)
    setReply(response)
    setQuestion('')
    setMode('ask')
  }
  const examples = stepIndex === 0 ? ['start', 'upload', 'private', 'aadhaar'] :
    stepIndex === 1 ? ['start', 'detect', 'aadhaar', 'faces'] :
      stepIndex === 2 ? ['mask', 'blur', 'detect', 'verify'] :
        ['download', 'verify', 'private', 'blur']
  const quickTopics = examples.map(id => helpTopics.find(topic => topic.id === id)).filter((topic): topic is typeof helpTopics[number] => Boolean(topic))

  return (
    <div className="shieldy-container">
      {open && <section id="shieldy-panel" className="shieldy-panel" role="dialog" aria-modal="false" aria-label="Shieldy offline help">
        <header className="shieldy-head">
          <span className="shieldy-avatar robot-avatar" aria-hidden="true"><ShieldyRobot variant="head" size={48} mood={props.verificationStatus === 'FLAG' ? 'alert' : busy ? 'thinking' : 'happy'}/></span>
          <div className="shieldy-identity"><strong>Shieldy <span className="shieldy-wave" aria-hidden="true">✦</span></strong><small><span className="shieldy-status-dot"/> Your offline privacy guide</small></div>
          <button type="button" ref={closeButton} className="shieldy-head-close" onClick={dismiss} aria-label="Close Shieldy help"><Icon name="close" size={18}/></button>
        </header>
        <div className="shieldy-tabs" role="group" aria-label="Shieldy help sections">
          <button type="button" className={mode === 'ask' ? 'active' : ''} aria-pressed={mode === 'ask'} onClick={() => setMode('ask')}><Icon name="info" size={15}/> Ask Shieldy</button>
          <button type="button" className={mode === 'tour' ? 'active' : ''} aria-pressed={mode === 'tour'} onClick={() => setMode('tour')}><Icon name="layers" size={15}/> Guided tour</button>
        </div>

        {mode === 'ask' ? <div className="shieldy-body">
          {!reply ? <div className="shieldy-welcome robot-welcome">
            <div className="shieldy-welcome-copy">
              <span className="shieldy-welcome-eyebrow"><Icon name="sparkle" size={13}/> YOUR LITTLE PRIVACY BUDDY</span>
              <h3>Hey there! I'm Shieldy 👋</h3>
              <p>I'm here to explain ShareShield in simple words. Ask a question or take a guided tour.</p>
            </div>
            <span className="shieldy-welcome-robot" aria-hidden="true"><ShieldyRobot size={116} mood={busy ? 'thinking' : props.verificationStatus === 'FLAG' ? 'alert' : 'happy'}/></span>
          </div> : <div className="shieldy-answer" role="status" aria-live="polite">
            <span className="shieldy-answer-kicker"><Icon name="sparkle" size={14}/> Shieldy explains</span>
            <strong>{reply.title}</strong>
            <p>{reply.response}</p>
            {reply.id === 'private' && <button className="shieldy-text-link" onClick={() => { props.onNavigate('privacy'); dismiss() }}>Read Privacy &amp; safety <Icon name="arrowRight" size={14}/></button>}
          </div>}
          <div className="shieldy-context"><span><Icon name={props.verificationStatus === 'FLAG' ? 'alert' : 'bolt'} size={15}/> Current step</span><p>{statusMessage}</p></div>
          <p className="shieldy-subhead">POPULAR QUESTIONS</p>
          <div className="shieldy-questions">
            {quickTopics.map(topic => <button type="button" key={topic.id} onClick={() => { setReply({ title: topic.label, response: topic.answer, id: topic.id }); setQuestion('') }}><span>{topic.label}</span><Icon name="chevronRight" size={14}/></button>)}
          </div>
          <button type="button" className="shieldy-start-tour" onClick={startTour}><Icon name="layers" size={17}/> Start guided tour <Icon name="arrowRight" size={16}/></button>
        </div> : <div className="shieldy-body shieldy-tour">
          <div className="shieldy-tour-heading">
            <span className="shieldy-tour-label">{tourActive ? 'GUIDED MODE ON' : 'GUIDED MODE'}</span>
            <span>Step {Math.min(stepIndex + 1, 5)} of 5</span>
          </div>
          <div className="shieldy-tour-track" aria-label={'Step ' + (stepIndex + 1) + ' of five'}>
            {tourSteps.map((item, index) => <span key={item.title} className={index < stepIndex ? 'done' : index === stepIndex ? 'current' : ''}/>)}
          </div>
          <div className="shieldy-tour-card">
            <span className="shieldy-tour-symbol shieldy-tour-robot" aria-hidden="true"><ShieldyRobot size={95} mood={props.verificationStatus === 'FLAG' ? 'alert' : busy ? 'thinking' : 'happy'}/></span>
            <h3>{props.verificationStatus === 'FLAG' ? 'Fix flagged information' : step.title}</h3>
            <p>{statusMessage}</p>
          </div>
          {tourActive && <p className="shieldy-tour-note"><Icon name="eye" size={15}/> The relevant workspace section is highlighted. The tour advances when you complete real steps—not when you press Next.</p>}
          {stepIndex === 0 && <button type="button" className="shieldy-sample" disabled={busy} onClick={() => { props.onDemo(); props.onNavigate('upload') }}><Icon name="file" size={16}/> Try fictional demo instead</button>}
          <button type="button" className="shieldy-primary" disabled={busy}
            onClick={tourActive ? goToStep : startTour}><Icon name={tourActive ? step.icon : 'sparkle'} size={16}/>{tourActive ? step.button : 'Start guided mode'}<Icon name="arrowRight" size={16}/></button>
          {tourActive && <button type="button" className="shieldy-skip" onClick={() => { setTourActive(false); setMode('ask') }}>Skip tour — I'll explore myself</button>}
          <p className="shieldy-safety"><Icon name="lock" size={13}/> I never select findings, redact, acknowledge checks or download files for you.</p>
        </div>}
        {mode === 'ask' && <form className="shieldy-ask-form" onSubmit={event => { event.preventDefault(); ask(question) }}>
          <label htmlFor="shieldy-question">Ask a question (no private details)</label>
          <div className="shieldy-input-wrap">
            <input id="shieldy-question" ref={questionInput} type="text" autoComplete="off" maxLength={180} value={question} onChange={event => setQuestion(event.target.value)}
              placeholder="e.g. How do I blur a face?" aria-label="Ask Shieldy a general question"/>
            <button type="submit" aria-label="Ask Shieldy"><Icon name="arrowRight" size={17}/></button>
          </div>
        </form>}
        <div className="shieldy-foot"><Icon name="lock" size={13}/> Rule-based help · No external AI or chat uploads</div>
      </section>}
      {!open && <span className="shieldy-nudge" aria-hidden="true">{tourActive ? 'Tour in progress' : 'Need a hand?'}</span>}
      <button ref={launcher} type="button" className={'shieldy-launcher robot-launcher ' + (open ? 'is-open' : '')}
        onClick={() => setOpen(x => !x)} aria-label={open ? 'Close Shieldy helper' : 'Open Shieldy helper'} aria-controls="shieldy-panel" aria-expanded={open}>
        <ShieldyRobot variant="head" size={76} mood={props.verificationStatus === 'FLAG' ? 'alert' : busy ? 'thinking' : 'happy'}/>
        {open && <span className="robot-launcher-close" aria-hidden="true"><Icon name="close" size={11}/></span>}
        {!open && <span className="shieldy-launcher-spark" aria-hidden="true">✦</span>}
      </button>
    </div>
  )
}
