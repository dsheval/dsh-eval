import { ReportResources, ReportStatus, ReportNextLinks } from '@/app/components/ReportElements';
import type { Metadata } from 'next';
import { InnerPageHero } from '@/app/components/InnerPageHero';
import { SiteHeader, SiteFooter } from '@/app/components/SiteChrome';
import DeepResearchBenchmark from '@/app/components/DeepResearchBenchmark';
import { researchConditions, researchRecords, researchUrl, researchDownloadUrl, researchCodeUrl, researchDate, researchPublicationLabel } from '@/app/data/deep-research';

export const metadata: Metadata = {
  title: `深度研究评测 · ${researchPublicationLabel} · DSH-Eval`,
  description: '7 个 DSH 研究插件与原生基线的小样本评测：短事实、长报告与派生诊断，逐题比较完成状态、增量和资源用量。',
  alternates: { canonical: researchUrl },
  openGraph: { title: '研究插件，能交出完整报告吗？· DSH-Eval', url: researchUrl, type: 'article', images: [] },
  twitter: { card: 'summary', title: `深度研究评测 · ${researchPublicationLabel} · DSH-Eval`, images: [] },
};

export default function ResearchResultsPage() {
  return <>
    <a className="skip-link" href="#main-content">跳到主要内容</a><SiteHeader active="results" />
    <main id="main-content" className="content-page report-page benchmark-report research-report">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Dataset', name: `DSH-Eval 深度研究评测 · ${researchPublicationLabel}`, version: 'V12', description: 'C0 与七个插件的 40 条脱敏记录，包含派生诊断；本轮复用部分已验证的历史记录。', url: `https://dsheval.ai${researchUrl}`, datePublished: researchDate, creator: { '@type': 'Organization', name: 'DSH-Eval' }, distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `https://dsheval.ai${researchDownloadUrl}/results.json` } }) }} />
      <InnerPageHero eyebrow={`DEEP RESEARCH EVALUATION · ${researchDate}`} title={<><span className="title-phrase">研究插件，</span><wbr /><span className="title-phrase">能交出完整报告吗？</span></>} description="7 个插件与 DSH 原生基线，完成同一组短事实和长报告任务。4 个独立题面、1 个派生诊断，共 40 条公开记录。" breadcrumbs={[{ label: 'DSH-Eval', href: '/' }, { label: '评测结果', href: '/results' }, { label: '深度研究' }]} />
      <DeepResearchBenchmark conditions={researchConditions} records={researchRecords} />
      <ReportResources dataUrl={`${researchDownloadUrl}/results.json`} codeUrl={researchCodeUrl}>
        <a href={`${researchDownloadUrl}/leaderboard.html`} download>下载离线榜单 ↓</a>
        <a href={`${researchDownloadUrl}/process-monitoring.html`} download>下载过程报告 ↓</a>
      </ReportResources>
      <section className="research-evidence" aria-label="评测方法与公开材料">
        <ReportStatus evidence="脱敏结果与评测代码已公开，可复算排名。" limitation="4 个独立题面、1 个派生诊断；私有答案与报告正文未公开，不能据此概括所有研究任务。" />
        <details className="verification-disclosure"><summary><div><span>评测与验证说明</span><b>测试方法、证据与适用范围</b></div><i aria-hidden="true">+</i></summary><div className="verification-content">
          <section className="verification-block"><header><span>TEST DESIGN</span><h3>本次测试怎样执行</h3></header><dl className="verification-review-list"><div><dt>参评范围</dt><dd>原生基线不安装插件，7 个参评条件各安装一个插件。另一个候选插件因缺少所需凭证被排除，不计零分、不进入榜单。</dd></div><div><dt>事实检索与多跳检索</dt><dd>使用私有金标与确定性规则，核对答案及实际检索行为。题面和答案不公开。</dd></div><div><dt>健康主题报告与金融主题报告</dt><dd>采用公开健康、金融主题任务，结合交付物检查、链接检查与固定模型评分。部分完成表示仍有缺项或未达到通过门槛。</dd></div><div><dt>研究交付诊断</dt><dd>复用健康主题报告，评估是否形成研究交付，不再调用模型。不能把它当作额外独立样本。</dd></div></dl></section>
          <section className="verification-block"><header><span>RANKING & LIMITS</span><h3>如何理解名次</h3></header><div className="research-method-copy"><p>沿用本轮评测的排序：准入 → 编造 → 长文通过与部分完成数 → 引用忠实度 → 短事实通过数 → 恢复 → 负增量 → 耗时。没有合成加权总分，原生基线不参与插件排名。</p><p>内部批次：V12，用于对应下载数据与历史记录，不是插件版本或题目数量。本轮统一补跑多跳检索题，其余复用上一批（V11）已验证的记录。发布日期不等于全部任务的运行日期。本轮只覆盖 4 个独立题面，不能推断插件在所有研究任务上的普遍优劣，也不代表上游基准的完整官方榜单。</p><p>系统失败率仅反映最终保留记录。过程日志中的错误、重试、人工介入计数是文本规则命中次数，可能重复或误命中；不能据此宣称整轮没有故障。</p></div></section>
          <section className="verification-block"><header><span>PUBLIC EVIDENCE</span><h3>能复核到哪一步</h3></header><div className="research-method-copy"><p>脱敏记录保留数值与状态，移除私有题面、金标、模型回答、完整 URL、日志正文和本机路径。可以复算榜单、核对文件完整性，不能据此重新核验私有答案、引用忠实度或完整运行轨迹。</p><p>长文分数来自本地评分模型，不是上游官方评分；引用可打开也不等于它支持报告中的结论。</p><div className="research-method-links"><a href="/methodology/deep-research">查看评测协议 →</a><a href={`${researchDownloadUrl}/manifest.json`} download>文件校验清单 ↓</a><a href={`${researchCodeUrl}/results/v12`} target="_blank" rel="noreferrer">数据字段与复核命令 ↗</a></div></div></section>
        </div></details>
      </section>
      <ReportNextLinks />
    </main><SiteFooter />
  </>;
}
