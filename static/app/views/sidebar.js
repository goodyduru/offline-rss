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
        anchor.setAttribute('href', site.hash);
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