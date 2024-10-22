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
        super.show();
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
};