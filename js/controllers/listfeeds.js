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
};