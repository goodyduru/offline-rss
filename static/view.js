app.View = class View {
    htmlToNode(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        return template.content.firstChild;
    }
};

app.views.Sidebar = class SidebarView extends app.View {
    constructor() {
        super();
        this.parent = document.getElementById("sidebar-feeds");
    }

    setContent(sites) {
        this.sites = sites;
    }

    setOutputFeedFunc(outputFeedFunc) {
        this.outputFeedFunc = outputFeedFunc;
    }

    clickHandler(evt) {
        this.outputFeedFunc(this.site, this.onlyUnread, evt.currentTarget.href);
    }

    renderCount(count) {
        let countOutput;
        if ( count > 0 ) {
            countOutput = `<span>${count}</span>`;
        } else {
            countOutput = "";
        }
        return countOutput;
    }

    add(site) {
        if ( this.parent.firstChild && this.parent.firstChild.tagName == "P" ) {
            this.parent.replaceChildren();
        }
        const hash = cyrb53(site.feedUrl);
        const html = `<li><a href="/feed/${site.hash}" id="feed-${hash}">${site.title}${this.renderCount(site.numUnreadArticles)}</a></li>`;
        const listItem = this.htmlToNode(html);
        let h = this.clickHandler.bind({site: site, onlyUnread: true, outputFeedFunc: this.outputFeedFunc});
        listItem.firstChild.addEventListener('click', h);
        this.parent.appendChild(listItem);
    }

    render() {
        this.parent.replaceChildren();
        if ( this.sites.length == 0 ) {
            const message = "<p>You've not subscribed to any feed.</p>";
            this.parent.insertAdjacentHTML("beforeend", message);
            return;
        }

        for ( let site of this.sites ) {
            this.add(site);
        }
    }

    update(site) {
        const hash = cyrb53(site.feedUrl);
        const content = `${site.title}${this.renderCount(site.numUnreadArticles)}`;
        const anchor = document.getElementById(`feed-${hash}`);
        anchor.replaceChildren();
        let v = this.handler.bind({site: site, onlyUnread: true});
        anchor.addEventListener('click', v);
        anchor.innerHTML = content;
    }
    
    remove(site) {
        const hash = cyrb53(site.feedUrl);
        const anchor = document.getElementById(`feed-${hash}`);
        const list = anchor.parentNode.parentNode;
        list.removeChild(anchor.parentNode);
        if ( list.childNodes.length == 0 ) {
            list.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
        }
    }

};


app.views.Search = class SearchView {
    constructor() {
        this.searchInput = document.getElementById("query");
        this.autocomplete = document.getElementById("autocomplete");
        this.closeOnClickOutside(this.autocomplete);
    }

    closeOnClickOutside() {
        let ele = this.autocomplete;
        document.addEventListener('click', event => {
            if (!ele.contains(event.target) && ele.style.display == 'block') {
                ele.style.display = 'none';
            }
        });
    }

    closeBox() {
        this.autocomplete.style.display = "none";
    }

    bindInputChange(handleInputText) {
        this.searchInput.addEventListener("input", async (evt) => {
            const text = evt.target.value.trim();
            if ( text == "" ) {
                this.closeBox();
                return;
            }
            let resultStrings = await handleInputText(text);
            if ( resultStrings.length == 0 ) {
                return;
            }
            let resultHtml = `<ul>${resultStrings.join("")}</ul>`;
            this.autocomplete.innerHTML = resultHtml;
            this.autocomplete.style.display = "block";
            this.autocomplete.scrollTo(0, 0);
        });
    }
};

app.views.AddFeed = class AddFeedView {
    setAddFeedFunc(addFeedFunc) {
        this.addFeedFunc = addFeedFunc;
    }
    bindClickHandler(handleFeedUrl) {
        const addFeedBtn = document.getElementById("add-feed-btn");
        const feedList = document.getElementById("feed-options");
        const loader = document.getElementById("network-loader");
        const feedUrlInput = document.getElementById("feed-url");

        addFeedBtn.addEventListener("click", async (evt) => {
            evt.preventDefault();
            loader.style.display = "flex";
            const result = await handleFeedUrl(feedUrlInput.value);
            feedList.replaceChildren();
            if ( result.length == 0 ) {
                loader.style.display = "none";
                const message = "<div class='empty'><p>No feed in the given url.</p></div>";
                feedList.insertAdjacentHTML("beforeend", message);
                return;
            }
            let unorderedList = document.createElement("ul");
            feedList.appendChild(unorderedList);

            for ( let obj of result ) {
                unorderedList.insertAdjacentHTML('beforeend', obj.html);
                let f = this.addFeedHandler.bind({addFeedFunc: this.addFeedFunc, feedObj: obj.feedObj});
                let btn = document.getElementById(`${obj.feedObj.hash}`);
                if ( btn != null ) {
                    btn.addEventListener('click', f);
                }
            }
            loader.style.display = "none";
        });
    }

    async addFeedHandler(evt) {
        evt.preventDefault();
        const btn = evt.target;
        btn.textContent = "Adding...";
        btn.setAttribute('disabled', true);
        const added = await this.addFeedFunc(this.feedObj);
        if ( added ) {
            btn.textContent = "Added";
        } else {
            btn.textContent = "Add";
            btn.removeAttribute('disabled');
        }
    }
};


const ARTICLE_LIST_ID = "article-list";
const SINGLE_ARTICLE_ID = "single-article"
const FEED_LIST_ID = "feed-list"

function htmlToNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstChild;
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

function updateTitles(title) {
    document.title = title;
    const h1 = document.querySelector(".wrapper > section > h1");
    h1.textContent = title;
}

async function viewUnread() {
    const parent = document.getElementById(ARTICLE_LIST_ID);
    updateTitles("Home");
    parent.replaceChildren();
    const sites = await app.siteModel.getAll();
    if ( sites.length == 0 ) {
        let message = "<div class='empty'><p>Looks like you haven't subscribed to any feed 👀</p>";
        message += "<p><a class='btn' href='/add-feed'>Start here</a></p></div>";
        parent.insertAdjacentHTML("beforeend", message);
    } else {
        let articles = await app.articleModel.getUnread();
        if ( articles.length == 0 ) {
            const message = "<div class='empty'><p>You don't have any unread articles.</p></div>";
            parent.insertAdjacentHTML("beforeend", message);
        } else {
            parent.appendChild(listArticles(articles));
        }
    }
    if ( parent.classList.contains("d-none") ) {
        showOneMain(ARTICLE_LIST_ID);
    } else {
        window.scroll(0, 0);
    }
}

async function viewSiteFeeds(evt) {
    evt.preventDefault();
    if ( window.location.href != evt.currentTarget.href ) {
        window.history.pushState(null, "", evt.currentTarget.href);
    }
    emitFeedArticles(this.site, this.onlyUnread);
}

async function viewSiteByHash(siteHash) {
    let site = null;
    let hash = parseInt(siteHash);
    if ( !isNaN(hash) ) {
        site = await app.siteModel.get('hash', hash);
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
        emitFeedArticles(site, true);
    }
}

async function emitFeedArticles(site, onlyUnread) {
    const parent = document.getElementById(ARTICLE_LIST_ID);
    updateTitles(site.title);
    if ( onlyUnread ) {
        articles = await app.articleModel.getInSite(site.id, 0);
    } else {
        articles = await app.articleModel.getInSite(site.id);
    }

    parent.replaceChildren();
    if ( articles.length == 0 ) {
        if ( onlyUnread ) {
            const divNode = htmlToNode(`<div class="empty"><p>There are no unread articles in this feed.</p><p><a class="btn" href="/feed/${site.hash}">View Read Articles</a></p></div>`);
            const btn = divNode.lastChild.firstChild;
            let v = viewSiteFeeds.bind({site: site, onlyUnread: false});
            btn.addEventListener('click', v);
            parent.append(divNode);
        } else {
            const message = "<div class='empty'><p>There are no articles in this feed.</p></div>";
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
        const html = `<li><a href="/article/${article.hash}" class="${anchorClass}">${article.title}</a><a href="#"><span>${toggle}</span></a></li>`;
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
        let article = await app.articleModel.get(null, 'hash', hash);
        if ( article == null ) {
            noArticle();
        } else {
            emitArticle([article], 0);
        }
    } else {
        let articles = await app.articleModel.getInRanges(historyState.idRanges);
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
    updateTitles(article.title);
    if ( article.isRead == 0 ) {
        const site = await app.siteModel.get('id', article.siteId);
        if ( site == null ) {
            return;
        }
        article.isRead = 1;
        await app.articleModel.update(null, article);
        site.numUnreadArticles = await app.articleModel.countUnreadInSite(article.siteId);
        app.sidebarController.update(site);
    }
    const parent = document.getElementById(SINGLE_ARTICLE_ID);
    const html = `<article>${article.content}</article>`;
    const articleLink = `<section><a href="${article.link}" class="btn" target="_blank">Read More</a></section>`
    parent.replaceChildren();
    parent.insertAdjacentHTML("beforeend", html);
    parent.insertAdjacentHTML("beforeend", articleLink);
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
    const target = evt.currentTarget;
    this.article.isRead = (this.article.isRead == 1) ? 0 : 1;
    let add, to;
    if ( this.article.isRead == 1 ) {
        to = "Mark as unread";
        add = -1;
    } else {
        to = "Mark as read";
        add = 1;
    }
    const site = await app.siteModel.get('id', this.article.siteId);
    if ( site == null ) {
        return;
    }
    await app.articleModel.update(null, this.article);
    site.numUnreadArticles = await app.articleModel.countUnreadInSite(this.article.siteId);
    target.parentNode.firstChild.classList.toggle("unread");
    target.innerHTML = `<span>${to}</span>`;
    app.sidebarController.update(site);
}

async function listOfFeeds() {
    updateTitles("All Feeds");
    const parent = document.getElementById(FEED_LIST_ID);
    const sites = await app.siteModel.getAll();
    parent.replaceChildren();
    if ( sites.length == 0 ) {
        const message = "<p>You've not subscribed to any feed.</p>";
        parent.insertAdjacentHTML("beforeend", message);
        return;
    }
    const table = htmlToNode("<table><thead><tr><th scope='col'>Feed Name</th><th></th><th></th></tr></thead><tbody></tbody></table>");
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
    const edit = async function(event) {
        event.preventDefault();
        site.title = form.querySelector('input').value;
        app.siteModel.update(site);
        site.numUnreadArticles = await app.articleModel.countUnreadInSite(site.id);
        app.sidebarController.update(site);
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
        let ids = await app.articleModel.deleteInSite(site.id);
        await app.siteModel.delete(site.id);
        app.searchModel.delete(ids);
        app.sidebarController.delete(site);
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
