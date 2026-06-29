import Groq from 'groq-sdk';
import { Trade } from './tradeQueries';

// ============================================
// Types
// ============================================

export interface AIReviewResult {
    insights: string;
    recommendations: string[];
    emotionWarnings: EmotionWarning[];
    rawResponse: string;
}

export interface EmotionWarning {
    tag: string;
    avgLoss: number;
    normalAvgLoss: number;
    multiplier: number;
    tradeCount: number;
    severity: 'high' | 'medium' | 'low';
}

export interface TradeDataForAI {
    date: string;
    symbol: string;
    pnl: number;
    setup: string;
    psychology: string;
    notes: string;
    duration: string;
    isWin: boolean;
}

// ============================================
// Groq Client
// ============================================

function getGroqClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY environment variable is not set');
    }
    return new Groq({ apiKey });
}

// ============================================
// System Prompts
// ============================================

const MENTOR_SYSTEM_PROMPT = `你是一位资深的 ICT/SMC 交易教练。请分析以下交易数据，找出用户的心理误区、最赚钱的策略以及最严重的违规行为。请给出 3 条具体的改进建议，语气要直接、专业且具有启发性。

在分析时，请特别关注：
1. **心理模式**: 当用户处于 Revenge (报复性交易), FOMO, Overconfident (过度自信), Fearful (恐惧), Impatient (急躁) 等心理状态时的交易表现
2. **策略效果**: 哪些 setup 类型带来最高收益，哪些导致亏损
3. **纪律性**: 是否有连续亏损后加仓、或者连续盈利后过度自信的模式
4. **时间规律**: 交易时长与收益的关系

请使用 Markdown 格式输出，包含清晰的标题和要点。`;

// ============================================
// Data Serialization
// ============================================

/**
 * Serialize trades into a format suitable for LLM analysis
 */
export function serializeTradesForAI(trades: Trade[]): TradeDataForAI[] {
    return trades.map((trade) => ({
        date: trade.exit_time || trade.entry_time || 'Unknown',
        symbol: trade.symbol,
        pnl: trade.pnl,
        setup: trade.setup_type || 'Unclassified',
        psychology: trade.psychology_tag || 'Untagged',
        notes: trade.notes || '',
        duration: trade.duration || 'Unknown',
        isWin: trade.pnl > 0,
    }));
}

/**
 * Generate comprehensive summary statistics for AI context
 * This reduces token usage by sending stats instead of all trades
 */
function generateTradeSummary(trades: Trade[]): string {
    if (trades.length === 0) return '暂无交易数据';

    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

    // Calculate additional stats
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Setup performance breakdown
    const setupStats = new Map<string, { wins: number; losses: number; pnl: number }>();
    for (const trade of trades) {
        const setup = trade.setup_type || 'Unclassified';
        const current = setupStats.get(setup) || { wins: 0, losses: 0, pnl: 0 };
        if (trade.pnl > 0) current.wins++;
        else if (trade.pnl < 0) current.losses++;
        current.pnl += trade.pnl;
        setupStats.set(setup, current);
    }

    // Psychology breakdown
    const psychStats = new Map<string, { count: number; pnl: number }>();
    for (const trade of trades) {
        const tag = trade.psychology_tag || 'Untagged';
        const current = psychStats.get(tag) || { count: 0, pnl: 0 };
        current.count++;
        current.pnl += trade.pnl;
        psychStats.set(tag, current);
    }

    let setupSummary = '';
    setupStats.forEach((stats, setup) => {
        const total = stats.wins + stats.losses;
        const wr = total > 0 ? ((stats.wins / total) * 100).toFixed(0) : '0';
        setupSummary += `  - ${setup}: ${total}笔, 胜率${wr}%, 净盈亏$${stats.pnl.toFixed(2)}\n`;
    });

    let psychSummary = '';
    psychStats.forEach((stats, tag) => {
        const avgPnl = stats.pnl / stats.count;
        psychSummary += `  - ${tag}: ${stats.count}笔, 平均盈亏$${avgPnl.toFixed(2)}\n`;
    });

    return `
## 交易统计汇总
- 总交易数: ${trades.length}
- 盈利交易: ${wins.length} | 亏损交易: ${losses.length}
- 胜率: ${winRate.toFixed(1)}%
- 净盈亏: $${totalPnL.toFixed(2)}
- 平均盈利: $${avgWin.toFixed(2)} | 平均亏损: $${avgLoss.toFixed(2)}
- 盈亏比: ${profitFactor.toFixed(2)}

## 策略表现
${setupSummary}
## 心理状态分布
${psychSummary}`.trim();
}

/**
 * Get the worst losing trades for detailed analysis
 * Only send top N losses to reduce token usage
 */
function getWorstLossingTrades(trades: Trade[], count: number = 5): TradeDataForAI[] {
    const losses = trades
        .filter((t) => t.pnl < 0)
        .sort((a, b) => a.pnl - b.pnl) // Sort by PnL ascending (worst first)
        .slice(0, count);

    return serializeTradesForAI(losses);
}


// ============================================
// Emotion Correlation Analysis
// ============================================

/**
 * Analyze psychology_tag vs PnL correlation to detect dangerous patterns
 */
export function analyzeEmotionCorrelation(trades: Trade[]): EmotionWarning[] {
    const tagStats = new Map<string, { pnls: number[]; count: number }>();

    // Group trades by psychology tag
    for (const trade of trades) {
        const tag = trade.psychology_tag || 'Untagged';
        const current = tagStats.get(tag) || { pnls: [], count: 0 };
        current.pnls.push(trade.pnl);
        current.count += 1;
        tagStats.set(tag, current);
    }

    // Calculate average loss for each tag
    const warnings: EmotionWarning[] = [];
    const allLosses = trades.filter((t) => t.pnl < 0);
    const normalAvgLoss = allLosses.length > 0
        ? Math.abs(allLosses.reduce((sum, t) => sum + t.pnl, 0) / allLosses.length)
        : 0;

    // Dangerous psychology tags to watch
    const dangerousTags = ['Revenge', 'FOMO', 'Overconfident', 'Impatient', 'Fearful', 'Tilted'];

    tagStats.forEach((stats, tag) => {
        const losses = stats.pnls.filter((pnl) => pnl < 0);
        if (losses.length === 0) return;

        const avgLoss = Math.abs(losses.reduce((sum, pnl) => sum + pnl, 0) / losses.length);

        // Only warn if this tag has significantly worse performance
        if (normalAvgLoss > 0 && avgLoss > normalAvgLoss * 1.5) {
            const multiplier = avgLoss / normalAvgLoss;
            let severity: 'high' | 'medium' | 'low' = 'low';

            if (multiplier >= 3 || dangerousTags.includes(tag)) {
                severity = 'high';
            } else if (multiplier >= 2) {
                severity = 'medium';
            }

            warnings.push({
                tag,
                avgLoss,
                normalAvgLoss,
                multiplier,
                tradeCount: stats.count,
                severity,
            });
        }
    });

    // Sort by severity and multiplier
    return warnings.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.multiplier - a.multiplier;
    });
}

// ============================================
// AI Review Generation
// ============================================

/**
 * Generate auto-review using Groq LLM
 * Optimized for token efficiency: sends summary stats + top 5 worst losses
 */
export async function generateAutoReview(trades: Trade[]): Promise<AIReviewResult> {
    if (trades.length === 0) {
        return {
            insights: '没有足够的交易数据进行分析。请先导入一些交易记录。',
            recommendations: [],
            emotionWarnings: [],
            rawResponse: '',
        };
    }

    const groq = getGroqClient();

    // Generate comprehensive summary (reduces tokens vs sending all trades)
    const summary = generateTradeSummary(trades);

    // Only send top 5 worst losses for detailed analysis
    const worstLosses = getWorstLossingTrades(trades, 5);

    // Emotion warnings (computed locally, no token cost)
    const emotionWarnings = analyzeEmotionCorrelation(trades);

    // Build the user message with optimized data
    const userMessage = `
${summary}

## 最严重的 ${worstLosses.length} 笔亏损交易（详细分析）
\`\`\`json
${JSON.stringify(worstLosses, null, 2)}
\`\`\`

## 情绪关联预分析
${emotionWarnings.length > 0
            ? emotionWarnings.map((w) =>
                `⚠️ 当心理状态为 "${w.tag}" 时，平均亏损是正常交易的 ${w.multiplier.toFixed(1)} 倍 (${w.tradeCount} 笔交易)`
            ).join('\n')
            : '未检测到明显的情绪关联模式'}

请分析以上数据并给出你的专业见解和改进建议。
    `.trim();


    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: MENTOR_SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 2048,
        });

        const rawResponse = completion.choices[0]?.message?.content || '';

        // Extract recommendations (lines starting with numbered list)
        const recommendations: string[] = [];
        const lines = rawResponse.split('\n');
        let inRecommendations = false;

        for (const line of lines) {
            if (line.includes('建议') || line.includes('改进') || line.includes('Recommendation')) {
                inRecommendations = true;
            }
            if (inRecommendations && /^\d+[\.\)]/.test(line.trim())) {
                recommendations.push(line.trim().replace(/^\d+[\.\)]\s*/, ''));
            }
        }

        return {
            insights: rawResponse,
            recommendations: recommendations.slice(0, 5),
            emotionWarnings,
            rawResponse,
        };
    } catch (error) {
        console.error('Error generating AI review:', error);
        throw new Error(`AI 分析失败: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
}

// ============================================
// Cache Management
// ============================================

export interface CachedAIFeedback {
    reviewDate: string;
    insights: string;
    recommendations: string[];
    emotionWarnings: EmotionWarning[];
}

/**
 * Check if we have a recent cached review (within 24 hours)
 */
export function isCacheValid(cachedFeedback: CachedAIFeedback | null): boolean {
    if (!cachedFeedback?.reviewDate) return false;

    const cacheDate = new Date(cachedFeedback.reviewDate);
    const now = new Date();
    const hoursDiff = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);

    return hoursDiff < 24;
}
