// 本地生成 Playbook 的 LLM 润色样本，产物落 results/playbook-samples/。
//
// 只在本地跑，key 从环境变量读，不进任何文件。
// 目的：让 README 和仓库里有几份「模型润色后长什么样」的真实样本，
// 顺便验证提示词里「数字不许改」这条约束模型守不守。
//
// 用法：LLM_BASE_URL=... LLM_API_KEY=... LLM_MODEL=... node scripts/playbook-samples.mjs [次数]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dataset, rankedBundles } from '../lib/dataset.js';
import { pickActions, actionOf, buildTemplate, buildLLMPrompt } from '../lib/playbook.js';
import { DEFAULT_ADOPTION, DEFAULT_DISCOUNT, DEFAULT_COST_RATIO } from '../lib/simulate.js';

const BASE = process.env.LLM_BASE_URL;
const KEY = process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5-20251001';
const RUNS = Math.min(Number(process.argv[2] || 3), 20);

if (!BASE || !KEY) {
  console.error('缺 LLM_BASE_URL / LLM_API_KEY 环境变量。这个脚本只在本地跑。');
  process.exit(1);
}

const { orders } = dataset();
const ranked = rankedBundles();
const picked = pickActions(ranked);
const structured = {
  meta: {
    orderCount: orders.length,
    source: '内置合成数据集',
    candidateCount: ranked.length,
    feasibleCount: ranked.filter((b) => b.breakEven.rate !== null).length,
    adoption: DEFAULT_ADOPTION,
    discount: DEFAULT_DISCOUNT,
    costRatio: DEFAULT_COST_RATIO,
  },
  actions: picked.chosen.map((b) => actionOf(b, DEFAULT_ADOPTION.neutral)),
  rejected: picked.rejected.map((b) => ({ items: b.items, hitRate: b.hitRate, reason: b.breakEven.reason })),
  narrow: picked.narrow.map((b) => ({ items: b.items, matchedCount: b.matchedCount, aovLift: b.scenarios.neutral.aovLift })),
  dropped: picked.dropped.map((d) => ({ items: d.bundle.items, overlapsWith: d.overlapsWith })),
};

mkdirSync('results/playbook-samples', { recursive: true });
writeFileSync('results/playbook-samples/template.md', buildTemplate(structured));
writeFileSync('results/playbook-samples/structured.json', JSON.stringify(structured, null, 2));

// 数字核对。第一版按「模板里的字符串」查（¥10.2），模型输出的是 JSON 原始精度（10.25），
// 报出 0/10 保留 —— 检测器误报。改成比数值：模板里的数四舍五入到 1 位，
// 输出里任何数四舍五入到 1 位后相等就算保留。
const round1 = (x) => Math.round(Number(x) * 10) / 10;
const allNums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map(round1);

const prompt = buildLLMPrompt(structured);
const log = [];
for (let i = 1; i <= RUNS; i++) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const out = j?.choices?.[0]?.message?.content || '';
    const outNums = new Set(allNums(out));
    // 关键数字：每条建议的 Δ客单（元）和 平衡采纳率（%），按数值比
    const keyNums = structured.actions.flatMap((a) => [
      { label: `${a.bundle} Δ客单`, v: round1(a.aovLift) },
      { label: `${a.bundle} 平衡采纳率%`, v: round1(a.breakEven * 100) },
    ]);
    const kept = keyNums.filter((k) => outNums.has(k.v));
    const missing = keyNums.filter((k) => !outNums.has(k.v)).map((k) => k.label);
    writeFileSync(`results/playbook-samples/sample-${i}.md`, out);
    log.push({ run: i, model: MODEL, ms: Date.now() - t0, chars: out.length, keyNumbersKept: `${kept.length}/${keyNums.length}`, missing });
    console.log(`#${i} ${Date.now() - t0}ms ${out.length}字 关键数字保留 ${kept.length}/${keyNums.length}${missing.length ? '  缺: ' + missing.join('; ') : ''}`);
  } catch (e) {
    log.push({ run: i, model: MODEL, error: e.message });
    console.log(`#${i} 失败：${e.message}`);
  }
}
writeFileSync('results/playbook-samples/log.json', JSON.stringify({ generatedAt: new Date().toISOString(), model: MODEL, runs: log }, null, 2));
console.log('产物在 results/playbook-samples/');
