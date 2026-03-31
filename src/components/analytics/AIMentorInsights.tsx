'use client';

import { useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trade } from '@/lib/tradeQueries';
import { EmotionWarning } from '@/lib/aiMentor';
import { useAIMentorStore } from '@/stores/aiMentorStore';

interface AIMentorInsightsProps {
    trades: Trade[];
}

export function AIMentorInsights({ trades }: AIMentorInsightsProps) {
    // 使用 Zustand store - 状态在页面间切换时保持
    const {
        status,
        insights,
        recommendations,
        emotionWarnings,
        error,
        setStatus,
        setInsights,
        setError,
        needsReanalysis,
    } = useAIMentorStore();

    const isLoading = status === 'analyzing';

    // 检查是否需要重新分析 (交易数量变化超过 5%)
    useEffect(() => {
        if (status === 'completed' && needsReanalysis(trades.length)) {
            // 不自动重置，只显示提示
            console.log('Trade count changed significantly, consider re-analyzing');
        }
    }, [trades.length, status, needsReanalysis]);

    const generateReview = useCallback(async () => {
        setStatus('analyzing');

        try {
            const response = await fetch('/api/ai-mentor/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 20 }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate review');
            }

            setInsights(
                result.data.insights,
                result.data.recommendations || [],
                result.data.emotionWarnings || [],
                trades.length
            );
        } catch (err) {
            console.error('Error generating review:', err);
            setError(err instanceof Error ? err.message : 'AI 分析请求失败');
        }
    }, [setStatus, setInsights, setError, trades.length]);

    const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
        switch (severity) {
            case 'high':
                return 'bg-red-900/30 border-red-700 text-red-400';
            case 'medium':
                return 'bg-yellow-900/30 border-yellow-700 text-yellow-400';
            case 'low':
                return 'bg-orange-900/30 border-orange-700 text-orange-400';
        }
    };

    if (trades.length === 0) {
        return (
            <Card className="bg-slate-800/30 border-slate-700/50">
                <CardHeader>
                    <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>🤖</span> AI Mentor Insights
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400">
                        导入交易数据后，AI 导师将分析您的交易模式并提供个性化建议。
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-800/30 border-slate-700/50">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>🤖</span> AI Mentor Insights
                        {status === 'completed' && (
                            <span className="text-xs font-normal text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                                已缓存
                            </span>
                        )}
                    </CardTitle>
                    <Button
                        onClick={generateReview}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                        {isLoading ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span>
                                分析中...
                            </>
                        ) : status === 'completed' ? (
                            <>
                                <span className="mr-2">🔄</span>
                                重新分析
                            </>
                        ) : (
                            <>
                                <span className="mr-2">✨</span>
                                生成复盘
                            </>
                        )}
                    </Button>
                </div>
                <p className="text-sm text-slate-400">
                    基于 ICT/SMC 交易方法论的 AI 交易教练，分析您的交易数据并提供专业建议
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Error Display */}
                {error && (
                    <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
                        <span className="font-semibold">错误：</span> {error}
                    </div>
                )}

                {/* Emotion Warnings */}
                {emotionWarnings && emotionWarnings.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>⚠️</span> 情绪关联警告
                        </h4>
                        <div className="grid gap-3">
                            {emotionWarnings.map((warning: EmotionWarning, idx: number) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border ${getSeverityColor(warning.severity)}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-lg">{warning.tag}</span>
                                        <span className="text-sm opacity-80">
                                            {warning.tradeCount} 笔交易
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm">
                                        当处于 <strong>&quot;{warning.tag}&quot;</strong> 心理状态时，
                                        平均亏损是正常交易的{' '}
                                        <strong className="text-xl">{warning.multiplier.toFixed(1)}x</strong>
                                    </p>
                                    <div className="mt-2 text-xs opacity-75">
                                        正常平均亏损: ${warning.normalAvgLoss.toFixed(2)} →
                                        此标签平均亏损: ${warning.avgLoss.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* AI Insights (Markdown) */}
                {insights && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>📋</span> 详细分析
                        </h4>
                        <div className="prose prose-invert prose-sm max-w-none bg-slate-900/50 rounded-lg p-6 border border-slate-700/50">
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => (
                                        <h1 className="text-xl font-bold text-white mb-4">{children}</h1>
                                    ),
                                    h2: ({ children }) => (
                                        <h2 className="text-lg font-semibold text-white mt-6 mb-3">{children}</h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">{children}</h3>
                                    ),
                                    p: ({ children }) => (
                                        <p className="text-slate-300 mb-3 leading-relaxed">{children}</p>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc list-inside text-slate-300 mb-3 space-y-1">{children}</ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal list-inside text-slate-300 mb-3 space-y-1">{children}</ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="text-slate-300">{children}</li>
                                    ),
                                    strong: ({ children }) => (
                                        <strong className="text-white font-semibold">{children}</strong>
                                    ),
                                    em: ({ children }) => (
                                        <em className="text-blue-400">{children}</em>
                                    ),
                                    code: ({ children }) => (
                                        <code className="bg-slate-800 px-2 py-0.5 rounded text-green-400 text-sm">{children}</code>
                                    ),
                                }}
                            >
                                {insights}
                            </ReactMarkdown>
                        </div>
                    </div>
                )}

                {/* Initial Empty State */}
                {status === 'idle' && !isLoading && !error && (
                    <div className="text-center py-8 text-slate-400">
                        <div className="text-4xl mb-4">🧠</div>
                        <p className="mb-2">点击&quot;生成复盘&quot;按钮开始 AI 分析</p>
                        <p className="text-sm text-slate-500">
                            AI 将分析您最近的交易，找出心理误区、最佳策略和改进建议
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
