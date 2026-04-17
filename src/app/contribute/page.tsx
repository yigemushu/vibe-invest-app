"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type BucketFromStrategy = {
  id: string;
  nameEn: string;
  nameZh: string;
  target: number | string;
  investable: boolean;
  paused?: boolean;
};

type ModeKey = "aggressive" | "balanced" | "conservative";

const fallbackBuckets: BucketFromStrategy[] = [
  { id: "B1", nameEn: "US Broad Index", nameZh: "美股宽基", target: 30, investable: true, paused: false },
  { id: "B2", nameEn: "Tech / AI", nameZh: "科技 / AI", target: 20, investable: true, paused: false },
  { id: "B3", nameEn: "High Growth Theme", nameZh: "高成长主题", target: 15, investable: true, paused: false },
  { id: "B4", nameEn: "Value / Dividend", nameZh: "价值 / 分红", target: 10, investable: true, paused: false },
  { id: "B5", nameEn: "Resources / Cyclical", nameZh: "资源 / 周期", target: 10, investable: true, paused: false },
  { id: "B6", nameEn: "Gold", nameZh: "黄金", target: 5, investable: true, paused: false },
  { id: "B7", nameEn: "Bonds / Cash-like", nameZh: "债券 / 类现金", target: 5, investable: true, paused: false },
  { id: "B8", nameEn: "Cash", nameZh: "现金", target: 5, investable: false, paused: false },
];

const modeRatios: Record<ModeKey, number[]> = {
  aggressive: [0.6, 0.25, 0.15],
  balanced: [0.5, 0.3, 0.2],
  conservative: [0.4, 0.35, 0.25],
};

const modeLabels: Record<ModeKey, string> = {
  aggressive: "Aggressive 60 / 25 / 15 / 激进 60 / 25 / 15",
  balanced: "Balanced 50 / 30 / 20 / 稳健 50 / 30 / 20",
  conservative: "Conservative 40 / 35 / 25 / 保守 40 / 35 / 25",
};

function round2(num: number) {
  return Math.round(num * 100) / 100;
}

function formatMoney(num: number) {
  return `$${num.toFixed(2)}`;
}

export default function ContributePage() {
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [contribution, setContribution] = useState("");
  const [mode, setMode] = useState<ModeKey>("balanced");
  const [minContribution, setMinContribution] = useState(50);
  const [minOrder, setMinOrder] = useState(1);
  const [remainderDestination, setRemainderDestination] = useState("B1");

  const [buckets, setBuckets] = useState<BucketFromStrategy[]>(fallbackBuckets);
  const [positions, setPositions] = useState<Record<string, number>>({
    B1: 0,
    B2: 0,
    B3: 0,
    B4: 0,
    B5: 0,
    B6: 0,
    B7: 0,
    B8: 0,
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [result, setResult] = useState<null | {
    currentTotal: number;
    totalAfterContribution: number;
    suggestedBuy: {
      bucketId: string;
      bucket: string;
      bucketZh: string;
      rank: string;
      amount: number;
      reason: string;
    }[];
    tradeTicket: {
      action: string;
      bucket: string;
      bucketZh: string;
      amount: number;
      priority: number;
      status: string;
    }[];
    skippedSum: number;
  }>(null);

  const currentTotalPreview = useMemo(() => {
    return round2(
      Object.values(positions).reduce((sum, value) => sum + (Number(value) || 0), 0)
    );
  }, [positions]);

  useEffect(() => {
    let cancelled = false;

    async function loadContributeData() {
      setLoading(true);
      setError("");
      setMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (sessionError || !user) {
        if (!cancelled) {
          setError("Please sign in first. / 请先登录。");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setUserEmail(user.email ?? "");
      }

      const { data: portfolioData, error: portfolioError } = await supabase
        .from("portfolio_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (portfolioError) {
        if (!cancelled) {
          setError(`Failed to load portfolio. / 读取持仓失败：${portfolioError.message}`);
          setLoading(false);
        }
        return;
      }

      if (portfolioData?.holdings && !cancelled) {
        const loadedPositions: Record<string, number> = {
          B1: 0,
          B2: 0,
          B3: 0,
          B4: 0,
          B5: 0,
          B6: 0,
          B7: 0,
          B8: 0,
        };

        for (const key of Object.keys(loadedPositions)) {
          const value = portfolioData.holdings[key];
          loadedPositions[key] =
            value === undefined || value === null || isNaN(Number(value))
              ? 0
              : Number(value);
        }

        setPositions(loadedPositions);
      }

      const { data: strategyData, error: strategyError } = await supabase
        .from("strategy_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (strategyError) {
        if (!cancelled) {
          setError(`Failed to load strategy. / 读取策略失败：${strategyError.message}`);
          setLoading(false);
        }
        return;
      }

      if (strategyData && !cancelled) {
        if (Array.isArray(strategyData.bucket_targets)) {
          setBuckets(
            strategyData.bucket_targets.map((item: BucketFromStrategy) => ({
              ...item,
              target: Number(item.target || 0),
              paused: Boolean(item.paused),
            }))
          );
        }

        if (
          strategyData.default_mode === "aggressive" ||
          strategyData.default_mode === "balanced" ||
          strategyData.default_mode === "conservative"
        ) {
          setMode(strategyData.default_mode);
        }

        setMinContribution(Number(strategyData.min_contribution ?? 50));
        setMinOrder(Number(strategyData.min_order ?? 1));
        setRemainderDestination(strategyData.remainder_destination ?? "B1");
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    loadContributeData();

    return () => {
      cancelled = true;
    };
  }, []);

  function generatePlan() {
    setError("");
    setMessage("");
    setResult(null);

    const contributionNum =
      contribution.trim() === "" ? 0 : Number(contribution.trim());

    if (isNaN(contributionNum) || contributionNum < minContribution) {
      setError(
        `Minimum contribution is ${formatMoney(
          minContribution
        )}. / 最低投入金额为 ${formatMoney(minContribution)}`
      );
      return;
    }

    const currentTotal = round2(
      Object.values(positions).reduce((sum, value) => sum + (Number(value) || 0), 0)
    );

    const totalAfterContribution = round2(currentTotal + contributionNum);

    const candidates = buckets
      .filter((b) => b.investable)
      .filter((b) => !b.paused)
      .map((b) => {
        const currentValue = Number(positions[b.id] || 0);
        const targetWeight = Number(b.target || 0) / 100;
        const currentWeight =
          totalAfterContribution === 0 ? 0 : currentValue / totalAfterContribution;
        const gap = targetWeight - currentWeight;

        return {
          ...b,
          currentValue,
          currentWeight,
          gap,
        };
      })
      .filter((b) => b.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    const top3 = candidates.slice(0, 3);

    if (top3.length === 0) {
      setError(
        "No underweight investable buckets found. / 没有找到低配且可投资的 bucket。"
      );
      return;
    }

    const ratios = modeRatios[mode];

    let suggestedBuy = top3.map((bucket, index) => ({
      bucketId: bucket.id,
      bucket: bucket.nameEn,
      bucketZh: bucket.nameZh,
      rank: `Top${index + 1}`,
      amount: round2(contributionNum * ratios[index]),
      reason: `Under target / 低于目标配比 (gap ${(bucket.gap * 100).toFixed(2)}%)`,
    }));

    const allocatedInitial = round2(
      suggestedBuy.reduce((sum, item) => sum + item.amount, 0)
    );

    const roundingDiff = round2(contributionNum - allocatedInitial);

    if (suggestedBuy.length > 0 && roundingDiff !== 0) {
      suggestedBuy[0].amount = round2(suggestedBuy[0].amount + roundingDiff);
    }

    let skippedSum = 0;

    let filtered = suggestedBuy.filter((item) => {
      if (item.amount < minOrder) {
        skippedSum = round2(skippedSum + item.amount);
        return false;
      }
      return true;
    });

    const usedAmount = round2(filtered.reduce((sum, item) => sum + item.amount, 0));
    const remainder = round2(contributionNum - usedAmount);

    if (remainder >= minOrder) {
      const destinationBucket = buckets.find((b) => b.id === remainderDestination);

      if (destinationBucket) {
        const existing = filtered.find((x) => x.bucketId === destinationBucket.id);

        if (existing) {
          existing.amount = round2(existing.amount + remainder);
          existing.reason = `${existing.reason} + remainder routed to ${destinationBucket.id} / 余数补到 ${destinationBucket.id}`;
        } else {
          filtered.push({
            bucketId: destinationBucket.id,
            bucket: destinationBucket.nameEn,
            bucketZh: destinationBucket.nameZh,
            rank: "Default / 默认",
            amount: remainder,
            reason: `Remainder routed to ${destinationBucket.id} / 余数补到 ${destinationBucket.id}`,
          });
        }
      }
    }

    filtered = filtered.sort((a, b) => b.amount - a.amount);

    const tradeTicket = filtered.map((item, index) => ({
      action: "BUY",
      bucket: item.bucket,
      bucketZh: item.bucketZh,
      amount: item.amount,
      priority: index + 1,
      status: "Pending / 待执行",
    }));

    setResult({
      currentTotal,
      totalAfterContribution,
      suggestedBuy: filtered,
      tradeTicket,
      skippedSum,
    });

    setMessage("Plan generated successfully. / 方案生成成功。");
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Contribute / 投入</h1>
          <p className="page-subtitle">
            Generate suggested buy from saved portfolio and strategy / 基于已保存的持仓与策略生成建议买入
          </p>
        </div>
      </header>

      <section className="content-grid contribute-grid">
        <div className="panel large-panel">
          <div className="panel-header">
            <h2>Contribution Input / 投入输入</h2>
          </div>

          <div className="panel-body">
            <div className="mini-summary" style={{ marginBottom: 18 }}>
              <div>
                <span className="mini-label">Current User / 当前用户</span>
                <strong>{userEmail || "Not signed in / 未登录"}</strong>
              </div>
              <div>
                <span className="mini-label">Load Status / 读取状态</span>
                <strong>{loading ? "Loading... / 加载中..." : "Ready / 已就绪"}</strong>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="field-label">
                  Contribution Amount (USD) / 新增资金
                </label>
                <input
                  className="field-input"
                  type="number"
                  step="0.01"
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  placeholder="e.g. 8000 / 例如 8000"
                  disabled={loading}
                />
              </div>

              <div className="field">
                <label className="field-label">
                  Allocation Mode / 分配模式
                </label>
                <select
                  className="field-input"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ModeKey)}
                  disabled={loading}
                >
                  <option value="aggressive">{modeLabels.aggressive}</option>
                  <option value="balanced">{modeLabels.balanced}</option>
                  <option value="conservative">{modeLabels.conservative}</option>
                </select>
              </div>
            </div>

            <div className="mini-summary">
              <div>
                <span className="mini-label">Current Total / 当前总持仓</span>
                <strong>{formatMoney(currentTotalPreview)}</strong>
              </div>
              <div>
                <span className="mini-label">Rules / 规则</span>
                <strong>
                  Min Contribution = {formatMoney(minContribution)} / 最低投入
                  <br />
                  Min Order = {formatMoney(minOrder)} / 最低下单
                </strong>
              </div>
            </div>

            <div className="subsection">
              <h3>Loaded Portfolio / 已读取持仓</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bucket / 板块</th>
                    <th>Holding / 持仓</th>
                    <th>Target / 目标</th>
                    <th>Status / 状态</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket) => (
                    <tr key={bucket.id}>
                      <td>
                        {bucket.id} · {bucket.nameEn} / {bucket.nameZh}
                      </td>
                      <td>{formatMoney(Number(positions[bucket.id] || 0))}</td>
                      <td>{Number(bucket.target || 0).toFixed(2)}%</td>
                      <td>
                        {bucket.investable
                          ? bucket.paused
                            ? "Paused / 暂停"
                            : "Active / 启用"
                          : "Status only / 状态位"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="action-row">
              <button
                className="primary-btn"
                onClick={generatePlan}
                disabled={loading}
              >
                Generate Suggested Buy / 生成建议买入
              </button>
            </div>

            {message && <div className="success-box">{message}</div>}
            {error && <div className="error-box">{error}</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Output / 输出结果</h2>
          </div>

          <div className="panel-body">
            {!result ? (
              <p className="muted">
                Your saved portfolio and strategy have been loaded.
                Enter contribution amount and generate a plan.
                <br />
                系统已读取你保存的持仓与策略。输入新增资金后即可生成方案。
              </p>
            ) : (
              <>
                <div className="result-summary">
                  <div className="summary-item">
                    <span>Current Total / 当前总持仓</span>
                    <strong>{formatMoney(result.currentTotal)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Total After Contribution / 投入后总额</span>
                    <strong>{formatMoney(result.totalAfterContribution)}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Mode / 模式</span>
                    <strong>{modeLabels[mode]}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Skipped Small Orders / 跳过小额订单</span>
                    <strong>{formatMoney(result.skippedSum)}</strong>
                  </div>
                </div>

                <div className="subsection">
                  <h3>Suggested Buy / 建议买入</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bucket / 板块</th>
                        <th>Rank / 排名</th>
                        <th>Amount / 金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.suggestedBuy.map((item) => (
                        <tr key={item.bucketId + item.rank}>
                          <td>
                            {item.bucket} / {item.bucketZh}
                          </td>
                          <td>{item.rank}</td>
                          <td>{formatMoney(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="subsection">
                  <h3>Trade Ticket / 下单清单</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Action / 动作</th>
                        <th>Bucket / 板块</th>
                        <th>Amount / 金额</th>
                        <th>Status / 状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.tradeTicket.map((item, index) => (
                        <tr key={item.bucket + index}>
                          <td>{item.action}</td>
                          <td>
                            {item.bucket} / {item.bucketZh}
                          </td>
                          <td>{formatMoney(item.amount)}</td>
                          <td>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}