/**
 * WebAR Persistent Storage Engine (IndexedDB + LocalStorage Sync)
 * Enables permanent client-side persistence of custom 3D hardware rigs,
 * component transforms, and calibrated GLB models across page reloads and browser visits.
 */

const DB_NAME = 'WebAR_Rig_Database';
const DB_VERSION = 1;
const STORE_NAME = 'user_rigs';
const RIG_KEY = 'active_custom_rig';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save custom GLB binary Blob and component transform dictionary
 * @param {Blob} glbBlob - The compiled binary GLB model
 * @param {Object} transforms - Mapping of part IDs to { pos, rot, scale, visible }
 * @returns {Promise<boolean>}
 */
export async function saveRigToDB(glbBlob, transforms) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: RIG_KEY,
        blob: glbBlob,
        transforms: transforms,
        savedAt: new Date().toISOString()
      };
      const req = store.put(record);

      req.onsuccess = () => {
        try {
          localStorage.setItem('webar_user_transforms', JSON.stringify(transforms));
          localStorage.setItem('webar_has_custom_rig', 'true');
        } catch (_) {}
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save custom rig into IndexedDB:', err);
    try {
      localStorage.setItem('webar_user_transforms', JSON.stringify(transforms));
    } catch (_) {}
    return false;
  }
}

/**
 * Load the saved custom rig from IndexedDB
 * @returns {Promise<{ blob: Blob, transforms: Object, savedAt: string } | null>}
 */
export async function loadRigFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RIG_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not read custom rig from IndexedDB:', err);
    return null;
  }
}

/**
 * Delete custom saved rig and clear storage
 * @returns {Promise<boolean>}
 */
export async function deleteRigFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(RIG_KEY);
      req.onsuccess = () => {
        try {
          localStorage.removeItem('webar_user_transforms');
          localStorage.removeItem('webar_has_custom_rig');
        } catch (_) {}
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear custom rig from IndexedDB:', err);
    try {
      localStorage.removeItem('webar_user_transforms');
      localStorage.removeItem('webar_has_custom_rig');
    } catch (_) {}
    return false;
  }
}

/**
 * Get synchronously cached transform config if available
 * @returns {Object|null}
 */
export function getCachedTransforms() {
  try {
    const raw = localStorage.getItem('webar_user_transforms');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}
