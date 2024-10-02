const ARTICLE_LIST_ID = "article-list";
const SINGLE_ARTICLE_ID = "single-article"
const FEED_LIST_ID = "feed-list"

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

function showOneMain(id) {
    document.querySelectorAll("main").forEach((content) => {
        if (content.getAttribute("id") == id) {
            content.classList.remove("d-none");
            return;
        }
        content.classList.add("d-none");
    });
}

async function viewUnread(historyState) {
    const parent = document.getElementById(ARTICLE_LIST_ID);
    document.title = "Offline RSS Reader"
    let articles;
    if ( historyState == undefined || historyState == null ) {
        articles = await getUnreadArticles();
        const idRanges = createArticleIdRanges(articles);
        window.history.pushState({idRanges: idRanges}, "", "/");
    } else {
        articles = await getArticles(historyState.idRanges);
    }
    parent.replaceChildren();
    if ( articles.length == 0 ) {
        const message = "<p>There are no articles in this feed.</p>";
        parent.insertAdjacentHTML("beforeend", message);
        return;
    }
    parent.appendChild(listArticles(articles));
    if ( parent.classList.contains("d-none") ) {
        showOneMain(ARTICLE_LIST_ID);
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
    const html = `<li><a href="/feed/${site.hash}" id="feed-${hash}">${site.title}<span>${getCountContent(site.numUnreadArticles)}</span></a></li>`;
    const listItem = htmlToNode(html);
    let v = viewSiteFeeds.bind({site: site, onlyUnread: true});
    listItem.firstChild.addEventListener('click', v);
    parent.appendChild(listItem);
}

function updateSiteSidebar(site) {
    const hash = cyrb53(site.feedUrl);
    const content = `${site.title}<span>${getCountContent(site.numUnreadArticles)}</span>`;
    const anchor = document.getElementById(`feed-${hash}`);
    anchor.replaceChildren();
    anchor.innerHTML = content;
}

function removeSiteFromSidebar(site) {
    const hash = cyrb53(site.feedUrl);
    const anchor = document.getElementById(`feed-${hash}`);
    const list = anchor.parentNode.parentNode;
    list.removeChild(anchor.parentNode);
    if ( list.childNodes.length == 0 ) {
        list.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
    }
}

async function viewSiteFeeds(evt) {
    evt.preventDefault();
    let href = evt.currentTarget.href;
    let articles;
    if ( this.onlyUnread ) {
        articles = await getSiteArticles(this.site.id, 0);
    } else {
        articles = await getSiteArticles(this.site.id);
    }
    const idRanges = createArticleIdRanges(articles);
    if ( window.location.href != href ) {
        window.history.pushState({idRanges: idRanges}, "", href);
    } else {
        window.history.replaceState({idRanges: idRanges}, "", href);
    }
    emitFeedArticles(this.site, articles, this.onlyUnread);
}

async function viewSiteByHash(siteHash, historyState) {
    let site = null;
    let hash = parseInt(siteHash);
    if ( !isNaN(hash) ) {
        site = await getSite(hash, true);
    }
    if ( site == null ) {
        const parent = document.getElementById(ARTICLE_LIST_ID);
        parent.replaceChildren();
        const message = "<p>This feed does not exist.</p>";
        parent.insertAdjacentHTML("beforeend", message);
        if ( parent.classList.contains("d-none") ) {
            showOneMain(ARTICLE_LIST_ID);
        } else {
            window.scroll(0, 0);
        }
    } else {
        let articles;
        if ( historyState === null || historyState === undefined ) {
            articles = await getSiteArticles(this.site.id, 0);
        } else {
            articles = await getArticles(historyState.idRanges);
        }
        emitFeedArticles(site, articles, true);
    }
}

async function emitFeedArticles(site, articles, onlyUnread) {
    const parent = document.getElementById(ARTICLE_LIST_ID);
    document.title = site.title;

    parent.replaceChildren();
    if ( articles.length == 0 ) {
        if ( onlyUnread ) {
            const divNode = htmlToNode(`<div><p>There are no unread articles in this feed.</p><p><a class="btn" href="/feed/${site.hash}">View Read Articles</a></p></div>`);
            const btn = divNode.lastChild.firstChild;
            let v = viewSiteFeeds.bind({site: site, onlyUnread: false});
            btn.addEventListener('click', v);
            parent.append(divNode);
        } else {
            const message = "<p>There are no unread articles in this feed.</p>";
            parent.insertAdjacentHTML("beforeend", message);
        }
    } else {
        parent.appendChild(listArticles(articles));
    }
    if ( parent.classList.contains("d-none") ) {
        showOneMain(ARTICLE_LIST_ID);
    } else {
        window.scroll(0, 0);
    }
}

function createArticleIdRanges(articles) {
    const articleIds = articles.map((article) => article.id);
    let start = articleIds[articleIds.length - 1];
    let end = start;
    let result = [];
    for ( i = articleIds.length - 2; i >= 0; i-- ) {
        if ( articleIds[i]-end == 1 ) {
            end = articleIds[i];
        } else {
            result.push(end, start);
            start = articleIds[i];
            end = start;
        }
    }
    result.push(end, start);
    return result.reverse();
}

function listArticles(articles) {
    const list = document.createElement("ul");
    const idRanges = createArticleIdRanges(articles);
    for ( let i = 0; i < articles.length; i++ ) {
        let article = articles[i]
        const anchorClass = ( article.isRead == 1 ) ? "" : "unread";
        const toggle = ( article.isRead == 1 ) ? "Mark as unread" : "Mark as read";
        const html = `<li><a href="/article/${article.hash}" class="${anchorClass}">${article.title}</a><a href="#">${toggle}</a></li>`;
        const listItem = htmlToNode(html);
        let v = viewArticle.bind({articles: articles, index: i, idRanges: idRanges});
        let t = toggleRead.bind({article: article});
        listItem.firstChild.addEventListener('click', v);
        listItem.lastChild.addEventListener('click', t);
        list.appendChild(listItem);
    }
    return list;
}

async function viewArticleByRouter(articleHash, historyState) {
    let hash = parseInt(articleHash);
    if ( isNaN(hash) ) {
        noArticle();
        return;
    }
    if ( historyState == null ) {
        let article = await getArticle(hash, true);
        if ( article == null ) {
            noArticle();
        } else {
            emitArticle([article], 0);
        }
    } else {
        let articles = await getArticles(historyState.idRanges);
        let hashes = articles.map((article) => article.hash);
        let index = hashes.indexOf(hash);
        if ( articles.length == 0 || index == -1 ) {
            noArticle();
            return;
        } else {
            emitArticle(articles, index, historyState.idRanges);
        }
    }
}

function noArticle() {
    const parent = document.getElementById(SINGLE_ARTICLE_ID);
    parent.replaceChildren();
    const message = "<p>This article does not exist.</p>";
    parent.insertAdjacentHTML("beforeend", message);
    if ( parent.classList.contains("d-none") ) {
        showOneMain(SINGLE_ARTICLE_ID);
    } else {
        window.scroll(0, 0);
    }
}

function viewArticle(evt) {
    evt.preventDefault();
    if ( window.location.href != evt.currentTarget.href ) {
        window.history.pushState({index: this.index, idRanges: this.idRanges}, "", evt.currentTarget.href);
    }
    emitArticle(this.articles, this.index, this.idRanges);
}

async function emitArticle(articles, index, idRanges) {
    const article = articles[index];
    document.title = article.title;
    if ( article.isRead == 0 ) {
        const site = await getSite(article.siteId);
        if ( site == null ) {
            return;
        }
        site.numUnreadArticles--;
        article.isRead = 1;
        updateArticle(null, article);
        updateSite(site);
        updateSiteSidebar(site);
    }
    const parent = document.getElementById(SINGLE_ARTICLE_ID);
    const articleLink = `<p><a href="${article.link}" target="_blank">Visit site</a></p>`
    const html = `<article><h2>${article.title}</h2>${articleLink}<section>${article.content}</section></article>`;
    parent.replaceChildren();
    parent.insertAdjacentHTML("beforeend", html);
    const nav = document.createElement("section");
    if ( index > 0 ) {
        let prev = htmlToNode(`<a href="/article/${articles[index-1].hash}">Prev</a>`);
        let v = viewArticle.bind({articles: articles, index: index-1, idRanges: idRanges});
        prev.addEventListener('click', v);
        nav.appendChild(prev);
    }

    if ( index < (articles.length - 1) ) {
        let next = htmlToNode(`<a href="/article/${articles[index+1].hash}">Next</a>`);
        let v = viewArticle.bind({articles: articles, index: index+1, idRanges: idRanges});
        next.addEventListener('click', v);
        nav.appendChild(next);
    }
    parent.appendChild(nav);
    if ( parent.classList.contains("d-none") ) {
        showOneMain(SINGLE_ARTICLE_ID);
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
    updateSiteSidebar(site);
}

async function showFeeds(evt) {
    evt.preventDefault();
    const feedUrl = document.getElementById("feed-url").value;
    const loader = document.getElementById("network-loader");
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

async function listOfFeeds() {
    const parent = document.getElementById(FEED_LIST_ID);
    const sites = await getAllSites();
    parent.replaceChildren();
    if ( sites.length == 0 ) {
        const message = "<p>You've not subscribed to any feed.</p>";
        parent.insertAdjacentHTML("beforeend", message);
        return;
    }
    const table = htmlToNode("<table><thead><tr><th scope='col' colspan='1'>Feed Name</th></tr></thead><tbody></tbody></table>");
    const body = table.lastChild;
    for ( site of sites ) {
        let html = `<tr><td>${site.title}</td><td><a href="#" class="btn">Rename</a></td><td><a href="#" class="btn btn-danger">Delete</a></td></tr>`;
        let e = editSite.bind({site: site});
        let d = deleteSiteAndArticles.bind({site: site});
        let row = htmlToNode(html);
        row.children[1].firstChild.addEventListener('click', e);
        row.lastChild.firstChild.addEventListener('click', d);
        body.append(row);
    }
    parent.append(table);
    showOneMain(FEED_LIST_ID);
}

async function editSite(evt) {
    evt.preventDefault();
    const form = document.getElementById("rename-form");
    const table_row = evt.target.parentNode.parentNode;
    const parent = form.parentNode;
    const site = this.site;
    const controller = new AbortController();
    const signal = controller.signal;
    const edit = function(event) {
        event.preventDefault();
        site.title = form.querySelector('input').value;
        updateSite(site);
        updateSiteSidebar(site);
        table_row.firstChild.textContent = site.title;
        form.classList.add("d-none");
        parent.style.display = "none";
        controller.abort();
    };
    const cancel = function(event) {
        event.preventDefault();
        form.classList.add("d-none");
        parent.style.display = "none";
        controller.abort()
    };
    form.querySelector('input').value = this.site.title;
    form.querySelectorAll('span')[1].textContent = this.site.feedUrl;
    form.classList.remove("d-none");
    const btns = form.querySelectorAll("button");
    btns[0].addEventListener('click', edit, {signal});
    btns[1].addEventListener('click', cancel, {once: true});
    parent.style.display = "flex";
}

async function deleteSiteAndArticles(evt) {
    evt.preventDefault();
    const table_row = evt.target.parentNode.parentNode;
    const form = document.getElementById("delete-form");
    const parent = form.parentNode;
    let textView = form.querySelector('p');
    let previousStatement = textView.textContent;
    const site = this.site;
    const controller = new AbortController();
    const signal = controller.signal;
    const deleteAll = async function(event) {
        event.preventDefault();
        await deleteSiteArticles(site.id);
        await deleteSite(site.id);
        removeSiteFromSidebar(site);
        removeRow(table_row.parentNode, table_row);
        textView.textContent = previousStatement;
        form.classList.add("d-none");
        parent.style.display = "none";
        controller.abort();
    };
    const cancel = function(event) {
        event.preventDefault();
        textView.textContent = previousStatement;
        form.classList.add("d-none");
        parent.style.display = "none";
        controller.abort()
    };
    textView.textContent = `Are you sure you want to delete ${site.title} and all its articles?`;
    form.classList.remove("d-none");
    const btns = form.querySelectorAll("button");
    btns[0].addEventListener('click', deleteAll, {signal});
    btns[1].addEventListener('click', cancel, {once: true});
    parent.style.display = "flex";
}

function removeRow(tbody, tr) {
    tbody.removeChild(tr);
    if ( tbody.childNodes.length == 0 ) {
        let feedListSection = tbody.parentNode.parentNode;
        feedListSection.replaceChildren();
        feedListSection.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
    }
}
