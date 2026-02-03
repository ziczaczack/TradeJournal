import { NextRequest, NextResponse } from 'next/server';
import { askMentor } from '@/lib/aiMentor';
import { fetchTrades } from '@/lib/tradeQueries';

export interface AskRequestBody {
    question: string;
    tradeDate?: string;
    context?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: AskRequestBody = await request.json();
        const { question, tradeDate } = body;

        if (!question || question.trim().length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: '请输入您的问题',
                },
                { status: 400 }
            );
        }

        // Fetch all trades for context
        const trades = await fetchTrades();

        if (trades.length === 0) {
            return NextResponse.json(
                {
                    success: true,
                    data: {
                        answer: '目前没有交易数据可供分析。请先导入一些交易记录后再提问。',
                        context: tradeDate,
                    },
                },
                { status: 200 }
            );
        }

        // Get AI mentor response
        const result = await askMentor(question, trades, tradeDate);

        return NextResponse.json(
            {
                success: true,
                data: result,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Ask Mentor API Error:', error);

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
                error: error instanceof Error ? error.message : 'AI 回答请求失败',
            },
            { status: 500 }
        );
    }
}
