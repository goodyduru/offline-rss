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

    render() {
        super.render();
        super.show();
    }
};