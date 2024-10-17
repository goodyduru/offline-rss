class App {
    models = {};
    views = {};
    controllers = {};
    async init() {
        this.db = new app.DB();
        await this.db.open();
        this.siteModel = new app.models.Site();
        this.articleModel = new app.models.Article();
        this.searchModel = new app.models.Search();
        this.sidebarController = new app.controllers.Sidebar(new app.views.Sidebar());
        console.time("building index time");
        await this.searchModel.create();
        console.timeEnd("building index time");
        await this.sidebarController.init();
    }
}

const app = new App();