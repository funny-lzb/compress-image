export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  export const preprocessImage = async (file: File): Promise<File> => {
    if (file.size <= 5 * 1024 * 1024) return file;
  
    try {
      const img = await createImageBitmap(file);
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
  
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
  
      if (!ctx) throw new Error("Failed to get canvas context");
  
      ctx.drawImage(img, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b || file), file.type, 0.8),
      );
  
      return new File([blob], file.name, { type: file.type });
    } catch (error) {
      console.warn("Image preprocessing failed:", error);
      return file;
    }
  };