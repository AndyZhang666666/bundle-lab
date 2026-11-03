import {inputBasis} from '@/lib/input-basis';
export default function InputBasis({kind}){const rows=inputBasis(kind);return <div className="input-basis">
 <p><b>先核实假设，再看收益。</b> 当前没有已核验的真实观测值；输入数字或声明来源不自动证明真实性。</p>
 <details id="input-basis"><summary>这五个关键输入从哪来，怎么验证？</summary><dl>{rows.map(row=><div key={row.key}><dt>{row.label}<span>{row.status}</span></dt><dd>{row.verify}</dd></div>)}</dl></details>
 </div>;}
