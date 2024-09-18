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

async function getFeed(url) {
    const response = await fetch("/proxy", {
        headers: {
            "Rss-Url": url,
        }
    });

    if (!response.ok) {
        return null;
    }
    let text = await response.text();
    return text;
}

async function isFeed(url) {
    let text = await getFeed(url);
    if ( text == null ) {
        return false;
    }
    return isFeedData(text);
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
    const feed_text = await getFeed(url);
    if ( feed_text == null ) {
        return [];
    }
    if ( isFeedData(feed_text) ) {
        return [url];
    }
    const tree = new window.DOMParser().parseFromString(feed_text, "text/html");
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
    let urls = [];
    for ( link of links ) {
        let isAFeed = await isFeed(link);
        if ( isAFeed ) {
            urls.push(link);
        }
    }
    if ( urls.length > 0 && !checkAll ) {
        return sortUrls(urls);
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
            let local_url = new URL(href, url);
            local.push(local_url.toString());
        }
        if ( isFeedLikeUrl(href) ) {
            let remote_url = new URL(href, url);
            remote.push(remote_url.toString());
        }
    });

    // Check the local URLs.
    for ( link of local ) {
        let isAFeed = await isFeed(link);
        if ( isAFeed ) {
            urls.push(link);
        }
    }
    if ( urls.length > 0 && !checkAll ) {
        return sortUrls(urls);
    }

    // Check the remote URLs.
    for ( link of remote ) {
        let isAFeed = await isFeed(link);
        if ( isAFeed ) {
            urls.push(link);
        }
    }
    if ( urls.length > 0 && !checkAll ) {
        return sortUrls(urls);
    }

    // Guess potential URLs.
    paths = ["atom.xml", "index.atom", "rss.xml", "index.xml", "index.rss"];
    for ( path of paths ) {
        let u = new URL(path, url);
        u = u.toString();
        let isAFeed = await isFeed(u);
        if ( isAFeed ) {
            urls.push(u);
        }
    }
    return sortUrls(urls);
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
    urls.sort((a, b) => urlFeedProb(b) - urlFeedProb(a));
    return urls;
}