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
    async init() {
        let sites = await app.siteModel.getAll();
        for ( let site of sites ) {
            site.numUnreadArticles = await app.articleModel.countUnreadInSite(site.id);
        }
        this.view.setContent(sites);
        this.view.setClickHandler(this.clickHandler);
        this.view.render(sites);
    }

    clickHandler(evt) {
        super.setHistory(evt.currentTarget.href);
        emitFeedArticles(this.site, this.onlyUnread);
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