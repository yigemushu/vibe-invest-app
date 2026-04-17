"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

type BucketHolding = {
  id: string;
  nameEn: string;
  nameZh: string;
  investable: boolean;
};

const buckets: BucketHolding[] = [
  { id: "B1", nameEn: "US Broad Index", nameZh: "美股宽基", investable: true },
  { id: "B2", nameEn: "Tech / AI", nameZh: "科技 / AI", investable: true },
  { id: "B3", nameEn: "High Growth Theme", nameZh: "高成长主题", investable: true },
  { id: "B4", nameEn: "Value / Dividend", nameZh: "价值 / 分红", investable: true },
  { id: "B5", nameEn: "Resources / Cyclical", nameZh: "资源 / 周期", investable: true },
  { id: "B6", nameEn: "Gold", nameZh: "黄金", investable: true },
  { id: "B7", nameEn: "Bonds / Cash-like", nameZh: "债券 / 类现金", investable: true },
  { id: "B8", nameEn: "Cash", nameZh: "现金", investable: false },
];

const emptyHoldings: Record<string, string> = {
  B1: "",
  B2: "",
  B3: "",
  B4: "",
  B5: "",
  B6: "",
  B7: "",
  B8: "",
};

function round2(num: number) {
  return Math.round(num * 100) / 100;
}

function formatMoney(num: number) {
  return `$${num.toFixed(2)}`;
}

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth();

  const [holdings, setHoldings] = useState<Record<string, string>>(emptyHoldings);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalPortfolio = useMemo(() => {
    return round2(
      buckets.reduce((sum, bucket) => {
        const raw = holdings[bucket.id];
        const value = raw === "" ? 0 : Number(raw);
        return sum + (isNaN(value) ? 0 : Math.max(0, value));
      }, 0)
    );
  }, [holdings]);

  const investableTotal = useMemo(() => {
    return round2(
      buckets
        .filter((bucket) => bucket.investable)
        .reduce((sum, bucket) => {
          const raw = holdings[bucket.id];
          const value = raw === "" ? 0 : Number(raw);
          return sum + (isNaN(value) ? 0 : Math.max(0, value));
        }, 0)
    );
  }, [holdings]);

  function updateHolding(bucketId: string, value: string) {
    setHoldings((prev) => ({
      ...prev,
      [bucketId]: value,
    }));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPortfolio() {
      if (authLoading) return;

      setLoading(true);
      setError("");
      setMessage("");

      if (!user) {
        if (!cancelled) {
          setError("Please sign in first. / 请先登录。");
          setLoading(false);
        }
        return;
      }

      const { data, error: loadError } = await supabase
        .from("portfolio_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (loadError) {
        if (!cancelled) {
          setError(`Failed to load portfolio. / 读取持仓失败：${loadError.message}`);
          setLoading(false);
        }
        return;
      }

      if (data?.holdings && !cancelled) {
        const loaded: Record<string, string> = { ...emptyHoldings };

        for (const bucket of buckets) {
          const rawValue = data.holdings[bucket.id];
          loaded[bucket.id] =
            rawValue === undefined || rawValue === null ? "" : String(rawValue);
        }

        setHoldings(loaded);
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    loadPortfolio();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  async function handleSavePortfolio() {
    setError("");
    setMessage("");

    if (!user) {
      setError("Please sign in first. / 请先登录。");
      return;
    }

    const normalizedHoldings: Record<string, number> = {};
    for (const bucket of buckets) {
      const raw = holdings[bucket.id];
      const value = raw === "" ? 0 : Number(raw);
      normalizedHoldings[bucket.id] = isNaN(value) ? 0 : Math.max(0, value);
    }

    const payload = {
      user_id: user.id,
      holdings: normalizedHoldings,
      total_portfolio: totalPortfolio,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: checkError } = await supabase
      .from("portfolio_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      setError(`Save failed. / 保存失败：${checkError.message}`);
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("portfolio_settings")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) {
        setError(`Save failed. / 保存失败：${updateError.message}`);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("portfolio_settings")
        .insert(payload);

      if (insertError) {
        setError(`Save failed. / 保存失败：${insertError.message}`);
        return;
      }
    }

    setMessage("Portfolio saved successfully. / 持仓保存成功。");
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Portfolio / 持仓</h1>
          <p className="page-subtitle">
            Manage current holdings by bucket / 按 bucket 管理当前持仓
          </p>
        </div>
      </header>

      <section className="content-grid portfolio-grid">
        <div className="panel large-panel">
          <div className="panel-header">
            <h2>Current Holdings / 当前持仓</h2>
          </div>

          <div className="panel-body">
            <p className="muted">
              Leave blank if not held. Blank will be treated as 0.
              <br />
              如果没有持有可以留空，系统会把空值按 0 处理。
            </p>

            <div className="mini-summary" style={{ marginBottom: 18 }}>
              <div>
                <span className="mini-label">Current User / 当前用户</span>
                <strong>{user?.email || "Not signed in / 未登录"}</strong>
              </div>
              <div>
                <span className="mini-label">Load Status / 读取状态</span>
                <strong>
                  {authLoading || loading ? "Loading... / 加载中..." : "Ready / 已就绪"}
                </strong>
              </div>
            </div>

            <div className="bucket-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bucket / 板块</th>
                    <th>Investable / 可投资</th>
                    <th>Current Holding (USD) / 当前持仓</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((bucket) => (
                    <tr key={bucket.id}>
                      <td>
                        <div className="bucket-cell">
                          <strong>{bucket.id}</strong>
                          <span>
                            {bucket.nameEn} / {bucket.nameZh}
                          </span>
                        </div>
                      </td>
                      <td>{bucket.investable ? "Yes / 是" : "No / 否"}</td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          step="0.01"
                          value={holdings[bucket.id]}
                          onChange={(e) => updateHolding(bucket.id, e.target.value)}
                          placeholder="blank = 0 / 留空=0"
                          disabled={authLoading || loading}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="action-row">
              <button
                className="primary-btn"
                onClick={handleSavePortfolio}
                disabled={authLoading || loading}
              >
                Save Portfolio / 保存持仓
              </button>
            </div>

            {message && <div className="success-box">{message}</div>}
            {error && <div className="error-box">{error}</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Portfolio Summary / 持仓摘要</h2>
          </div>

          <div className="panel-body">
            <div className="result-summary">
              <div className="summary-item">
                <span>Total Portfolio / 总持仓</span>
                <strong>{formatMoney(totalPortfolio)}</strong>
              </div>

              <div className="summary-item">
                <span>Investable Total / 可投资部分</span>
                <strong>{formatMoney(investableTotal)}</strong>
              </div>

              <div className="summary-item">
                <span>Cash Bucket / 现金 bucket</span>
                <strong>{formatMoney(Number(holdings.B8 || 0))}</strong>
              </div>

              <div className="summary-item">
                <span>Input Rule / 输入规则</span>
                <strong>Blank = 0 / 空=0</strong>
              </div>
            </div>

            <div className="rules-box">
              <div className="rules-row">
                <span>Cash bucket / 现金 bucket</span>
                <strong>Status only / 仅状态位</strong>
              </div>
              <div className="rules-row">
                <span>Used by contribute page / 用于投入页</span>
                <strong>Yes / 是</strong>
              </div>
              <div className="rules-row">
                <span>Save target / 保存目标</span>
                <strong>Supabase</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}