import DemoUtilities from './demo-utilities';
export default function BundleHelp(){return <DemoUtilities project="bundle" name="Bundle Lab" steps={[
 {title:'先看输入的依据',description:'合成统计与用户假设分别标出；打开五项来源和验证方式。定位不替换你的算例。',target:'#input-basis summary',href:'/bundle-lab/simulate/#input-basis'},
 {title:'调一个条件，核对两笔账',description:'调整未买齐人群采纳率，看新增贡献能否抵消既有顾客让利；采用更多不代表赚得更多。',target:'input[aria-label="中档采纳率数值"]',href:'/bundle-lab/simulate/#scenario-input'},
 {title:'看盈亏线，带走假设卡',description:'结果区保留平衡采纳率、低中高三档及假设卡。A/B和敏感性预演在下方，预演需确认才应用。',target:'.assumption-export summary',href:'/bundle-lab/simulate/#scenario-result'},
 ]} about={{problem:'套餐卖得更多，可能只是给原本就买齐的人让利。本工具把未买齐者新增贡献与原买齐者损失拆开，让经营选择有账可查。',choices:'复用既有两类人群模型。先输入商品、优惠与采纳，再查成本、人群和领券假设；方案和敏感性格点都使用同一引擎。预演不直接改草稿。',boundary:'内置订单为合成，不是经营观测。用户输入也未认证；每100覆盖单是归一单位，毛利不含全部经营成本。不是价格弹性预测、因果实验或自动最优定价。',validation:'需要真实同口径订单核对基线，分开验证新增采纳与既有领券，再以对照实验检查净贡献。跨组合重叠、履约和库存等成本仍需补充。'}}/>;}
