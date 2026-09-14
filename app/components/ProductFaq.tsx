const questions = [
  {
    "question": "为什么同时看运行轨迹和环境证据？",
    "answer": "运行轨迹用于解释 Agent 发起了什么操作，环境观测记录相关变化，最终回答和文件内容作为交付证据。观测来源相对于 Agent 自述独立，但不代表第三方认证，也不能单凭环境变化证明其由 Agent 引起。可形成的结论取决于实际观测范围和检查要求。"
  },
  {
    "question": "新框架如何区分已评分、无法判断与评分错误？",
    "answer": "SCORED 表示已形成有效数值评分，包括可能的零分；UNASSESSABLE 表示无法判断，ERROR 表示评分请求或响应失败，后两者分数为空。当前按同标签、同标准对有效分数取均值，并保留各状态的 Case 数量；空分不按零分处理。当前不自动汇总为通过或失败，运行状态另行阅读。"
  },
  {
    "question": "如何理解 LLM Judge 的评分？",
    "answer": "各标签的 LLM Judge 读取同一份已采集证据，结合标签评分标准与题目专用评分参考，给出分数、理由和证据引用。程序检查响应字段、分数范围与引用 ID；采集缺口随证据一起交给 Judge，由其判断能否评分。格式正确不保证评分或引用正确，仍需针对用途校准与复核。"
  },
  {
    "question": "评测报告能否复查或复现？",
    "answer": "复查时先核对任务与评分标准、维度分数、评分理由、相关证据和运行状态。重新执行任务还需要对应版本、输入材料、环境与权限；能读取报告不等于已经完成复现。现有公开报告的资料开放范围与验证情况，以各自说明为准。"
  },
  {
    "question": "DSH-Eval 与 DSH、DSH Studio 有什么关系？",
    "answer": "DSH 提供 Agent 运行能力，DSH-Eval 组织任务评测并提供证据与评分。DSH Studio 的方向是企业 Agent 应用的生产化；Eval 的机制介绍不代表 Studio 的企业系统集成、交付或业务验收已经完成。"
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
