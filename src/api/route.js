// pages/api/upload.js (or app/api/upload/route.js if using App Router)
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'ad';

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate filename
    const filename = `${type}-${randomUUID()}.${file.name.split('.').pop()}`;
    const filepath = join(process.cwd(), 'public', 'uploads', filename);

    // Ensure uploads directory exists (you may need to create /public/uploads)
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;

    res.status(200).json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}