// Copy follows docs/user-guide.md, docs/data-formats/joint-coordinates.md,
// src/solver/README.md and src/rig/README.md. Targets are scoped to one individual.
export const HELP_STEPS = [
  {
    id: "add-individual", target: '[data-tour="add-individual"]',
    title: "Add an individual",
    copy: "Start a separate skeleton with Add individual. Each individual has its own coordinates, colour and rig, so editing one does not change another. This tour highlights the controls without changing your data.",
  },
  {
    id: "add-group", target: '[data-tour="add-group"]',
    title: "Organise individuals into groups",
    copy: "Add group creates a group you can name. Choose it from an individual's Group dropdown to move that individual into it. Groups organise skeletons; they are separate from surveyed grave assignments.",
  },
  {
    id: "individual", target: ".individual-header", individual: true,
    title: "Label, colour and landmark count",
    copy: "Click an individual's header to expand its coordinate table and select its skeleton. Give it a label, choose its colour and assign a group. The counter shows complete landmarks out of 25; it is not the number of skeletons.",
  },
  {
    id: "coordinates", target: ".joint-coordinate-row", individual: true,
    title: "Enter X, Y and Z coordinates",
    copy: "Enter surveyed coordinates in metres. X and Y locate the landmark across and along the site grid. Z is height above the grave floor or RL below the datum, depending on your project setting. All three values are needed. Leave missing measurements blank: zero is a real coordinate. Tab moves between fields; Enter or Down moves down the same axis column.",
  },
  {
    id: "split", target: ".joint-expand", individual: true,
    title: "Record separate bone ends",
    copy: "Use the triangle beside a landmark to split it when adjacent bone ends were found apart. Superior records the end of the bone above the joint; inferior records the start of the bone below it. The rig places displaced bones independently from their recorded endpoints.",
  },
  {
    id: "rig", target: ".viewport-wrap", placement: "inside",
    title: "How the skeleton rig works",
    copy: "The rig reconstructs each individual from its complete landmarks. For example, elbow and wrist coordinates give a forearm its direction and measured length. Connected bones are posed together; displaced bones are placed separately. Bones without both endpoints are omitted. Two endpoints cannot determine a bone's exact twist. Check the warning list in the sidebar when a reconstruction looks unexpected.",
  },
  {
    id: "settings", target: ".individual-settings-btn", individual: true, interactive: true,
    title: "Open the individual's settings",
    copy: "Click the highlighted gear beside the 25-landmark counter. It opens Display and Offset all joints for this individual. You can also Tab to the gear and press Enter or Space. The tour continues when you open it.",
    waitForSettings: true,
  },
  {
    id: "display", target: '[data-tour="display"]', individual: true,
    title: "Display: hide parts of the anatomy",
    copy: "Hide pelvis removes the pelvis from view. Hide ribcage hides the ribs and sternum. Hide shoulder blades hides both shoulder blades and both collarbones. These options help with partial or disarticulated remains, where an unpositioned torso can be misleading. They preserve coordinates, are saved with the project and can be undone.",
  },
  {
    id: "offset", target: '[data-tour="offset"]', individual: true,
    title: "Offset all joints: move recorded points",
    copy: "Enter a signed offset in metres, then Apply adds it to every joint of this individual, including split endpoints. For example, X = 0.10 adds 10 cm to every X value. Leave an offset axis blank to keep it unchanged. On entered axes, blank joint values count as zero and become populated. This changes your recorded coordinates; review the result and use Undo if needed. A positive Z raises height values but makes RL values deeper.",
  },
  {
    id: "camera", target: ".viewport-wrap", placement: "inside",
    title: "Explore the 3D view",
    copy: "Drag in the 3D view to orbit and scroll to zoom. Click a skeleton to select it and reveal its sidebar entry. Double-click it to focus on it alone. Camera movement changes your view, so you can inspect the reconstruction without editing the measured coordinates.",
  },
  {
    id: "view", target: ".graves-panel",
    title: "View: grave outlines and photographs",
    copy: "Expand View to import and manage surveyed grave contours or load a site photograph. Frame a grave to bring it into view, and use its visibility control to show or hide it. Use photograph settings to align the image with your survey reference.",
  },
  {
    id: "skeletons", target: ".layers-panel",
    title: "Show, hide and focus on skeletons",
    copy: "Skeletons lists individuals and groups. Click a row to show or hide an individual; a group visibility control affects its members. The count is visible individuals / total individuals. Use the focus control to inspect one with faded context, or double-click its row to focus alone. Exit or Esc returns to your previous view. Whole-individual visibility is not saved.",
  },
  {
    id: "theme", target: ".viewport-theme-toggle", interactive: true,
    title: "Choose light or dark mode",
    copy: "Click this button to switch between light and dark mode. Your choice is remembered across restarts. The tutorial's text, buttons and highlight adapt to either theme. Try switching now, then select Done to finish. You can reopen this guide from Help → Tutorial.",
  },
];

export const STARTUP_HELP_STEPS = [{
  id: "home", target: ".startup-cards, .startup-dimensions",
  title: "Start with a project",
  copy: "Choose New project to set grave dimensions in metres and choose how to read Z: height above the floor or RL below the datum. Open project resumes a saved CSV; Home also offers recent projects and autosave recovery. Once your project is open, choose Help → Tutorial for a guided tour of coordinate entry, groups, rigs, Display and offsets.",
}];

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// Keep the callout next to its target and within the window on either side.
export function positionTourPanel(rect, panel, viewport, inside = false) {
  const gap = 16;
  const maxX = Math.max(gap, viewport.width - panel.width - gap);
  const maxY = Math.max(gap, viewport.height - panel.height - gap);
  if (!rect) return { left: maxX / 2, top: maxY / 2, side: "center" };
  if (inside) return {
    left: clamp(rect.left + gap, gap, maxX),
    top: clamp(rect.bottom - panel.height - gap, gap, maxY), side: "inside",
  };
  const candidates = [
    { left: rect.right + gap, top: clamp(rect.top, gap, maxY), side: "right" },
    { left: rect.left - panel.width - gap, top: clamp(rect.top, gap, maxY), side: "left" },
    { left: clamp(rect.left, gap, maxX), top: rect.bottom + gap, side: "bottom" },
    { left: clamp(rect.left, gap, maxX), top: rect.top - panel.height - gap, side: "top" },
  ];
  return candidates.find(({ left, top }) => left >= gap && top >= gap && left <= maxX && top <= maxY)
    ?? { left: clamp(rect.left, gap, maxX), top: clamp(rect.bottom + gap, gap, maxY), side: "inside" };
}
