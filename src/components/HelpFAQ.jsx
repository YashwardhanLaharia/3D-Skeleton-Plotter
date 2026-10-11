import { useEffect, useRef } from "react";
import { FAQ_ITEMS } from "../guideContent";
import { useHelpKeyboard } from "./GuideTour";

export default function HelpFAQ({ onClose }) {
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  useHelpKeyboard(panelRef, onClose);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <div className="help-faq-backdrop" data-guide-ui="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="help-faq-panel" role="dialog" aria-modal="true" aria-labelledby="help-faq-title">
        <header className="help-faq-heading">
          <div>
            <span className="help-tour-label">Skeleton Plotter help</span>
            <h2 ref={titleRef} tabIndex={-1} id="help-faq-title">Frequently asked questions</h2>
          </div>
          <button type="button" className="help-close" aria-label="Close FAQ" onClick={onClose}>×</button>
        </header>
        <div className="help-faq-body">
          <p className="text-body-secondary">Choose a question to read its answer. For a walkthrough of the controls, use Help → Guide.</p>
          {FAQ_ITEMS.map(([question, answer]) => (
            <details key={question} className="help-faq-item">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <footer className="help-faq-footer"><button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}
