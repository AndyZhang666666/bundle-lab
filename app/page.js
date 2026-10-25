import { dataset, rankedBundles } from "@/lib/dataset";
import { Histogram, CompareBars } from "@/components/charts";
import Link from "next/link";

const yuan = (v) => `¥${Number(v).toFixed(1)}`;
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;

const DAYPART_LABEL = {
  lunch: "午餐",
  dinner: "晚餐",
  tea: "下午茶",
  breakfast: "早餐",
  unknown: "未知",
};

export default function OverviewPage() {
  const { prof, orders } = dataset();
  const ranked = rankedBundles();
  const feasible = ranked.filter(
    (b) => b.breakEven.rate !== null && b.scenarios.neutral.marginLift > 0,
  );

  const mismatchTag =
    prof.mismatch.level === "high"
      ? "tag-bad"
      : prof.mismatch.level === "medium"
        ? "tag-warn"
        : "tag-good";
  const mismatchLabel =
    prof.mismatch.level === "high"
      ? "优先核查"
      : prof.mismatch.level === "medium"
        ? "值得核查"
        : "信号有限";

  const dayparts = Object.entries(prof.daypartCounts)
    .map(([k, v]) => ({ label: DAYPART_LABEL[k] || k, count: v }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="page-head">
        <h1>这批订单里，套餐机会在哪</h1>
        <p>
          从订单结构提出套餐假设，再比较折扣与毛利。先发现值得验证的机会，不把共购关系当成套餐有效的证明。
        </p>
      </div>

      <div
        className={`card ${prof.mismatch.level === "high" ? "note-accent" : ""}`}
        style={{ borderLeftWidth: 3 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span className={`tag ${mismatchTag}`}>{mismatchLabel}</span>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            规则：多人订单占比 ≥ 25% 且人均商品数 &lt; 单人的 80% → 强
          </span>
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 1.7 }}>
          {prof.mismatch.text}
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          先核对大份菜与共享份量、用餐人数口径，再通过访谈或小流量实验判断是否真的存在凑单障碍。
        </p>
      </div>

      <h2 className="sec">整体</h2>
      <div className="grid g4">
        <div className="card metric">
          <div className="k">订单数</div>
          <div className="v">{prof.orderCount.toLocaleString()}</div>
          <div className="n">
            合成数据，{orders.length ? "2026-06 至 2026-07" : ""}
          </div>
        </div>
        <div className="card metric">
          <div className="k">客单价（均值 / 中位）</div>
          <div className="v">{yuan(prof.aov)}</div>
          <div className="n">中位 {yuan(prof.aovMedian)}</div>
        </div>
        <div className="card metric">
          <div className="k">平均商品数</div>
          <div className="v">{prof.avgItems.toFixed(2)}</div>
          <div className="n">件 / 单</div>
        </div>
        <div className="card metric">
          <div className="k">多人订单占比</div>
          <div className="v">{pct(prof.groupShare)}</div>
          <div className="n">
            {prof.groupCount} 多人 / {prof.singleCount} 单人
          </div>
        </div>
      </div>

      <h2 className="sec">多人 vs 单人 —— 错位在哪</h2>
      <div className="grid g3">
        <div className="card">
          <h3 className="sub">客单价</h3>
          <CompareBars
            data={[
              { name: "多人订单", value: prof.groupAOV },
              { name: "单人订单", value: prof.singleAOV },
            ]}
            fmt="yuan"
          />
          <div className="note" style={{ marginTop: 6 }}>
            多人客单是单人的 {(prof.groupAOV / prof.singleAOV).toFixed(2)}{" "}
            倍。单看这个数没问题 —— 分享型主食本来就贵。问题在右边两格。
          </div>
        </div>
        <div className="card">
          <h3 className="sub">每单商品数</h3>
          <CompareBars
            data={[
              { name: "多人订单", value: prof.groupItems },
              { name: "单人订单", value: prof.singleItems },
            ]}
            fmt="num2"
          />
          <div className="note" style={{ marginTop: 6 }}>
            多人只比单人多 {pct(prof.itemsRatio - 1, 0)}。3-5 个人，点的东西没比
            1-2 个人多多少。
          </div>
        </div>
        <div className="card">
          <h3 className="sub">人均商品数</h3>
          <CompareBars
            data={[
              { name: "多人订单", value: prof.itemsPerHeadGroup },
              { name: "单人订单", value: prof.itemsPerHeadSingle },
            ]}
            fmt="num2"
          />
          <div className="note note-accent" style={{ marginTop: 6 }}>
            多人的人均商品数为少人订单的 {pct(prof.headRatio, 0)}
            。共享大份菜也会产生这个差异，不能据此确认缺少套餐导致少点。
          </div>
        </div>
      </div>

      <h2 className="sec">分布</h2>
      <div className="grid g3">
        <div className="card">
          <h3 className="sub">客单价分布</h3>
          <Histogram data={prof.aovHistogram} />
        </div>
        <div className="card">
          <h3 className="sub">每单商品数分布</h3>
          <Histogram
            data={prof.itemHistogram.map((d) => ({
              label: `${d.items} 件`,
              count: d.count,
            }))}
          />
        </div>
        <div className="card">
          <h3 className="sub">时段分布</h3>
          <Histogram data={dayparts} />
        </div>
      </div>

      <h2 className="sec">这批数据里挖出来的</h2>
      <div className="grid g3">
        <div className="card metric">
          <div className="k">候选组合</div>
          <div className="v">{ranked.length}</div>
          <div className="n">lift ≥ 1.2、支持度 ≥ 1%</div>
        </div>
        <div className="card metric">
          <div className="k">默认中档毛利为正</div>
          <div className="v">{feasible.length}</div>
          <div className="n">仅在默认假设下成立，仍需验证</div>
        </div>
        <div className="card metric">
          <div className="k">最高中性档 Δ客单</div>
          <div className="v">
            {feasible.length
              ? yuan(
                  Math.max(...feasible.map((b) => b.scenarios.neutral.aovLift)),
                )
              : "—"}
          </div>
          <div className="n">每被覆盖订单，采纳率 12% 假设下</div>
        </div>
      </div>
      <p style={{ color: "var(--ink-2)", fontSize: 13.5, marginTop: 10 }}>
        去 <Link href="/bundles/">组合发现</Link> 看完整列表，去{" "}
        <Link href="/simulate/">收益推演</Link> 调参数。
      </p>
    </>
  );
}
