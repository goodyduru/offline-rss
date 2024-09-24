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
        feedObj.last_modified = response.last_modified;
        feedObj.poll_interval = (5*SECONDS_IN_MINUTES);
        feedObj.next_poll = Date.now() + (5*SECONDS_IN_MINUTES);
    }
    return feedObj;
}

function getEmptyFeedObject() {
    return {title: "", feed_url: "", site_url: "", description: "", hash: "", 
        etag: null, last_modified: null, poll_interval: 0, next_poll: 0, articles: []}
}

async function parseAsRSS(text) {
    const tree = await new window.DOMParser().parseFromString(text, "text/xml");
    let title = tree.querySelector("channel>title");
    let link = tree.querySelector("channel>link");
    let description = tree.querySelector("channel>description");
    let result = getEmptyFeedObject();
    result.title = ( title != null ) ? title.innerHTML : "";
    result.feed_url = ( link != null ) ? link.innerHTML : "";
    result.description = ( description != null ) ? description.innerHTML : "";
    result.hash = cyrb53(text);
    if ( result.feed_url == "" && link != null ) {
        result.feed_url = link.getAttribute("href");
    }
    if ( result.feed_url != "" ) {
        let u = new URL(result.feed_url);
        result.site_url = u.origin;
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
    result.title = ( title != null ) ? title.innerHTML : "";
    if ( links.length == 1 ) {
        result.feed_url = links[0].getAttribute("href");
        let u = new URL(result.feed_url);
        result.site_url = u.origin;
    } else {
        links.forEach((link) => {
            if ( link.getAttribute("rel") == "self" ) {
                result.feed_url = link.getAttribute("href");
            } else if ( result.site_url == "" ) {
                result.site_url = link.getAttribute("href");
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
        entry = {title: "", link: "", content: "", pubDate: "", hash: 0, site_id: 0};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let description = item.querySelector("description");
        let pubDate = item.querySelector("pubDate");
        entry.title = ( title != null ) ? title.innerHTML : "";
        entry.link = ( link != null ) ? link.innerHTML : "";
        entry.content = ( description != null ) ? description.innerHTML : "";
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
        entry = {title: "", link: "", content: "", pubDate: "", hash: 0, site_id: 0};
        let title = item.querySelector("title");
        let link = item.querySelector("link");
        let content = item.querySelector("content");
        let pubDate = item.querySelector("published");
        entry.title = ( title != null ) ? title.innerHTML : "";
        entry.link = ( link != null ) ? link.getAttribute("href") : "";
        entry.content = ( content != null ) ? content.innerHTML : "";
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        entry.hash = cyrb53(item.innerHTML);
        if ( entry.pubDate == "" ) {
            pubDate = item.querySelector("updated");
            entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        }
        if ( entry.content == "" ) {
            content = item.querySelector("summary");
            entry.content = ( content != null ) ? content.innerHTML : "";
        }
        result.push(entry);
    });
    return result;
}