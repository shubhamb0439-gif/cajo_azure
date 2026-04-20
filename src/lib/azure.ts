const API_BASE_URL = import.meta.env.VITE_AZURE_API_BASE_URL as string;
const API_KEY = import.meta.env.VITE_AZURE_API_KEY as string;

export type ApiResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

function getAuthToken(): string | null {
  return localStorage.getItem('azure_access_token');
}

function buildHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_KEY) {
    headers['x-functions-key'] = API_KEY;
  }

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return { ...headers, ...extraHeaders };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers as Record<string, string>),
    });

    if (response.status === 204) {
      return { data: null, error: null };
    }

    const json = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: { message: json.message || 'Request failed', code: String(response.status) },
      };
    }

    return { data: json as T, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: { message } };
  }
}

export const azureApi = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const azureStorage = {
  getPublicUrl(container: string, path: string): string {
    const account = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME as string;
    const sas = import.meta.env.VITE_AZURE_STORAGE_SAS_TOKEN as string;
    return `https://${account}.blob.core.windows.net/${container}/${path}?${sas}`;
  },

  async upload(
    container: string,
    blobName: string,
    file: File
  ): Promise<ApiResponse<{ url: string }>> {
    const account = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME as string;
    const sas = import.meta.env.VITE_AZURE_STORAGE_SAS_TOKEN as string;
    const url = `https://${account}.blob.core.windows.net/${container}/${blobName}?${sas}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) {
        return { data: null, error: { message: 'Upload failed', code: String(response.status) } };
      }

      return {
        data: { url: `https://${account}.blob.core.windows.net/${container}/${blobName}` },
        error: null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      return { data: null, error: { message } };
    }
  },

  async remove(container: string, blobName: string): Promise<ApiResponse<null>> {
    const account = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME as string;
    const sas = import.meta.env.VITE_AZURE_STORAGE_SAS_TOKEN as string;
    const url = `https://${account}.blob.core.windows.net/${container}/${blobName}?${sas}`;

    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (!response.ok) {
        return { data: null, error: { message: 'Delete failed', code: String(response.status) } };
      }
      return { data: null, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { data: null, error: { message } };
    }
  },

  async list(
    container: string,
    prefix?: string
  ): Promise<ApiResponse<{ name: string; url: string }[]>> {
    const account = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME as string;
    const sas = import.meta.env.VITE_AZURE_STORAGE_SAS_TOKEN as string;
    const prefixParam = prefix ? `&prefix=${encodeURIComponent(prefix)}` : '';
    const url = `https://${account}.blob.core.windows.net/${container}?restype=container&comp=list${prefixParam}&${sas}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { data: null, error: { message: 'List failed', code: String(response.status) } };
      }
      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const blobs = Array.from(xml.querySelectorAll('Blob')).map((blob) => {
        const name = blob.querySelector('Name')?.textContent || '';
        return {
          name,
          url: `https://${account}.blob.core.windows.net/${container}/${name}`,
        };
      });
      return { data: blobs, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'List failed';
      return { data: null, error: { message } };
    }
  },
};
