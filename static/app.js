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
        this.sidebarController = new app.controllers.Sidebar(new app.views.Sidebar(), this.siteModel, this.articleModel);
        console.time("building index time");
        await this.searchModel.create();
        console.timeEnd("building index time");
        await this.sidebarController.init();
        let _ = new app.Poll(); // Initialize polling
        _ = new app.controllers.Search(new app.views.Search(), this.searchModel, this.articleModel);

        this.addFeedController = new app.controllers.AddFeed(new app.views.AddFeed(), this.siteModel, this.articleModel, this.searchModel);
        this.listFeedsController = new app.controllers.ListFeeds(new app.views.ListFeeds(), this.siteModel, this.articleModel, this.searchModel);
        this.singleArticleController = new app.controllers.Article(new app.views.Article(), this.siteModel, this.articleModel);
        this.homeController = new app.controllers.Home(new app.views.Home(), this.siteModel, this.articleModel);
        this.appRouter = new app.Router(); // Initialize router
    }
}

const app = new App();