import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HELP_STEPS, STARTUP_HELP_STEPS, positionTourPanel } from "../helpTour.js";

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]';

export default function HelpTour({ stepIndex, individualId, onNext, onBack, onClose, startup = false }) {
  const steps = startup ? STARTUP_HELP_STEPS : HELP_STEPS;
  const step = steps[stepIndex] ?? steps[0];
  const panelRef = useRef(null);
  const nextRef = useRef(null);
  const targetRef = useRef(null);
  const callbacks = useRef({ onNext, onClose });
  callbacks.current = { onNext, onClose };
  const [layout, setLayout] = useState({ rect: null, position: { left: 16, top: 16 }, ready: false });
  const lastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    const previousFocus = document.activeElement;
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    let frame;
    let advanced = false;
    let settingsWasClosed = false;
    let scrolledTarget = null;
    function measure() {
      const scope = step.individual
        ? Array.from(document.querySelectorAll('[data-tour-individual]'))
          .find((element) => element.dataset.tourIndividual === individualId)
        : document;
      const target = scope?.querySelector(step.target);
      targetRef.current = target ?? null;
      if (target && scrolledTarget !== target) {
        // Reveal collapsed/scrolled sections without changing any project data.
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        scrolledTarget = target;
      }
      const bounds = target?.getBoundingClientRect();
      let rect = bounds?.width && bounds?.height ? {
        left: Math.max(4, bounds.left - 5), top: Math.max(4, bounds.top - 5),
        right: Math.min(window.innerWidth - 4, bounds.right + 5),
        bottom: Math.min(window.innerHeight - 4, bounds.bottom + 5),
      } : null;
      // Clip the spotlight to the sidebar rather than lighting hidden content.
      const sidebar = target?.closest(".sidebar");
      if (sidebar && rect) {
        const clip = sidebar.getBoundingClientRect();
        rect.top = Math.max(rect.top, clip.top + 4);
        rect.bottom = Math.min(rect.bottom, clip.bottom - 4);
      }
      if (rect && (rect.bottom <= rect.top || rect.right <= rect.left)) rect = null;
      const panel = panelRef.current?.getBoundingClientRect() ?? { width: 356, height: 300 };
      const position = positionTourPanel(rect, panel,
        { width: window.innerWidth, height: window.innerHeight }, step.placement === "inside");
      const nextLayout = { rect, position, ready: true };
      setLayout((current) => JSON.stringify(current) === JSON.stringify(nextLayout) ? current : nextLayout);
      if (step.waitForSettings && target?.getAttribute("aria-expanded") === "false") settingsWasClosed = true;
      if (step.waitForSettings && settingsWasClosed && target?.getAttribute("aria-expanded") === "true" && !advanced) {
        advanced = true;
        callbacks.current.onNext();
      }
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.querySelector(".app-shell"), { childList: true, subtree: true, attributes: true });
    const resize = new ResizeObserver(schedule);
    if (panelRef.current) resize.observe(panelRef.current);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    measure();
    nextRef.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
    };
  }, [step, individualId]);

  useEffect(() => {
    function allowedFocus() {
      const target = step.interactive ? targetRef.current : null;
      const targetControls = target?.matches(FOCUSABLE)
        ? [target] : Array.from(target?.querySelectorAll(FOCUSABLE) ?? []);
      return [...targetControls, ...Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        callbacks.current.onClose();
      }
      if (event.key === "Tab") {
        const controls = allowedFocus();
        if (!controls.length) return;
        event.preventDefault();
        const index = controls.indexOf(document.activeElement);
        const next = index < 0 ? 0 : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        controls[next].focus({ preventScroll: true });
      }
    }
    function handleFocus(event) {
      if (!allowedFocus().includes(event.target)) nextRef.current?.focus({ preventScroll: true });
    }
    function handleWheel(event) {
      if (!panelRef.current?.contains(event.target)) event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("wheel", handleWheel);
    };
  }, [step]);

  const { rect, position } = layout;
  const masks = rect ? [
    { left: 0, top: 0, width: "100%", height: rect.top },
    { left: 0, top: rect.bottom, width: "100%", bottom: 0 },
    { left: 0, top: rect.top, width: rect.left, height: rect.bottom - rect.top },
    { left: rect.right, top: rect.top, right: 0, height: rect.bottom - rect.top },
    ...(!step.interactive ? [{ left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }] : []),
  ] : [{ inset: 0 }];

  return (
    <>
      {masks.map((style, index) => <div key={index} className="help-tour-mask" style={style} aria-hidden="true" />)}
      <div className={`help-tour-spotlight ${rect ? "" : "help-tour-spotlight-full"}`} aria-hidden="true"
        style={rect ? { left: rect.left, top: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top } : undefined} />
      <section ref={panelRef} className="help-tour-panel" role="dialog" aria-modal="false"
        aria-labelledby="help-tour-title" aria-describedby="help-tour-copy"
        data-step={step.id} data-placement={position.side}
        style={{ left: position.left, top: position.top, visibility: layout.ready ? "visible" : "hidden" }}>
        <button type="button" className="help-tour-close" aria-label="Close tutorial" onClick={onClose}>×</button>
        <div className="help-tour-label">Guided tutorial · Step {stepIndex + 1} of {steps.length}</div>
        <div aria-live="polite" aria-atomic="true">
          <h2 id="help-tour-title" className="help-tour-title">{step.title}</h2>
          <p id="help-tour-copy" className="help-tour-copy">{step.copy}</p>
        </div>
        {layout.ready && !rect && <p className="help-tour-hint">This control is currently unavailable. You can skip this step and reopen the tutorial when it is visible.</p>}
        {step.waitForSettings && rect && <p className="help-tour-hint">Waiting for you to open the highlighted settings gear.</p>}
        <progress className="help-tour-meter" value={stepIndex + 1} max={steps.length}
          aria-label={`Tutorial progress: step ${stepIndex + 1} of ${steps.length}`} />
        <div className="help-tour-footer">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onBack} disabled={stepIndex === 0}>Back</button>
          <button ref={nextRef} type="button" className="btn btn-primary btn-sm help-tour-next"
            onClick={lastStep ? onClose : onNext}>
            {lastStep ? "Done" : step.waitForSettings || !rect ? "Skip this step" : "Next"}
          </button>
        </div>
      </section>
    </>
  );
}
