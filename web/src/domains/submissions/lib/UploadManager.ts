export class UploadManager {
  static async upload(
    teamId: string,
    eventId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ storagePath: string, publicUrl?: string }> {
    
    // 1. Get Presigned URL
    const res = await fetch(`/api/v1/teams/${teamId}/submission/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        filename: file.name,
        contentType: file.type
      })
    });

    if (!res.ok) {
      throw new Error("Failed to generate upload URL");
    }

    const { data } = await res.json();
    const { signedUrl, path } = data;

    // 2. Upload file directly to Supabase storage via XMLHttpRequest to track progress
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(Math.round(percentComplete));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ storagePath: path });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload network error"));

      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  }
}
