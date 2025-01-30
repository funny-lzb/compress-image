/* eslint-disable no-restricted-globals */
const worker = self as unknown as Worker;

interface WorkerMessage {
  file: Blob;
}

worker.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { file } = e.data;
    
    try {
      const processedFile = await preprocessImage(file);
      worker.postMessage(processedFile);
    } catch (error) {
      worker.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
  
async function preprocessImage(file: Blob): Promise<Blob> {
    if (file.size <= 5 * 1024 * 1024) { // 小于5MB直接返回
      return file;
    }
  
    // 创建图片对象
    const img = await createImageBitmap(file);
    
    // 计算新尺寸
    const maxDim = 2048;
    let width = img.width;
    let height = img.height;
    
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height / width) * maxDim);
        width = maxDim;
      } else {
        width = Math.round((width / height) * maxDim);
        height = maxDim;
      }
    }
  
    // 创建 canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
  
    // 绘制图片
    ctx.drawImage(img, 0, 0, width, height);
    
    // 转换为 blob
    return await canvas.convertToBlob({
      type: file.type,
      quality: 0.8,
    });
  }

export {};