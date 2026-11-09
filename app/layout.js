import "./globals.css";
import "./worksheet.css";
import "./scenario-craft.css";
import "./strategy-workbench.css";
import "./craft.css";
import "./product-depth.css";
import BundleHelp from "@/components/bundle-help";
import ExportReceipt from "@/components/export-receipt";
import "./demo-help.css";
import "./input-basis.css";
import Nav from "./nav";
import Link from "next/link";

export const metadata = {
  title: "套餐实验室 · Bundle Lab",
  description: "用商品和订单构成建立基线，分开核对新增贡献与既有让利，比较方案并带走验证计划。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-head">
          <div className="wrap site-head-inner">
            <Link className="brand" href="/">
              <svg className="bundle-mark" viewBox="0 0 26 26" aria-hidden="true"><path d="M4 5h18v16H4zM4 11h18M15 11v10" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 16h3M18 15h1M18 18h1" stroke="currentColor" strokeWidth="1.5"/></svg>套餐实验室<span>Bundle Lab</span>
            </Link>
            <Nav />
          </div>
        </header>
        <BundleHelp/>
        <main className="wrap">{children}</main>
        <ExportReceipt/>
        <footer className="wrap foot">
          内置订单为合成；手工或CSV基线仍需核实。所有收益数字是条件估算，不是业务预测。
          口径与默认值来源见「方法与假设」。{" "}
          <a href="https://andyzhang666666.github.io/#projects">返回作品集</a> ·{" "}
          <a href="https://github.com/AndyZhang666666/bundle-lab">查看源码</a>
        </footer>
      </body>
    </html>
  );
}
