app.Controller = class Controller {
    setHistory(href) {
        if ( window.location.href != href ) {
            window.history.pushState(null, "", href);
        }
    }
};

app.controllers.Sidebar = class SidebarController extends app.Controller {
    constructor(sidebarView) {
        super();
        this.sidebarView = sidebarView;
    }

    async init() {
        let sites = await app.siteModel.getAll();
        for ( let site of sites ) {
            site.numUnreadArticles = await app.articleModel.countUnreadInSite(site.id);
        }
        this.sidebarView.setContent(sites);
        this.sidebarView.setClickHandler(this.clickHandler);
        this.sidebarView.render(sites);
    }

    clickHandler(evt) {
        super.setHistory(evt.currentTarget.href);
        emitFeedArticles(this.site, this.onlyUnread);
    }

    add(site) {
        this.sidebarView.add(site);
    }

    update(site) {
        this.sidebarView.update(site);
    }

    delete(site) {
        this.sidebarView.remove(site);
    }
};