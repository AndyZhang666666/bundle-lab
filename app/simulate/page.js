import { dataset, rankedBundles } from '@/lib/dataset';
import Simulator from './simulator';

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
    cats: b.items.map((i) => categoryOf[i] || '未分类'),
    prices: b.items.map((i) => priceOf[i] || 0),
    lift: b.lift,
    support: b.support,
    matchedCount: b.matchedCount,
    matchedShare: b.matchedShare,
    matchedAOV: b.matchedAOV,
    partialSpend: b.partialSpend,
    hitCount: b.hitCount,
    hitRate: b.hitRate,
    dominantDaypart: b.dominantDaypart,
    dominantDaypartShare: b.dominantDaypartShare,
    groupShare: b.groupShare,
  }));

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Simulate</div>
        <h1>这个套餐推出去，会怎样</h1>
        <p>
          选定组合，调折扣率、采纳率、成本率，看客单和毛利怎么变。三档采纳率对应保守、中性、乐观三种假设；
          盈亏平衡点回答「至少多少人接才不亏」。所有数字是参数化估算，不是预测 —— 参数来源见「方法与假设」。
        </p>
      </div>
      <Simulator bundles={payload} />
    </>
  );
}
