app.views.Home = class HomeView extends app.ListView {
    render() {
        super.render();
        this.parent.replaceChildren();
        if ( this.articles == null ) {
            let message = "<div class='empty'><p>Looks like you haven't subscribed to any feed 👀</p>";
            message += "<p><a class='btn' href='/add-feed'>Start here</a></p></div>";
            this.parent.insertAdjacentHTML("beforeend", message);
        } else {
            if ( this.articles.length == 0 ) {
                const message = "<div class='empty'><p>You don't have any unread articles.</p></div>";
                this.parent.insertAdjacentHTML("beforeend", message);
            } else {
                this.parent.appendChild(this.list());
            }
        }
        super.show();
    }
};