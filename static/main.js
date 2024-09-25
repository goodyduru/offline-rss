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
    const feedList = document.querySelector(ARTICLE_LIST_HREF);
    feedList.replaceChildren();
    feedList.appendChild(unorderedList);
    let store = getObjectStore(SITE_STORE_NAME, "readonly");
    for ( url of feeds.urls ) {
        let feedObj = feeds.feedMap.get(url);
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
    feedObj.feedUrl = url;
    let dbContainsSite = await hasSite(store, url);
    if ( feedObj.title != "" ) {
        html += `<h2>${feedObj.title}</h2>`;
    }
    html += `<p>Visit the site link: <a href="${feedObj.siteUrl}">${feedObj.siteUrl}</a></p>`;
    if ( feedObj.description != "" ) {
        html += `<div>${feedObj.description}</div>`;
    }
    html += "<ul>";
    const minSize = Math.min(3, feedObj.articles.length);
    for ( i = 0; i < minSize; i++ ) {
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
        feedUrl: feedObj.feedUrl,
        siteUrl: feedObj.siteUrl, 
        description: feedObj.description,
        hash: feedObj.hash,
        etag: feedObj.etag,
        lastModified: feedObj.lastModified,
        nextPoll: feedObj.nextPoll,
        pollInterval: feedObj.pollInterval,
        numUnreadArticles: 0,
    }
}

async function addFeed(evt) {
    evt.preventDefault();
    let site = generateSiteFromFeedObject(this.feedObj);
    let siteId = await getOrCreateSite(site);
    if ( siteId == 0 ) {
        return;
    }
    let articleStore = getObjectStore(ARTICLE_STORE_NAME, 'readwrite');
    let end = this.feedObj.articles.length - 1;
    /**
     * Add articles in reverse order. Most RSS feeds starts from the newest to the oldest.
     * We want to add from the oldest to the newest.
     */
    let numArticles = 0;
    for ( let i = end; i >= 0; i-- ) {
        this.feedObj.articles[i].siteId = siteId;
        numArticles += await getOrCreateArticle(articleStore, this.feedObj.articles[i]);
    }
    site.numUnreadArticles = numArticles;
    site.id = siteId;
    updateSite(site);
}

openDB();
showUrlMain();
addEventListeners();
doPolling();