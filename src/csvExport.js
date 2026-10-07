import { JOINTS } from "./joints.js";
import { validateProjectView } from "./projectView.js";
import {
  APPLICATION_ID,
  APPLICATION_LABEL,
  CSV_COLUMNS,
  VERTICAL_ROW_ID,
} from "./csvImport.js";
import { DEFAULT_VERTICAL } from "./sceneSpace.js";

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(
  individuals,
  projectGraveDimensions,
  groups = [],
  graveOutline = { top: [], bottom: [] },
  options = {},
  vertical = DEFAULT_VERTICAL,
) {
  const lines = [CSV_COLUMNS.join(",")];

  lines.push(
    [APPLICATION_ID, "", "", "", "", "", "", "", APPLICATION_LABEL]
      .map(escapeCsvCell)
      .join(","),
  );

  lines.push(
    [
      "grave_dimensions",
      "",
      projectGraveDimensions[0],
      projectGraveDimensions[1],
      projectGraveDimensions[2],
      "",
      "",
      "",
      "",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  // Height projects are written exactly as before the setting existed.
  if (vertical?.convention === "rl") {
    lines.push(
      [VERTICAL_ROW_ID, "", "", "", vertical.floorRL, "", "", "", "rl"]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  const graves = options.graves ?? [graveOutline];
  graves.forEach((grave) => {
    const graveId = options.graves ? grave.id : "";
    if (graveId)
      lines.push(
        [
          "grave",
          graveId,
          "",
          "",
          "",
          "",
          "",
          "",
          JSON.stringify({
            name: grave.name,
            colour: grave.colour,
            cutsInto: grave.cutsInto || null,
            notes: grave.notes || "",
          }),
        ]
          .map(escapeCsvCell)
          .join(","),
      );
    ["top", "bottom"].forEach((level) => {
      const points = grave?.[level] ?? [];
      const reference = grave?.references?.[level];
      if (reference && points.length) {
        lines.push(
          [
            "grave_outline_reference",
            level,
            "",
            "",
            "",
            "",
            "",
            "",
            JSON.stringify({ ...reference, ...(graveId ? { graveId } : {}) }),
          ]
            .map(escapeCsvCell)
            .join(","),
        );
      }

      points.forEach((point) => {
        lines.push(
          [
            "grave_outline",
            level,
            point.x ?? "",
            point.y ?? "",
            point.z ?? "",
            "",
            "",
            "",
            graveId,
          ]
            .map(escapeCsvCell)
            .join(","),
        );
      });
    });
  });
  if (options.view)
    lines.push(
      [
        "project_view",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        JSON.stringify(validateProjectView(options.view)),
      ]
        .map(escapeCsvCell)
        .join(","),
    );

  individuals.forEach((individual, individualIndex) => {
    const label = individual.label?.trim() || `Skeleton ${individualIndex + 1}`;
    if (individual.graveId)
      lines.push(
        [individual.id, "grave", "", "", "", "", "", "", individual.graveId]
          .map(escapeCsvCell)
          .join(","),
      );

    lines.push(
      [individual.id, "colour", "", "", "", "", "", "", individual.colour ?? ""]
        .map(escapeCsvCell)
        .join(","),
    );

    lines.push(
      [individual.id, "group", "", "", "", "", "", "", individual.groupId ?? ""]
        .map(escapeCsvCell)
        .join(","),
    );

    const groupName =
      groups.find((group) => group.id === individual.groupId)?.name ?? "";

    lines.push(
      [individual.id, "group_label", "", "", "", "", "", "", groupName]
        .map(escapeCsvCell)
        .join(","),
    );

    JOINTS.forEach((joint, index) => {
      const coordinates = individual.coords?.[joint.id] ?? {};
      const inferiorCoordinates = coordinates.inferior ?? {};

      const row = [
        individual.id,
        joint.id,
        coordinates.x ?? "",
        coordinates.y ?? "",
        coordinates.z ?? "",
        inferiorCoordinates.x ?? "",
        inferiorCoordinates.y ?? "",
        inferiorCoordinates.z ?? "",
        index === 0 ? label : "",
      ];

      lines.push(row.map(escapeCsvCell).join(","));
    });
  });

  return `${lines.join("\r\n")}\r\n`;
}

export async function exportCsv(
  individuals,
  projectGraveDimensions,
  groups,
  hidden,
  graveOutline = { top: [], bottom: [] },
  options = {},
  vertical = DEFAULT_VERTICAL,
) {
  console.log(hidden);

  const visibleIndividuals = individuals.filter(
    (individual) => !hidden.includes(individual.id),
  );

  return window.electronAPI.exportCsv(
    createCsv(
      visibleIndividuals,
      projectGraveDimensions,
      groups,
      graveOutline,
      options,
      vertical,
    ),
  );
}
