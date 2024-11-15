app.controllers.Article = class ArticleController extends app.PageController {
    constructor(view, siteModel, articleModel) {
        super(view);
        this.siteModel = siteModel;
        this.articleModel = articleModel;
        let handler = this.updateHandler.bind(this)
        this.view.setUpdateHandler(handler);
    }

    updateHandler(articles, index, idRanges, url) {
        super.setHistory(url, {index: index, idRanges: idRanges});
        this.update(articles[index]);
    }

    async update(article) {
        if ( article.isRead == 0 ) { 
            const site = await this.siteModel.get('id', article.siteId);
            if ( site == null ) {
                return;
            }
            article.isRead = 1;
            await this.articleModel.update(null, article);
            site.numUnreadArticles = await app.articleModel.countUnreadInSite(article.siteId);
            app.sidebarController.update(site);
        }
    }

    go() {
        if ( arguments.length == 2 ) {
            this.goByHistory(arguments[0], arguments[1]);
        } else {
            this.goByClick(arguments[0], arguments[1], arguments[2], arguments[3]);
        }
    }

    async goByHistory(articleId, historyState) {
        let id = parseInt(articleId);
        if ( isNaN(id) ) {
            this.view.go();
            return;
        }
        if ( historyState == null ) {
            let article = await app.articleModel.get(null, 'id', id);
            if ( article == null ) {
                this.view.go()
            } else {
                this.update(article);
                this.view.go([article], 0);
            }
        } else {
            let articles = await app.articleModel.getInRanges(historyState.idRanges);
            let ids = articles.map((article) => article.id);
            let index = ids.indexOf(id);
            if ( articles.length > 0 && index > 0 ) {
                this.update(articles[index]);
            }
            this.view.go(articles, index, historyState.idRanges);
        }
    }

    async goByClick(articles, index, idRanges, url) {
        this.updateHandler(articles, index, idRanges, url);
        this.view.go(articles, index, idRanges);
    }
};