# 本地真实浏览器证据 · 2026-11-09

来源：开发分支的生产静态构建，通过隔离Chrome实际操作，视口1280×960、390×960。时间与完整检查项见 `summary.json`。

- PNG：实际界面截图，包含验收用商品、方案及冻结计划。
- `assumptions.json` / `.md`：实际点击下载的当前假设卡。
- `comparison.json`：实际下载的A/B比较与冻结验证计划。
- `plan.md`：实际下载的单份计划及试验/对照观察。
- `storage-blocked-plan.json`：禁用localStorage时，从内存计划实际下载的文件。

所有订单与观察计数都是合成验收输入，不是真实商家数据、试验收益或用户任务完成率。没有调用付费模型。`output/playwright/product-depth-20261109/` 保留完整本机运行产物；此目录只收录最终通过的证据。
