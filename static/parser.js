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
    result.title = ( title != null ) ? title.innerHTML : "";
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
    result.title = ( title != null ) ? title.innerHTML : "";
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
        entry.content = getDOMObject(description, entry.link);
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
        entry.content = getDOMObject(content, entry.link);
        entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        entry.hash = cyrb53(item.innerHTML);
        if ( entry.pubDate == "" ) {
            pubDate = item.querySelector("updated");
            entry.pubDate = ( pubDate != null ) ? pubDate.innerHTML : "";
        }
        if ( entry.content == null ) {
            content = item.querySelector("summary");
            entry.content = getDOMObject(content, entry.link);
        }
        result.push(entry);
    });
    return result;
}

function getDOMObject(articleContent, articleUrl) {
    if ( articleContent == null ) {
        return null;
    }
    const html = articleContent.innerHTML.replace("<![CDATA[", "").replace("]]>", "");
    const tree = new window.DOMParser().parseFromString(html, "text/html");
    convertImagesSrc(tree, articleUrl);
    convertAnchorsHref(tree, articleUrl);
    return tree.body
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