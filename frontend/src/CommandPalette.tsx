import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export type CommandAction = {
  id: string
  title: string
  description: string
  icon: string
  hint?: string
  disabled?: boolean
  run: () => void
}

export default function CommandPalette({
  open, onClose, actions,
}: { open: boolean; onClose: () => void; actions: CommandAction[] }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Focus after React renders the dialog, with no remote dependency.
    inputRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [open])
  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)')
    if (!nodes?.length) return
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  const matches = actions.filter(action => (action.title + ' ' + action.description).toLowerCase().includes(query.toLowerCase().trim()))
  function invoke(action: CommandAction) {
    if (action.disabled) return
    onClose()
    action.run()
  }
  if (!open) return null
  return (
    <div className="command-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="command-dialog" role="dialog" aria-modal="true" aria-label="ShareShield command menu" onKeyDown={trapFocus}>
        <div className="command-input-row">
          <Icon name="search" size={21}/>
          <input ref={inputRef} type="search" value={query} aria-label="Search workspace actions"
            onChange={event => { setQuery(event.target.value); setActiveIndex(0) }}
            onKeyDown={event => {
              if (event.key === 'Escape') { event.preventDefault(); onClose() }
              if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(i => Math.min(matches.length - 1, i + 1)) }
              if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)) }
              if (event.key === 'Enter' && matches[activeIndex] && !matches[activeIndex].disabled) {
                event.preventDefault(); invoke(matches[activeIndex])
              }
            }} placeholder="Where would you like to go?" />
          <button type="button" className="command-escape" onClick={onClose} aria-label="Close command menu">ESC</button>
        </div>
        <div className="command-list" role="group" aria-label="Available actions">
          <div className="command-list-label">QUICK ACTIONS</div>
          {matches.length === 0 && <p className="command-empty">No matches. Try “upload”, “review”, or “theme”.</p>}
          {matches.map((action, index) =>
            <button type="button" key={action.id} disabled={action.disabled}
              className={'command-result ' + (index === activeIndex ? 'selected' : '')}
              onMouseEnter={() => setActiveIndex(index)} onClick={() => invoke(action)}>
              <span className="command-result-icon"><Icon name={action.icon} size={18}/></span>
              <span className="command-result-text"><strong>{action.title}</strong><small>{action.description}</small></span>
              {action.hint && <kbd>{action.hint}</kbd>}
              <Icon name="arrowRight" size={15}/>
            </button>)}
        </div>
        <div className="command-bottom">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>↵</kbd> Select</span>
          <span>Private local workspace · No searches are sent online</span>
        </div>
      </section>
    </div>
  )
}
