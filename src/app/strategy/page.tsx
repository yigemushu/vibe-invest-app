"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type BucketConfig = {
  id: string;
  nameEn: string;
  nameZh: string;
  target: string;
  investable: boolean;
  paused: boolean;
};

const initialBuckets: BucketConfig[] = [
  { id: "B1", nameEn: "US Broad Index", nameZh: "美股宽基", target: "30", investable: true, paused: false },
  { id: "B2", nameEn: "Tech / AI", nameZh: "科技 / AI", target: "20", investable: true, paused: false },
  { id: "B3", nameEn: "High Growth Theme", nameZh: "高成长主题", target: "15", investable: true, paused: false },
  { id: "B4", nameEn: "Value / Dividend", nameZh: "价值 / 分红", target: "10", investable: true, paused: false },
  { id: "B5", nameEn: "Resources / Cyclical", nameZh: "资源 / 周期", target: "10", investable: true, paused: false },
  { id: "B6", nameEn: "Gold", nameZh: "黄金", target: "5", investable: true, paused: false },
  { id: "B7", nameEn: "Bonds / Cash-like", nameZh: "债券 / 类现金", target: "5", investable: true, paused: false },
  { id: "B8", nameEn: "Cash", nameZh: "现金", target: "5", investable: false, paused: false },
];

export default function StrategyPage() {
  const [buckets, setBuckets] = useState<BucketConfig[]>(initialBuckets);
  const [defaultMode, setDefaultMode] = useState("balanced");
  const [minContribution, setMinContribution] = useState("50");
  const [minOrder, setMinOrder] = useState("1");
  const [remainderDestination, setRemainderDestination] = useState("B1");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");

  const totalTarget = useMemo(() => {
    return buckets.reduce((sum, bucket) => {
      const value = bucket.target.trim() === "" ? 0 : Number(bucket.target);
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
  }, [buckets]);

  const investablePausedCount = useMemo(() => {
    return buckets.filter((b) => b.investable && b.paused).length;
  }, [buckets]);

  const totalTargetValid = totalTarget === 100;

  function updateTarget(id: string, value: string) {
    setBuckets((prev) =>
      prev.map((bucket) =>
        bucket.id === id ? { ...bucket, target: value } : bucket
      )
    );
  }

  function togglePaused(id: string) {
    setBuckets((prev) =>
      prev.map((bucket) =>
        bucket.id === id ? { ...bucket, paused: !bucket.paused } : bucket
      )
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadStrategy() {
      setLoading(true);
      setError("");
      setSavedMessage("");

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

      const { data, error: loadError } = await supabase
        .from("strategy_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (loadError) {
        if (!cancelled) {
          setError(`Failed to load strategy. / 读取策略失败：${loadError.message}`);
          setLoading(false);
        }
        return;
      }

      if (data && !cancelled) {
        if (Array.isArray(data.bucket_targets)) {
          setBuckets(
            data.bucket_targets.map((item: BucketConfig) => ({
              ...item,
              target: String(item.target ?? ""),
            }))
          );
        }

        setDefaultMode(data.default_mode ?? "balanced");
        setMinContribution(String(data.min_contribution ?? "50"));
        setMinOrder(String(data.min_order ?? "1"));
        setRemainderDestination(data.remainder_destination ?? "B1");
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    loadStrategy();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSaveStrategy() {
    setError("");
    setSavedMessage("");

    if (!totalTargetValid) {
      setError("Total target weight should equal 100%. / 总目标比例必须等于 100%。");
      return;
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    const user = session?.user ?? null;

    if (sessionError || !user) {
      setError("Please sign in first. / 请先登录。");
      return;
    }

    const payload = {
      user_id: user.id,
      bucket_targets: buckets.map((bucket) => ({
        ...bucket,
        target: Number(bucket.target || 0),
      })),
      default_mode: defaultMode,
      min_contribution: Number(minContribution || 0),
      min_order: Number(minOrder || 0),
      remainder_destination: remainderDestination,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: checkError } = await supabase
      .from("strategy_settings")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (checkError) {
      setError(`Save failed. / 保存失败：${checkError.message}`);
      return;
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("strategy_settings")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) {
        setError(`Save failed. / 保存失败：${updateError.message}`);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("strategy_settings")
        .insert(payload);

      if (insertError) {
        setError(`Save failed. / 保存失败：${insertError.message}`);
        return;
      }
    }

    setSavedMessage("Strategy settings saved successfully. / 策略设置保存成功。");
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Strategy / 策略</h1>
          <p className="page-subtitle">
            Configure targets and allocation rules / 配置目标比例与分配规则
          </p>
        </div>
      </header>

      <section className="content-grid strategy-grid">
        <div className="panel large-panel">
          <div className="panel-header">
            <h2>Bucket Target Weights / Bucket 目标权重</h2>
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

            <div className="strategy-summary-bar">
              <div className="summary-chip">
                <span>Total Target / 总目标权重</span>
                <strong className={totalTargetValid ? "ok-text" : "warn-text"}>
                  {totalTarget.toFixed(2)}%
                </strong>
              </div>

              <div className="summary-chip">
                <span>Paused Investable Buckets / 暂停的可投资板块</span>
                <strong>{investablePausedCount}</strong>
              </div>

              <div className="summary-chip">
                <span>Remainder Destination / 余数去向</span>
                <strong>{remainderDestination}</strong>
              </div>
            </div>

            <div className="bucket-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bucket / 板块</th>
                    <th>Investable / 可投资</th>
                    <th>Target % / 目标比例</th>
                    <th>Paused / 暂停</th>
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
                          className="table-input short-input"
                          type="number"
                          step="0.01"
                          value={bucket.target}
                          onChange={(e) => updateTarget(bucket.id, e.target.value)}
                          disabled={loading}
                        />
                      </td>
                      <td>
                        {bucket.investable ? (
                          <label className="toggle-row">
                            <input
                              type="checkbox"
                              checked={bucket.paused}
                              onChange={() => togglePaused(bucket.id)}
                              disabled={loading}
                            />
                            <span>{bucket.paused ? "Paused / 暂停" : "Active / 启用"}</span>
                          </label>
                        ) : (
                          <span className="muted">Not applicable / 不适用</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!totalTargetValid && (
              <div className="error-box">
                Total target weight should equal 100%.
                <br />
                总目标比例应当等于 100%。
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Allocation Rules / 分配规则</h2>
          </div>

          <div className="panel-body">
            <div className="field-group">
              <label className="field-label">
                Default Allocation Mode / 默认分配模式
              </label>
              <select
                className="field-input"
                value={defaultMode}
                onChange={(e) => setDefaultMode(e.target.value)}
                disabled={loading}
              >
                <option value="aggressive">Aggressive 60 / 25 / 15 / 激进</option>
                <option value="balanced">Balanced 50 / 30 / 20 / 稳健</option>
                <option value="conservative">Conservative 40 / 35 / 25 / 保守</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">
                Minimum Contribution (USD) / 最低投入
              </label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                value={minContribution}
                onChange={(e) => setMinContribution(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                Minimum Order (USD) / 最低下单金额
              </label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                Remainder Destination / 余数去向
              </label>
              <select
                className="field-input"
                value={remainderDestination}
                onChange={(e) => setRemainderDestination(e.target.value)}
                disabled={loading}
              >
                <option value="B1">B1 · US Broad Index / 美股宽基</option>
              </select>
            </div>

            <div className="rules-box">
              <div className="rules-row">
                <span>Blank holding input / 空持仓输入</span>
                <strong>Treated as 0 / 按 0 处理</strong>
              </div>
              <div className="rules-row">
                <span>Top 3 selection / Top3 选择</span>
                <strong>Gap &gt; 0 only / 只选 gap &gt; 0</strong>
              </div>
              <div className="rules-row">
                <span>Rounding difference / 舍入误差</span>
                <strong>Assigned to Top1 / 分配给 Top1</strong>
              </div>
              <div className="rules-row">
                <span>Cash bucket / 现金 bucket</span>
                <strong>Status only / 仅状态位</strong>
              </div>
            </div>

            <div className="action-row">
              <button
                className="primary-btn"
                onClick={handleSaveStrategy}
                disabled={loading}
              >
                Save Strategy / 保存策略
              </button>
            </div>

            {savedMessage && <div className="success-box">{savedMessage}</div>}
            {error && <div className="error-box">{error}</div>}
          </div>
        </div>
      </section>
    </>
  );
}