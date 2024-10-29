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