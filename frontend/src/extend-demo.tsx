import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PDFViewer } from './components/extend/pdf-viewer';
import './extend-ui.css';

function ExtendDemo() {
  const [src, setSrc] = useState('');
  const [pages, setPages] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let url = '';
    void (async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([595, 842]);
      page.drawText('ShareShield fictional PDF viewer test', { x: 50, y: 760, size: 20, font });
      page.drawText('No private documents or external AI requests.', { x: 50, y: 720, size: 14, font });
      const bytes = await doc.save();
      if (disposed) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      setSrc(url);
    })().catch(e => setError(e instanceof Error ? e.message : 'Fixture failed'));
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, []);
  return <main className="bg-background text-foreground p-6">
    <h1 className="mb-2 text-xl font-semibold">Extend PDF viewer evaluation</h1>
    <p className="mb-4">Fictional fixture only. Previewing a file does not redact it.</p>
    <p role="status">{error || (pages ? `Loaded ${pages} page` : 'Loading fixture…')}</p>
    {src && <PDFViewer src={src} showUpload={false} showDownload={false} className="mt-4 h-[800px]" onDocumentLoadSuccess={setPages} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<ExtendDemo />);
