import { useEffect } from "react";

const HELP_STEPS = [
  {
    placement: "center",
    title: "Lorem ipsum dolor sit amet",
  },
  {
    placement: "beside-sidebar",
    backdrop: "sidebar-clear",
    title: "Lorem ipsum dolor sit amet",
  },
  {
    placement: "sidebar",
    backdrop: "viewport-clear",
    title: "Lorem ipsum dolor sit amet",
  },
  {
    placement: "center",
    title: "Lorem ipsum dolor sit amet",
  },
];

export default function HelpTour({ stepIndex, onNext, onClose }) {
  const step = HELP_STEPS[stepIndex];
  const isLastStep = stepIndex === HELP_STEPS.length - 1;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        className={`help-tour-backdrop ${step.backdrop ? `help-tour-backdrop-${step.backdrop}` : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        className={`help-tour-panel help-tour-panel-${step.placement}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-tour-title"
      >
        <button
          type="button"
          className="btn-close help-tour-close"
          aria-label="Close help"
          onClick={onClose}
        />

        <div className="help-tour-label">Help information</div>
        <h2 id="help-tour-title" className="help-tour-title">
          {step.title}
        </h2>
        <p className="help-tour-copy">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
          minim veniam, quis nostrud exercitation ullamco laboris nisi ut
          aliquip ex ea commodo consequat.
        </p>

        <div className="help-tour-footer">
          <span className="help-tour-progress" aria-label={`Step ${stepIndex + 1} of ${HELP_STEPS.length}`}>
            {stepIndex + 1}/{HELP_STEPS.length}
          </span>
          <button
            type="button"
            className="btn btn-primary help-tour-next"
            onClick={isLastStep ? onClose : onNext}
            autoFocus
          >
            {isLastStep ? "Done" : "Next"}
          </button>
        </div>
      </section>
    </>
  );
}
