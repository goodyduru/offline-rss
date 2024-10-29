app.Router = class Router {
    constructor() {
        this.routes = {};
        this.templates = {};
        let historyRouter = this.router.bind(this);
        this.setup();
        window.onpopstate = (event) => {
            historyRouter(event.state);
        };
        this.router();
    }

    route(path, template) {
        if ( typeof template === 'function' ) {
            this.routes[path] = template;
        } else if ( typeof template === 'string' ) {
            this.routes[path] = this.templates[template];
        }
    }

    template(name, templateFunction) {
        this.templates[name] = templateFunction; 
    }

    setup() {
        this.template('home', function() {
            app.homeController.go();
        });
    
        this.template('add-feed', function() {
            app.addFeedController.go();
        });
    
        this.template('feed-list', function() {
            app.listFeedsController.go();
        });
    
        this.template('feed', function(hash) {
            app.listArticlesController.go(hash);
        });
    
        this.template('article', function(hash, historyState) {
            app.singleArticleController.go(hash, historyState);
        })
    
        this.route('', 'home');
        this.route('add-feed', 'add-feed');
        this.route('feed-list', 'feed-list');
        this.route('feed', 'feed');
        this.route('article', 'article');
    }

    resolveRouter(route) {
        try {
            return this.routes[route];
        } catch(e) {
            throw new Error(`Route ${route} not found`);
        }
    }

    router(historyState) {
        let url = window.location.pathname || '/';
        let urls = url.split('/');
        if ( urls.length == 2 || urls[2] == '' ) {
            let route = this.resolveRouter(urls[1]);
            route();
        } else if ( urls.length > 2 ) {
            let route = this.resolveRouter(urls[1]);
            route(urls[2], historyState);
        }
    }
};