"use client";
import { useEffect, useState } from "react";
import { SCENARIO_KEY, defaultScenario, decodeScenario } from "@/lib/scenario";
import { readProtectedDraft, writeProtectedDraft } from '@/lib/draft-guard';
export default function useScenario(bundles) {
  const [scenario, setScenario] = useState(() => defaultScenario(bundles));
  const [ready, setReady] = useState(false), [writeLocked, setWriteLocked] = useState(false),
    [notice, setNotice] = useState("仅保存当前浏览器的推演假设。");
  useEffect(() => {
    const loaded = readProtectedDraft(()=>globalThis.localStorage, SCENARIO_KEY, raw => decodeScenario(raw, bundles), () => defaultScenario(bundles));
    setScenario(loaded.value);setWriteLocked(loaded.writeLocked);
    setNotice(loaded.writeLocked ? '内置草稿无法恢复，已暂停自动保存；旧值未被覆盖，当前仍可推演和导出。' : '已准备本机假设，结果按当前模型计算。');
    const key = new URLSearchParams(location.search).get("bundle");
    if (key && bundles.some((b) => b.key === key))
      setScenario((s) => ({ ...s, pickKey: key }));
    setReady(true);
  }, [bundles]);
  useEffect(() => {
    if (!ready) return;
    const outcome = writeProtectedDraft(()=>globalThis.localStorage, SCENARIO_KEY, scenario, raw => decodeScenario(raw, bundles), writeLocked);
    if (outcome.reason === 'locked') setNotice('内置草稿无法恢复，已暂停自动保存；旧值未被覆盖，当前仍可推演和导出。');
    else if (outcome.reason === 'invalid') setNotice('内置输入尚未通过校验，上一份草稿未改写；请补全输入。');
    else if (outcome.reason === 'storage') setNotice('本地保存不可用，当前计算和导出仍可使用。');
  }, [scenario, ready, writeLocked, bundles]);
  return {
    scenario,
    setScenario,
    notice,
    writeLocked,
    resumeSaving() { setWriteLocked(false);setNotice('已选择用当前有效内置输入替换旧草稿。'); },
    reset() {
      setScenario(defaultScenario(bundles));
      setNotice(writeLocked ? '当前已恢复默认假设，旧草稿仍保持写锁；确认替换后才重新保存。' : '已恢复默认假设。');
    },
  };
}
