"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

type StrategyBucket = {
  id: string;
  nameEn: string;
  nameZh: string;
  target: number;
  investable: boolean;
  paused?: boolean;
};

type PortfolioRow = {
  holdings: Record<string, number>;
  total_portfolio: number;
};

type StrategyRow = {
  bucket_targets: StrategyBucket[];
  default_mode: string;
  min_contribution: number;
  min_order: number;
  remainder_destination: string;
};

type RebalanceItem = {
  id: string;
  nameEn: string;
  nameZh: string;
  currentValue: number;
  currentWeight: number;
  targetWeight: number;
  deviation: number;
  action: "Buy / 买入" | "Sell / 卖出" | "Hold / 保持";
  amount: number;
};

function round2(num: number) {
  return Math.round(num * 100) / 100;
}

function formatMoney(num: number) {
  return `$${num.toFixed(2)}`;
}

function formatPercent(num: number) {
  return `${num.toFixed(2)}%`;
}

export default function RebalancePage() {
  const { user, loading: authLoading } = useAuth();

  const [userEmail, setUserEmail] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRebalanceData() {
      if (authLoading) return;

      setLoading(true);
      setError("");

      if (!user) {
        if (!cancelled) {
          setError("Please sign in first. / 请先登录。");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setUserEmail(user.email ?? "");
      }

      const [{ data: portfolioData, error: portfolioError }, { data: strategyData, error: strategyError }] =
        await Promise.all([
          supabase
            .from("portfolio_settings")
            .select("holdings, total_portfolio")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("strategy_settings")
            .select("bucket_targets, default_mode, min_contribution, min_order, remainder_destination")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (portfolioError && !cancelled) {
        setError(`Failed to load portfolio. / 读取持仓失败：${portfolioError.message}`);
      }

      if (strategyError && !cancelled) {
        setError(`Failed to load strategy. / 读取策略失败：${strategyError.message}`);
      }

      if (!cancelled) {
        setPortfolio((portfolioData as PortfolioRow | null) ?? null);
        setStrategy((strategyData as StrategyRow | null) ?? null);
        setLoading(false);
      }
    }

    loadRebalanceData();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const rebalanceItems = useMemo<RebalanceItem[]>(() => {
    if (!portfolio?.holdings || !strategy?.bucket_targets) return [];

    const total = Number(portfolio.total_portfolio || 0);

    if (total <= 0) return [];

    return strategy.bucket_targets.map((bucket) => {
      const currentValue = Number(portfolio.holdings?.[bucket.id] || 0);
      const currentWeight = (currentValue / total) * 100;
      const targetWeight = Number(bucket.target || 0);
      const deviation = currentWeight - targetWeight;

      const targetValue = (targetWeight / 100) * total;
      const rawAmount = round2(Math.abs(targetValue - currentValue));

      let action: RebalanceItem["action"] = "Hold / 保持";

      if (deviation > 0.5) {
        action = "Sell / 卖出";
      } else if (deviation < -0.5) {
        action = "Buy / 买入";
      }

      return {
        id: bucket.id,
        nameEn: bucket.nameEn,
        nameZh: bucket.nameZh,
        currentValue: round2(currentValue),
        currentWeight: round2(currentWeight),
        targetWeight: round2(targetWeight),
        deviation: round2(deviation),
        action,
        amount: action === "Hold / 保持" ? 0 : rawAmount,
      };
    });
  }, [portfolio, strategy]);

  const totalBuy = useMemo(() => {
    return round2(
      rebalanceItems
        .filter((item) => item.action === "Buy / 买入")
        .reduce((sum, item) => sum + item.amount, 0)
    );
  }, [rebalanceItems]);

  const totalSell = useMemo(() => {
    return round2(
      rebalanceItems
        .filter((item) => item.action === "Sell / 卖出")
        .reduce((sum, item) => sum + item.amount, 0)
    );
  }, [rebalanceItems]);

  const overweightCount = useMemo(() => {
    return rebalanceItems.filter((item) => item.action === "Sell / 卖出").length;
  }, [rebalanceItems]);

  const underweightCount = useMemo(() => {
    return rebalanceItems.filter((item) => item.action === "Buy / 买入").length;
  }, [rebalanceItems]);

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Rebalance / 再平衡</h1>
          <p className="page-subtitle">
            Annual rebalance and sell-rule planning / 年度再平衡与卖出规则规划
          </p>
        </div>
      </header>

      <section className="content-grid rebalance-grid">
        <div className="panel large-panel">
          <div className="panel-header">
            <h2>Rebalance Analysis / 再平衡分析</h2>
          </div>

          <div className="panel-body">
            <div className="mini-summary" style={{ marginBottom: 18 }}>
              <div>
                <span className="mini-label">Current User / 当前用户</span>
                <strong>{user?.email || userEmail || "Not signed in / 未登录"}</strong>
              </div>
              <div>
                <span className="mini-label">Load Status / 读取状态</span>
                <strong>
                  {authLoading || loading ? "Loading... / 加载中..." : "Ready / 已就绪"}
                </strong>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            {!authLoading && !loading && !user && (
              <div className="error-box">
                Please sign in first to use rebalance.
                <br />
                请先登录后使用再平衡页面。
              </div>
            )}

            {!authLoading && !loading && user && (!portfolio || !strategy) && (
              <div className="error-box">
                Portfolio or strategy data is missing.
                <br />
                持仓或策略数据缺失，请先在 Portfolio 和 Strategy 页面保存数据。
              </div>
            )}

            {!authLoading && !loading && user && portfolio && strategy && (
              <>
                <p className="muted">
                  This page compares current portfolio weights with target weights and
                  shows simplified annual rebalance suggestions.
                  <br />
                  本页面会对比当前持仓占比与目标占比，并给出简化版年度再平衡建议。
                </p>

                <div className="bucket-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bucket / 板块</th>
                        <th>Current Value / 当前金额</th>
                        <th>Current Weight / 当前占比</th>
                        <th>Target Weight / 目标占比</th>
                        <th>Deviation / 偏差</th>
                        <th>Action / 动作</th>
                        <th>Suggested Amount / 建议金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rebalanceItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.id} · {item.nameEn} / {item.nameZh}
                          </td>
                          <td>{formatMoney(item.currentValue)}</td>
                          <td>{formatPercent(item.currentWeight)}</td>
                          <td>{formatPercent(item.targetWeight)}</td>
                          <td>{formatPercent(item.deviation)}</td>
                          <td>{item.action}</td>
                          <td>{item.amount > 0 ? formatMoney(item.amount) : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Rebalance Summary / 再平衡摘要</h2>
          </div>

          <div className="panel-body">
            <div className="result-summary">
              <div className="summary-item">
                <span>Total Portfolio / 总持仓</span>
                <strong>
                  {portfolio ? formatMoney(Number(portfolio.total_portfolio || 0)) : "--"}
                </strong>
              </div>

              <div className="summary-item">
                <span>Overweight Buckets / 超配板块</span>
                <strong>{overweightCount}</strong>
              </div>

              <div className="summary-item">
                <span>Underweight Buckets / 低配板块</span>
                <strong>{underweightCount}</strong>
              </div>

              <div className="summary-item">
                <span>Default Mode / 默认模式</span>
                <strong>{strategy?.default_mode || "--"}</strong>
              </div>
            </div>

            <div className="rules-box">
              <div className="rules-row">
                <span>Total Suggested Buy / 建议总买入</span>
                <strong>{formatMoney(totalBuy)}</strong>
              </div>
              <div className="rules-row">
                <span>Total Suggested Sell / 建议总卖出</span>
                <strong>{formatMoney(totalSell)}</strong>
              </div>
              <div className="rules-row">
                <span>Current Rule / 当前规则</span>
                <strong>Deviation &gt; 0.5% / 偏差超过 0.5%</strong>
              </div>
              <div className="rules-row">
                <span>Sell Rule Engine / 卖出规则引擎</span>
                <strong>Next Step / 下一步开发</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}