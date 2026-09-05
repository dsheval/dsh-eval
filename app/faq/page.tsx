import type { Metadata } from 'next';
import { InnerPageHero } from '../components/InnerPageHero';
import { SiteFooter, SiteHeader } from '../components/SiteChrome';

const FAQ_URL = '/faq';

const questions = [
  {
    question: 'DSH-Eval 是什么？',
    answer: 'DSH-Eval 是面向 Agent 与插件生态的公开评测平台。我们在固定环境中执行真实任务，并把结论与测试条件、可公开的证据和适用边界一起发布。',
  },
  {
    question: 'DSH-Eval 评测什么？',
    answer: '我们评测 Agent 或插件完成具体任务的表现。每次测试会单独说明对象版本、任务范围、运行环境和指标，不用一个总分概括所有能力。',
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
    question: 'DSH-Eval 和 Top100 有什么区别？',
    answer: 'Top100 是 DSH-Eval 旗下的插件与 Skills 发现栏目，帮助用户浏览榜单、比较项目并找到安装入口。DSH-Eval 的公开评测则验证项目在明确条件下的真实表现。收录或排名不表示已经通过能力评测，具体结论以公开报告为准。',
  },
  {
    question: '如何提交项目或对结果提出异议？',
    answer: '请在对应公开报告所链接的代码仓库中提交 Issue，并注明项目版本、争议数据、复现环境和相关证据。我们会把更正与复测状态保留在公开记录中。',
  },
];

export const metadata: Metadata = {
  title: '常见问题 · DSH-Eval',
  description: '了解 DSH-Eval 是什么、评测什么、如何保证公平、怎样复查结果，以及 DSH-Eval 与 Top100 的关系。',
  alternates: { canonical: FAQ_URL },
  openGraph: {
    url: FAQ_URL,
    title: 'DSH-Eval 常见问题',
    description: '关于评测对象、测试条件、验证等级、复现和结果异议的直接回答。',
    type: 'website',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: questions.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
};

export default function FaqPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <SiteHeader active="faq" />
      <main id="main-content" className="content-page inner-page faq-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <InnerPageHero
          eyebrow="FAQ"
          title="关于 DSH-Eval，先回答清楚。"
          description="这里集中回答评测范围、公平性、复查方式和验证等级。具体数字与限制，请以对应测试报告为准。"
        />

        <section className="faq-list" aria-labelledby="faq-title">
          <header><p className="section-label">FREQUENTLY ASKED</p><h2 className="section-title" id="faq-title">常见问题</h2></header>
          <div>
            {questions.map(({ question, answer }, index) => (
              <details key={question} open={index === 0}>
                <summary><span>{String(index + 1).padStart(2, '0')}</span><h3>{question}</h3><i aria-hidden="true">+</i></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
