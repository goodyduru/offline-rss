app.View = class View {
    htmlToNode(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        return template.content.firstChild;
    }
};

app.PageView = class PageView extends app.View {
    renderTitle() {
        document.title = this.title;
        const h1 = document.querySelector(".wrapper > section > h1");
        h1.textContent = this.title;
    }

    show() {
        if ( this.parent.classList.contains("d-none") ) {
            document.querySelectorAll("main").forEach((content) => {
                if (content.getAttribute("id") == this.id) {
                    content.classList.remove("d-none");
                    return;
                }
                content.classList.add("d-none");
            });
        } else {
            window.scroll(0, 0);
        }
    }

    go() {
        this.render(...arguments);
    }

    render() {
        this.renderTitle();
    }
};

app.ListView = class ListView extends app.PageView {
    constructor() {
        super();
        this.id = "article-list";
        this.parent = document.getElementById(this.id);
        this.articles = null;
    }

    bindToggle(toggleFunc) {
        this.toggleFunc = toggleFunc;
    }

    bindVisit(visitFunc) {
        this.visitFunc = visitFunc;
    }

    go(articles, onlyUnread, title) {
        this.articles = articles;
        this.onlyUnread = onlyUnread;
        this.title = title;
        super.go();
    }

    list() {
        const list = document.createElement("ul");
        for ( let i = 0; i < this.articles.length; i++ ) {
            let article = this.articles[i]
            const anchorClass = ( article.isRead == 1 ) ? "" : "unread";
            const toggle = ( article.isRead == 1 ) ? "Mark as unread" : "Mark as read";
            const html = `<li><a href="/article/${article.id}" class="${anchorClass}">${article.title}</a><a href="#"><span>${toggle}</span></a></li>`;
            const listItem = this.htmlToNode(html);
            listItem.firstChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.visitFunc(i, e.currentTarget.href);
            });
            listItem.lastChild.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggle(i, e.currentTarget)
            });
            list.appendChild(listItem);
        }
        return list;
    }

    async toggle(index, target) {
        const article = this.articles[index];
        article.isRead = (article.isRead == 1) ? 0 : 1;
        let to;
        if ( article.isRead == 1 ) {
            to = "Mark as unread";
        } else {
            to = "Mark as read";
        }
        let isToggle = this.toggleFunc(index);
        if ( !isToggle ) {
            return;
        }
        target.parentNode.firstChild.classList.toggle("unread");
        target.innerHTML = `<span>${to}</span>`;
    }
};