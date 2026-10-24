import Icon from './Icon'

/**
 * Decorative, fictional document illustration. It never renders actual uploaded
 * content or claims that a real document has been safely sanitized.
 */
export default function HeroVisual({
  busy, findings, hasAnalysis,
}: { busy: boolean; findings: number; hasAnalysis: boolean }) {
  return (
    <div className={'hero-showcase' + (busy ? ' is-scanning' : '')} aria-hidden="true">
      <span className="showcase-halo halo-one" />
      <span className="showcase-halo halo-two" />
      <span className="showcase-grid" />
      <div className="showcase-floating showcase-float-top">
        <span className="showcase-float-icon"><Icon name="shield" size={15}/></span>
        <div><strong>Privacy control</strong><small>You're in charge</small></div>
        <span className="showcase-float-signal" />
      </div>
      <div className="showcase-document">
        <div className="showcase-doc-head">
          <span className="showcase-doc-logo"><Icon name="file" size={16}/></span>
          <div><strong>DOCUMENT PREVIEW</strong><small>Illustrative example</small></div>
          <span className="showcase-doc-dots"><i/><i/><i/></span>
        </div>
        <div className="showcase-sheet">
          <div className="sheet-heading" />
          <div className="sheet-text long" />
          <div className="sheet-text medium" />
          <div className="sheet-group">
            <span className="sheet-label">PERSONAL DETAILS</span>
            <div className="sheet-redacted"><span className="redaction-lock"><Icon name="lock" size={11}/></span><span className="redaction-block"/></div>
            <div className="sheet-redacted small"><span className="redaction-lock"><Icon name="lock" size={11}/></span><span className="redaction-block"/></div>
          </div>
          <div className="sheet-text long bottom-line" />
          <div className="sheet-text short" />
        </div>
        {busy && <div className="showcase-scanbeam" />}
        <div className="showcase-doc-footer">
          <span className="showcase-footer-icon"><Icon name="scan" size={14}/></span>
          <span>{busy ? 'Analyzing selected file' : 'A glimpse of manual review'}</span>
          <span className="showcase-footer-dots"><i/><i/><i/></span>
        </div>
      </div>
      <div className="showcase-floating showcase-float-bottom">
        <span className="showcase-chip-icon"><Icon name={busy ? 'scan' : 'checkCircle'} size={18}/></span>
        <div><strong>{busy ? 'Processing locally' : hasAnalysis ? findings + ' candidate' + (findings === 1 ? '' : 's') + ' found' : 'Review before sharing'}</strong>
          <small>{hasAnalysis ? 'Review manually' : 'You make the final call'}</small></div>
      </div>
      <span className="showcase-spark spark-one"/>
      <span className="showcase-spark spark-two"/>
      <span className="showcase-spark spark-three"/>
    </div>
  )
}
