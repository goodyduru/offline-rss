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
        site.numUnreadArticles = numArticles;
        app.sidebarController.add(site);
        return true;
    }
};