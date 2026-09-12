import { dataset, rankedBundles } from '@/lib/dataset';
import { pickActions, actionOf, buildTemplate } from '@/lib/playbook';
import { DEFAULT_ADOPTION, DEFAULT_DISCOUNT, DEFAULT_COST_RATIO } from '@/lib/simulate';
import Playbook from './playbook';

export default function PlaybookPage() {
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
    rejected: picked.rejected.map((b) => ({
      items: b.items,
      hitRate: b.hitRate,
      reason: b.breakEven.reason,
    })),
    narrow: picked.narrow.map((b) => ({
      items: b.items,
      matchedCount: b.matchedCount,
      aovLift: b.scenarios.neutral.aovLift,
    })),
    dropped: picked.dropped.map((d) => ({ items: d.bundle.items, overlapsWith: d.overlapsWith })),
  };

  // 模板文本在服务端就拼好，客户端不再算一遍 —— 保证导出内容和页面显示的是同一份。
  // structured 已经是拍平过的形状，buildTemplate 和客户端组件共用同一份，
  // 不给模板单独传一份「另一种字段名」的数据，否则两边迟早走偏。
  const template = buildTemplate(structured);

  return (
    <>
      <div className="page-head">
        <div className="eyebrow">Playbook</div>
        <h1>一页纸：该推什么套餐</h1>
        <p>
          把前面挖出来的东西整理成运营能直接照着做的建议。默认是规则拼出来的（界面会标注「模板生成」）；
          想让它更像人话，可以在设置里填自己的模型 key，由模型润色 —— 但数字不会被改动。
        </p>
      </div>
      <Playbook structured={structured} template={template} />
    </>
  );
}
