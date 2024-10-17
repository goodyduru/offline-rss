app.Model = class Model {
    constructor() {
        this.per_page = 50;
    }
    /**
     * Gets an item from the Indexeddb store based on the unique attribute provided. The attribute provided
     * has to be unique for this to work. The type of attribute determines the specific store index used to
     * fetch the object.
     * @param {IDBObjectStore} store The indexeddb store.
     * @param {String} attrType The attribute type of the site object. This determines the store index to use.
     * @param {String|Number} attrVal The key to identify the site object.
     * @returns {Object} Returns the site object from the store.
     */
    async get(store, attrType, attrVal) {
        return new Promise((resolve, reject) => {
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
     * This function adds an object to the db store
     * @param {IDBObjectStore} store indexeddb store.
     * @param {Object} obj object to add to the db store.
     */
    async add(store, obj) {
        return new Promise((resolve, reject) => {
            let req = store.add(obj);
            req.onerror = () => {
                console.error(req.error);
                reject();
            };
            req.onsuccess = () => {
                obj.id = req.result;
                resolve();
            }
        });
    }

    /**
     * Checks if an object exists in the db.
     * @param {IDBObjectStore} store The store to check.
     * @param {String} attrType Determines the index to use. 'id' just uses the store directly since it's the primary key.
     * @param {String|Number} attrVal The key to identify the object.
     * @returns {bool} Does it exists.
     */
    async exists(store, attrType, attrVal) {
        return new Promise((resolve, reject) => {
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
     * Update object in store
     * @param {IDBObjectStore} store indexeddb store.
     * @param {Object} obj object to update in db.
     * @returns {bool} true if successful, false otherwise.
     */
    async update(store, obj) {
        return new Promise((resolve, reject) => {
            let req = store.put(obj);
            req.onsuccess = () => {
                resolve(true);
            };
            req.onerror = () => {
                console.error(req.error);
                reject(false);
            }
        })
    }
};


app.models.Site = class Site extends app.Model {
    async get(attrType, attrVal) {
        const store = app.db.getSiteStore('readonly');
        return await super.get(store, attrType, attrVal);
    }

    async add(site) {
        const store = app.db.getSiteStore('readwrite');
        return await super.add(store, site);
    }

    /**
     * Checks if a site object exists in the db.
     * @param {String} attrType Determines the index to use. 'id' just uses the store directly since it's the primary key.
     * @param {String|Number} attrVal The key to identify the object.
     * @returns {bool} Does it exists.
     */
    async exists(store, attrType, attrVal) {
        if ( store === undefined  || store === null ) {
            store = app.db.getSiteStore('readonly');
        }
        return await super.exists(store, attrType, attrVal);
    }

    async update(site) {
        const store = app.db.getSiteStore('readwrite');
        return await super.update(store, site);
    }

    /**
     * This gets all the sites whose polling time is less than the current time.
     * @returns {Array} Returns an array of sites to poll.
     */
    async getToPoll() {
        return new Promise((resolve, reject) => {
            const store = app.db.getSiteStore("readonly");
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
            const store = app.db.getSiteStore("readonly");
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
     * @param {Number} id Id of site to delete.
     */
    async delete(id) {
        return new Promise((resolve, reject) => {
            const store = app.db.getSiteStore("readwrite");
            const req = store.delete(id);
            req.onsuccess = () => {
                resolve();
            };
            req.onerror = () => {
                console.error(req.error);
                reject();
            };
        });
    }

    /**
     * Generate a site object from a feed object.
     * @param {Obj} feed feed object.
     * @returns {Obj} site object.
     */
    static generateObjectFromFeed(feedObj) {
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
};


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
};


app.models.Search = class Search extends app.Model {
    constructor() {
        super();
        this.radix = new Radix();
        /**
        * Stopwords gotten from lucene. A union of (https://github.com/apache/lucene/blob/5d5dddd10328a6131c5bd06c88fef4034971a8e9/lucene/analysis/common/src/java/org/apache/lucene/analysis/en/EnglishAnalyzer.java#L47) and (https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/resources/org/apache/lucene/analysis/cjk/stopwords.txt).
        */
        this.stopWords = ["a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is",
            "it", "no", "not", "of", "on", "or", "s", "such", "t", "that", "the", "their", "then", "there",
            "these", "they", "this", "to", "was", "will", "with", "www"];
    }

    /**
     * Add an article's title and content to the radix index. This function splits the sentences into individual words
     * and removes all the symbols and spaces. The result that isn't in the stopwords are then added to the radix tree.
     * @param {Object} article article to add to the index.
     */
    add(article) {
        let titleArray = article.title.toLowerCase().split(" ");
        for ( let title of titleArray ) {
            if ( this.stopWords.includes(title) ) {
                continue;
            }
            let ts = title.split("-");
            for ( let t of ts ) {
                t = t.replace(/\W/g, '');
                if ( t != title && this.stopWords.includes(t) ) {
                    continue;
                }
                if ( t != "" ) {
                    this.radix.insert(t, article.id, true);
                }
            }
        }

        // Convert html to text.
        let template = document.createElement("template");
        template.innerHTML = article.content;
        let articleContent = template.content.textContent || template.content.innerText || "";
    
        let contentArray = articleContent.toLowerCase().split(" ");
        for ( let content of contentArray ) {
            if ( this.stopWords.includes(content) ) {
                continue;
            }
            let cs = content.split("-");
            for ( let c of cs ) {
                c = c.replace(/\W/g, '');
                if ( c != content && this.stopWords.includes(c) ) {
                    continue;
                }
                if ( c != "" ) {
                    this.radix.insert(c, article.id, false);
                }
            }
        }
    }

    /**
     * Searches for the sentence in the search index. The sentence is splitted into words and each word is sought for in the index.
     * @param {String} words The sentence to search for.
     * @returns {Array} A list of the article ids that contains the words.
     */
    get(words) {
        words = words.toLowerCase();
        let wordArray = words.trim().split(" ");
        let results = {};
        for ( let word of wordArray ) {
            let w = word.trim();
            if ( word == "" ) {
                continue;
            }
            let res = this.radix.startsWith(w);
            if ( res == null ) {
                continue;
            }
            for ( let p of res ) {
                // Give title twice the weights of content.
                // TODO: Work on the scoring system.
                if ( results[p.id] ) {
                    results[p.id] += p.bodyPopulation;
                    results[p.id] += (2 * p.titlePopulation);
                } else {
                    results[p.id] = 2 * p.titlePopulation + p.bodyPopulation;
                }
            }
        }
        let entries = Object.entries(results);
        entries.sort((a, b) => b[1] - a[1]);
        return entries.map((val) => parseInt(val[0]));
    }

    /**
     * Creates the index of all the articles in the db.
     */
    async create() {
        let sites = await app.siteModel.getAll();
        for ( let site of sites ) {
            let done = false;
            let offset = 0;
            while ( !done ) {
                let articles = await app.articleModel.getInSite(site.id, null, offset);
                if ( articles == null || articles.length < this.per_page ) {
                    done = true;
                }
                offset += articles.length;
                for ( let article of articles ) {
                    this.add(article);
                }
            }
        }
    }

    /**
     * Delete articles from the index using their ids.
     * @param {Array} ids Article ids to delete
     */
    delete(ids) {
        for ( let id of ids ) {
            this.radix.delete(id);
        }
    }
};
