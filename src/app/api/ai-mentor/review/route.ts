import { NextRequest, NextResponse } from 'next/server';
import { generateAutoReview, AIReviewResult } from '@/lib/aiMentor';
import { fetchTrades } from '@/lib/tradeQueries';
import { getSupabaseForToken } from '@/lib/supabaseServer';

export interface ReviewRequestBody {
    accountId?: string;
    tradeIds?: string[];
    dateRange?: {
        start: string;
        end: string;
    };
    limit?: number;
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate: the caller forwards their Supabase access token. Sessions
        // are stored client-side, so without this the server has no user context
        // and RLS returns zero rows.
        const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized: missing access token' },
                { status: 401 }
            );
        }

        const supabase = getSupabaseForToken(token);
        // Pass the token explicitly: there is no persisted session on the server,
        // so getUser() must validate the JWT it is given.
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized: invalid or expired session' },
                { status: 401 }
            );
        }

        const body: ReviewRequestBody = await request.json();
        const { limit = 10, accountId } = body;

        // Fetch trades scoped to the authenticated user (RLS enforced via token client),
        // and to the selected account so the review matches the on-screen analytics.
        let trades = await fetchTrades(accountId ? { accountId } : undefined, supabase);

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
