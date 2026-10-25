"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useScenario from "@/components/use-scenario";
import {
  buildScenarioReport,
  buildTemplate,
  buildLLMPrompt,
} from "@/lib/playbook";
import { downloadText } from "@/lib/scenario";
const yuan = (v) => "¥" + Number(v).toFixed(2),
  pct = (v) => (v * 100).toFixed(1) + "%";
export default function Playbook({ bundles, meta }) {
  const { scenario, notice, reset } = useScenario(bundles);
  const structured = useMemo(
    () => buildScenarioReport(bundles, meta, scenario),
    [bundles, meta, scenario],
  );
  const template = useMemo(() => buildTemplate(structured), [structured]);
  const [showSettings, settings] = useState(false),
    [cfg, setCfg] = useState({ baseUrl: "", apiKey: "", model: "" });
  const [llmText, textSet] = useState(""),
    [status, statusSet] = useState(""),
    [loading, loadingSet] = useState(false);
  const controller = useRef(null);
  useEffect(() => {
    try {
      localStorage.removeItem("bundle-lab:llm");
    } catch {}
  }, []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    textSet("");
    loadingSet(false);
    statusSet("");
  }, [structured, cfg]);
  useEffect(() => () => controller.current?.abort(), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      statusSet("已复制规则建议，含当前假设与验证计划。");
    } catch {
      statusSet("浏览器未允许复制，请下载 Markdown。");
    }
  }
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    loadingSet(false);
    statusSet("已取消润色，规则建议保持可用。");
  }
  async function polish() {
    let base;
    try {
      base = new URL(cfg.baseUrl);
      if (
        base.protocol !== "https:" ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw Error();
      if (!cfg.apiKey.trim() || !cfg.model.trim()) throw Error();
    } catch {
      statusSet(
        "请填写有效 HTTPS 接口、模型名和 Key。Key 只在本页内存中保留。",
      );
      return;
    }
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    loadingSet(true);
    textSet("");
    statusSet("正在请求润色；返回文字尚未核对。");
    const timer = setTimeout(() => c.abort(), 30000);
    try {
      const endpoint = base.href.endsWith("/")
        ? base.href.slice(0, -1)
        : base.href;
      const response = await fetch(endpoint + "/chat/completions", {
        method: "POST",
        signal: c.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + cfg.apiKey,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "user", content: buildLLMPrompt(structured) }],
          temperature: 0.3,
        }),
      });
      if (!response.ok) throw Error("接口返回 HTTP " + response.status);
      const j = await response.json(),
        out = j?.choices?.[0]?.message?.content;
      if (typeof out !== "string" || !out.trim() || out.length > 40000)
        throw Error("响应为空或格式不支持");
      if (controller.current !== c) return;
      textSet(out);
      statusSet(
        "已生成未核对的润色草稿，可能漏数字或改数字。规则版仍是正式导出。",
      );
    } catch (e) {
      if (controller.current === c)
        statusSet(
          c.signal.aborted
            ? "润色已中止或超时，规则版仍可使用。"
            : "润色失败（接口、网络或格式异常），规则版仍可使用。",
        );
    } finally {
      clearTimeout(timer);
      if (controller.current === c) {
        controller.current = null;
        loadingSet(false);
      }
    }
  }
  return (
    <>
      <div className="scenario-actions">
        <p role="status">{status || notice}</p>
        <Link href="/simulate/" className="btn">
          返回调整假设
        </Link>
        <button className="btn" onClick={reset}>
          恢复默认假设
        </button>
        <button className="btn" onClick={copy}>
          复制规则建议
        </button>
        <button
          className="btn"
          data-on
          onClick={() =>
            downloadText(
              template,
              "bundle-playbook.md",
              "text/markdown;charset=utf-8",
            )
          }
        >
          导出 Markdown
        </button>
        <button
          className="btn"
          onClick={() =>
            downloadText(
              JSON.stringify(structured, null, 2),
              "bundle-playbook.json",
              "application/json",
            )
          }
        >
          导出结构化依据
        </button>
      </div>
      <p className="note">
        当前折扣 {pct(scenario.discount)} · 成本 {pct(scenario.costRatio)} ·
        未买齐者中档采纳 {pct(scenario.adoption.neutral)} · 既有整套者领折扣{" "}
        {pct(scenario.existingRedemption)}。沿用推演页假设，重新评估全部{" "}
        {bundles.length} 个候选。
      </p>
      <h2 className="sec">优先验证的组合</h2>
      {structured.actions.length === 0 && (
        <div className="card" role="status">
          当前没有同时满足中档毛利为正、覆盖门槛与去重规则的组合。保留这个结果；可返回检查假设，不必强行挑一个赢家。
        </div>
      )}
      {structured.actions.map((a) => (
        <article className="card action-card" key={a.bundle}>
          <h3>{a.bundle}</h3>
          <p className="small">
            {a.audience.who} · {a.audience.when}
            ，以上均为历史分布，仍需验证适用人群。
          </p>
          <div className="ledger">
            <p>
              <span>覆盖订单 / 已买齐占比</span>
              <b>
                {a.matchedCount} / {pct(a.hitRate)}
              </b>
            </p>
            <p>
              <span>套餐价</span>
              <b>{yuan(a.bundlePrice)}</b>
            </p>
            <p>
              <span>每覆盖单组合收入 / 毛利变化</span>
              <b>
                {yuan(a.aovLift)} / {yuan(a.marginLift)}
              </b>
            </p>
            <p>
              <span>平衡采纳率</span>
              <b>{a.breakEven === null ? "不可达" : pct(a.breakEven)}</b>
            </p>
          </div>
          <ul>
            {a.risks.map((r, i) => (
              <li key={i}>{r.text}</li>
            ))}
          </ul>
        </article>
      ))}
      <details className="card" style={{ marginTop: 14 }}>
        <summary>未入选与重叠机会</summary>
        <p>
          当前中档不成立 {structured.rejected.length} 个；覆盖不足{" "}
          {structured.narrow.length} 个；去重 {structured.dropped.length}{" "}
          个。去重仅用商品重合规则，未建模订单蚕食，不能把各组合收益相加。
        </p>
        <ul>
          {structured.rejected.map((b, i) => (
            <li key={"r" + i}>
              {b.items.join(" + ")}：{b.reason}
            </li>
          ))}
          {structured.dropped.map((d, i) => (
            <li key={"d" + i}>
              {d.items.join(" + ")}：与 {d.overlapsWith.join(" + ")} 重叠
            </li>
          ))}
        </ul>
      </details>
      <h2 className="sec">把建议变成验证计划</h2>
      <ol className="card plan">
        {structured.validationPlan.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <details className="card">
        <summary>规则版导出预览</summary>
        <pre className="export-preview">{template}</pre>
      </details>
      <h2 className="sec">可选：润色措辞</h2>
      <p className="small">
        默认无需模型。只有手动请求才把合成分析发送至所填接口；Key
        不保存，刷新即清除。接口需允许浏览器跨域请求。
      </p>
      <button
        className="btn"
        aria-expanded={showSettings}
        onClick={() => settings(!showSettings)}
      >
        设置模型
      </button>
      {showSettings && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="grid g3">
            {[
              ["baseUrl", "HTTPS Base URL", "url"],
              ["apiKey", "API Key", "password"],
              ["model", "模型名", "text"],
            ].map(([k, label, type]) => (
              <label className="field-stack" key={k}>
                {label}
                <input
                  type={type}
                  autoComplete="off"
                  value={cfg[k]}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="scenario-actions">
            <button className="btn" disabled={loading} onClick={polish}>
              请求润色
            </button>
            {loading && (
              <button className="btn" onClick={cancel}>
                取消请求
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                cancel();
                setCfg({ baseUrl: "", apiKey: "", model: "" });
              }}
            >
              清除连接信息
            </button>
          </div>
        </div>
      )}
      {llmText && (
        <section className="card" style={{ marginTop: 14 }}>
          <h3>润色草稿 · 未核对</h3>
          <p>
            此处不是规则版，不保证数字准确或完整。正式导出始终包含上面的规则与依据。
          </p>
          <pre className="export-preview">{llmText}</pre>
          <button
            className="btn"
            onClick={() =>
              downloadText(
                "# 未核对的模型润色草稿\n\n" + llmText,
                "bundle-polish-unverified.md",
                "text/markdown;charset=utf-8",
              )
            }
          >
            下载未核对草稿
          </button>
        </section>
      )}
    </>
  );
}
