import styles from './article.module.css';

const contents = [
  { id: 'conditions', label: '明确完成条件' },
  { id: 'trace', label: '检查运行轨迹' },
  { id: 'environment', label: '核对环境证据' },
  { id: 'judgment', label: '解释判定结果' },
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
          <p className={styles.deck}>介绍 DSH-Eval 新评测框架如何关联任务要求、执行过程与实际结果，形成可追溯的判定。</p>
          <div className={styles.meta}><span>DSH-Eval</span><time dateTime="2026-09-11">2026 年 9 月 11 日</time><span>新框架 · 开发中</span></div>
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
            <p>回答、执行过程和目标文件回答的是不同问题。把它们对应起来，才能解释任务为什么通过、失败，或暂时无法评估。</p>
          </div>
          <figure className={styles.diagram}>
            <div className={styles.diagramHeading}><span>评测中的两类证据</span><span>机制示意</span></div>
            <div className={styles.evidencePair}>
              <div><span className={styles.diagramLabel}>过程</span><h2>运行轨迹</h2><p>执行事件、工具调用与异常</p></div>
              <div><span className={styles.diagramLabel}>结果</span><h2>环境证据</h2><p>已配置的产物与状态观测</p></div>
            </div>
            <div className={styles.judgeLine}><span>证据校验</span><span aria-hidden="true">→</span><span>逐标签判定</span><span aria-hidden="true">→</span><span>门禁汇总</span></div>
            <figcaption>运行轨迹解释过程，环境观测检查结果。下文的文件任务用于说明方法，不是真实评测案例。</figcaption>
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
            <h2 id="environment-title"><span aria-hidden="true">03</span>用环境观测检查结果</h2>
<p>{"环境观测从配置的环境对象中取得证据，例如文件状态或进程信息，使检查不必完全依赖 Agent 的自述。"}</p>
            <p>{"这里的“独立”指观测来源相对于 Agent 自述的独立性，不表示第三方认证，也不表示可以看到环境中的所有变化。观察到文件变化，也不能单凭这一点证明变化一定由 Agent 引起。只有已配置、实际采集且满足检查要求的记录，才能用于相应判定。"}</p>
            <p>{"因此，阅读评测报告时可以沿着一条链检查：任务要求是什么，对应检查项是什么，检查引用了哪些证据，证据来自什么观测。"}</p>
          </section>
          <section id="judgment" className={styles.chapter} aria-labelledby="judgment-title">
            <h2 id="judgment-title"><span aria-hidden="true">04</span>保留“目前无法判断”的结果</h2>
<p>{"下面三种情况应分别解释："}</p>
            <div className={styles.tableWrap}><table><thead><tr><th scope="col">{"方法示例"}</th><th scope="col">{"可以形成的判断"}</th></tr></thead><tbody><tr><td>{"文件及所需内容的证据完整，并满足本次检查规则"}</td><td>{"相关检查可以通过"}</td></tr><tr><td>{"证据足以确认必需内容缺失，并触发硬性失败条件"}</td><td>{"应说明具体失败及依据"}</td></tr><tr><td>{"关键观测未采集到，或评分过程无法给出有效结果"}</td><td>{"对应检查可能不可评估，需要先补齐判断条件"}</td></tr></tbody></table></div>
            <p>{"这些是解释性情形，没有对应本次真实评测成绩。实际汇总结果取决于任务配置的门禁：如果已有硬性检查失败，同时其他检查不可评估，最终结果可以是 FAIL，但报告仍应保留那些证据缺口。"}</p>
            <p>{"计划无法执行、任务取消或系统故障，也可能让流程尚未形成有效判定。此时先处理运行状态，再讨论 Agent 的能力表现。"}</p>
          </section>
          <section id="framework" className={styles.chapter} aria-labelledby="framework-title">
            <h2 id="framework-title"><span aria-hidden="true">05</span>DSH-Eval 如何组织这些检查</h2>
            <p>新框架目前仍在开发中，尚未全面迁移，也尚未发布评测结果。现有报告仍以各自公布的方法与测试条件为准。</p>
<p>{"DSH-Eval 新框架以指定配置下的完整 DSH Agent 为评测对象。它根据目标信息和可用数据集组织任务，采集运行轨迹与环境证据，检查证据是否满足要求，再通过 Judge 和门禁规则形成可追溯的结果。"}</p>
            <p>{"新框架包含逐标签 LLM Judge。模型依据任务、评分要求与获准证据给出判定，程序校验相关结构并汇总结果。证据引用让判断更便于追查，但模型评分本身仍需要针对用途进行校准与复核。"}</p>
            <p>{"报告将检查项、判定和证据关联起来，分别呈现任务判定与运行状态。技术人员可以据此定位需要补证据、修改配置或进一步验证的地方。"}</p>
          </section>
          <section id="comparison" className={styles.chapter} aria-labelledby="comparison-title">
            <h2 id="comparison-title"><span aria-hidden="true">06</span>修改后，保留比较所需的条件</h2>
<p>{"如果开发者修订了代码、配置或工具，再次评测时应记录变更，并尽量保持任务、数据、环境和评分规则可比。否则，分数变化可能同时受到多个因素影响。"}</p>
            <p>{"新框架的报告与记录为追溯提供了基础。自动完成任意版本对照、解释所有失败根因或推荐最优修复，不属于本文已经证明的能力。"}</p>
            <p>{"评测结论也始终有范围。一次通过说明本次检查满足配置门禁；实际业务上线还需针对业务数据、权限、接口和异常任务进行验证。"}</p>
            <p>{"使用或阅读 DSH-Eval 时，可以先选一个明确任务，把预期结果和检查条件列清，再沿着“检查项→判定→证据”阅读报告。证据不足的地方保留未知，变更后的结果重新验证。"}</p>
          </section>
          <footer className={styles.articleFooter}>
            <a className="method-results-link" href="/about#eval-framework">了解新框架的产品范围 <span aria-hidden="true">→</span></a>
          </footer>
        </article>
      </div>
    </div>
  );
}
