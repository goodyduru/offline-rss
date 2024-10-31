class App {
    models = {};
    views = {};
    controllers = {};
    async init() {
        this.addEventListeners();
        this.registerServiceWorker();
        this.db = new app.DB();
        await this.db.open();
        this.siteModel = new app.models.Site();
        this.articleModel = new app.models.Article();
        this.searchModel = new app.models.Search();
        this.sidebarController = new app.controllers.Sidebar(new app.views.Sidebar(), this.siteModel, this.articleModel);
        this.searchModel.create();
        await this.sidebarController.init();
        let _ = new app.Poll(); // Initialize polling
        _ = new app.controllers.Search(new app.views.Search(), this.searchModel, this.articleModel);

        this.addFeedController = new app.controllers.AddFeed(new app.views.AddFeed(), this.siteModel, this.articleModel, this.searchModel);
        this.listFeedsController = new app.controllers.ListFeeds(new app.views.ListFeeds(), this.siteModel, this.articleModel, this.searchModel);
        this.singleArticleController = new app.controllers.Article(new app.views.Article(), this.siteModel, this.articleModel);
        this.homeController = new app.controllers.Home(new app.views.Home(), this.siteModel, this.articleModel);
        this.listArticlesController = new app.controllers.ListArticles(new app.views.ListArticles(), this.siteModel, this.articleModel);
        this.appRouter = new app.Router(); // Initialize router
    }

    async registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.register("./sw.js", {
                    scope: "/",
                });
                if (registration.installing) {
                    console.log("Service worker installing");
                } else if (registration.waiting) {
                    console.log("Service worker installed");
                } else if (registration.active) {
                    console.log("Service worker active");
                }
            } catch (error) {
                console.log(`Registration failed with ${error}`);
            }
        }
    };

    addEventListeners() {
        const pinBtn = document.querySelector('.pin');
        const closeBtn = document.querySelector('.close');
        const barsBtn = document.querySelector('.bars');
        const wrapper = document.querySelector('body > .wrapper');
        const links = document.querySelectorAll("aside a");

        pinBtn.addEventListener('click', () => {
            wrapper.classList.add('sidebar-open');
        });

        barsBtn.addEventListener('click', () => {
            wrapper.classList.add('sidebar-open');
        });

        closeBtn.addEventListener('click', () => {
            wrapper.classList.remove('sidebar-open');
        });

        links.forEach((anchor) => {
            anchor.addEventListener("click", (evt) => {
                evt.preventDefault();
                if ( window.location.href != evt.target.href ) {
                    window.history.pushState(null, "", evt.target.href);
                }
                app.appRouter.router();
            });
        });
    }
}

const app = new App();