app.Controller = class Controller {
    constructor(view) {
        this.view = view;
    }

    setHistory(href) {
        if ( window.location.href != href ) {
            window.history.pushState(null, "", href);
        }
    }
};

app.controllers.Sidebar = class SidebarController extends app.Controller {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
    }
    async init() {
        let sites = await this.siteModel.getAll();
        for ( let site of sites ) {
            site.numUnreadArticles = await this.articleModel.countUnreadInSite(site.id);
        }
        this.view.setContent(sites);
        this.view.setOutputFeedFunc(this.outputFeed);
        this.view.render(sites);
    }

    outputFeed(site, onlyUnread, href) {
        super.setHistory(href);
        emitFeedArticles(site, onlyUnread);
    }

    add(site) {
        this.view.add(site);
    }

    update(site) {
        this.view.update(site);
    }

    delete(site) {
        this.view.remove(site);
    }
};


app.controllers.Search = class SearchController extends app.Controller {
    constructor(view, searchModel, articleModel) {
        super(view);
        this.searchModel = searchModel;
        this.articleModel = articleModel;
        let handleFunc = this.handleTextChange.bind(this);
        this.view.bindInputChange(handleFunc);
    }

    async handleTextChange(text) {
        let articleIds = this.searchModel.get(text);
        let result = [];
        if ( articleIds.length == 0 ) {
            this.view.closeBox();
            return result;
        }
        for ( let id of articleIds ) {
            let article = await this.articleModel.get(null, 'id', id);
            let str = `<li><a href="/article/${article.hash}">${article.title}</a></li>`;
            result.push(str);
        }
        return result;
    }
};

app.PageController = class PageController extends app.Controller {
    constructor(view) {
        super(view);
    }

    go() {
        this.view.go(...arguments);
    }
}

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
}

app.controllers.ListFeeds = class ListFeedsController extends app.PageController {
    constructor(view, siteModel, articleModel, searchModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        this.searchModel = searchModel;
        let editSiteFunc = this.editSite.bind(this);
        let deleteSiteFunc = this.deleteSite.bind(this);
        this.view.setSiteFunctions(editSiteFunc, deleteSiteFunc);
    }

    async go() {
        const sites = await this.siteModel.getAll();
        super.go(sites);
    }

    async editSite(site) {
        this.siteModel.update(site);
        site.numUnreadArticles = await this.articleModel.countUnreadInSite(site.id);
        app.sidebarController.update(site);
    }

    async deleteSite(site) {
        let ids = await this.articleModel.deleteInSite(site.id);
        await this.siteModel.delete(site.id);
        this.searchModel.delete(ids);
        app.sidebarController.delete(site);
    }
}