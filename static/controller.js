app.Controller = class Controller {
    constructor(view) {
        this.view = view;
    }

    setHistory(href, state) {
        if ( window.location.href != href ) {
            window.history.pushState(state, "", href);
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
        super.setHistory(href, null);
        emitFeedArticles(site, onlyUnread);
    }

    add(site) {
        this.view.add(site, true);
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

app.controllers.Article = class ArticleController extends app.PageController {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        let handler = this.updateHandler.bind(this)
        this.view.setUpdateHandler(handler);
    }

    updateHandler(articles, index, idRanges, url) {
        super.setHistory(url, {index: index, idRanges: idRanges});
        this.update(articles[index]);
    }

    async update(article) {
        if ( article.isRead == 0 ) { 
            const site = await this.siteModel.get('id', article.siteId);
            if ( site == null ) {
                return;
            }
            article.isRead = 1;
            await this.articleModel.update(null, article);
            site.numUnreadArticles = await app.articleModel.countUnreadInSite(article.siteId);
            app.sidebarController.update(site);
        }
    }

    go() {
        if ( arguments.length == 2 ) {
            this.goByRouter(arguments[0], arguments[1]);
        } else {
            this.goByClick(arguments[0], arguments[1], arguments[2], arguments[3]);
        }
    }

    async goByRouter(articleHash, historyState) {
        let hash = parseInt(articleHash);
        if ( isNaN(hash) ) {
            this.view.go();
            return;
        }
        if ( historyState == null ) {
            let article = await app.articleModel.get(null, 'hash', hash);
            if ( article == null ) {
                this.view.go()
            } else {
                this.update(article);
                this.view.go([article], 0);
            }
        } else {
            let articles = await app.articleModel.getInRanges(historyState.idRanges);
            let hashes = articles.map((article) => article.hash);
            let index = hashes.indexOf(hash);
            if ( articles.length > 0 && index > 0 ) {
                this.update(articles[index]);
            }
            this.view.go(articles, index, historyState.idRanges);
        }
    }

    async goByClick(articles, index, idRanges, url) {
        this.updateHandler(articles, index, idRanges, url);
        this.view.go(articles, index, idRanges);
    }
}

app.ListController = class ListController extends app.PageController {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        this.onlyUnread = true;
        this.articles = null;
        this.idRanges = null;
        let toggle = this.toggle.bind(this);
        let visitArticle = this.visitArticle.bind(this);
        this.view.bindToggle(toggle);
        this.view.bindVisit(visitArticle);
    }

    createArticleIdRanges() {
        if ( this.articles == null ) {
            return;
        }
        const articleIds = this.articles.map((article) => article.id);
        let start = articleIds[articleIds.length - 1];
        let end = start;
        let result = [];
        for ( let i = articleIds.length - 2; i >= 0; i-- ) {
            if ( articleIds[i]-end == 1 ) {
                end = articleIds[i];
            } else {
                result.push(end, start);
                start = articleIds[i];
                end = start;
            }
        }
        result.push(end, start);
        this.idRanges = result.reverse();
    }

    async toggle(index) {
        const article = this.articles[index];
        const site = await this.siteModel.get('id', article.siteId);
        if ( site == null ) {
            return false;
        }
        this.articleModel.update(null, article);
        site.numUnreadArticles = await this.articleModel.countUnreadInSite(article.siteId);
        app.sidebarController.update(site);
        return true;
    }

    visitArticle(index, url) {
        app.singleArticleController.go(this.articles, index, this.idRanges, url);
    }

    async go() {
        this.createArticleIdRanges();
        this.view.go(this.articles, this.onlyUnread, this.title);
    }
}

app.controllers.Home = class HomeController extends app.ListController {
    async go() {
        this.title = "Home";
        const sites = await this.siteModel.getAll();
        if ( sites.length > 0 ) {
            this.articles = await this.articleModel.getUnread();
        }
        super.go();
    }
}