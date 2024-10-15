/**
 * This class deals with creating/opening a connection to the IndexedDB stores.
 */
app.DB = class Db {
    constructor() {
        this.siteStoreName = "sites";
        this.articleStoreName = "articles";
        this.db = null;
    }

    async open() {
        const DB_NAME = "offline-rss";
        const DB_VERSION = 1;
        return new Promise((resolve, reject) => {
            let req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onsuccess = (evt) => {
                this.db = evt.target.result;
                resolve();
            };
            req.onerror = (evt) => {
                console.error("Error: ", evt.target.error?.message);
                reject();
            };
            req.onupgradeneeded = (evt) => {
                const siteStore = evt.currentTarget.result.createObjectStore(this.siteStoreName, 
                    {keyPath: 'id', autoIncrement: true});
                const articleStore = evt.currentTarget.result.createObjectStore(this.articleStoreName, 
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

    getArticleStore(mode) {
        let tx = this.db.transaction(this.articleStoreName, mode);
        return tx.objectStore(this.articleStoreName);
    }

    getSiteStore(mode) {
        let tx = this.db.transaction(this.siteStoreName, mode);
        return tx.objectStore(this.siteStoreName);
    }
}

app.models.Site = class Site {

    /**
     * Gets a site from the Indexeddb store based on the unique attribute provided. The attribute provided
     * has to be unique for this to work. The type of attribute determines the specific store index used to
     * fetch the site object.
     * @param {String} attrType The attribute type of the site object. This determines the store index to use.
     * @param {String|Number} attrVal The key to identify the site object.
     * @returns {Object} Returns the site object from the store.
     */
    async get(attrType, attrVal) {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore('readonly');
            let req;
            if ( attrType == 'id' ) {
                req = store.get(attrVal);
            } else {
                const index = store.index(attrType);
                req = index.get(attrVal);
            }
            req.onsuccess = () => {
                resolve(req.result);
            };
            req.onerror = () => {
                console.error(req.error);
                reject(null);
            };
        });
    }

    /**
     * This function adds a site to the db store
     * @param {Object} site object to add to the db store.
     */
    async add(site) {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore('readwrite');
            let req = store.add(site);
            req.onerror = () => {
                console.error(req.error);
                reject();
            };
            req.onsuccess = () => {
                site.id = req.result;
                resolve();
            }
        });
    }

    /**
     * Checks if a site object exists in the db.
     * @param {String} attrType Determines the index to use. 'id' just uses the store directly since it's the primary key.
     * @param {String|Number} attrVal The key to identify the object.
     * @returns {bool} Does it exists.
     */
    async exists(attrType, attrVal) {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore('readonly');
            let req;
            if ( attrType == 'id' ) {
                req = store.get(attrVal);
            } else {
                let index = store.index(attrType);
                req = index.get(attrVal);
            }
            req.onsuccess = () => {
                if ( typeof req.result == 'undefined' ) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
            req.onerror = () => {
                console.error(req.error);
                reject(true);
            }
        });
    }

    /**
     * @param {Object} site Site object to update in db.
     * @returns {bool} true if successful, false otherwise.
     */
    async update(site) {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore("readwrite");
            let req = store.put(site);
            req.onsuccess = () => {
                resolve(true);
            };
            req.onerror = () => {
                console.error(req.error);
                reject(false);
            }
        })
    }

    /**
     * This gets all the sites whose polling time is less than the current time.
     * @returns {Array} Returns an array of sites to poll.
     */
    async getToPoll() {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore("readonly");
            const currentTime = Date.now();
            const timeRange = IDBKeyRange.upperBound(currentTime);
            const index = store.index("nextPoll");
            const req = index.getAll(timeRange);
            req.onsuccess = () => {
                resolve(req.result);
            };
            req.onerror = () => {
                console.error(req.error);
                reject([]);
            };
        })
    }
    
    /**
     * Gets all the sites in the db.
     * @returns {Array} List of all the sites in the db.
     */
    async getAll() {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore("readonly");
            const req = store.getAll();
            req.onsuccess = () => {
                resolve(req.result);
            };
            req.onerror = () => {
                console.error(req.error);
                reject([]);
            };
        });
    }

    /**
     * Deletes a site from the db using the id.
     * @param {*} id Id of site to delete.
     */
    async delete(id) {
        return new Promise((resolve, reject) => {
            const store = app.DB.getSiteStore("readwrite");
            req = store.delete(id);
            req.onsuccess = () => {
                resolve();
            };
            req.onerror = () => {
                console.error(req.error);
                reject();
            };
        });
    }
}

class Site {
    constructor(options = {}) {
        this.id = 0;
        Object.assign(this, options);
    }

    
}

class Article {
    constructor(options = {}) {
        this.id = 0;
        Object.assign(this, options);
    }
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
                site.id = evt.target.result.id;
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
        req.onsuccess = async (getEvt) => {
            if ( typeof getEvt.target.result == 'undefined' ) {
                await addArticle(store, article);
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
        ids = [];
        req = index.openKeyCursor(IDBKeyRange.only(siteId));
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if ( cursor ) {
                ids.push(cursor.primaryKey);
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                resolve(ids);
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