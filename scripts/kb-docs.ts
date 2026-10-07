/**
 * Writes generated sections into the docs, replacing the hand-maintained tables.
 *
 * Only sections with captured facts are touched, so this can run while most of the suite is still
 * unmigrated. Run `kb:check` first — this overwrites committed documentation.
 */
import fs from "node:fs";
import path from "node:path";
import { type Lang, extractSection, formatMarkdown, loadFacts, renderSection } from "./kb-render.js";
import { SECTIONS } from "./kb-sections.js";

const ROOT = process.cwd();
const KB_PATH = path.join(ROOT, "docs/kb/behaviors.json");

const DOC_PATHS: Record<Lang, (doc: string) => string> = {
  en: (doc) => path.join(ROOT, `docs/${doc}.md`),
  zh: (doc) => path.join(ROOT, `docs/${doc}.zh-CN.md`),
};

async function main(): Promise<void> {
  const facts = loadFacts(KB_PATH);
  if (facts.length === 0) {
    console.error("No captured facts found. Run `pnpm kb:capture` first.");
    process.exit(1);
  }

  let written = 0;

  for (const section of SECTIONS) {
    const sectionFacts = facts.filter((f) => f.file === section.file);
    if (sectionFacts.length === 0) continue;

    for (const lang of ["en", "zh"] as const) {
      const docPath = DOC_PATHS[lang](section.doc);
      const current = extractSection(docPath, section.title, section.file);
      if (current === null) {
        console.log(`MISS  ${section.title} [${lang}] — section not found, skipping`);
        continue;
      }

      const generated = (await formatMarkdown(renderSection(section, sectionFacts, lang), docPath)).trimEnd();
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
