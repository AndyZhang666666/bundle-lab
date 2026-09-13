export default function MethodPage() {
  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Method</div>
        <h1>方法与假设</h1>
        <p>这一页把公式写清楚、把假设标出来。看不懂的地方是我没写好，不是你的问题。</p>
      </div>

      <h2 className="sec">一、组合发现：关联规则</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>从订单里找「经常一起买」的商品组合。三个指标：</p>
        <pre className="mono" style={{ background: '#fcfbf9', padding: 14, borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
{`支持度  supp(A∪B) = 同时含 A、B 的订单数 / 总订单数
置信度  conf(A→B) = supp(A∪B) / supp(A)        买了 A 的人里多少也买了 B
提升度  lift(A→B) = conf(A→B) / supp(B)        这个概率是随机水平的几倍`}
        </pre>
        <p>
          lift = 1 是纯巧合；lift 越大，「一起买」越不是偶然。lift 对 A、B 对称，所以一个组合只算一次；
          置信度不对称，页面上展示的是置信度更高的那个方向（「买了 A 的人更可能买 B」比反过来更有用）。
        </p>
        <p>
          实现是标准 Apriori：先找频繁单品，再两两组合，再三三组合，每层用支持度剪枝。
          数据量只有几千单、几十个 SKU，不需要更快的算法。代码在 <span className="mono">lib/rules.js</span>，
          有 21 条手算断言（<span className="mono">scripts/test-rules.mjs</span>）。
        </p>
        <p style={{ marginBottom: 0 }}>
          <b>排序不是纯按 lift。</b>用 lift × log(1 + 命中订单数)。原因：支持度低的组合容易刷出虚高 lift
          —— 40 单里出现 30 次共现和 400 单里出现 300 次共现，lift 一样，可信度差十倍。
        </p>
      </div>

      <h2 className="sec">二、收益估算：套餐推出去会怎样</h2>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          口径只在「组合涉及的这几件商品」上比较。一个人采纳套餐，变化的只是这几件的花费，整单其余的菜照点。
        </p>
        <pre className="mono" style={{ background: '#fcfbf9', padding: 14, borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
{`匹配订单     = 含组合中至少一件商品的订单（套餐能推给谁）
partialSpend = 匹配订单原本在这几件上的平均花费
套餐价       = 组合原价 × (1 − 折扣率)

Δ客单/单  = 采纳率 × (套餐价 − partialSpend)
原毛利    = partialSpend × (1 − 成本率)
套餐毛利  = 套餐价 − 原价 × 成本率
Δ毛利/单  = 采纳率 × (套餐毛利 − 原毛利)`}
        </pre>
        <p>
          三档采纳率（保守 5% / 中性 12% / 乐观 25%）给的是区间，不是点估计。这三个数是经验估计，没有数据支撑，
          详见 <span className="mono">docs/ASSUMPTIONS.md</span>。
        </p>
        <p style={{ marginBottom: 0 }}>
          <b>第一版把基线用成了整单客单价</b>（含套餐外的菜），结果 50 个组合 49 个算成「亏」。
          不是假设太保守，是量纲错了。修正后只剩 1 个不可行，而且它是对的。
        </p>
      </div>

      <h2 className="sec">三、盈亏平衡：至少多少人接才不亏</h2>
      <div className="card">
        <pre className="mono" style={{ background: '#fcfbf9', padding: 14, borderRadius: 8, fontSize: 13, lineHeight: 1.7 }}>
{`h = 命中率：匹配订单里本来就买齐全套的比例（这些人吃折扣不产生增量）
d = 每单让利 = 原价 × 折扣率
g = 每单增量毛利 = 套餐毛利 − 未命中者原本的毛利

平衡条件  (1 − h) · a · g = h · d
平衡采纳率  a = h · d / ((1 − h) · g)`}
        </pre>
        <p>
          含义：h 越高，本来就成套买的人越多，白让的折扣越多，门槛越高。h 超过三成的组合（本数据里的「牛肉面+卤蛋」），
          做折扣套餐是纯让利，更适合加价购。
        </p>
        <p style={{ marginBottom: 0 }}>
          已知弱点：假设未命中者「不采纳就什么都不多买」。如果他们本来也会加购，g 被高估、平衡点被低估。
          这是全项目最该被人复核的公式。
        </p>
      </div>

      <h2 className="sec">四、默认参数一览</h2>
      <div className="card" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>参数</th>
              <th className="num">默认值</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>lift 下限</td><td className="num">1.2</td><td>经验估计；阈值敏感度实测见校验页</td></tr>
            <tr><td>支持度下限</td><td className="num">1%</td><td>经验估计；与订单量绑定，2000 单以上才稳</td></tr>
            <tr><td>置信度下限</td><td className="num">10%</td><td>随手定的兜底，未做敏感性测试</td></tr>
            <tr><td>套餐折扣率</td><td className="num">12%</td><td>演示默认值，应按品类毛利结构调</td></tr>
            <tr><td>成本率</td><td className="num">40%</td><td>中式快餐通行区间 30-45% 取中位；对结果最敏感</td></tr>
            <tr><td>采纳率 保守/中性/乐观</td><td className="num">5 / 12 / 25%</td><td>经验估计；三个前提都偏乐观，当上限看</td></tr>
            <tr><td>建议入选最低覆盖</td><td className="num">100 单</td><td>经验估计；再小落地成本摊不平</td></tr>
            <tr><td>建议去重重合度</td><td className="num">50%</td><td>随手定；去重动作本身是必须的</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="sec">五、不做什么</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
          <li>不接真实平台 API，不做在线推荐服务。这是分析工具，不是系统。</li>
          <li>不做定价优化。套餐价 = 原价 × 折扣，折扣是手动滑杆，工具不搜最优解 —— 没有真实 A/B 数据，寻优出来的是假精度。</li>
          <li>不做库存、不做蚕食建模、不做显著性检验。</li>
          <li>不用任何真实业务数据。全部合成，生成规则在 <span className="mono">data/GENERATION.md</span>。</li>
        </ul>
      </div>
    </>
  );
}
