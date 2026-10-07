/** Replaces sections backed by captured facts; run kb:check and resolve drift before writing. */
import fs from "node:fs";
import { documentPath, extractSection, loadFacts, renderSection } from "./kb-render.js";
import { SECTIONS } from "./kb-sections.js";

async function main(): Promise<void> {
  const facts = loadFacts();
  if (facts.length === 0) {
    console.error("No captured facts found. Run `pnpm kb:capture` first.");
    process.exit(1);
  }

  let written = 0;

  for (const section of SECTIONS) {
    const sectionFacts = facts.filter((f) => f.file === section.file);
    if (sectionFacts.length === 0) continue;

    for (const lang of ["en", "zh"] as const) {
      const docPath = documentPath(section.doc, lang);
      const current = extractSection(docPath, section.title, section.file);
      if (current === null) {
        console.log(`MISS  ${section.title} [${lang}] — section not found, skipping`);
        continue;
      }

      const generated = await renderSection(section, sectionFacts, lang);
      if (generated === current) {
        console.log(`SAME  ${section.title} [${lang}]`);
        continue;
      }

      const content = fs.readFileSync(docPath, "utf8");
      fs.writeFileSync(docPath, content.replace(current, generated));
      written++;
      console.log(`WROTE ${section.title} [${lang}]`);
    }
  }

  console.log(`\n${String(written)} section(s) updated`);
}

await main();
