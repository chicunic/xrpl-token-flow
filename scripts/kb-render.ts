/** Renders captured facts as Markdown sections, using Prettier for consistent table alignment. */
import fs from "node:fs";
import path from "node:path";
import * as prettier from "prettier";
import type { BehaviorFact, GivenCondition } from "../src/kb/types.js";
import type { ConditionColumn, SectionConfig } from "./kb-sections.js";

export type Lang = "en" | "zh";

function resultCell(fact: BehaviorFact, lang: Lang, style: SectionConfig["resultStyle"]): string {
  const note = fact.outcome.note?.[lang];

  if (fact.outcome.kind === "success") {
    const base = lang === "en" ? "Success" : "成功";
    return note ? `${base} (${note})` : base;
  }

  let word = "失败";
  if (lang === "en") word = style === "backtick" ? "Fails" : "Failure";
  const code = style === "backtick" ? `\`${fact.outcome.code}\`` : fact.outcome.code;
  const inner = note ? `${code}${lang === "en" ? ", " : "，"}${note}` : code;
  return `${word} (${inner})`;
}

/** Omits conditions shared by all ledger-backed facts so each row highlights what differs. */
function discriminatingConditions(facts: BehaviorFact[]): (fact: BehaviorFact) => GivenCondition[] {
  // Exclude manual overrides from the tally because they may omit suite-wide conditions.
  const tallied = facts.filter((f) => f.given.some((g) => g.source === "ledger"));
  const counts = new Map<string, number>();
  for (const fact of tallied) {
    for (const key of new Set(fact.given.map((g) => g.en))) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const constant = new Set([...counts].filter(([, n]) => n === tallied.length).map(([key]) => key));

  return (fact) => fact.given.filter((g) => !constant.has(g.en));
}

/** A single column holds all conditions; multiple columns match conditions by axis. */
function conditionCells(conditions: GivenCondition[], lang: Lang, columns: ConditionColumn[]): string[] {
  if (columns.length === 0) return [];

  const join = (items: GivenCondition[]): string => items.map((c) => c[lang]).join(lang === "en" ? "; " : "；");

  if (columns.length === 1) {
    const only = columns[0];
    return [conditions.length > 0 ? join(conditions) : (only?.empty?.[lang] ?? "")];
  }

  const claimed = new Set<GivenCondition>();
  const cells = columns.map((column) => {
    if (column.axis === undefined) return null;
    const matched = conditions.filter((c) => c.axis === column.axis);
    matched.forEach((c) => claimed.add(c));
    if (matched.length === 0) return column.empty?.[lang] ?? "-";
    // A manual condition states its own wording; `present` only overrides derived phrasing.
    const derived = matched.every((c) => c.source === "ledger");
    return derived && column.present ? column.present[lang] : join(matched);
  });

  // Columns without an axis receive the unclaimed conditions.
  const spare = conditions.filter((c) => !claimed.has(c));
  return cells.map((cell, i) => {
    if (cell !== null) return cell;
    const column = columns[i];
    return spare.length > 0 ? join(spare) : (column?.empty?.[lang] ?? "-");
  });
}

export function documentPath(doc: SectionConfig["doc"], lang: Lang): string {
  const suffix = lang === "zh" ? ".zh-CN" : "";
  return path.resolve("docs", `${doc}${suffix}.md`);
}

export async function renderSection(section: SectionConfig, facts: BehaviorFact[], lang: Lang): Promise<string> {
  const heading = `### ${section.title} (\`${path.basename(section.file)}\`)`;
  const parts = [heading, "", section.intro[lang], ""];

  if (section.note) parts.push(section.note[lang], "");

  if (facts.length > 0) {
    const conditionsOf = discriminatingConditions(facts);
    const headers = [
      section.columns.subject[lang],
      ...section.columns.conditions.map((c) => c[lang]),
      section.columns.result[lang],
    ];
    parts.push(`| ${headers.join(" | ")} |`);
    parts.push(`| ${headers.map(() => "---").join(" | ")} |`);

    for (const fact of facts) {
      const cells = [
        fact.when[lang],
        ...conditionCells(conditionsOf(fact), lang, section.columns.conditions),
        resultCell(fact, lang, section.resultStyle),
      ];
      parts.push(`| ${cells.join(" | ")} |`);
    }
    parts.push("");
  }

  parts.push("```bash", section.command, "```");
  const config = await prettier.resolveConfig(documentPath(section.doc, lang));
  return (await prettier.format(parts.join("\n"), { ...config, parser: "markdown" })).trimEnd();
}

export function loadFacts(kbPath = path.resolve("docs/kb/behaviors.json")): BehaviorFact[] {
  if (!fs.existsSync(kbPath)) return [];
  const kb = JSON.parse(fs.readFileSync(kbPath, "utf8")) as { facts: BehaviorFact[] };
  return kb.facts.filter((f) => f.visibility === "public");
}

/** Extracts a section's current text from a doc, so generated output can be diffed against it. */
export function extractSection(docPath: string, title: string, testFile: string): string | null {
  const content = fs.readFileSync(docPath, "utf8");
  const heading = `### ${title} (\`${path.basename(testFile)}\`)`;
  const start = content.indexOf(heading);
  if (start === -1) return null;

  const rest = content.slice(start + heading.length);
  const next = rest.indexOf("\n### ");
  const body = next === -1 ? rest : rest.slice(0, next);
  return (heading + body).trimEnd();
}
