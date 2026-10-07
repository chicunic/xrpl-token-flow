/**
 * Per-section formatting for the generated docs.
 *
 * The existing tables are not uniform — column headers vary across sections, one section renders
 * failures as ``Fails (`code`)`` rather than `Failure (code)`, and MPT escrow carries an extra note
 * paragraph. Rather than infer any of that, each section declares it here so the generator can
 * reproduce the current files byte for byte.
 */
import type { Bilingual } from "../src/kb/types.js";

export interface ConditionColumn extends Bilingual {
  /**
   * Which predicate this column reports. Matched against a condition's `axis` tag; conditions
   * without a matching axis fall into the first unaxed column. Omit when the section has a single
   * condition column.
   */
  axis?: string;
  /** Rendered when no condition matches this column. */
  empty?: Bilingual;
  /**
   * Rendered when a condition does match. An axed column's header already names the variable, so
   * the cell only needs the value — "Enabled" rather than "Bob DepositAuth on".
   */
  present?: Bilingual;
}

export interface SectionConfig {
  /** Source test file, relative to the repo root. Links a section to its captured facts. */
  file: string;
  /** Which document this section belongs to. */
  doc: "trust-line-token" | "multi-purpose-token";
  /** Position within that document. */
  order: number;
  /** Section heading, excluding the trailing `(file.test.ts)`. */
  title: string;
  /** The paragraph under the heading, including any inline links. */
  intro: Bilingual;
  /** An extra paragraph between the intro and the table. */
  note?: Bilingual;
  /**
   * Column headers. `conditions` may be empty, or hold one or two entries.
   *
   * With a single condition column, every condition is joined into it. With several, each column
   * declares an `axis` naming the predicate it reports, so a condition always lands in the same
   * column regardless of the order the snapshot returned it in.
   */
  columns: {
    subject: Bilingual;
    conditions: ConditionColumn[];
    result: Bilingual;
  };
  /** `backtick` renders failures as ``Fails (`code`)``; `plain` as `Failure (code)`. */
  resultStyle?: "plain" | "backtick";
  /** The command shown in the trailing bash block. */
  command: string;
}

const OPERATION: Bilingual = { en: "Operation", zh: "操作" };
const CONDITION: Bilingual = { en: "Condition", zh: "条件" };
const EXPECTED: Bilingual = { en: "Expected", zh: "预期" };

export const SECTIONS: SectionConfig[] = [
  {
    file: "tests/specs/integration/trust-line-token/deep-freeze.test.ts",
    doc: "trust-line-token",
    order: 6,
    title: "Deep Freeze",
    intro: {
      en: "Tests [Deep Freeze (XLS-77)](https://xrpl.org/docs/concepts/tokens/fungible-tokens/deep-freeze): a deep-frozen holder can neither send nor receive the token, while a regular freeze only blocks sending.",
      zh: "测试 [Deep Freeze (XLS-77)](https://xrpl.org/docs/concepts/tokens/fungible-tokens/deep-freeze)：被深度冻结的持有者既不能发送也不能接收该代币，而普通冻结仅阻止发送。",
    },
    columns: { subject: OPERATION, conditions: [CONDITION], result: EXPECTED },
    command: "pnpm test deep-freeze",
  },
  {
    file: "tests/specs/integration/trust-line-token/credential-deposit-auth.test.ts",
    doc: "trust-line-token",
    order: 5,
    title: "Credential Deposit Auth",
    intro: {
      en: "Tests a stablecoin compliance flow using [Credentials (XLS-70)](https://xrpl.org/docs/references/protocol/transactions/types/credentialcreate): a DepositAuth-protected receiver only accepts payments from senders holding a valid KYC credential issued by the token issuer.",
      zh: "测试基于 [Credentials (XLS-70)](https://xrpl.org/docs/references/protocol/transactions/types/credentialcreate) 的稳定币合规流程：启用 DepositAuth 的收款方仅接受持有发行方签发的有效 KYC 凭证的付款方。",
    },
    columns: {
      subject: OPERATION,
      // The docs table names the credential state only; the DepositAuth flag is section-wide setup
      // stated in the intro, so it is not repeated per row.
      conditions: [{ en: "Condition", zh: "条件", axis: "credential" }],
      result: EXPECTED,
    },
    command: "pnpm test credential-deposit-auth",
  },
  {
    file: "tests/specs/integration/trust-line-token/deposit-auth.test.ts",
    doc: "trust-line-token",
    order: 8,
    title: "DepositAuth",
    intro: {
      en: "Tests the [DepositAuth](https://xrpl.org/docs/concepts/accounts/depositauth) flag.",
      zh: "测试 [DepositAuth](https://xrpl.org/docs/concepts/accounts/depositauth) 标志。",
    },
    columns: {
      subject: OPERATION,
      conditions: [
        {
          en: "Bob DepositAuth",
          zh: "Bob DepositAuth",
          axis: "bob.lsfDepositAuth",
          present: { en: "Enabled", zh: "已启用" },
          empty: { en: "Disabled", zh: "已禁用" },
        },
        {
          en: "DepositPreauth",
          zh: "DepositPreauth",
          axis: "bob.DepositPreauth",
          present: { en: "Alice preauthorized", zh: "Alice 已预授权" },
          empty: { en: "None", zh: "无" },
        },
      ],
      result: EXPECTED,
    },
    command: "pnpm test trust-line-token/deposit-auth",
  },
  {
    file: "tests/specs/integration/multi-purpose-token/lock.test.ts",
    doc: "multi-purpose-token",
    order: 4,
    title: "Lock/Unlock",
    intro: {
      en: "Tests [Lock](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuanceset) functionality.",
      zh: "测试 [Lock](https://xrpl.org/docs/references/protocol/transactions/types/mptokenissuanceset) 功能。",
    },
    columns: {
      subject: OPERATION,
      conditions: [{ en: "Lock Status", zh: "锁定状态" }],
      result: EXPECTED,
    },
    command: "pnpm test multi-purpose-token/lock",
  },
];

export function sectionFor(file: string): SectionConfig | undefined {
  return SECTIONS.find((s) => s.file === file);
}
