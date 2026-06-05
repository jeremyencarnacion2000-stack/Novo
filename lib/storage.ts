// lib/storage.ts

export { };

declare global {
  interface Window {
    storage: {
      list: (prefix: string) => { keys: string[] };
      get: (key: string) => { value: string | null };
      set: (key: string, value: string) => void;
      delete: (key: string) => void;
    };
  }
}

const storage = {
  list: (prefix: string) => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    return { keys };
  },
  get: (key: string) => {
    return { value: localStorage.getItem(key) };
  },
  set: (key: string, value: string) => {
    localStorage.setItem(key, value);
  },
  delete: (key: string) => {
    localStorage.removeItem(key);
  },
};

// Asignar a window si está disponible
if (typeof window !== 'undefined') {
  window.storage = storage;
}