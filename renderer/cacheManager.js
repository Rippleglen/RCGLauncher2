function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PageCacheDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('Error opening IndexedDB');
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('pages')) {
                db.createObjectStore('pages', { keyPath: 'pageName' });
            }
        };
    });
}

async function cachePage(pageName, content) {
    const db = await openDB();
    const tx = db.transaction('pages', 'readwrite');
    const store = tx.objectStore('pages');
    store.put({ pageName, content });
    return tx.complete;
}

async function getCachedPage(pageName) {
    const db = await openDB();
    const tx = db.transaction('pages', 'readonly');
    const store = tx.objectStore('pages');
    return store.get(pageName);
}

// Export functions using CommonJS
module.exports = {
    openDB,
    cachePage,
    getCachedPage
};
