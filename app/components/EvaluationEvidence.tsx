import { ReportStatus } from './ReportElements';
import memoryBenchmark from '../data/memory/locomo20-2026-08-28.json';

const evaluationSteps = [
  ['固定测试条件', 'Agent 版本、运行环境、题集和评分规则，都在测试开始前锁定。'],
  ['执行并记录', '让 Agent 完成真实任务，保留操作过程、状态变化和最终输出。'],
  ['复查并评分', '按照预先公开的规则核对完整记录，再计算测试结果。'],
  ['公开可复查', '发布得分、限制和复查材料；证据不足则明确标记“无法评测”。'],
];

const trustLevels = [
  ['01', 'REGISTERED', '已收录', '身份、版本和基本信息已经登记。'],
  ['02', 'RUNNABLE', '可运行', '已经在标准 DSH 运行环境中成功调用。'],
  ['03', 'EVALUATED', '已完成测试', '已经按统一方案完成测试，并生成完整记录。'],
  ['04', 'SELF-TESTED', '已提交自测', '开发者已经提交注明测试环境、可复现的自测结果。'],
  ['05', 'VERIFIED', '已独立复测', '关键结果已经在独立环境中复测确认。'],
];

const currentTestSteps = [
  ['01', '清理环境', '清除上一题留下的文件与会话。'],
  ['02', '会话 A · 提供信息', '提供相同的原始对话，两组仅在记忆提示上不同。'],
  ['03', '关闭并重启', '正常关闭 DSH，等待记忆写入后重新启动。'],
  ['04', '会话 B · 提问', '在新会话中提出同一道题。'],
  ['05', '按标准答案评分', '核对标准答案和必需信息，不使用 LLM 评分。'],
];

export default function EvaluationEvidence() {
  return (
    <section className="proof-section" id="result-evidence">
      <ReportStatus evidence="0 次评测故障，结果数据与评测代码已公开。" limitation="同一组 20 道题、两种提示方式；结果仅适用于本轮环境，部分 Agent 共享核心实现。" />

      <details className="verification-disclosure" id="evaluation-pipeline">
        <summary>
          <div><h2 className="verification-disclosure-title" data-site-title="minor">评测与验证说明</h2><b>测试方法、证据与适用范围</b></div>
          <i aria-hidden="true">+</i>
        </summary>
        <div className="verification-content">
          <section className="verification-block" aria-labelledby="verification-test-title">
            <header><span data-site-label="section" lang="en">CURRENT TEST</span><h3 id="verification-test-title" data-site-title="group">本次测试怎样执行</h3></header>
            <div className="verification-test-body">
              <p className="verification-intro" data-site-copy="body">两组使用同一组 {memoryBenchmark.sampleSizePerTrack} 道题、同一模型和运行环境，只改变是否提醒 Agent 使用记忆。</p>
              <dl className="verification-track-rows" aria-label="两种提示方式说明">
                <div><dt>无提示</dt><dd data-site-copy="body">直接提供对话和问题，不要求保存或检索记忆。</dd></div>
                <div><dt>有提示</dt><dd data-site-copy="body">只增加通用记忆提示，不透露工具名、答案或历史会话 ID。</dd></div>
              </dl>
              <ol className="verification-run-sequence" role="list" aria-label="本次测试执行顺序">
                {currentTestSteps.map(([number, title, description]) => (
                  <li key={number}><span aria-hidden="true">{number}</span><strong>{title}</strong><p data-site-copy="body">{description}</p></li>
                ))}
              </ol>
              <a className="verification-protocol-link" href="/methodology/memory">查看完整评测方法 <span aria-hidden="true">→</span></a>
            </div>
          </section>

          <section className="verification-block" aria-labelledby="verification-review-title">
            <header><span data-site-label="section" lang="en">REVIEW METHOD</span><h3 id="verification-review-title" data-site-title="group">结果如何复查</h3></header>
            <dl className="verification-review-list">
              {evaluationSteps.map(([title, copy]) => (
                <div key={title}><dt>{title}</dt><dd data-site-copy="body">{copy}</dd></div>
              ))}
            </dl>
          </section>

          <section className="verification-block" aria-labelledby="verification-levels-title">
            <header><span data-site-label="section" lang="en">VERIFICATION LEVELS</span><h3 id="verification-levels-title" data-site-title="group">当前验证到哪一步</h3><p data-site-copy="note">本次为 Level 03。<br />关键结果尚待独立环境复测。</p></header>
            <div>
              <ol className="verification-level-list" role="list">
                {trustLevels.map(([number, name, label, copy]) => (
                  <li key={name}>
                    <span className="verification-level-number">Level {number}</span>
                    <div>
                      <div className="verification-level-heading"><h4 data-site-title="minor">{label}</h4>{number === '03' ? <span className="verification-current-marker">本次等级</span> : null}</div>
                      <p data-site-copy="note">{copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="verification-reading-notes">
                <p data-site-copy="body"><b>证据不足</b>缺少关键记录时标记“无法评测”，不把它当作零分。</p>
                <p data-site-copy="body"><b>安全边界</b>评测通过不等于可以安全使用；权限与高风险操作需单独检查。</p>
              </div>
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}
