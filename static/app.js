class App {
    models = {};
    async init() {
        this.db = new app.DB();
        await this.db.open();
        this.site_model = new app.models.Site();
        this.article_model = new app.models.Article();
        this.search_model = new app.models.Search();
        console.time("building index time");
        await this.search_model.create();
        console.timeEnd("building index time");
    }
}

const app = new App();