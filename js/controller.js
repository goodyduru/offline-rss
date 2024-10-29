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

app.PageController = class PageController extends app.Controller {
    constructor(view) {
        super(view);
    }

    go() {
        this.view.go(...arguments);
    }
};

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
};