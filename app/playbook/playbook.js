'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildLLMPrompt } from '@/lib/playbook';

const yuan = (v) => `¥${Number(v).toFixed(1)}`;
const pct = (v, d = 1) => `${(Number(v) * 100).toFixed(d)}%`;

const LS_KEY = 'bundle-lab:llm';
const LEVEL_TAG = { ok: 'tag-good', warn: 'tag-warn', bad: 'tag-bad' };
const LEVEL_LABEL = { ok: '无已知风险', warn: '注意', bad: '不建议' };

export default function Playbook({ structured, template }) {
  const [useLLM, setUseLLM] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cfg, setCfg] = useState({ baseUrl: '', apiKey: '', model: '' });
  const [llmText, setLlmText] = useState('');
  const [status, setStatus] = useState({ state: 'idle', msg: '' });
  const [copied, setCopied] = useState(false);

  // key 只存访客自己的浏览器，不上传、不进构建产物
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setCfg(saved);
        setUseLLM(Boolean(saved.apiKey));
      }
    } catch {}
  }, []);

  const saveCfg = (next) => {
    setCfg(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {}
  };

  const text = useLLM && llmText ? llmText : template;
  const source = useLLM && llmText ? 'llm' : 'template';

  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playbook.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatus({ state: 'err', msg: '复制失败，浏览器拒绝了剪贴板权限。可以点导出下载。' });
    }
  };

  const polish = async () => {
    if (!cfg.apiKey) {
      setStatus({ state: 'err', msg: '还没填 key。点右上角设置填入你自己的 OpenAI 兼容接口信息。' });
      return;
    }
    setStatus({ state: 'loading', msg: '正在请求模型…' });
    try {
      const base = cfg.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'user', content: buildLLMPrompt(structured) }],
          temperature: 0.3,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status} ${t.slice(0, 200)}`);
      }
      const j = await res.json();
      const out = j?.choices?.[0]?.message?.content;
      if (!out) throw new Error('返回里没有 content 字段');
      setLlmText(out);
      setStatus({ state: 'ok', msg: '已由模型润色。数字与模板一致，措辞是模型改的。' });
    } catch (e) {
      setLlmText('');
      setStatus({ state: 'err', msg: `调用失败：${e.message}。已回退到模板生成。` });
    }
  };

  return (
    <>
      <div className="card card-tight" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`tag ${source === 'llm' ? 'tag-good' : 'tag-mute'}`}>
          {source === 'llm' ? '模型润色' : '模板生成'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
          {source === 'llm' ? '措辞由模型改写，数字未改动' : '无 key 时的默认输出，规则直接拼接'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setShowSettings((v) => !v)}>
            设置模型
          </button>
          {useLLM && (
            <button className="btn" onClick={polish} disabled={status.state === 'loading'}>
              {status.state === 'loading' ? '请求中…' : '重新润色'}
            </button>
          )}
          <button className="btn" onClick={copy}>
            {copied ? '已复制' : '复制'}
          </button>
          <button className="btn" data-on onClick={download}>
            导出 Markdown
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 className="sub">模型设置（BYO-key）</h3>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
            key 只存在你这台机器的 localStorage 里，请求由浏览器直连你填的接口，不经过本站服务器。
            留空则一直用模板生成。
          </p>
          <div className="grid g3" style={{ gap: 12 }}>
            <div>
              <label className="fld">Base URL</label>
              <input
                type="text"
                placeholder="https://your-endpoint/v1"
                value={cfg.baseUrl}
                onChange={(e) => saveCfg({ ...cfg, baseUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="fld">API Key</label>
              <input
                type="text"
                placeholder="sk-..."
                value={cfg.apiKey}
                onChange={(e) => {
                  const next = { ...cfg, apiKey: e.target.value };
                  saveCfg(next);
                  setUseLLM(Boolean(next.apiKey));
                }}
              />
            </div>
            <div>
              <label className="fld">模型名</label>
              <input
                type="text"
                placeholder="gpt-4o-mini / claude-haiku-4-5 ..."
                value={cfg.model}
                onChange={(e) => saveCfg({ ...cfg, model: e.target.value })}
              />
            </div>
          </div>
          <div className="grid g2" style={{ gap: 12, marginTop: 12 }}>
            <div className="note">
              任何兼容 OpenAI Chat Completions 协议的服务都能用，不绑定厂商。
              提示词里明确要求「数字一个字都不许改」，但模型仍可能出错 —— 所以导出前建议对照上方模板核一遍数字。
            </div>
            <div className="note">
              不会自动调用。填完 key 后要点「重新润色」才发请求，避免浏览器一打开就产生费用。
            </div>
          </div>
        </div>
      )}

      {status.msg && (
        <div className={`note ${status.state === 'err' ? 'note-warn' : 'note-accent'}`} style={{ marginBottom: 14 }}>
          {status.msg}
        </div>
      )}

      {/* —— 结构化建议卡片 —— */}
      <h2 className="sec">建议条目</h2>
      {structured.actions.map((a, i) => (
        <div className="card" key={a.bundle} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>#{i + 1}</span>
            <span style={{ fontSize: 16.5, fontWeight: 620 }}>{a.bundle}</span>
            <span className="pill">lift {a.lift.toFixed(2)}</span>
            <span className="pill">覆盖 {a.matchedCount} 单</span>
            {a.breakEven !== null && <span className="pill">平衡采纳 {pct(a.breakEven)}</span>}
          </div>

          <div className="grid g3" style={{ gap: 12, marginBottom: 10 }}>
            <div className="metric card-tight" style={{ background: '#fcfbf9' }}>
              <div className="k">推给谁</div>
              <div style={{ fontSize: 13.5 }}>{a.audience.who}</div>
              <div className="n">{a.audience.when}</div>
            </div>
            <div className="metric card-tight" style={{ background: '#fcfbf9' }}>
              <div className="k">每被覆盖订单 Δ客单</div>
              <div className="v" style={{ fontSize: 18 }}>+{yuan(a.aovLift)}</div>
              <div className="n">中性采纳率 {pct(a.adoption, 0)}</div>
            </div>
            <div className="metric card-tight" style={{ background: '#fcfbf9' }}>
              <div className="k">每被覆盖订单 Δ毛利</div>
              <div className="v" style={{ fontSize: 18 }}>+{yuan(a.marginLift)}</div>
              <div className="n">原价 {yuan(a.listPrice)} → 套餐 {yuan(a.bundlePrice)}</div>
            </div>
          </div>

          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 8 }}>
            这批人原本在这几件上平均花 <b className="tnum">{yuan(a.partialSpend)}</b>，
            其中 <b className="tnum">{pct(a.hitRate)}</b> 本来就买齐整套。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {a.risks.map((r, k) => (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span className={`tag ${LEVEL_TAG[r.level]}`}>{LEVEL_LABEL[r.level]}</span>
                <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* —— 不建议 —— */}
      {structured.rejected.length > 0 && (
        <>
          <h2 className="sec">不建议做折扣套餐的</h2>
          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>组合</th>
                    <th className="num">命中率</th>
                    <th>原因</th>
                  </tr>
                </thead>
                <tbody>
                  {structured.rejected.slice(0, 10).map((b) => (
                    <tr key={b.items.join('+')}>
                      <td style={{ fontWeight: 550 }}>{b.items.join(' + ')}</td>
                      <td className="num">{pct(b.hitRate)}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{b.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* —— 已合并 —— */}
      {structured.dropped?.length > 0 && (
        <>
          <h2 className="sec">已合并的重复机会</h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginTop: -4 }}>
            这些组合与上面的建议共享大部分商品。把同一人群推两套套餐会互相抢生意，所以不单列。
          </p>
          <div className="card" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>组合</th>
                    <th>与谁重叠</th>
                  </tr>
                </thead>
                <tbody>
                  {structured.dropped.slice(0, 12).map((d) => (
                    <tr key={d.items.join('+')}>
                      <td>{d.items.join(' + ')}</td>
                      <td style={{ color: 'var(--ink-3)' }}>{d.overlapsWith.join(' + ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <h2 className="sec">导出预览</h2>
      <div className="card" style={{ padding: 0 }}>
        <pre
          style={{
            margin: 0,
            padding: 16,
            fontSize: 12.5,
            lineHeight: 1.6,
            fontFamily: 'var(--mono)',
            whiteSpace: 'pre-wrap',
            maxHeight: 460,
            overflow: 'auto',
            color: 'var(--ink-2)',
          }}
        >
          {text}
        </pre>
      </div>
    </>
  );
}
