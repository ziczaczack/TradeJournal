import { NextResponse } from 'next/server';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'Missing from or to parameters' }, { status: 400 });
    }

    const apiKey = process.env.FMP_API_KEY;
    
    if (!apiKey) {
        console.error('FMP_API_KEY is not set');
        return NextResponse.json({ error: 'Internal Server Error: API Key missing' }, { status: 500 });
    }

    try {
        const url = `${FMP_BASE_URL}/economic_calendar?from=${fromDate}&to=${toDate}&apikey=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error('FMP API error:', response.status, response.statusText);
            return NextResponse.json({ error: 'Error fetching from external API' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching economic calendar:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
