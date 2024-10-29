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
        response = await fetch(`/proxy?u=${url}`);
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