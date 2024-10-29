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