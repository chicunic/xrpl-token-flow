/** Checks generated sections without writing; resolve any drift before running kb:docs. */
import path from "node:path";
import { documentPath, extractSection, loadFacts, renderSection } from "./kb-render.js";
import { SECTIONS } from "./kb-sections.js";

function unifiedDiff(expected: string, actual: string): string {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const lines: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined) lines.push(`  - ${a[i]}`);
    if (b[i] !== undefined) lines.push(`  + ${b[i]}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const facts = loadFacts();
  if (facts.length === 0) {
    console.error("No captured facts found. Run `pnpm kb:capture` first.");
    process.exit(1);
  }

  let checked = 0;
  let drifted = 0;

  for (const section of SECTIONS) {
    const sectionFacts = facts.filter((f) => f.file === section.file);
    if (sectionFacts.length === 0) {
      console.log(`SKIP  ${section.title} — no captured facts yet`);
      continue;
    }

    for (const lang of ["en", "zh"] as const) {
      const docPath = documentPath(section.doc, lang);
      const current = extractSection(docPath, section.title, section.file);
      if (current === null) {
        console.log(`MISS  ${section.title} [${lang}] — section not found in ${path.basename(docPath)}`);
        drifted++;
        continue;
      }

      const generated = await renderSection(section, sectionFacts, lang);
      checked++;

      if (generated === current) {
        console.log(`OK    ${section.title} [${lang}]`);
      } else {
        drifted++;
        console.log(`DRIFT ${section.title} [${lang}]`);
        console.log(unifiedDiff(current, generated));
      }
    }
  }

  console.log(`\n${String(checked - drifted)}/${String(checked)} sections match (${String(drifted)} drifted)`);
  if (drifted > 0) process.exit(1);
}

await main();
