import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

const input = path.resolve('/home/openclaw/.openclaw/workspace/repo-graph/slides/repo-graph-presentation-review.md');
const output = path.resolve('/home/openclaw/.openclaw/workspace/repo-graph/slides/repo-graph-presentation-review.pdf');

const raw = fs.readFileSync(input, 'utf8');
const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\n/, '');
const slides = withoutFrontmatter.split(/\n---\n/g).map(s => s.trim()).filter(Boolean);

function cleanLine(line) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s*/, '• ')
    .replace(/^\d+\.\s*/, m => m)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trimEnd();
}

const doc = new PDFDocument({ size: 'A4', margin: 50 });
doc.pipe(fs.createWriteStream(output));

doc.info.Title = 'repo-graph presentation review';
doc.info.Author = 'OpenClaw';

slides.forEach((slide, idx) => {
  if (idx > 0) doc.addPage();
  const lines = slide.split('\n').map(cleanLine);
  const title = lines.find(l => l.trim()) || `Slide ${idx + 1}`;
  const body = lines.slice(lines.indexOf(title) + 1).join('\n');

  doc.font('Helvetica-Bold').fontSize(26).fillColor('#111111').text(title, { align: 'left' });
  doc.moveDown(0.6);
  doc.strokeColor('#d0d7de').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(14).fillColor('#222222');

  body.split('\n').forEach((line) => {
    if (!line.trim()) {
      doc.moveDown(0.5);
    } else if (line.startsWith('## ')) {
      doc.font('Helvetica-Bold').fontSize(18).text(line.replace(/^##\s*/, ''));
      doc.font('Helvetica').fontSize(14);
    } else {
      doc.text(line, { align: 'left' });
    }
  });

  doc.fontSize(10).fillColor('#666666');
  doc.text(`Slide ${idx + 1} / ${slides.length}`, 50, 790, { align: 'right', width: 495 });
});

doc.end();
