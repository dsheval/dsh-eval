import styles from './article.module.css';

const contents = [
  { id: 'conditions', label: '明确完成条件' },
  { id: 'trace', label: '检查运行轨迹' },
  { id: 'environment', label: '核对环境证据' },
  { id: 'judgment', label: '解释评分结果' },
  { id: 'framework', label: '新框架如何组织评测' },
  { id: 'comparison', label: '变更后的复测' },
];

function ContentsLinks() {
  return <ol>{contents.map(({id,label},index) => <li key={id}><a href={`#${id}`}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{label}</a></li>)}</ol>;
}

export default function AgentEvidenceArticle() {
  return (
    <div className={styles.document}>
      <header className={styles.cover}>
        <div className={styles.coverAside}>
          <a className={styles.back} href="/methodology">← 评测方法</a>
        </div>
        <div className={styles.coverCopy}>
          <h1><span>从运行轨迹与环境证据</span><span>判断 Agent 是否完成任务</span></h1>
          <p className={styles.deck}>介绍 DSH-Eval 新评测框架如何关联任务要求、执行过程与实际交付，形成可追溯的评分。</p>
          <div className={styles.meta}><span>DSH-Eval</span><time dateTime="2026-09-14">2026 年 9 月 14 日</time><span>新框架 · 开发中</span></div>
        </div>
      </header>

      <div className={styles.readingLayout}>
        <aside className={styles.sidebar}>
          <nav className={styles.toc} aria-label="文章目录"><p>本文内容</p><ContentsLinks /></nav>
        </aside>
        <article className={styles.prose}>
          <details className={styles.mobileContents}><summary>本文目录 · 6 个章节</summary><nav aria-label="文章目录（移动端）"><ContentsLinks /></nav></details>
          <div className={styles.intro}>
            <p>Agent 回复“已完成”后，任务是否真的完成了？</p>
            <p>以生成指定文件为例，仍需核对文件是否存在、内容是否符合要求、是否写到了正确位置，以及用于判断的记录是否完整。</p>
            <p>回答、执行过程和目标文件回答的是不同问题。把它们对应起来，才能解释各项能力的分数与依据，以及哪些地方暂时无法判断。</p>
          </div>
          <figure className={styles.diagram}>
            <div className={styles.diagramHeading}><span>评测中的过程与结果</span><span>机制示意</span></div>
            <div className={styles.evidencePair}>
              <div><span className={styles.diagramLabel}>过程</span><h2>运行轨迹</h2><p>执行事件、工具调用与异常</p></div>
              <div><span className={styles.diagramLabel}>结果</span><h2>环境与交付物</h2><p>环境变化、最终回答与文件内容</p></div>
            </div>
            <div className={styles.judgeLine}><span>统一证据</span><span aria-hidden="true">→</span><span>逐标签评分</span><span aria-hidden="true">→</span><span>维度汇总</span></div>
            <figcaption>运行轨迹、环境变化与最终交付物共同组成评分证据。下文的文件任务用于说明方法，不是真实评测案例。</figcaption>
          </figure>
          <section id="conditions" className={styles.chapter} aria-labelledby="conditions-title">
            <h2 id="conditions-title"><span aria-hidden="true">01</span>先把“完成”写成可检查的条件</h2>
<p>{"对生成文件这类任务，可以先列出检查条件：输出位置、文件格式、必需内容，以及需要调用或禁止调用的工具。条件应与任务要求一致。"}</p>
            <p>{"如果只检查文件存在，得到的结论也只覆盖这一要求。内容正确性、引用依据或其他业务规则，需要各自的证据和判定方式。"}</p>
            <p>{"检查条件越明确，报告越容易回答“具体哪里出了问题”。"}</p>
          </section>
          <section id="trace" className={styles.chapter} aria-labelledby="trace-title">
            <h2 id="trace-title"><span aria-hidden="true">02</span>用运行轨迹解释过程</h2>
<p>{"运行轨迹记录 Agent 执行中的事件，可以帮助查看它发起了什么操作、使用了哪些工具，以及相关调用如何结束。"}</p>
            <p>{"这些记录能用于排查：任务是否走到了预期步骤，工具是否被调用，过程中是否出现异常。它们也有采集边界，缺失的事件不能自动按成功处理。"}</p>
          </section>
          <section id="environment" className={styles.chapter} aria-labelledby="environment-title">
            <h2 id="environment-title"><span aria-hidden="true">03</span>用环境与交付物检查结果</h2>
<p>{"环境观测记录已配置对象的实际变化，例如文件状态或进程信息；交付物证据保留最终回答与文件内容。两者结合，才能进一步核对交付位置、内容与任务要求。"}</p>
            <p>{"这里的“独立”指观测来源相对于 Agent 自述的独立性，不表示第三方认证，也不表示可以看到环境中的所有变化。观察到文件变化，也不能单凭这一点证明变化一定由 Agent 引起。采集范围和缺口需要同时记录；没有变化事件，不能直接等同于没有发生操作。"}</p>
            <p>{"因此，阅读评测报告时可以沿着一条链检查：任务要求是什么，对应评分标准是什么，评分引用了哪些证据，证据来自什么记录。"}</p>
          </section>
          <section id="judgment" className={styles.chapter} aria-labelledby="judgment-title">
            <h2 id="judgment-title"><span aria-hidden="true">04</span>区分分数、无法判断与评分错误</h2>
<p>{"新框架对每个标签分别评分，并区分以下三种状态："}</p>
            <div className={styles.tableWrap}><table><thead><tr><th scope="col">评分状态</th><th scope="col">如何理解</th></tr></thead><tbody><tr><td>已评分（SCORED）</td><td>形成有效数值评分；零分也是有效分数，需要结合评分标准、理由和证据阅读。</td></tr><tr><td>无法判断（UNASSESSABLE）</td><td>无法形成有效评分，分数为空，并说明具体原因；证据不足是可能原因之一。</td></tr><tr><td>评分错误（ERROR）</td><td>评分请求或响应失败，分数为空；应排查评测系统，不把错误记作 Agent 零分。</td></tr></tbody></table></div>
            <p>{"汇总时，同一标签、同一评分标准的有效分数取算术平均；有效零分参与计算，无法判断与评分错误单独计数，不计入平均值。没有有效分数时保留为空，当前不自动汇总为通过或失败。"}</p>
            <p>{"计划无法执行、任务取消或系统故障，也可能让流程尚未形成有效评分。此时先处理运行状态，再讨论 Agent 的能力表现。"}</p>
          </section>
          <section id="framework" className={styles.chapter} aria-labelledby="framework-title">
            <h2 id="framework-title"><span aria-hidden="true">05</span>DSH-Eval 如何组织这些检查</h2>
            <p>新框架目前仍在开发中，真实端到端能力验收尚待完成。受控测试样例用于验证流程，不代表真实 Agent 能力成绩。现有报告仍以各自公布的方法与测试条件为准。</p>
<p>{"DSH-Eval 新框架以指定配置下的完整 DSH Agent 为评测对象。它根据目标信息和可用数据集组织任务，将运行轨迹、环境变化与最终交付物组织为一份统一证据，供各标签评分使用。"}</p>
            <p>{"新框架包含逐标签 LLM Judge。每个标签读取同一份已采集证据，结合标签评分标准与题目专用评分参考，给出分数、理由和证据引用。程序校验评分结构与引用；模型评分本身仍需针对用途进行校准与复核。"}</p>
            <p>{"报告将标签、分数和证据关联起来，分别呈现维度评分、无法判断、评分错误与运行状态。技术人员可以据此定位需要补证据、修改配置或进一步验证的地方。"}</p>
          </section>
          <section id="comparison" className={styles.chapter} aria-labelledby="comparison-title">
            <h2 id="comparison-title"><span aria-hidden="true">06</span>修改后，保留比较所需的条件</h2>
<p>{"如果开发者修订了代码、配置或工具，再次评测时应记录变更，并尽量保持任务、数据、环境和评分规则可比。否则，分数变化可能同时受到多个因素影响。"}</p>
            <p>{"新框架的报告与记录为追溯提供了基础。自动完成任意版本对照、解释所有失败根因或推荐最优修复，不属于本文已经证明的能力。"}</p>
            <p>{"评测结论也始终有范围。一次评分只反映本次任务、证据与评分标准下的表现；实际业务上线还需针对业务数据、权限、接口和异常任务进行验证。"}</p>
            <p>{"使用或阅读 DSH-Eval 时，可以先选一个明确任务，把预期结果和检查条件列清，再沿着“标签→评分→证据”阅读报告。证据不足的地方保留未知，变更后的结果重新验证。"}</p>
          </section>
          <footer className={styles.articleFooter}>
            <a className="method-results-link" href="/about#eval-framework">了解新框架的产品范围 <span aria-hidden="true">→</span></a>
          </footer>
        </article>
      </div>
    </div>
  );
}
