/**
 * Renders captured facts back into the docs' markdown sections.
 *
 * Table alignment is delegated to prettier rather than computed here, so generated tables line up
 * by the same rule as every other markdown file in the repo and cannot drift from it.
 */
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

  const word = lang === "en" ? (style === "backtick" ? "Fails" : "Failure") : "失败";
  const code = style === "backtick" ? `\`${fact.outcome.code}\`` : fact.outcome.code;
  const inner = note ? `${code}${lang === "en" ? ", " : "，"}${note}` : code;
  return `${word} (${inner})`;
}

/**
 * Conditions holding for every row of a section are suite-wide setup, not a distinguishing
 * precondition, so they are dropped — a column repeating "Issuer DefaultRipple enabled" on all
 * rows tells a reader nothing about why the rows differ.
 */
function discriminatingConditions(facts: BehaviorFact[]): (fact: BehaviorFact) => GivenCondition[] {
  // A condition that never varies across the section describes its setup, not any one row. Rows
  // carrying an explicit override are excluded from the tally, since they deliberately state a
  // narrower set and would otherwise make a genuinely constant condition look variable.
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

/**
 * Places conditions into the section's condition columns.
 *
 * A single column absorbs everything. Multiple columns each claim the conditions whose axis they
 * declare, so a value stays in its own column even when a row has nothing for a neighbouring one.
 */
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

  // Anything not claimed by an axed column goes to the first column that declared no axis.
  const spare = conditions.filter((c) => !claimed.has(c));
  return cells.map((cell, i) => {
    if (cell !== null) return cell;
    const column = columns[i];
    return spare.length > 0 ? join(spare) : (column?.empty?.[lang] ?? "-");
  });
}

export function renderSection(section: SectionConfig, facts: BehaviorFact[], lang: Lang): string {
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
  return parts.join("\n");
}

/** Formats a markdown fragment with the repo's prettier config, so table padding matches exactly. */
export async function formatMarkdown(markdown: string, target: string): Promise<string> {
  const config = await prettier.resolveConfig(target);
  return prettier.format(markdown, { ...config, parser: "markdown" });
}

export function loadFacts(kbPath: string): BehaviorFact[] {
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
