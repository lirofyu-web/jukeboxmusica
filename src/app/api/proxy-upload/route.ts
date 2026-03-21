import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Proxy the upload to Catbox.moe
    const catboxFormData = new FormData();
    catboxFormData.append('reqtype', 'fileupload');
    catboxFormData.append('fileToUpload', file);

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: catboxFormData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload to Catbox');
    }

    const downloadUrl = await response.text();
    return NextResponse.json({ url: downloadUrl });
  } catch (error: any) {
    console.error('Proxy Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
