const ARTICLE_LIST_HREF = "#article-list";
const DB_NAME = "offline-rss";
const DB_VERSION = 1;
const SITE_STORE_NAME = "sites";
const ARTICLE_STORE_NAME = "articles";

let db;

function addEventListeners() {
    document.querySelectorAll("aside a").forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            showOneMain(evt.target.href);
        });
    });

    document.getElementById("add-feed-btn").addEventListener("click", (evt) => addFeed(evt));
}

function showOneMain(href) {
    const index = href.indexOf("#");
    if ( index == -1 ) {
        return;
    } 
    const id = href.substring(index+1);
    if ( id == "" ) {
        return;
    }
    document.querySelectorAll("main").forEach((content) => {
        if (content.getAttribute("id") == id) {
            content.classList.remove("d-none");
            return;
        }
        content.classList.add("d-none");
    });
}

function showUrlMain() {
    const loc = document.location;
    showOneMain(loc.hash);
}

async function addFeed(evt) {
    const response = await fetchFeed(evt);
    const text = await response.text();
    let type = "text/html";
    const content_type = response.headers.get("Content-Type");
    if ( content_type.indexOf("text/xml") > -1 || content_type.indexOf("application/xml") > -1 ) {
        type = "text/xml";
    }
    const dom = new window.DOMParser().parseFromString(text, type);
    let feed = dom.querySelector("rss");
    if (feed != null) {
        await parseRSS(dom);
        return;
    }
    feed = dom.querySelector("feed");
    if ( feed != null ) {
        await parseAtom(dom);
    }
}

async function fetchFeed(evt) {
    evt.preventDefault();
    let url = document.getElementById("feed-url").value;
    if ( !URL.canParse(url) ) {
        alert("Invalid url");
        return;
    }
    
    const response = await fetch("/proxy", {
        headers: {
            "Rss-Url": url,
        }
    });

    if (!response.ok) {
        alert("Fetcher error!");
        return;
    }
    return response;
}

async function parseRSS(dom) {
    let feed = dom.querySelector("rss");
    let title = dom.querySelector("channel>title");
    let link = dom.querySelector("channel>link");
    let description = dom.querySelector("channel>description");
    let result = {title: "", feed_url: "", site_url: "", description: "", entries: []};
    result.title = ( title != null ) ? title.innerHTML : "";
    result.feed_url = ( link != null ) ? link.innerHTML : "";
    result.description = ( description != null ) ? description.innerHTML : "";
    let site = {title: result.title, feed_url: result.feed_url, site_url: result.site_url, 
        description: result.description, hash: cyrb53(feed.innerHTML)};
    let site_id = await getOrCreateSite(site);
    if ( site_id == 0 ) {
        return;
    }
    let items = dom.querySelectorAll("item");
    let article_store = getObjectStore(ARTICLE_STORE_NAME, 'readwrite');
    items.forEach(item => {
        entry = {title: "", link: "", content: "", pubDate: "", hash: 0, site_id: site_id};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let description = item.querySelector("description");
        let pubDate = item.querySelector("pubDate");
        entry.title = ( title != null ) ? title.innerHTML : "";
        entry.link = ( link != null ) ? link.innerHTML : "";
        entry.content = ( description != null ) ? description.innerHTML : "";
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        entry.hash = cyrb53(item.innerHTML);
        result.entries.push(entry);
        getOrCreateArticle(article_store, entry);
    });
    printFeed(result);
}

async function parseAtom(dom) {
    let feed = dom.querySelector("feed");
    let title = dom.querySelector("feed>title");
    let links = dom.querySelectorAll("feed>link");
    let result = {title: "", feed_url: "", site_url: "", description: "", entries: []};
    result.title = ( title != null ) ? title.innerHTML : "";
    if ( links.length == 1 ) {
        result.feed_url = links[0].getAttribute("href");
    } else {
        links.forEach((link) => {
            if ( link.getAttribute("rel") == "self" ) {
                result.feed_url = link.getAttribute("href");
            } else {
                result.site_url = link.getAttribute("href");
            }
        })
    }
    let site = {title: result.title, feed_url: result.feed_url, site_url: result.site_url, 
        description: result.description, hash: cyrb53(feed.innerHTML)};
    let site_id = await getOrCreateSite(site);
    if ( site_id == 0 ) {
        return;
    }
    let items = dom.querySelectorAll("entry");
    let article_store = getObjectStore(ARTICLE_STORE_NAME, 'readwrite');
    items.forEach(item => {
        entry = {title: "", link: "", content: "", pubDate: "", hash: 0, site_id: site_id};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let content = item.querySelector("content");
        let pubDate = item.querySelector("published");
        entry.title = ( title != null ) ? title.innerHTML : "";
        entry.link = ( link != null ) ? link.getAttribute("href") : "";
        entry.content = ( content != null ) ? content.innerHTML : "";
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        entry.hash = cyrb53(item.innerHTML);
        result.entries.push(entry);
        getOrCreateArticle(article_store, entry);
    });
    printFeed(result);
}

function printFeed(feed) {
    let html = ``;
    if ( feed.title != "" ) {
        html += `<h2>${feed.title}</h2>`;
    }

    if ( feed.site_url != "" ) {
        html += `<p>Visit the site link: <a href="${feed.site_url}">${feed.site_url}</a></p>`;
    }
    if ( feed.description != "" ) {
        html += `<div>${feed.description}</div>`;
    }
    if ( feed.entries.length > 0 ) {
        html += "<ul>";
    }
    feed.entries.forEach((entry) => {
        html += "<li>";
        if ( entry.title != "" ) {
            html += `<h4>${entry.title}</h4>`;
        }
        if ( entry.link != "" ) {
            html += `<p>Visit the article link: <a href="${entry.link}">${entry.link}</a></p>`;
        }
        if ( entry.content != "" ) {
            html += `<div>${entry.content}</div>`;
        }
        if ( entry.pubDate != "" ) {
            html += `<p>Published on: ${entry.pubDate}</p>`;
        }
        html += "</li>";
    });
    html += "</ul>";
    const article_list = document.querySelector(ARTICLE_LIST_HREF);
    article_list.replaceChildren();
    article_list.insertAdjacentHTML("beforeend", html);
    showOneMain(ARTICLE_LIST_HREF);
}

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
        article_store.createIndex('site_id', 'site_id', {unique: false});
        article_store.createIndex('hash', 'hash', {unique: true});
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
                addReq.onerror = () => {
                    reject(0);
                }

            } else {
                id = evt.target.result.id;
                resolve(id);
            }
        };
        req.onerror = () => {
            reject(0);
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
    req.onsuccess = (evt) => {
        console.log("Article added");
    };
    req.onerror = (evt) => {
        console.error(evt.target.error);
    };
}

openDB();
showUrlMain();
addEventListeners();