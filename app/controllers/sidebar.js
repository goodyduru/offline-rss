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
        app.listArticlesController.go(site, onlyUnread);
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