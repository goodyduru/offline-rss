app.controllers.Home = class HomeController extends app.ListController {
    async go() {
        this.title = "Home";
        const sites = await this.siteModel.getAll();
        if ( sites.length > 0 ) {
            this.articles = await this.articleModel.getUnread();
        }
        super.go();
    }
};