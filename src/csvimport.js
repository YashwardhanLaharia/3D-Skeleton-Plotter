function parseCsvLine(line) {
  const values = [];
  let value = "";
  let boo = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"' && boo && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
          boo  = !boo;
    } else if (character === "," && !boo) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

export function parseCsv(csvText) {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return { columns: [], rows: [] };

  const columns = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      columns.map((column, index) => [column, values[index] ?? ""]),
    );
  });

  return { columns, rows };
}

export async function importCsv() {
  const result = await window.electronAPI.importCsv();
  if (!result.ok) return result;

  return {
    ...result,
    ...parseCsv(result.text),
  };
}
