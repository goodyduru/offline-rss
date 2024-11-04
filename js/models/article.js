app.models.Article = class Article extends app.Model {
    async get(store, attrType, attrVal) {
        if ( store === undefined  || store === null ) {
            store = app.db.getArticleStore('readonly');
        }
        return await super.get(store, attrType, attrVal);
    }

    async add(store, article) {
        if ( store === undefined  || store === null ) {
            store = app.db.getArticleStore('readwrite');
        }
        return await super.add(store, article);
    }

    async update(store, article) {
        if ( store === undefined  || store === null ) {
            store = app.db.getArticleStore('readwrite');
        }
        return await super.update(store, article);
    }

    async exists(store, attrType, attrVal) {
        if ( store === undefined  || store === null ) {
            store = app.db.getArticleStore('readonly');
        }
        return await super.exists(store, attrType, attrVal);
    }

    /**
     * Gets the articles that fit the key range. The articles are gotten from the oldest to the newest.
     * @param {IDBObjectStore} store Store to fetch articles.
     * @param {IDBKeyRange} indexKeyRange index key to use to get articles.
     * @param {String} indexName Name of IDB index to use.
     * @param {Number} offset Start of articles to add to array.
     * @param {Number} numArticles Number of articles to return
     * @returns {Array} List of articles to return.
     */
    async #getReverse(store, indexKeyRange, indexName, offset, numArticles) {
        return new Promise((resolve, reject) => {
            let req;
            if ( indexName == "id" ) {
                req = store.openCursor(indexKeyRange, "prev");
            } else {
                const index = store.index(indexName);
                req = index.openCursor(indexKeyRange, "prev");
            }
            let articles = [];
            let count = 0;
            // Assume offset is 0 if it's undefined.
            offset = ( offset !== undefined ) ? offset : 0;
            let length = ( numArticles !== undefined ) ? numArticles : this.per_page;
            length += offset; 
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
    };

    /**
     * This gets the hashes and links of the newest `length` articles from the store
     * @param {Number} length Number of articles to get
     * @param {Number} siteId Id of site containing the articles
     * @returns {Object} An object containing the links and hashes of the newest `length` articles.
     */
    async #getLatestMetaData(length, siteId) {
        let links = new Map();
        let hashes = new Set();
        const store = app.db.getArticleStore('readonly');
        const siteIDRange = IDBKeyRange.only(siteId);
        let articles = await this.#getReverse(store, siteIDRange, "siteId", 0, length);
        articles.forEach((article) => {
            links.set(article.link, article.id);
            hashes.add(article.hash);
        });
        return {links: links, hashes: hashes};
    }

    /**
     * Adds new articles for a site to the article indexeddb store. It gets the hashes and links of the 
     * n newest articles in the store where n is the number of articles gotten from the feed. The hashes
     * are used to prevent duplicate articles from being added to the store. When the article is updated
     * by the site author but exists in the store, the article is updated. When the article metadata does
     * not exists in the store, it is added to the store.
     * @param {Array} articles List of articles to add.
     * @param {Number} siteId Id of site that contains the articles.
     */
    async addToSite(articles, siteId) {
        let metadata = await this.#getLatestMetaData(articles.length, siteId);
        if ( metadata == null ) {
            return null;
        }
        let end = articles.length - 1;
        let store = app.db.getArticleStore('readwrite');
        let result = 0;
        for ( let i = end; i >= 0; i-- ) {
            let article = articles[i];
            if ( metadata.hashes.has(article.hash) ) {
                continue;
            }
            article.siteId = siteId;
            let id = metadata.links.get(article.link);
            if (id != undefined ) {
                article.id = id;
                await this.update(store, article);
            } else {
                await this.add(store, article);
            }
            result++;
        }
        return result;
    }

    /**
     * Gets a list of unread articles
     * @returns List of unread articles
     */
    async getUnread() {
        const store = app.db.getArticleStore('readonly');
        let indexKeyRange = IDBKeyRange.only(0);
        let articles = await this.#getReverse(store, indexKeyRange, "isRead");
        return articles;
    }

    /**
     * Get articles belonging a site starting from offset.
     * It could be unread or not depending on the `isRead` parameter.
     * The articles are gotten from the newest to the oldest
     * @param {Number} siteId Id of site containing articles
     * @param {Number 0|1} isRead Determines if only read/unread articles should be returned.
     * @param {Number} offset Start of articles.
     * @returns List of articles
     */
    async getInSite(siteId, isRead, offset) {
        const store = app.db.getArticleStore('readonly');
        let indexKeyRange, indexName;
        if ( isRead !== undefined && isRead != null  ) { 
            indexKeyRange = IDBKeyRange.only([siteId, isRead]);
            indexName = "siteUnread";
        } else {
            indexKeyRange = IDBKeyRange.only(siteId);
            indexName = "siteId";
        }
        let articles = await this.#getReverse(store, indexKeyRange, indexName, offset);
        return articles;
    }

    /**
     * Get articles within the array of ids. Each pair of ids determines the
     * lower and upper bounds to fetch articles. If the pair is the same, only
     * a single article with that article is fetched.
     * @param {Array} idRanges List of ids determining the bounds
     * @returns List of articles
     */
    async getInRanges(idRanges) {
        const store = app.db.getArticleStore('readonly');
        const result = [];
        for ( let i = 0; i < idRanges.length; i += 2 ) {
            let indexKeyRange;
            if ( idRanges[i] == idRanges[i+1] ) {
                indexKeyRange = IDBKeyRange.only(idRanges[i]);
            } else {
                indexKeyRange = IDBKeyRange.bound(idRanges[i], idRanges[i+1]);
            }
            let articles = await this.#getReverse(store, indexKeyRange, "id");
            result.push(...articles);
        }
        return result;
    }

    /**
     * Counts the number of unread articles belonging to site
     * @param {Number} siteId Id of site containing unread articles to count
     * @returns {Number} Number of unread articles
     */
    async countUnreadInSite(siteId) {
        return new Promise((resolve, reject) => {
            const store = app.db.getArticleStore('readonly');
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
    
    /**
     * Deletes articles belonging to site.
     * @param {Number} siteId Id of site containing articles to delete.
     * @returns {Array} Returns ids of articles that were deleted.
     */
    async deleteInSite(siteId) {
        return new Promise((resolve, reject) => {
            const store = app.db.getArticleStore('readwrite');
            const index = store.index("siteId");
            let ids = [];
            const req = index.openKeyCursor(IDBKeyRange.only(siteId));
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

    /**
     * Counts the number of articles in db
     * @returns {Number} Number of articles
     */
    async count() {
        return new Promise((resolve, reject) => {
            const store = app.db.getArticleStore('readonly');
            const req = store.count();
            req.onsuccess = (event) => {
                resolve(event.target.result);
            };
            req.onerror = (event) => {
                console.error(event.target.error);
                reject(0);
            };
        });
    }
};