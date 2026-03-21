import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('URL parameter is missing', { status: 400 });
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Some services block requests without a user agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream responded with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const contentDisposition = response.headers.get('content-disposition');
    const contentLength = response.headers.get('content-length');

    // Create a new response using the remote stream body
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        ...(contentDisposition && { 'Content-Disposition': contentDisposition }),
        ...(contentLength && { 'Content-Length': contentLength }),
      },
    });
  } catch (error: any) {
    console.error('Proxy Download Error:', error);
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 });
  }
}
