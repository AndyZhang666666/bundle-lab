// 把挖掘 + 估算的结果整理成一份「该给哪类订单推什么套餐」的建议。
//
// 这一层不产生新数字，只做两件事：
//   1. 从已经算好的字段里挑出决策相关的那几个，按运营看的顺序排好
//   2. 判断风险点 —— 哪些场景不要推
// 无 LLM 时模板拼接；有 LLM 时把这里的结构化结果原样交给模型润色。
// 规则版固定计算数字；模型可能改写或遗漏数字，必须单独标记为未核对草稿。

import { simulateStats, MODEL_VERSION } from "./simulate.js";
const DAYPART_LABEL = {
  lunch: "午餐",
  dinner: "晚餐",
  tea: "下午茶",
  breakfast: "早餐",
};
const yuan = (v) => `¥${Number(v).toFixed(2)}`;
const pct = (v, d = 1) => `${(Number(v) * 100).toFixed(d)}%`;

/**
 * 挑出值得写进建议的组合：收益可行、覆盖够广、按预期价值排。
 *
 * 关键一步是去重：候选列表里大量组合是彼此的变体
 * （「啤酒+烤鱼」和「啤酒+大瓶可乐+烤鱼」共享啤酒和烤鱼）。
 * 不去重的话，前 5 条建议可能是同一个机会换了 5 种说法，运营会照着做 5 遍。
 * 规则：按价值从高到低遍历，新组合与任何已入选组合的商品重合度
 * 超过 maxOverlap 就跳过。
 *
 * 不可行的和覆盖太窄的不丢掉，单独分组在末尾说明 ——
 * 「现在不该推」本身是结论，藏起来运营就会自己踩坑。
 */
export function pickActions(
  ranked,
  { minMatched = 100, topN = 5, maxOverlap = 0.5 } = {},
) {
  const feasible = ranked.filter(
    (b) => b.breakEven.rate !== null && b.scenarios.neutral.marginLift > 0,
  );
  const wide = feasible.filter((b) => b.matchedCount >= minMatched);

  const byValue = [...wide].sort((a, b) => b.expectedValue - a.expectedValue);
  const chosen = [];
  const dropped = [];

  for (const b of byValue) {
    if (chosen.length >= topN) break;
    const set = new Set(b.items);
    const clash = chosen.find((c) => {
      const inter = c.items.filter((i) => set.has(i)).length;
      return inter / Math.max(c.items.length, b.items.length) > maxOverlap;
    });
    if (clash) {
      dropped.push({ bundle: b, overlapsWith: clash.items });
    } else {
      chosen.push(b);
    }
  }

  return {
    chosen,
    dropped,
    rejected: ranked.filter(
      (b) => b.breakEven.rate === null || b.scenarios.neutral.marginLift <= 0,
    ),
    narrow: feasible.filter((b) => b.matchedCount < minMatched),
  };
}

/** 单个组合的风险点。机器能判断的只有这几类，判断不了的就不写。 */
export function risksOf(b) {
  const out = [];
  if (b.dominantDaypart && b.dominantDaypartShare >= 0.6) {
    out.push({
      level: "warn",
      text: `历史整套订单中 ${pct(b.dominantDaypartShare, 0)} 出现在${DAYPART_LABEL[b.dominantDaypart] || b.dominantDaypart}。这不是各时段采纳效果，需分时段验证。`,
    });
  }
  if (b.hitRate >= 0.3) {
    out.push({
      level: "bad",
      text: `整套占比 ${pct(b.hitRate)}：既有顾客领折扣可能稀释增量；是否采用加价购仍需验证，不能单凭占比决定。`,
    });
  }
  if (b.matchedCount < 300) {
    out.push({
      level: "warn",
      text: `只覆盖 ${b.matchedCount} 单，样本偏小，收益估算波动大。建议小流量试，别一次全量上线。`,
    });
  }
  if (b.aovDelta < 0) {
    out.push({
      level: "bad",
      text: `命中订单客单比全体低 ${yuan(Math.abs(b.aovDelta))}。这是人群差异，不能据此推断促销会拉低客单。`,
    });
  }
  if (out.length === 0) {
    out.push({
      level: "ok",
      text: "没有触发已知的风险规则（时段集中、高命中率、样本过小、命中客单偏低）。",
    });
  }
  return out;
}

/** 针对哪类订单推 —— 从组合的人群和历史分布反推。 */
export function audienceOf(b) {
  const who =
    b.groupShare >= 0.6
      ? "历史整套订单以多人（3人及以上）为主"
      : b.groupShare <= 0.35
        ? "历史整套订单以单人/双人为主"
        : "历史整套订单人群混合";
  const when = b.dominantDaypart
    ? `${DAYPART_LABEL[b.dominantDaypart] || b.dominantDaypart}为主（${pct(b.dominantDaypartShare, 0)}）`
    : "全时段";
  return { who, when };
}

/** 一个组合的建议条目（结构化，供模板和 LLM 共用）。 */
export function actionOf(b, adoption = 0.12) {
  const a = b.scenarios.neutral;
  return {
    bundle: b.items.join(" + "),
    items: b.items,
    lift: b.lift,
    support: b.support,
    audience: audienceOf(b),
    matchedCount: b.matchedCount,
    listPrice: b.listPrice,
    bundlePrice: b.bundlePrice,
    discount: b.discount,
    partialSpend: b.partialSpend,
    hitRate: b.hitRate,
    aovLift: a.aovLift,
    marginLift: a.marginLift,
    breakEven: b.breakEven.rate,
    expectedValue: b.expectedValue,
    risks: risksOf(b),
    adoption,
    existingRedemption: b.existingRedemption,
  };
}

/**
 * 模板拼接。这是无 LLM 时的默认输出，也是 LLM 拿到的输入骨架。
 */
export function buildTemplate(structured) {
  const { meta, actions, rejected, narrow, dropped } = structured;
  const L = [];

  L.push(`# 套餐策略建议`);
  L.push("");
  L.push(
    `基于 ${meta.orderCount} 笔订单（${meta.source}）挖掘。共发现 ${meta.candidateCount} 个候选组合，` +
      `其中 ${meta.feasibleCount} 个在当前中档假设下毛利为正。以下只作小范围验证候选，不是已成立的运营策略。`,
  );
  L.push("");

  actions.forEach((a, i) => {
    L.push(`## ${i + 1}. ${a.bundle}`);
    L.push("");
    L.push(
      `**推给谁**：${a.audience.who}，${a.audience.when}。覆盖 ${a.matchedCount} 单。`,
    );
    L.push("");
    L.push(
      `**观察依据**：lift ${a.lift.toFixed(2)}（该组合最强关联规则相对独立基线的倍数，不是干预因果），` +
        `支持度 ${pct(a.support, 2)}。这批人原本在这几件上平均花 ${yuan(a.partialSpend)}，` +
        `组合原价 ${yuan(a.listPrice)}，减价 ${pct(a.discount, 0)} 后套餐价 ${yuan(a.bundlePrice)}。`,
    );
    L.push("");
    L.push(
      `**条件推演**：未买齐者按 ${pct(a.adoption, 0)} 采纳，既有整套者按 ${pct(a.existingRedemption ?? 1, 0)} 领折扣；每被覆盖订单组合收入变化 ${yuan(a.aovLift)}，` +
        `毛利变化 ${yuan(a.marginLift)}。平衡采纳率 ${a.breakEven === null ? "不可达" : pct(a.breakEven)}。`,
    );
    L.push("");
    L.push(`**风险点**：`);
    for (const r of a.risks) {
      L.push(`- ${r.text}`);
    }
    L.push("");
  });

  if (rejected.length) {
    L.push(`## 不建议做折扣套餐的组合`);
    L.push("");
    L.push(
      `以下 ${rejected.length} 个组合当前中档毛利不为正或平衡点不可达；不据此断言任何促销形式均无效：`,
    );
    L.push("");
    for (const b of rejected.slice(0, 8)) {
      L.push(
        `- **${b.items.join(" + ")}** — ${b.reason}（命中率 ${pct(b.hitRate)}）`,
      );
    }
    L.push("");
  }

  if (narrow.length) {
    L.push(`## 覆盖太窄，建议先观察`);
    L.push("");
    L.push(
      `以下 ${narrow.length} 个组合收益可行但覆盖不足 100 单，跑量太小，先看趋势再决定：`,
    );
    L.push("");
    for (const b of narrow.slice(0, 8)) {
      L.push(
        `- ${b.items.join(" + ")} — 仅 ${b.matchedCount} 单，中性 Δ客单 ${yuan(b.aovLift)}`,
      );
    }
    L.push("");
  }

  if (dropped?.length) {
    L.push(`## 已合并的重复机会`);
    L.push("");
    L.push(
      `候选列表里还有 ${dropped.length} 个组合属于上面某条的变体（共享大部分商品）。` +
        `把同一个人群推两套套餐会互相抢，所以这里不单列：`,
    );
    L.push("");
    // dropped 的字段形状与 actions 不同：这里只需要「谁和谁撞了」，
    // 所以在上游就已拍平成 { items, overlapsWith }，不在这里再取 .bundle
    for (const d of dropped.slice(0, 10)) {
      L.push(
        `- ${d.items.join(" + ")} — 与「${d.overlapsWith.join(" + ")}」重合度过高`,
      );
    }
    L.push("");
  }

  L.push("---");
  if (structured.validationPlan?.length) {
    L.push("## 下一步验证");
    for (const item of structured.validationPlan) L.push("- " + item);
    L.push("");
  }
  L.push("");
  L.push(
    `数字来源：关联规则（支持度/置信度/lift）为订单数据直接计算结果；` +
      `组合收入与毛利变化为参数化估算，当前未买齐者低/中/高采纳率 ${pct(meta.adoption.conservative)}/${pct(meta.adoption.neutral)}/${pct(meta.adoption.optimistic)}、折扣 ${pct(meta.discount)}、` +
      `成本率 ${pct(meta.costRatio)}、既有整套者领折扣率 ${pct(meta.existingRedemption ?? 1)}。模型 ${meta.modelVersion || "历史版本"}。组合覆盖重叠，收益不可相加；未含履约与运营成本。`,
  );
  return L.join("\n");
}

/** 交给 LLM 的提示：只让它改措辞，禁止它改数字。 */
export function buildLLMPrompt(structured) {
  return [
    "你是一个餐饮/电商运营顾问。下面是一份从订单数据里跑出来的套餐机会分析（JSON）。",
    "请把它改写成一段运营能直接照着做的建议，要求：",
    "1. 数字一个字都不许改、不许补充新数字。只能使用 JSON 里已有的数值。",
    "2. 不要用营销腔，不要用「赋能」「闭环」「抓手」这类词。像同事之间说话。",
    "3. 每个组合说清楚：推给谁、为什么推它、预期能多收多少、什么情况下别推。",
    "4. 用 Markdown，中文。控制在 800 字以内。",
    "",
    "分析结果：",
    JSON.stringify(structured, null, 2),
  ].join("\n");
}

/** Default SSR and restored browser assumptions use this identical report builder. */
export function buildScenarioReport(bundles, meta, scenario) {
  const ranked = bundles
    .map((b) => simulateStats(b, scenario))
    .sort((a, b) => b.expectedValue - a.expectedValue);
  const picked = pickActions(ranked);
  return {
    meta: {
      ...meta,
      modelVersion: MODEL_VERSION,
      source: "内置合成订单",
      candidateCount: ranked.length,
      feasibleCount: ranked.filter(
        (b) => b.breakEven.rate !== null && b.scenarios.neutral.marginLift > 0,
      ).length,
      adoption: scenario.adoption,
      discount: scenario.discount,
      costRatio: scenario.costRatio,
      existingRedemption: scenario.existingRedemption,
    },
    actions: picked.chosen.map((b) => actionOf(b, scenario.adoption.neutral)),
    rejected: picked.rejected.map((b) => ({
      items: b.items,
      hitRate: b.hitRate,
      reason: b.breakEven.reason || "中档采纳率下毛利不为正",
    })),
    narrow: picked.narrow.map((b) => ({
      items: b.items,
      matchedCount: b.matchedCount,
      aovLift: b.scenarios.neutral.aovLift,
    })),
    dropped: picked.dropped.map((d) => ({
      items: d.bundle.items,
      overlapsWith: d.overlapsWith,
    })),
    assumptions: scenario,
    validationPlan: [
      "按用户分组随机分流，避免同一用户跨实验组；先验证曝光与采纳率",
      "主指标：每曝光订单增量毛利；护栏：取消、退款、履约与客诉",
      "分别核对原本已买齐与未买齐人群；预先确定样本量、周期与停止条件",
      "共购信号只产生假设，不用历史客单差异替代实验",
    ],
  };
}
