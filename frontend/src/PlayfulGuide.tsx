import Icon from './Icon'
import ShieldyRobot from './ShieldyRobot'

type GuideStage = 'pick' | 'scan' | 'working' | 'review' | 'check' | 'download' | 'blocked'

const stages: Record<GuideStage, { eyebrow: string; headline: string; message: string; button: string; icon: string }> = {
  pick: { eyebrow: 'YOUR PRIVACY SIDEKICK', headline: "Hey, I'm Shieldy!", message: 'Start with a fictional demo file or pick your own. Three easy moments: pick it, cover it, check it.', button: 'Choose a file', icon: 'upload' },
  scan: { eyebrow: 'NICE START!', headline: 'Your file is ready.', message: 'Choose what to look for, then scan. You can always review and change the suggestions.', button: 'Go to scan', icon: 'scan' },
  working: { eyebrow: 'IN PROGRESS', headline: 'Working on your document…', message: 'The local ShareShield server is doing its thing. No made-up progress percentages here.', button: '', icon: 'scan' },
  review: { eyebrow: 'YOUR TURN', headline: 'Spot, select, protect.', message: 'Check the highlighted findings. Missing something? Draw a mask over that region yourself.', button: 'Review findings', icon: 'eye' },
  check: { eyebrow: 'ALMOST THERE', headline: 'One last look matters.', message: 'Check every exported page and acknowledge the limits. We will guide you to the remaining steps.', button: 'Finish review', icon: 'checkCircle' },
  download: { eyebrow: 'READY FOR YOUR DECISION', headline: 'Your reviewed copy is ready.', message: 'The required page review is complete. Save your copy, and remember: automated detection has limits.', button: 'Go to download', icon: 'download' },
  blocked: { eyebrow: 'CAREFUL — RISK DETECTED', headline: "Let's fix what remains.", message: 'Verification detected sensitive content in the output. Export is blocked. Adjust your selections and generate it again.', button: 'Fix detections', icon: 'alert' },
}

export default function PlayfulGuide({ stage, onAction }: { stage: GuideStage; onAction: () => void }) {
  const content = stages[stage]
  const currentStep = stage === 'pick' || stage === 'scan' ? 1 : stage === 'working' || stage === 'review' || stage === 'blocked' ? 2 : 3
  return (
    <section className={'playful-guide guide-' + stage} aria-label="Your next step">
      <div className="guide-mascot guide-robot" aria-hidden="true">
        <ShieldyRobot size={96} mood={stage === 'blocked' ? 'alert' : stage === 'working' ? 'thinking' : 'happy'}/>
      </div>
      <div className="guide-copy">
        <span className="guide-kicker"><Icon name="sparkle" size={14}/>{content.eyebrow}</span>
        <h2>{content.headline}</h2>
        <p>{content.message}</p>
        <div className="guide-progress" aria-label={'Guide step ' + currentStep + ' of 3'}>
          {['Pick a file', 'Protect details', 'Check & save'].map((label, index) =>
            <span className={index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'current' : ''} key={label}>
              {index + 1 < currentStep ? <Icon name="check" size={12}/> : String(index + 1)}
              <small>{label}</small>
            </span>)}
        </div>
      </div>
      {content.button && <button type="button" className="guide-action" onClick={onAction}>
        {content.button} <Icon name={content.icon === 'alert' ? 'arrowLeft' : 'arrowRight'} size={17}/>
      </button>}
    </section>
  )
}
