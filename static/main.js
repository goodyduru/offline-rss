function addEventListeners() {
    document.querySelectorAll("aside a").forEach((anchor) => {
        anchor.addEventListener("click", (evt) => {
            showOneMain(evt.target.href);
        });
    });

    document.getElementById("add-feed-btn").addEventListener("click", (evt) => showFeeds(evt));
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

async function showFeeds(evt) {
    evt.preventDefault();
    const feeds = await fetchFeedObjects(evt);
    if ( feeds == null || feeds.urls.length == 0 ) {
        alert("No feed in the given website.");
        return;
    }
    let unorderedList = document.createElement("ul");
    const feed_list = document.querySelector(ARTICLE_LIST_HREF);
    feed_list.replaceChildren();
    feed_list.appendChild(unorderedList);
    let store = getObjectStore(SITE_STORE_NAME, "readonly");
    for ( url of feeds.urls ) {
        let feedObj = feeds.feed_map.get(url);
        if ( feedObj == 'undefined' || feedObj == null ) {
            continue;
        }
        html = await showFeed(store, url, feedObj);
        unorderedList.insertAdjacentHTML('beforeend', html);
        let myAddFeed = addFeed.bind({feedObj: feedObj});
        let btn = document.getElementById(`${feedObj.hash}`);
        if ( btn != null ) {
            btn.addEventListener('click', myAddFeed);
        }
    }
    showOneMain(ARTICLE_LIST_HREF);
}

async function fetchFeedObjects(evt) {
    evt.preventDefault();
    let url = document.getElementById("feed-url").value;
    let feeds = await findFeeds(url);
    return feeds;
}

async function showFeed(store, url, feedObj) {
    let html = "<li><div>";
    feedObj.feed_url = url;
    let dbContainsSite = await hasSite(store, url);
    if ( feedObj.title != "" ) {
        html += `<h2>${feedObj.title}</h2>`;
    }
    html += `<p>Visit the site link: <a href="${feedObj.site_url}">${feedObj.site_url}</a></p>`;
    if ( feedObj.description != "" ) {
        html += `<div>${feedObj.description}</div>`;
    }
    html += "<ul>";
    const min_size = Math.min(3, feedObj.articles.length);
    for ( i = 0; i < min_size; i++ ) {
        html += "<li>";
        if ( feedObj.articles[i].title != "" ) {
            html += `<strong>${feedObj.articles[i].title}</strong>`;
        }
        html += "</li>";
    }
    html += "</ul>";
    if ( dbContainsSite ) {
        html += '<p>Added</p>';
    } else {
        html += `<form><button id="${feedObj.hash}">Add Feed</button></form>`;
    }
    return html;
}

function generateSiteFromFeedObject(feedObj) {
    return {
        title: feedObj.title,
        feed_url: feedObj.feed_url,
        site_url: feedObj.site_url, 
        description: feedObj.description,
        hash: feedObj.hash,
        etag: feedObj.etag,
        last_modified: feedObj.last_modified,
        next_poll: feedObj.next_poll,
        poll_interval: feedObj.poll_interval,
    }
}

async function addFeed(evt) {
    evt.preventDefault();
    let site = generateSiteFromFeedObject(this.feedObj);
    let site_id = await getOrCreateSite(site);
    if ( site_id == 0 ) {
        return;
    }
    let article_store = getObjectStore(ARTICLE_STORE_NAME, 'readwrite');
    let end = this.feedObj.articles.length - 1;
    /**
     * Add articles in reverse order. Most RSS feeds starts from the newest to the oldest.
     * We want to add from the oldest to the newest.
     */
    for ( let i = end; i >= 0; i-- ) {
        this.feedObj.articles[i].site_id = site_id;
        getOrCreateArticle(article_store, this.feedObj.articles[i]);
    }
}

function doPolling() {
    setInterval(pollFeeds, 60*500);
}

async function pollFeeds() {
    const sites = await getSiteToPoll();
    if ( sites.length == 0 ) {
        return;
    }
    for ( site of sites ) {
        await pollFeed(site);
    }
}

async function pollFeed(siteData) {
    let etag = siteData.etag;
    let last_modified = siteData.last_modified;
    let url = siteData.feed_url;
    const MAX_WAIT_TIME = 3600000; 
    const feedResponse = await fetchMyFeed(url, etag, last_modified);
    if ( feedResponse.status == 304 && siteData.poll_interval < MAX_WAIT_TIME ) {
        siteData.poll_interval = Math.min(MAX_WAIT_TIME, siteData.poll_interval*2);
    } else if ( feedResponse.status == 429 || feedResponse.status == 403 ) {
        siteData.poll_interval = 4 * MAX_WAIT_TIME;
    }

    if ( feedResponse.text == "" ) {
        siteData.next_poll = Date.now() + siteData.poll_interval;
        await updateSite(siteData);
        return;
    }
    let hash = cyrb53(feedResponse.text);
    if ( hash != siteData.hash ) {
        let feedObj = await getFeedObject(feedResponse);
        let site = generateSiteFromFeedObject(feedObj);
        site.id = siteData.id;
        let updated = await updateSite(site);
        if ( updated ) {
            await addNewArticlesToSite(feedObj.articles, site.id);
        }

    } else {
        siteData.etag = etag;
        siteData.last_modified = last_modified;
        siteData.poll_interval = 5*SECONDS_IN_MINUTES;
        siteData.next_poll = Date.now() + siteData.poll_interval;
        await updateSite(siteData)
    }
}

async function fetchMyFeed(url, etag, last_modified) {
    const myHeaders = new Headers();
    myHeaders.append("Rss-Url", url);
    if ( etag != null ) {
        myHeaders.append("If-None-Match", etag);
    }
    if ( last_modified != null ) {
        myHeaders.append("If-Modified-Since", last_modified);
    }
    const response = await fetch("/proxy", {
        headers: myHeaders
    });
    let result = {last_modified: "", etag: "", text: "", status: response.status};
    if ( !response.ok ) {
        return result;
    }
    let text = await response.text();
    result.last_modified = response.headers.get("Last-Modified");
    result.etag = response.headers.get("ETag");
    result.text = text;
    return result
}

openDB();
showUrlMain();
addEventListeners();
doPolling();