"use client";

// 改编自 OpenStock（https://github.com/Open-Dev-Society/OpenStock，AGPL-3.0，提交 855ca6af33ae0b86f8835ecda6c31707f4ec3891）的
// components/TradingViewWidget.tsx 与 hooks/useTradingViewWidget.tsx。调整：只允许 K 线脚本、加载失败与超时提示、
// 切换证券时清理旧组件、保留 TradingView 标识与外部查看链接。图中数据由 TradingView 在浏览器中加载，本系统不提取或存储。

import { useEffect, useRef, useState } from "react";

const SCRIPT_URL = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
const TIMEOUT_MS = 15_000;

export default function TradingViewChart({ tvSymbol, height = 520 }: { tvSymbol: string; height?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const externalUrl = `https://www.tradingview.com/symbols/${tvSymbol.replace(":", "-")}/`;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    setState("loading");
    el.innerHTML = '<div class="tradingview-widget-container__widget" style="width:100%;height:100%"></div>';
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onerror = () => setState("failed");
    script.innerHTML = JSON.stringify({
      symbol: tvSymbol,
      interval: "D",
      range: "12M", // 12 个月内 TradingView 使用日线；更长范围会自动切换为周线
      timezone: "exchange",
      theme: "dark",
      style: "1",
      locale: "zh_CN",
      backgroundColor: "#121821",
      gridColor: "rgba(255, 255, 255, 0.04)",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      save_image: false,
      calendar: false,
      details: false,
      autosize: true,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    // 外层脚本加载后会插入 iframe；超时仍没有 iframe 视为加载失败（组件内部的覆盖或权限提示由 TradingView 自行显示）
    const timer = window.setTimeout(() => setState(el.querySelector("iframe") ? "ready" : "failed"), TIMEOUT_MS);
    const observer = new MutationObserver(() => el.querySelector("iframe") && setState("ready"));
    observer.observe(el, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      el.innerHTML = "";
    };
  }, [tvSymbol, attempt]);

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded border border-[var(--border)]" style={{ height }}>
        <div ref={container} className="tradingview-widget-container h-full w-full" />
        {state !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--panel)] text-sm text-[var(--muted)]">
            {state === "loading" ? (
              <p>正在加载 TradingView 图表…</p>
            ) : (
              <>
                <p>TradingView 图表未能加载（脚本可能被网络或浏览器拦截）。下方的基本面图表不受影响。</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setAttempt((a) => a + 1)} className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text)]">
                    重试
                  </button>
                  <a href={externalUrl} target="_blank" rel="noreferrer" className="rounded border border-[var(--border)] px-3 py-1 text-[var(--text)]">
                    在 TradingView 查看
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        K 线由{" "}
        <a href={externalUrl} target="_blank" rel="noreferrer" className="underline">
          TradingView
        </a>{" "}
        提供，数据在浏览器中加载，本系统不提取或存储。
      </p>
    </div>
  );
}
