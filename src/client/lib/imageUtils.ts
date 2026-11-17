import { BLUEPRINT_LIMITS } from './blueprint';

export interface ProcessedImage {
  nomeArquivo: string;
  mimeType: string;
  imagemDataUrl: string;
}

export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
  }

  if (file.size > BLUEPRINT_LIMITS.FOTO_MAX_INPUT_BYTES) {
    throw new Error('A imagem excede o limite máximo de 5 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Não foi possível processar a imagem selecionada.'));
    el.src = rawDataUrl;
  });

  const maxDim = 1280;
  let targetWidth = img.width;
  let targetHeight = img.height;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Falha ao preparar compressão da imagem.');
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let quality = 0.82;
  let compressed = canvas.toDataURL('image/jpeg', quality);
  while (compressed.length > BLUEPRINT_LIMITS.FOTO_DATA_URL_MAX_CHARS && quality > 0.4) {
    quality -= 0.12;
    compressed = canvas.toDataURL('image/jpeg', quality);
  }

  if (compressed.length > BLUEPRINT_LIMITS.FOTO_DATA_URL_MAX_CHARS) {
    throw new Error('A imagem ficou muito grande após compressão. Escolha uma foto menor.');
  }

  return {
    nomeArquivo: file.name.slice(0, 255),
    mimeType: 'image/jpeg',
    imagemDataUrl: compressed,
  };
}
