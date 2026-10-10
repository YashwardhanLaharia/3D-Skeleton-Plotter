import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HELP_CATEGORIES, HELP_FAQS, HELP_SHORTCUTS } from "../helpContent.js";

export default function HelpCenter({ initialCategory = "all", onClose, onTutorial }) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    setCategory(initialCategory);
    setQuery("");
  }, [initialCategory]);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const siblings = Array.from(overlayRef.current.parentElement.children)
      .filter((element) => element !== overlayRef.current)
      .map((element) => ({ element, wasInert: element.inert }));
    for (const { element } of siblings) element.inert = true;
    searchRef.current.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const controls = Array.from(panelRef.current.querySelectorAll('button:not(:disabled), input, summary'))
          .filter((element) => element.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      for (const { element, wasInert } of siblings) element.inert = wasInert;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = (text) => terms.every((term) => text.toLocaleLowerCase().includes(term));
  const faqs = HELP_FAQS.filter((faq) => (category === "all" || faq.category === category)
    && matches([faq.question, ...faq.answer, faq.keywords].join(" ")));
  const shortcuts = category === "all" || category === "shortcuts"
    ? HELP_SHORTCUTS.filter((shortcut) => matches(`${shortcut.action} ${shortcut.keys}`)) : [];
  const modifier = /Mac/i.test(navigator.platform) ? "Command" : "Ctrl";
  const noResults = faqs.length === 0 && shortcuts.length === 0;

  return (
    <div ref={overlayRef} className="help-center-overlay" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={panelRef} className="help-center" role="dialog" aria-modal="true"
        aria-labelledby="help-center-title" aria-describedby="help-center-description">
        <header className="help-center-header">
          <button type="button" className="help-tour-close" aria-label="Close help" onClick={onClose}>×</button>
          <div className="help-tour-label">Skeleton Plotter help</div>
          <h2 id="help-center-title">Help & FAQ</h2>
          <p id="help-center-description">Answers for entering measurements, understanding the rig and keeping your work.</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onTutorial}>Start guided tutorial</button>
        </header>
        <div className="help-center-tools">
          <label htmlFor="help-search" className="form-label small fw-semibold">Search help</label>
          <div className="d-flex gap-2">
            <input ref={searchRef} id="help-search" type="search" className="form-control"
              placeholder="Try offset, missing bone or autosave" value={query}
              onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => {
              setQuery("");
              searchRef.current.focus();
            }}>Clear</button>}
          </div>
          <nav className="help-center-categories" aria-label="Help topics">
            {HELP_CATEGORIES.map((topic) => <button key={topic.id} type="button"
              className={`help-center-category ${category === topic.id ? "active" : ""}`}
              aria-pressed={category === topic.id} onClick={() => setCategory(topic.id)}>{topic.label}</button>)}
          </nav>
          <p className="help-center-count" role="status">
            {faqs.length} {faqs.length === 1 ? "answer" : "answers"}{shortcuts.length > 0 ? ` · ${shortcuts.length} shortcuts` : ""}
          </p>
        </div>
        <div className="help-center-results">
          {faqs.length > 0 && <section aria-labelledby="help-faq-heading">
            <h3 id="help-faq-heading">Frequently asked questions</h3>
            {faqs.map((faq) => <details key={faq.id} className="help-faq" data-faq={faq.id} open={terms.length > 0}>
              <summary>{faq.question}</summary>
              <div className="help-faq-answer">{faq.answer.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            </details>)}
          </section>}
          {shortcuts.length > 0 && <section className="help-shortcuts" aria-labelledby="help-shortcuts-heading">
            <h3 id="help-shortcuts-heading">Keyboard shortcuts</h3>
            <p>Use {modifier} for menu shortcuts on this computer.</p>
            <table className="table mb-0">
              <caption className="visually-hidden">Keyboard shortcuts for Skeleton Plotter</caption>
              <thead><tr><th scope="col">Action</th><th scope="col">Keys</th></tr></thead>
              <tbody>{shortcuts.map((shortcut) => <tr key={shortcut.action}>
                <th scope="row">{shortcut.action}</th>
                <td><kbd>{shortcut.keys.replace("{mod}", modifier)}</kbd></td>
              </tr>)}</tbody>
            </table>
          </section>}
          {noResults && <div className="help-center-empty">
            <h3>No matching help found</h3>
            <p>Try a shorter phrase such as “coordinates”, “offset” or “save”, or search all topics.</p>
            <button type="button" className="btn btn-outline-secondary" onClick={() => {
              setQuery("");
              setCategory("all");
              searchRef.current.focus();
            }}>Show all help</button>
          </div>}
        </div>
      </section>
    </div>
  );
}
