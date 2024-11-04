const SECONDS_IN_MINUTES = 60000;

/**
 * Hash function by bryc
 * https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 */
const cyrb53 = function(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/**
 * This parses an atom or rss page text into a top-level object containing just the title, url, hash and dom tree object.
 */
async function getFeedObject(response) {
    let feedObj = null;
    let text = response.text;
    if ( text.includes("<rss") ) {
        feedObj = await parseAsRSS(text);
    } else if ( text.includes("<feed")) {
        feedObj = await parseAsAtom(text);
    }
    if ( feedObj != null ) {
        feedObj.etag = response.etag;
        feedObj.lastModified = response.lastModified;
        feedObj.pollInterval = (5*SECONDS_IN_MINUTES);
        feedObj.nextPoll = Date.now() + (5*SECONDS_IN_MINUTES);
    }
    return feedObj;
}

function getEmptyFeedObject() {
    return {title: "", feedUrl: "", siteUrl: "", description: "", hash: "", 
        etag: null, lastModified: null, pollInterval: 0, nextPoll: 0, articles: []}
}

async function parseAsRSS(text) {
    const tree = await new window.DOMParser().parseFromString(text, "text/xml");
    let title = tree.querySelector("channel>title");
    let link = tree.querySelector("channel>link");
    let description = tree.querySelector("channel>description");
    let result = getEmptyFeedObject();
    result.title = ( title != null ) ? title.innerHTML.replace("<![CDATA[", "").replace("]]>", "").trim() : "";
    result.feedUrl = ( link != null ) ? link.innerHTML : "";
    result.description = ( description != null ) ? description.innerHTML : "";
    result.hash = cyrb53(text);
    if ( result.feedUrl == "" && link != null ) {
        result.feedUrl = link.getAttribute("href");
    }
    if ( result.feedUrl != "" ) {
        let u = new URL(result.feedUrl);
        result.siteUrl = u.origin;
    }
    result.articles = parseRSSEntities(tree);
    return result;
}

async function parseAsAtom(text) {
    const tree = await new window.DOMParser().parseFromString(text, "text/xml");
    let title = tree.querySelector("feed>title");
    let links = tree.querySelectorAll("feed>link");
    let result = getEmptyFeedObject();
    result.hash = cyrb53(text);
    result.title = ( title != null ) ? title.innerHTML.replace("<![CDATA[", "").replace("]]>", "").trim() : "";
    if ( links.length == 1 ) {
        result.feedUrl = links[0].getAttribute("href");
        let u = new URL(result.feedUrl);
        result.siteUrl = u.origin;
    } else {
        links.forEach((link) => {
            if ( link.getAttribute("rel") == "self" ) {
                result.feedUrl = link.getAttribute("href");
            } else if ( result.siteUrl == "" ) {
                result.siteUrl = link.getAttribute("href");
            }
        })
    }
    result.articles = parseAtomEntities(tree);
    return result;
}

function parseRSSEntities(tree) {
    let result = [];
    let items = tree.querySelectorAll("item");
    items.forEach(item => {
        entry = {title: "", link: "", content: "", pubDate: "", hash: 0, siteId: 0, isRead: 0};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let description = item.querySelector("description");
        let pubDate = item.querySelector("pubDate");
        entry.title = ( title != null ) ? title.innerHTML.replace("<![CDATA[", "").replace("]]>", "").trim() : "";
        entry.link = ( link != null ) ? link.innerHTML : "";
        entry.content = getDOMText(description, entry.link);
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        entry.hash = cyrb53(item.innerHTML);
        result.push(entry);
    });
    return result;
}

function parseAtomEntities(tree) {
    let result = [];
    let items = tree.querySelectorAll("entry");
    items.forEach(item => {
        entry = {title: "", link: "", content: "", pubDate: "", hash: 0, siteId: 0, isRead: 0};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let content = item.querySelector("content");
        let pubDate = item.querySelector("published");
        entry.title = ( title != null ) ? title.innerHTML.replace("<![CDATA[", "").replace("]]>", "").trim() : "";
        entry.link = ( link != null ) ? link.getAttribute("href") : "";
        entry.content = getDOMText(content, entry.link);
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        entry.hash = cyrb53(item.innerHTML);
        if ( entry.pubDate == "" ) {
            pubDate = item.querySelector("updated");
            entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        }
        if ( entry.content == "" ) {
            content = item.querySelector("summary");
            entry.content = getDOMText(content, entry.link);
        }
        result.push(entry);
    });
    return result;
}

function getDOMText(articleContent, articleUrl) {
    if ( articleContent == null ) {
        return "";
    }
    const html = articleContent.innerHTML.replace("<![CDATA[", "").replace("]]>", "");
    const tree = new window.DOMParser().parseFromString(html, "text/html");
    convertImagesSrc(tree, articleUrl);
    convertAnchorsHref(tree, articleUrl);
    return tree.body.innerHTML;
}

function convertImagesSrc(tree, articleUrl) {
    let images = tree.querySelectorAll("img");
    for ( img of images ) {
        let url = new URL(img.getAttribute('src'), articleUrl);
        img.setAttribute("src", `/proxy?u=${encodeURIComponent(url.toString())}`);
        let srcSets = img.getAttribute('srcset');
        if ( srcSets == null ) {
            continue;
        }
        let srcs = srcSets.split(",");
        for ( let i = 0; i < srcs.length; i++ ) {
            let t = srcs[i].trim().split(" ");
            url = new URL(t[0], articleUrl);
            t[0] = `/proxy?u=${encodeURIComponent(url.toString())}`;
            srcs[i] = t.join(" ");
        }
        img.setAttribute('srcset', srcs.join(", "));
    }

    let sources = tree.querySelectorAll("source");
    for ( source of sources ) {
        let url = new URL(source.getAttribute('srcset'), articleUrl);
        source.setAttribute("srcset", `/proxy?u=${encodeURIComponent(url.toString())}`);
    }
}

function convertAnchorsHref(tree, articleUrl) {
    let anchors = tree.querySelectorAll("a");
    for ( anchor of anchors ) {
        let href = anchor.getAttribute('href');
        if ( href == "" || href.startsWith("#") ) {
            continue;
        }
        let url = new URL(href, articleUrl);
        anchor.setAttribute("href", url.toString());
        anchor.setAttribute("target", "_blank");
    }
}

/**
 * A Javascript port of Newblur's feedfinder
 * https://github.com/samuelclay/NewsBlur/blob/master/utils/feedfinder_forman.py
 */
function coerceUrl(url) {
    url = url.trim();
    if ( url.startsWith("feed://") ) {
        return `http://${url.substring(7)}`;
    }
    const protos = ["http://", "https://"];
    for ( proto of protos ) {
        if ( url.startsWith(proto) ) {
            return url;
        }
    }
    return `http://${url}`;
}

function isFeedData(text) {
    let data = text.toLowerCase();
    if ( data.length > 0 && data.substring(0, 100).includes("<html") ) {
        return false;
    }
    return ( data.includes("<rss") || data.includes("<feed") );
}

async function getNewFeed(url) {
    let response;
    try {
        response = await fetch(`/proxy?u=${encodeURIComponent(url)}&sw=0`);
    } catch {
        return null;
    }

    if (!response.ok) {
        return null;
    }
    let lastModified = response.headers.get("Last-Modified");
    let etag = response.headers.get("ETag");
    let text = await response.text();
    return {lastModified: lastModified, etag: etag, text: text};
}

async function isFeed(url, feedMap) {
    let response = await getNewFeed(url);
    if ( response == null || response.text == null ) {
        return false;
    }
    let isOne = isFeedData(response.text);
    if ( isOne ) {
        let feedObj = await getFeedObject(response);
        feedMap.set(url, feedObj);
    }
    return isOne;
}

function isFeedUrl(url) {
    let suffixes = [".rss", ".xml", ".atom"];
    url = url.toLowerCase();
    return suffixes.some((suffix) => {
        return url.endsWith(suffix);
    });
}

function isFeedLikeUrl(url) {
    let includes = [".rss", ".xml", ".atom"];
    url = url.toLowerCase();
    return includes.some((sub) => {
        return url.indexOf(sub) > -1;
    });
}

async function findFeeds(url, checkAll=false) {
    url = coerceUrl(url);
    const feedResponse = await getNewFeed(url);
    if ( feedResponse == null || feedResponse.text == null ) {
        return null;
    }
    const feedText = feedResponse.text;
    // initialize a key-value map for a url and its feed object. 
    // This will also act as a cache to avoid parsing a feed url.
    let feedMap = new Map();
    if ( isFeedData(feedText) ) {
        feedObj = await getFeedObject(feedResponse);
        feedMap.set(url, feedObj);
        return {urls: [url], feedMap: feedMap};
    }
    const tree = new window.DOMParser().parseFromString(feedText, "text/html");
    let links = [];
    let types = [
        "application/rss+xml",
        "text/xml",
        "application/atom+xml",
        "application/x.atom+xml",
        "application/x-atom+xml"
    ];

    // Look for <link> tags.
    tree.querySelectorAll("link").forEach((link) => {
        let type = link.getAttribute("type");
        if ( type == null ) {
            return;
        }
        if ( types.includes(type) ) {
            let href = link.getAttribute("href");
            if ( href == null ) {
                href = "";
            }
            const u = new URL(href, url);
            links.push(u.toString());
        }
    });
    let urls = new Set();
    for ( link of links ) {
        // Has link been checked before
        if ( urls.has(link) ) {
            continue;
        }
        let isAFeed = await isFeed(link, feedMap);
        if ( isAFeed ) {
            urls.add(link);
        }
    }
    if ( urls.size > 0 && !checkAll ) {
        return {urls: sortUrls(urls), feedMap: feedMap};
    }

    // Look for <a> tags
    let local = [];
    let remote = [];
    tree.querySelectorAll("a").forEach((a) => {
        let href = a.getAttribute("href");
        if ( href == null ) {
            return;
        }
        if ( !href.includes("://") && isFeedUrl(href) ) {
            let localUrl = new URL(href, url);
            local.push(localUrl.toString());
        }
        if ( isFeedLikeUrl(href) ) {
            let remoteUrl = new URL(href, url);
            remote.push(remoteUrl.toString());
        }
    });

    // Check the local URLs.
    for ( link of local ) {
        if ( urls.has(link) ) {
            continue;
        }
        let isAFeed = await isFeed(link, feedMap);
        if ( isAFeed ) {
            urls.push(link);
        }
    }
    if ( urls.size > 0 && !checkAll ) {
        return {urls: sortUrls(urls), feedMap: feedMap};
    }

    // Check the remote URLs.
    for ( link of remote ) {
        if ( urls.has(link) ) {
            continue;
        }
        let isAFeed = await isFeed(link, feedMap);
        if ( isAFeed ) {
            urls.push(link);
        }
    }
    if ( urls.size > 0 && !checkAll ) {
        return {urls: sortUrls(urls), feedMap: feedMap};
    }

    // Guess potential URLs.
    paths = ["atom.xml", "index.atom", "rss.xml", "index.xml", "index.rss"];
    for ( path of paths ) {
        let u = new URL(path, url);
        u = u.toString();
        // Has link been checked before
        if ( urls.has(u) ) {
            continue;
        }
        let isAFeed = await isFeed(u, feedMap);
        if ( isAFeed ) {
            urls.push(u);
        }
    }
    return {urls: sortUrls(urls), feedMap: feedMap};
}

function urlFeedProb(url) {
    if ( url.includes("comments") ) {
        return -2;
    }
    if ( url.includes("georss") ) {
        return -1;
    }
    let kw = ["atom", "rss", ".xml", "feed"];
    for ( let i = kw.length, j = 0; i > 0; i--, j++ ) {
        if ( url.includes(kw[j]) ) {
            return i;
        }
    }
    return 0;
}

function sortUrls(urls) {
    let urlList = [];
    for ( item of urls ) {
        urlList.push(item);
    }
    urlList.sort((a, b) => urlFeedProb(b) - urlFeedProb(a));
    return urlList;
}

class Posting {
    constructor(id, isTitle) {
        this.id = id;
        this.titlePopulation = 0;
        this.bodyPopulation = 0;
        if ( isTitle ) {
            this.titlePopulation++;
        } else {
            this.bodyPopulation++;
        }
    }

    addTitle() {
        this.titlePopulation++;
    }

    addBody() {
        this.bodyPopulation++;
    }
}

class RadixNode {
    constructor(key) {
        this.key = key;
        this.children = null;
        this.postings = null;
    }
}

class Radix {
    constructor() {
        this.root = new RadixNode(null);
    }

    searchChildren(word, children) {
        let low = 0;
        let high = children.length - 1;
        let char = word[0];
        while ( low <= high ) {
            let mid = Math.floor((low + high)/2);
            let other = children[mid].key[0];
            if ( char > other ) {
                low = mid + 1;
            } else if ( char < other ) {
                high = mid - 1;
            } else {
                return mid;
            }
        }
        return -1;
    }

    rearrange(children, index, isForward) {
        if ( isForward ) {
            while ( index < children.length - 1 ) {
                let temp = children[index];
                children[index] = children[index+1];
                children[index+1] = temp;
                index++;
            }
        } else {
            while ( index > 0 && children[index-1].key > children[index].key ) {
                let temp = children[index];
                children[index] = children[index-1];
                children[index-1] = temp;
                index--;
            }
        }
    }

    insert(word, articleId, isTitle) {
        let node = this.root;
        let i = 0;
        while ( i < word.length ) {
            let substr = word.substring(i);
            if ( node.children == null ) {
                node.children = [substr];
                node.children[0] = new RadixNode(substr);
                node = node.children[0];
                break;
            }
            let index = this.searchChildren(substr, node.children);
            if ( index == -1 ) {
                let child = new RadixNode(substr);
                node.children.push(child);
                this.rearrange(node.children, node.children.length-1, false);
                node = child;
                break;
            }
            let node_key = node.children[index].key;

            if ( node_key == substr ) {
                node = node.children[index];
                break;
            }

            let x = 0;
            let y = 0;
            while ( x < substr.length && y < node_key.length ) {
                if ( substr[x] != node_key[y] ) {
                    break;
                }
                x++;
                y++;
            }

            // key = java, word = javascript
            if ( y == node_key.length && x < substr.length ) {
                i += x;
                node = node.children[index];
                continue;
            }

            // key = javascript, word = java
            if ( x == substr.length && y < node_key.length ) {
                let new_key = node_key.substring(y);
                node.children[index].key = substr;
                let new_node = new RadixNode(new_key);
                new_node.postings = node.children[index].postings;
                new_node.children = node.children[index].children;
                node.children[index].children = [new_node];
                node.children[index].postings = null;
                node = node.children[index];
                break;
            }

            // key = jug, word = java
            let new_key = node_key.substring(0, y);
            let new_child_key = node_key.substring(y);
            node.children[index].key = new_key;
            let new_node = new RadixNode(new_child_key);
            new_node.postings = node.children[index].postings;
            new_node.children = node.children[index].children;
            node.children[index].children = [new_node];
            node.children[index].postings = null;
            node = node.children[index];
            i += x;
        }
        if ( node.postings == null ) {
            let post = new Posting(articleId, isTitle);
            node.postings = [post];
        } else {
            let index = node.postings.findIndex((posting) => posting.id == articleId);
            if ( index > -1 ) {
                if ( isTitle ) {
                    node.postings[index].addTitle();
                } else {
                    node.postings[index].addBody();
                }
            } else {
                let post = new Posting(articleId, isTitle);
                node.postings.push(post);
            }  
        }
    }

    delete(articleId, node) {
        if ( node === undefined || node == null ) {
            node = this.root;
        }
        if ( node.children == null && node.postings == null ) {
            return;
        }
        if ( node.children != null ) {
            let i = 0;
            let length = node.children.length;

            while ( i < length ) {
                this.delete(articleId, node.children[i]);
                if ( node.children[i].children == null && node.children[i].postings == null ) {
                    if ( length > 1 ) {
                        this.rearrange(node.children, i, true);
                        node.children.pop();
                    }
                    length--;
                    continue;
                }
                i++;
            }
            if ( length == 0 ) {
                node.children = null;
            }
        }
        if ( node.postings != null ) {
            let index = node.postings.findIndex((posting) => posting.id == articleId);
            if ( index > -1 ) {
                if ( node.postings.length > 1 ) {
                    node.postings[index] = node.postings[node.postings.length-1];
                    node.postings.pop();
                } else {
                    node.postings = null;
                }
            }
        }
        if ( node != this.root && node.children != null && node.children.length == 1 && node.postings == null ) {
            let child = node.children[0];
            node.postings = child.postings;
            node.children = child.children;
            node.key = node.key + child.key;
        }
    }

    startsWith(prefix) {
        let postings = [];
        let node = this.root;
        let i = 0;
        while ( i < prefix.length ) {
            if ( node.children == null ) {
                return null;
            }
            let substr = prefix.substring(i);
            let index = this.searchChildren(substr, node.children);
            if ( index == -1 ) {
                return null;
            }
            let node_key = node.children[index].key;

            if ( node_key == substr ) {
                node = node.children[index];
                break;
            }

            let x = 0;
            let y = 0;
            while ( x < substr.length && y < node_key.length ) {
                if ( substr[x] != node_key[y] ) {
                    break;
                }
                x++;
                y++;
            }
            if ( y == node_key.length && x < substr.length ) {
                node = node.children[index];
                i += x;
                continue;
            }

            if ( x == substr.length && y < node_key.length ) {
                node = node.children[index];
                break;
            }

            return null;
        }
        let stack = [node];
        while ( stack.length > 0 ) {
            let node = stack.pop();
            for ( let child in node.children ) {
                stack.push(node.children[child]);
            }
            if ( node.postings != null ) {
                postings.push(...node.postings);
            }
        }
        return postings;
    }
    
    #_serialize(node, result) {
        let key_id = result.keys.length;
        result.keys.push(node.key);
        if ( node.postings != null ) {
            result.postings.push([]);
            for ( let posting of node.postings ) {
                result.postings[key_id].push(posting.id, posting.titlePopulation, posting.bodyPopulation);
            }
        } else {
            result.postings.push(0);
        }
        if ( node.children != null ) {
            result.children.push([]);
            for ( let child of node.children ) {
                let id = this.#_serialize(child, result);
                result.children[key_id].push(id);
            }
        } else {
            result.children.push(0);
        }
        /**
         * return {
         *  keys: [],
         *  postings = [[], []]
         *  children = [[], []]
         * }
         */
        return key_id;
    }

    serialize() {
        let result = {keys: [], postings: [], children: []};
        this.#_serialize(this.root, result);
        return result;
    }

    #_unserialize(obj, node, key_id) {
        if ( obj.postings[key_id] != 0 ) {
            let postings = obj.postings[key_id];
            node.postings = [];
            for ( let i = 0; i < postings.length; i += 3) {
                let p = new Posting(postings[i], 0);
                p.titlePopulation = postings[i+1];
                p.bodyPopulation = postings[i+2];
                node.postings.push(p);
            }
        }

        if ( obj.children[key_id] != 0 ) {
            let children = obj.children[key_id];
            node.children = [];
            for ( let child_id of children ) {
                let c = new RadixNode(obj.keys[child_id]);
                this.#_unserialize(obj, c, child_id);
                node.children.push(c);
            }
        }
    }

    unserialize(obj) {
        this.#_unserialize(obj, this.root, 0);
    }
}

class App {
    models = {};
    views = {};
    controllers = {};
    async init() {
        this.addEventListeners();
        this.registerServiceWorker();
        this.db = new app.DB();
        await this.db.open();
        this.siteModel = new app.models.Site();
        this.articleModel = new app.models.Article();
        this.searchModel = new app.models.Search();
        this.sidebarController = new app.controllers.Sidebar(new app.views.Sidebar(), this.siteModel, this.articleModel);
        this.searchModel.create();
        await this.sidebarController.init();
        let _ = new app.Poll(); // Initialize polling
        _ = new app.controllers.Search(new app.views.Search(), this.searchModel, this.articleModel);

        this.addFeedController = new app.controllers.AddFeed(new app.views.AddFeed(), this.siteModel, this.articleModel, this.searchModel);
        this.listFeedsController = new app.controllers.ListFeeds(new app.views.ListFeeds(), this.siteModel, this.articleModel, this.searchModel);
        this.singleArticleController = new app.controllers.Article(new app.views.Article(), this.siteModel, this.articleModel);
        this.homeController = new app.controllers.Home(new app.views.Home(), this.siteModel, this.articleModel);
        this.listArticlesController = new app.controllers.ListArticles(new app.views.ListArticles(), this.siteModel, this.articleModel);
        this.appRouter = new app.Router(); // Initialize router
    }

    async registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.register("./sw.js", {
                    scope: "/",
                });
                registration.onupdatefound = () => {
                    console.log("Installing");
                    const installWorker = registration.installing;
                    installWorker.onstatechange = () => {
                        if ( installWorker.state == 'installed' && navigator.serviceWorker.controller ) {
                            location.reload();
                        }
                    };
                };
            } catch (error) {
                console.log(`Registration failed with ${error}`);
            }
        }
    };

    addEventListeners() {
        const pinBtn = document.querySelector('.pin');
        const closeBtn = document.querySelector('.close');
        const barsBtn = document.querySelector('.bars');
        const wrapper = document.querySelector('body > .wrapper');
        const links = document.querySelectorAll("aside a");

        pinBtn.addEventListener('click', () => {
            wrapper.classList.add('sidebar-open');
        });

        barsBtn.addEventListener('click', () => {
            wrapper.classList.add('sidebar-open');
        });

        closeBtn.addEventListener('click', () => {
            wrapper.classList.remove('sidebar-open');
        });

        links.forEach((anchor) => {
            anchor.addEventListener("click", (evt) => {
                evt.preventDefault();
                if ( window.location.href != evt.target.href ) {
                    window.history.pushState(null, "", evt.target.href);
                }
                app.appRouter.router();
            });
        });
    }
}

const app = new App();

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
        this.radix2 = new Radix();
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
        let loaded = await this.load();
        /**if ( loaded ) {
            return;
        }*/
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
        this.save();
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

    save() {
        let index = this.radix.serialize();
        index.id = 1;
        const store = app.db.getSearchStore('readwrite');
        super.update(store, index);
    }

    async load() {
        const store = app.db.getSearchStore('readonly');
        let index = await super.get(store, 'id', 1);
        if ( index != null ) {
            this.radix.unserialize(index);
            return true;
        }
        return false;
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

app.Controller = class Controller {
    constructor(view) {
        this.view = view;
    }

    setHistory(href, state) {
        if ( window.location.href != href ) {
            window.history.pushState(state, "", href);
        }
    }
};

app.PageController = class PageController extends app.Controller {
    constructor(view) {
        super(view);
    }

    go() {
        this.view.go(...arguments);
    }
};

app.ListController = class ListController extends app.PageController {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        this.onlyUnread = true;
        this.articles = null;
        this.idRanges = null;
        let toggle = this.toggle.bind(this);
        let visitArticle = this.visitArticle.bind(this);
        this.view.bindToggle(toggle);
        this.view.bindVisit(visitArticle);
    }

    createArticleIdRanges() {
        if ( this.articles == null ) {
            return;
        }
        const articleIds = this.articles.map((article) => article.id);
        let start = articleIds[articleIds.length - 1];
        let end = start;
        let result = [];
        for ( let i = articleIds.length - 2; i >= 0; i-- ) {
            if ( articleIds[i]-end == 1 ) {
                end = articleIds[i];
            } else {
                result.push(end, start);
                start = articleIds[i];
                end = start;
            }
        }
        result.push(end, start);
        this.idRanges = result.reverse();
    }

    async toggle(index) {
        const article = this.articles[index];
        const site = await this.siteModel.get('id', article.siteId);
        if ( site == null ) {
            return false;
        }
        this.articleModel.update(null, article);
        site.numUnreadArticles = await this.articleModel.countUnreadInSite(article.siteId);
        app.sidebarController.update(site);
        return true;
    }

    visitArticle(index, url) {
        app.singleArticleController.go(this.articles, index, this.idRanges, url);
    }

    async go() {
        this.createArticleIdRanges();
        this.view.go(this.articles, this.onlyUnread, this.title);
    }
};

app.controllers.AddFeed = class AddFeedController extends app.PageController {
    constructor(view, siteModel, articleModel, searchModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        this.searchModel = searchModel;
        let handleFunc = this.handleFeedUrl.bind(this);
        let addFeedFunc = this.addFeedObj.bind(this);
        view.setAddFeedFunc(addFeedFunc);
        view.bindClickHandler(handleFunc);
    }

    async handleFeedUrl(feedUrl) {
        const feeds = await findFeeds(feedUrl);
        let store = app.db.getSiteStore("readonly");
        let result = [];
        if ( feeds == null || feeds.length == 0 ) {
            return result;
        }
        for ( let url of feeds.urls ) {
            let feedObj = feeds.feedMap.get(url);
            if ( feedObj == 'undefined' || feedObj == null ) {
                continue;
            }
            let html = await this.showFeed(store, url, feedObj);
            result.push({'html': html, 'feedObj': feedObj});
        }
        return result;
    }

    async showFeed(store, url, feedObj) {
        let html = "<li class='card'>";
        feedObj.feedUrl = url;
        let dbContainsSite = await this.siteModel.exists(store, 'feedUrl', url);
        if ( feedObj.title != "" ) {
            html += `<header class='card-header'><h3>${feedObj.title}</h3></header>`;
        }
        html += `<section class='card-body'><p>Visit the site link: <a href="${feedObj.siteUrl}">${feedObj.siteUrl}</a></p>`;
        if ( feedObj.description != "" ) {
            html += `<div>${feedObj.description}</div>`;
        }
        html += "<ul>";
        const minSize = Math.min(3, feedObj.articles.length);
        for ( let i = 0; i < minSize; i++ ) {
            html += "<li>";
            if ( feedObj.articles[i].title != "" ) {
                html += `<strong>${feedObj.articles[i].title}</strong>`;
            }
            html += "</li>";
        }
        html += "</ul></section><footer class='card-footer'>";
        if ( dbContainsSite ) {
            html += '<p class="btn btn-disabled">Added</p>';
        } else {
            html += `<form><button id="${feedObj.hash}" class="btn">Add</button></form>`;
        }
        html += "</footer>";
        return html;
    }

    async addFeedObj(feedObj) {
        let site = app.models.Site.generateObjectFromFeed(feedObj);
        let existingSite = await this.siteModel.get("hash", site.hash);
        if ( existingSite === undefined || existingSite === null ) {
            await this.siteModel.add(site)
        } else {
            site = existingSite;
        }
        if ( !('id' in site) ) {
            return false;
        }
        let articleStore = app.db.getArticleStore('readwrite');
        let end = feedObj.articles.length - 1;
        /**
         * Add articles in reverse order. Most RSS feeds starts from the newest to the oldest.
         * We want to add from the oldest to the newest.
         */
        let numArticles = 0;
        for ( let i = end; i >= 0; i-- ) {
            feedObj.articles[i].siteId = site.id;
            let exists = await this.articleModel.exists(articleStore, 'hash', feedObj.articles[i].hash);
            if ( !exists ) {
                await this.articleModel.add(articleStore, feedObj.articles[i]);
                numArticles++;
            }
            this.searchModel.add(feedObj.articles[i]);
        }
        this.searchModel.save();
        site.numUnreadArticles = numArticles;
        app.sidebarController.add(site);
        return true;
    }
};

app.controllers.Article = class ArticleController extends app.PageController {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        let handler = this.updateHandler.bind(this)
        this.view.setUpdateHandler(handler);
    }

    updateHandler(articles, index, idRanges, url) {
        super.setHistory(url, {index: index, idRanges: idRanges});
        this.update(articles[index]);
    }

    async update(article) {
        if ( article.isRead == 0 ) { 
            const site = await this.siteModel.get('id', article.siteId);
            if ( site == null ) {
                return;
            }
            article.isRead = 1;
            await this.articleModel.update(null, article);
            site.numUnreadArticles = await app.articleModel.countUnreadInSite(article.siteId);
            app.sidebarController.update(site);
        }
    }

    go() {
        if ( arguments.length == 2 ) {
            this.goByHistory(arguments[0], arguments[1]);
        } else {
            this.goByClick(arguments[0], arguments[1], arguments[2], arguments[3]);
        }
    }

    async goByHistory(articleHash, historyState) {
        let hash = parseInt(articleHash);
        if ( isNaN(hash) ) {
            this.view.go();
            return;
        }
        if ( historyState == null ) {
            let article = await app.articleModel.get(null, 'hash', hash);
            if ( article == null ) {
                this.view.go()
            } else {
                this.update(article);
                this.view.go([article], 0);
            }
        } else {
            let articles = await app.articleModel.getInRanges(historyState.idRanges);
            let hashes = articles.map((article) => article.hash);
            let index = hashes.indexOf(hash);
            if ( articles.length > 0 && index > 0 ) {
                this.update(articles[index]);
            }
            this.view.go(articles, index, historyState.idRanges);
        }
    }

    async goByClick(articles, index, idRanges, url) {
        this.updateHandler(articles, index, idRanges, url);
        this.view.go(articles, index, idRanges);
    }
};

app.controllers.Home = class HomeController extends app.ListController {
    async go() {
        this.title = "Home";
        const sites = await this.siteModel.getAll();
        if ( sites.length > 0 ) {
            this.articles = await this.articleModel.getUnread();
        }
        super.go();
    }
};

app.controllers.ListArticles = class ListArticles extends app.ListController {
    constructor(view, siteModel, articleModel) {
        super(view, siteModel, articleModel);
        this.site = null;
        let v = this.visitAll.bind(this);
        this.view.bindViewAll(v);
    }

    async go() {
        if ( arguments.length == 1 ) {
            await this.getSite(...arguments);
            this.onlyUnread = true;
        } else {
            this.site = arguments[0];
            this.onlyUnread = arguments[1];
        }
        this.view.setSite(this.site);
        if ( this.site != null ) {
            this.title = this.site.title;
            if ( this.onlyUnread ) {
                this.articles = await this.articleModel.getInSite(this.site.id, 0);
            } else {
                this.articles = await this.articleModel.getInSite(this.site.id);
            }
        }
        super.go();
    }

    async getSite(siteHash) {
        let hash = parseInt(siteHash);
        if ( !isNaN(hash) ) {
            this.site = await this.siteModel.get('hash', hash);
        }
    }

    visitAll() {
        this.go(this.site, false);
    }
};

app.controllers.ListFeeds = class ListFeedsController extends app.PageController {
    constructor(view, siteModel, articleModel, searchModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        this.searchModel = searchModel;
        let editSiteFunc = this.editSite.bind(this);
        let deleteSiteFunc = this.deleteSite.bind(this);
        this.view.setSiteFunctions(editSiteFunc, deleteSiteFunc);
    }

    async go() {
        const sites = await this.siteModel.getAll();
        super.go(sites);
    }

    async editSite(site) {
        this.siteModel.update(site);
        site.numUnreadArticles = await this.articleModel.countUnreadInSite(site.id);
        app.sidebarController.update(site);
    }

    async deleteSite(site) {
        let ids = await this.articleModel.deleteInSite(site.id);
        await this.siteModel.delete(site.id);
        this.searchModel.delete(ids);
        app.sidebarController.delete(site);
    }
};

app.controllers.Search = class SearchController extends app.Controller {
    constructor(view, searchModel, articleModel) {
        super(view);
        this.searchModel = searchModel;
        this.articleModel = articleModel;
        let handleFunc = this.handleTextChange.bind(this);
        this.view.bindInputChange(handleFunc);
    }

    async handleTextChange(text) {
        let articleIds = this.searchModel.get(text);
        let result = [];
        if ( articleIds.length == 0 ) {
            this.view.closeBox();
            return result;
        }
        for ( let id of articleIds ) {
            let article = await this.articleModel.get(null, 'id', id);
            let str = `<li><a href="/article/${article.hash}">${article.title}</a></li>`;
            result.push(str);
        }
        return result;
    }
};

app.controllers.Sidebar = class SidebarController extends app.Controller {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
    }
    async init() {
        let sites = await this.siteModel.getAll();
        for ( let site of sites ) {
            site.numUnreadArticles = await this.articleModel.countUnreadInSite(site.id);
        }
        this.view.setContent(sites);
        this.view.setOutputFeedFunc(this.outputFeed);
        this.view.render(sites);
    }

    outputFeed(site, onlyUnread, href) {
        super.setHistory(href, null);
        app.listArticlesController.go(site, onlyUnread);
    }

    add(site) {
        this.view.add(site);
    }

    update(site) {
        this.view.update(site);
    }

    delete(site) {
        this.view.remove(site);
    }
};

app.View = class View {
    htmlToNode(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        return template.content.firstChild;
    }
};

app.PageView = class PageView extends app.View {
    renderTitle() {
        document.title = this.title;
        const h1 = document.querySelector(".wrapper > section > h1");
        h1.textContent = this.title;
    }

    show() {
        if ( this.parent.classList.contains("d-none") ) {
            document.querySelectorAll("main").forEach((content) => {
                if (content.getAttribute("id") == this.id) {
                    content.classList.remove("d-none");
                    return;
                }
                content.classList.add("d-none");
            });
        } else {
            window.scroll(0, 0);
        }
    }

    go() {
        this.render(...arguments);
    }

    render() {
        this.renderTitle();
    }
};

app.ListView = class ListView extends app.PageView {
    constructor() {
        super();
        this.id = "article-list";
        this.parent = document.getElementById(this.id);
        this.articles = null;
    }

    bindToggle(toggleFunc) {
        this.toggleFunc = toggleFunc;
    }

    bindVisit(visitFunc) {
        this.visitFunc = visitFunc;
    }

    go(articles, onlyUnread, title) {
        this.articles = articles;
        this.onlyUnread = onlyUnread;
        this.title = title;
        super.go();
    }

    list() {
        const list = document.createElement("ul");
        for ( let i = 0; i < this.articles.length; i++ ) {
            let article = this.articles[i]
            const anchorClass = ( article.isRead == 1 ) ? "" : "unread";
            const toggle = ( article.isRead == 1 ) ? "Mark as unread" : "Mark as read";
            const html = `<li><a href="/article/${article.hash}" class="${anchorClass}">${article.title}</a><a href="#"><span>${toggle}</span></a></li>`;
            const listItem = this.htmlToNode(html);
            listItem.firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.visitFunc(i, e.currentTarget.href);
            });
            listItem.lastChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle(i, e.currentTarget)
            });
            list.appendChild(listItem);
        }
        return list;
    }

    async toggle(index, target) {
        const article = this.articles[index];
        article.isRead = (article.isRead == 1) ? 0 : 1;
        let to;
        if ( article.isRead == 1 ) {
            to = "Mark as unread";
        } else {
            to = "Mark as read";
        }
        let isToggle = this.toggleFunc(index);
        if ( !isToggle ) {
            return;
        }
        target.parentNode.firstChild.classList.toggle("unread");
        target.innerHTML = `<span>${to}</span>`;
    }
};

app.views.AddFeed = class AddFeedView extends app.PageView {
    constructor() {
        super();
        this.id = "add-feed";
        this.title = "Add New Feed";
        this.parent = document.getElementById(this.id);
    }
    setAddFeedFunc(addFeedFunc) {
        this.addFeedFunc = addFeedFunc;
    }
    bindClickHandler(handleFeedUrl) {
        const addFeedBtn = document.getElementById("add-feed-btn");
        const feedList = document.getElementById("feed-options");
        const loader = document.getElementById("network-loader");
        const feedUrlInput = document.getElementById("feed-url");

        addFeedBtn.addEventListener("click", async (evt) => {
            evt.preventDefault();
            loader.style.display = "flex";
            const result = await handleFeedUrl(feedUrlInput.value);
            feedList.replaceChildren();
            if ( result.length == 0 ) {
                loader.style.display = "none";
                const message = "<div class='empty'><p>No feed in the given url.</p></div>";
                feedList.insertAdjacentHTML("beforeend", message);
                return;
            }
            let unorderedList = document.createElement("ul");
            feedList.appendChild(unorderedList);

            for ( let obj of result ) {
                unorderedList.insertAdjacentHTML('beforeend', obj.html);
                let btn = document.getElementById(`${obj.feedObj.hash}`);
                if ( btn != null ) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.addFeed(obj.feedObj, btn);
                    });
                }
            }
            loader.style.display = "none";
        });
    }

    async addFeed(feedObj, btn) {
        btn.textContent = "Adding...";
        btn.setAttribute('disabled', true);
        const added = await this.addFeedFunc(feedObj);
        if ( added ) {
            btn.textContent = "Added";
        } else {
            btn.textContent = "Add";
            btn.removeAttribute('disabled');
        }
    }

    render() {
        super.render();
        super.show();
    }
};

app.views.Article = class ArticleView extends app.PageView {
    constructor() {
        super();
        this.id = "single-article";
        this.title = "Article Not Found";
        this.parent = document.getElementById(this.id);
        this.articles = null;
        this.index = null;
        this.idRanges = null;
    }

    setUpdateHandler(updateHandler) {
        this.updateHandler = updateHandler;
    }

    go(articles, index, idRanges) {
        if ( typeof articles == 'undefined' || articles.length == 0 || index == -1 ) {
            this.articles = null;
            this.index = null;
            this.idRanges = null;
            this.title = "Article Not Found";
        } else {
            this.articles = articles;
            this.index = index;
            this.idRanges = idRanges;
            this.title = articles[index].title;
        }
        super.go();
    }

    render() {
        super.render();
        this.parent.replaceChildren();
        if ( this.articles == null ) {
            this.renderNoArticle();
        } else {
            this.renderArticle();
        }
        super.show();
    }

    renderNoArticle() {
        const message = "<p>This article does not exist.</p>";
        this.parent.insertAdjacentHTML("beforeend", message);
    }

    renderArticle() {
        const article = this.articles[this.index];
        const html = `<article>${article.content}</article>`;
        const articleLink = `<section><a href="${article.link}" class="btn" target="_blank">Read More</a></section>`
        this.parent.insertAdjacentHTML("beforeend", html);
        this.parent.insertAdjacentHTML("beforeend", articleLink);
        const nav = document.createElement("section");
        if ( this.index > 0 ) {
            let prev = this.htmlToNode(`<a href="/article/${this.articles[this.index-1].hash}">Prev</a>`);
            prev.addEventListener('click', (e) => {
                e.preventDefault();
                this.clickHandler(this.index-1)
            });
            nav.appendChild(prev);
        }

        if ( this.index < (this.articles.length - 1) ) {
            let next = this.htmlToNode(`<a href="/article/${this.articles[this.index+1].hash}">Next</a>`);
            next.addEventListener('click', (e) => {
                e.preventDefault();
                this.clickHandler(this.index+1);
            });
            nav.appendChild(next);
        }
        this.parent.appendChild(nav);
    }

    clickHandler(index) {
        this.index = index;
        let url = `/article/${this.articles[index].hash}`;
        this.updateHandler(this.articles, index, this.idRanges, url);
        this.title = this.articles[index].title;
        this.render();
    }
};

app.views.Home = class HomeView extends app.ListView {
    render() {
        super.render();
        this.parent.replaceChildren();
        if ( this.articles == null ) {
            let message = "<div class='empty'><p>Looks like you haven't subscribed to any feed 👀</p>";
            message += "<p><a class='btn' href='/add-feed'>Start here</a></p></div>";
            this.parent.insertAdjacentHTML("beforeend", message);
        } else {
            if ( this.articles.length == 0 ) {
                const message = "<div class='empty'><p>You don't have any unread articles.</p></div>";
                this.parent.insertAdjacentHTML("beforeend", message);
            } else {
                this.parent.appendChild(this.list());
            }
        }
        super.show();
    }
};

app.views.ListArticles = class ListArticlesView extends app.ListView {
    constructor() {
        super();
        this.site = null;
    }

    setSite(site) {
        this.site = site;
    }

    bindViewAll(viewAllFunc) {
        this.viewAllFunc = viewAllFunc;
    }

    render() {
        super.render();
        this.parent.replaceChildren();
        if ( this.site == null ) {
            const message = "<p>This feed does not exist.</p>";
            this.parent.insertAdjacentHTML("beforeend", message);
            return;
        }
        if ( this.articles.length == 0 ) {
            if ( this.onlyUnread ) {
                const divNode = this.htmlToNode(`<div class="empty"><p>There are no unread articles in this feed.</p><p><a class="btn" href="/feed/${this.site.hash}">View Read Articles</a></p></div>`);
                const btn = divNode.lastChild.firstChild;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.viewAllFunc();
                });
                this.parent.append(divNode);
            } else {
                const message = "<div class='empty'><p>There are no articles in this feed.</p></div>";
                this.parent.insertAdjacentHTML("beforeend", message);
            }
        } else {
            this.parent.appendChild(this.list());
        }
        super.show();
    }
};

app.views.ListFeeds = class ListFeedsView extends app.PageView {
    constructor() {
        super();
        this.id = "feed-list";
        this.title = "All Feeds"
        this.parent = document.getElementById(this.id);
        this.editForm = document.getElementById("rename-form");
        this.deleteForm = document.getElementById("delete-form");
    }

    setSiteFunctions(editSiteFunc, deleteSiteFunc) {
        this.editSiteFunc = editSiteFunc;
        this.deleteSiteFunc = deleteSiteFunc;
    }

    async editAction(site, table_row, controller) {
        let formParent = this.editForm.parentNode;
        site.title = this.editForm.querySelector('input').value;
        await this.editSiteFunc(site);
        table_row.firstChild.textContent = site.title;
        this.editForm.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    };

    cancelAction(controller, previousStatement) {
        let form;
        if ( typeof this.previousStatement != "undefined" ) {
            form = this.deleteForm;
            form.querySelector('p').textContent = previousStatement;
        } else {
            form = this.editForm
        }
        let formParent = form.parentNode;
        form.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    }

    editSite(site, table_row) {
        const formParent = this.editForm.parentNode;
        const controller = new AbortController();
        const signal = controller.signal;
        this.editForm.querySelector('input').value = site.title;
        this.editForm.querySelectorAll('span')[1].textContent = site.feedUrl;
        this.editForm.classList.remove("d-none");
        const btns = this.editForm.querySelectorAll("button");
        btns[0].addEventListener('click', (e) => {
            e.preventDefault();
            this.editAction(site, table_row, controller);
        }, {signal});
        btns[1].addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelAction(controller);
        }, {once: true});
        formParent.style.display = "flex";
    }

    async deleteAction(site, table_row, controller, previousStatement) {
        await this.deleteSiteFunc(site);
        let formParent = this.deleteForm.parentNode;
        let tbody = table_row.parentNode;
        tbody.removeChild(table_row);
        if ( tbody.childNodes.length == 0 ) {
            let feedListSection = tbody.parentNode.parentNode;
            feedListSection.replaceChildren();
            feedListSection.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
        }
        this.deleteForm.querySelector('p').textContent = previousStatement;
        this.deleteForm.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    }

    deleteSite(site, table_row) {
        const parent = this.deleteForm.parentNode;
        let textView = this.deleteForm.querySelector('p');
        let previousStatement = textView.textContent;
        const controller = new AbortController();
        const signal = controller.signal;
        textView.textContent = `Are you sure you want to delete ${site.title} and all its articles?`;
        this.deleteForm.classList.remove("d-none");
        const btns = this.deleteForm.querySelectorAll("button");
        btns[0].addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteAction(site, table_row, controller, previousStatement);
        }, {signal});
        btns[1].addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelAction(controller, previousStatement);
        }, {once: true});
        parent.style.display = "flex";
    }
    
    render(sites) {
        super.render();
        this.parent.replaceChildren();
        if ( sites.length == 0 ) {
            const message = "<p>You've not subscribed to any feed.</p>";
            this.parent.insertAdjacentHTML("beforeend", message);
            return;
        }
        const table = this.htmlToNode("<table><thead><tr><th scope='col'>Feed Name</th><th></th><th></th></tr></thead><tbody></tbody></table>");
        const body = table.lastChild;
        for ( let site of sites ) {
            let html = `<tr><td>${site.title}</td><td><a href="#" class="btn">Rename</a></td><td><a href="#" class="btn btn-danger">Delete</a></td></tr>`;
            let row = this.htmlToNode(html);
            row.children[1].firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.editSite(site, row);
            });
            row.lastChild.firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.deleteSite(site, row)
            });
            body.append(row);
        }
        this.parent.append(table);
        super.show();
    }
};

app.views.Search = class SearchView {
    constructor() {
        this.searchInput = document.getElementById("query");
        this.autocomplete = document.getElementById("autocomplete");
        this.closeOnClickOutside(this.autocomplete);
    }

    closeOnClickOutside() {
        let ele = this.autocomplete;
        document.addEventListener('click', event => {
            if (!ele.contains(event.target) && ele.style.display == 'block') {
                ele.style.display = 'none';
            }
        });
    }

    closeBox() {
        this.autocomplete.style.display = "none";
    }

    bindInputChange(handleInputText) {
        this.searchInput.addEventListener("input", async (evt) => {
            const text = evt.target.value.trim();
            if ( text.length == 0 ) {
                this.closeBox();
                return;
            }
            let resultStrings = await handleInputText(text);
            if ( resultStrings.length == 0 || text != evt.target.value.trim() ) {
                return;
            }
            let resultHtml = `<ul>${resultStrings.join("")}</ul>`;
            this.autocomplete.innerHTML = resultHtml;
            this.autocomplete.style.display = "block";
            this.autocomplete.scrollTo(0, 0);
        });
    }
};

app.views.Sidebar = class SidebarView extends app.View {
    constructor() {
        super();
        this.parent = document.getElementById("sidebar-feeds");
    }

    setContent(sites) {
        this.sites = sites;
    }

    setOutputFeedFunc(outputFeedFunc) {
        this.outputFeedFunc = outputFeedFunc;
    }

    clickHandler(site, onlyUnread, url) {
        this.outputFeedFunc(site, onlyUnread, url);
    }

    renderCount(count) {
        let countOutput;
        if ( count > 0 ) {
            countOutput = `<span>${count}</span>`;
        } else {
            countOutput = "";
        }
        return countOutput;
    }

    add(site) {
        if ( this.parent.firstChild && this.parent.firstChild.tagName == "P" ) {
            this.parent.replaceChildren();
        }
        const hash = cyrb53(site.feedUrl);
        const html = `<li><a href="/feed/${site.hash}" id="feed-${hash}">${site.title}${this.renderCount(site.numUnreadArticles)}</a></li>`;
        const listItem = this.htmlToNode(html);
        listItem.firstChild.addEventListener('click', (e) => {
            e.preventDefault();
            this.clickHandler(site, true, e.currentTarget.href);
        });
        this.parent.appendChild(listItem);
    }

    render() {
        this.parent.replaceChildren();
        if ( this.sites.length == 0 ) {
            const message = "<p>You've not subscribed to any feed.</p>";
            this.parent.insertAdjacentHTML("beforeend", message);
            return;
        }

        for ( let site of this.sites ) {
            this.add(site, false);
        }
    }

    update(site) {
        const hash = cyrb53(site.feedUrl);
        const content = `${site.title}${this.renderCount(site.numUnreadArticles)}`;
        const anchor = document.getElementById(`feed-${hash}`);
        anchor.replaceChildren();
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            this.clickHandler(site, true, e.currentTarget.href);
        });
        anchor.setAttribute('href', site.hash);
        anchor.innerHTML = content;
    }
    
    remove(site) {
        const hash = cyrb53(site.feedUrl);
        const anchor = document.getElementById(`feed-${hash}`);
        const list = anchor.parentNode.parentNode;
        list.removeChild(anchor.parentNode);
        if ( list.childNodes.length == 0 ) {
            list.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
        }
    }

};

app.Router = class Router {
    constructor() {
        this.routes = {};
        this.templates = {};
        let historyRouter = this.router.bind(this);
        this.setup();
        window.onpopstate = (event) => {
            historyRouter(event.state);
        };
        this.router();
    }

    route(path, template) {
        if ( typeof template === 'function' ) {
            this.routes[path] = template;
        } else if ( typeof template === 'string' ) {
            this.routes[path] = this.templates[template];
        }
    }

    template(name, templateFunction) {
        this.templates[name] = templateFunction; 
    }

    setup() {
        this.template('home', function() {
            app.homeController.go();
        });
    
        this.template('add-feed', function() {
            app.addFeedController.go();
        });
    
        this.template('feed-list', function() {
            app.listFeedsController.go();
        });
    
        this.template('feed', function(hash) {
            app.listArticlesController.go(hash);
        });
    
        this.template('article', function(hash, historyState) {
            app.singleArticleController.go(hash, historyState);
        })
    
        this.route('', 'home');
        this.route('add-feed', 'add-feed');
        this.route('feed-list', 'feed-list');
        this.route('feed', 'feed');
        this.route('article', 'article');
    }

    resolveRouter(route) {
        try {
            return this.routes[route];
        } catch(e) {
            throw new Error(`Route ${route} not found`);
        }
    }

    router(historyState) {
        let url = window.location.pathname || '/';
        let urls = url.split('/');
        if ( urls.length == 2 || urls[2] == '' ) {
            let route = this.resolveRouter(urls[1]);
            route();
        } else if ( urls.length > 2 ) {
            let route = this.resolveRouter(urls[1]);
            route(urls[2], historyState);
        }
    }
};

app.Poll = class Poll {
    constructor() {
        this.seconds_in_minutes = 60000;
        let poll = this.poll.bind(this);
        setInterval(poll, this.seconds_in_minutes);
    }

    async poll() {
        const sites = await app.siteModel.getToPoll();
        if ( sites.length == 0 ) {
            return;
        }
        for ( let site of sites ) {
            let result = await this.checkSite(site);
            if ( result > 0 ) {
                app.sidebarController.update(site);
            }
        }
    }

    async checkSite(siteData) {
        let etag = siteData.etag;
        let lastModified = siteData.lastModified;
        let url = siteData.feedUrl;
        let numArticles = 0;
        const max_wait_time = 3600000; 
        const feedResponse = await this.fetch(url, etag, lastModified);
        if ( feedResponse == null ) {
            return 0;
        }
        if ( feedResponse.status == 304 && siteData.pollInterval < max_wait_time ) {
            siteData.pollInterval = Math.min(max_wait_time, siteData.pollInterval*2);
        } else if ( feedResponse.status == 429 || feedResponse.status == 403 ) {
            siteData.pollInterval = 4 * max_wait_time;
        }

        if ( feedResponse.text == "" ) {
            siteData.nextPoll = Date.now() + siteData.pollInterval;
            await app.siteModel.update(siteData);
            return numArticles;
        }
        let hash = cyrb53(feedResponse.text);
        if ( hash != siteData.hash ) {
            let feedObj = await getFeedObject(feedResponse);
            let site = app.models.Site.generateObjectFromFeed(feedObj);
            
            site.id = siteData.id;
            site.title = siteData.title;
            site.feedUrl = siteData.feedUrl;
            let updated = await app.siteModel.update(site);
            if ( updated ) {
                Object.assign(siteData, site);
                numArticles = await app.articleModel.addToSite(feedObj.articles, siteData.id);
                for ( let article of feedObj.articles ) {
                    if ( !article.hasOwnProperty('id') ) {
                        continue;
                    }
                    app.searchModel.add(article);
                }
                app.searchModel.save();
                siteData.numUnreadArticles = await app.articleModel.countUnreadInSite(site.id);
            }

        } else {
            siteData.etag = etag;
            siteData.lastModified = lastModified;
            siteData.pollInterval = 5*this.seconds_in_minutes;
            siteData.nextPoll = Date.now() + siteData.pollInterval;
            await app.siteModel.update(siteData)
        }
        return numArticles;
    }

    async fetch(url, etag, lastModified) {
        const myHeaders = new Headers();
        if ( etag != null ) {
            myHeaders.append("If-None-Match", etag);
        }
        if ( lastModified != null ) {
            myHeaders.append("If-Modified-Since", lastModified);
        }
        let response;
        try {
            response = await fetch(`/proxy?u=${encodeURIComponent(url)}&sw=0`, {
                headers: myHeaders
            });
        } catch {
            return null;
        }
        let result = {lastModified: "", etag: "", text: "", status: response.status};
        if ( !response.ok ) {
            return result;
        }
        let text = await response.text();
        result.lastModified = response.headers.get("Last-Modified");
        result.etag = response.headers.get("ETag");
        result.text = text;
        return result
    }
};