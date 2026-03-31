import { create } from 'zustand';
import { EmotionWarning } from '@/lib/aiMentor';

export type AIMentorStatus = 'idle' | 'analyzing' | 'completed' | 'error';

interface AIMentorState {
    // 状态
    status: AIMentorStatus;
    insights: string | null;
    recommendations: string[];
    emotionWarnings: EmotionWarning[];
    error: string | null;

    // 用于判断缓存是否有效的交易数量
    analyzedTradeCount: number;

    // Actions
    setStatus: (status: AIMentorStatus) => void;
    setInsights: (
        insights: string,
        recommendations: string[],
        emotionWarnings: EmotionWarning[],
        tradeCount: number
    ) => void;
    setError: (error: string) => void;
    reset: () => void;

    // 检查是否需要重新分析 (交易数量变化)
    needsReanalysis: (currentTradeCount: number) => boolean;
}

export const useAIMentorStore = create<AIMentorState>((set, get) => ({
    // 初始状态
    status: 'idle',
    insights: null,
    recommendations: [],
    emotionWarnings: [],
    error: null,
    analyzedTradeCount: 0,

    // Actions
    setStatus: (status) => set({ status }),

    setInsights: (insights, recommendations, emotionWarnings, tradeCount) =>
        set({
            insights,
            recommendations,
            emotionWarnings,
            status: 'completed',
            error: null,
            analyzedTradeCount: tradeCount,
        }),

    setError: (error) => set({ status: 'error', error }),

    reset: () =>
        set({
            status: 'idle',
            insights: null,
            recommendations: [],
            emotionWarnings: [],
            error: null,
            analyzedTradeCount: 0,
        }),

    needsReanalysis: (currentTradeCount) => {
        const state = get();
        // 如果从未分析过，或者交易数量变化超过 5%，需要重新分析
        if (state.analyzedTradeCount === 0) return true;
        const changeRatio = Math.abs(currentTradeCount - state.analyzedTradeCount) / state.analyzedTradeCount;
        return changeRatio > 0.05;
    },
}));
