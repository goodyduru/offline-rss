const ARTICLE_LIST_HREF = "#article-list";
const SINGLE_ARTICLE_HREF = "#single-article"

function htmlToNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstChild;
}

function getCountContent(unreadArticles) {
    let count;
    if ( unreadArticles > 0 ) {
        count = `(${unreadArticles})`;
    } else {
        count = "";
    }
    return count;
}


function showOneMain(href) {
    const index = href.indexOf("#");
    if ( index == -1 ) {
        return;
    } 
    const id = href.substring(index+1);
    if ( id == "" ) {
        return;
    }
    document.querySelectorAll("main").forEach((content) => {
        if (content.getAttribute("id") == id) {
            content.classList.remove("d-none");
            return;
        }
        content.classList.add("d-none");
    });
}

function showUrlMain() {
    const loc = document.location;
    showOneMain(loc.hash);
}

async function viewUnread() {
    const parent = document.querySelector(ARTICLE_LIST_HREF);
    const articles = await getUnreadArticles();

    parent.replaceChildren();
    if ( articles.length == 0 ) {
        const message = "<p>There are no articles in this feed.</p>";
        parent.insertAdjacentHTML("beforeend", message);
        return;
    }
    parent.appendChild(listArticles(articles));
    if ( parent.classList.contains("d-none") ) {
        showOneMain(ARTICLE_LIST_HREF);
    } else {
        window.scroll(0, 0);
    }
}

async function sidebarSites() {
    const parent = document.getElementById("sidebar-feeds");
    const sites = await getAllSites();
    parent.replaceChildren();
    if ( sites.length == 0 ) {
        const message = "<p>You've not subscribed to any feed.</p>";
        parent.insertAdjacentHTML("beforeend", message);
        return;
    }
    for ( site of sites ) {
        addSiteToSidebar(parent, site);
    }
}

function addSiteToSidebar(parent, site) {
    if ( parent == null ) {
        parent = document.getElementById("sidebar-feeds");
        if ( parent.firstChild && parent.firstChild.tagName == "P" ) {
            parent.replaceChildren();
        }
    }
    const hash = cyrb53(site.feedUrl);
    const html = `<li><a href="/feed/${site.hash}">${site.title}<span id="feed-${hash}">${getCountContent(site.numUnreadArticles)}</span></a></li>`;
    const listItem = htmlToNode(html);
    let v = viewSiteFeeds.bind({site: site, allArticles: false});
    listItem.firstChild.addEventListener('click', v);
    parent.appendChild(listItem);
}

async function viewSiteFeeds(evt) {
    evt.preventDefault();
    let target;
    if ( evt.target.tagName == "SPAN" ) {
        target = evt.target.parentNode;
    } else {
        target = evt.target;
    }
    window.history.pushState(this.site, this.site.title, target.href);
    const parent = document.querySelector(ARTICLE_LIST_HREF);
    let articles;
    if ( this.allArticles ) {
        articles = await getSiteArticles(this.site.id);
    } else {
        articles = await getSiteArticles(this.site.id, 0);
    }

    parent.replaceChildren();
    if ( articles.length == 0 ) {
        if ( this.allArticles ) {
            const message = "<p>There are no unread articles in this feed.</p>";
            parent.insertAdjacentHTML("beforeend", message);
        } else {
            const divNode = htmlToNode(`<div><p>There are no unread articles in this feed.</p><p><a class="btn" href="#">View Read Articles</a></p></div>`);
            const btn = divNode.lastChild.firstChild;
            let v = viewSiteFeeds.bind({site: site, allArticles: true});
            btn.addEventListener('click', v);
            parent.append(divNode);
        }
    } else {
        parent.appendChild(listArticles(articles));
    }
    if ( parent.classList.contains("d-none") ) {
        showOneMain(ARTICLE_LIST_HREF);
    } else {
        window.scroll(0, 0);
    }
}

function listArticles(articles) {
    const list = document.createElement("ul");
    for ( let i = 0; i < articles.length; i++ ) {
        let article = articles[i]
        const anchorClass = ( article.isRead == 1 ) ? "" : "unread";
        const toggle = ( article.isRead == 1 ) ? "Mark as unread" : "Mark as read";
        const html = `<li><a href="/article/${article.hash}" class="${anchorClass}">${article.title}</a><a href="#">${toggle}</a></li>`;
        const listItem = htmlToNode(html);
        let v = viewArticle.bind({articles: articles, index: i});
        let t = toggleRead.bind({article: article});
        listItem.firstChild.addEventListener('click', v);
        listItem.lastChild.addEventListener('click', t);
        list.appendChild(listItem);
    }
    return list;
}

async function viewArticle(evt) {
    evt.preventDefault();
    const article = this.articles[this.index];
    window.history.pushState("Wow", article.title, evt.target.href);
    if ( article.isRead == 0 ) {
        const site = await getSite(article.siteId);
        if ( site == null ) {
            return;
        }
        site.numUnreadArticles--;
        article.isRead = 1;
        updateArticle(null, article);
        updateSite(site);
        const hash = cyrb53(site.feedUrl);
        document.getElementById(`feed-${hash}`).textContent = getCountContent(site.numUnreadArticles);
    }
    const parent = document.querySelector(SINGLE_ARTICLE_HREF);
    const articleLink = `<p><a href="${article.link}" target="_blank">Visit site</a></p>`
    const html = `<article><h2>${article.title}</h2>${articleLink}<section>${article.content}</section></article>`;
    parent.replaceChildren();
    parent.insertAdjacentHTML("beforeend", html);
    const nav = document.createElement("section");
    if ( this.index > 0 ) {
        let prev = htmlToNode(`<a href="/article/${this.articles[this.index-1].hash}">Prev</a>`);
        let v = viewArticle.bind({articles: this.articles, index: this.index-1});
        prev.addEventListener('click', v);
        nav.appendChild(prev);
    }

    if ( this.index < (this.articles.length - 1) ) {
        let next = htmlToNode(`<a href="/article/${this.articles[this.index+1].hash}">Next</a>`);
        let v = viewArticle.bind({articles: this.articles, index: this.index+1});
        next.addEventListener('click', v);
        nav.appendChild(next);
    }
    parent.appendChild(nav);
    if ( parent.classList.contains("d-none") ) {
        showOneMain(SINGLE_ARTICLE_HREF);
    } else {
        window.scroll(0, 0);
    }
}

async function toggleRead(evt) {
    evt.preventDefault();
    this.article.isRead = (this.article.isRead == 1) ? 0 : 1;
    let add, to;
    if ( this.article.isRead == 1 ) {
        to = "Mark as unread";
        add = -1;
    } else {
        to = "Mark as read";
        add = 1;
    }
    const site = await getSite(this.article.siteId);
    if ( site == null ) {
        return;
    }
    site.numUnreadArticles += add;
    updateArticle(null, this.article);
    updateSite(site);
    evt.target.parentNode.firstChild.classList.toggle("unread");
    evt.target.innerHTML = to;
    const hash = cyrb53(site.feedUrl);
    document.getElementById(`feed-${hash}`).textContent = getCountContent(site.numUnreadArticles)
}

async function showFeeds(evt) {
    evt.preventDefault();
    const feedUrl = document.getElementById("feed-url").value;
    const loader = document.getElementById("loader");
    loader.style.display = "flex";
    const feeds = await findFeeds(feedUrl);
    if ( feeds == null || feeds.urls.length == 0 ) {
        loader.style.display = "none";
        alert("No feed in the given website.");
        return;
    }
    let unorderedList = document.createElement("ul");
    const feedList = document.getElementById("feed-options");
    feedList.replaceChildren();
    feedList.appendChild(unorderedList);
    let store = getObjectStore(SITE_STORE_NAME, "readonly");
    for ( url of feeds.urls ) {
        let feedObj = feeds.feedMap.get(url);
        if ( feedObj == 'undefined' || feedObj == null ) {
            continue;
        }
        html = await showFeed(store, url, feedObj);
        unorderedList.insertAdjacentHTML('beforeend', html);
        let myAddFeed = addFeed.bind({feedObj: feedObj});
        let btn = document.getElementById(`${feedObj.hash}`);
        if ( btn != null ) {
            btn.addEventListener('click', myAddFeed);
        }
    }
    loader.style.display = "none";
}

async function showFeed(store, url, feedObj) {
    let html = "<li><div>";
    feedObj.feedUrl = url;
    let dbContainsSite = await hasSite(store, url);
    if ( feedObj.title != "" ) {
        html += `<h2>${feedObj.title}</h2>`;
    }
    html += `<p>Visit the site link: <a href="${feedObj.siteUrl}">${feedObj.siteUrl}</a></p>`;
    if ( feedObj.description != "" ) {
        html += `<div>${feedObj.description}</div>`;
    }
    html += "<ul>";
    const minSize = Math.min(3, feedObj.articles.length);
    for ( i = 0; i < minSize; i++ ) {
        html += "<li>";
        if ( feedObj.articles[i].title != "" ) {
            html += `<strong>${feedObj.articles[i].title}</strong>`;
        }
        html += "</li>";
    }
    html += "</ul>";
    if ( dbContainsSite ) {
        html += '<p>Added</p>';
    } else {
        html += `<form><button id="${feedObj.hash}">Add Feed</button></form>`;
    }
    return html;
}

async function addFeed(evt) {
    evt.preventDefault();
    const btn = evt.target;
    btn.textContent = "Adding...";
    btn.setAttribute('disabled', true);
    let site = generateSiteFromFeedObject(this.feedObj);
    let siteId = await getOrCreateSite(site);
    if ( siteId == 0 ) {
        return;
    }
    let articleStore = getObjectStore(ARTICLE_STORE_NAME, 'readwrite');
    let end = this.feedObj.articles.length - 1;
    /**
     * Add articles in reverse order. Most RSS feeds starts from the newest to the oldest.
     * We want to add from the oldest to the newest.
     */
    let numArticles = 0;
    for ( let i = end; i >= 0; i-- ) {
        this.feedObj.articles[i].siteId = siteId;
        numArticles += await getOrCreateArticle(articleStore, this.feedObj.articles[i]);
    }
    site.numUnreadArticles = numArticles;
    site.id = siteId;
    await updateSite(site);
    btn.textContent = "Added";
    addSiteToSidebar(null, site);
}

function initView() {
    sidebarSites();
    viewUnread();
}

