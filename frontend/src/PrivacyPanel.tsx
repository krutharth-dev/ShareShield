import Icon from './Icon'

export default function PrivacyPanel({ onClose }: { onClose: () => void }) {
  return (
    <section className="privacy-panel surface-card" id="privacy" aria-labelledby="privacy-title">
      <div className="privacy-panel-heading">
        <div>
          <span className="section-kicker">YOUR DATA · YOUR DECISION</span>
          <h2 id="privacy-title"><Icon name="lock" size={22}/> Privacy &amp; safety</h2>
          <p>A clear explanation of what this educational local prototype does with your files.</p>
        </div>
        <button className="icon-button" onClick={onClose} title="Close privacy information" aria-label="Close privacy information"><Icon name="close"/></button>
      </div>
      <div className="privacy-summary">
        <article><Icon name="upload" size={22}/><strong>You choose the files</strong><span>No WhatsApp or Gmail monitoring in this version.</span></article>
        <article><Icon name="monitor" size={22}/><strong>Processed by your server</strong><span>When started locally, files go to your own 127.0.0.1 server.</span></article>
        <article><Icon name="eye" size={22}/><strong>You review the result</strong><span>Automatic masking is never a guarantee of complete privacy.</span></article>
      </div>
      <details className="privacy-detail" open>
        <summary>What happens when I upload a file?</summary>
        <p>Only the files you explicitly select are sent to your configured ShareShield server to analyze, preview, redact and verify. The local demo processes these requests in memory and returns findings and exported content to your browser. If you host the server elsewhere, the files are transmitted to that server and are no longer strictly on-device.</p>
      </details>
      <details className="privacy-detail">
        <summary>What information is kept?</summary>
        <p>There are no ShareShield accounts or saved document histories in this prototype. Current files, previews and results can remain in the browser tab's memory during the session. Your Light/Dark/System preference is stored in this browser. Files and reports you download are saved on your computer until you remove them. Browser, operating-system, deployment and server-log behavior may vary.</p>
      </details>
      <details className="privacy-detail">
        <summary>Does it share my files with other services?</summary>
        <p>This version's application code does not intentionally send document contents to external AI, advertising or analytics services. It uses local OCR and visual detection libraries. We have not audited every library or every possible hosting environment. Only run the prototype on a trusted server.</p>
      </details>
      <details className="privacy-detail">
        <summary>How private is an exported document?</summary>
        <p>OCR, pattern recognition and face/QR proposals can miss information. A scoped verification result is not proof of complete sanitization. Use blackout for personal identifiers, inspect every page of the output, and avoid sharing if anything sensitive remains. Blurring or pixelating faces is not always irreversible.</p>
      </details>
      <p className="privacy-caution"><Icon name="alert" size={17}/> Use synthetic examples for demos. Do not upload real identity documents for presentation recordings. This is a prototype notice, not a legally reviewed privacy policy for a public product.</p>
      <div className="privacy-policy-footer"><a href="https://github.com/krutharth-dev/ShareShield/blob/integration/deployable-web-app/docs/PRIVACY_NOTICE.md" target="_blank" rel="noopener noreferrer">Read the full prototype privacy notice ↗</a><span>Last reviewed: October 2026</span></div>
    </section>
  )
}
