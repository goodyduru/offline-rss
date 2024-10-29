/**
 * This class deals with creating/opening a connection to the IndexedDB stores.
 */
app.DB = class Db {
    constructor() {
        this.siteStoreName = "sites";
        this.articleStoreName = "articles";
        this.searchStoreName = "search";
        this.db = null;
    }

    async open() {
        const DB_NAME = "offline-rss";
        const DB_VERSION = 2;
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
                if ( evt.oldVersion < 1 ) {
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
                    articleStore.createIndex('siteUnread', ['siteId', 'isRead'], {unique: false});
                }

                if ( evt.oldVersion < DB_VERSION ) {
                    const searchStore = evt.currentTarget.result.createObjectStore(this.searchStoreName, {keyPath: 'id'});
                }
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

    getSearchStore(mode) {
        let tx = this.db.transaction(this.searchStoreName, mode);
        return tx.objectStore(this.searchStoreName);
    }
};