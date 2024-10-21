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

    clickHandler(site, onlyUnread, url) {
        this.outputFeedFunc(site, onlyUnread, url);
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

    add(site, isNew) {
        if ( this.parent.firstChild && this.parent.firstChild.tagName == "P" ) {
            this.parent.replaceChildren();
        }
        const hash = cyrb53(site.feedUrl);
        const html = `<li><a href="/feed/${site.hash}" id="feed-${hash}">${site.title}${this.renderCount(site.numUnreadArticles)}</a></li>`;
        const listItem = this.htmlToNode(html);
        if ( isNew ) {
            listItem.firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.clickHandler(site, true, e.currentTarget.href);
            });
        }
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
            this.add(site, false);
        }
    }

    update(site) {
        const hash = cyrb53(site.feedUrl);
        const content = `${site.title}${this.renderCount(site.numUnreadArticles)}`;
        const anchor = document.getElementById(`feed-${hash}`);
        anchor.replaceChildren();
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            this.clickHandler(site, true, e.currentTarget.href);
        });
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

app.PageView = class PageView extends app.View {
    renderTitle() {
        document.title = this.title;
        const h1 = document.querySelector(".wrapper > section > h1");
        h1.textContent = this.title;
    }

    show() {
        document.querySelectorAll("main").forEach((content) => {
            if (content.getAttribute("id") == this.id) {
                content.classList.remove("d-none");
                return;
            }
            content.classList.add("d-none");
        });
    }

    go() {
        this.render(...arguments);
    }

    render() {
        this.renderTitle();
        if ( this.parent.classList.contains("d-none") ) {
            this.show();
        } else {
            window.scroll(0, 0);
        }
    }
}

app.views.AddFeed = class AddFeedView extends app.PageView {
    constructor() {
        super();
        this.id = "add-feed";
        this.title = "Add New Feed";
        this.parent = document.getElementById(this.id);
    }
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
                let btn = document.getElementById(`${obj.feedObj.hash}`);
                if ( btn != null ) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.addFeed(obj.feedObj, btn);
                    });
                }
            }
            loader.style.display = "none";
        });
    }

    async addFeed(feedObj, btn) {
        btn.textContent = "Adding...";
        btn.setAttribute('disabled', true);
        const added = await this.addFeedFunc(feedObj);
        if ( added ) {
            btn.textContent = "Added";
        } else {
            btn.textContent = "Add";
            btn.removeAttribute('disabled');
        }
    }
};

app.views.ListFeeds = class ListFeedsView extends app.PageView {
    constructor() {
        super();
        this.id = "feed-list";
        this.title = "All Feeds"
        this.parent = document.getElementById(this.id);
        this.editForm = document.getElementById("rename-form");
        this.deleteForm = document.getElementById("delete-form");
    }

    setSiteFunctions(editSiteFunc, deleteSiteFunc) {
        this.editSiteFunc = editSiteFunc;
        this.deleteSiteFunc = deleteSiteFunc;
    }

    async editAction(site, table_row, controller) {
        let formParent = this.editForm.parentNode;
        site.title = this.editForm.querySelector('input').value;
        await this.editSiteFunc(site);
        table_row.firstChild.textContent = site.title;
        this.editForm.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    };

    cancelAction(controller, previousStatement) {
        let form;
        if ( typeof this.previousStatement != "undefined" ) {
            form = this.deleteForm;
            form.querySelector('p').textContent = previousStatement;
        } else {
            form = this.editForm
        }
        let formParent = form.parentNode;
        form.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    }

    editSite(site, table_row) {
        const formParent = this.editForm.parentNode;
        const controller = new AbortController();
        const signal = controller.signal;
        this.editForm.querySelector('input').value = site.title;
        this.editForm.querySelectorAll('span')[1].textContent = site.feedUrl;
        this.editForm.classList.remove("d-none");
        const btns = this.editForm.querySelectorAll("button");
        btns[0].addEventListener('click', (e) => {
            e.preventDefault();
            this.editAction(site, table_row, controller);
        }, {signal});
        btns[1].addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelAction(controller);
        }, {once: true});
        formParent.style.display = "flex";
    }

    async deleteAction(site, table_row, controller, previousStatement) {
        await this.deleteSiteFunc(site);
        let formParent = this.deleteForm.parentNode;
        let tbody = table_row.parentNode;
        tbody.removeChild(table_row);
        if ( tbody.childNodes.length == 0 ) {
            let feedListSection = tbody.parentNode.parentNode;
            feedListSection.replaceChildren();
            feedListSection.insertAdjacentHTML("beforeend", "<p>You've not subscribed to any feed.</p>");
        }
        this.deleteForm.querySelector('p').textContent = previousStatement;
        this.deleteForm.classList.add("d-none");
        formParent.style.display = "none";
        controller.abort();
    }

    deleteSite(site, table_row) {
        const parent = this.deleteForm.parentNode;
        let textView = this.deleteForm.querySelector('p');
        let previousStatement = textView.textContent;
        const controller = new AbortController();
        const signal = controller.signal;
        textView.textContent = `Are you sure you want to delete ${site.title} and all its articles?`;
        this.deleteForm.classList.remove("d-none");
        const btns = this.deleteForm.querySelectorAll("button");
        btns[0].addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteAction(site, table_row, controller, previousStatement);
        }, {signal});
        btns[1].addEventListener('click', (e) => {
            e.preventDefault();
            this.cancelAction(controller, previousStatement);
        }, {once: true});
        parent.style.display = "flex";
    }
    
    render(sites) {
        super.render();
        this.parent.replaceChildren();
        if ( sites.length == 0 ) {
            const message = "<p>You've not subscribed to any feed.</p>";
            parent.insertAdjacentHTML("beforeend", message);
            return;
        }
        const table = htmlToNode("<table><thead><tr><th scope='col'>Feed Name</th><th></th><th></th></tr></thead><tbody></tbody></table>");
        const body = table.lastChild;
        for ( let site of sites ) {
            let html = `<tr><td>${site.title}</td><td><a href="#" class="btn">Rename</a></td><td><a href="#" class="btn btn-danger">Delete</a></td></tr>`;
            let row = htmlToNode(html);
            row.children[1].firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.editSite(site, row);
            });
            row.lastChild.firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.deleteSite(site, row)
            });
            body.append(row);
        }
        this.parent.append(table);
    }
};

app.views.Article = class ArticleView extends app.PageView {
    constructor() {
        super();
        this.id = "single-article";
        this.title = "Article Not Found";
        this.parent = document.getElementById(this.id);
        this.articles = null;
        this.index = null;
        this.idRanges = null;
    }

    setUpdateHandler(updateHandler) {
        this.updateHandler = updateHandler;
    }

    go(articles, index, idRanges) {
        if ( typeof articles == 'undefined' || articles.length == 0 || index == -1 ) {
            this.articles = null;
            this.index = null;
            this.idRanges = null;
            this.title = "Article Not Found";
        } else {
            this.articles = articles;
            this.index = index;
            this.idRanges = idRanges;
            this.title = articles[index].title;
        }
        super.go();
    }

    render() {
        super.render();
        this.parent.replaceChildren();
        if ( this.articles == null ) {
            this.renderNoArticle();
        } else {
            this.renderArticle();
        }
    }

    renderNoArticle() {
        const message = "<p>This article does not exist.</p>";
        this.parent.insertAdjacentHTML("beforeend", message);
    }

    renderArticle() {
        const article = this.articles[this.index];
        const html = `<article>${article.content}</article>`;
        const articleLink = `<section><a href="${article.link}" class="btn" target="_blank">Read More</a></section>`
        this.parent.insertAdjacentHTML("beforeend", html);
        this.parent.insertAdjacentHTML("beforeend", articleLink);
        const nav = document.createElement("section");
        if ( this.index > 0 ) {
            let prev = this.htmlToNode(`<a href="/article/${this.articles[this.index-1].hash}">Prev</a>`);
            prev.addEventListener('click', (e) => {
                e.preventDefault();
                this.clickHandler(this.index-1)
            });
            nav.appendChild(prev);
        }

        if ( this.index < (this.articles.length - 1) ) {
            let next = this.htmlToNode(`<a href="/article/${this.articles[this.index+1].hash}">Next</a>`);
            next.addEventListener('click', (e) => {
                e.preventDefault();
                this.clickHandler(this.index+1);
            });
            nav.appendChild(next);
        }
        this.parent.appendChild(nav);
    }

    clickHandler(index) {
        this.index = index;
        let url = `/article/${this.articles[index].hash}`;
        this.updateHandler(this.articles, index, this.idRanges, url);
        this.title = this.articles[index].title;
        this.render();
    }
}


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

function viewArticle(evt) {
    evt.preventDefault();
    app.singleArticleController.go(this.articles, this.index, this.idRanges, evt.currentTarget.href);
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