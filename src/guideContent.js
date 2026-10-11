// Guide and FAQ copy follows docs/user-guide.md (coordinates, rig and visibility).
export const PROJECT_STEP = {
  id: "project",
  target: ".startup-cards, .startup-dimensions",
  title: "Start with a project",
  copy: "Choose New project, enter the grave dimensions in metres and confirm. Choose Height above the grave floor for heights, or RL with the surveyed floor RL for reduced levels. You can also open an existing project. The guide continues when your project opens.",
};

export const GUIDE_STEPS = [
  {
    id: "individual",
    target: '[data-guide="add-individual"]',
    title: "Add an individual",
    copy: "Each individual has a separate skeleton and 25 landmark rows. Add individual creates a blank one and opens its coordinates. A new project already has one individual; you can use it and continue without adding another.",
  },
  {
    id: "group",
    target: '[data-guide="add-group"]',
    title: "Organise individuals into groups",
    copy: "Add group creates a group you can name. Assign individuals using the Group selector in each header. Groups organise the list and let you hide members together in Skeletons; they are separate from assigning individuals to surveyed graves.",
  },
  {
    id: "identity",
    individual: true,
    target: ".individual-header",
    title: "Label, colour and landmark count",
    copy: "Give this individual a useful label, choose its colour and select a group if needed. Click the header to expand its rows. The count shows complete X/Y/Z landmarks out of 25. A warning symbol means the reconstruction has problems to review.",
  },
  {
    id: "coordinates",
    individual: true,
    target: '[data-guide="coordinates"]',
    title: "Enter surveyed coordinates",
    copy: "Enter X, Y and Z in metres for each landmark. X runs left to right; Y runs front to back from the grave’s left-front corner. Z uses your project’s height or RL setting. Complete all three fields; leave unrecorded values blank, because zero is a real coordinate. Tab moves between fields; Enter or the up/down arrows move along an axis column.",
  },
  {
    id: "split",
    individual: true,
    target: '[data-guide="split-joint"]',
    title: "Record separated bone ends",
    copy: "Use the arrow beside a landmark when the adjoining bone ends were found apart. Superior keeps the original point for the bone above the joint; inferior records the start of the bone below it. These split points let displaced bones be positioned separately. Keep a shared point for connected ends.",
  },
  {
    id: "rig",
    target: '[data-guide="viewport"]',
    title: "How the skeleton rig works",
    copy: "The rig poses one adult template from your landmarks. A recorded landmark anchors the body (usually centre of head), and landmark pairs set body orientation and aim each bone. Limb bones stretch to fit their points; the skull and jaw keep the model’s size. Missing endpoints leave bones out. Torso shapes and bone twist still come from the template. Drag to orbit, use the camera dock’s joystick to pan and scroll to zoom.",
  },
  {
    id: "skeletons",
    target: '[data-guide="skeletons"]',
    title: "Show, hide and focus skeletons",
    copy: "The Skeletons count shows visible individuals out of the total. Click a row to hide or show it; a group name toggles its members. Double-click a row to focus alone, or use ⊙ to focus with the environment and Measurements. Exit returns to the overview. Hiding is temporary and affects visible exports; Save still includes everyone.",
  },
  {
    id: "settings",
    individual: true,
    target: '[data-guide="settings"]',
    title: "Open this individual’s settings",
    copy: "Click the highlighted gear beside the landmark count, or focus it and press Enter or Space. It opens Display and Offset all joints for this individual. Open it to continue to those controls.",
  },
  {
    id: "offset",
    individual: true,
    target: '[data-guide="offset"]',
    title: "Offset all joints",
    copy: "Enter a signed offset in metres, then Apply adds it to every joint of this individual, including both points of split joints. For example, X = 0.10 moves them 10 cm along X. Blank offset axes stay unchanged. On entered axes, blank joint values count as zero, so an offset can fill previously blank values. Review the result; Undo reverses it. You can continue without applying an offset.",
  },
  {
    id: "display",
    individual: true,
    target: '[data-guide="display"]',
    title: "Choose which torso parts to display",
    copy: "Hide pelvis removes the pelvis; Hide ribcage removes ribs and sternum; Hide shoulder blades removes both shoulder blades and collarbones. The template torso is always drawn, so these options help with partial or disarticulated remains. They leave coordinates intact, are saved in the project and can be undone.",
  },
  {
    id: "view",
    target: '[data-guide="view"]',
    title: "View the excavation context",
    copy: "View controls surveyed grave outlines and a site photograph. Import outlines through File → Import Grave Outline; load a photograph through View. Frame changes the camera to fit the grave or photograph. Check the survey reference and measured photograph placement before comparing them with your skeletons.",
  },
  {
    id: "history",
    target: '[data-guide="history"]',
    title: "Undo edits, save and export",
    copy: "Undo and Redo cover individual and group edits, including coordinates, offsets and Display options. Camera moves and temporary visibility are view controls. Save through File → Save or Save As. Export offers visible skeletons as CSV, a PNG screenshot or a GLB scene. Reopen Help → Guide to repeat this tour, or Help → FAQ for answers.",
  },
];

export const FAQ_ITEMS = [
  ["What units and Z reference should I use?", "All coordinates and offsets are metres. X/Y start at the grave’s left-front corner. Height Z is measured up from the floor. In RL mode, height = floor RL − recorded RL. Check or change the reference through Edit → Set Grave Dimensions. Changing the reference reinterprets existing numbers; it does not convert them."],
  ["Why does a bone disappear or show a warning?", "A bone needs both endpoints with complete X/Y/Z values. Leave missing values blank rather than entering zero. The warning list flags missing positioning data, identical endpoints, unusual lengths or an unreliable body orientation. Open the individual’s rows and review the recorded landmarks; focus it to inspect Measurements."],
  ["How accurate is the skeleton rig?", "Everyone uses the same adult template. Landmark pairs aim and scale limb bones, while body landmarks set the torso orientation and dimensions. One recorded landmark anchors the body, so connected bones can differ from their surveyed positions. Skull size, bone shape, spine curvature and twist are inherited from the model. Use recorded coordinates and Measurements for analysis."],
  ["When should I split a joint?", "Expand the arrow beside a landmark when the two adjoining bone ends were found at different positions. Superior is the end of the bone above; inferior is the start of the bone below. Splitting changes how adjoining bones are positioned. Use Undo to reverse an accidental split."],
  ["How do I move every joint together?", "Open the gear beside the individual’s landmark count and use Offset all joints. Apply adds each entered offset to that axis on every joint, including split points. Blank offset axes stay unchanged; blank joint values on entered axes count as zero and may become populated. Undo reverses the offset."],
  ["Why is a torso drawn for a partial individual?", "The torso has no landmarks of its own to mark it missing, so it is always drawn. In the individual’s gear menu, Display can hide pelvis, ribcage (with sternum), or shoulder blades (with collarbones). These choices are saved and undoable."],
  ["What is the difference between hiding and focusing?", "Click a Skeletons row to hide or show it. Double-click to focus alone; ⊙ focuses with the environment. Focus offers Measurements, Show environment and a Context slider for other skeletons. Exit or Escape leaves focus. Whole-skeleton hiding is temporary and is reset when reopening; Save includes hidden individuals."],
  ["How do groups work?", "Add group creates a named group; assign an individual through its header’s Group selector. A group name in Skeletons toggles all its members. Deleting a group leaves its individuals ungrouped and can be undone. Groups do not assign skeletons to surveyed graves."],
  ["What do Save and Export include?", "File → Save keeps the full project as CSV, including every individual, group, Display options and excavation context. Export → Visible skeletons (CSV) includes currently visible individuals. Screenshot saves a PNG; GLB saves the visible 3D scene. Save your project before leaving."],
];
