const questions = [
  {
    "question": "为什么同时看运行轨迹和环境证据？",
    "answer": "运行轨迹用于解释 Agent 发起了什么操作，环境观测用于检查相关产物或状态。观测来源相对于 Agent 自述独立，但不代表第三方认证，也不能单凭环境变化证明其由 Agent 引起。可形成的结论取决于实际观测范围和检查要求。"
  },
  {
    "question": "新框架的 PASS、FAIL 与 UNEVALUABLE 如何理解？",
    "answer": "PASS 表示满足本次配置的通过门禁，不等于所有检查均通过或可以直接上线。硬性检查失败时为 FAIL；没有优先触发硬失败，但必需检查无法有效判定时为 UNEVALUABLE。计划失败、取消或系统故障可能使流程尚未形成判定，此时应先查看运行状态与原因。"
  },
  {
    "question": "如何理解 LLM Judge 的评分？",
    "answer": "新框架中的 LLM Judge 依据任务、评分要求与获准证据逐标签判定。程序校验证据和输出结构，并按规则汇总结果；模型判定仍可能出错，需要针对用途校准与复核，不能把评分机制本身当作效果保证。"
  },
  {
    "question": "评测报告能否复查或复现？",
    "answer": "复查时先核对检查项、判定理由、相关证据和运行状态。重新执行任务还需要对应版本、输入材料、环境与权限；能读取报告不等于已经完成复现。现有公开报告的资料开放范围与验证情况，以各自说明为准。"
  },
  {
    "question": "DSH-Eval 与 DSH、DSH Studio 有什么关系？",
    "answer": "DSH 提供 Agent 运行能力，DSH-Eval 组织任务评测并提供证据与判定。DSH Studio 的方向是企业 Agent 应用的生产化；Eval 的机制介绍不代表 Studio 的企业系统集成、交付或业务验收已经完成。"
  },
  {
    "question": "现在如何开始了解或使用？",
    "answer": "先选一个明确的 Agent 任务，列出预期结果与检查条件，再阅读适用的方法说明。查看已有结果时，以对应报告的版本和条件为准；接入新框架前，核对官方实际发布的环境要求与使用步骤。"
  }
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: questions.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
};

export function ProductFaq() {
  return (
    <section className="product-intro-section faq-list" id="faq" aria-labelledby="faq-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <header className="reading-section-heading">
        <h2 className="section-title" id="faq-title" data-site-title="section">常见问题</h2>
      </header>
      <div>
        {questions.map(({ question, answer }, index) => (
          <details key={question}>
            <summary><span>{String(index + 1).padStart(2, '0')}</span><h3 data-site-title="minor">{question}</h3><i aria-hidden="true">+</i></summary>
            <p data-site-copy="body">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
