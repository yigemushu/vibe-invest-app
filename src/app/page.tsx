"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";

type PortfolioRow = {
  holdings: Record<string, number>;
  total_portfolio: number;
};

type StrategyBucket = {
  id: string;
  nameEn: string;
  nameZh: string;
  target: number;
  investable: boolean;
  paused?: boolean;
};

type StrategyRow = {
  bucket_targets: StrategyBucket[];
  default_mode: string;
  min_contribution: number;
  min_order: number;
  remainder_destination: string;
};

function formatMoney(num: number) {
  return `$${num.toFixed(2)}`;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();

  const [portfolio, setPortfolio] = useState<PortfolioRow | null>(null);
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (authLoading) return;

      setLoading(true);
      setError("");

      if (!user) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
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

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const investableTotal = useMemo(() => {
    if (!portfolio?.holdings) return 0;

    const investableIds = ["B1", "B2", "B3", "B4", "B5", "B6", "B7"];
    return investableIds.reduce((sum, id) => {
      const value = portfolio.holdings?.[id] ?? 0;
      return sum + Number(value || 0);
    }, 0);
  }, [portfolio]);

  const pausedCount = useMemo(() => {
    if (!strategy?.bucket_targets) return 0;

    return strategy.bucket_targets.filter(
      (bucket) => bucket.investable && bucket.paused
    ).length;
  }, [strategy]);

  const totalTarget = useMemo(() => {
    if (!strategy?.bucket_targets) return 0;

    return strategy.bucket_targets.reduce((sum, bucket) => {
      return sum + Number(bucket.target || 0);
    }, 0);
  }, [strategy]);

  const statCards = [
    {
      label: "Total Portfolio / 总持仓",
      value: portfolio ? formatMoney(Number(portfolio.total_portfolio || 0)) : "--",
    },
    {
      label: "Investable Total / 可投资部分",
      value: portfolio ? formatMoney(Number(investableTotal || 0)) : "--",
    },
    {
      label: "Default Mode / 默认模式",
      value: strategy?.default_mode
        ? strategy.default_mode
        : "--",
    },
    {
      label: "Rebalance Status / 再平衡状态",
      value: strategy ? "Ready / 已配置" : "Pending / 待配置",
    },
  ];

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Dashboard / 总览</h1>
          <p className="page-subtitle">
            Live overview of your investing system / 你的投资系统实时总览
          </p>
        </div>

        <div className="topbar-user">
          <div className="topbar-user-label">Current User / 当前用户</div>
          <div className="topbar-user-name">
            {user?.email || "Guest / 游客"}
          </div>
        </div>
      </header>

      <section className="stats-grid">
        {statCards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value}</div>
          </div>
        ))}
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="content-grid">
        <div className="panel large">
          <div className="panel-header">
            <h2>System Overview / 系统概览</h2>
          </div>
          <div className="panel-body">
            {authLoading || loading ? (
              <p className="muted">Loading dashboard... / 正在读取总览数据...</p>
            ) : !user ? (
              <p className="muted">
                Please sign in first to view your saved dashboard data.
                <br />
                请先登录后查看你的 Dashboard 数据。
              </p>
            ) : (
              <>
                <p className="muted">
                  This dashboard is now connected to your saved portfolio and strategy settings.
                  <br />
                  这个 Dashboard 现在已经连接到你保存的持仓与策略设置。
                </p>

                <div className="overview-list">
                  <div className="overview-row">
                    <span>Portfolio Loaded / 持仓读取</span>
                    <strong>{portfolio ? "Yes / 是" : "No / 否"}</strong>
                  </div>
                  <div className="overview-row">
                    <span>Strategy Loaded / 策略读取</span>
                    <strong>{strategy ? "Yes / 是" : "No / 否"}</strong>
                  </div>
                  <div className="overview-row">
                    <span>Total Target Weight / 总目标比例</span>
                    <strong>
                      {strategy ? `${Number(totalTarget).toFixed(2)}%` : "--"}
                    </strong>
                  </div>
                  <div className="overview-row">
                    <span>Paused Buckets / 暂停板块数</span>
                    <strong>{strategy ? pausedCount : "--"}</strong>
                  </div>
                  <div className="overview-row">
                    <span>Remainder Destination / 余数去向</span>
                    <strong>{strategy?.remainder_destination || "--"}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Allocation Rules / 分配规则</h2>
          </div>
          <div className="panel-body">
            <div className="overview-list">
              <div className="overview-row">
                <span>Min Contribution / 最低投入</span>
                <strong>
                  {strategy ? formatMoney(Number(strategy.min_contribution || 0)) : "--"}
                </strong>
              </div>
              <div className="overview-row">
                <span>Min Order / 最低下单</span>
                <strong>
                  {strategy ? formatMoney(Number(strategy.min_order || 0)) : "--"}
                </strong>
              </div>
              <div className="overview-row">
                <span>Top 3 Logic / Top3 逻辑</span>
                <strong>Underweight only / 只选低配</strong>
              </div>
              <div className="overview-row">
                <span>Cash Bucket / 现金板块</span>
                <strong>Status only / 仅状态位</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Build Progress / 开发进度</h2>
          </div>
          <div className="panel-body">
            <div className="status-row">
              <span>Auth / 登录系统</span>
              <strong>Ready / 已完成</strong>
            </div>
            <div className="status-row">
              <span>Portfolio Save / 持仓保存</span>
              <strong>Ready / 已完成</strong>
            </div>
            <div className="status-row">
              <span>Strategy Save / 策略保存</span>
              <strong>Ready / 已完成</strong>
            </div>
            <div className="status-row">
              <span>Contribute Engine / 投入计算引擎</span>
              <strong>Ready / 已完成</strong>
            </div>
            <div className="status-row">
              <span>Rebalance Engine / 再平衡引擎</span>
              <strong>Pending / 待完成</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}