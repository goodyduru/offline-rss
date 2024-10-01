
function doPolling() {
    setInterval(pollFeeds, SECONDS_IN_MINUTES);
}

async function pollFeeds() {
    const sites = await getSitesToPoll();
    if ( sites.length == 0 ) {
        return;
    }
    for ( site of sites ) {
        let result = await pollFeed(site);
        if ( result > 0 ) {
            updateSiteSidebar(site);
        }
    }
}

async function pollFeed(siteData) {
    let etag = siteData.etag;
    let lastModified = siteData.lastModified;
    let url = siteData.feedUrl;
    let numArticles = 0;
    const MAX_WAIT_TIME = 3600000; 
    const feedResponse = await fetchMyFeed(url, etag, lastModified);
    if ( feedResponse.status == 304 && siteData.pollInterval < MAX_WAIT_TIME ) {
        siteData.pollInterval = Math.min(MAX_WAIT_TIME, siteData.pollInterval*2);
    } else if ( feedResponse.status == 429 || feedResponse.status == 403 ) {
        siteData.pollInterval = 4 * MAX_WAIT_TIME;
    }

    if ( feedResponse.text == "" ) {
        siteData.nextPoll = Date.now() + siteData.pollInterval;
        await updateSite(siteData);
        return numArticles;
    }
    let hash = cyrb53(feedResponse.text);
    if ( hash != siteData.hash ) {
        let feedObj = await getFeedObject(feedResponse);
        let site = generateSiteFromFeedObject(feedObj);
        site.id = siteData.id;
        site.numUnreadArticles = siteData.numUnreadArticles;
        let updated = await updateSite(site);
        if ( updated ) {
            numArticles = await addNewArticlesToSite(feedObj.articles, site.id);
            site.numUnreadArticles += numArticles;
            siteData.numUnreadArticles = site.numUnreadArticles;
            await updateSite(site);
        }

    } else {
        siteData.etag = etag;
        siteData.lastModified = lastModified;
        siteData.pollInterval = 5*SECONDS_IN_MINUTES;
        siteData.nextPoll = Date.now() + siteData.pollInterval;
        await updateSite(siteData)
    }
    return numArticles;
}

async function fetchMyFeed(url, etag, lastModified) {
    const myHeaders = new Headers();
    if ( etag != null ) {
        myHeaders.append("If-None-Match", etag);
    }
    if ( lastModified != null ) {
        myHeaders.append("If-Modified-Since", lastModified);
    }
    const response = await fetch(`/proxy?u=${encodeURIComponent(url)}`, {
        headers: myHeaders
    });
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

function notifyUser(numArticles) {
    const message = `You have ${numArticles} new articles to read.`;
    alert(message);
}