import { NextRequest, NextResponse } from 'next/server';
import { generateAutoReview, AIReviewResult } from '@/lib/aiMentor';
import { fetchTrades } from '@/lib/tradeQueries';

export interface ReviewRequestBody {
    tradeIds?: string[];
    dateRange?: {
        start: string;
        end: string;
    };
    limit?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: ReviewRequestBody = await request.json();
        const { limit = 10 } = body;

        // Fetch trades from database
        let trades = await fetchTrades();

        // Apply date range filter if provided
        if (body.dateRange?.start && body.dateRange?.end) {
            trades = trades.filter((trade) => {
                const tradeDate = trade.exit_time || trade.entry_time;
                if (!tradeDate) return false;
                return tradeDate >= body.dateRange!.start && tradeDate <= body.dateRange!.end;
            });
        }

        // Apply trade IDs filter if provided
        if (body.tradeIds && body.tradeIds.length > 0) {
            trades = trades.filter((trade) => body.tradeIds!.includes(trade.id));
        }

        // Limit the number of trades
        const limitedTrades = trades.slice(0, Math.min(limit, 50));

        if (limitedTrades.length === 0) {
            return NextResponse.json(
                {
                    success: true,
                    data: {
                        insights: '没有找到符合条件的交易数据。请调整筛选条件或导入更多交易记录。',
                        recommendations: [],
                        emotionWarnings: [],
                        rawResponse: '',
                    } as AIReviewResult,
                },
                { status: 200 }
            );
        }

        // Generate AI review
        const review = await generateAutoReview(limitedTrades);

        return NextResponse.json(
            {
                success: true,
                data: review,
                meta: {
                    tradesAnalyzed: limitedTrades.length,
                    dateRange: body.dateRange,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('AI Review API Error:', error);

        // Check for specific error types
        if (error instanceof Error && error.message.includes('GROQ_API_KEY')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'AI 服务未配置。请在 .env.local 中设置 GROQ_API_KEY。',
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'AI 分析请求失败',
            },
            { status: 500 }
        );
    }
}
