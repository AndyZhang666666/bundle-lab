import { dataset, segments } from '@/lib/dataset';
import BundleTable from './table';

export default function BundlesPage() {
  const { categoryOf, priceOf } = dataset();
  const segs = segments();

  // 每个分群各自的候选列表，客户端切换时不需要重算
  const payload = segs.map((s) => ({
    key: s.key,
    label: s.label,
    orderCount: s.orderCount,
    bundles: s.bundles.map((b) => ({
      key: b.key,
      items: b.items,
      cats: b.items.map((i) => categoryOf[i] || '未分类'),
      listPrice: b.items.reduce((sum, i) => sum + (priceOf[i] || 0), 0),
      support: b.support,
      confidence: b.confidence,
      lift: b.lift,
      antecedent: b.antecedent,
      consequent: b.consequent,
      hitOrders: b.hitOrders,
      matchedOrders: b.matchedOrders,
      hitAOV: b.hitAOV,
      overallAOV: b.overallAOV,
      aovDelta: b.aovDelta,
      groupShare: b.groupShare,
      dominantDaypart: b.dominantDaypart,
      dominantDaypartShare: b.dominantDaypartShare,
    })),
  }));

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Bundles</div>
        <h1>经常一起买的组合</h1>
        <p>
          用关联规则从订单里挖出共现显著高于随机的商品对和三元组。lift 是核心指标：买了 A 的人买 B 的概率，
          是所有人买 B 概率的几倍。lift = 1 是巧合，lift &lt; 1.2 的直接不显示。
        </p>
      </div>
      <BundleTable segments={payload} />
    </>
  );
}
