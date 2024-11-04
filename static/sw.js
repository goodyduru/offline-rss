const SW_VERSION = "v1"
const addResourcesToCache = async (resources) => {
    const cache = await caches.open(SW_VERSION);
    await cache.addAll(resources);
};

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        addResourcesToCache([
            "/",
            "/index.html",
            "/main.css",
            "/output-20241104-181720.js",
            "/webfonts/fa-solid-900.woff2",
        ]),
    );
});


const deleteCache = async(key) => {
    await caches.delete(key);
};

const deleteOldCaches = async () => {
    const cacheKeepList = [SW_VERSION];
    const keyList = await caches.keys();
    const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
    await Promise.all(cachesToDelete.map(deleteCache));
};

self.addEventListener("activate", (event) => {
    event.waitUntil(deleteOldCaches());
});

const putInCache = async(request, response) => {
    const cache = await caches.open(SW_VERSION);
    await cache.put(request, response);
}

const cacheFirst = async (request) => {
    if ( !request.url.startsWith('http') ) {
        return;
    }
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
        return responseFromCache;
    }

    try {
        const responseFromNetwork = await fetch(request);
        putInCache(request, responseFromNetwork.clone());
        return responseFromNetwork;
    } catch (error) {
        return new Response("Network error happened", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
        });
    }
};

const justFetch = async (request) => {
    const responseFromNetwork = await fetch(request);
    return responseFromNetwork;
};

const getIndex = async (request) => {
    try {
        const responseFromNetwork = await fetch(request);
        putInCache(request, responseFromNetwork.clone());
        return responseFromNetwork;
    } catch (error) {
        let req = new Request("/");
        const responseFromCache = await caches.match(req);
        if (responseFromCache) {
            return responseFromCache;
        } else {
            return new Response("Network error happened", {
                status: 408,
                headers: { "Content-Type": "text/plain" },
            });
        }
    }
}

const staticUrls = ["/article/", "/add-feed", "/feed-list", "/feed/"];

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.pathname == "/proxy" && url.searchParams.get("sw") == "0" ) {
        event.respondWith(justFetch(event.request));
    } else if ( url.pathname == "/" || url.pathname == "" || staticUrls.some((x) => url.pathname.startsWith(x)) ) {
        event.respondWith(getIndex(event.request));
    } else {
        event.respondWith(
            cacheFirst(event.request),
        );
    }
});

