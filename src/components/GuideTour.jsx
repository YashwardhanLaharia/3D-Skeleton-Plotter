import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { highlightRect, tourLayout } from "../helpTourLayout";

const FOCUSABLE = 'button, input, select, textarea, a[href], summary, [tabindex="0"]';

export function useHelpKeyboard(panelRef, onClose, findTarget) {
  useEffect(() => {
    const previousFocus = document.activeElement;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const target = findTarget?.();
      const controls = [...(target ? [target, ...target.querySelectorAll(FOCUSABLE)] : []), ...panelRef.current.querySelectorAll(FOCUSABLE)]
        .filter((element) => element.matches(FOCUSABLE) && !element.disabled && element.getClientRects().length);
      if (!controls.length) return;
      const current = controls.indexOf(document.activeElement);
      const next = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      event.preventDefault();
      event.stopPropagation();
      controls[next].focus();
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [panelRef, onClose, findTarget]);
}

export default function GuideTour({ step, stepIndex, stepCount, individualId, waiting, onBack, onNext, onClose }) {
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const [geometry, setGeometry] = useState(null);
  const findTargetRef = useRef(null);
  findTargetRef.current = () => {
    const scope = step.individual
      ? [...document.querySelectorAll("[data-guide-individual]")].find((element) => element.dataset.guideIndividual === individualId)
      : document;
    return scope?.querySelector(step.target) ?? null;
  };
  const stableFindTarget = useRef(() => findTargetRef.current()).current;
  useHelpKeyboard(panelRef, onClose, stableFindTarget);

  useLayoutEffect(() => {
    let frame;
    let target;
    let previousDescription;
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(panelRef.current);

    function releaseTarget() {
      if (!target) return;
      resizeObserver.unobserve(target);
      if (previousDescription === null) target.removeAttribute("aria-describedby");
      else target.setAttribute("aria-describedby", previousDescription);
    }

    function measure() {
      const nextTarget = findTargetRef.current();
      if (nextTarget !== target) {
        releaseTarget();
        target = nextTarget;
        if (target) {
          previousDescription = target.getAttribute("aria-describedby");
          target.setAttribute("aria-describedby", [previousDescription, "help-tour-copy"].filter(Boolean).join(" "));
          if (step.individual || step.id === "individual" || step.id === "group" || step.id === "history") {
            target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
          }
          resizeObserver.observe(target);
        }
      }
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = target?.getBoundingClientRect();
      const hole = highlightRect(rect, viewport);
      const position = tourLayout(hole, panelRef.current.getBoundingClientRect(), viewport);
      const next = { hole, position, viewport };
      setGeometry((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(document.querySelector(".app-shell"), { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-expanded"] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bs-theme"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      releaseTarget();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [step, individualId]);

  const positioned = Boolean(geometry);
  useEffect(() => {
    if (positioned) titleRef.current?.focus({ preventScroll: true });
  }, [step, positioned]);

  const hole = geometry?.hole;
  const viewport = geometry?.viewport;
  const shades = hole ? [
    { left: 0, top: 0, width: viewport.width, height: hole.top },
    { left: 0, top: hole.bottom, width: viewport.width, height: viewport.height - hole.bottom },
    { left: 0, top: hole.top, width: hole.left, height: hole.bottom - hole.top },
    { left: hole.right, top: hole.top, width: viewport.width - hole.right, height: hole.bottom - hole.top },
  ] : [{ inset: 0 }];

  return (
    <div className="help-tour" data-guide-ui="true">
      {shades.map((style, index) => <div key={index} className="help-tour-shade" style={style} aria-hidden="true" />)}
      {hole && <div className="help-tour-highlight" aria-hidden="true" style={{ left: hole.left, top: hole.top, width: hole.right - hole.left, height: hole.bottom - hole.top }} />}
      <section ref={panelRef} className="help-tour-panel" style={{ ...geometry?.position, visibility: geometry ? "visible" : "hidden" }} role="dialog" aria-modal="false" aria-labelledby="help-tour-title" aria-describedby="help-tour-copy">
        <div className="help-tour-heading">
          <span className="help-tour-label">Skeleton Plotter guide</span>
          <button type="button" className="help-close" aria-label="Close guide" onClick={onClose}>×</button>
        </div>
        <h2 ref={titleRef} tabIndex={-1} id="help-tour-title">{step.title}</h2>
        <p id="help-tour-copy">{step.copy}</p>
        {waiting && <p className="help-tour-prompt" role="status">{step.id === "project" ? "Create or open a project to continue." : "Click the highlighted settings gear to continue."}</p>}
        <footer className="help-tour-footer">
          <span className="help-tour-progress" aria-live="polite" aria-atomic="true">Step {stepIndex + 1} of {stepCount}</span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={stepIndex === 0 || step.id === "individual"} onClick={onBack}>Back</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={waiting} onClick={stepIndex === stepCount - 1 ? onClose : onNext}>{stepIndex === stepCount - 1 ? "Done" : "Next"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
