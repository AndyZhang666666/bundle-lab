import { dataset, rankedBundles } from "@/lib/dataset";
import Simulator from "./simulator";

export default function SimulatePage() {
  const { categoryOf, priceOf } = dataset();
  const ranked = rankedBundles();

  // 滑杆一动就要重算，所以参数化估算放客户端跑。
  // lib/simulate.js 是纯函数、不依赖 node，客户端可以直接 import 复用它，
  // 不需要把公式在页面里再抄一遍。
  // 这里只把「每单匹配统计」这些数据侧的量预先算好传过去 ——
  // 它们只取决于数据和组合本身，跟折扣率、采纳率这些参数无关。
  const payload = ranked.map((b) => ({
    key: b.key,
    items: b.items,
    cats: b.items.map((i) => categoryOf[i] || "未分类"),
    prices: b.items.map((i) => priceOf[i] || 0),
    lift: b.lift,
    support: b.support,
    matchedCount: b.matchedCount,
    matchedShare: b.matchedShare,
    matchedAOV: b.matchedAOV,
    partialSpend: b.partialSpend,
    hitCount: b.hitCount,
    hitRate: b.hitRate,
    listPrice: b.listPrice,
    dominantDaypart: b.dominantDaypart,
    dominantDaypartShare: b.dominantDaypartShare,
    groupShare: b.groupShare,
  }));

  return (
    <div className="bundle-worksheet">
      <div className="page-head">
        <p className="desk-eyebrow">Bundle Lab / 收益推演</p>
        <h1>一份套餐，算清两笔账。</h1>
        <p>
          搭一组商品，算清新增贡献与既有顾客让利。保留不同方案，找到盈亏边界，再决定先验证什么。
          内置数据为合成订单；你的输入是经营假设，结果不是业务预测。
        </p>
      </div>
      <Simulator bundles={payload} />
    </div>
  );
}
