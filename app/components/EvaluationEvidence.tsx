import memoryBenchmark from '../data/memory/locomo20-2026-08-28.json';

const evaluationSteps = [
  ['01', '固定测试条件', 'Agent 版本、运行环境、题集和评分规则，都在测试开始前锁定。'],
  ['02', '执行并记录', '让 Agent 完成真实任务，保留操作过程、状态变化和最终输出。'],
  ['03', '复查并评分', '按照预先公开的规则核对完整记录，再计算测试结果。'],
  ['04', '公开可复查', '发布得分、限制和复查材料；证据不足则明确标记“无法评测”。'],
];

const trustLevels = [
  ['01', 'REGISTERED', '已收录', '身份、版本和基本信息已经登记。'],
  ['02', 'RUNNABLE', '可运行', '已经在标准 DSH 运行环境中成功调用。'],
  ['03', 'EVALUATED', '已完成测试', '已经按统一方案完成测试，并生成完整记录。'],
  ['04', 'SELF-TESTED', '已提交自测', '开发者已经提交注明测试环境、可复现的自测结果。'],
  ['05', 'VERIFIED', '已独立复测', '关键结果已经在独立环境中复测确认。'],
];

const currentTestSteps = [
  ['01', '清理测试环境', '清空测试工作区，删除上一题留下的文件和会话。'],
  ['02', '会话 A：提供信息', '发送原始对话，两种模式只有附加提示不同。'],
  ['03', '重启环境', '正常关闭 DSH，等待数据写入后重新启动。'],
  ['04', '会话 B：提出问题', '在新会话中提出同一道题。'],
  ['05', '按标准答案评分', '只核对答案和必需信息，不使用 LLM 评分。'],
];

export default function EvaluationEvidence() {
  return (
    <section className="proof-section" id="result-evidence">
      <div className="proof-summary-compact">
        <div><h2>Level 03 · 已完成测试</h2></div>
        <p>0 次评测故障，结果数据与评测代码已公开；关键结果尚待独立环境复测。</p>
      </div>

      <details className="verification-disclosure" id="evaluation-pipeline">
        <summary>
          <div><span>评测与验证说明</span><b>查看测试如何执行、复查与分级</b></div>
          <i aria-hidden="true">+</i>
        </summary>
        <div className="verification-content">
          <section className="verification-block verification-current">
            <header><span>CURRENT TEST</span><h3>唯一变量：是否提醒 Agent 使用记忆。</h3><p>两组使用同一组 {memoryBenchmark.sampleSizePerTrack} 道题、同一模型和运行环境；提示不会透露工具名、答案或历史会话 ID。</p></header>
            <div className="verification-track-grid" aria-label="两种提示方式说明">
              <article><span>无提示</span><strong>观察默认表现</strong><p>直接提供原始对话和问题，不要求保存或检索记忆。</p></article>
              <article><span>有提示</span><strong>观察提醒后的表现</strong><p>只增加通用记忆提示，不改变题目、答案和评分方式。</p></article>
            </div>
            <ol className="verification-step-list">
              {currentTestSteps.map(([number, title, copy]) => (
                <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></li>
              ))}
            </ol>
          </section>

          <section className="verification-block proof-method">
            <header><span>REVIEW METHOD</span><h3>一份结果，四次确认。</h3></header>
            <ol>
              {evaluationSteps.map(([number, title, copy]) => (
                <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></li>
              ))}
            </ol>
          </section>

          <section className="verification-block proof-levels">
            <header><span>VERIFICATION LEVELS</span><h3>证据走到哪一步，结果就标到哪一级。</h3></header>
            <ol>
              {trustLevels.map(([number, name, label, copy]) => (
                <li className={number === '03' ? 'is-current' : undefined} key={name}>
                  <span>{number}</span><div><small>{name}</small><strong>{label}</strong><p>{copy}</p></div>
                </li>
              ))}
            </ol>
            <div className="proof-notes">
              <p><b>证据不足</b> 缺少关键记录时标记“无法评测”，不把它当作零分。</p>
              <p><b>安全边界</b> 评测通过不等于可以安全使用；权限与高风险操作需单独检查。</p>
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}
