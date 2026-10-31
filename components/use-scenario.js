"use client";
import { useEffect, useState } from "react";
import { SCENARIO_KEY, defaultScenario, decodeScenario } from "@/lib/scenario";
export default function useScenario(bundles) {
  const [scenario, setScenario] = useState(() => defaultScenario(bundles));
  const [ready, setReady] = useState(false),
    [notice, setNotice] = useState("仅保存当前浏览器的推演假设。");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCENARIO_KEY),
        saved = decodeScenario(raw, bundles);
      if (saved) {
        setScenario(saved);
        setNotice("已恢复本机假设，结果按当前模型重算。");
      }
    } catch {
      setNotice("草稿无法恢复，使用默认假设；仍可推演和导出。");
    }
    const key = new URLSearchParams(location.search).get("bundle");
    if (key && bundles.some((b) => b.key === key))
      setScenario((s) => ({ ...s, pickKey: key }));
    setReady(true);
  }, [bundles]);
  useEffect(() => {
    if (!ready) return;
    try {
      decodeScenario(JSON.stringify(scenario), bundles);
      localStorage.setItem(SCENARIO_KEY, JSON.stringify(scenario));
    } catch {
      setNotice("本地保存不可用，当前计算和导出仍可使用。");
    }
  }, [scenario, ready]);
  return {
    scenario,
    setScenario,
    notice,
    reset() {
      setScenario(defaultScenario(bundles));
      setNotice("已恢复默认假设。");
    },
  };
}
