function read(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function remove(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* private mode */
  }
}

export function readLocal(key: string): string | null {
  try {
    return read(localStorage, key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    write(localStorage, key, value);
  } catch {
    /* private mode */
  }
}

export function removeLocal(key: string): void {
  try {
    remove(localStorage, key);
  } catch {
    /* private mode */
  }
}

export function readSession(key: string): string | null {
  try {
    return read(sessionStorage, key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    write(sessionStorage, key, value);
  } catch {
    /* private mode */
  }
}

export function removeSession(key: string): void {
  try {
    remove(sessionStorage, key);
  } catch {
    /* private mode */
  }
}

const NAME_KEY = "p2evtt.displayName";
const TOKEN_KEY = "p2evtt.sessionToken";

export function loadDisplayName(): string {
  return readLocal(NAME_KEY) ?? "";
}

export function saveDisplayName(name: string): void {
  writeLocal(NAME_KEY, name);
}

/** Per-tab. localStorage is shared across tabs and was stealing the GM seat. */
export function loadSessionToken(): string | null {
  removeLocal(TOKEN_KEY);
  return readSession(TOKEN_KEY);
}

export function saveSessionToken(token: string): void {
  writeSession(TOKEN_KEY, token);
  removeLocal(TOKEN_KEY);
}

export function clearSessionToken(): void {
  removeSession(TOKEN_KEY);
  removeLocal(TOKEN_KEY);
}


