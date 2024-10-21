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
            response = await fetch(`/proxy?u=${encodeURIComponent(url)}`, {
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