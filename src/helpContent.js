// User-facing answers based on docs/user-guide.md, docs/autosave.md,
// docs/client-import-errors.md and the rig/solver documentation.
export const HELP_CATEGORIES = [
  { id: "all", label: "All topics" },
  { id: "coordinates", label: "Coordinates & rigs" },
  { id: "viewing", label: "Viewing & groups" },
  { id: "files", label: "Files & recovery" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
];

export const HELP_FAQS = [
  {
    id: "coordinate-units", category: "coordinates",
    question: "What do X, Y and Z mean? What units should I enter?",
    answer: [
      "Enter coordinates in metres. X runs across the grave and Y runs along it. The local grid's horizontal origin is the left-front corner. Z uses the project's vertical reference: height above the grave floor, or RL (reduced level) measured down from the site datum.",
      "Complete all three fields for each recorded landmark. Leave unrecorded values blank. Zero is a real measurement, so entering 0 is different from leaving a field empty.",
    ], keywords: "input axes units survey blank missing measurements",
  },
  {
    id: "height-rl", category: "coordinates",
    question: "Why are skeletons at the wrong depth or upside down?",
    answer: [
      "Check Depth values (z) in the grave dimensions settings. Height means distance up from the grave floor. RL means distance down from the site datum, so larger RL values are deeper. An RL project also needs the measured grave floor RL; the app draws height as floor RL minus recorded RL.",
      "Use Edit → Set Grave Dimensions to check the reference. Changing height/RL changes how existing numbers are read; it does not convert those numbers. Grave dimensions and vertical-reference changes are not covered by Undo. Change the setting back if needed.",
    ], keywords: "vertical reference reduced level datum inverted reflected floor z",
  },
  {
    id: "missing-bone", category: "coordinates",
    question: "Why is a bone missing from the reconstruction?",
    answer: [
      "A bone needs complete coordinates for both of its endpoints. For example, the forearm needs elbow and wrist landmarks. If either point is incomplete, the bone is omitted. Zero-length endpoints cannot give a bone a direction.",
      "Check both landmark rows, including inferior values on split rows. Open the individual's warning list for details. Also check its Display options and whole-individual visibility in the Skeletons panel.",
    ], keywords: "invisible missing absent not drawn endpoint rig reconstruction",
  },
  {
    id: "landmark-count", category: "coordinates",
    question: "What does the 0/25 or 24/25 counter mean?",
    answer: [
      "The counter beside an individual's settings gear counts landmark rows with X, Y and Z filled in, out of 25. A partly entered row does not count as complete. The counter is not a count of bones and does not guarantee the reconstruction is valid; review warnings too.",
      "The separate Skeletons panel counter shows visible individuals / total individuals.",
    ], keywords: "count skeleton number completed landmarks",
  },
  {
    id: "split-joints", category: "coordinates",
    question: "How do I record a displaced bone or separated joint?",
    answer: [
      "Click the triangle beside the landmark to split its row. Superior is where the bone above the joint ends; inferior is where the bone below it starts. For a displaced femur, split the acetabulum row; split the knee too if the femur and tibia ends were found apart.",
      "The rig places affected bones independently between their own recorded endpoints. Later bones in that limb also need their own complete endpoints. Collapsing the row reconnects the joint at the superior point. Inferior values survive during the session, but are not saved while the row is collapsed.",
    ], keywords: "superior inferior detached disarticulated separated expanded triangle",
  },
  {
    id: "offset-joints", category: "coordinates",
    question: "What does Offset all joints do?",
    answer: [
      "Open the gear beside the individual's landmark counter. Under Offset all joints, enter signed amounts in metres and choose Apply. The app adds them to every joint of that individual, including split endpoints. X = 0.10 adds 10 cm to each X value. Blank offset axes stay unchanged.",
      "On an entered axis, a blank joint value counts as zero and becomes populated. This edits your recorded coordinates. Review the result and use Undo if needed. Positive Z increases height in a height project, but means deeper in an RL project.",
    ], keywords: "translate move all settings gear apply blank offset",
  },
  {
    id: "upright-torso", category: "coordinates",
    question: "Why is an upright torso shown for a blank or partial individual?",
    answer: [
      "The pelvis and ribcage can be drawn even when no landmarks position them. Without enough hip and shoulder information to determine body orientation, the torso may remain upright. It is not evidence that those parts were found in that position.",
      "For partial or disarticulated remains, use the individual's gear → Display to hide the pelvis, ribcage or shoulder blades. Hide shoulder blades also hides both collarbones. These settings preserve coordinates, can be undone and are saved with the project.",
    ], keywords: "rest pose model empty blank pelvis ribcage display settings",
  },
  {
    id: "rig-limits", category: "coordinates",
    question: "Why do hands, feet or the skull have an unexpected rotation?",
    answer: [
      "Two endpoints establish a bone's direction and measured distance, but do not establish its twist around its own axis. Palms, soles and skull roll can therefore differ from the burial. Hands and feet each move as a whole unit; individual fingers and toes are not posed from these landmarks.",
      "The skull and jaw retain the model's size. The spine's overall direction follows the recorded points, but its curve between them comes from the model. Compare the reconstruction with your field records and the Measurements panel.",
    ], keywords: "twist roll pose orientation scaling size rig limitations",
  },
  {
    id: "warnings", category: "coordinates",
    question: "What should I do about unusual lengths or reconstruction warnings?",
    answer: [
      "Expand the individual and open the warning list above its coordinates. Check endpoint triples for typos, swapped left/right landmarks, duplicated positions or a joint that should be split. Focus the individual to compare bone lengths in the Measurements panel with your field measurements.",
      "Unusual lengths are drawn as recorded, rather than corrected or capped. A warning asks you to review the data. Fix the recorded values only when your records support that correction.",
    ], keywords: "error warning implausible proportions coincident degenerate measurements",
  },
  {
    id: "groups", category: "viewing",
    question: "How do I add individuals and organise groups?",
    answer: [
      "Add individual creates another skeleton with its own coordinates, colour and label. Add group creates a group you can name. Choose that group from an individual's Group dropdown to assign it. Deleting a group leaves its individuals ungrouped.",
      "Groups organise your list. Assignments to surveyed graves are separate and are managed under View → Individuals in graves. Neither grouping nor grave assignment moves the recorded points.",
    ], keywords: "add skeleton label colour color group membership grave assignment",
  },
  {
    id: "focus", category: "viewing",
    question: "How do I inspect one skeleton and return to the full view?",
    answer: [
      "Use the focus control in Skeletons to frame an individual with faded surrounding context. Double-click the skeleton in the 3D view or its panel row to focus on it alone. The Measurements panel opens in focus.",
      "Show environment brings back surrounding skeletons, grave features and the photograph; Context sets how faded the other skeletons appear. Click Exit or press Esc to leave focus and return to the previous camera view. Press Esc again to clear selection.",
    ], keywords: "zoom camera isolate alone faded dim context measurements exit",
  },
  {
    id: "visibility", category: "viewing",
    question: "Why do hidden skeletons reappear when I reopen a project?",
    answer: [
      "Whole-individual visibility in the Skeletons panel is temporary view state and is not saved. All individuals appear again on reopening. Click their rows or a group visibility control to hide them again.",
      "The individual's gear → Display options are saved and can be undone. Save includes all individuals, including hidden ones; Export → Visible skeletons (CSV) omits hidden individuals.",
    ], keywords: "hide show visible visibility display saved reopened",
  },
  {
    id: "camera", category: "viewing",
    question: "How do I move the view without moving the skeletons?",
    answer: [
      "Drag in the 3D view to orbit and scroll to zoom. Click a skeleton to select it and reveal its sidebar entry. Focus it for a closer inspection, or use Frame beside a grave or photograph to bring that feature into view.",
      "Camera movement changes how you look at the scene. Offset all joints changes the recorded coordinates, so use the camera when you only want to inspect or reframe the view.",
    ], keywords: "orbit navigation viewport clipped zoom frame pan",
  },
  {
    id: "photograph", category: "viewing",
    question: "Why does the site photograph not line up with the skeletons?",
    answer: [
      "In View, open photograph settings and check its surveyed corners, rotation and height against the same local grid and vertical reference as the skeletons. Frame changes the camera, not the photograph's alignment. Grave dimensions do not rescale recorded points.",
      "Corner alignment uses bottom-left, bottom-right and top-left points with a nonzero area. It does not correct camera perspective. Use a rectified overhead photograph and measured corners. Focus alone hides the photograph; enable Show environment or exit focus to see it again.",
    ], keywords: "image overlay photo alignment corners grave survey floor perspective",
  },
  {
    id: "theme", category: "viewing",
    question: "How do I switch between light and dark mode?",
    answer: [
      "In the 3D overview, click the circular theme button beside View. If you are focused on an individual, exit focus first to reveal it. The app remembers your choice across restarts. The FAQ and guided tutorial use the same theme.",
    ], keywords: "theme dark light accessibility appearance",
  },
  {
    id: "save-export", category: "files",
    question: "Which file should I save to continue editing later?",
    answer: [
      "File → Save writes the editable project CSV. Save As writes it to another path. The project includes all individuals and their coordinates, groups, grave context, vertical reference, Display settings and a loaded photograph. Keep this CSV as your editable source.",
      "Export → Visible skeletons (CSV) includes only currently visible individuals. Screenshot produces a PNG of the view, and GLB produces a 3D scene. PNG and GLB do not replace the editable project CSV.",
    ], keywords: "file save as export csv png glb project reopen backup",
  },
  {
    id: "autosave", category: "files",
    question: "How do I recover an autosave, and what does it preserve?",
    answer: [
      "On Home, choose the entry under Autosave to restore the latest backup. Then use Save or Save As to keep it as a normal project. Autosave runs after edits and writes a separate backup rather than updating your project file.",
      "It preserves individuals, groups and grave dimensions. It does not preserve surveyed graves/outlines, photographs, camera state or the Height/RL reference. Check those after recovery and save manually for the full project. Projects in the same folder share one autosave backup; there is no backup history.",
    ], keywords: "recovery restore lost crash backup autosaved unsaved",
  },
  {
    id: "csv-errors", category: "files",
    question: "Why won't my CSV open or import?",
    answer: [
      "Use the error's row number to check a copy of the file. Start from a project saved by the app for the correct header and application identity row. Check exact landmark IDs, one row per individual/landmark and numeric coordinates using decimal points. Leave unknown measurements blank.",
      "Open project loads a complete project and its settings. File → Add Skeletons adds individuals to the current project using its existing vertical reference. If it reports a depth-reference mismatch, check Height/RL before interpreting the imported positions.",
    ], keywords: "import failed error invalid csv header format duplicate unknown joint application",
  },
  {
    id: "image-errors", category: "files",
    question: "Which photographs can I load?",
    answer: [
      "Use a valid PNG or JPEG no larger than 10 MB, at most 8192 pixels per side and within the 16-megapixel limit. Resize or re-export the original image if it is rejected; renaming an extension does not convert the format.",
      "One photograph is supported per project. The normal project Save embeds it in the CSV, so reopening the project does not depend on the original image path.",
    ], keywords: "png jpeg jpg image photo format size limit import rejected",
  },
  {
    id: "screenshot", category: "files",
    question: "Why does my exported screenshot crop the sides?",
    answer: [
      "Screenshot exports use a fixed 1920 × 1080 image. The camera keeps the view's vertical extent and fits a 16:9 frame, so a wider app window can lose content at the sides.",
      "Reframe or narrow the app window before exporting, and check the saved PNG. The sidebar and selection outline are not included in the screenshot.",
    ], keywords: "screenshot export png resolution cropped edges framing aspect ratio",
  },
];

export const HELP_SHORTCUTS = [
  { action: "Move between form controls", keys: "Tab / Shift+Tab" },
  { action: "Next coordinate row, same axis", keys: "Enter / Down" },
  { action: "Previous coordinate row, same axis", keys: "Up" },
  { action: "Leave focus / clear selection / close help", keys: "Esc" },
  { action: "Undo", keys: "{mod}+Z" },
  { action: "Redo", keys: "{mod}+Shift+Z" },
  { action: "Save project", keys: "{mod}+S" },
  { action: "Save project as", keys: "{mod}+Shift+S" },
  { action: "Open project", keys: "{mod}+O" },
  { action: "New project", keys: "{mod}+N" },
  { action: "Add skeletons from a file", keys: "{mod}+Shift+I" },
  { action: "Set grave dimensions and Height/RL", keys: "{mod}+G" },
];
