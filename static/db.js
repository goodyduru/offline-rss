const ARTICLE_LIST_HREF = "#article-list";
const DB_NAME = "offline-rss";
const DB_VERSION = 1;
const SITE_STORE_NAME = "sites";
const ARTICLE_STORE_NAME = "articles";

let db;


function openDB() {
    let req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = (evt) => {
        db = evt.target.result;
    };
    req.onerror = (evt) => {
        console.error("Error: ", evt.target.error?.message);
    };
    req.onupgradeneeded = (evt) => {
        const site_store = evt.currentTarget.result.createObjectStore(SITE_STORE_NAME, 
            {keyPath: 'id', autoIncrement: true});
        const article_store = evt.currentTarget.result.createObjectStore(ARTICLE_STORE_NAME, 
            {keyPath: 'id', autoIncrement: true});
        site_store.createIndex('feed_url', 'feed_url', {unique: true});
        site_store.createIndex('hash', 'hash', {unique: true});
        site_store.createIndex('next_poll', 'next_poll', {unique: false});
        article_store.createIndex('site_id', 'site_id', {unique: false});
        article_store.createIndex('hash', 'hash', {unique: true});
        article_store.createIndex('link', 'link', {unique: false});
    }
}

function getObjectStore(store_name, mode) {
    let tx = db.transaction(store_name, mode);
    return tx.objectStore(store_name);
}

async function getOrCreateSite(site) {
    return new Promise((resolve, reject) => {
        let store = getObjectStore(SITE_STORE_NAME, 'readwrite');
        let hashIndex = store.index('hash');
        let id = 0;
        let req = hashIndex.get(site.hash);
        req.onsuccess = (evt) => {
            if ( typeof evt.target.result == 'undefined' ) {
                let addReq = store.add(site);
                addReq.onsuccess = (addEvt) => {
                    resolve(addEvt.target.result);
                };
                addReq.onerror = (addEvt) => {
                    reject(addEvt.target.error.name);
                }

            } else {
                id = evt.target.result.id;
                resolve(id);
            }
        };
        req.onerror = (evt) => {
            reject(evt.target.error.name);
        };
    });
}

function getOrCreateArticle(store, article) {
    let getReq = store.index('hash');
    getReq.get(article.hash).onsuccess = (getEvt) => {
        if ( typeof getEvt.target.result == 'undefined' ) {
            addArticle(store, article);
            return;
        }
    }
}

function addArticle(storeObject, article) {
    let req = storeObject.add(article);
    req.onerror = (evt) => {
        console.error(evt.target.error);
    };
}

async function hasSite(store, feed_url) {
    return new Promise((resolve, reject) => {
        let feedIndex = store.index('feed_url');
        let req = feedIndex.get(feed_url);
        req.onsuccess = (evt) => {
            if ( typeof evt.target.result == 'undefined' ) {
                resolve(false);
            } else {
                resolve(true);
            }
        }
        req.onerror = (evt) => {
            console.error(evt.target.error);
            resolve(true);
        }
    });
}

async function updateSite(site) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(SITE_STORE_NAME, "readwrite");
        let req = store.put(site);
        req.onsuccess = () => {
            resolve(true);
        };
        req.onerror = (evt) => {
            console.error(evt.target.error);
            reject(false);
        }
    })
}

async function addNewArticlesToSite(articles, site_id) {
    let metadata = await getCurrentArticlesMetaData(articles.length, site_id);
    if ( metadata == null ) {
        return;
    }
    let end = articles.length - 1;
    let store = getObjectStore(ARTICLE_STORE_NAME, "readwrite");
    for ( let i = end; i >= 0; i-- ) {
        let article = articles[i];
        if ( metadata.hashes.has(article.hash) ) {
            continue;
        }
        article.site_id = site_id;
        let id = metadata.links.get(article.link);
        if (id != undefined ) {
            updateArticle(store, article, id);
        } else {
            addArticle(store, article);
        }
    }
}

function updateArticle(store, article, id) {
    let req = store.put(article, id);
    req.onerror = (evt) => {
        console.error(evt.target.error);
    }
}

async function getCurrentArticlesMetaData(length, site_id) {
    return new Promise((resolve, reject) => {
        let links = new Map();
        let hashes = new Set();
        const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
        const siteIDRange = IDBKeyRange.only(site_id);
        const index = store.index("site_id");
        let req = index.openCursor(siteIDRange, "prev");
        let count = 0;
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor ) {
                count++;
                links.set(cursor.value.link, cursor.value.id);
                hashes.add(cursor.value.hash);
                if ( count == length ) {
                    resolve({links: links, hashes: hashes});
                    return;
                }
                cursor.continue();
            } else {
                resolve({links: links, hashes: hashes});
            }
        };
        req.onerror = (evt) => {
            console.error(evt.target.error);
            reject(null);
        }
    })
}

async function getSiteToPoll() {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(SITE_STORE_NAME, "readonly");
        const currentTime = Date.now();
        const timeRange = IDBKeyRange.upperBound(currentTime);
        const index = store.index("next_poll");
        const req = index.openCursor(timeRange);
        let result = [];
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor ) {
                result.push(cursor.value);
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(result);
        }
    })
}