/**
 * Bilingual phrasing for ledger predicates.
 *
 * Shared across all facts, so a condition like "freeze + deep freeze" is worded once here rather
 * than retyped at every assertion site. This table is what keeps the generated docs' condition
 * columns consistent between the English and Chinese versions.
 */
import type { Bilingual, LedgerPredicate } from "@/kb/types.js";

/** Human-facing role names. Roles are lowercase identifiers in test code ("issuer", "alice"). */
function roleEn(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const ROLE_ZH: Record<string, string> = {
  issuer: "发行方",
  alice: "Alice",
  bob: "Bob",
  holder: "持有者",
  sender: "发送方",
  receiver: "接收方",
};

function roleZh(role: string): string {
  return ROLE_ZH[role] ?? role;
}

/** Account flags, keyed by the lsf* name reported on AccountRoot. */
const ACCOUNT_FLAGS: Record<string, Bilingual> = {
  lsfDefaultRipple: { en: "DefaultRipple enabled", zh: "已启用 DefaultRipple" },
  lsfDepositAuth: { en: "DepositAuth on", zh: "已开启 DepositAuth" },
  lsfRequireAuth: { en: "RequireAuth enabled", zh: "已启用 RequireAuth" },
  lsfGlobalFreeze: { en: "GlobalFreeze on", zh: "已开启 GlobalFreeze" },
  lsfNoFreeze: { en: "NoFreeze set (permanent)", zh: "已设置 NoFreeze（不可逆）" },
  lsfDisallowXRP: { en: "DisallowXRP set", zh: "已设置 DisallowXRP" },
  lsfDisableMaster: { en: "Master key disabled", zh: "主密钥已禁用" },
  lsfAllowTrustLineClawback: { en: "AllowTrustLineClawback enabled", zh: "已启用 AllowTrustLineClawback" },
};

const LEDGER_OBJECTS: Record<string, Bilingual> = {
  DepositPreauth: { en: "preauthorized", zh: "已预授权" },
  Credential: { en: "credential present", zh: "持有凭证" },
  Escrow: { en: "escrow open", zh: "存在托管" },
  Check: { en: "check outstanding", zh: "存在支票" },
  Ticket: { en: "tickets allocated", zh: "已分配 Ticket" },
  SignerList: { en: "signer list set", zh: "已设置签名者列表" },
};

/** Renders a predicate as a docs-ready condition phrase, or null if it carries no signal. */
export function phrase(predicate: LedgerPredicate): Bilingual | null {
  switch (predicate.kind) {
    case "accountFlag": {
      const base = ACCOUNT_FLAGS[predicate.flag];
      if (!base) return null;
      if (!predicate.value) {
        return {
          en: `${roleEn(predicate.account)} ${base.en} — cleared`,
          zh: `${roleZh(predicate.account)}未${base.zh}`,
        };
      }
      return { en: `${roleEn(predicate.account)} ${base.en}`, zh: `${roleZh(predicate.account)}${base.zh}` };
    }

    case "transferRate":
      return {
        en: `TransferRate ${String(predicate.rate)}`,
        zh: `转账费率 ${String(predicate.rate)}`,
      };

    case "trustLine": {
      // Deep freeze implies a regular freeze, so report the pair as one condition.
      if (predicate.deepFreeze) {
        return { en: "Freeze + deep freeze", zh: "冻结 + 深度冻结" };
      }
      // Freeze without deep freeze is nearly always reported in contrast to a deep freeze that was
      // just lifted, so phrase it as what remains rather than as a bare state.
      if (predicate.freeze) {
        return { en: "Regular freeze remains", zh: "普通冻结仍生效" };
      }
      if (predicate.authorized) {
        return {
          en: `${roleEn(predicate.account)} trust line authorized`,
          zh: `${roleZh(predicate.account)}的信任线已授权`,
        };
      }
      if (predicate.noRipple === false) {
        return { en: "Rippling allowed (no_ripple cleared)", zh: "允许 rippling（已清除 no_ripple）" };
      }
      return null;
    }

    case "mptIssuance":
      return predicate.flags.length > 0 ? { en: predicate.flags.join(" | "), zh: predicate.flags.join(" | ") } : null;

    case "mptHolding": {
      if (predicate.locked) {
        return { en: `${roleEn(predicate.account)} locked`, zh: `${roleZh(predicate.account)}已锁定` };
      }
      if (predicate.authorized) {
        return { en: `${roleEn(predicate.account)} authorized`, zh: `${roleZh(predicate.account)}已授权` };
      }
      return null;
    }

    case "ledgerObject": {
      // Absence is meaningful for grant/revoke pairs, but the empty state reads better from the
      // column's own `empty` text than from a phrase here.
      if (predicate.count === 0) return null;
      const base = LEDGER_OBJECTS[predicate.type];
      if (!base) return null;
      return { en: base.en, zh: base.zh };
    }

    case "txField":
      return predicate.present
        ? { en: `${predicate.field} referenced`, zh: `已附带 ${predicate.field}` }
        : { en: `${predicate.field} not sent`, zh: `未附带 ${predicate.field}` };
  }
}
