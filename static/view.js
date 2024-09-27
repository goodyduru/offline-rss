const ARTICLE_LIST_HREF = "#article-list";
const SINGLE_ARTICLE_HREF = "#single-article"

function htmlToNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstChild;
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
        const hash = cyrb53(site.feedUrl);
        const html = `<li><a href="/feed/${site.hash}">${site.title}<span id="feed-${hash}">(${site.numUnreadArticles})</span></a></li>`;
        const listItem = htmlToNode(html);
        let v = viewSiteFeeds.bind({site: site});
        listItem.firstChild.addEventListener('click', v);
        parent.appendChild(listItem);
    }
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
    const articles = await getSiteArticles(this.site.id);

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
        document.getElementById(`feed-${hash}`).textContent = `(${site.numUnreadArticles})`;
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
    document.getElementById(`feed-${hash}`).textContent = `(${site.numUnreadArticles})`;
}

function initView() {
    sidebarSites();
    viewUnread();
}

