import { dataset, rankedBundles } from '@/lib/dataset';
import { Histogram, CompareBars } from '@/components/charts';

const yuan = (v) => `¥${Number(v).toFixed(1)}`;
const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;

const DAYPART_LABEL = { lunch: '午餐', dinner: '晚餐', tea: '下午茶', breakfast: '早餐', unknown: '未知' };

export default function OverviewPage() {
  const { prof, orders } = dataset();
  const ranked = rankedBundles();
  const feasible = ranked.filter((b) => b.breakEven.rate !== null);

  const mismatchTag =
    prof.mismatch.level === 'high' ? 'tag-bad' : prof.mismatch.level === 'medium' ? 'tag-warn' : 'tag-good';
  const mismatchLabel =
    prof.mismatch.level === 'high' ? '错位信号：强' : prof.mismatch.level === 'medium' ? '错位信号：中' : '错位信号：弱';

  const dayparts = Object.entries(prof.daypartCounts)
    .map(([k, v]) => ({ label: DAYPART_LABEL[k] || k, count: v }))
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Overview</div>
        <h1>这批订单里，套餐机会在哪</h1>
        <p>
          先看订单的整体结构：客单价、商品数、多人和单人的差别。目的是判断一件事 ——
          客单价低，是因为用户不想多买，还是因为菜单没给他们凑单的方式。
        </p>
      </div>

      <div className={`card ${prof.mismatch.level === 'high' ? 'note-accent' : ''}`} style={{ borderLeftWidth: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className={`tag ${mismatchTag}`}>{mismatchLabel}</span>
          <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            规则：多人订单占比 ≥ 25% 且人均商品数 &lt; 单人的 80% → 强
          </span>
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 1.7 }}>{prof.mismatch.text}</div>
      </div>

      <h2 className="sec">整体</h2>
      <div className="grid g4">
        <div className="card metric">
          <div className="k">订单数</div>
          <div className="v">{prof.orderCount.toLocaleString()}</div>
          <div className="n">合成数据，{orders.length ? '2026-06 至 2026-07' : ''}</div>
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
              { name: '多人订单', value: prof.groupAOV },
              { name: '单人订单', value: prof.singleAOV },
            ]}
            fmt="yuan"
          />
          <div className="note" style={{ marginTop: 6 }}>
            多人客单是单人的 {(prof.groupAOV / prof.singleAOV).toFixed(2)} 倍。单看这个数没问题 —— 分享型主食本来就贵。问题在右边两格。
          </div>
        </div>
        <div className="card">
          <h3 className="sub">每单商品数</h3>
          <CompareBars
            data={[
              { name: '多人订单', value: prof.groupItems },
              { name: '单人订单', value: prof.singleItems },
            ]}
            fmt="num2"
          />
          <div className="note" style={{ marginTop: 6 }}>
            多人只比单人多 {pct(prof.itemsRatio - 1, 0)}。3-5 个人，点的东西没比 1-2 个人多多少。
          </div>
        </div>
        <div className="card">
          <h3 className="sub">人均商品数</h3>
          <CompareBars
            data={[
              { name: '多人订单', value: prof.itemsPerHeadGroup },
              { name: '单人订单', value: prof.itemsPerHeadSingle },
            ]}
            fmt="num2"
          />
          <div className="note note-accent" style={{ marginTop: 6 }}>
            多人的人均只有单人的 {pct(prof.headRatio, 0)}。这就是「凑不成套就少点」的直接证据。
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
          <Histogram data={prof.itemHistogram.map((d) => ({ label: `${d.items} 件`, count: d.count }))} />
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
          <div className="k">收益上可行</div>
          <div className="v">{feasible.length}</div>
          <div className="n">存在 ≤ 100% 的盈亏平衡采纳率</div>
        </div>
        <div className="card metric">
          <div className="k">最高中性档 Δ客单</div>
          <div className="v">{feasible.length ? yuan(Math.max(...feasible.map((b) => b.scenarios.neutral.aovLift))) : '—'}</div>
          <div className="n">每被覆盖订单，采纳率 12% 假设下</div>
        </div>
      </div>
      <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginTop: 10 }}>
        去 <a href="/bundles/">组合发现</a> 看完整列表，去 <a href="/simulate/">收益推演</a> 调参数。
      </p>
    </>
  );
}
