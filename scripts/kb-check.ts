/**
 * Diffs generated sections against the committed docs without writing anything.
 *
 * Runs before the generator is ever allowed to overwrite the docs: any difference is either a
 * generator bug or a real drift between what the tests verify and what the docs claim, and both
 * deserve a human decision rather than a silent rewrite.
 */
import path from "node:path";
import { type Lang, extractSection, formatMarkdown, loadFacts, renderSection } from "./kb-render.js";
import { SECTIONS } from "./kb-sections.js";

const ROOT = process.cwd();
const KB_PATH = path.join(ROOT, "docs/kb/behaviors.json");

const DOC_PATHS: Record<Lang, (doc: string) => string> = {
  en: (doc) => path.join(ROOT, `docs/${doc}.md`),
  zh: (doc) => path.join(ROOT, `docs/${doc}.zh-CN.md`),
};

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
  const facts = loadFacts(KB_PATH);
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
      const docPath = DOC_PATHS[lang](section.doc);
      const current = extractSection(docPath, section.title, section.file);
      if (current === null) {
        console.log(`MISS  ${section.title} [${lang}] — section not found in ${path.basename(docPath)}`);
        drifted++;
        continue;
      }

      const generated = (await formatMarkdown(renderSection(section, sectionFacts, lang), docPath)).trimEnd();
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
