import { createWorker, type Worker } from 'tesseract.js';

let worker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!worker) worker = createWorker(['ara', 'eng']);
  return worker;
}

/** Returns the text found in the image, or '' when there is none. */
export async function extractText(blob: Blob): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(blob);
  return (data.text ?? '').replace(/\s+/g, ' ').trim();
}
