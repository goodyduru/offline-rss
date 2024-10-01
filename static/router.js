routes = {};
templates = {};

function route(path, template) {
    if ( typeof template === 'function' ) {
        routes[path] = template;
    } else if ( typeof template === 'string' ) {
        routes[path] = templates[template];
    }
}

function template(name, templateFunction) {
    templates[name] = templateFunction; 
}

function setupRoutes() {
    template('home', function() {
        viewUnread();
    });

    template('add-feed', function() {
        document.getElementById("feed-options").replaceChildren();
        showOneMain("add-feed")
    });

    template('feed-list', function() {
        listOfFeeds();
    });

    template('feed', function(hash) {
        viewSiteByHash(hash);
    });

    template('article', function(hash) {
        viewArticleByHash(hash);
    })

    route('', 'home');
    route('add-feed', 'add-feed');
    route('feed-list', 'feed-list');
    route('feed', 'feed');
    route('article', 'article');
}

function setupHistory() {
    window.onpopstate = (event) => {
        router();
    }
}

function resolveRouter(route) {
    try {
        return routes[route];
    } catch(e) {
        throw new Error(`Route ${route} not found`);
    }
}

function router() {
    let url = window.location.pathname || '/';
    let urls = url.split('/');
    if ( urls.length == 2 || urls[2] == '' ) {
        let route = resolveRouter(urls[1]);
        route();
    } else if ( urls.length > 2 ) {
        let route = resolveRouter(urls[1]);
        route(urls[2]);
    }
}

function initRouter() {
    setupRoutes();
    setupHistory();
    router();
}