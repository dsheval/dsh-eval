import { ReportHeading } from './ReportElements';
import type { ResearchCondition, ResearchRecord } from '../data/deep-research';

const taskNames: Record<string, string> = {
  R1: '事实检索',
  R3: '多跳检索',
  R6: '健康主题报告',
  R7: '金融主题报告',
  R10: '研究交付诊断',
};
const statuses: Record<string, string> = {
  PASS: '通过', PARTIAL: '部分完成', FAIL: '失败', SYSTEM_ERROR: '系统错误',
  NOT_SCORED: '未评分', GRADER_ERROR: '评分错误', OUT_OF_SCOPE: '范围外',
};
const uplifts: Record<string, string> = {
  POSITIVE: '优于原生基线', NO_CLEAR: '无明显变化',
  NEGATIVE: '低于原生基线', NOT_COMPARABLE: '不作增量比较',
};
const budgetLabels: Record<string, string> = {
  SEARCH_BUDGET_EXCEEDED: '搜索次数达到上限',
  RESEARCH_TOOL_BUDGET_EXCEEDED: '研究工具调用达到上限',
  NO_PROGRESS_TIMEOUT: '长时间无进展',
  DUPLICATE_QUERY_BUDGET_EXCEEDED: '重复查询达到上限',
  TASK_TIME_BUDGET_EXCEEDED: '运行时间达到上限',
};
const number = (n: number | null) => n == null ? '—' : n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
const minutes = (n: number | null) => n == null ? '—' : `${(n / 60000).toFixed(1)} 分钟`;
const percent = (n: number | null) => n == null ? '—' : `${(n * 100).toFixed(1)}%`;

export default function DeepResearchBenchmark({ conditions, records }: {
  conditions: ResearchCondition[];
  records: ResearchRecord[];
}) {
  return (
    <section className="research-benchmark" aria-labelledby="research-results-title">
      <ReportHeading id="research-results-title" title="结果对比" sample="点击插件查看详情" />
      <div className="research-overview report-result-surface" aria-label="检索与报告通过情况">
        <div className="research-overview-head" aria-hidden="true">
          <span>参评插件</span><span>检索通过 / 2 题</span><span>报告通过 / 2 题</span><span />
        </div>
        {conditions.map(condition => {
          const baseline = condition.condition === 'C0';
          const name = baseline ? 'DSH 原生基线' : condition.plugin;
          const rows = records.filter(r => r.condition === condition.condition);
          return (
            <details className={`research-plugin${baseline ? ' research-plugin-baseline' : ''}`} key={condition.condition}>
              <summary className="research-plugin-summary">
                <span className="research-plugin-name"><strong>{name}</strong>{baseline ? <small data-site-copy="note">不安装研究插件</small> : null}</span>
                <span className="research-task-cell"><span className="research-mobile-label">检索通过 / 2 题</span><strong>{condition.sfPassed} / 2</strong></span>
                <span className="research-task-cell"><span className="research-mobile-label">报告通过 / 2 题</span><strong>{condition.lfPassed} / 2</strong><small>{condition.lfPartial} 题部分完成</small></span>
                <span className="research-expand" aria-label="展开或收起详情">+</span>
              </summary>
              <div className="research-plugin-detail">
                <h3 data-site-title="minor">{name} · 任务与资源明细</h3>
                <div className="research-task-list">
                  {rows.map(record => (
                    <section className={`research-task-card${record.taskId === 'R10' ? ' research-task-derived' : ''}`} key={record.taskId}>
                      <header>
                        <h4>{taskNames[record.taskId]}</h4>
                        <span className={`research-task-status status-${record.status.toLowerCase()}`}>{statuses[record.status] ?? record.status}</span>
                      </header>
                      {record.taskId === 'R10' ? <p data-site-copy="note">复用健康报告的派生诊断，不计入上方四项独立任务。</p> : null}
                        <p data-site-copy="note">{uplifts[record.uplift]}</p>
                        <dl className="research-metrics">
                          <div><dt>耗时</dt><dd>{minutes(record.latencyMs)}</dd></div>
                          <div><dt>总 Token</dt><dd>{number(record.tokens)}</dd></div>
                          <div><dt>工具 / 搜索调用</dt><dd>{number(record.tools)} / {number(record.search)}</dd></div>
                          <div><dt>可打开 / 已检查链接</dt><dd>{number(record.openUrls)} / {number(record.checkedUrls)}</dd></div>
                          <div><dt>引用忠实度</dt><dd>{percent(record.faithfulness)}</dd></div>
                        </dl>
                        <p data-site-copy="note">{record.reused ? '复用上一批已验证的记录。' : '本轮重新运行的多跳检索题。'}{record.taskId === 'R10' ? ' 派生诊断的耗时和 Token 不适用。' : ` 运行保护：${record.budget ? budgetLabels[record.budget] ?? record.budget : '未触发'}。`}</p>
                    </section>
                  ))}
                </div>
                <div className="research-plugin-metrics">
                  <h3 data-site-title="minor">{baseline ? '原生基线的运行指标' : '与原生能力相比'}</h3>
                  {baseline ? <p data-site-copy="note">原生基线不参与排名，也不与自身计算增量。</p> : <p className="research-uplift"><strong>{condition.positive}</strong> 项更好<span> / </span><strong>{condition.noClear}</strong> 项无明显变化<span> / </span><strong>{condition.negative}</strong> 项更差</p>}
                  <dl className="research-metrics">
                    <div><dt>每题平均耗时</dt><dd>{minutes(condition.latencyMs)}</dd></div>
                    <div><dt>每题平均总 Token</dt><dd>{number(condition.tokens)}</dd></div>
                    <div><dt>引用忠实度</dt><dd>{percent(condition.faithfulness)}</dd></div>
                    <div><dt>系统失败率</dt><dd>{percent(condition.failureRate)}</dd></div>
                  </dl>
                  <p className="research-metric-note" data-site-copy="note">增量与引用忠实度沿用原榜单，包含研究交付诊断；耗时与 Token 均值只统计实际运行的题目，不包含全部已丢弃尝试和评分模型用量。系统失败率仅统计最终保留记录。</p>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <p className="research-table-note" data-site-copy="note">部分完成不计为通过。原生基线不参与排名。</p>
    </section>
  );
}
