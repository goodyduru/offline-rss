const DB_NAME = "offline-rss";
const DB_VERSION = 1;
const SITE_STORE_NAME = "sites";
const ARTICLE_STORE_NAME = "articles";
const PER_PAGE = 50;

let db;


function openDB() {
    return new Promise((resolve, reject) => {
        let req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onsuccess = (evt) => {
            db = evt.target.result;
            resolve();
        };
        req.onerror = (evt) => {
            console.error("Error: ", evt.target.error?.message);
            reject();
        };
        req.onupgradeneeded = (evt) => {
            const siteStore = evt.currentTarget.result.createObjectStore(SITE_STORE_NAME, 
                {keyPath: 'id', autoIncrement: true});
            const articleStore = evt.currentTarget.result.createObjectStore(ARTICLE_STORE_NAME, 
                {keyPath: 'id', autoIncrement: true});
            siteStore.createIndex('feedUrl', 'feedUrl', {unique: true});
            siteStore.createIndex('hash', 'hash', {unique: true});
            siteStore.createIndex('nextPoll', 'nextPoll', {unique: false});
            articleStore.createIndex('siteId', 'siteId', {unique: false});
            articleStore.createIndex('hash', 'hash', {unique: true});
            articleStore.createIndex('link', 'link', {unique: false});
            articleStore.createIndex('isRead', 'isRead', {unique: false});
            articleStore.createIndex('siteUnread', ['siteId', 'isRead'], {unique: false})
        };
    });
}

function getObjectStore(storeName, mode) {
    let tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
}

function generateSiteFromFeedObject(feedObj) {
    return {
        title: feedObj.title,
        feedUrl: feedObj.feedUrl,
        siteUrl: feedObj.siteUrl, 
        description: feedObj.description,
        hash: feedObj.hash,
        etag: feedObj.etag,
        lastModified: feedObj.lastModified,
        nextPoll: feedObj.nextPoll,
        pollInterval: feedObj.pollInterval,
    }
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

async function getOrCreateArticle(store, article) {
    return new Promise((resolve, reject) => {
        let getReq = store.index('hash');
        const req = getReq.get(article.hash);
        req.onsuccess = (getEvt) => {
            if ( typeof getEvt.target.result == 'undefined' ) {
                addArticle(store, article);
                resolve(1);
            } else {
                resolve(0);
            }
        };
        req.onerror = (evt) => {
            console.error(evt.target.error);
            reject(0);
        }
    });
}

async function addArticle(storeObject, article) {
    return new Promise((resolve, reject) => {
        let req = storeObject.add(article);
        req.onerror = (evt) => {
            console.error(evt.target.error);
            reject
        };
        req.onsuccess = (evt) => {
            article.id = evt.target.result;
            resolve();
        }
    });
}

async function hasSite(store, feedUrl) {
    return new Promise((resolve, reject) => {
        let feedIndex = store.index('feedUrl');
        let req = feedIndex.get(feedUrl);
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

async function addNewArticlesToSite(articles, siteId) {
    let metadata = await getCurrentArticlesMetaData(articles.length, siteId);
    if ( metadata == null ) {
        return null;
    }
    let end = articles.length - 1;
    let store = getObjectStore(ARTICLE_STORE_NAME, "readwrite");
    let result = 0;
    for ( let i = end; i >= 0; i-- ) {
        let article = articles[i];
        if ( metadata.hashes.has(article.hash) ) {
            continue;
        }
        article.siteId = siteId;
        let id = metadata.links.get(article.link);
        if (id != undefined ) {
            await updateArticle(store, article, id);
        } else {
            await addArticle(store, article);
        }
        result++;
    }
    return result;
}

async function updateArticle(store, article, id) {
    return new Promise((resolve, reject) => {
        if ( store == null ) {
            store = getObjectStore(ARTICLE_STORE_NAME, "readwrite");
        }
        let req = store.put(article, id);
        req.onsuccess = (evt) => {
            resolve();
        }
        req.onerror = (evt) => {
            console.error(evt.target.error);
            reject();
        };
    });
}

async function getArticle(id, isHash) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
        let req;
        if ( isHash === undefined || !isHash ) {
            req = store.get(id);
        } else {
            const index = store.index('hash');
            req = index.get(id);
        }
        req.onsuccess = (event) => {
            resolve(event.target.result);
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(null);
        };
    });
}

async function getCurrentArticlesMetaData(length, siteId) {
    return new Promise((resolve, reject) => {
        let links = new Map();
        let hashes = new Set();
        const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
        const siteIDRange = IDBKeyRange.only(siteId);
        const index = store.index("siteId");
        let req = index.openCursor(siteIDRange, "prev");
        let count = 0;
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor && count < length ) {
                links.set(cursor.value.link, cursor.value.id);
                hashes.add(cursor.value.hash);
                count++;
                cursor.continue();
            } else {
                resolve({links: links, hashes: hashes});
            }
        };
        req.onerror = (evt) => {
            console.error(evt.target.error);
            reject(null);
        };
    })
}

async function getUnreadArticles() {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
        const index = store.index("isRead");
        const req = index.openCursor(IDBKeyRange.only(0), "prev");
        let articles = [];
        let count = 0;
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor && count < PER_PAGE ) {
                articles.push(cursor.value);
                count++;
                cursor.continue();
            } else {
                resolve(articles);
            }
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(articles);
        };
    });
}

async function getSiteArticles(siteId, isRead, offset) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
        let index, req;
        if ( isRead !== undefined && isRead != null  ) {
            index = store.index("siteUnread");
            req = index.openCursor(IDBKeyRange.only([siteId, isRead]), "prev");
        } else {
            index = store.index("siteId");
            req = index.openCursor(IDBKeyRange.only(siteId), "prev");
        }
        let articles = [];
        let count = 0;
        offset = ( offset !== undefined ) ? offset : 0;
        const length = PER_PAGE + offset; 
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor && count < length ) {
                if ( count >= offset ) {
                    articles.push(cursor.value);
                }
                count++;
                cursor.continue();
            } else {
                resolve(articles);
            }
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(articles);
        };
    });
}

async function getArticles(idRanges) {
    const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
    const result = [];
    for ( let i = 0; i < idRanges.length; i += 2 ) {
        let a = await getArticlesInRange(store, idRanges[i], idRanges[i+1]);
        result.push(...a);
    }
    return result;
}

async function getArticlesInRange(store, start, end) {
    return new Promise((resolve, reject) => {
        const result = [];
        let range;
        if ( start == end ) {
            range = IDBKeyRange.only(start);
        } else {
            range = IDBKeyRange.bound(start, end);
        }
        store.openCursor(range, "prev").onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor ) {
                result.push(cursor.value);
                cursor.continue();
            } else {
                resolve(result);
            }
        }
    });
}

async function getSite(id, isHash) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(SITE_STORE_NAME, "readonly");
        let req;
        if ( isHash === undefined || !isHash ) {
            req = store.get(id);
        } else {
            const index = store.index('hash');
            req = index.get(id);
        }
        req.onsuccess = (event) => {
            resolve(event.target.result);
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(null);
        };
    });
}

async function getSitesToPoll() {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(SITE_STORE_NAME, "readonly");
        const currentTime = Date.now();
        const timeRange = IDBKeyRange.upperBound(currentTime);
        const index = store.index("nextPoll");
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
        };
    })
}

async function getAllSites() {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(SITE_STORE_NAME, "readonly");
        const req = store.openCursor();
        let sites = [];
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor ) {
                sites.push(cursor.value);
                cursor.continue();
            } else {
                resolve(sites);
            }
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(sites);
        };
    });
}

async function countSiteUnreadArticles(siteId) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(ARTICLE_STORE_NAME, "readonly");
        const index = store.index("siteUnread");
        const req = index.count(IDBKeyRange.only([siteId, 0]));
        req.onsuccess = (event) => {
            resolve(event.target.result);
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject(0);
        };
    });
}

async function deleteSiteArticles(siteId) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(ARTICLE_STORE_NAME, "readwrite");
        const index = store.index("siteId");
        req = index.openKeyCursor(IDBKeyRange.only(siteId));
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor ) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                resolve();
            }
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject();
        };
    });
}

async function deleteSite(siteId) {
    return new Promise((resolve, reject) => {
        const store = getObjectStore(SITE_STORE_NAME, "readwrite");
        req = store.delete(siteId);
        req.onsuccess = () => {
            resolve();
        };
        req.onerror = (event) => {
            console.error(event.target.error);
            reject();
        };
    });
}