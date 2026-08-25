'use client';

import { useState } from 'react';

type DemoTask = {
  short: string;
  query: string;
  choice: string;
  combo: string;
  confidence: string;
  coverage: string;
  why: string;
  environment: string;
  runs: string;
  gap: string;
  alternative: string;
  state: 'recommend' | 'hold';
  audit: string[];
};

const demoTasks: DemoTask[] = [
  {
    short: '中文路演 PPT',
    query: '在 Mac 上制作一套中文路演 PPT，优先稳定，预算适中。',
    choice: 'PPT-Design-Skill',
    combo: '+ file tools',
    confidence: '中高',
    coverage: '4 / 5',
    why: '样例结论：中文内容保真度和版式完成度更稳定，适合需要直接交付成品的路演场景。',
    environment: 'macOS 15 · DSH 1.8.2',
    runs: '示例：12 次任务运行',
    gap: '1 次字体依赖失败',
    alternative: 'Slidev Skill · 更适合希望手动控制版式时',
    state: 'recommend',
    audit: ['安装与依赖路径已覆盖', '产物结构通过自动检查', '中文内容完成一次人工抽检'],
  },
  {
    short: '多 Agent 工作流',
    query: '搭建支持任务拆分、子 Agent 调度和失败恢复的工作流。',
    choice: 'ruflo',
    combo: '+ session trace',
    confidence: '中',
    coverage: '3 / 5',
    why: '样例结论：协作能力覆盖较完整，也能保留运行轨迹；但权限面和部署复杂度更高。',
    environment: 'Ubuntu 24.04 · 2 类模型',
    runs: '示例：9 次工作流运行',
    gap: '失败恢复样本仍不足',
    alternative: 'OpenSwarm · 更适合低配置成本的试验',
    state: 'recommend',
    audit: ['任务拆分与子任务回收已覆盖', '会话轨迹可复查', '权限边界仍需补充测试'],
  },
  {
    short: '轻量桌面使用',
    query: '在本地快速使用 DSH，不想先搭建复杂的 Web 环境。',
    choice: 'dsh-desktop',
    combo: '+ local runtime',
    confidence: '中',
    coverage: '3 / 5',
    why: '样例结论：安装和首次启动路径更短，适合本地体验；长期稳定性证据仍在积累。',
    environment: 'macOS · Windows',
    runs: '示例：6 次安装测试',
    gap: '长期运行样本偏少',
    alternative: 'DSH Web Starter · 更适合团队共享',
    state: 'recommend',
    audit: ['两类桌面系统完成安装', '首次启动路径已检查', '长期稳定性尚未覆盖'],
  },
  {
    short: '证据不足案例',
    query: '评估一个刚发布、只有作者说明但尚无独立运行记录的插件。',
    choice: '暂不推荐',
    combo: '需要先补充真实运行证据',
    confidence: '低',
    coverage: '1 / 5',
    why: '当前只有能力声明，没有当前版本的可复现运行记录。DSH Eval 不会用推测补全未知事实。',
    environment: '作者声明：macOS',
    runs: '尚无当前版本实测',
    gap: '缺少复现、安全与反例',
    alternative: '下一步：运行本地测试并提交可复现结果',
    state: 'hold',
    audit: ['已读取作者能力声明', '缺少独立环境复现', '缺少安全边界与失败样本'],
  },
];

export default function RecommendationDemo() {
  const [activeTask, setActiveTask] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = 'recommendation-evidence-details';
  const task = demoTasks[activeTask];

  const selectTask = (index: number) => {
    setActiveTask(index);
    setDetailsOpen(false);
  };

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="product-label">DSH 插件评测与推荐 Agent</p>
        <h1 id="hero-title">选插件，<br />别只看谁更火。</h1>
        <p className="hero-lead">让候选插件先在真实环境里完成任务，再根据你的环境、预算与风险偏好，给出证据、限制和备选。</p>
        <p className="hero-thesis">模型负责解释，真实运行决定结论。</p>

        <div className="demo-picker" role="group" aria-label="选择一个推荐演示任务">
          <span>选择一个演示任务</span>
          <div className="demo-options">
            {demoTasks.map((item, index) => (
              <button
                type="button"
                key={item.short}
                className={activeTask === index ? 'active' : ''}
                aria-pressed={activeTask === index}
                onClick={() => selectTask(index)}
              >
                {item.short}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-actions">
          <a className="button button-primary" href="#recommendation-anatomy">拆解这份推荐 <span aria-hidden="true">→</span></a>
          <a className="text-link" href="#top100">浏览 Top100 热度榜 <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div className="dossier-wrap">
        <p className="demo-disclaimer"><b>交互演示</b> 以下内容只展示产品结构，不代表正式评测结论</p>
        <article className={`dossier ${task.state === 'hold' ? 'is-hold' : ''}`}>
          <span className="dossier-notch notch-left" aria-hidden="true" />
          <span className="dossier-notch notch-right" aria-hidden="true" />
          <header className="dossier-head">
            <span>VERDICT #260824–0{activeTask + 17}</span>
            <span>{task.state === 'hold' ? 'EVIDENCE INCOMPLETE' : 'DEMO RESULT'}</span>
          </header>

          <div className="dossier-task">
            <span className="field-label">你的任务</span>
            <p>{task.query}</p>
          </div>

          <div className="evidence-route" aria-label="推荐形成过程">
            <span>约束</span><i /><span>运行</span><i /><span>核验</span><i /><span>结论</span>
          </div>

          <div className="dossier-verdict">
            <div>
              <span className="field-label">{task.state === 'hold' ? '当前结论' : '推荐方案'}</span>
              <h2>{task.choice}</h2>
              <p>{task.combo}</p>
            </div>
            <dl className="confidence-block">
              <div><dt>推荐置信度</dt><dd>{task.confidence}</dd></div>
              <div><dt>证据覆盖</dt><dd>{task.coverage}</dd></div>
            </dl>
          </div>

          <p className="dossier-reason">{task.why}</p>

          <dl className="fact-grid">
            <div><dt>验证环境</dt><dd>{task.environment}</dd></div>
            <div><dt>运行记录</dt><dd>{task.runs}</dd></div>
            <div><dt>证据缺口</dt><dd>{task.gap}</dd></div>
          </dl>

          <div className="dossier-next">
            <span>备选 / 下一步</span>
            <p>{task.alternative}</p>
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              {detailsOpen ? '收起证据结构' : '查看证据结构'}
            </button>
          </div>

          {detailsOpen && (
            <div className="audit-drawer" id={detailsId} role="region" aria-label={`${task.short}的证据结构`}>
              {task.audit.map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}
            </div>
          )}
        </article>
        <div className="dossier-spine" aria-hidden="true"><span>A · 服务端实测</span><span>B · 本地复现</span><span>C · 辅助反馈</span></div>
      </div>

      <p className="sr-status" aria-live="polite">已切换到“{task.short}”演示，当前结论为“{task.choice}”，推荐置信度{task.confidence}。</p>
    </section>
  );
}
