import results from '../../evals/deep-research/results/v12/results.json';
import leaderboard from '../../evals/deep-research/results/v12/leaderboard.json';

export const researchUrl = '/dsheval/results/deep-research/v12';
export const researchDownloadUrl = '/dsheval/data/deep-research/v12';
export const researchCodeUrl = 'https://github.com/dsheval/dsh-eval/tree/main/evals/deep-research';
export const researchDate = results.generatedAt.slice(0, 10);
export const researchPublicationLabel = `${researchDate.slice(0, 4)} 年 ${Number(researchDate.slice(5, 7))} 月发布`;
export const researchPluginCount = leaderboard.leaderboard.length;
export const researchLongformPassCount = leaderboard.leaderboard.filter(row => row.lf.passed > 0).length;

export type ResearchRecord = {
  condition: string; taskId: string; status: string; uplift: string;
  latencyMs: number | null; tokens: number | null; tools: number | null;
  search: number | null; checkedUrls: number | null; openUrls: number | null;
  faithfulness: number | null; budget: string | null; reused: boolean | null;
};
export type ResearchCondition = {
  condition: string; plugin: string; rank: number | null;
  sfPassed: number; lfPassed: number; lfPartial: number;
  positive: number; noClear: number; negative: number; notComparable: number;
  faithfulness: number | null; failureRate: number | null;
  latencyMs: number | null; tokens: number | null;
};

// Only compact display fields cross the server/client boundary. Full ledgers remain downloads.
export const researchRecords: ResearchRecord[] = results.records.map(r => {
  const p = r.processLedger;
  const components = p.resources.inputTokens == null && p.resources.outputTokens == null
    ? null : (p.resources.inputTokens ?? 0) + (p.resources.outputTokens ?? 0);
  const candidates = [p.resources.totalTokens, components].filter((n): n is number => n != null);
  return {
    condition: r.condition, taskId: r.taskId, status: r.resultLedger.status,
    uplift: r.resultLedger.uplift, latencyMs: p.resources.latencyMs,
    tokens: candidates.length ? Math.max(...candidates) : null,
    tools: p.tools.totalCalls, search: p.tools.searchCalls,
    checkedUrls: p.sources.checkedUrls, openUrls: p.sources.openUrls,
    faithfulness: r.resultLedger.citations.faithful,
    budget: p.resources.budget?.triggered ?? null, reused: r.provenance.reused,
  };
});

export const researchConditions: ResearchCondition[] = [leaderboard.baseline, ...leaderboard.leaderboard].map(row => {
  const uplift: Record<string, number | undefined> = row.upliftCounts;
  return {
    condition: row.condition, plugin: row.plugin, rank: 'rank' in row ? row.rank : null,
    sfPassed: row.sf.passed, lfPassed: row.lf.passed, lfPartial: row.lf.partial,
    positive: uplift.POSITIVE ?? 0, noClear: uplift.NO_CLEAR ?? 0,
    negative: uplift.NEGATIVE ?? 0, notComparable: uplift.NOT_COMPARABLE ?? 0,
    faithfulness: row.citationFaithfulness, failureRate: row.systemFailureRate,
    latencyMs: row.efficiency.meanLatencyMs, tokens: row.efficiency.meanTokens,
  };
});
