import { loadResult, dataset } from "@/lib/dataset";
import Link from "next/link";

const pct = (v, d = 0) => `${(Number(v) * 100).toFixed(d)}%`;

export default function ValidationPage() {
  const recall = loadResult("recall");
  const robust = loadResult("robustness");
  const rules = loadResult("rules-check");
  const { prof } = dataset();

  const missing = [
    ["recall", recall],
    ["robustness", robust],
    ["rules-check", rules],
  ].filter(([, v]) => !v);

  return (
    <>
      <div className="page-head">
        <h1>怎么知道它挖出来的不是噪声</h1>
        <p>
          合成数据里预先埋了 5 个组合（答案写在
          data/GENERATION.md）。工具挖出来的组合能不能对上答案，
          是一个可重复的合成样本检查。这一页的数字全部来自仓库 results/
          目录里真跑出来的产物。
        </p>
      </div>

      {missing.length > 0 && (
        <div
          className="card note-warn"
          style={{ borderLeftWidth: 3, marginBottom: 14 }}
        >
          缺少校验产物：{missing.map(([n]) => `results/${n}.json`).join("、")}。
          跑{" "}
          <span className="mono">
            npm run test:rules &amp;&amp; npm run recall &amp;&amp; npm run
            robustness
          </span>{" "}
          生成。
        </div>
      )}

      {/* —— 手算对照 —— */}
      {rules && (
        <>
          <h2 className="sec">一、公式对不对：10 条手工订单对照笔算</h2>
          <div className="grid g4">
            <div className="card metric">
              <div className="k">断言数</div>
              <div className="v">{rules.totalChecks}</div>
              <div className="n">覆盖 supp / conf / lift / 口径</div>
            </div>
            <div className="card metric">
              <div className="k">通过</div>
              <div
                className="v"
                style={{
                  color: rules.failed === 0 ? "var(--good)" : "var(--bad)",
                }}
              >
                {rules.passed}/{rules.totalChecks}
              </div>
              <div className="n">
                {rules.failed === 0 ? "全部通过" : `${rules.failed} 项失败`}
              </div>
            </div>
            <div className="card metric">
              <div className="k">为什么是手算</div>
              <div
                className="v"
                style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5 }}
              >
                三个指标很容易写错
              </div>
              <div className="n">
                写错了结果依然「看起来合理」，只能靠笔算对数
              </div>
            </div>
            <div className="card metric">
              <div className="k">fixture 里故意留的</div>
              <div
                className="v"
                style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.5 }}
              >
                lift = 0.8 的负相关组合
              </div>
              <div className="n">固定住「共现 ≠ 该推套餐」这个判断</div>
            </div>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            写这个测试时手算 supp(C) 数漏了一单（把 5 次数成 4
            次），被断言抓出来。 这正好说明为什么要手算 ——
            代码没错，是我的直觉错了，而直觉错了在别处看不出来。
          </div>
        </>
      )}

      {/* —— 召回 —— */}
      {recall && (
        <>
          <h2 className="sec">二、挖得准不准：植入组合召回</h2>
          <div className="grid g4">
            <div className="card metric">
              <div className="k">召回率</div>
              <div className="v">
                {recall.recall.found}/{recall.recall.total}
              </div>
              <div className="n">埋进去的组合找回来几个</div>
            </div>
            <div className="card metric">
              <div className="k">候选组合总数</div>
              <div className="v">{recall.totalCandidates}</div>
              <div className="n">lift ≥ 1.2、支持度 ≥ 1%</div>
            </div>
            <div className="card metric">
              <div className="k">前 10 名里的误报</div>
              <div className="v">{recall.falsePositivesInTop10}</div>
              <div className="n">非植入组合挤进前 10 的个数</div>
            </div>
            <div className="card metric">
              <div className="k">数据集</div>
              <div className="v">{recall.dataset.orders.toLocaleString()}</div>
              <div className="n">
                订单，{recall.dataset.lines.toLocaleString()} 行明细
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, marginTop: 12 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>植入组合</th>
                    <th className="num">生成概率</th>
                    <th className="num">排名</th>
                    <th className="num">lift</th>
                    <th className="num">支持度</th>
                    <th className="num">置信度</th>
                    <th className="num">命中订单</th>
                    <th>主时段</th>
                  </tr>
                </thead>
                <tbody>
                  {recall.planted.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 550 }}>
                          {p.items.join(" + ")}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                          {p.id} · {p.note}
                        </div>
                      </td>
                      <td className="num">{pct(p.plantedProb)}</td>
                      <td className="num">
                        {p.found ? (
                          <b>#{p.rank}</b>
                        ) : (
                          <span className="tag tag-bad">未召回</span>
                        )}
                      </td>
                      <td className="num">
                        {p.lift ? p.lift.toFixed(2) : "—"}
                      </td>
                      <td className="num">
                        {p.support ? pct(p.support, 2) : "—"}
                      </td>
                      <td className="num">
                        {p.confidence ? pct(p.confidence, 1) : "—"}
                      </td>
                      <td className="num">{p.hitOrders ?? "—"}</td>
                      <td>
                        {p.dominantDaypart ? (
                          <span className="pill">
                            {p.dominantDaypart} {pct(p.dominantDaypartShare)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="card note-warn"
            style={{ borderLeftWidth: 3, marginTop: 12 }}
          >
            <b>前 10 里的两个误报不是 bug，是 lift 的固有弱点。</b>{" "}
            它们是两个植入组合的拼接
            （卤蛋+大瓶可乐+牛肉面、啤酒+大瓶可乐+烤鱼），命中单量只有 40 多单，
            但 lift 高达 4.7。support 低的组合容易刷出虚高的 lift ——
            所以页面上一律同时显示命中订单数，不能只看 lift 就下结论。
          </div>
        </>
      )}

      {/* —— 鲁棒性 —— */}
      {robust && (
        <>
          <h2 className="sec">三、多少订单量才够用</h2>
          <p style={{ color: "var(--ink-2)", fontSize: 13.5, marginTop: -4 }}>
            两个指标要分开看。<b>进候选</b>只说明被挖出来了，哪怕排在第 69 名；
            <b>进前 10</b>{" "}
            用来检查这一固定合成样本下的排序稳定性，不是实际运营可用性的证明。
          </p>
          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="num">订单数</th>
                    <th className="num">候选数</th>
                    <th className="num">进候选</th>
                    <th className="num">进前 10</th>
                    <th className="num">最差排名</th>
                    <th>沉在 10 名外</th>
                  </tr>
                </thead>
                <tbody>
                  {robust.bySize.map((r) => (
                    <tr key={r.orders}>
                      <td className="num">
                        <b>{r.orders}</b>
                      </td>
                      <td className="num">{r.candidates}</td>
                      <td className="num">{r.recalled}/5</td>
                      <td className="num">
                        <span
                          className={`tag ${r.inTop10 === 5 ? "tag-good" : r.inTop10 >= 3 ? "tag-warn" : "tag-bad"}`}
                        >
                          {r.inTop10}/5
                        </span>
                      </td>
                      <td className="num">
                        {r.worstRank ? `#${r.worstRank}` : "—"}
                      </td>
                      <td style={{ color: "var(--ink-3)", fontSize: 12.5 }}>
                        {r.buriedBelowTop10.length
                          ? r.buriedBelowTop10.join(" ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="note note-accent" style={{ marginTop: 10 }}>
            <b>此固定合成样本：200 单时只有 1 个进前 10</b>，500-1000 单为 4/5
            和 3/5；
            <b>2000 单起 5 个植入组合全部进前 10</b>
            。这不能推广成任意真实业务的最低样本量。
            如果只有两三百单就上这个工具，产出的排序基本是噪声。
          </div>

          <h3 className="sub" style={{ marginTop: 22 }}>
            阈值调松调紧会怎样（固定 4000 单）
          </h3>
          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>阈值</th>
                    <th className="num">候选数</th>
                    <th className="num">进候选</th>
                    <th className="num">进前 10</th>
                    <th>漏掉</th>
                  </tr>
                </thead>
                <tbody>
                  {robust.byThreshold.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td className="num">{r.candidates}</td>
                      <td className="num">{r.recalled}/5</td>
                      <td className="num">
                        <span
                          className={`tag ${r.inTop10 === 5 ? "tag-good" : "tag-warn"}`}
                        >
                          {r.inTop10}/5
                        </span>
                      </td>
                      <td style={{ color: "var(--ink-3)" }}>
                        {r.missing.length ? r.missing.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            阈值放太松反而更差：候选数涨到 200 个，噪声把植入组合挤出前 10。
            默认的 lift ≥ 1.2 / 支持度 ≥ 1% 到偏严区间表现一致且稳定 ——
            这是选它当默认值的依据，不是拍脑袋定的。
          </div>
        </>
      )}

      <h2 className="sec">这份数据本身的画像</h2>
      <div className="note">
        合成数据里多人订单占 {pct(prof.groupShare, 1)}
        ，但人均商品数只有单人订单的 {pct(prof.headRatio)} ——
        该结构差异是刻意植入的，只验证工具能否识别预设信号，不验证真实用户的购买动机。
        <Link href="/">订单画像页</Link>
        将其作为待验证机会；是否缺少套餐，需要另做用户研究或实验。
      </div>
      <div className="note note-warn" style={{ marginTop: 10 }}>
        <b>全部数据是合成的。</b>生成规则、参数、随机种子写在
        data/GENERATION.md。 这里没有任何真实业务数据 ——
        项目动机来自一段实习经历，但测试数据与那家公司无关。
      </div>
    </>
  );
}
