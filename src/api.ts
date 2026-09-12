import type { Activity, Video } from './types';

export type AdminConfig = { apiUrl: string; adminKey: string };

type Envelope<T> = { success: boolean; data?: T; error?: string; details?: unknown };

async function request<T>(config: AdminConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': config.adminKey,
      ...init?.headers,
    },
  });
  const body = await response.json() as Envelope<T>;
  if (!response.ok || !body.success) throw new Error(body.error || 'Request failed');
  return body.data as T;
}

export const adminApi = {
  videos: (config: AdminConfig) => request<Video[]>(config, '/admin/videos'),
  activities: (config: AdminConfig) => request<Activity[]>(config, '/admin/activities'),
  removeVideo: (config: AdminConfig, id: string) => request<{ id: string }>(config, `/admin/videos/${id}`, { method: 'DELETE' }),
  removeActivity: (config: AdminConfig, id: string) => request<{ id: string }>(config, `/admin/activities/${id}`, { method: 'DELETE' }),
  createActivity: (config: AdminConfig, activity: Omit<Activity, 'id'>) => request<Activity>(config, '/admin/activities', { method: 'POST', body: JSON.stringify(activity) }),
  uploadVideo(config: AdminConfig, form: FormData, onProgress: (progress: number) => void) {
    return new Promise<Video>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${config.apiUrl.replace(/\/$/, '')}/admin/videos`);
      xhr.setRequestHeader('X-Admin-Key', config.adminKey);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
      xhr.onerror = () => reject(new Error('Could not reach the backend'));
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText) as Envelope<Video>;
          if (xhr.status < 200 || xhr.status >= 300 || !body.success) {
            reject(new Error(body.error || 'Upload failed'));
          } else {
            resolve(body.data as Video);
          }
        } catch {
          reject(new Error('Backend returned an invalid response'));
        }
      };
      xhr.send(form);
    });
  },
  importFolder: (config: AdminConfig, payload: Record<string, unknown>) =>
    request<{ published: Video[]; failed: Array<{ file: string; error: string }>; total: number }>(
      config,
      '/admin/videos/from-folder',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
};
