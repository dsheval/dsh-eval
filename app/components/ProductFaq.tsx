const questions = [
  {
    question: 'DSH-Eval 评测什么？',
    answer: '实际被测对象是指定模型、Harness、插件、权限、工具和环境配置下的整个 Agent。插件是实验中的变化因素，成绩不能解释为脱离模型与宿主的插件固有分数。',
  },
  {
    question: '一次评测如何保证公平？',
    answer: '同一测试中的对象使用相同题目、运行环境、模型配置、超时设置和评分规则。必须改变的变量会在方法与结果中单独说明。',
  },
  {
    question: '评测结果能否复查或复现？',
    answer: '公开报告提供结果数据、评测代码、版本与环境信息，并说明可复查的范围。部分题面、标准答案和完整日志未公开，无法仅凭公开数据重跑全部测试；是否完成独立环境复测，会通过验证等级明确标注。',
  },
  {
    question: 'Level 01–05 表示什么？',
    answer: '等级表示证据和验证进展，不表示能力高低：从已收录、可运行、已完成测试、已提交自测，到关键结果已在独立环境复测。',
  },
  {
    question: '评测故障会被记为零分吗？',
    answer: '不会。框架、处理器或环境故障会单独记录；缺少关键证据时会标记无法评测，避免把评测系统的问题误写成对象能力不足。',
  },
  {
    question: '如何提交项目或对结果提出异议？',
    answer: '请在对应公开报告所链接的代码仓库中提交 Issue，并注明项目版本、争议数据、复现环境和相关证据。我们会把更正与复测状态保留在公开记录中。',
  },
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
