import { dataset, rankedBundles } from "@/lib/dataset";
import Playbook from "./playbook";
export default function PlaybookPage() {
  const { orders } = dataset(),
    bundles = rankedBundles();
  return (
    <>
      <div className="page-head">
        <h1>套餐假设与验证清单</h1>
        <p>
          沿用收益推演的当前假设，筛选值得验证的组合。规则建议、结构化依据与模型润色分开，数字可以回到计算口径核对。
        </p>
      </div>
      <Playbook bundles={bundles} meta={{ orderCount: orders.length }} />
    </>
  );
}
