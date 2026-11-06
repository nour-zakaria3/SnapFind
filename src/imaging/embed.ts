import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@xenova/transformers';

const MODEL = 'Xenova/clip-vit-base-patch32';

let vision: Promise<{ processor: any; model: any }> | null = null;
let text: Promise<{ tokenizer: any; model: any }> | null = null;

function loadVision() {
  return (vision ??= (async () => ({
    processor: await AutoProcessor.from_pretrained(MODEL),
    model: await CLIPVisionModelWithProjection.from_pretrained(MODEL),
  }))());
}

function loadText() {
  return (text ??= (async () => ({
    tokenizer: await AutoTokenizer.from_pretrained(MODEL),
    model: await CLIPTextModelWithProjection.from_pretrained(MODEL),
  }))());
}

export function l2normalize(v: ArrayLike<number>): number[] {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const n = Math.sqrt(sum) || 1;
  return Array.from(v, (x) => x / n);
}

export async function embedImage(blob: Blob): Promise<number[]> {
  const { processor, model } = await loadVision();
  const url = URL.createObjectURL(blob);
  try {
    const image = await RawImage.read(url);
    const inputs = await processor(image);
    const { image_embeds } = await model(inputs);
    return l2normalize(image_embeds.data as Float32Array);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function embedText(input: string): Promise<number[]> {
  const { tokenizer, model } = await loadText();
  const inputs = tokenizer([input], { padding: true, truncation: true });
  const { text_embeds } = await model(inputs);
  return l2normalize(text_embeds.data as Float32Array);
}
