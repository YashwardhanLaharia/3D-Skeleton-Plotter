import {
  validateContour,
  validateContourReference,
} from "./graveContourData.js";

export function validateGraveRelations(graves) {
  const records = new Map(graves.map((grave) => [grave.id, grave]));
  if (records.size !== graves.length) throw new Error("Duplicate grave ID");
  for (const grave of graves) {
    const visited = new Set([grave.id]);
    let next = grave.cutsInto;
    while (next) {
      if (!records.has(next))
        throw new Error(
          "Choose an existing grave for the cuts-into relationship",
        );
      if (visited.has(next))
        throw new Error("Grave cutting relationships contain a cycle");
      visited.add(next);
      next = records.get(next).cutsInto;
    }
  }
}

export function importGraveContour(
  graves,
  { targetId, name, level, points, reference, keepOther = true },
) {
  if (!["top", "bottom"].includes(level))
    throw new Error("Choose top or base contour");
  const contour = validateContour(points);
  if (!contour.length) throw new Error("The imported contour is empty");
  const ref = validateContourReference(reference);
  let id = targetId;
  if (id === "new") {
    if (!name?.trim()) throw new Error("Enter a grave name");
    let count = 1;
    while (graves.some((grave) => grave.id === `grave-${count}`)) count++;
    id = `grave-${count}`;
    graves = [
      ...graves,
      {
        id,
        name: name.trim(),
        colour: ["#0072b2", "#d55e00", "#009e73", "#cc79a7"][graves.length % 4],
        cutsInto: null,
        notes: "",
        top: [],
        bottom: [],
      },
    ];
  } else if (!graves.some((grave) => grave.id === id))
    throw new Error("Choose an existing grave");
  return {
    id,
    graves: graves.map((grave) =>
      grave.id !== id
        ? grave
        : {
            ...grave,
            ...(!keepOther ? { top: [], bottom: [], references: {} } : {}),
            [level]: contour,
            references: {
              ...(keepOther ? grave.references : {}),
              [level]: ref,
            },
          },
    ),
  };
}
