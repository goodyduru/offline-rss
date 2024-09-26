const ARTICLE_LIST_HREF = "#article-list";
const SINGLE_ARTICLE_HREF = "#single-article"

function htmlToNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstChild;
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
        const html = `<li><a href="/feed/${site.hash}">${site.title}<span>(${site.numUnreadArticles})</span></a></li>`;
        const listItem = htmlToNode(html);
        let v = viewSiteFeeds.bind({site: site});
        listItem.firstChild.addEventListener('click', v);
        parent.appendChild(listItem);
    }
}

async function viewSiteFeeds(evt) {
    evt.preventDefault();
    let target, badge;
    if ( evt.target.tagName == "SPAN" ) {
        target = evt.target.parentNode;
        badge = evt.target;
    } else {
        target = evt.target;
        badge = evt.target.querySelector('span');
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
    parent.appendChild(listArticles(articles, badge));
}

function listArticles(articles, badge) {
    const list = document.createElement("ul");
    for ( let i = 0; i < articles.length; i++ ) {
        let article = articles[i]
        const anchorClass = ( article.isRead ) ? "" : "unread";
        const toggle = ( article.isRead ) ? "Mark as unread" : "Mark as read";
        const html = `<li><a href="/article/${article.hash}" class="${anchorClass}">${article.title}</a><a href="#">${toggle}</a></li>`;
        const listItem = htmlToNode(html);
        let v = viewArticle.bind({articles: articles, index: i, badge: badge});
        let t = toggleRead.bind({article: article, badge: badge});
        listItem.firstChild.addEventListener('click', v);
        listItem.lastChild.addEventListener('click', t);
        list.appendChild(listItem);
    }
    return list;
}

async function viewArticle(evt) {
    evt.preventDefault();
    console.log(this.articles[this.index].title);
}

async function toggleRead(evt) {
    evt.preventDefault();
    this.article.isRead = !this.article.isRead;
    let add, to;
    if ( this.article.isRead ) {
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
    this.badge.textContent = `(${site.numUnreadArticles})`;
}

function initView() {
    sidebarSites();
}

