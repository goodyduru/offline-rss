app.views.ListArticles = class ListArticlesView extends app.ListView {
    constructor() {
        super();
        this.site = null;
    }

    setSite(site) {
        this.site = site;
    }

    bindViewAll(viewAllFunc) {
        this.viewAllFunc = viewAllFunc;
    }

    render() {
        super.render();
        this.parent.replaceChildren();
        if ( this.site == null ) {
            const message = "<p>This feed does not exist.</p>";
            this.parent.insertAdjacentHTML("beforeend", message);
            return;
        }
        if ( this.articles.length == 0 ) {
            if ( this.onlyUnread ) {
                const divNode = this.htmlToNode(`<div class="empty"><p>There are no unread articles in this feed.</p><p><a class="btn" href="/feed/${this.site.hash}">View Read Articles</a></p></div>`);
                const btn = divNode.lastChild.firstChild;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.viewAllFunc();
                });
                this.parent.append(divNode);
            } else {
                const message = "<div class='empty'><p>There are no articles in this feed.</p></div>";
                this.parent.insertAdjacentHTML("beforeend", message);
            }
        } else {
            this.parent.appendChild(this.list());
        }
        super.show();
    }
};