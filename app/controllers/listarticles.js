app.controllers.ListArticles = class ListArticles extends app.ListController {
    constructor(view, siteModel, articleModel) {
        super(view, siteModel, articleModel);
        this.site = null;
        let v = this.visitAll.bind(this);
        this.view.bindViewAll(v);
    }

    async go() {
        if ( arguments.length == 1 ) {
            await this.getSite(...arguments);
            this.onlyUnread = true;
        } else {
            this.site = arguments[0];
            this.onlyUnread = arguments[1];
        }
        this.view.setSite(this.site);
        if ( this.site != null ) {
            this.title = this.site.title;
            if ( this.onlyUnread ) {
                this.articles = await this.articleModel.getInSite(this.site.id, 0);
            } else {
                this.articles = await this.articleModel.getInSite(this.site.id);
            }
        }
        super.go();
    }

    async getSite(siteHash) {
        let hash = parseInt(siteHash);
        if ( !isNaN(hash) ) {
            this.site = await this.siteModel.get('hash', hash);
        }
    }

    visitAll() {
        this.go(this.site, false);
    }
};